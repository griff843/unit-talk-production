# Quick Start: ML Weight Optimization

**Time to Execute**: <20 minutes
**Complexity**: Low (automated pipeline)
**Prerequisites**: Docker running, Supabase configured

---

## TL;DR

```bash
# 1. Apply migration (via Supabase dashboard)
# Run: apps/api/migrations/030_ml_weight_optimization_support.sql

# 2. Train ML weights
docker exec unit-talk-api npx tsx src/scripts/ml/run-ml-optimization.ts

# 3. Validate weights
docker exec unit-talk-api npx tsx src/scripts/ml/validate-ml-weights.ts

# 4. Deploy
git add config/enhanced45-weights/*.json
git commit -m "feat: ML-optimized Enhanced45Factor weights"
git push
./dev.sh restart
```

---

## Step-by-Step Guide

### Step 1: Apply Database Migration (2 min)

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Paste contents of `apps/api/migrations/030_ml_weight_optimization_support.sql`
4. Click "Run"

**Verify**:
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_name LIKE '%outcome%';
```

Expected:
```
count_outcomes_by_sport
fetch_training_sample
```

---

### Step 2: Run ML Training (10 min)

```bash
docker exec unit-talk-api npx tsx src/scripts/ml/run-ml-optimization.ts
```

**What it does**:
- Fetches 245K settled outcomes from Supabase
- Trains logistic regression for NFL, NBA, MLB, NHL
- Generates optimized weight configs
- Creates performance report

**Expected output**:
```
🤖 ENHANCED45FACTOR ML WEIGHT OPTIMIZATION
================================================================================

📊 Training MLB weights (100,000 samples)...
  ✅ Exported: config/enhanced45-weights/mlb-weights.json

📊 Training NBA weights (80,000 samples)...
  ✅ Exported: config/enhanced45-weights/nba-weights.json

