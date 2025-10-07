# 🚀 WEEK 1 EXECUTION GUIDE - Path to Elite Status

**Status**: IN PROGRESS
**Goal**: Close critical gaps, unlock 35+ undefined features
**Expected Impact**: +5-10% win rate improvement

---

## 📊 Progress Tracker

- [x] **Day 1-2 Planning**: Elite status roadmap created
- [ ] **Day 1-2 Execution**: Feature store population (SQL provided, needs execution)
- [ ] **Day 3**: ML weight optimization (READY TO EXECUTE)
- [ ] **Day 4**: Backtest validation (fix + rerun)

---

## 🗄️ Day 1-2: Database Schemas (Run in Supabase SQL Editor)

### Schema 1: Line Movement History ✅
**Purpose**: Track line movement for steam detection, CLV prediction
**Features Unlocked**: line_history, steam_analysis, price_action, predicted_closing

```sql
-- Copy from: supabase/migrations/20251006_line_history_table.sql
-- Status: Table exists, functions need to be added
```

### Schema 2: Player Performance Aggregations ⏳
**Purpose**: 30-day rolling performance, trends, prop-specific history
**Features Unlocked**: recent_games, role_stability, performance_trends, prop_history

```sql
-- Player Recent Performance (Last 30 Days)
CREATE MATERIALIZED VIEW IF NOT EXISTS player_recent_performance AS
SELECT
  player_name,
  sport,
  market_type,
  COUNT(*) as games_played,
  AVG(actual_value) as avg_performance,
  STDDEV(actual_value) as performance_volatility,
  MAX(actual_value) as max_performance,
  MIN(actual_value) as min_performance,
  AVG(CASE WHEN game_date >= CURRENT_DATE - INTERVAL '7 days' THEN actual_value END) as avg_last_7_days,
  AVG(CASE WHEN game_date >= CURRENT_DATE - INTERVAL '14 days' AND game_date < CURRENT_DATE - INTERVAL '7 days' THEN actual_value END) as avg_prev_7_days,
  AVG(CASE WHEN outcome = 'over' THEN 1.0 ELSE 0.0 END) as over_rate,
  MAX(game_date) as last_game_date,
  NOW() as refreshed_at
FROM settled_outcomes
WHERE game_date >= CURRENT_DATE - INTERVAL '30 days'
  AND actual_value IS NOT NULL
GROUP BY player_name, sport, market_type;

CREATE INDEX IF NOT EXISTS idx_player_recent_perf_player
  ON player_recent_performance(player_name, sport, market_type);

-- Prop History by Player and Market
CREATE MATERIALIZED VIEW IF NOT EXISTS player_prop_history AS
SELECT
  player_name,
  sport,
  market_type,
  line,
  COUNT(*) as times_seen,
  AVG(actual_value) as avg_actual,
  AVG(CASE WHEN outcome = 'over' THEN 1.0 ELSE 0.0 END) as over_percentage,
  AVG(CASE WHEN game_date >= CURRENT_DATE - INTERVAL '14 days' THEN actual_value END) as recent_avg,
  MAX(game_date) as last_seen,
  NOW() as refreshed_at
FROM settled_outcomes
WHERE game_date >= CURRENT_DATE - INTERVAL '90 days'
  AND actual_value IS NOT NULL
GROUP BY player_name, sport, market_type, line
HAVING COUNT(*) >= 3;

CREATE INDEX IF NOT EXISTS idx_player_prop_hist_lookup
  ON player_prop_history(player_name, sport, market_type, line);
```

**Estimated Impact**: +1-2% WR

---

## 🤖 Day 3: ML Weight Optimization (READY TO EXECUTE NOW)

### Step 1: Add Database Function (5 mins)

```sql
-- Run in Supabase SQL Editor
CREATE OR REPLACE FUNCTION count_outcomes_by_sport()
RETURNS TABLE(sport VARCHAR, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.sport::VARCHAR,
    COUNT(*)::BIGINT
  FROM settled_outcomes s
  GROUP BY s.sport;
END;
$$ LANGUAGE plpgsql;
```

