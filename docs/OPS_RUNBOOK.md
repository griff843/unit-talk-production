# Operations Runbook

**Platform**: Unit Talk Production
**Last Updated**: 2025-10-22 (Phase 4 Remediation)
**Owner**: Platform Engineering

---

## 🚀 Quick Start

### Start Schedulers

**Windows (PowerShell)**:
```powershell
.\scripts\ops\start-schedulers.ps1
```

**Cross-platform (npm)**:
```bash
npm run ops:start-schedulers
```

### Verify Health

```bash
npm run ops:verify
```

**Expected output**: `🎉 ALL CHECKS PASSED` (exit code 0)

---

## 📊 Quick Health SQL

**For Supabase SQL Editor** - Copy and paste these queries:

###  1. Board & Feed Presence (Today+)

```sql
-- Board & feed presence today+
select
  (select count(*) from public.v_daily_board where game_date >= now()::date)  as board_rows,
  (select count(*) from public.v_prop_read_model where game_date >= now()::date) as feed_rows,
  (select count(*) from public.scored_props where updated_at >= now() - interval '2 hours') as scored_recent_rows,
  (select jsonb_agg(jsonb_build_object('prop_id', prop_id, 'queue_status', 'approved', 'publish_at', publish_at)
     order by publish_at desc)
   from public.v_daily_board
   where queue_status = 'approved'
   limit 5) as last_approved;
```

**Expected Results**:
- `board_rows`: >0 (indicates picks available)
- `feed_rows`: >0 (indicates props available)
- `scored_recent_rows`: >0 (indicates scoring is active)
- `last_approved`: JSON array of recently approved picks

### 2. Loop Freshness (Agent Health)

```sql
-- Loop freshness
select agent, max(created_at) as last_ping
from public.agent_health
group by agent
order by last_ping desc;
```

**Expected Results**:
- All agents should have pinged within last 2 minutes
- If `last_ping` > 2 min ago: Agent may be stale (check logs)

### 3. Pings Last Hour

```sql
-- Pings last hour
select agent, count(*) as pings_last_hr
from public.agent_health
where created_at >= now() - interval '1 hour'
group by agent
order by 1;
```

**Expected Results**:
- FeedLoop: ~80 pings (every 45s)
- ScoringLoop: ~120 pings (every 30s)
- PromotionSweep: ~120 pings (every 30s)

---

## 🛠️ Common Operations

### Manual Approve/Deny (Fallback)

If Command Center UI is unavailable, use RPC functions directly:

**Approve a pick**:
```sql
select approve_pick('{queue_id}'::uuid, '{actor_id}'::uuid, 'ok');
```

**Deny a pick**:
```sql
select deny_pick('{queue_id}'::uuid, '{actor_id}'::uuid, 'nope');
```

**Find queue_id for a pick**:
```sql
select id as queue_id, prop_ref, status
from public.promotion_queue
where status = 'pending'
order by created_at desc
limit 10;
```

### View Latest Picks Pending Approval

```sql
select
  pq.id as queue_id,
  up.selection,
  up.odds,
  sp.professional_score,
  sp.tier,
  pq.status,
  pq.created_at
from public.promotion_queue pq
join public.unified_picks up on up.id = pq.prop_ref
left join public.scored_props sp on sp.prop_ref = up.id
where pq.status = 'pending'
order by sp.professional_score desc nulls last, pq.created_at
limit 20;
```

### Check Recent Scoring Activity

```sql
select
  sp.prop_ref,
  sp.professional_score,
  sp.tier,
  sp.edge,
  sp.clv_pct,
  sp.updated_at,
  up.selection,
  up.odds
from public.scored_props sp
join public.unified_picks up on up.id = sp.prop_ref
where sp.updated_at >= now() - interval '1 hour'
order by sp.updated_at desc
limit 50;
```

---

## 🚨 Emergency Procedures

### Emergency Stop

**Stop all schedulers immediately**:
```bash
npm run ops:stop-schedulers
# or
pm2 stop unit-talk-schedulers
```

