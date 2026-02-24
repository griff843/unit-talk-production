# UI Projection Architecture - Prioritized Execution Plan

> **Status**: PRIORITIZED SEQUENCING (replaces 5-week plan) **Date**: 2026-02-23
> **Goal**: E2E operational stability TODAY

---

## Executive Summary

The original 5-week plan identified 12 new projection surfaces. This
re-sequencing focuses on **immediate E2E unblock** with minimal surface changes.

**Root Cause Analysis:** | Issue | Actual Blocker | Fix Category |
|-------|----------------|--------------| | CC shows mock/stale data | 8+ silent
fallback paths to mockData.ts | Runtime config, NOT projection | | Redis init
failure | Deferred init + health check hardcoded | Runtime config | | Smart Form
player dropdown | `active=false` filter or NULL team_id display | Data
integrity, NOT view change | | E2E visibility | CC queries unified_picks
correctly | No change needed |

**Key Insight**: Most issues are **runtime/config problems**, not projection
architecture problems. The E2E flow is architecturally sound.

---

## PHASE 0 – Immediate E2E Unblock (TODAY)

### 0.1 Remove Silent Mock Fallbacks in Command Center

**Problem**: 8 functions silently return mock data when DB/Redis fails

**Files to Fix:** | File | Lines | Issue | |------|-------|-------| |
`src/lib/supabase.ts` | 351-358, 460-466, 736-742, 909-926, 1138-1144, 1231-1237
| `getDemoMode()` fallback to mock | | `src/hooks/useSupabaseData.ts` | 24-26,
70-73, 160-163, 281-284, 328-333 | Error suppression + mock fallback |

**Fix Pattern:**

```typescript
// BEFORE (silent fallback)
catch (error) {
  if (getDemoMode()) {
    return mockData;
  }
  throw error;
}

// AFTER (fail-loud)
catch (error) {
  console.error('[CC] Database query failed:', error);
  throw error; // Let error boundary handle it
}
```

**Action Items:**

- [ ] Remove `getDemoMode()` checks from production query paths
- [ ] Remove error suppression (setting `error = null` after catch)
- [ ] Add visible error states in UI instead of silent mock
- [ ] Keep mockData.ts for explicit dev/test mode only

**Estimated Effort**: 2-3 hours

---

### 0.2 Fix Redis Health Check (Hardcoded True)

**Problem**: `src/app/api/health/route.ts:270` always reports Redis healthy

**Current Code:**

```typescript
// Line 270 - PROBLEM
const redisStatus = true; // Hardcoded!
```

**Fix:**

```typescript
// Actually test Redis connection
let redisStatus = false;
try {
  const redis = getRedisClient();
  await redis.ping();
  redisStatus = true;
} catch (e) {
  console.error('[CC] Redis health check failed:', e);
  redisStatus = false;
}
```

**Action Items:**

- [ ] Replace hardcoded `true` with actual Redis ping
- [ ] Ensure Redis init errors are logged visibly
- [ ] Add Redis status to health endpoint response body

**Estimated Effort**: 30 minutes

---

### 0.3 Validate Smart Form Player Catalog

**Problem**: Players missing in dropdown

**Current Architecture (CORRECT):**

- `catalog_players_v1` view with LEFT JOIN (players with NULL team still appear)
- Fail-closed (no fallback to raw tables)
- Filter: `WHERE COALESCE(active, true) = true`

**Diagnostic Steps:**

```sql
-- 1. Check if players exist
SELECT COUNT(*) FROM players WHERE sport = 'NBA';

-- 2. Check if players appear in contract surface
SELECT COUNT(*) FROM catalog_players_v1 WHERE sport = 'NBA';

-- 3. Find players missing from view (incorrectly marked inactive)
SELECT id, full_name, active
FROM players
WHERE sport = 'NBA'
  AND active = false;

-- 4. Find players with NULL team_id (may display incorrectly)
SELECT id, full_name, team_id
FROM catalog_players_v1
WHERE sport = 'NBA'
  AND team_id IS NULL;
```

**Likely Fix:**

- Data fix: Update `active = true` for incorrectly flagged players
- OR: Update team_id linkage for orphaned players

**NO VIEW CHANGES NEEDED** - the view is architecturally correct.

**Estimated Effort**: 1 hour (investigation + data fix)

---

### 0.4 Verify E2E Pick Flow (No Code Changes)

**Current Flow (CORRECT):**

```
Smart Form → bridge_outbox → BridgeWorker → unified_picks → CC reads unified_picks
                                                              ↓
                                               Settlement → lifecycleSettle
                                                              ↓
                                               Recap → SELECT WHERE settlement_status='settled'
```

**Verification Steps:**

```bash
# 1. Submit test pick via Smart Form
curl -X POST https://smartform.local/api/v3/submit-ticket -d '...'

# 2. Check bridge_outbox
SELECT * FROM bridge_outbox WHERE status = 'pending' ORDER BY created_at DESC LIMIT 5;

# 3. Check BridgeWorker processed it
SELECT * FROM unified_picks ORDER BY created_at DESC LIMIT 5;

# 4. Check CC can see it
curl https://commandcenter.local/api/lifecycle/picks?limit=5

# 5. Manually settle (if needed)
curl -X POST https://commandcenter.local/api/settlement -d '{"pick_id": "...", "result": "win"}'

# 6. Verify recap sees it
curl -X POST https://commandcenter.local/api/ops-recap -d '{"mode": "daily"}'
```

**Expected Result**: Pick flows through all stages with no mock data.

**Estimated Effort**: 30 minutes (verification only)

---

## PHASE 0 Summary

