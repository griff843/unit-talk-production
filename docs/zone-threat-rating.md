# Zone Threat Rating (ZTR) System Documentation

## Overview

The Zone Threat Rating system is an **internal-only** module designed to boost our edge scoring for HR/rocket props by analyzing advanced pitcher/hitter matchup metrics. This system is NOT exposed to the public or in Discord messages.

## Business Objective

Use advanced pitcher control and location metrics to identify high-value betting opportunities on home run props, maximizing our +EV potential through superior pitcher analysis.

## How It Works

### 1. Threat Level Classification

The system classifies pitchers into three threat levels based on multiple risk factors:

- **CLEAN**: Low HR risk, good control (0-2 risk points)
- **MODERATE**: Moderate HR risk (3-4 risk points)  
- **EXTREME**: High HR risk, poor control (5+ risk points, bottom ~5% of league)

### 2. Risk Factors Analyzed

| Metric | Weight | Threshold | Description |
|--------|--------|-----------|-------------|
| HR/9 | High | 1.8+ | Home runs allowed per 9 innings |
| Barrel% | High | 10%+ | Percentage of hard contact allowed |
| Meatball% | High | 7%+ | Percentage of pitches in hittable zones |
| Hittable Count% | Medium | 28%+ | Pitches in HR-prone counts (2-0, 3-1) |
| Recent HRs | Medium | 4+ | HRs allowed in last 3 starts |
| Walk Rate | Modifier | 4.0+ (bad), <1.7 (elite) | Control indicator |

### 3. Edge Boost Logic

A +2 point boost is applied to edge scoring ONLY when:
- Zone Threat = **EXTREME** 
- Batter Barrel% ≥ 10% (above average power)
- Launch Angle 16-28° (optimal HR range)
- Park Factor ≥ 1.04 OR wind blowing out

## Implementation

### Data Requirements

The system requires these fields in the PropObject:

```typescript
// Pitcher data (populated by data pipeline)
pitcher_id: string
pitcher_name: string
pitcher_hr_per_9: number
pitcher_barrel_pct: number
pitcher_meatball_pct: number
pitcher_hittable_count_pct: number
pitcher_recent_hrs: number
pitcher_walk_rate: number

// Batter/conditions data
batter_barrel_pct: number
batter_launch_angle: number
park_factor: number
wind_out: boolean
```

### Usage Example

```typescript
// The system automatically integrates with existing edge scoring
const result = finalEdgeScore(prop, EDGE_CONFIG);

// For internal analysis only
const internalDetails = getInternalScoringDetails(prop);
console.log(internalDetails.zoneThreatAnalysis);
```

## Configuration & Tuning

### Current Thresholds (Tunable)

Located in `src/logic/zoneThreat.ts` - `ZONE_THREAT_CONFIG`:

```typescript
export const ZONE_THREAT_CONFIG = {
  hrPer9: { high: 1.8, extreme: 2.2 },
  barrelPercent: { high: 10, extreme: 12 },
  meatballPercent: { high: 7, extreme: 9 },
  hittableCountPct: { high: 28, extreme: 32 },
  recentHRs: { high: 4, extreme: 6 },
  walkRate: { poor: 4.0, elite: 1.7 },
  extremeThreshold: 5,    // Points needed for EXTREME
  moderateThreshold: 3,   // Points needed for MODERATE
  edgeBoost: 2           // Boost amount
};
```

### How to Tune Thresholds

1. **Collect Performance Data**: Track boost applications and outcomes over 2-4 weeks
2. **Analyze Results**: Calculate ROI and win rate for boosted props
3. **Adjust Thresholds**: 
   - If too many boosts → Raise thresholds
   - If too few boosts → Lower thresholds
   - If poor ROI → Tighten matchup requirements

### Recommended Tuning Process

```typescript
// 1. Enable detailed logging
EDGE_CONFIG.zoneThreat.logDecisions = true;

// 2. Monitor internal logs for boost frequency
// Target: 5-10% of eligible props should receive boost

// 3. Track outcomes and adjust monthly
// Example adjustments:
ZONE_THREAT_CONFIG.hrPer9.high = 1.9; // Tighten if too many boosts
ZONE_THREAT_CONFIG.edgeBoost = 3;     // Increase if ROI is strong
```

## Monitoring & Analysis

### Internal Logging

The system logs all boost decisions:
```
[ZONE THREAT BOOST] Prop prop_123: John Doe flagged EXTREME, boost +2
```

