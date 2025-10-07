# Dual-Track Market Props Pipeline - Deployment Success
**Generated**: 2025-10-06
**Migration**: 20251008_market_split.sql
**Status**: ✅ SCHEMA DEPLOYED | ⚠️ AGENTS NEED REWIRING

---

## ✅ Deployment Summary

### Schema Architecture - COMPLETE
Successfully implemented dual-track pipeline separating:
- **Market Props**: No user_id required (market_props table)
- **User Picks**: User-submitted picks (picks_submissions table - future)
- **Source Discriminator**: promotion_queue.source ('market' | 'user')

### Migration Results
```
✅ market_props table created (33 columns)
✅ Unique index: ux_market_props_book_ext
✅ Performance indexes: dates, sport/market, player, game
✅ promotion_queue.source column added
✅ scored_props indexes optimized
✅ Views recreated: v_prop_read_model, v_daily_board
✅ Helper function: get_unscored_market_props()
✅ PostgREST schema cache reloaded
```

### Data Backfill - COMPLETE
```
✅ 4,670 total market_props
✅ 1,072 props for today (2025-10-06)
✅ Deduplication working (1,098 duplicates skipped)
✅ Date range: 2025-10-03 to 2025-10-07
```

### Verification Gates - 3/5 PASSING
```
✅ Gate 1: raw_props_today     = 1072 PASS
✅ Gate 2: market_props_today  = 1072 PASS
⚠️  Gate 3: scored_15m          = 0    WARN (expected - no scoring yet)
✅ Gate 4: v_prop_read_model   = 1072 PASS
❌ Gate 5: v_daily_board       = 0    FAIL (expected - requires scoring)
```

---

## 📊 Current System State

### Data Flow Status
| Stage | Table | Count | Status | Notes |
|-------|-------|-------|--------|-------|
| Ingestion | raw_props | 1072 | ✅ | Fresh data available |
| Normalization | market_props | 1072 | ✅ | Dual-track ready |
| Scoring | scored_props | 0 | ⚠️ | Awaiting ScoringAgent |
| Promotion | promotion_queue | 0 | ⚠️ | Awaiting PromotionAgent |
| Feed | v_prop_read_model | 1072 | ✅ | Command Center ready |
| Board | v_daily_board | 0 | ⚠️ | Awaiting scored props |

### Schema Comparison

**BEFORE (Broken):**
```
raw_props → unified_picks (requires user_id) ❌ BLOCKED
```

**AFTER (Working):**
```
raw_props → market_props (no user_id) ✅ FLOWING
          → scored_props (prop_ref points to market_props)
          → promotion_queue (source='market')
          → v_prop_read_model (1072 rows) ✅
          → v_daily_board (awaiting scoring)
```

---

## 🎯 What's Working Now

### 1. Data Pipeline (Read Path)
✅ Raw props ingestion (1072 rows)
✅ Market props normalization (4670 rows)
✅ Read-model view populated (1072 rows)
✅ Deduplication via unique constraint
✅ Date filtering (game_date >= today)

### 2. Schema Integrity
✅ No more user_id constraint violations
✅ Proper source discriminator in place
✅ Views join correctly across tables
✅ Helper function for scoring agent

### 3. Command Center Compatibility
✅ v_prop_read_model returns market props
✅ Prop structure matches expected format
✅ Game dates filter correctly
⚠️ v_daily_board empty (needs scoring)

---

## ⚠️ Remaining Work - Agent Rewiring

### Priority 1: ScoringAgent (CRITICAL)
**File**: `apps/api/src/agents/ScoringAgent/*`

**Changes Required**:
```typescript
// OLD (broken):
const { data: props } = await supabase
  .from('unified_picks')
  .select('*')
  .is('professional_score', null);

// NEW (working):
const { data: props } = await supabase
  .rpc('get_unscored_market_props', { limit_count: 100 });

// Process through Enhanced45Factor
for (const prop of props) {
  const score = await enhanced45FactorEngine.score(prop);

  // Write to scored_props with prop_ref = market_props.id
  await supabase.from('scored_props').insert({
    prop_ref: prop.id, // Points to market_props row
    edge: score.edge,
    prob_win: score.probWin,
    professional_score: score.professionalScore,
    tier: score.tier,
    confidence: score.confidence,
    kelly_fraction: score.kellyFraction,
    clv_pct: score.clvPct
  });
}
```

**Estimated Time**: 30 minutes
**Impact**: Unblocks entire pipeline

### Priority 2: NormalizerAgent
**File**: `apps/api/src/agents/NormalizerAgent/*`

**Changes Required**:
```typescript
// OLD:
await supabase.from('unified_picks').insert(normalizedProp);

// NEW:
await supabase.from('market_props').insert({
  sport: prop.sport,
  market: prop.market,
  selection: prop.selection,
  line: prop.line,
  odds: prop.odds,
  over_odds: prop.overOdds,
  under_odds: prop.underOdds,
  bookmaker_key: prop.bookmaker || 'unknown',
  game_date: prop.gameDate,
  player_name: prop.playerName,
  external_prop_id: prop.externalPropId,
  external_game_id: prop.externalGameId,
  metadata: prop.metadata
});
```

