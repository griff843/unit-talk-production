# Canonical Convergence - Quick Start Guide

**Date:** 2025-01-28  
**Version:** 1.0.0  
**Estimated Time:** 3-4 hours total

---

## Current Status

✅ **Phase 1 Complete:** Environment & Driver Enforcement  
✅ **Phase 2 Complete:** Canonical Schema Deployment  
⚠️ **BLOCKER:** PostgREST schema cache reload required  
⏸️ **Phases 3-9:** Pending PostgREST reload

---

## IMMEDIATE ACTION REQUIRED (2 minutes)

### Step 1: Reload PostgREST Schema Cache

**Option A: Supabase SQL Editor (RECOMMENDED)**

1. Open: https://supabase.com/dashboard/project/cqfnsozknjzvyiziwicl/sql/new

2. Execute:
   ```sql
   SELECT pg_notify('pgrst', 'reload schema');
   ```

3. Wait 30 seconds

4. Verify:
   ```bash
   node scripts/ops/verify-canonical-schema.js
   ```

**Expected Output:**
```
[PASS] Picks table exists with 0 rows
[PASS] Pick_publish table exists with 0 rows
[PASS] Picks table schema validated
[PASS] Pick_publish table schema validated
[PASS] Test pick inserted: <uuid>
[PASS] Test publish record inserted: <uuid>
[PASS] ALL CHECKS PASSED - Canonical schema is ready
```

---

## Phase 3: Dependency & Service Health (15 minutes)

### Step 2: Rebuild Containers

```bash
# Stop all services
docker compose down -v

# Rebuild with no cache
docker compose build --no-cache api smart-form command-center

# Start services
./dev.sh start
```

### Step 3: Verify Service Health

```bash
# API Health
curl http://localhost:3010/api/health

# Expected: {"status":"healthy","driver":{"effective":"canonical",...}}

# Smart Form Health
curl http://localhost:3002/api/health

# Expected: {"status":"healthy",...}

# Command Center Health
curl http://localhost:3004/api/health

# Expected: {"status":"healthy",...}
```

### Step 4: Verify Driver Status

```bash
curl http://localhost:3010/api/domain/picks/status
```

**Expected Output:**
```json
{
  "success": true,
  "currentDriver": "canonical",
  "driverAvailability": {
    "canonical": true,
    "unified": true
  },
  "publishMode": "outbox",
  "configuredDriver": "canonical",
  "configuredPublishMode": "outbox"
}
```

---

## Phase 4: Live E2E Validation (30 minutes)

### Step 5: Run Industry-Standard E2E Validation

```powershell
.\scripts\ops\industry-standard-e2e-validation.ps1
```

**What It Does:**
- Tests DRY-RUN + LIVE INSERT for NBA, NFL, MLB, NHL
- Verifies database writes to `picks` and `pick_publish` tables
- Checks Discord publishing via outbox pattern
- Validates audit log entries
- Captures SLO metrics (API p95, DB p95, error rate, publish lag)
- Generates per-league attestations + final GO/NO-GO report

**Expected Duration:** 5-10 minutes per league = 20-40 minutes total

**Artifacts Generated:**
- `out/ops/cutover/metrics/100/NBA_attestation_canonical_live_<timestamp>.json`
- `out/ops/cutover/metrics/100/NFL_attestation_canonical_live_<timestamp>.json`
- `out/ops/cutover/metrics/100/MLB_attestation_canonical_live_<timestamp>.json`
- `out/ops/cutover/metrics/100/NHL_attestation_canonical_live_<timestamp>.json`
- `out/ops/cutover/metrics/100/FINAL_GO_NO_GO_canonical_<timestamp>.md`

**Success Criteria:**
- All 4 leagues: ✅ PASS
- API p95 latency: <150ms
- DB p95 latency: <50ms (may exceed on Windows/Docker Desktop - documented)
- Error rate: <0.5%
- Publish lag p95: <60s

---

## Phase 5: Observability & SLO Enforcement (20 minutes)

### Step 6: Deploy Grafana Dashboard

```bash
# Copy dashboard to Grafana provisioning
cp infra/observability/canonical-picks-dashboard.json monitoring/grafana/provisioning/dashboards/

# Restart Grafana (if running)
docker compose restart grafana
```

**Access Dashboard:**
- URL: http://localhost:3001/d/canonical-picks-slo
- Default credentials: admin/admin

### Step 7: Verify Prometheus Scraping

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Expected: unit-talk-api target UP
```

### Step 8: Configure Alerts

Alerts are pre-configured in `infrastructure/monitoring/prometheus-rules.yaml`:

- **APILatencySLOViolation:** p95 >150ms for 5m
- **DatabaseLatencySLOViolation:** p95 >50ms for 5m
- **ErrorRateSLOViolation:** >0.5% for 5m
- **PublishLagSLOViolation:** p95 >60s for 5m

**Verify Alerts:**
```bash
curl http://localhost:9090/api/v1/rules
```

---

## Phase 6: Security & Reliability (15 minutes)

### Step 9: Enable RLS Policies (Read-Only Verification)

**Note:** RLS policies are created but NOT enabled by default for safety.

**Verify RLS Policies Exist:**

```sql
-- Execute in Supabase SQL Editor
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('picks', 'pick_publish', 'audit_log');
```

**Expected Policies:**
- `picks_tenant_isolation` - SELECT/INSERT/UPDATE/DELETE with tenant_id check
- `pick_publish_tenant_isolation` - SELECT/INSERT/UPDATE/DELETE with tenant_id check
- `audit_log_tenant_isolation` - SELECT/INSERT with tenant_id check

**To Enable RLS (PRODUCTION ONLY):**
```sql
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pick_publish ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
```

### Step 10: Verify Rate Limiting

Rate limits are configured in `apps/api/src/middleware/rateLimiter.ts`:

- **Writes:** 10/min per tenant
- **Reads:** 300/min per tenant

**Test Rate Limiting:**
```bash
# Send 15 rapid requests (should hit limit)
for i in {1..15}; do
  curl -X POST http://localhost:3010/api/domain/picks/insert \
    -H "Content-Type: application/json" \
    -d '{"league":"NBA","market_type":"PLAYER_POINTS","line":27.5,"side":"over"}' &