### Performance Metrics to Track

1. **Boost Frequency**: % of eligible props receiving boost
2. **Win Rate**: Success rate of boosted props
3. **ROI**: Return on investment for boosted props
4. **False Positives**: EXTREME pitchers who don't allow HRs

### Monthly Review Process

1. Generate Zone Threat summary reports
2. Compare boosted vs non-boosted prop performance
3. Identify pitcher profiles that consistently over/under-perform
4. Adjust thresholds based on empirical results

## Security & Privacy

### Internal Only Features

- Zone Threat boost is NOT exposed in public APIs
- Internal tags (zone-threat-extreme) are filtered from public responses
- Detailed analysis only available via `getInternalScoringDetails()`

### Public vs Internal Responses

```typescript
// Public response (via scorePropEdge)
{
  edge_score: 22,
  tier: "A", 
  context_tags: ["rocket"],  // No zone-threat tags
  edge_breakdown: { total: 22 } // No ZTR details
}

// Internal response (via getInternalScoringDetails)
{
  score: 22,
  tier: "A",
  tags: ["rocket", "zone-threat-extreme"],
  breakdown: { 
    zone_threat_boost: 2,
    zone_threat_level: "EXTREME"
  },
  zoneThreatAnalysis: {
    eligible: true,
    threatLevel: "EXTREME",
    boostApplied: 2,
    pitcherName: "John Doe"
  }
}
```

## Testing

### Unit Tests

Run comprehensive tests:
```bash
npm test src/logic/__tests__/zoneThreat.test.ts
```

### Test Coverage

- ✅ Elite control pitchers → CLEAN
- ✅ Average pitchers → CLEAN/MODERATE  
- ✅ High-risk pitchers → EXTREME
- ✅ Boost logic with various matchup conditions
- ✅ Edge cases and extreme values
- ✅ Performance with batch processing

### Sample Test Scenarios

```typescript
// Elite control pitcher (should be CLEAN)
const elitePitcher = {
  hrPer9: 0.8, barrelPercent: 6.5, meatballPercent: 3.2,
  hittableCountPct: 22, recentHRs: 1, walkRate: 1.5
};

// High-risk pitcher (should be EXTREME)
const riskPitcher = {
  hrPer9: 2.4, barrelPercent: 13.5, meatballPercent: 9.8,
  hittableCountPct: 34, recentHRs: 7, walkRate: 4.5
};
```

## Troubleshooting

### Common Issues

1. **No boosts being applied**
   - Check if `EDGE_CONFIG.zoneThreat.enabled = true`
   - Verify pitcher data is populated in props
   - Confirm market types are in eligible list

2. **Too many boosts**
   - Raise threshold values in `ZONE_THREAT_CONFIG`
   - Tighten matchup requirements
   - Reduce `edgeBoost` amount

3. **Poor performance of boosted props**
   - Review pitcher profiles that received boosts
   - Adjust specific metric thresholds
   - Consider additional matchup factors

### Debug Mode

Enable detailed logging:
```typescript
// In edge scoring
if (config.zoneThreat.logDecisions) {
  console.log('Zone Threat Analysis:', {
    pitcher: pitcherStats.name,
    threatLevel,
    boostApplied: zoneThreatBoost,
    matchupFavorable: zoneThreatBoost > 0
  });
}
```

## Future Enhancements

### Potential Improvements

1. **Machine Learning Integration**: Train models on historical boost outcomes
2. **Weather Factors**: Include temperature, humidity, wind speed
3. **Ballpark Dimensions**: Factor in specific park characteristics
4. **Pitcher Fatigue**: Consider pitch count, days rest
5. **Situational Context**: Inning, score differential, base runners

### Data Pipeline Enhancements

1. **Real-time Updates**: Stream pitcher stats during games
2. **Advanced Metrics**: Add spin rate, release point consistency
3. **Historical Trends**: Track pitcher performance vs specific batters
4. **Injury Reports**: Factor in pitcher health status

## Conclusion

The Zone Threat Rating system provides a sophisticated, internal-only edge for HR prop betting by identifying pitchers with poor control and location. The system is designed to be:

- **Profitable**: Target bottom 5% of pitchers for maximum edge
- **Tunable**: All thresholds can be adjusted based on results  
- **Secure**: No public exposure of proprietary analysis
- **Scalable**: Efficient processing for high-volume operations

Regular monitoring and tuning based on empirical results will maximize the system's profitability over time.