**Estimated Time**: 20 minutes
**Impact**: Enables real-time ingestion

### Priority 3: PromotionAgent
**File**: `apps/api/src/agents/PromotionAgent/*`

**Changes Required**:
```typescript
// Add source discriminator when writing to promotion_queue
await supabase.from('promotion_queue').insert({
  prop_ref: scoredProp.prop_ref, // Points to market_props
  source: 'market', // NEW: source discriminator
  status: 'pending',
  priority: calculatePriority(scoredProp),
  metadata: { /* ... */ }
});
```

**Estimated Time**: 15 minutes
**Impact**: Enables promotion flow

---

## 🚀 Deployment Workflow (Going Forward)

### For New Deployments:
```bash
# 1. Apply migration
npx tsx src/scripts/apply-market-split-migration.ts

# 2. Backfill historical data
npx tsx src/scripts/backfill-market-props.ts

# 3. Verify schema
npx tsx src/scripts/verify-gates.ts

# 4. Run scoring (after agent rewiring)
npx tsx src/runner/runScoringAgent.ts

# 5. Verify pipeline end-to-end
npx tsx src/scripts/verify-gates.ts
```

### For Daily Operations:
```bash
# Morning: Check pipeline health
npx tsx src/scripts/verify-gates.ts

# If raw_props > market_props:
npx tsx src/scripts/backfill-market-props.ts

# If scored_props stale:
npx tsx src/runner/runScoringAgent.ts
```

---

## 📁 Files Created/Modified

### Migration Files
- ✅ `supabase/overrides/20251008_market_split.sql` - Schema migration
- ✅ `apps/api/src/scripts/apply-market-split-migration.ts` - Migration applier
- ✅ `apps/api/src/scripts/backfill-market-props.ts` - Data backfill
- ✅ `apps/api/src/scripts/rescore-market-props.ts` - Re-scoring helper
- ✅ `apps/api/src/scripts/verify-gates.ts` - Updated for new schema

### Documentation
- ✅ `MARKET_SPLIT_DEPLOYMENT_STATUS.md` - Initial status
- ✅ `DUAL_TRACK_DEPLOYMENT_SUCCESS.md` - This file

### Agents (Pending)
- ⚠️ `apps/api/src/agents/ScoringAgent/*` - Needs rewiring
- ⚠️ `apps/api/src/agents/NormalizerAgent/*` - Needs rewiring
- ⚠️ `apps/api/src/agents/PromotionAgent/*` - Needs rewiring

---

## 🎓 Key Learnings

### 1. Schema Design Patterns
**Lesson**: Separate market feed from user submissions
**Pattern**: Use source discriminators for dual-track data
**Benefit**: No more user_id constraint violations

### 2. Migration Best Practices
**Lesson**: Drop views before schema changes
**Pattern**: `DROP VIEW IF EXISTS ... CASCADE` before `CREATE OR REPLACE`
**Benefit**: Avoids column rename conflicts

### 3. View Design
**Lesson**: Match actual table schemas, not ideal schemas
**Pattern**: Query information_schema first, then create views
**Benefit**: No more "column does not exist" errors

### 4. Backfill Strategy
**Lesson**: Pagination required for large datasets
**Pattern**: Fetch in 1000-row batches, handle duplicates silently
**Benefit**: Successfully backfilled 4670 rows

---

## 🏆 Success Metrics

### Before Migration
```
❌ Normalization blocked: user_id constraint
❌ Pipeline stalled: no data flow
❌ Gates: 2/5 failing
❌ v_prop_read_model: 0 rows
```

### After Migration
```
✅ Normalization working: 4670 rows
✅ Pipeline flowing: raw_props → market_props → view
✅ Gates: 3/5 passing (2 expected fails)
✅ v_prop_read_model: 1072 rows
```

### After Agent Rewiring (ETA: 1-2 hours)
```
Expected:
✅ Gates: 5/5 passing
✅ Scoring active: Enhanced45Factor processing
✅ v_daily_board: populated with scored props
✅ Command Center: fully operational
✅ Tier 1 Status: READY
```

---

## 🎯 Next Immediate Steps

**Step 1 (30 min)**: Rewire ScoringAgent to read from market_props
**Step 2 (10 min)**: Run ScoringAgent and verify scored_props populated
**Step 3 (20 min)**: Rewire NormalizerAgent for real-time ingestion
**Step 4 (15 min)**: Rewire PromotionAgent with source discriminator
**Step 5 (15 min)**: Smoke test Command Center approval workflow
**Step 6 (10 min)**: Run final gate verification

**Total ETA**: 1.5-2 hours to full Tier 1 operational status

---

**Architecture**: Dual-track market/user separation
**Status**: Schema deployed, agents pending
**Blocker Resolved**: user_id constraint removed
**Next**: Agent rewiring for end-to-end flow
**Tier 1 ETA**: 1-2 hours
