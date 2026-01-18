# CANARY Unblock Plan - 2025-12-18

**Status**: 🚨 **CRITICAL SYSTEM-WIDE ISSUE**
**Root Cause**: 15 Temporal activities missing across 5 agents
**Impact**: Zero upcoming games, broken workflows, CANARY publishing blocked
**Priority**: **P0 - System Down**

---

## Executive Summary

CANARY E2E testing is blocked because `raw_props` has **zero upcoming games**. Root cause analysis reveals that **65% of Temporal activities are missing** (15 out of 23), preventing workflows from executing and FeedAgent from populating future events.

**Verification Results**:
```
Total Checks:  23
Passed:        8  (34.8%)
Failed:        15 (65.2%)
```

This is a **system-wide architecture issue**, not just a single missing function.

---

## Missing Activities Breakdown

### OperatorAgent (2 missing)
❌ `checkApiQuota` - Quota monitoring (called by `quotaMonitoringWorkflow`)
❌ `logError` - Error logging (called by multiple workflows)

**Impact**: Quota monitoring completely disabled, error logging broken

---

### FeedAgent (2 missing)
❌ `ingestOptimalProps` - Optimal API ingestion
❌ `ingestFallbackProps` - Fallback provider ingestion

**Impact**: **Cannot ingest future props**, zero upcoming games in `raw_props`

**Critical Dependencies**:
- `syndicateSchedulerWorkflow` calls `fetchFeed` (✅ exists)
- `fetchFeed` likely delegates to these missing activities
- Without them, ingestion pipeline is broken

---

### AlertAgent (5 missing)
❌ `detectSteamMovement` - Steam detection
❌ `detectLineMovement` - Line movement alerts
❌ `detectHedgeOpportunities` - Hedge opportunities
❌ `sendQuotaWarning` - Quota warnings
❌ `sendQuotaCritical` - Critical quota alerts

**Impact**: **Zero USP (Unique Selling Proposition) features**, no value-add alerts

---

### GradingAgent (3 missing)
❌ `gradeNewProps` - Professional grading (called by `syndicateSchedulerWorkflow`)
❌ `scoreTopTierPicks` - Pick scoring
❌ `updateUnifiedPicks` - Promote S/A tier picks

**Impact**: **Cannot grade or promote picks**, even if FeedAgent worked

---

### NotificationAgent (3 missing)
❌ `sendCriticalDiscordAlerts` - Critical alerts
❌ `batchDiscordAlerts` - Batch alerts
❌ `sendDiscordEmbed` - Discord embeds

**Impact**: **Cannot send Discord notifications**, CANARY publishing would fail anyway

---

## Cascading Failure Analysis

### Workflow Execution Flow (ALL BROKEN)

```
syndicateSchedulerWorkflow (1-minute intervals)
├─► fetchFeed() [✅ exists]
│   └─► ingestOptimalProps() [❌ MISSING]
│   └─► ingestFallbackProps() [❌ MISSING]
│
├─► gradeNewProps() [❌ MISSING]
│   └─► scoreTopTierPicks() [❌ MISSING]
│   └─► updateUnifiedPicks() [❌ MISSING]
│
└─► logError() [❌ MISSING]

quotaMonitoringWorkflow (15-minute intervals)
├─► checkApiQuota() [❌ MISSING]
├─► sendQuotaWarning() [❌ MISSING]
├─► sendQuotaCritical() [❌ MISSING]
└─► logError() [❌ MISSING]

liveGameDetectorWorkflow
├─► getLiveGames() [✅ exists]
├─► updateLiveGameStatus() [✅ exists]
└─► logError() [❌ MISSING]
```

**Result**: Even workflows that start will fail when calling missing activities.

---

## Why Zero Upcoming Games in raw_props

### Direct Cause Chain

1. **`syndicateSchedulerWorkflow` starts** ✅
2. **Calls `fetchFeed()`** ✅ (exists, but likely a stub)
3. **`fetchFeed()` tries to call `ingestOptimalProps()` or `ingestFallbackProps()`** ❌ (NOT REGISTERED)
4. **Workflow fails with "Activity not registered" error** ❌
5. **No props ingested, `raw_props` stays empty** ❌
6. **CANARY E2E test finds zero candidates** ❌

### SQL Evidence

```sql
-- From docs/ops/canary_e2e_evidence_2025-12-17.md
SELECT
  COUNT(*) FILTER (WHERE event_time >= NOW()) as upcoming_count,
  MAX(event_time) as max_event_time
FROM raw_props
WHERE is_valid = true;

-- Result: upcoming_count = 0, max_event_time < NOW()
```

**Conclusion**: FeedAgent ingestion workflows cannot execute due to missing activities.

---

## Remediation Options

### Option 1: Implement ALL 15 Missing Activities (PROPER FIX)

