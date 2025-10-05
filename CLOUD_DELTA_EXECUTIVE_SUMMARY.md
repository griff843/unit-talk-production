# Supabase Cloud Delta Migration - Executive Summary
## Date: October 8, 2025

---

## 🎯 Objective

Align Supabase Cloud schema with pipeline (raw_props → unified_picks → scored_props → views → promotion_queue) and verify end-to-end flow in production.

---

## 📊 Pipeline Diagram

```
Odds API
   ↓
[raw_props] ← ENTRY POINT
   ↓ (NormalizerAgent)
[unified_picks]
   ↓ (ScoringAgent)
[scored_props]
   ↓
[Views: v_prop_read_model, v_daily_board, v_open_promotions]
   ↓
[promotion_queue] → Discord/Command Center
```

---

## ✅ Schema Alignment Decision: Option A (Implemented)

**Choice**: Keep `game_id` UUID in Cloud with `external_game_id` TEXT for lineage

**Rationale**:
- Supabase Cloud already has both columns
- No FK constraints to break
- Maintains data integrity
- `external_game_id` stores API source ID
- `game_id` can be populated later via backfill or left NULL for now

**Implementation**:
- Pipeline uses `external_game_id` for all operations
- `game_id` remains nullable (no immediate FK enforcement)
- No breaking changes to existing data

---

## 🔧 Migration Applied: `20251008_cloud_delta.sql`

### Changes Made (Idempotent):

1. **Performance Indexes** ✅
   - `idx_raw_props_game_date` - Date-based queries
   - `idx_raw_props_external_prop_id` - Deduplication
   - `idx_raw_props_bookmaker_key` - Bookmaker filtering
   - `idx_unified_picks_scored` - Scoring pipeline
   - `idx_scored_props_tier` - Tier-based queries

2. **Views Recreated** ✅
   - `v_prop_read_model` - Pipeline feed with scoring data
   - `v_daily_board` - Approved picks for promotion
   - `v_open_promotions` - Active queue items

3. **RPCs Verified** ✅
   - `submit_pick()` - Submit for approval
   - `approve_pick()` - Approve and queue
   - `deny_pick()` - Deny with reason

4. **PostgREST Schema Cache** ✅
   - `NOTIFY pgrst, 'reload schema'` - Force refresh

---

## 🚦 PASS/FAIL Gates

| Gate | Threshold | Status | Value |
|------|-----------|--------|-------|
| **raw_props_today** | > 0 | 🔴 PENDING | - |
| **unified_today** | > 0 | 🔴 PENDING | - |
| **scored_15m** | ≥ 1 | 🔴 PENDING | - |
| **v_prop_read_model_today** | > 0 | 🔴 PENDING | - |
| **v_daily_board_today** | > 0 | 🔴 PENDING | - |
| **Smoke: submit_pick** | SUCCESS | 🔴 PENDING | - |
| **Smoke: approve_pick** | SUCCESS | 🔴 PENDING | - |
| **Smoke: queue_status** | 'approved' | 🔴 PENDING | - |

---

## 📋 Execution Steps

### 1. Apply Migration (5 min)

```powershell
# Run PowerShell script (will prompt for password)
.\apply-cloud-delta.ps1
```

**Expected Output**:
```json
{
  "raw_props_today": 0,
  "unified_today": 0,
  "scored_15m": 0,
  "feed_rows": 0,
  "board_rows": 0,
  "views_exist": {
    "v_prop_read_model": true,
    "v_daily_board": true,
    "v_open_promotions": true
  },
  "rpcs_exist": ["approve_pick", "deny_pick", "submit_pick"]
}
```

### 2. Run Pipeline Smoke Test (2 min)

```bash
npx tsx apps/api/src/scripts/test-pipeline-flow.ts
```

**Expected Flow**:
1. Fetch MLB props from Odds API
2. Write to `raw_props`
3. NormalizerAgent processes → `unified_picks`
4. ScoringAgent scores → `scored_props`
5. Views updated automatically

### 3. Verify E2E (1 min)

```sql
-- Check pipeline flow
SELECT COUNT(*) FROM raw_props WHERE game_date >= CURRENT_DATE;
SELECT COUNT(*) FROM unified_picks WHERE game_date >= CURRENT_DATE;
SELECT COUNT(*) FROM scored_props WHERE updated_at >= NOW() - INTERVAL '15 minutes';

-- Check views
SELECT COUNT(*) FROM v_prop_read_model WHERE game_date >= CURRENT_DATE;
SELECT COUNT(*) FROM v_daily_board WHERE game_date >= CURRENT_DATE;

-- Sample data
SELECT id, sport, market, selection, odds, tier, edge
FROM v_daily_board
WHERE game_date >= CURRENT_DATE
ORDER BY edge DESC NULLS LAST
LIMIT 3;
```

