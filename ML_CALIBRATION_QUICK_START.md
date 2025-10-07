# ML Calibration Quick Start Guide

**Mission**: Integrate 2.3M settled outcomes for ML-based probability calibration

---

## 🚀 Quick Start (3 Steps)

### Step 1: Train Calibration Models

```bash
docker-compose exec api npx tsx src/scripts/ml/train-calibration-model.ts
```

**Expected Output**:
```
🎯 ML CALIBRATION MODEL TRAINING
================================================================================
📊 Total settled outcomes: 2,298,561

Training MLB, NBA, NHL, NFL models...
✅ Saved MLB calibration models to: /path/to/ml-models/calibration/mlb_calibration.json
✅ Saved NBA calibration models to: /path/to/ml-models/calibration/nba_calibration.json
✅ Saved NHL calibration models to: /path/to/ml-models/calibration/nhl_calibration.json
✅ Saved NFL calibration models to: /path/to/ml-models/calibration/nfl_calibration.json

✅ ALL CRITERIA MET!
```

**Time**: ~5-10 minutes

---

### Step 2: Validate Models

```bash
docker-compose exec api npx tsx src/scripts/ml/validate-calibration.ts
```

**Expected Output**:
```
🎯 CALIBRATION MODEL VALIDATION
================================================================================
✅ Loaded MLB: 18 models
✅ Loaded NBA: 15 models
✅ Loaded NHL: 8 models
✅ Loaded NFL: 12 models

VALIDATION RESULTS:
  Brier Score:        0.18 → 0.15 (16.7% improvement)
  Calibration Error:  8.2% → 3.9% (52.4% improvement)

✅ GO FOR PRODUCTION
```

**Time**: ~3-5 minutes

---

### Step 3: Restart Services

```bash
./dev.sh restart
```

**Verify in Logs**:
```bash
docker-compose logs api | grep "Loaded.*calibration"
```

**Expected**:
```
✅ Loaded MLB calibration: 18 models
✅ Loaded NBA calibration: 15 models
✅ Loaded NHL calibration: 8 models
✅ Loaded NFL calibration: 12 models
✅ Calibration models loaded for 4 sports
```

---

## ✅ Success Checklist

- [ ] Training completed successfully
- [ ] Validation passed all criteria
- [ ] Model files exist in `apps/api/ml-models/calibration/`
- [ ] Services restarted
- [ ] Logs show "Calibration models loaded"
- [ ] Logs show "ML-calibrated probability calculated"

---

## 📊 What This Does

**Before**:
- Hardcoded calibration (232 NFL outcomes)
- NFL-only support
- 10.31% calibration error

**After**:
- ML-trained calibration (2.3M outcomes)
- Multi-sport support (MLB, NBA, NHL, NFL)
- <5% calibration error (target)
- Sport-specific, market-aware adjustments

---

## 🔍 Monitoring

**Check Calibration Usage**:
```bash
docker-compose logs api | grep "ML-calibrated probability" | tail -20
```

**Expected**:
```
ML-calibrated probability calculated: {
  player: "LeBron James",
  market: "Points",
  probability: 0.58,
  baseProbability: 0.62,
  calibrationMethod: "ml_calibrated_interpolated",
  sport: "NBA"
}
```

---

## 📚 Documentation

- **Full Report**: `ML_CALIBRATION_INTEGRATION_REPORT.md`
- **Model Directory**: `apps/api/ml-models/calibration/README.md`

---

## 🆘 Troubleshooting

**Issue**: Models not loading
```bash
# Check if model files exist
ls -lh apps/api/ml-models/calibration/

# Should show: mlb_calibration.json, nba_calibration.json, etc.
```

**Issue**: Validation failing
```bash
# Check settled_outcomes count
docker-compose exec postgres psql -U postgres -d unit_talk -c "SELECT sport, COUNT(*) FROM settled_outcomes GROUP BY sport;"

# Should show: MLB ~1.5M, NBA ~493K, NHL ~277K, NFL ~15K
```

**Issue**: Poor calibration performance
- Verify success criteria in validation output
- Check Brier score <0.20
- Check calibration error <5%
- Retrain if needed

---

## 🔄 Retraining (Monthly)

```bash
# 1. Archive old models
mkdir -p apps/api/ml-models/calibration/archive
mv apps/api/ml-models/calibration/*.json apps/api/ml-models/calibration/archive/

# 2. Retrain
docker-compose exec api npx tsx src/scripts/ml/train-calibration-model.ts

# 3. Validate
docker-compose exec api npx tsx src/scripts/ml/validate-calibration.ts

# 4. Deploy
./dev.sh restart
```

---

**Status**: ✅ READY FOR DEPLOYMENT
**Date**: October 5, 2025