**Verify stopped**:
```bash
pm2 list
# Should show "stopped" status for unit-talk-schedulers
```

### Restart After Issue Resolution

```bash
npm run ops:restart-schedulers
# or
pm2 restart unit-talk-schedulers
```

**Verify restart**:
```bash
npm run ops:verify
```

### Check Logs for Errors

**PM2 logs**:
```bash
npm run ops:logs-schedulers
# or
pm2 logs unit-talk-schedulers --lines 100
```

**Filter for errors**:
```bash
pm2 logs unit-talk-schedulers --err --lines 50
```

---

## 📈 Monitoring & Observability

### Watchdog Agent Health

**Run watchdog** (checks for stale agents):
```bash
npm run ops:watchdog
```

**Expected output**:
- Exit code 0: All agents healthy
- Exit code 1: Stale agents detected (>2 min since last ping)

**Watchdog output location**:
```
out/ops/health/watchdog_agent_health.json
```

### Command Center Verification

**Run full verification**:
```bash
npm run ops:verify
```

**Verification checks**:
1. ✅ Board has rows (v_daily_board)
2. ✅ Feed has rows (v_prop_read_model)
3. ✅ Recent scoring (scored_props updated in last 2h)
4. ✅ Last approved picks (promotion_queue)

**Verification output location**:
```
out/ops/verify/verify_command_center.json
```

### Scheduler Artifacts

**Location**:
```
apps/api/out/ops/schedulers/
├── feedloop-<timestamp>.json
├── scoringloop-<timestamp>.json
└── promotionloop-<timestamp>.json
```

**Sample artifact (ScoringLoop)**:
```json
{
  "agent": "ScoringAgent",
  "timestamp": "2025-10-04T13:54:59.920Z",
  "considered": 22,
  "inserted": 0,
  "updated": 22,
  "errors": 0
}
```

### Artifact Cleanup

**Manual cleanup** (older than 7 days):
```bash
find apps/api/out/ops/schedulers -type f -mtime +7 -delete
find out/ops/health -type f -mtime +7 -delete
find out/ops/verify -type f -mtime +7 -delete
```

---

## 🧹 Database Cleanup

### Generate Cleanup Plan

```bash
npm run ops:cleanup-plan
```

**⚠️ CRITICAL**: This generates a DRY-RUN plan only. NO drops are executed.

**Output location**:
```
apps/api/out/ops/cleanup/<timestamp>/
├── 01_inventory_tables.csv
├── 02_dependencies.csv
├── 03_keep_vs_drop.json
├── 05_drop_plan.sql (ALL COMMENTED)
├── 06_archive_plan.sql (ALL COMMENTED)
├── protect_conflicts.json
└── CLEANUP_README.md
```

### Protected Objects

**View protected objects**:
```sql
select kind, name, reason
from public.admin_keep_objects
order by kind, name;
```

**Expected protected objects**:
- **12 tables**: unified_picks, raw_props, scored_props, promotion_queue, settled_outcomes, player_stats, players, games, users, api_quota_configs, runtime_config, agent_health
- **6 views**: v_daily_board, v_prop_read_model, v_open_promotions, v_best_line_now, v_recent_settlement, v_command_center_board
- **3 functions**: submit_pick, approve_pick, deny_pick

**⚠️ NEVER DROP PROTECTED OBJECTS WITHOUT EXPLICIT DBA APPROVAL**

### Cleanup Execution (When Approved)

**See**: `CLEANUP_PLAYBOOK.md` for complete safe execution procedures.

**TL;DR**:
1. Full database backup
2. Staging rehearsal
3. Archive phase (reversible)
4. Wait 48 hours
5. Drop phase (small batches)
6. Verification

---

## 📊 Performance Metrics

### Scheduler Performance

| Loop | Interval | Avg Duration | Updates/Cycle |
|------|----------|--------------|---------------|
| FeedLoop | 45s | ~150ms | N/A |
| ScoringLoop | 30s | ~2.2s | 22 scores |
| PromotionLoop | 30s | ~140ms | Variable |

