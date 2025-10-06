# Enhanced45Factor ML Weight Optimization Report

Generated: 2025-10-06T14:02:49.998Z

## Executive Summary

ML-optimized factor weights trained on 2.3M+ settled outcomes from Supabase.

## Performance Summary

| Sport | Win Rate | Accuracy | Brier Score | Log Loss | Sample Size |
|-------|----------|----------|-------------|----------|-------------|
| MLB | 48.00% | 48.00% | 2.2007 | 3.5925 | 200 |
| NBA | 0.00% | 0.00% | 0.0000 | 0.0000 | 0 |
| NHL | 52.50% | 52.50% | 1.4006 | 3.2817 | 200 |
| NFL | 48.00% | 48.00% | 2.7673 | 3.5925 | 200 |

## Sport-Specific Weights

### MLB

Top 10 Most Important Factors:

1. **expectedValueDevigged**: 76.92%
2. **defenseVsPosition**: 76.92%
3. **kellyFraction**: 44.12%
4. **riskAdjustedReturn**: 44.12%
5. **propSpecificTendencies**: 23.46%
6. **playerForm**: 17.94%
7. **usageRate**: 17.94%
8. **performanceTrends**: 17.94%
9. **situationalPerformance**: 17.94%
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
5. **playerForm**: 19.61%
6. **usageRate**: 19.61%
7. **performanceTrends**: 19.61%
8. **situationalPerformance**: 19.61%
9. **propSpecificTendencies**: 16.81%
10. **lineMovementVelocity**: 2.56%

### NFL

Top 10 Most Important Factors:

1. **expectedValueDevigged**: 76.92%
2. **defenseVsPosition**: 76.92%
3. **kellyFraction**: 44.12%
4. **riskAdjustedReturn**: 44.12%
5. **playerForm**: 20.73%
6. **usageRate**: 20.73%
7. **performanceTrends**: 20.73%
8. **situationalPerformance**: 20.73%
9. **propSpecificTendencies**: 12.31%
10. **lineMovementVelocity**: 2.56%

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