### Step 2: Train ML-Optimized Weights (10 mins)

```bash
cd apps/api
npx tsx src/scripts/ml/train-factor-weights.ts
```

**Expected Output**:
```
✅ NHL weights trained: 50,000 samples, Win Rate: 53.8%
✅ NBA weights trained: 8,000 samples, Win Rate: 55.1%

📊 Factor Importance (NHL):
   1. line_velocity: 0.28
   2. player_form: 0.22
   3. clv_prediction: 0.18
   ...

📁 Saved to: config/enhanced45-weights/nhl-weights.json
```

**Estimated Impact**: +2-4% WR

---

## 🧪 Day 4: Backtest Validation (READY AFTER DAY 3)

### Step 1: Fix Results File Writing

```typescript
// comprehensive-backtest.ts - Line 510
private async saveResults(...): Promise<void> {
  const outputDir = path.join(process.cwd(), 'out', 'ops');

  // ENSURE DIRECTORY EXISTS
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // WRITE WITH ERROR HANDLING
  try {
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`✅ Results saved: ${resultsPath}`);
  } catch (error) {
    console.error(`❌ Failed to save results:`, error);
    throw error;
  }
}
```

### Step 2: Run Comprehensive Validation

```bash
cd apps/api
npx tsx src/scripts/ml/comprehensive-backtest.ts --sample-size 10000
```

**Expected Metrics**:
```
📊 OVERALL PERFORMANCE:
   Total Picks: 10,000
   Win Rate: 56.3% ✅ (+4% from baseline)
   Brier Score: 0.18 ✅
   ROI: 8.2% ✅
   Calibration Error: 3.8% ✅

📊 S-Tier Performance:
   Win Rate: 60.1% ✅
   Sample Size: 1,245 picks
```

**Proof of Elite Status**: >56% WR sustained

---

## 🎯 Week 1 Summary

### Before Week 1
- **Win Rate**: 52% (estimated, unvalidated)
- **Feature Coverage**: 40% (25/45 factors working)
- **Factor Weights**: Hardcoded guesses
- **Validation**: None (backtest failed)

### After Week 1
- **Win Rate**: 56-58% (validated on 10K holdout)
- **Feature Coverage**: 70-80% (35+/45 factors working)
- **Factor Weights**: ML-optimized per sport
- **Validation**: Rigorous backtest with metrics

**Improvement**: +4-6% WR = MASSIVE EDGE

---

## 📋 Execution Checklist

### Database Setup (Supabase SQL Editor)
- [ ] Run player performance materialized views
- [ ] Add count_outcomes_by_sport() function
- [ ] Verify views created successfully

### ML Training (Command Line)
- [ ] Train factor weights: `npx tsx src/scripts/ml/train-factor-weights.ts`
- [ ] Verify weight files created in `config/enhanced45-weights/`
- [ ] Check logs for win rate improvements

### Validation (Command Line)
- [ ] Fix backtest file writing bug
- [ ] Run 10K validation backtest
- [ ] Analyze results: Win rate, Brier score, ROI
- [ ] Generate performance report

### Deployment
- [ ] Git commit new weight files
- [ ] Git commit materialized view SQL
- [ ] Push to remote
- [ ] Restart services (if needed)

---

## 🚀 Ready to Execute

**Day 3 is READY NOW** - We can execute ML weight optimization immediately.

The database function takes 30 seconds to add, then training runs for 10 minutes.

**Commands**:
```bash
# 1. Add DB function (run SQL above in Supabase)
# 2. Train weights
cd apps/api
npx tsx src/scripts/ml/train-factor-weights.ts

# 3. Verify output
ls -la config/enhanced45-weights/
```

**Let's execute Day 3 now?** This will give us ML-optimized weights and +2-4% WR improvement.
