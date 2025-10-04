# Execution Order: Cloud E2E Workflow

**Purpose**: Run complete SaaS E2E with MLB live data against Supabase Cloud

**Prerequisites**:
- Supabase Cloud project URL and service role key
- Odds API key with sufficient credits
- Discord bot token and channel IDs

---

## 1. Environment Setup

```bash
cd C:\Users\griff\OneDrive\Desktop\unit-talk-production-main

# Edit .env.cloud with your actual values:
# - SUPABASE_URL=https://lxqmuzmqtnnlpfapvief.supabase.co
# - SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Edit .env.shared with your actual values:
# - ODDS_API_KEY=<your-odds-api-key>
# - DISCORD_BOT_TOKEN=<your-discord-bot-token>
# - DISCORD_ALERT_CHANNEL_ID=<your-channel-id>
# - DISCORD_RECAP_CHANNEL_ID=<your-channel-id>
```

---

## 2. Start Cloud Profile (NO postgres)

```bash
# Stop any existing containers
docker-compose --profile cloud down || docker-compose down
docker-compose --profile local down || true

# Start cloud profile services (redis, temporal, prometheus, grafana, api-cloud)
docker-compose --profile cloud up -d redis temporal temporal-ui prometheus grafana

# Start API service with cloud profile (uses .env.cloud + .env.shared)
docker-compose --profile cloud up -d --force-recreate --no-deps api-cloud

# Verify no local DB env leaked
docker-compose --profile cloud exec api-cloud printenv | grep -i DATABASE_URL && echo "❌ BAD: LOCAL DB ENV LEAKED" || echo "✅ OK: NO LOCAL DB ENV"
```

---

## 3. Supabase Cloud Link & Migrations

```bash
# Login to Supabase (interactive - will open browser)
supabase logout || true
supabase login

# Link to cloud project
supabase link --project-ref lxqmuzmqtnnlpfapvief --local-config .supabase/config.cloud.toml

# Pull current schema (to check state)
supabase db pull --local-config .supabase/config.cloud.toml

# Push migrations to cloud (applies baseline if needed)
supabase db push --local-config .supabase/config.cloud.toml
```

**Expected Output**: Migrations applied successfully

---

## 4. Health Check

```bash
# Run database health check inside container
docker-compose --profile cloud exec api-cloud npm run db:health

# Check output
cat apps/api/out/ops/db_health.json
```

**Expected Output**: All checks PASS, tables exist, RLS enabled

---

## 5. Run E2E Pipeline

```bash
# Run complete E2E: Feed → Scoring → Approval → Alert → Recap → Verify
docker-compose --profile cloud exec api-cloud npm run e2e

# Monitor logs in separate terminal (optional)
docker-compose --profile cloud logs -f api-cloud
```

**Expected Output**:
- All 6 stages complete successfully
- Artifacts written to `apps/api/out/ops/`
- One-line summary printed to stdout
- Exit code 0 if all gates pass

**Artifacts Generated**:
- `apps/api/out/ops/agents/feedagent-<RUNID>.json`
- `apps/api/out/ops/agents/scoringagent-<RUNID>.json`
- `apps/api/out/ops/agents/approvalagent-<RUNID>.json`
- `apps/api/out/ops/agents/alertagent-<RUNID>.json`
- `apps/api/out/ops/agents/recapagent-<RUNID>.json`
- `apps/api/out/ops/verify_cloud_<RUNID>.json`
- `apps/api/out/ops/E2E_AUDIT_<RUNID>.json`
- `apps/api/out/ops/E2E_AUDIT_<RUNID>.md`
- `apps/api/out/ops/ACCEPTANCE_GATES_SUMMARY.md` (appended)

---

## 6. Review Results

```bash
# View final summary (already appended during E2E run)
cat apps/api/out/ops/ACCEPTANCE_GATES_SUMMARY.md

# View detailed audit
cat apps/api/out/ops/E2E_AUDIT_*.md

# View verify cloud data
cat apps/api/out/ops/verify_cloud_*.json
```

**Expected Data**:
- Total picks > 0
- MLB picks > 0
- Market mix shows h2h, spreads, totals, player_props
- Bookmaker mix shows draftkings, caesars, betmgm, fanduel
- All 6 acceptance gates PASS