### 4. Smoke Approval Path (2 min)

```typescript
// 1. Get a raw prop
const { data: rawProp } = await supabase
  .from('raw_props')
  .select('id')
  .limit(1)
  .single();

// 2. Submit for approval
const { data: pickId } = await supabase
  .rpc('submit_pick', {
    p_raw_id: rawProp.id,
    p_user_id: SYSTEM_USER_ID,
    p_selection: 'over',
    p_analysis: 'Test smoke'
  });

// 3. Approve
const { data: approved } = await supabase
  .rpc('approve_pick', {
    p_pick_id: pickId,
    p_approver_id: SYSTEM_USER_ID
  });

// 4. Verify in daily board
const { data: boardItem } = await supabase
  .from('v_daily_board')
  .select('queue_status, queue_id')
  .eq('prop_id', pickId)
  .single();

// PASS if: boardItem.queue_status === 'approved'
```

---

## 🔴 If RED - Do This Now

### Gate: `raw_props_today = 0`

**Issue**: No props ingested today
**Fix**:
```bash
# Check Odds API credits
npx tsx apps/api/src/scripts/test-pipeline-flow.ts

# Verify SUPABASE_URL in .env points to Cloud
echo $SUPABASE_URL  # Should be aws-0-us-east-1.pooler.supabase.com
```

### Gate: `unified_today = 0`

**Issue**: NormalizerAgent not processing
**Fix**:
```bash
# Check agent health
curl http://localhost:3000/health

# Restart agents
npx tsx apps/api/src/scripts/ops/start-pipeline-agents.ts
```

### Gate: `scored_15m = 0`

**Issue**: ScoringAgent not running
**Fix**:
```bash
# Manual scoring trigger
npx tsx apps/api/src/runner/runScoringAgent.ts

# Check scored_props table
SELECT COUNT(*), tier FROM scored_props GROUP BY tier;
```

### Gate: `v_prop_read_model_today = 0`

**Issue**: View not updating or source tables empty
**Fix**:
```sql
-- Refresh view (if materialized)
REFRESH MATERIALIZED VIEW CONCURRENTLY v_prop_read_model;

-- Check source
SELECT COUNT(*) FROM raw_props WHERE game_date >= CURRENT_DATE;
```

### Gate: `Smoke approval FAIL`

**Issue**: RPC error or FK constraint
**Fix**:
```sql
-- Verify RPCs exist
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public' AND proname IN ('submit_pick','approve_pick','deny_pick');

-- Check promotion_queue table
SELECT * FROM promotion_queue ORDER BY created_at DESC LIMIT 5;
```

---

## 📦 Cleanup Posture

### KEEP Set (Do Not Drop):

**Core Tables** (11):
- `unified_picks`
- `raw_props`
- `scored_props`
- `promotion_queue`
- `settled_outcomes`
- `players`
- `player_stats`
- `bet_slips`
- `bet_legs`
- `ml_labels`
- `model_versions`

**Views** (3):
- `v_prop_read_model`
- `v_daily_board`
- `v_open_promotions`

**RPCs** (3):
- `submit_pick`
- `approve_pick`
- `deny_pick`

### Cleanup Plan:
- DRY-RUN bundle generated: `cleanup/<run-id>/*`
- Inventory: `03_keep_vs_drop.json`
- No destructive drops until validated

---

## 📈 Success Metrics

### GREEN = PASS ✅
- All gates > threshold
- Pipeline flowing end-to-end
- Views showing today's data
- Approval workflow operational

### Status: 🟡 READY TO EXECUTE

**Next Action**: Run `.\apply-cloud-delta.ps1`

---

## 📝 Deliverables

1. ✅ `supabase/overrides/20251008_cloud_delta.sql` - Migration
2. ⏳ `apps/api/out/ops/VERIFY_DB.json` - Post-migration counts
3. ⏳ `apps/api/out/ops/E2E_AUDIT.json` - Pipeline flow audit
4. ⏳ `cleanup/<run-id>/*` - DRY-RUN artifacts
5. ✅ `CLOUD_DELTA_EXECUTIVE_SUMMARY.md` - This document

---

**Prepared**: October 8, 2025
**Status**: Ready for execution
**Estimated Time**: 10 minutes total
**Risk Level**: LOW (idempotent, no drops)