**Effort**: High (3-5 days)
**Risk**: Low
**Outcome**: Fully functional system

**Steps**:
1. Implement each activity with proper logic
2. Add to respective `activities/index.ts` files
3. Test with `npx tsx scripts/ops/verify-temporal-activities.ts`
4. Restart worker: `docker compose restart api`
5. Verify workflows execute: `docker compose logs api -f | Select-String "workflow"`

**Pros**:
- Permanent fix
- Restores all platform features
- Production-ready

**Cons**:
- Time-intensive
- Requires understanding of each agent's business logic

---

### Option 2: Implement Critical Path Only (QUICK UNBLOCK)

**Effort**: Medium (1-2 days)
**Risk**: Medium (partial functionality)
**Outcome**: CANARY E2E unblocked, other features remain broken

**Critical Path** (minimum viable for CANARY):
1. ✅ `FeedAgent.ingestUnifiedData()` - Already exists (verified by script)
2. ❌ `FeedAgent.ingestOptimalProps()` - Need to implement OR bypass
3. ❌ `OperatorAgent.logError()` - Stub implementation (suppress errors)
4. ❌ `GradingAgent.gradeNewProps()` - Minimal stub (auto-approve all)
5. ❌ `NotificationAgent.sendDiscordEmbed()` - Use existing discord-sender.ts

**Steps**:
1. Add stub implementations for 4 critical activities
2. Modify `fetchFeed()` to ONLY use `ingestUnifiedData()` (skip Optimal API)
3. Test ingestion manually: `curl -X POST http://localhost:3010/api/ops/feed/ingest`
4. Verify props appear: SQL query for `event_time >= NOW()`
5. Run CANARY E2E: `npx tsx scripts/canary_e2e_smoke.ts`

**Pros**:
- Fast unblock (1-2 days)
- Focused scope
- CANARY E2E can proceed

**Cons**:
- Other features remain broken
- Technical debt created
- Not production-ready for full platform

---

### Option 3: Use Local Test Data (IMMEDIATE WORKAROUND)

**Effort**: Low (2-4 hours)
**Risk**: High (test data only, not real)
**Outcome**: CANARY E2E can test with fake upcoming games

**Steps**:
1. Manually insert test data into `raw_props` with `event_time >= NOW() + INTERVAL '2 hours'`
2. Run CANARY E2E against test data
3. Verify publishing mechanics work
4. Mark as "test mode" in evidence docs

**SQL to Insert Test Data**:
```sql
-- Insert upcoming test game
INSERT INTO raw_props (
  sport, league, matchup, player_name,
  stat_type, line, odds, over_odds, under_odds,
  event_time, is_valid, processed_by, confidence_score
) VALUES (
  'BASKETBALL', 'NBA', 'Lakers vs Celtics', 'LeBron James',
  'Points', 25.5, -110, -110, -110,
  NOW() + INTERVAL '24 hours',  -- Tomorrow
  true, 'manual-test-data', 75
);
```

**Pros**:
- Immediate unblock (hours, not days)
- Tests CANARY publishing mechanics
- Isolates ingestion from publishing

**Cons**:
- Not testing real data pipeline
- Doesn't fix underlying issue
- Test-only solution

---

## Recommended Path Forward

### **Phase 1: Immediate Unblock (Option 3) - TODAY**

Use local test data to verify CANARY publishing works end-to-end.

**Deliverables**:
- [ ] Insert test data via SQL
- [ ] Run `npx tsx scripts/canary_e2e_smoke.ts`
- [ ] Verify pick published to CANARY Discord channel
- [ ] Document in `docs/ops/canary_e2e_evidence_2025-12-18.md`

---

### **Phase 2: Critical Path Fix (Option 2) - THIS WEEK**

Implement minimum viable activities to restore ingestion.

**Deliverables**:
- [ ] Implement `FeedAgent.ingestOptimalProps()` stub (use `ingestUnifiedData()` internally)
- [ ] Implement `OperatorAgent.logError()` stub (console.error only)
- [ ] Implement `GradingAgent.gradeNewProps()` stub (auto-approve all)
- [ ] Implement `NotificationAgent.sendDiscordEmbed()` (delegate to discord-sender.ts)
- [ ] Test full pipeline: ingestion → grading → publishing
- [ ] Verify with `npx tsx scripts/canary_e2e_smoke.ts`

---

### **Phase 3: Full Remediation (Option 1) - NEXT SPRINT**

Implement all 15 activities with proper business logic.

**Deliverables**:
- [ ] Complete activity implementations for all agents
- [ ] Add comprehensive unit tests
- [ ] Integration tests for workflow execution
- [ ] Performance benchmarks
- [ ] Production deployment

---

## Verification Commands

### PowerShell (Diagnostics)