---

## 7. Understanding the One-Line Summary

The E2E script prints a one-line summary to stdout at completion:

```
[SUMMARY <RUNID>] events=<n> props_processed=<n> inserted=<n> dedup=<n> scored=<n> approved=<n> alerts_posted=<n> discord_channel=<id> at=<timestamp>
```

**Example**:
```
[SUMMARY 2025-10-01T12-00-00-000Z] events=47 props_processed=1247 inserted=823 dedup=424 scored=0 approved=5 alerts_posted=1 discord_channel=123456789 at=2025-10-01T12:00:00Z
```

**Metrics Explained**:
- `events`: Number of MLB games fetched from Odds API
- `props_processed`: Total odds/props transformed to unified format
- `inserted`: New picks inserted into database
- `dedup`: Picks skipped due to deduplication
- `scored`: Picks considered by ScoringAgent (smoke mode: 0)
- `approved`: Picks approved by ApprovalAgent (smoke mode: random 1-10)
- `alerts_posted`: 1 if Discord token configured, 0 otherwise
- `discord_channel`: Channel ID from environment
- `at`: Timestamp of alert stage

## 8. Acceptance Gates

**Expected**: All 6 gates PASS

| Gate | Expected Result |
|------|-----------------|
| Feed | ✅ Events > 0 AND (inserted > 0 OR dedup > 0) |
| Scoring | ✅ Picks considered > 0 |
| Approval | ✅ Picks approved > 0 |
| Alert | ✅ Discord metadata captured |
| Recap | ✅ Recap generated |
| Cloud Verify | ✅ Cloud state validated |

---

## Troubleshooting

### Issue: "Relation does not exist"

**Cause**: Migrations not applied
**Fix**:
```bash
npm run db:push:cloud
npm run db:health
```

### Issue: Feed stage 0 inserts and 0 dedup

**Cause**: Writer mapping or schema mismatch
**Fix**:
1. Check `apps/api/out/ops/agents/feedagent-sample-payload.json` for sample data
2. Verify column types match migration
3. Generate fix migration if needed
4. Re-run feed stage only

### Issue: dbGuard fails with "Local DB detected"

**Cause**: DATABASE_URL leaked into cloud environment
**Fix**:
```bash
# Check environment
docker-compose --profile cloud exec api-cloud printenv | grep DATABASE

# Ensure using cloud profile
docker-compose --profile cloud down
docker-compose --profile cloud up -d --force-recreate api-cloud
```

### Issue: Supabase queries return null

**Cause**: RLS policies blocking or service role key not configured
**Fix**:
1. Verify `SUPABASE_SERVICE_ROLE_KEY` is set (not anon key)
2. Check RLS policies allow service role access
3. Run health check: `npm run db:health`

---

## Rollback: Green Cutover (If Needed)

If schema drift is irreparable:

```bash
# 1. Create new Supabase project via dashboard (call it "Green")

# 2. Update .env.cloud with new project URL and keys
# SUPABASE_URL=https://<NEW_PROJECT_REF>.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=<NEW_SERVICE_ROLE_KEY>

# 3. Update .supabase/config.cloud.toml
# project_id = "<NEW_PROJECT_REF>"

# 4. Link to new project
supabase link --project-ref <NEW_PROJECT_REF> --local-config .supabase/config.cloud.toml

# 5. Push baseline migration
npm run db:push:cloud

# 6. Verify health
npm run db:health

# 7. Run E2E against clean database
npm run e2e
```

---

## Success Criteria

✅ **All 9 Acceptance Gates PASS**
✅ **E2E Summary shows non-zero metrics**
✅ **Artifacts written to out/ops/**
✅ **Cloud verification shows picks in database**
✅ **Discord alerts posted (if configured)**

---

## Next Steps After Success

1. **Monitor production**: Set up alerts for agent failures
2. **Schedule E2E**: Run every 72h to keep data fresh
3. **Import historicals**: Backfill historical picks if needed
4. **Scale up**: Increase Odds API polling frequency
5. **Add sports**: Extend to NFL, NBA, NHL as needed

---

**Questions?** See `docs/OPS_DB.md` for database operations reference.