done
```

**Expected:** 10 succeed, 5 return 429 Too Many Requests

### Step 11: Verify Circuit Breaker

Circuit breaker is configured for Discord outbox retries:

- **Failure Threshold:** 5 consecutive failures
- **Cooldown:** 1 minute
- **Retry Schedule:** 1min, 5min, 15min (exponential backoff)

**Verify in Code:**
- `apps/api/src/services/picks/PickPublisher.ts`
- `apps/api/src/workers/OutboxWorker.ts`

---

## Phase 7: CI/CD & Nightly Governance (30 minutes)

### Step 12: Create GitHub Actions Workflow

**File:** `.github/workflows/canonical-convergence-ci.yml`

```yaml
name: Canonical Convergence CI

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 3 * * *'  # Nightly at 03:00 UTC

jobs:
  canonical-e2e:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start Docker services
        run: |
          docker compose up -d
          sleep 30
      
      - name: Run E2E validation
        run: ./scripts/ops/industry-standard-e2e-validation.sh
      
      - name: Upload attestations
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: e2e-attestations
          path: out/ops/cutover/metrics/100/
      
      - name: Notify Discord on failure
        if: failure()
        run: |
          curl -X POST "${{ secrets.DISCORD_ALERT_WEBHOOK }}" \
            -H "Content-Type: application/json" \
            -d '{"content":"❌ Canonical E2E validation FAILED - Review artifacts"}'
```

### Step 13: Configure Nightly Validation

The workflow above includes a cron schedule for nightly runs. Artifacts are stored for 14 days.

**Trend Report Generation:**
```bash
# Generate trend report from last 14 days
node scripts/ops/generate-trend-report.js
```

---

## Phase 8: Decision Gate & Lock-In (10 minutes)

### Step 14: Review Final GO/NO-GO Report

```bash
# Read the final report
cat out/ops/cutover/metrics/100/FINAL_GO_NO_GO_canonical_<timestamp>.md
```

**GO Criteria:**
- ✅ All 4 leagues PASS
- ✅ API p95 <150ms
- ✅ DB p95 <50ms (or documented Windows exception)
- ✅ Error rate <0.5%
- ✅ Publish lag p95 <60s
- ✅ No RLS violations
- ✅ No circuit breaker events

### Step 15: Tag Release

```bash
git add .
git commit -m "release: canonical picks E2E PASS (multi-league, SLOs green, Discord live)"
git tag -a v3.0.0 -m "Canonical convergence complete - production ready"
git push --follow-tags
```

---

## Phase 9: Post-Deployment Monitoring (24 hours)

### Step 16: Monitor Grafana Dashboard

**URL:** http://localhost:3001/d/canonical-picks-slo

**Watch For:**
- API latency spikes
- Database query performance
- Error rate increases
- Publish lag anomalies
- Circuit breaker activations

### Step 17: Verify Production Metrics

**After 24 hours, check:**

```bash
# API health
curl http://localhost:3010/api/health

# Picks count
curl http://localhost:3010/api/domain/picks?limit=1

# Publish queue status
curl http://localhost:3010/api/domain/picks/publish/status
```

### Step 18: Plan unified_picks Deprecation

**Once stable (7-14 days):**

1. Create deprecation plan
2. Archive unified_picks data
3. Drop unified_picks table
4. Remove unified driver code
5. Update documentation

---

## Rollback Plan

**If issues arise:**

1. **Immediate Rollback:**
   ```bash
   # Revert .env
   PICK_DRIVER=unified
   
   # Restart services
   ./dev.sh restart
   ```

2. **Verify Rollback:**
   ```bash
   curl http://localhost:3010/api/domain/picks/status
   # Expected: "currentDriver": "unified"
   ```

3. **Investigate Issues:**
   - Review Grafana dashboards
   - Check Docker logs: `./dev.sh logs`
   - Review E2E attestations
   - Check Discord for error notifications

---

## Support & Troubleshooting

### Common Issues

**Issue:** PostgREST schema cache not reloaded  
**Solution:** Execute `SELECT pg_notify('pgrst', 'reload schema');` in Supabase SQL Editor

**Issue:** Docker containers not starting  
**Solution:** `docker compose down -v && docker compose up -d`

**Issue:** E2E validation fails  
**Solution:** Check `./dev.sh logs` and review attestation artifacts

**Issue:** Discord publishing not working  
**Solution:** Verify `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID` in `.env`

### Contact

For issues or questions:
- Review artifacts in `out/ops/cutover/metrics/100/`
- Check Docker logs: `./dev.sh logs`
- Verify environment: `.\scripts\ops\verify-canonical-env.ps1`
- Contact Unit Talk Engineering team

---

**Last Updated:** 2025-01-28  
**Maintained By:** Unit Talk Engineering  
**License:** Proprietary

