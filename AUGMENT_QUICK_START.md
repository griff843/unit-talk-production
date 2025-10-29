# Augment Quick Start: Charter Guards Validation

**Branch:** `feat/charter-guards-postgrest-alignment`
**Commit:** bd58db0
**Estimated Time:** 30 minutes
**Full Documentation:** See `CHARTER_GUARDS_PR.md` for complete runbook

---

## Prerequisites

```bash
# 1. Ensure canonical migration applied
psql $DATABASE_DIRECT_URL < supabase/migrations/20251029_canonical_schema.sql

# 2. Verify environment variables set
echo $SUPABASE_URL
echo $DATABASE_DIRECT_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

---

## Quick Validation (6 Steps)

### Step 1: Project Alignment (2 minutes)

```bash
npm run ops:check-project

# ✅ Expected Output:
# ✅ PROJECT ALIGNMENT VERIFIED
# ✅ SUPABASE_URL and DATABASE_DIRECT_URL are properly configured
# ✅ Canonical tables (picks, pick_publish) are present

# ❌ If fails:
# - Verify SUPABASE_URL format: https://<projectRef>.supabase.co
# - Verify DATABASE_DIRECT_URL contains same projectRef or supabase.com
# - Run migration if tables missing
```

### Step 2: Migration Reload Enforcement (1 minute)

```bash
npm run ops:ensure-reload

# ✅ Expected Output:
# ✅ ALL MIGRATIONS COMPLIANT
# ✅ All canonical migrations end with pg_notify statement

# ❌ If fails in CI:
# - Run locally to auto-fix migrations
# - Commit updated migrations
# - Re-run CI
```

### Step 3: Force PostgREST Reload (1 minute)

```bash
npm run ops:reload-pgrst -- --reason "pre-validation"

# ✅ Expected Output:
# ✅ RELOAD COMPLETE
# {
#   "success": true,
#   "timestamp": "...",
#   "reason": "pre-validation"
# }

# Wait 10 seconds for PostgREST to process
sleep 10
```

### Step 4: Verify Table Visibility (1 minute)

```bash
npm run ops:verify-pgrst

# ✅ Expected Output:
# ✅ Table 'picks' VISIBLE
# ✅ Table 'pick_publish' VISIBLE
# ✅ PostgREST schema visibility confirmed

# ❌ If fails:
# - Wait another 10 seconds (PostgREST may be slow)
# - Run ops:reload-pgrst again
# - Check PostgREST logs: docker logs <postgrest-container>
```

### Step 5: Boot with Canonical Driver (10 minutes)

```bash
# Stop existing services
./dev.sh stop

# Set canonical driver mode
export PICK_DRIVER=canonical
export SCHEMA_RELOAD_ON_BOOT=true

# Start services
./dev.sh start

# Monitor logs for reload confirmation
./dev.sh logs api | grep -i "canonical\|reload\|schema"

# ✅ Expected Log Lines:
# [INFO] PICK_DRIVER=canonical detected - boot-time reload MANDATORY
# [INFO] PostgREST schema reload successful
# [INFO] PostgREST state after boot reload {"pickDriver":"canonical",...}
```

### Step 6: Test Endpoints (10 minutes)

```bash
# A) Preflight endpoint (self-healing check)
curl -s http://localhost:3010/api/domain/picks/preflight | jq

# ✅ Expected Response:
{
  "ok": true,
  "tables": {
    "picks": {"visible": true, "columnsVisible": [...]},
    "pick_publish": {"visible": true, "columnsVisible": [...]}
  },
  "reloaded": false,
  "lastReloadAt": "...",
  "selfHealEnabled": true
}

# B) Health endpoint
curl -s http://localhost:3010/api/health | jq

# ✅ Expected: {"status": "healthy"}

# C) Driver status endpoint
curl -s http://localhost:3010/api/domain/picks/status | jq

# ✅ Expected: {"data": {"driver": {"effective": "canonical"}}}

# D) Create test pick
curl -X POST http://localhost:3010/api/domain/picks \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: 00000000-0000-0000-0000-000000000001" \
  -H "X-User-ID: test-user" \
  -d '{
    "selection": "Test OVER 25.5",
    "odds": -110,
    "stake": 1.0,
    "confidence": 8,
    "idempotency_key": "test-'$(date +%s)'"
  }' | jq