**Query for loop performance**:
```sql
select
  agent,
  count(*) as total_pings,
  min(created_at) as first_ping,
  max(created_at) as last_ping,
  extract(epoch from (max(created_at) - min(created_at))) / count(*) as avg_interval_sec
from public.agent_health
where created_at >= now() - interval '1 hour'
group by agent
order by agent;
```

---

## 🔧 Troubleshooting

### Schedulers Not Running

**Check PM2 status**:
```bash
pm2 list
```

**If not in list, start**:
```bash
npm run ops:start-schedulers
```

**If stopped, restart**:
```bash
npm run ops:restart-schedulers
```

### No Recent Scoring (A3 check fails)

**Manually trigger scoring**:
```bash
cd apps/api
npx tsx src/runner/runScoringAgent.ts
```

**Check for errors in logs**:
```bash
pm2 logs unit-talk-schedulers --err --lines 100
```

### Stale Agent Alerts

**Run watchdog to identify stale agents**:
```bash
npm run ops:watchdog
```

**Check last ping time**:
```sql
select agent, created_at,
       extract(epoch from (now() - created_at))/60 as minutes_since_ping
from public.agent_health
where created_at in (
  select max(created_at)
  from public.agent_health
  group by agent
)
order by created_at desc;
```

**If agent stale > 5 min**: Restart schedulers

### Command Center UI Not Showing Picks

**Verify data exists**:
```sql
select count(*) from public.v_daily_board where game_date >= now()::date;
```

**If count = 0**:
1. Check scoring: `select count(*) from public.scored_props where updated_at >= now() - interval '1 hour'`
2. Check raw props: `select count(*) from public.raw_props where game_date >= now()::date`
3. Restart schedulers if both are 0

**Check Command Center logs**:
```bash
# If running locally
cd apps/command-center
npm run dev
```

---

## 📞 Support

### Quick Commands Reference

| Operation | Command |
|-----------|---------|
| Start schedulers | `npm run ops:start-schedulers` |
| Stop schedulers | `npm run ops:stop-schedulers` |
| Restart schedulers | `npm run ops:restart-schedulers` |
| View logs | `npm run ops:logs-schedulers` |
| Verify health | `npm run ops:verify` |
| Run watchdog | `npm run ops:watchdog` |
| Generate cleanup plan | `npm run ops:cleanup-plan` |

### File Locations

| Artifact | Location |
|----------|----------|
| Scheduler artifacts | `apps/api/out/ops/schedulers/` |
| Health reports | `out/ops/health/` |
| Verification reports | `out/ops/verify/` |
| Cleanup plans | `apps/api/out/ops/cleanup/` |

### Documentation

| Topic | Document |
|-------|----------|
| Scheduler setup | `docs/OPS_SCHEDULERS.md` |
| Database cleanup | `CLEANUP_PLAYBOOK.md` |
| Read-models wiring | `READMODELS_WIRING.md` |
| Command Center setup | `apps/command-center/CLAUDE.md` |
| Secrets policy | `docs/SECRETS_POLICY.md` |
| Dependency upgrades | `docs/DEPENDENCY_UPGRADE_PLAN.md` |

---

## 🔄 Phase 4 Workflows (October 2025)

### Nightly Baseline Workflow

**Schedule**: Daily at 02:15 UTC
**Workflow**: `.github/workflows/nightly-baseline.yml`
**Purpose**: Automated health checks and drift detection

**Checks Performed**:
1. Schema drift detection (`supabase db diff --linked`)
2. Gate verification (5 gates: raw props, market props, scored props, feed, board)
3. SLO verification (error rate, response time, agent health)
4. Auto-creates GitHub issues on failure

**Manual Trigger**:
```bash
gh workflow run nightly-baseline.yml
```

**Artifacts**:
- `schema-drift.txt` (30-day retention)
- `gate-verification.json` (30-day retention)
- `slo-verification.json` (30-day retention)

**Troubleshooting**:
- **Schema drift detected**: Review migration files, apply pending migrations
- **Gate failure**: Check database connectivity, verify data ingestion
- **SLO failure**: Review Prometheus metrics, check agent health

---