✅ ML OPTIMIZATION COMPLETE
```

**Generated files**:
- `config/enhanced45-weights/mlb-weights.json`
- `config/enhanced45-weights/nba-weights.json`
- `config/enhanced45-weights/nhl-weights.json`
- `config/enhanced45-weights/nfl-weights.json`
- `ENHANCED45FACTOR_ML_OPTIMIZATION_REPORT.md`

---

### Step 3: Validate Weights (2 min)

```bash
docker exec unit-talk-api npx tsx src/scripts/ml/validate-ml-weights.ts
```

**Checks**:
- ✅ Config files parseable
- ✅ Weights sum to 1.0 per category
- ✅ All factor categories present
- ✅ Performance metrics populated

**Expected output**:
```
🔍 VALIDATING ML-OPTIMIZED WEIGHTS
================================================================================
✅ VALIDATION PASSED - Weights ready for production
```

---

### Step 4: Deploy to Production (5 min)

```bash
# Commit generated weights
git add config/enhanced45-weights/*.json
git add ENHANCED45FACTOR_ML_OPTIMIZATION_REPORT.md
git commit -m "feat: add ML-optimized Enhanced45Factor weights"
git push

# Restart services (picks up new configs)
./dev.sh restart

# Verify weight loading
./dev.sh logs | grep "ML-optimized"
```

**Expected log output**:
```
Enhanced45FactorEngine: ML-optimized weights available { sports: ['NFL', 'NBA', 'MLB', 'NHL'], count: 4 }
```

---

## Verification

### Test Weight Loading

```bash
docker exec unit-talk-api node -e "
const { dynamicWeightLoader } = require('./src/agents/ScoringAgent/scoring/DynamicWeightLoader.ts');
console.log('Available configs:', dynamicWeightLoader.getAvailableConfigs());
console.log('NFL metrics:', dynamicWeightLoader.getPerformanceMetrics('NFL'));
"
```

### Test Scoring

Score a test prop to verify ML weights are used:

```bash
docker exec unit-talk-api npx tsx scripts/test-enhanced45factor-scoring.ts
```

Look for log line:
```
ML-optimized weights loaded for sport: NFL
```

---

## Monitoring

### Week 1: Daily Checks

```bash
# Check S-tier win rate
docker exec -T unit-talk-api psql -U postgres -d unit_talk_dev -c "
  SELECT
    tier,
    COUNT(*) FILTER (WHERE outcome = 'win') * 100.0 / COUNT(*) as win_rate,
    COUNT(*) as total_picks
  FROM unified_picks
  WHERE created_at > NOW() - INTERVAL '24 hours'
    AND tier IN ('S', 'A')
  GROUP BY tier;
"
```

### Month 1: Performance Comparison

```sql
-- ML vs Expert weights
SELECT
  CASE
    WHEN config_used LIKE '%ml-optimized%' THEN 'ML-Optimized'
    ELSE 'Expert Defaults'
  END as weight_source,
  tier,
  COUNT(*) FILTER (WHERE outcome = 'win') * 100.0 / COUNT(*) as win_rate,
  COUNT(*) as picks
FROM unified_picks
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY weight_source, tier
ORDER BY weight_source, tier;
```

---

## Retraining

Run monthly on the 1st:

```bash
# Backup current weights
cp -r config/enhanced45-weights config/enhanced45-weights.backup-$(date +%Y%m%d)

# Retrain
docker exec unit-talk-api npx tsx src/scripts/ml/run-ml-optimization.ts

# Validate
docker exec unit-talk-api npx tsx src/scripts/ml/validate-ml-weights.ts

# Deploy
git add config/enhanced45-weights/*.json
git commit -m "feat: retrain ML weights - $(date +%Y-%m)"
git push
./dev.sh restart
```

---

## Troubleshooting

### Issue: "No settled outcomes found"

```bash
# Check data
docker exec unit-talk-api npx tsx src/scripts/ml/comprehensive-sport-check.ts
```

If empty, need to ingest historical data first.

### Issue: "Training fails with NaN"

Check for:
- Invalid `actual_value` in database
- Missing features in extraction
- Insufficient sample size

### Issue: "Validation fails"

```bash
# Manually validate files
cat config/enhanced45-weights/nfl-weights.json | jq .

# Check weights sum
cat config/enhanced45-weights/nfl-weights.json | jq '.weights.marketFactors | add'
# Should be ~1.0
```

### Issue: "Weights not loading"

```bash
# Check file permissions
ls -la config/enhanced45-weights/

# Verify Docker volume mount
docker exec unit-talk-api ls -la /app/config/enhanced45-weights/

# Test loader directly
docker exec unit-talk-api node -e "
  const { dynamicWeightLoader } = require('./src/agents/ScoringAgent/scoring/DynamicWeightLoader.ts');
  console.log(dynamicWeightLoader.getAvailableConfigs());
"
```

---

## Success Metrics

Track these for 30 days post-deployment:

| Metric | Baseline | Target | Actual |
|--------|----------|--------|--------|
| S-tier Win Rate | 56.0% | >58.0% | _TBD_ |
| A-tier Win Rate | 53.0% | >55.0% | _TBD_ |
| Brier Score | 0.22 | <0.20 | _TBD_ |
| Calibration Error | 10.31% | <5.0% | _TBD_ |

---

## Complete Documentation

For detailed information, see:

- **Full Guide**: `ENHANCED45FACTOR_ML_OPTIMIZATION_GUIDE.md`
- **Technical Report**: `ENHANCED45FACTOR_ML_OPTIMIZATION_REPORT.md`
- **Implementation Summary**: `ML_OPTIMIZATION_IMPLEMENTATION_SUMMARY.md`

---

## Support

Issues? Check:
1. Logs: `./dev.sh logs | grep Enhanced45`
2. Validation: `npx tsx apps/api/src/scripts/ml/validate-ml-weights.ts`
3. Troubleshooting section above
4. Full guide for detailed debugging

---

**Status**: ✅ Ready to Execute
**Estimated Time**: <20 minutes
**Next Step**: Apply migration 030
