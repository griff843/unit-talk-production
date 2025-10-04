# Command Center Release - Read-Models Wiring Complete ✅

**Release Engineer**: Claude Code
**Release ID**: 2025-10-04T13-55-36-211Z
**Status**: ✅ **ALL SYSTEMS OPERATIONAL**

---

## 📊 Verification Results

```json
{
  "runId": "2025-10-04T13-55-36-211Z",
  "timestamp": "2025-10-04T13:55:36.213Z",
  "checks": {
    "board_has_rows": true,
    "board_count": 22,
    "feed_has_rows": true,
    "feed_count": 22,
    "recent_scoring": true,
    "scoring_count": 22
  },
  "last_approved": [
    {
      "id": "791e9e1e-fd13-4c58-997e-4f098de39218",
      "prop_ref": "cac6184b-dd65-4944-9fcf-7ec683920b4a",
      "status": "approved",
      "publish_at": "2025-10-04T05:32:03.088584+00:00",
      "approved_by": "7ce2ba1f-459f-47cf-ab06-dc3566a847c6"
    },
    {
      "id": "7c84df6c-baef-46e9-8c03-1689262af13e",
      "prop_ref": "adeeada1-91f1-49dc-a95f-e5ff22c6af84",
      "status": "approved",
      "publish_at": "2025-10-04T04:52:22.334387+00:00",
      "approved_by": "7ce2ba1f-459f-47cf-ab06-dc3566a847c6"
    }
  ]
}
```

**✅ ALL CHECKS PASSED**
- Board has rows: ✅ (22 picks)
- Feed has rows: ✅ (22 props)
- Recent scoring: ✅ (22 scored in last 2h)
- Last approved: ✅ (2 picks approved)

---

## 📦 Files Created/Modified

### Core Application Files (8 files)

1. **apps/command-center/src/data/ccDataAdapter.ts** (NEW - 175 lines)
   - Data adapter for Command Center UI
   - React hooks with real-time subscriptions
   - RPC integration (submit_pick, approve_pick, deny_pick)

2. **apps/api/src/scripts/schedulers/liveLoops.ts** (NEW - 230 lines)
   - Continuous schedulers (FeedLoop: 45s, ScoringLoop: 30s, PromotionLoop: 30s)
   - In-process loops without external cron
   - Artifact generation to `apps/api/out/ops/schedulers/`

3. **apps/api/src/scripts/verify/verifyCommandCenter.ts** (NEW - 120 lines)
   - Health checks for Command Center wiring
   - Generates verification JSON
   - Exit code 0 on success, 1 on failure

4. **scripts/sql/verify_command_center.sql** (NEW - 28 lines)
   - SQL-based verification queries
   - Manual verification via Supabase SQL editor

5. **scripts/sql/inventory.sql** (NEW - 145 lines)
   - Comprehensive database object inventory
   - Classification: KEEP / REVIEW / DROP_CANDIDATE
   - Dependencies and foreign keys analysis

6. **apps/api/src/scripts/generate-cleanup-plan.ts** (NEW - 270 lines)
   - DRY-RUN cleanup plan generator
   - Generates 6 artifacts with safety guardrails
   - All DROP statements commented by default

7. **READMODELS_WIRING.md** (NEW - Comprehensive guide)
   - Developer integration guide
   - View/RPC documentation
   - Command Center usage examples
   - Scheduler documentation

8. **CLEANUP_PLAYBOOK.md** (NEW - Comprehensive playbook)
   - Step-by-step safe cleanup procedures
   - Approval templates
   - Rollback procedures
   - Safety guardrails

---

## 🚀 Operator Quick Start

### 1. Start Continuous Schedulers

```bash
# Production: Run schedulers in background
cd apps/api
npx tsx src/scripts/schedulers/liveLoops.ts &

# Monitor artifacts
watch -n 5 'ls -lah apps/api/out/ops/schedulers/ | tail -10'
```

**Expected Behavior**:
- FeedLoop runs every 45 seconds
- ScoringLoop runs every 30 seconds (updates 22 scores/cycle)
- PromotionLoop runs every 30 seconds
- Artifacts written to `apps/api/out/ops/schedulers/`

**Graceful Shutdown**: `Ctrl+C` (SIGINT handler)

### 2. Verify Command Center Wiring

```bash
# Run verification health checks
npx tsx apps/api/src/scripts/verify/verifyCommandCenter.ts

# Check verification JSON
cat apps/api/out/ops/verify/VERIFY_CC_*.json | jq
```

**Expected Output**:
```
🎉 ALL CHECKS PASSED
Exit code: 0
```

### 3. Generate Database Cleanup Plan (DRY-RUN)

```bash
# Generate cleanup artifacts (NO EXECUTION)
npx tsx apps/api/src/scripts/generate-cleanup-plan.ts

# Review outputs
cd apps/api/out/ops/cleanup/<timestamp>/
ls -la
# 01_inventory_tables.csv
# 02_dependencies.csv
# 03_keep_vs_drop.json
# 05_drop_plan.sql (ALL COMMENTED)
# 06_archive_plan.sql (ALL COMMENTED)
# CLEANUP_README.md

# Review classification
cat 03_keep_vs_drop.json | jq
```

**CRITICAL**: All cleanup SQL is DRY-RUN by default. See `CLEANUP_PLAYBOOK.md` for safe execution procedures.

---

## 🎯 Scheduler Performance Metrics

**Observed Performance** (150-second test run):

| Loop | Interval | Cycles Completed | Avg Duration | Updates/Cycle |
|------|----------|-----------------|--------------|---------------|
| FeedLoop | 45s | 4 cycles | 151ms | N/A |
| ScoringLoop | 30s | 5 cycles | 2.2s | 22 scores |
| PromotionLoop | 30s | 5 cycles | 140ms | N/A |

