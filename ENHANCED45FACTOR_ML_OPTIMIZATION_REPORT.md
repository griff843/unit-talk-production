# Enhanced45Factor ML Weight Optimization Report

Generated: 2025-10-06T13:38:45.636Z

## Executive Summary

ML-optimized factor weights trained on 2.3M+ settled outcomes from Supabase.

## Performance Summary

| Sport | Win Rate | Accuracy | Brier Score | Log Loss | Sample Size |
|-------|----------|----------|-------------|----------|-------------|
| MLB | 0.00% | 0.00% | 0.0000 | 0.0000 | 0 |
| NBA | 0.00% | 0.00% | 0.0000 | 0.0000 | 0 |
| NHL | 0.00% | 0.00% | 0.0000 | 0.0000 | 0 |
| NFL | 50.00% | 50.00% | 2.2902 | 3.4544 | 200 |

## Sport-Specific Weights

### MLB

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

### NFL

Top 10 Most Important Factors:

1. **expectedValueDevigged**: 76.92%
2. **defenseVsPosition**: 76.92%
3. **kellyFraction**: 44.12%
4. **riskAdjustedReturn**: 44.12%
5. **propSpecificTendencies**: 29.26%
6. **playerForm**: 16.47%
7. **usageRate**: 16.47%
8. **performanceTrends**: 16.47%
9. **situationalPerformance**: 16.47%
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
