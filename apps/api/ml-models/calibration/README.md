# ML Calibration Models Directory

This directory contains ML-trained probability calibration models for the Enhanced45FactorEngine.

## Directory Structure

```
calibration/
├── README.md                      # This file
├── mlb_calibration.json           # MLB calibration model (1.5M outcomes)
├── nba_calibration.json           # NBA calibration model (493K outcomes)
├── nhl_calibration.json           # NHL calibration model (277K outcomes)
├── nfl_calibration.json           # NFL calibration model (15K outcomes)
└── archive/                       # Archived model versions
    └── v1.0_*.json
```

## Model Generation

**Initial Training** (Required before first use):
```bash
# From project root
docker-compose exec api npx tsx src/scripts/ml/train-calibration-model.ts
```

**Expected Output**:
- Models saved to this directory
- ~500KB per sport
- Total: ~2MB for all sports

**Training Time**: ~5-10 minutes for 2.3M outcomes

## Model Validation

**Validate Models**:
```bash
docker-compose exec api npx tsx src/scripts/ml/validate-calibration.ts
```

**Success Criteria**:
- ✅ Test samples > 400K
- ✅ Brier score < 0.20
- ✅ Calibration error < 5%
- ✅ Brier improvement > 0%
- ✅ Markets validated > 30

## Model Format

Each calibration model contains:

```json
{
  "sport": "NBA",
  "models": {
    "points": {
      "sport": "NBA",
      "marketType": "points",
      "bins": [
        {
          "predictedProb": 0.15,
          "actualRate": 0.12,
          "count": 1234,
          "confidence": 0.02
        },
        // ... 19 more bins
      ],
      "totalSamples": 45678,
      "brierScore": 0.18,
      "calibrationError": 0.04,
      "trainedAt": "2025-10-05T..."
    },
    // ... more market types
  },
  "overallStats": {
    "totalSamples": 492940,
    "avgBrierScore": 0.19,
    "avgCalibrationError": 0.045
  }
}
```

## Model Usage

**Automatic Loading**:
Models are automatically loaded when `CalibratedProbabilityCalculator` is instantiated:

```typescript
import { CalibratedProbabilityCalculator } from './models/CalibratedProbabilityCalculator';

const calc = new CalibratedProbabilityCalculator();
// Models loaded automatically from this directory

const result = await calc.calculateProbability({
  sport: 'NBA',
  playerName: 'LeBron James',
  marketType: 'Points',
  line: 25.5,
  // ... other fields
});

console.log('Calibrated Prob:', result.probability);
console.log('Method:', result.metadata.calibrationMethod);
```

**Check Model Status**:
```typescript
const calc = new CalibratedProbabilityCalculator();

// Check if models loaded
calc.areModelsLoaded(); // true/false

// Get available sports
calc.getAvailableSports(); // ['MLB', 'NBA', 'NHL', 'NFL']

// Get available markets for a sport
calc.getAvailableMarkets('NBA'); // ['points', 'assists', 'rebounds', ...]

// Get calibration stats
const stats = calc.getCalibrationStats('NBA', 'points');
// Returns: { brierScore, calibrationError, totalSamples, ... }
```

## Retraining Schedule

**Recommended Frequency**: Monthly or every 100K new outcomes

**Retraining Process**:
1. Verify new settled outcomes in database
2. Run: `npx tsx src/scripts/ml/train-calibration-model.ts`
3. Run: `npx tsx src/scripts/ml/validate-calibration.ts`
4. Compare metrics to previous models
5. Archive old models to `archive/`
6. Deploy new models
7. Restart services: `./dev.sh restart`

**Version Control**:
- Archive previous models before retraining
- Use naming: `v{major}.{minor}_{sport}_calibration.json`
- Keep last 3 versions for rollback capability

## Troubleshooting

**Models Not Found**:
```
⚠️  Calibration directory not found
```
- Run training script to generate models
- Check file permissions on this directory

**Poor Calibration Performance**:
- Check validation metrics
- Verify sufficient data per market (>100 outcomes)
- Inspect for data quality issues
- Consider retraining with cleaned data

**High Memory Usage**:
- Each model ~500KB
- Total ~2MB for 4 sports
- If memory constrained, reduce bin count in training script

## Monitoring

**Key Metrics**:
- Model load success rate (should be 100%)
- Calibration method usage (ML vs legacy)
- Brier score trend over time
- Calibration error trend over time

**Logs to Monitor**:
```bash
docker-compose logs api | grep "Loaded.*calibration"
docker-compose logs api | grep "ML-calibrated probability"
```

## Support

For issues or questions:
1. Check `ML_CALIBRATION_INTEGRATION_REPORT.md` in project root
2. Review troubleshooting section above
3. Run validation script to diagnose
4. Retrain models if performance degrades

---

**Last Updated**: October 5, 2025
**Model Version**: 1.0
**Training Data**: 2,298,561 settled outcomes (MLB, NBA, NHL, NFL)
