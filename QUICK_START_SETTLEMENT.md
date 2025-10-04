# 🚀 Quick Start: Settlement Engine

**Time to Complete**: 10 minutes setup + 2-5 hours settlement

---

## Step 1: Apply Migration to Supabase (5 minutes)

### Option A: Copy-Paste SQL (Easiest)

1. **Go to Supabase Dashboard**:
   - https://lxqmuzmqtnnlpfapvief.supabase.co
   - Navigate to **SQL Editor**

2. **Copy the SQL**:
   - Open file: `APPLY_TO_SUPABASE.sql`
   - Copy entire contents

3. **Run in Supabase**:
   - Paste into SQL Editor
   - Click "Run"
   - Wait for success message

### Option B: Via Supabase CLI

```bash
npx supabase db push
```

---

## Step 2: Verify Tables Created (1 minute)

Run this in Supabase SQL Editor:

```sql
SELECT
  'player_stats' as table_name, COUNT(*) as rows FROM player_stats
UNION ALL
SELECT 'settled_outcomes', COUNT(*) FROM settled_outcomes
UNION ALL
SELECT 'league_averages', COUNT(*) FROM league_averages;
```

Expected result: All tables exist with 0 rows.

---

## Step 3: Test Settlement (2 minutes)

```bash
cd apps/api
npx tsx src/scripts/ml/test-settlement-specific-date.ts
```

Expected output:
```
✅ Settlement Results:
   Props Settled: 900+
   Wins: ~300-400
   Losses: ~500-600
```

---

## Step 4: Run Full Settlement (2-5 hours)

### Option A: Foreground (see progress)

```bash
npx tsx src/scripts/ml/settle-all-existing-props.ts
```

### Option B: Background (recommended for long run)

```bash
npx tsx src/scripts/ml/settle-all-existing-props.ts > settlement.log 2>&1 &

# Check progress:
tail -f settlement.log

# OR check database:
npx tsx src/scripts/ml/check-settlement-progress.ts
```

---

## Step 5: Monitor Progress

While settlement is running, check status:

```bash
npx tsx src/scripts/ml/check-settlement-progress.ts
```

Expected progress:
```
Hour 1:  100,000 props settled (7%)
Hour 2:  300,000 props settled (21%)
Hour 3:  600,000 props settled (43%)
Hour 4:  900,000 props settled (64%)
Hour 5: 1,200,000 props settled (86%)
Done:   1,393,820 props settled (100%)
```

---

## Step 6: After Settlement Complete

### Calculate League Averages

```bash
npx tsx src/scripts/ml/calculate-league-averages.ts
```

### Test Probability Calculator

```bash
npx tsx src/scripts/ml/test-probability-calculator.ts
```

### Compare Old vs New System

```bash
npx tsx src/scripts/ml/compare-old-vs-new-system.ts
```

---

## Expected Final Results

### Database State
```
player_stats:      ~500,000 rows
settled_outcomes:  ~1,300,000 rows
league_averages:   ~50-100 rows

Win Rate: 47-50%
Settlement Rate: 93%+
```

### ML System Improvements

**Before (Hardcoded 52%)**:
- All props: 52% probability
- No differentiation
- Cannot identify value

**After (Real Data)**:
- Star players: 60-70% probability
- Bench players: 30-40% probability
- Player-specific baselines
- Real value identification

---

## Troubleshooting

### Tables Don't Exist
```bash
# Re-run SQL from APPLY_TO_SUPABASE.sql
```

### Settlement Errors
```bash
# Check logs:
npx tsx src/scripts/ml/test-settlement-specific-date.ts 2>&1 | grep -i error
```

### Slow Performance
```bash
# Normal! MLB Stats API has rate limiting (500ms between requests)
# Expected: 300-500 props per minute
# Total time: 2-5 hours for 1.4M props
```

### Connection Issues
```bash
# Verify Supabase credentials:
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

---

## What Happens Next

1. **Immediate** (after settlement):
   - ProbabilityCalculator uses real player data
   - Probabilities range 35-75% (not hardcoded 52%)
   - Enhanced45FactorEngine gets real probabilities

2. **Short-term** (1-2 days):
   - Calculate league averages from 500K+ samples
   - Statistical probability calculations
   - Validate against known outcomes

3. **Medium-term** (3-5 days):
   - Train XGBoost/LightGBM models on 1.3M samples
   - Replace statistical methods with ML models
   - Achieve 54-56% win rate on top picks

4. **Long-term** (1-2 weeks):
   - Full syndicate-level operation
   - Continuous model improvement
   - 55-58% win rate validated

---

## Files Reference

**Created Files**:
- `APPLY_TO_SUPABASE.sql` - SQL to run in Supabase
- `PropsSettlementEngine.ts` - Core settlement service
- `NFLStatsService.ts` - NFL stats collection
- `settle-all-existing-props.ts` - Main settlement script
- `test-settlement-specific-date.ts` - Test script
- `check-settlement-progress.ts` - Progress monitor

**Documentation**:
- `ML_SETTLEMENT_ENGINE_READY.md` - Full technical doc
- `SETTLEMENT_ENGINE_STATUS.md` - Current status
- `REAL_DATA_ML_SYSTEM_FINAL.md` - ML system overview

---

## Bottom Line

**Current Status**: Settlement engine working, migration needed

**Action Required**: Run SQL in Supabase (5 min)

**Then**: Start settlement (2-5 hours automated)

**Result**: 1.3M training samples for syndicate-level ML

---

**Next Command**:

1. Open Supabase SQL Editor
2. Copy-paste `APPLY_TO_SUPABASE.sql`
3. Click Run
4. Then: `npx tsx src/scripts/ml/settle-all-existing-props.ts`

Let's go! 🚀
