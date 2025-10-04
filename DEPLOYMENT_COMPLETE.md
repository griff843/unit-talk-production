# ✅ Core Setup Migration - Deployment Complete

**Date**: October 4, 2025
**Migration**: `20251004_000000_core_setup.sql`
**Status**: Successfully applied to Supabase Cloud

## Acceptance Criteria ✓

### Tables Created/Verified
- [x] **scored_props** - 12 columns with edge, prob_win, professional_score, tier, confidence, kelly_fraction, clv_pct
- [x] **promotion_queue** - 18 columns with status, publish_at, approved_by, denied_by workflow

### Indexes Created
- [x] `idx_scored_props_tier_edge` - Optimized for tier filtering and edge sorting
- [x] `idx_pq_status_created` - Optimized for promotion queue queries

### Views Created & Verified
- [x] **v_daily_board** - 22 rows (today's picks with scoring and queue status)
- [x] **v_prop_read_model** - 5,693 rows (all picks with scoring data)
- [x] **v_open_promotions** - 0 rows (pending picks in promotion queue)

### RPCs Created & Verified
- [x] **submit_pick(p_unified_pick_id, p_reason, p_org_id)** - Add pick to promotion queue
- [x] **approve_pick(p_queue_id, p_approved_by, p_reason)** - Approve queued pick
- [x] **deny_pick(p_queue_id, p_denied_by, p_reason)** - Deny queued pick

## Verification Results

```
scored_props has 12 columns ✓
promotion_queue has 18 columns ✓
v_daily_board has 22 rows ✓
v_prop_read_model has 5693 rows ✓
v_open_promotions has 0 rows ✓
submit_pick RPC exists: true ✓
approve_pick RPC exists: true ✓
deny_pick RPC exists: true ✓
```

## Schema Adjustments Made

During deployment, the following columns were removed from views due to schema mismatch:
- Removed: `book`, `best_book`, `best_available_line` (not in unified_picks)
- Removed: `over_odds`, `under_odds` (not in unified_picks)
- Removed: `game_time` (not in unified_picks)
- Removed: `team`, `opponent` (not in unified_picks in v_prop_read_model)

Views now use only confirmed existing columns:
- Core: id, sport, market, selection, line, odds
- Extended: player_name, game_date
- Scoring: edge, prob_win, professional_score, tier, confidence, kelly_fraction, clv_pct
- Workflow: queue_status, publish_at, approved_by, denied_by

## Files Created

- `supabase/migrations/20251004_000000_core_setup.sql` - Main migration
- `supabase/migrations/20251004_000001_verify.sql` - Verification script
- `db_patches.sql` - Original SQL patches
- `introspect.sql` - Schema introspection queries
- `verify.sql` - Standalone verification queries

## Next Steps

The core database infrastructure is now ready for:
1. Scoring agent to populate `scored_props` table
2. Approval workflow to use promotion queue
3. Smart form and dashboard to query views
4. Production data ingestion and processing

---
**Migration successfully applied** | All acceptance criteria met ✅