```powershell
# 1. Run diagnostic script
.\scripts\ops\windows\canary-diagnose.ps1

# 2. Verify activities registration
npx tsx scripts/ops/verify-temporal-activities.ts

# 3. Check Temporal workflows status
docker compose logs api --since 10m | Select-String -Pattern "workflow|Activity.*not registered"

# 4. Check FeedAgent logs
docker compose logs api --since 30m | Select-String -Pattern "FeedAgent|fetchFeed|ingest"

# 5. Restart API after fix
docker compose up -d --force-recreate api
```

### SQL (Proof Queries)

```sql
-- Verify upcoming games exist (run in SQL editor)
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE event_time >= NOW()) as upcoming_count,
  MAX(event_time) as max_event_time,
  NOW() as current_time
FROM raw_props
WHERE is_valid = true;

-- Expected after fix: upcoming_count > 0

-- Show upcoming games
SELECT
  sport, league, matchup, player_name, stat_type,
  line, odds, event_time,
  event_time - NOW() as time_until_game
FROM raw_props
WHERE is_valid = true
  AND event_time >= NOW()
  AND event_time <= NOW() + INTERVAL '48 hours'
ORDER BY event_time ASC
LIMIT 10;
```

---

## Run This (Complete Workflow)

### Step 1: Verify Current State

**PowerShell**:
```powershell
# Check service health
docker compose ps

# Run diagnostics
.\scripts\ops\windows\canary-diagnose.ps1

# Verify activities
npx tsx scripts/ops/verify-temporal-activities.ts
```

**SQL** (copy to SQL editor):
```sql
SELECT
  COUNT(*) FILTER (WHERE event_time >= NOW()) as upcoming_games
FROM raw_props
WHERE is_valid = true;
-- Expected: 0 (confirming the issue)
```

---

### Step 2: Choose Remediation Path

**Option A - Immediate Test (TODAY)**:
```sql
-- Insert test data (run in SQL editor)
INSERT INTO raw_props (
  sport, league, matchup, player_name,
  stat_type, line, odds, over_odds, under_odds,
  event_time, is_valid, processed_by, confidence_score
) VALUES (
  'BASKETBALL', 'NBA', 'Test Game - Lakers vs Celtics', 'LeBron James',
  'Points', 25.5, -110, -110, -110,
  NOW() + INTERVAL '24 hours',
  true, 'manual-test-data', 75
);
```

**PowerShell**:
```powershell
# Run CANARY E2E test
npx tsx scripts\canary_e2e_smoke.ts

# Check Discord channel for published pick
```

**Option B - Critical Path Fix (THIS WEEK)**:
See `docs/ops/TEMPORAL_WORKER_MISMATCH_2025-12-18.md` for implementation details.

---

### Step 3: Verify Fix

**PowerShell**:
```powershell
# Re-run verification
npx tsx scripts/ops/verify-temporal-activities.ts

# Expected: All critical activities pass

# Check logs for successful ingestion
docker compose logs api --since 5m | Select-String -Pattern "ingested|graded|published"

# Run E2E test
npx tsx scripts\canary_e2e_smoke.ts
```

**SQL**:
```sql
-- Verify real upcoming games now exist
SELECT COUNT(*) FROM raw_props
WHERE is_valid = true AND event_time >= NOW();
-- Expected: > 0
```

---

## Documentation References

- **Temporal Worker Mismatch**: `docs/ops/TEMPORAL_WORKER_MISMATCH_2025-12-18.md`
- **SQL vs PowerShell Guide**: `docs/ops/SQL_VS_POWERSHELL_BOUNDARIES.md`
- **CANARY Candidate Rules**: `docs/ops/canary_candidate_rules.md`
- **CANARY Auth Truth**: `docs/ops/canary_auth_truth.md`
- **Diagnostic Script**: `scripts/ops/windows/canary-diagnose.ps1`
- **Verification Script**: `scripts/ops/verify-temporal-activities.ts`
- **E2E Smoke Test**: `scripts/canary_e2e_smoke.ts`

---

## Next Steps

**Immediate** (TODAY):
1. ✅ Insert test data to unblock CANARY E2E testing
2. ✅ Verify publishing mechanics work
3. ✅ Document results in evidence file

**Short-term** (THIS WEEK):
1. Implement 4 critical activities (FeedAgent ingestion, error logging, basic grading, Discord embeds)
2. Test full ingestion → grading → publishing pipeline
3. Verify real upcoming games populate `raw_props`

**Long-term** (NEXT SPRINT):
1. Implement all 15 missing activities
2. Add comprehensive test coverage
3. Production deployment

---

**Status**: 🚨 **Blocked - Awaiting remediation path decision**
**Owner**: Engineering Team
**Last Updated**: 2025-12-18