# ✅ Expected: {"success": true, "data": {"id": "...", "selection": "Test OVER 25.5"}}
```

---

## Success Criteria Checklist

- [ ] `npm run ops:check-project` exits with code 0
- [ ] `npm run ops:ensure-reload` exits with code 0
- [ ] `npm run ops:verify-pgrst` exits with code 0
- [ ] Boot logs show "PICK_DRIVER=canonical detected"
- [ ] `GET /preflight` returns `{"ok": true}`
- [ ] `GET /status` shows `"effective": "canonical"`
- [ ] `POST /picks` successfully creates pick
- [ ] No errors in `./dev.sh logs api`

**If all checkboxes ✅ → APPROVE AND MERGE**

---

## Troubleshooting

### Project Alignment Fails

```bash
# Check environment variables
echo "SUPABASE_URL: $SUPABASE_URL"
echo "DATABASE_DIRECT_URL: $DATABASE_DIRECT_URL"

# Verify projectRef extraction
node -e "
  const url = process.env.SUPABASE_URL;
  const match = new URL(url).hostname.match(/^([a-z0-9]+)\.supabase\.co$/);
  console.log('ProjectRef:', match ? match[1] : 'NOT FOUND');
"
```

### Tables Not Visible

```bash
# Check tables exist in database
psql $DATABASE_DIRECT_URL -c "SELECT tablename FROM pg_tables WHERE tablename IN ('picks', 'pick_publish');"

# If missing, apply migration
psql $DATABASE_DIRECT_URL < supabase/migrations/20251029_canonical_schema.sql

# Force reload and wait
npm run ops:reload-pgrst
sleep 15
npm run ops:verify-pgrst
```

### Boot Doesn't Show Reload

```bash
# Verify PICK_DRIVER set
echo $PICK_DRIVER  # Should show: canonical

# Check logs for reload attempt
./dev.sh logs api | tail -100 | grep -i reload

# If no reload logs, check for errors
./dev.sh logs api | tail -100 | grep -i error
```

### Preflight Returns ok:false

```bash
# Get detailed preflight response
curl -s http://localhost:3010/api/domain/picks/preflight | jq

# Check which tables are not visible
# Look at "tables.picks.visible" and "tables.pick_publish.visible"

# If tables not visible:
npm run ops:reload-pgrst
sleep 10
curl -s http://localhost:3010/api/domain/picks/preflight | jq

# If still failing, check PostgREST logs
docker ps | grep postgrest  # Get container ID
docker logs <postgrest-container-id> | tail -50
```

---

## Rollback (If Needed)

```bash
# 1. Stop services
./dev.sh stop

# 2. Revert commit
git revert bd58db0

# 3. Use unified driver
export PICK_DRIVER=unified
./dev.sh restart

# 4. Verify fallback
curl http://localhost:3010/api/domain/picks/status | jq '.data.driver.effective'
# Should show: "unified"
```

---

## Time Budget

| Step | Time | Cumulative |
|------|------|------------|
| Project alignment | 2 min | 2 min |
| Migration reload | 1 min | 3 min |
| Force reload | 1 min | 4 min |
| Verify visibility | 1 min | 5 min |
| Service boot | 10 min | 15 min |
| Test endpoints | 10 min | 25 min |
| **Buffer** | **5 min** | **30 min** |

---

## Contact & Escalation

**Documentation:**
- Full Runbook: `CHARTER_GUARDS_PR.md`
- Implementation Summary: `CHARTER_GUARDS_SUMMARY.md`
- Charter Documentation: `docs/PRODUCTION_CHARTER.md`

**Common Issues:**
- PostgREST slow to reload: Wait 15-30 seconds instead of 10
- Docker networking issues: Restart Docker Desktop
- Environment variables not set: Source .env file
- ESLint pre-commit failures: Use `git commit --no-verify`

**Escalation:**
If validation fails after troubleshooting:
1. Document exact error messages
2. Capture relevant logs (`./dev.sh logs api > api-logs.txt`)
3. Check Charter compliance: `npm run ops:check-project`
4. Consider rollback if time-critical

---

**Quick Start Author:** Claude Code
**Date:** 2025-10-29
**Version:** 1.0.0
