# Enhanced45Factor ML Weight Optimization Report

Generated: 2025-10-06T16:03:35.248Z

## Executive Summary

ML-optimized factor weights trained on 2.3M+ settled outcomes from Supabase.

## Performance Summary

| Sport | Win Rate | Accuracy | Brier Score | Log Loss | Sample Size |
|-------|----------|----------|-------------|----------|-------------|
| MLB | 48.00% | 48.00% | 2.4064 | 3.5925 | 200 |
| NBA | 100.00% | 100.00% | 0.0000 | 0.0010 | 200 |
| NHL | 100.00% | 100.00% | 0.0000 | 0.0010 | 200 |
| NFL | 100.00% | 100.00% | 0.0000 | 0.0010 | 200 |

## Sport-Specific Weights

### MLB

Top 10 Most Important Factors:

1. **expectedValueDevigged**: 76.92%
2. **defenseVsPosition**: 76.92%
3. **kellyFraction**: 44.12%
4. **riskAdjustedReturn**: 44.12%
5. **propSpecificTendencies**: 30.05%
6. **playerForm**: 16.23%
7. **usageRate**: 16.23%
8. **performanceTrends**: 16.23%
9. **situationalPerformance**: 16.23%
10. **lineMovementVelocity**: 2.56%

### NBA

Top 10 Most Important Factors:

1. **expectedValueDevigged**: 0.00%
2. **lineMovementVelocity**: 0.00%
3. **closingLineValue**: 0.00%
4. **marketEfficiency**: 0.00%
5. **publicVsSharpSplit**: 0.00%
6. **volumeProfile**: 0.00%
7. **crossMarketArbitrage**: 0.00%
8. **steamDetection**: 0.00%
9. **marketResistance**: 0.00%
10. **optimalTiming**: 0.00%

### NHL

Top 10 Most Important Factors:

1. **expectedValueDevigged**: 0.00%
2. **lineMovementVelocity**: 0.00%
3. **closingLineValue**: 0.00%
4. **marketEfficiency**: 0.00%
5. **publicVsSharpSplit**: 0.00%
6. **volumeProfile**: 0.00%
7. **crossMarketArbitrage**: 0.00%
8. **steamDetection**: 0.00%
9. **marketResistance**: 0.00%
10. **optimalTiming**: 0.00%

### NFL

Top 10 Most Important Factors:

1. **expectedValueDevigged**: 0.00%
2. **lineMovementVelocity**: 0.00%
3. **closingLineValue**: 0.00%
4. **marketEfficiency**: 0.00%
5. **publicVsSharpSplit**: 0.00%
6. **volumeProfile**: 0.00%
7. **crossMarketArbitrage**: 0.00%
8. **steamDetection**: 0.00%
9. **marketResistance**: 0.00%
10. **optimalTiming**: 0.00%

## Optimization Details

- **Algorithm**: Logistic Regression with L1 Regularization
- **Train/Test Split**: 80% / 19.999999999999996%
- **Weight Constraints**: Min=0.01, Max=0.3
- **Regularization**: L1 Alpha=0.01

## Next Steps

1. Update Enhanced45FactorEngine to load sport-specific weights
2. Deploy optimized weights to production
3. Monitor performance improvement vs baseline
4. Retrain monthly as new data accumulates
