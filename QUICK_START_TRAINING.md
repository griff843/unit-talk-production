# ⚡ QUICK START: ML TRAINING EXECUTION

**Status**: ✅ ALL PREREQUISITES VALIDATED - READY TO TRAIN

---

## 🚀 ONE-COMMAND EXECUTION

### Working Directory
```bash
cd C:\Users\griff\OneDrive\Desktop\unit-talk-production-main\apps\api
```

### 3-Step Training Pipeline

#### Step 1: Calibration Model (15-20 minutes)
```bash
npx tsx src/scripts/ml/train-calibration-model.ts
```
**Output**: `ml-models/calibration/calibration-model-v1.json`

#### Step 2: Factor Weights (10-15 minutes)
```bash
npx tsx src/scripts/ml/train-factor-weights.ts
```
**Output**: `config/enhanced45-weights/factor-weights-v1.json`

#### Step 3: Backtest (20-30 minutes)
```bash
npx tsx src/scripts/ml/comprehensive-backtest.ts
```
**Output**: `out/ops/backtest-results-[timestamp].json`

---

## 📊 WHAT YOU HAVE

### Database ✅
- **2,298,561** settled outcomes (100% settlement rate)
- **2,290,000** NHL outcomes (99.6%) - PRIMARY DATASET
- **8,500** NBA outcomes (0.4%) - SECONDARY DATASET

### Infrastructure ✅
- All directories created with write permissions
- All training scripts validated (45KB total)
- All environment variables configured
- TypeScript execution environment ready

---

## 🎯 EXPECTED OUTCOMES

### Calibration Model
- **Goal**: <5% calibration error
- **Metric**: Brier score improvement
- **Output**: Probability calibration curves per sport/market

### Factor Weights
- **Goal**: Positive CLV on test set
- **Metric**: Win rate >55%, ROI >0
- **Output**: 45 factor weights optimized for NHL/NBA

### Backtest Results
- **Goal**: Validate edge on historical data
- **Metric**: Sharpe ratio >1.0
- **Output**: Detailed performance metrics by sport/market/date

---

## ⚠️ IMPORTANT NOTES

### Sport Coverage
- **NOW**: NHL (2.29M) + NBA (8.5K) models
- **LATER**: Add NFL/MLB via historical ingestion

### Team Field Warning
- Team field is 0% populated (non-critical)
- Player-based models will train successfully
- Team features can be added in future versions

---

## 📁 OUTPUT LOCATIONS

```
apps/api/
├── ml-models/
│   └── calibration/
│       └── calibration-model-v1.json        ← Step 1 output
├── config/
│   └── enhanced45-weights/
│       └── factor-weights-v1.json           ← Step 2 output
└── ...

out/ops/
└── backtest-results-[timestamp].json        ← Step 3 output
```

---

## ✅ SUCCESS CRITERIA

**Training Successful If:**
- ✅ Calibration error <5%
- ✅ Win rate >55% on test set
- ✅ Positive ROI on holdout data
- ✅ Factor weights logically consistent
- ✅ All output files generated

**Training Failed If:**
- ❌ Calibration error >10%
- ❌ Win rate <50%
- ❌ Negative ROI
- ❌ Missing output files
- ❌ Errors during execution

---

## 🔍 MONITORING PROGRESS

### Watch Logs During Training
```bash
# Step 1: Calibration
# Look for: "Training calibration model..." → "Model saved to..."

# Step 2: Factor Weights
# Look for: "Optimizing factor weights..." → "Weights saved to..."

# Step 3: Backtest
# Look for: "Running backtest..." → "Results saved to..."
```

### Expected Timeline
- **Total Time**: 45-65 minutes
- **Step 1**: 15-20 min (2.3M outcomes)
- **Step 2**: 10-15 min (45 factors)
- **Step 3**: 20-30 min (comprehensive backtest)

---

## 📊 VALIDATION REPORTS

**Prerequisites Validation** (COMPLETE):
- Executive: `TIER1_PREREQUISITES_VALIDATED.md`
- Detailed: `out/ops/TIER1_VALIDATION_COMPLETE_REPORT.md`
- JSON: `out/ops/tier1-validation-report.json`

---

## 🚨 TROUBLESHOOTING

### If Training Fails

**Check 1: Database Connection**
```bash
npx tsx -e "import { createClient } from '@supabase/supabase-js'; const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); s.from('settled_outcomes').select('*', { count: 'exact', head: true }).then(r => console.log('Count:', r.count))"
```

**Check 2: Directory Permissions**
```bash
ls -la ml-models/calibration/
ls -la config/enhanced45-weights/
ls -la ../../out/ops/
```

**Check 3: Environment Variables**
```bash
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

---

## 🎯 NEXT STEPS AFTER TRAINING

1. ✅ Review model performance metrics
2. ✅ Validate factor weights make sense
3. ✅ Check backtest results for edge
4. ✅ Deploy models to production if metrics meet targets
5. 🔄 Plan NFL/MLB historical ingestion

---

**VALIDATION COMPLETE** ✅
**ALL SYSTEMS GO** ✅
**BEGIN TRAINING** 🚀

---

*Quick Start Guide - Generated October 5, 2025*
