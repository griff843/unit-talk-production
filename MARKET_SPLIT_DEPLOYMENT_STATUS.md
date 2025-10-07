# Market Props Split Deployment Status
**Generated**: 2025-10-06
**Migration**: 20251008_market_split.sql

## ✅ Completed Steps

### 1. Schema Migration
- ✅ `market_props` table created with 33 columns
- ✅ Unique index: `ux_market_props_book_ext` on (bookmaker_key, external_prop_id)
- ✅ Performance indexes: dates, sport/market, player, game
- ✅ `promotion_queue.source` column added (market/user discriminator)
- ✅ `scored_props` indexes optimized (updated_at, prop_ref)
- ✅ Views recreated: `v_prop_read_model`, `v_daily_board`
- ✅ Helper function: `get_unscored_market_props(limit_count)`
- ✅ PostgREST schema cache reloaded

### 2. Data Backfill
- ✅ Backfilled 1000 raw_props → market_props (last 3 days: 2025-10-03 to 2025-10-06)
- ✅ All props from 2025-10-05 (game_date)
- ✅ Deduplication working via unique constraint

### 3. Scripts Created
- ✅ `apply-market-split-migration.ts` - Apply migration programmatically
- ✅ `backfill-market-props.ts` - Backfill raw_props to market_props
- ✅ `rescore-market-props.ts` - Trigger re-scoring via helper function

## 📊 Current Data State

| Table | Count | Date Range | Notes |
|-------|-------|------------|-------|
| raw_props | 1072 | today | ✅ Fresh data available |
| market_props | 1000 | 2025-10-05 | ⚠️ Yesterday's data only |
| unified_picks | 0 | - | ⚠️ Empty (wrong table for market) |
| scored_props | 0 | - | ⚠️ No scoring yet |
| v_prop_read_model | 0 | - | ⚠️ Filtered by >= today (no data) |
| v_daily_board | 0 | - | ⚠️ Depends on scored_props |

## ⚠️ Issues Identified

### 1. Date Mismatch
- **Problem**: market_props contains 2025-10-05 data, but view filters for >= 2025-10-06
- **Impact**: Views return 0 rows despite 1000 props in table
- **Fix**: Backfill today's raw_props (1072 rows) to market_props

### 2. No Scoring
- **Problem**: scored_props table is empty
- **Impact**: v_daily_board has no data to display
- **Fix**: Run ScoringAgent to process market_props through Enhanced45Factor

### 3. Agent Wiring
- **Status**: Agents not yet rewired to use market_props
- **Impact**: New data ingestion will still try to write to unified_picks
- **Fix**: Update NormalizerAgent, ScoringAgent, PromotionAgent

## 🚧 Remaining Tasks

### High Priority
1. **Backfill today's data**:
   ```bash
   npx tsx src/scripts/backfill-market-props.ts
   ```
   - This should pull 2025-10-06 data from raw_props

2. **Score market_props**:
   ```bash
   npx tsx src/runner/runScoringAgent.ts
   ```
   - Process 1000+ props through Enhanced45Factor
   - Write to scored_props with prop_ref = market_props.id

3. **Rewire NormalizerAgent**:
   - Change `from('unified_picks')` → `from('market_props')`
   - Use INSERT with unique constraint handling
   - Map fields correctly (no user_id required)

4. **Rewire ScoringAgent**:
   - Read from `market_props` (today + future)
   - Use `get_unscored_market_props()` helper
   - Write to `scored_props` with prop_ref pointing to market_props.id

5. **Update PromotionAgent**:
   - Write to `promotion_queue` with `source='market'`
   - Ensure prop_ref points to market_props.id

### Medium Priority
6. **Run verification gates**:
   - Update verify-gates.ts to use prop_ref instead of prop_id
   - Verify all 5 gates pass

7. **Smoke test Command Center**:
   - Approve 2 props via UI
   - Verify they appear in v_daily_board
   - Confirm Discord alerts fire

### Low Priority
8. **Documentation**:
   - Update TIER_1_MASTER_ROADMAP.md
   - Create deployment workflow guide
   - Document dual-track architecture

## 📈 Success Criteria

### Gate 1: raw_props_today
- **Current**: 1072 ✅
- **Target**: > 0

### Gate 2: market_props_today
- **Current**: 0 ❌ (date filter issue)
- **Target**: > 1000

### Gate 3: scored_15m
- **Current**: 0 ❌
- **Target**: > 0 (props scored in last 15min)

### Gate 4: v_prop_read_model
- **Current**: 0 ❌
- **Target**: > 1000

### Gate 5: v_daily_board
- **Current**: 0 ❌
- **Target**: > 10 (scored + promoted props)

## 🎯 Next Immediate Action

**Run today's backfill to get 2025-10-06 data into market_props**

```bash
cd apps/api
npx tsx src/scripts/backfill-market-props.ts
```

This should:
- Pull 1072 rows from raw_props (game_date >= 2025-10-06)
- Insert into market_props (deduplicated)
- Populate v_prop_read_model with today's data
- Enable ScoringAgent to process props

---
**Status**: Pipeline schema ready, data backfill partial, agents need rewiring
**Blocker**: Date filter excluding yesterday's data, no scoring yet
**ETA to Tier 1**: 2-3 hours (backfill + scoring + agent rewiring + smoke test)