**Artifacts Generated**: 14 JSON files
- 4 feedloop artifacts
- 5 scoringloop artifacts
- 5 promotionloop artifacts

**ScoringLoop Sample Output**:
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

**✅ Zero Errors**: All loops executed cleanly with 0 errors across 14 cycles.

---

## 🔧 Tuning Recommendations

### 1. Scheduler Interval Optimization

**Current Settings**:
```typescript
const FEED_INTERVAL_MS = 45 * 1000;    // 45 seconds
const SCORING_INTERVAL_MS = 30 * 1000; // 30 seconds
const PROMOTION_INTERVAL_MS = 30 * 1000; // 30 seconds
```

**Recommendations**:
- ✅ **Keep current intervals** - Performance is excellent (sub-3s cycles)
- Consider increasing FeedLoop to 60s during off-peak hours (no new props)
- ScoringLoop at 30s is optimal for real-time updates
- PromotionLoop could be reduced to 60s (low-frequency operation)

### 2. Artifact Retention Policy

**Current State**: Unlimited retention in `apps/api/out/ops/schedulers/`

**Recommendation**: Add cleanup policy
```bash
# Clean up artifacts older than 7 days
find apps/api/out/ops/schedulers/ -type f -mtime +7 -delete
```

### 3. Error Handling Enhancement

**Current**: Basic try/catch with console.error

**Recommendation**: Add structured logging
```typescript
import { logger } from '@shared/logger';

try {
  // ... loop logic
} catch (error) {
  logger.error('ScoringLoop error', { error, timestamp, cycle });
  // Record to agent_health table
  await recordAgentFailure('ScoringAgent', error);
}
```

### 4. Health Monitoring Integration

**Recommendation**: Add scheduler health checks to `verifyCommandCenter.ts`
```typescript
// Check 5: Scheduler health (last run within expected interval)
const { data: lastFeedRun } = await supabase
  .from('agent_health')
  .select('last_run')
  .eq('agent_name', 'FeedAgent')
  .single();

const timeSinceLastRun = Date.now() - new Date(lastFeedRun).getTime();
results.checks.schedulers_healthy = timeSinceLastRun < 60000; // 1 minute
```

### 5. Database Cleanup Execution Plan

**Current State**: DRY-RUN plan generated with safety guardrails

**Next Steps** (follow `CLEANUP_PLAYBOOK.md`):
1. Review `03_keep_vs_drop.json` classification
2. Test `06_archive_plan.sql` on staging environment
3. Monitor for 48 hours after archive phase
4. Execute `05_drop_plan.sql` in small batches (max 5 objects)
5. Never drop objects in KEEP list

**KEEP Set** (DO NOT DROP):
- **Tables** (12): unified_picks, raw_props, scored_props, promotion_queue, settled_outcomes, player_stats, players, games, users, api_quota_configs, runtime_config, agent_health
- **Views** (6): v_daily_board, v_prop_read_model, v_open_promotions, v_best_line_now, v_recent_settlement, v_command_center_board
- **Functions** (3): submit_pick, approve_pick, deny_pick

---

## 🎓 Developer Handoff

### Quick Reference

| Component | Location | Purpose |
|-----------|----------|---------|
| Data Adapter | `apps/command-center/src/data/ccDataAdapter.ts` | Command Center UI integration |
| Schedulers | `apps/api/src/scripts/schedulers/liveLoops.ts` | Continuous data refresh |
| Verification | `apps/api/src/scripts/verify/verifyCommandCenter.ts` | Health checks |
| SQL Inventory | `scripts/sql/inventory.sql` | Database object inventory |
| Cleanup Plan | `apps/api/src/scripts/generate-cleanup-plan.ts` | DRY-RUN cleanup generator |

### Documentation

- **[READMODELS_WIRING.md](READMODELS_WIRING.md)** - Complete integration guide
- **[CLEANUP_PLAYBOOK.md](CLEANUP_PLAYBOOK.md)** - Safe cleanup procedures

### Integration Example

```typescript
import { useCommandCenterBoard } from '@/data/ccDataAdapter';

function PickApprovalGrid() {
  const { picks, loading, error, refresh } = useCommandCenterBoard({
    status: 'pending',
    limit: 50
  });

  const handleApprove = async (pick: BoardPick) => {
    await ccAdapter.approve(pick.queue_id!, ACTOR_ID, 'Approved');
    refresh();
  };

  return (
    <div>
      {picks.map(pick => (
        <PickCard key={pick.prop_id} pick={pick} onApprove={handleApprove} />
      ))}
    </div>
  );
}
```

---

## ✅ Release Acceptance Criteria

- [x] Command Center data adapter created with RPC integration
- [x] Continuous schedulers running (45s/30s/30s intervals)
- [x] Verification script passing all health checks
- [x] Database inventory with KEEP/REVIEW/DROP classification
- [x] DRY-RUN cleanup plan with safety guardrails
- [x] Developer documentation (READMODELS_WIRING.md)
- [x] DBA playbook (CLEANUP_PLAYBOOK.md)
- [x] Schedulers executed for 150+ seconds with zero errors
- [x] Verification JSON generated with all checks PASSED
- [x] Artifact generation working (14 JSON files produced)

---

## 📞 Support

**Questions?** See documentation:
- Integration: `READMODELS_WIRING.md`
- Cleanup: `CLEANUP_PLAYBOOK.md`
- Troubleshooting: Both docs have rollback/troubleshooting sections

**Emergency Rollback**:
```sql
-- Restore table from archive schema
ALTER TABLE archive.table_name SET SCHEMA public;
```

---

**Release Engineer**: Claude Code
**Release Date**: 2025-10-04
**Status**: ✅ **PRODUCTION READY**
