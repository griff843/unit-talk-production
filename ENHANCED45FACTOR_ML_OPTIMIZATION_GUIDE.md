# Enhanced45Factor ML Weight Optimization Guide

**Version**: 1.0.0
**Created**: October 5, 2025
**Status**: Ready for Production Deployment

---

## Executive Summary

This guide documents the ML-based factor weight optimization system for the Enhanced45FactorEngine. The system uses logistic regression trained on 2.3M+ settled outcomes from Supabase to generate sport-specific optimized weights that improve prediction accuracy over baseline expert weights.

**Target Performance**: >2% win rate improvement over expert weights

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Training Pipeline](#training-pipeline)
4. [Deployment](#deployment)
5. [Validation](#validation)
6. [Monitoring](#monitoring)
7. [Retraining](#retraining)
8. [Troubleshooting](#troubleshooting)

---

## System Overview

### Components

The ML optimization system consists of 5 key components:

1. **FactorWeightOptimizer** (`train-factor-weights.ts`)
   - Fetches settled outcomes from Supabase
   - Extracts 45-factor feature vectors
   - Trains logistic regression models
   - Generates optimized weight configurations

2. **DynamicWeightLoader** (`DynamicWeightLoader.ts`)
   - Loads sport-specific ML-optimized weights
   - Falls back to expert defaults when unavailable
   - Caches weights for performance

3. **Enhanced45FactorEngine** (updated)
   - Automatically loads ML weights for each sport
   - Merges with manual overrides when provided
   - Logs weight source for transparency

4. **Database Migration** (`030_ml_weight_optimization_support.sql`)
   - Adds `count_outcomes_by_sport()` function
   - Adds `fetch_training_sample()` function
   - Indexes for ML training queries

5. **Validation Scripts**
   - `run-ml-optimization.ts`: Full pipeline orchestration
   - `validate-ml-weights.ts`: Weight validation

---

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Supabase Database                        │
│                    (2.3M+ Outcomes)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              FactorWeightOptimizer                           │
│  1. Fetch settled outcomes by sport                          │
│  2. Extract 45-factor features                               │
│  3. Train/test split (80/20)                                 │
│  4. Logistic regression with L1                              │
│  5. Normalize weights by category                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         Sport-Specific Weight Configs                        │
│  - config/enhanced45-weights/nfl-weights.json                │
│  - config/enhanced45-weights/nba-weights.json                │
│  - config/enhanced45-weights/mlb-weights.json                │
│  - config/enhanced45-weights/nhl-weights.json                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              DynamicWeightLoader                             │
│  - Loads weights at runtime                                  │
│  - Caches for performance                                    │
│  - Falls back to expert defaults                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            Enhanced45FactorEngine                            │
│  - Applies ML-optimized weights                              │
│  - Scores props using 45 factors                             │
│  - Returns S/A/B/C/D tier predictions                        │
└─────────────────────────────────────────────────────────────┘
```

### Weight Priority

When scoring a prop, weights are selected in this order:

1. **Manual Override** (if provided via `config` parameter)
2. **ML-Optimized** (from `config/enhanced45-weights/{sport}-weights.json`)
3. **Expert Defaults** (hardcoded in `Enhanced45FactorEngine.ts`)

---

## Training Pipeline

### Prerequisites

1. **Data Requirements**:
   - Minimum 10,000 settled outcomes total
   - Recommended 100,000+ per sport for optimal training
   - Data must have `actual_value` populated
   - Outcomes must be 'win' or 'loss' (push/void excluded)

2. **Environment Setup**:
   - Supabase connection configured in `.env`
   - Migration 030 applied to database
   - Node.js 20+ installed
   - Sufficient RAM for training (4GB+)

### Running the Training Pipeline

#### Option 1: Full Automated Pipeline

```bash
# Docker (recommended for production)
docker exec unit-talk-api npx tsx src/scripts/ml/run-ml-optimization.ts

# Local development
npx tsx apps/api/src/scripts/ml/run-ml-optimization.ts
```

This will:
1. Apply database migration (if needed)
2. Train weights for all sports
3. Validate generated configs
4. Generate performance report

#### Option 2: Manual Training Only

```bash
# Docker
docker exec unit-talk-api npx tsx src/scripts/ml/train-factor-weights.ts

# Local
npx tsx apps/api/src/scripts/ml/train-factor-weights.ts
```

### Training Configuration

Edit `TRAINING_CONFIG` in `train-factor-weights.ts`:

```typescript
const TRAINING_CONFIG = {
  // Sample sizes per sport
  sampleSizes: {
    MLB: 100000,  // Increase if >100K available
    NBA: 80000,
    NHL: 50000,
    NFL: 15000
  },

  // Train/test split ratio
  trainRatio: 0.8,

  // Weight constraints
  minWeight: 0.01,  // Keep all factors active
  maxWeight: 0.30,  // Prevent dominance

  // Regularization (higher = more feature selection)
  l1Alpha: 0.01,

  // Convergence settings
  maxIterations: 1000,
  tolerance: 0.0001
};
```

### Expected Output

After training, you'll see:

```
🤖 ENHANCED45FACTOR ML WEIGHT OPTIMIZATION
================================================================================
Mission: Train optimal factor weights on 2.3M+ settled outcomes

🔍 Validating data availability...

Sport Distribution:
  MLB: 1,500,000 outcomes
  NBA: 493,000 outcomes
  NHL: 277,000 outcomes
  NFL: 15,000 outcomes

Total: 2,285,000 settled outcomes

📊 Training MLB weights (100,000 samples)...
  Training on 80,000 samples...
  ✅ Exported: config/enhanced45-weights/mlb-weights.json

📊 Training NBA weights (80,000 samples)...
  Training on 64,000 samples...
  ✅ Exported: config/enhanced45-weights/nba-weights.json

... (continues for NHL, NFL)

📊 Report generated: ENHANCED45FACTOR_ML_OPTIMIZATION_REPORT.md

✅ ML OPTIMIZATION COMPLETE - Ready for production deployment
```

---

## Deployment

### Step 1: Apply Database Migration

Via Supabase Dashboard or SQL editor:

```sql
-- Apply migration 030
\i apps/api/migrations/030_ml_weight_optimization_support.sql
```

### Step 2: Train Weights

```bash
docker exec unit-talk-api npx tsx src/scripts/ml/run-ml-optimization.ts
```

### Step 3: Validate Weights

```bash
docker exec unit-talk-api npx tsx src/scripts/ml/validate-ml-weights.ts
```

Expected output:

```
🔍 VALIDATING ML-OPTIMIZED WEIGHTS
================================================================================

📂 Available Weight Configurations:
  ✅ NFL
     Win Rate: 56.20%
     Accuracy: 56.20%
     Sample Size: 3,000
  ✅ NBA
     Win Rate: 57.80%
     Accuracy: 57.80%
     Sample Size: 16,000

🔬 Weight Loading Validation:
  ✅ NFL (ML-optimized)
  ✅ NBA (ML-optimized)
  ✅ MLB (Expert defaults)
  ✅ NHL (Expert defaults)

📄 Configuration File Validation:
  ✅ nfl-weights.json
     Sport: NFL
     Version: 1.0.0-ml-optimized
     Win Rate: 56.20%
  ✅ nba-weights.json
     Sport: NBA
     Version: 1.0.0-ml-optimized
     Win Rate: 57.80%

================================================================================
✅ VALIDATION PASSED - Weights ready for production
```

### Step 4: Deploy to Production

1. **Commit weight configs**:
```bash
git add config/enhanced45-weights/*.json
git commit -m "feat: add ML-optimized factor weights"
git push
```

2. **Restart services** (Docker will pick up new configs automatically):
```bash
./dev.sh restart
```

3. **Monitor logs** for weight loading:
```bash
./dev.sh logs | grep "ML-optimized weights"
```

You should see:
```
Enhanced45FactorEngine: ML-optimized weights available { sports: ['NFL', 'NBA'], count: 2 }
```

---

## Validation

### Pre-Deployment Validation

Run the validation script:

```bash
npx tsx apps/api/src/scripts/ml/validate-ml-weights.ts
```

This checks:
- ✅ Config files exist and are valid JSON
- ✅ All 5 factor categories present
- ✅ Weights sum to 1.0 per category
- ✅ Weight loader can load each sport
- ✅ Performance metrics are populated

### Post-Deployment Validation

1. **Check logs for weight loading**:
```bash
docker logs unit-talk-api | grep "ML-optimized"
```

2. **Verify scoring uses ML weights**:
```bash
# Score a test prop
docker exec unit-talk-api npx tsx scripts/test-enhanced45factor-scoring.ts
```

3. **Monitor performance metrics**:
   - Track S-tier pick win rate
   - Compare vs baseline expert weights
   - Measure Brier score improvements

### A/B Testing (Optional)

To run A/B test between expert and ML weights:

```typescript
// In Enhanced45FactorEngine
const useMLWeights = Math.random() < 0.5; // 50/50 split

if (useMLWeights) {
  const mlWeights = dynamicWeightLoader.loadWeights(sport);
  // Use ML weights
} else {
  // Use expert defaults
}

// Track which group for analysis
```

---

## Monitoring

### Key Metrics to Track

1. **Win Rate by Tier**:
   - S-tier: Target >58%
   - A-tier: Target >55%
   - B-tier: Target >52%

2. **Calibration**:
   - Brier score: Target <0.20
   - Log loss: Target <0.65

3. **Volume**:
   - Props scored per day
   - ML weight vs expert weight usage

4. **Performance Drift**:
   - Win rate degradation over time
   - Indicates need for retraining

### Monitoring Dashboard (Grafana)

Add these queries to Grafana:

```sql
-- Win rate by weight source
SELECT
  CASE
    WHEN config_used LIKE '%ml-optimized%' THEN 'ML-Optimized'
    ELSE 'Expert Defaults'
  END as weight_source,
  COUNT(*) FILTER (WHERE outcome = 'win') * 100.0 / COUNT(*) as win_rate,
  COUNT(*) as total_picks
FROM unified_picks
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY weight_source;

-- S-tier performance by sport
SELECT
  sport,
  COUNT(*) FILTER (WHERE outcome = 'win') * 100.0 / COUNT(*) as win_rate,
  COUNT(*) as total_picks
FROM unified_picks
WHERE tier = 'S'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY sport;
```

### Alerts

Set up alerts for:

- S-tier win rate drops below 55% (warning)
- S-tier win rate drops below 52% (critical - retrain)
- Brier score increases above 0.25 (warning)
- No ML weights loaded (critical - deployment issue)

---

## Retraining

### When to Retrain

Retrain ML weights when:

1. **Monthly Schedule**: Retrain on 1st of each month
2. **Performance Degradation**: Win rate drops >2% from baseline
3. **New Data Available**: After major data ingestion (>100K new outcomes)
4. **Sport-Specific**: Individual sports showing drift

### Retraining Process

```bash
# 1. Check current performance
docker exec unit-talk-api npx tsx src/scripts/ml/validate-ml-weights.ts

# 2. Backup current weights
cp -r config/enhanced45-weights config/enhanced45-weights.backup-$(date +%Y%m%d)

# 3. Run retraining
docker exec unit-talk-api npx tsx src/scripts/ml/run-ml-optimization.ts

# 4. Validate new weights
docker exec unit-talk-api npx tsx src/scripts/ml/validate-ml-weights.ts

# 5. A/B test (optional, 7 days)
# Deploy 50/50 split, measure performance

# 6. Full deployment
git add config/enhanced45-weights/*.json
git commit -m "feat: retrain ML weights - monthly update"
git push

# 7. Restart services
./dev.sh restart
```

### Rollback Procedure

If new weights perform worse:

```bash
# 1. Restore backup
rm -rf config/enhanced45-weights
cp -r config/enhanced45-weights.backup-YYYYMMDD config/enhanced45-weights

# 2. Restart services
./dev.sh restart

# 3. Investigate root cause
# - Check training data quality
# - Review feature engineering
# - Validate training configuration
```

---

## Troubleshooting

### Issue: "No settled outcomes found"

**Cause**: Database empty or migration not applied

**Solution**:
```bash
# Check data availability
docker exec unit-talk-api npx tsx src/scripts/ml/comprehensive-sport-check.ts

# Apply migration
# Via Supabase dashboard, run migration 030
```

### Issue: "Insufficient data for {sport}"

**Cause**: Less than 1,000 outcomes for a sport

**Solution**:
- Use expert defaults for that sport
- Wait for more data to accumulate
- Lower `sampleSizes` in training config

### Issue: "Weights sum to X (expected 1.0)"

**Cause**: Normalization error in training

**Solution**:
- Rerun training
- Check for NaN values in training data
- Validate feature extraction logic

### Issue: "ML weights not loading"

**Cause**: Config directory or files not found

**Solution**:
```bash
# Verify configs exist
ls -la config/enhanced45-weights/

# Check permissions
chmod -R 755 config/enhanced45-weights/

# Validate file structure
npx tsx apps/api/src/scripts/ml/validate-ml-weights.ts
```

### Issue: "Performance worse than expert weights"

**Cause**: Possible overfitting or poor calibration

**Solution**:
1. Increase L1 regularization (`l1Alpha`)
2. Reduce sample size (prevent overfitting)
3. Use cross-validation
4. Check for data leakage in feature engineering
5. Validate test set is truly held out

---

## API Reference

### DynamicWeightLoader

```typescript
import { dynamicWeightLoader } from './DynamicWeightLoader';

// Load sport-specific weights
const weights = dynamicWeightLoader.loadWeights('NFL');

// Get available configs
const sports = dynamicWeightLoader.getAvailableConfigs();
// Returns: ['NFL', 'NBA', 'MLB', 'NHL']

// Get performance metrics
const metrics = dynamicWeightLoader.getPerformanceMetrics('NFL');
// Returns: { winRate, accuracy, brierScore, logLoss, sampleSize }

// Clear cache (for retraining)
dynamicWeightLoader.clearCache();
```

### Enhanced45FactorEngine

```typescript
// Automatic ML weight loading
const result = await engine.calculate45FactorScore(features);
// Automatically uses ML weights for features.sport

// Manual override
const result = await engine.calculate45FactorScore(features, {
  marketFactors: { expectedValueDevigged: 0.30 } // Override specific factor
});
```

---

## Changelog

### v1.0.0 (2025-10-05)
- Initial ML optimization system
- Logistic regression training
- Sport-specific weight configs
- Dynamic weight loading
- Validation scripts
- Comprehensive documentation

---

## Future Enhancements

### Phase 2 (Q1 2026)
- [ ] Ensemble methods (Random Forest, XGBoost)
- [ ] Bayesian optimization for hyperparameters
- [ ] Online learning (incremental updates)
- [ ] Feature importance visualization

### Phase 3 (Q2 2026)
- [ ] Deep learning factor weights (Neural Network)
- [ ] Multi-task learning (simultaneously optimize multiple objectives)
- [ ] Automated A/B testing framework
- [ ] Real-time weight adaptation

---

## Support

For questions or issues:

1. Check troubleshooting section above
2. Review logs: `./dev.sh logs | grep Enhanced45`
3. Validate weights: `npx tsx apps/api/src/scripts/ml/validate-ml-weights.ts`
4. Open GitHub issue with:
   - Error logs
   - Training configuration
   - Data sample sizes
   - Expected vs actual behavior

---

**Last Updated**: October 5, 2025
**Version**: 1.0.0
**Status**: Production Ready