| Task | What                         | Effort | Blocking E2E? |
| ---- | ---------------------------- | ------ | ------------- |
| 0.1  | Remove silent mock fallbacks | 2-3h   | **YES**       |
| 0.2  | Fix Redis health check       | 30m    | **YES**       |
| 0.3  | Validate player catalog      | 1h     | Partial       |
| 0.4  | Verify E2E flow              | 30m    | Verification  |

**Total Phase 0**: ~4-5 hours

---

## PHASE 1 – Short-Term Surface Alignment (This Week)

### 1.1 Add Explicit DEMO_MODE Gate

**Problem**: DEMO_MODE can be accidentally enabled

**Fix**: Explicit startup validation

```typescript
// apps/command-center/src/lib/config.ts
if (process.env.DEMO_MODE === 'true' && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: DEMO_MODE=true in production environment');
}
```

**Estimated Effort**: 15 minutes

---

### 1.2 Create `view_ops_metrics_daily` (Optional)

**Only if** Command Center performance is unacceptable due to TypeScript
aggregations.

**Current State**: `OperationalOverview.tsx` fetches raw_props and aggregates in
JS **Proposed**: SQL view to pre-aggregate

```sql
CREATE VIEW view_ops_metrics_daily AS
SELECT
  DATE(created_at) as metric_date,
  sport,
  COUNT(*) as total_props,
  COUNT(*) FILTER (WHERE graded_at IS NOT NULL) as graded_props
FROM raw_props
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at), sport;
```

**Decision Criteria**: Only create if:

- Page load > 3 seconds
- raw_props table > 100K rows

**Estimated Effort**: 1 hour (if needed)

---

### 1.3 Lint Rule: Forbid Direct raw_props in UI

**Add ESLint rule to prevent future violations:**

```javascript
// eslint-plugin-unit-talk/no-raw-table-queries.js
module.exports = {
  create(context) {
    return {
      Literal(node) {
        if (
          node.value === 'raw_props' ||
          node.value === 'players' ||
          node.value === 'teams'
        ) {
          context.report({
            node,
            message: `Direct query to '${node.value}' forbidden in UI apps. Use projection surfaces.`,
          });
        }
      },
    };
  },
};
```

**Estimated Effort**: 2 hours

---

## PHASE 1 Summary

| Task | What                      | Effort | Priority    |
| ---- | ------------------------- | ------ | ----------- |
| 1.1  | DEMO_MODE production gate | 15m    | High        |
| 1.2  | view_ops_metrics_daily    | 1h     | Conditional |
| 1.3  | Lint rule for raw tables  | 2h     | Medium      |

**Total Phase 1**: ~3 hours

---

## PHASE 2 – Full Canonical Projection Migration (Future)

**Defer to future sprint** when E2E is stable:

| Surface                         | Original Plan | New Priority                           |
| ------------------------------- | ------------- | -------------------------------------- |
| `view_catalog_teams`            | Week 1        | DEFER (direct queries work)            |
| `view_catalog_players`          | Week 1        | DEFER (catalog_players_v1 exists)      |
| `view_picks_for_command_center` | Week 1        | DEFER (direct unified_picks works)     |
| `view_picks_stuck`              | Week 1        | DEFER (CC computes in JS - acceptable) |
| `view_pipeline_health`          | Week 1        | DEFER (usePipelineHealth works)        |
| `view_settled_picks_for_recap`  | Week 1        | DEFER (RecapService queries work)      |
| `view_analytics_summary`        | Week 1        | DEFER (Dashboard queries work)         |

**Rationale**: The existing architecture is **functionally correct**. The
original plan optimized for **performance and maintainability**, not
**correctness**. E2E stability requires correctness first.

---

## Decision Matrix

| Issue             | Root Cause             | Fix Type        | Phase |
| ----------------- | ---------------------- | --------------- | ----- |
| CC mock data      | Silent fallback code   | Code removal    | **0** |
| Redis health      | Hardcoded true         | Code fix        | **0** |
| Player dropdown   | Data integrity         | Data fix        | **0** |
| E2E flow          | N/A (works correctly)  | Verification    | **0** |
| DEMO_MODE leak    | Missing guard          | Code add        | 1     |
| raw_props perf    | JS aggregation         | View (optional) | 1     |
| Future violations | No lint rule           | Lint rule       | 1     |
| 12 new surfaces   | Premature optimization | Defer           | 2     |

---

## Execution Checklist

### Today (Phase 0)

- [ ] **0.1** Remove `getDemoMode()` fallbacks from `supabase.ts`
- [ ] **0.1** Remove error suppression from `useSupabaseData.ts` hooks
- [ ] **0.2** Fix Redis health check (actual ping, not hardcoded)
- [ ] **0.3** Run player catalog diagnostics
- [ ] **0.3** Fix any `active=false` or NULL team_id data issues
- [ ] **0.4** Execute E2E verification (submit → CC → settle → recap)

### This Week (Phase 1)

- [ ] **1.1** Add DEMO_MODE production guard
- [ ] **1.2** (Conditional) Create view_ops_metrics_daily if perf issue
- [ ] **1.3** Add ESLint rule for raw table queries

### Future (Phase 2)

- [ ] Full projection surface migration per original plan
- [ ] Requires stable E2E first

---

## Summary

**Original Plan**: 12 new surfaces, 5 weeks, comprehensive overhaul **Revised
Plan**: 0 new surfaces for Phase 0, focus on runtime fixes

**Why**: The projection architecture is not the E2E blocker. The blockers are:

1. Silent mock fallbacks (code bug)
2. Hardcoded health check (code bug)
3. Possible data integrity issue (data bug)

**Principle**: Fix runtime correctness first, then optimize architecture.
