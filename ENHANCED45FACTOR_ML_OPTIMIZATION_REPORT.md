# Enhanced45Factor ML Weight Optimization Report

Generated: 2025-10-06T14:22:25.229Z

## Executive Summary

ML-optimized factor weights trained on 2.3M+ settled outcomes from Supabase.

## Performance Summary

| Sport | Win Rate | Accuracy | Brier Score | Log Loss | Sample Size |
|-------|----------|----------|-------------|----------|-------------|
| MLB | 47.50% | 47.50% | 2.4266 | 3.6270 | 200 |
| NBA | 0.00% | 0.00% | 0.0000 | 0.0000 | 0 |
| NHL | 46.00% | 46.00% | 1.4209 | 3.7306 | 200 |
| NFL | 100.00% | 100.00% | 0.0000 | 0.0010 | 200 |

## Sport-Specific Weights

### MLB

Top 10 Most Important Factors:

1. **expectedValueDevigged**: 76.92%
2. **defenseVsPosition**: 76.92%
3. **kellyFraction**: 44.12%
4. **riskAdjustedReturn**: 44.12%
5. **playerForm**: 19.55%
6. **usageRate**: 19.55%
7. **performanceTrends**: 19.55%
8. **situationalPerformance**: 19.55%
9. **propSpecificTendencies**: 17.02%
10. **lineMovementVelocity**: 2.56%

### NBA

Top 10 Most Important Factors:

1. **dataQuality**: 30.00%
2. **expectedValueDevigged**: 25.00%
3. **modelAgreement**: 25.00%
4. **playerForm**: 20.00%
5. **historicalAccuracy**: 20.00%
6. **teamVsTeam**: 18.00%
7. **lineShoppingEdge**: 18.00%
8. **defenseVsPosition**: 16.00%
9. **kellyFraction**: 16.00%
10. **lineMovementVelocity**: 15.00%

### NHL

Top 10 Most Important Factors:

1. **expectedValueDevigged**: 76.92%
2. **defenseVsPosition**: 76.92%
3. **kellyFraction**: 44.12%
4. **riskAdjustedReturn**: 44.12%
5. **playerForm**: 19.62%
6. **usageRate**: 19.62%
7. **performanceTrends**: 19.62%
8. **situationalPerformance**: 19.62%
9. **propSpecificTendencies**: 16.74%
10. **lineMovementVelocity**: 2.56%

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
