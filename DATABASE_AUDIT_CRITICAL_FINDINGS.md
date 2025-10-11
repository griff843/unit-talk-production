# 🚨 DATABASE AUDIT - CRITICAL FINDINGS

**Date**: October 11, 2025
**Status**: ❌ CRITICAL ISSUES FOUND

---

## 📊 EXECUTIVE SUMMARY

The database audit revealed **3 critical issues** that are preventing the system from functioning properly:

1. ❌ **Scoring Engine Completely Broken** - FeatureStore not working
2. ⚠️ **Raw Props Table Issues** - 8.9M rows with data quality problems
3. ✅ **Market Props Table Working** - Player props correctly ingested

---

## 🚨 ISSUE #1: SCORING ENGINE NOT WORKING (CRITICAL)

### Problem
**ALL feature lookups are failing** with error:
```
"this.featureStore.queryFeatures is not a function"
```

### Impact
- ❌ **71.1% of factors stuck at default value (50)**
- ❌ All professional_score values nearly identical (48.4 - 51.2)
- ❌ Scoring engine running in "mock mode" without real data
- ❌ Kelly fractions all 0 or null
- ❌ Edge calculations meaningless

### Root Cause
The `FeatureStoreIntegration` class is missing the `queryFeatures()` method that the Enhanced45FactorEngine expects.

**Methods Available:**
- `getEnhancedFeatures()` ✅
- `precomputeFeatures()` ✅
- `checkFreshness()` ✅
- `queryFeatures()` ❌ MISSING!

### Evidence
```
Sample professional_score values from scored_props:
1. 51.15954545454546
2. 51.15954545454546
3. 51.15954545454546
4. 51.15954545454546
5. 51.15954545454546
... (all identical)

Factor Analysis:
- Total factors: 45
- At 50 (default): 32 (71.1%)
- At 0: 2
- At 100: 3
- Unique values: 10/45
```

### Required Fix
1. Either implement `queryFeatures()` method in FeatureStoreIntegration
2. Or update Enhanced45FactorEngine to use `getEnhancedFeatures()` instead
3. Test scoring with real feature data
4. Verify factor scores vary based on actual prop data

---

## ⚠️ ISSUE #2: RAW_PROPS TABLE PROBLEMS

### Problem
The `raw_props` table has 8.9M rows, which is abnormally high.

### Issues Found
1. **Table Access**: Query returns `undefined` (possible RLS/permission issue)
2. **Data Volume**: 8.9M total rows, 8.6M for today (impossible for one day)
3. **Player Name Field**: Contains "Over", "Under", team names instead of player names (based on earlier checks)
4. **Old Data**: Likely contains historical data from BEFORE player props fix

### Impact
- ⚠️ Cannot use raw_props as data source
- ⚠️ Backfill scripts blocked
- ⚠️ Data quality unknown without access

### Required Fix
1. **Investigate Permission Issue**: Check RLS policies on raw_props table
2. **Data Cleanup**: Delete rows older than 7 days
3. **Player Name Fix**: Verify new ingestion uses outcome.description correctly
4. **Fresh Ingestion**: Re-ingest with player props fix for clean data

---

## ✅ ISSUE #3: MARKET_PROPS TABLE (WORKING!)

### Status
✅ **WORKING CORRECTLY**

### Validation
```
Total: 1,837 rows
Today: 1,724 rows

Player Name Analysis (50 samples):
- Over/Under values: 0 (0.0%)  ✅
- Team names: 0 (0.0%)  ✅
- Actual player names: 50 (100.0%)  ✅

Sample Players:
- Jacory Croskey-Merritt
- D'Andre Swift
- Caleb Williams
- Jayden Daniels
- Rome Odunze
- Olamide Zaccheaus

Selection Field:
- Contains "Over" for player props  ✅
```

### NFL Props for 10/12/2025
```
Total: 706 props
- Game markets: 104 (spread, total, moneyline)
- Player props: 602 ⭐
- Unique players: 151

Markets:
- player_receptions: 319
- player_rush_yds: 159
- player_pass_yds: 63
- player_pass_tds: 61
```

**✅ Player props ingestion is WORKING!**

---

## 📊 SCORING COVERAGE

### Current State
- Market props today: 1,724
- Scored props: 121
- **Scoring rate: 7.0%** (121/1,724)