### Weekly Cleanup Workflow

**Schedule**: Monday at 03:00 UTC
**Workflow**: `.github/workflows/weekly-cleanup.yml`
**Purpose**: Identify stale data for cleanup (DRY-RUN only)

**Scans For**:
- Stale props (>90 days)
- Old picks (>180 days)
- Orphaned scores (no matching prop)
- Stale agent health (>7 days)

**Manual Trigger**:
```bash
gh workflow run weekly-cleanup.yml
```

**Artifacts**:
- `cleanup-inventory-YYYYMMDD.json` (90-day retention)

**Action Required**:
1. Download cleanup inventory artifact
2. Review items for deletion
3. Execute cleanup manually using approved procedures
4. Document cleanup actions in GitHub issue

**⚠️ IMPORTANT**: This workflow does NOT execute deletions. Manual approval required.

---

### Build Hygiene Workflow

**Trigger**: On PR and push to master/main
**Workflow**: `.github/workflows/build-hygiene.yml`
**Purpose**: Prevent merge conflicts and dependency issues

**Checks Performed**:
1. Merge conflict detection in `package-lock.json`
2. Lock file integrity (`npm ci --ignore-scripts`)
3. Uncommitted changes (`npm install --package-lock-only && git diff`)
4. Duplicate dependencies (`npm dedupe --dry-run`)

**Failure Actions**:
- **Merge conflict**: Resolve conflicts in `package-lock.json`
- **Lock file integrity**: Run `npm install` and commit changes
- **Uncommitted changes**: Commit `package-lock.json` changes
- **Duplicate dependencies**: Run `npm dedupe` and commit changes

---

### Agent Watchdog

**Schedule**: Every 2 minutes (PM2-managed)
**Script**: `apps/api/src/scripts/ops/watchdogAgentHealth.ts`
**Purpose**: Continuous agent health monitoring

**Start Watchdog**:
```bash
npm run ops:watchdog-start
```

**Stop Watchdog**:
```bash
npm run ops:watchdog-stop
```

**View Logs**:
```bash
npm run ops:watchdog-logs
```

**Alert Threshold**: Agent stale > 2 minutes
**Alert Channel**: Discord ops webhook

**Troubleshooting**:
- **Agent stale**: Check agent process, restart if needed
- **No alerts**: Verify Discord webhook URL in GitHub Secrets
- **Watchdog not running**: Check PM2 status (`pm2 list`)

---

## 📋 Phase 4 Audit Cadence

### Daily (Automated)
- ✅ Nightly baseline workflow (02:15 UTC)
- ✅ Agent watchdog (every 2 minutes)
- ✅ Build hygiene (on every PR/push)

### Weekly (Automated)
- ✅ Weekly cleanup workflow (Monday 03:00 UTC)

### Monthly (Manual)
- 📅 Review cleanup inventory and execute approved deletions
- 📅 Review secrets policy compliance
- 📅 Review dependency upgrade plan progress

### Quarterly (Manual)
- 📅 Rotate all Tier 1 secrets (database, Discord, API keys)
- 📅 Execute dependency upgrade phases
- 📅 Review and update runbook documentation

---

## 🔐 Secrets Management

**Policy**: `docs/SECRETS_POLICY.md`

**Required GitHub Secrets**:
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF
SUPABASE_DB_PASSWORD
DATABASE_URL
DISCORD_TOKEN
DISCORD_BOT_TOKEN
DISCORD_CLIENT_ID
DISCORD_GUILD_ID
DISCORD_ALERT_WEBHOOK
DISCORD_OPS_WEBHOOK
OPTIMAL_API_KEY
ODDS_API_KEY
SGO_API_KEY
NOTION_TOKEN
```

**Setting Secrets**:
```bash
gh secret set SECRET_NAME < secret.txt
```

**Rotation Schedule**:
- **Immediate**: Upon exposure
- **Quarterly**: All Tier 1 credentials

---

**Emergency Contact**: Platform Engineering Team
**On-Call Rotation**: [Link to PagerDuty/OpsGenie]
**Status Page**: [Link to status page]