### Why So Low?
1. Scoring script only processes 100 props at a time
2. `get_unscored_market_props()` has limit of 100
3. Would need to run ~17 times to score all props
4. **But scoring is broken anyway** (see Issue #1)

---

## 🔧 ACTION PLAN (Priority Order)

### PRIORITY 1: FIX SCORING ENGINE (CRITICAL)

**File**: `apps/api/src/agents/ScoringAgent/scoring/FeatureStoreIntegration.ts`

**Option A - Add Missing Method**:
```typescript
async queryFeatures(key: string): Promise<any> {
  // Implement feature lookup from database or cache
  // This method should query actual feature data
  // Return real metrics, not defaults
}
```

**Option B - Use Existing Method**:
Update Enhanced45FactorEngine to call `getEnhancedFeatures()` instead of `queryFeatures()`

**Test**:
```bash
cd apps/api
npx tsx src/scripts/debug-scoring-engine.ts
```

**Success Criteria**:
- ✅ No "queryFeatures is not a function" errors
- ✅ Factor scores vary across different props
- ✅ <30% of factors at default value (50)
- ✅ Professional scores vary (not all identical)
- ✅ Kelly fractions > 0 when edge > 0

---

### PRIORITY 2: INVESTIGATE RAW_PROPS ACCESS

**Issue**: Count queries return `undefined`

**Commands**:
```bash
# Check RLS policies
psql -h localhost -U postgres -d postgres -c "
  SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
  FROM pg_policies
  WHERE tablename = 'raw_props';
"

# Check table ownership
psql -h localhost -U postgres -d postgres -c "
  SELECT tableowner FROM pg_tables
  WHERE tablename = 'raw_props';
"

# Try direct count
psql -h localhost -U postgres -d postgres -c "
  SELECT COUNT(*) FROM raw_props;
"
```

---

### PRIORITY 3: CLEAN UP RAW_PROPS

**Only after fixing access issue**

```sql
-- Delete old data (keep last 7 days only)
DELETE FROM raw_props
WHERE game_date < (NOW()::DATE - INTERVAL '7 days');

-- Verify cleanup
SELECT COUNT(*) as total_rows,
       MIN(game_date) as oldest_date,
       MAX(game_date) as newest_date
FROM raw_props;
```

---

### PRIORITY 4: SCORE ALL MARKET_PROPS

**Only after fixing scoring engine**

```bash
cd apps/api

# Score in batches (run 17 times to score all 1,724 props)
for i in {1..17}; do
  echo "Batch $i/17"
  npx tsx src/scripts/score-market-props.ts
  sleep 5
done

# Verify scoring coverage
npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { count } = await supabase.from('scored_props').select('*', { count: 'exact', head: true });
console.log('Scored props:', count);
"
```

---

## 📈 EXPECTED OUTCOMES AFTER FIXES

### Scoring Engine Fixed
- ✅ Professional scores vary (range 20-80, not all ~51)
- ✅ Factors use real data (<30% at default)
- ✅ Kelly fractions calculated correctly
- ✅ Edge calculations meaningful
- ✅ Tier distribution realistic (S/A/B/C/D spread)

### Raw Props Cleaned
- ✅ ~50K rows (7 days of recent data)
- ✅ Player names extracted correctly
- ✅ Queryable via Supabase client
- ✅ Can backfill to market_props

### Full Scoring Coverage
- ✅ 1,500+ scored props (90%+ coverage)
- ✅ All 151 players have scored props
- ✅ Diverse scores across players/markets
- ✅ v_daily_board populated with quality data

---

## 🎯 VALIDATION CHECKLIST

After all fixes:

```bash
# 1. Verify scoring engine
cd apps/api
npx tsx src/scripts/debug-scoring-engine.ts
# Expected: No errors, scores vary

# 2. Verify raw_props access
npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { count } = await supabase.from('raw_props').select('*', { count: 'exact', head: true });
console.log('Raw props count:', count);
"
# Expected: Numeric value (not undefined)

# 3. Verify scoring coverage
npx tsx src/scripts/verify-nfl-props-10-12.ts
# Expected: 90%+ scoring rate

# 4. Run E2E validation
npx tsx src/scripts/e2e-pipeline-validation.ts
# Expected: ALL GREEN (14/14 tests passing)
```

---

## 💡 KEY INSIGHTS

1. **Player Props Ingestion**: ✅ WORKING (602 NFL props, 151 players)
2. **Scoring Engine**: ❌ COMPLETELY BROKEN (mock data only)
3. **Raw Props**: ⚠️ ACCESS ISSUES + DATA QUALITY PROBLEMS
4. **Market Props**: ✅ WORKING (clean data)

**Bottom Line**: The data ingestion pipeline is working, but the scoring engine is not. Fix the FeatureStore integration first, then everything else will work.

---

**Generated**: October 11, 2025
**Audit Duration**: 8.88s
**Critical Issues**: 3
**Action Items**: 4 (prioritized)
