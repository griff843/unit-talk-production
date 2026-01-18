# Professional Pipeline Service

**Status**: ✅ Step 2 Complete - All 8 Features Extracted
**Phase**: 2 Step 3 (Professional Pipeline Modernization)
**Date**: 2025-01-29

## Overview

This service provides a modular, testable professional betting pipeline with 8 specialized features. It replaces the monolithic `SyndicateGradingEngine.calculateProfessionalInsights()` method with standalone feature modules orchestrated by `ProfessionalPipeline`.

## Architecture

```
ProfessionalPipeline (Orchestrator)
├─→ CrossMarketFeature (0.5% weight)
├─→ InjuryTimingFeature (1.0% weight)
├─→ MarketTimingFeature (1.0% weight)
├─→ OptimalTimingFeature (1.5% weight)
├─→ LineShoppingFeature (1.5% weight)
├─→ ClosingLinePredictionFeature (2.0% weight)
├─→ PublicVsSharpFeature (2.0% weight)
└─→ SteamDetectionFeature (2.5% weight)
```

## Files

- **`types.ts`**: Core interfaces and types
  - `ProfessionalFeature` - Common interface for all features
  - `ProfessionalContext` - Complete context with canonical IDs, CLV data, market data
  - `ProfessionalFeatureResult` - Standardized result format
  - `ProfessionalPipelineResult` - Aggregated pipeline result

- **`ProfessionalPipeline.ts`**: Central orchestrator
  - Coordinates execution of all features
  - Calculates weighted composite scores
  - Provides graceful degradation on errors
  - Supports parallel or sequential execution

- **`features/`**: Individual feature modules
  - Each feature is a standalone class implementing `ProfessionalFeature<T>`
  - Self-contained with own data structures
  - Can be tested in isolation
  - Can be used as Temporal Activities

## Usage

### Basic Usage

```typescript
import {
  ProfessionalPipeline,
  ProfessionalContext,
  SteamDetectionFeature,
  ClosingLinePredictionFeature,
  OptimalTimingFeature,
  LineShoppingFeature,
  PublicVsSharpFeature,
  MarketTimingFeature,
  InjuryTimingFeature,
  CrossMarketFeature,
} from './services/professional';

// Initialize pipeline with all features
const pipeline = new ProfessionalPipeline([
  new SteamDetectionFeature(),
  new ClosingLinePredictionFeature(),
  new OptimalTimingFeature(),
  new LineShoppingFeature(),
  new PublicVsSharpFeature(),
  new MarketTimingFeature(),
  new InjuryTimingFeature(),
  new CrossMarketFeature(),
]);

// Build context with canonical IDs and CLV data
const context: ProfessionalContext = {
  propId: 'prop_123',
  canonicalGameId: 'game_456',
  canonicalPlayerId: 'player_789',
  tenantId: 'tenant_1',
  league: 'NBA',
  statType: 'points',
  line: 25.5,
  overOdds: -110,
  underOdds: -110,
  playerName: 'LeBron James',
  team: 'LAL',
  opponent: 'GSW',
  gameDate: new Date('2025-01-30'),
  features: gradingFeatures,
  deviggingResult: {
    trueOverProbability: 0.52,
    trueUnderProbability: 0.48,
    fairLine: 25.3,
    vigPercentage: 4.5,
  },
  clvData: {
    trackingId: 'clv_123',
    submittedLine: 25.5,
    submittedOdds: -110,
    clvBps: 15, // 0.15% closing line value
  },
  hoursToGame: 18,
  submittedAt: new Date(),
};

// Execute pipeline
const result = await pipeline.execute(context);

console.log('Composite Score:', result.compositeScore);
console.log('Steam Detected:', result.insights.steamAnalysis?.hasSteam);
console.log('Predicted Closing Line:', result.insights.predictedClosingLine);
```

### Custom Configuration

```typescript
const pipeline = new ProfessionalPipeline(
  [
    new SteamDetectionFeature(),
    new ClosingLinePredictionFeature(),
    // ... other features
  ],
  {
    // Custom feature weights (override defaults)
    weights: {
      'steam-detection': 0.030, // Increase steam detection weight
      'closing-line-prediction': 0.025,
    },
    // Enable only specific features
    enabledFeatures: ['steam-detection', 'closing-line-prediction', 'optimal-timing'],
    // Enable parallel execution (default: false)
    parallel: false,
    // Graceful degradation on errors (default: true)
    gracefulDegradation: true,
  }
);
```

### Individual Feature Usage

```typescript
import { SteamDetectionFeature } from './services/professional/features';

const steamFeature = new SteamDetectionFeature();

// Check if feature can calculate with given context
if (steamFeature.canCalculate(context)) {
  const result = await steamFeature.calculate(context);

  console.log('Steam Detected:', result.data.hasSteam);
  console.log('Steam Direction:', result.data.steamDirection);
  console.log('Confidence:', result.confidence);
  console.log('Score:', result.score);
}
```

## Features

### 1. Steam Detection (2.5% weight)
**File**: `features/SteamDetectionFeature.ts`

Real-time steam move detection using:
- Significant line movement (>1.5 points)
- Volume spike (>150% average)
- Movement velocity (<5 minutes)

**Key Insights**: Sharp money entering market, follow opportunity

### 2. Closing Line Prediction (2.0% weight)
**File**: `features/ClosingLinePredictionFeature.ts`

ML-powered line closure forecasting using:
- Trend analysis (last 5 data points)
- Time decay factor
- Volume-weighted prediction

**Key Insights**: Predict final line to optimize CLV

### 3. Public vs Sharp Split (2.0% weight)
**File**: `features/PublicVsSharpFeature.ts`

Contrarian opportunity detection:
- Public >70% on one side
- Sharp <40% on same side
- Fade the public, follow sharp money

**Key Insights**: Maximum edge when divergence is greatest

### 4. Optimal Timing (1.5% weight)
**File**: `features/OptimalTimingFeature.ts`

Strategic bet placement timing:
- IMMEDIATE: Breaking news + <4hrs OR >24hrs
- MONITOR: 8-24 hours
- FINAL_CHECK: 2-8 hours
- AVOID: <2 hours (unless breaking news)

**Key Insights**: Early value capture or rapid news reaction

### 5. Line Shopping Edge (1.5% weight)
**File**: `features/LineShoppingFeature.ts`

Multi-book line comparison:
- Compare 15+ sportsbooks
- Find most favorable odds
- Calculate edge vs submitted line

**Key Insights**: 0.5 point difference = 2-3% win rate improvement

### 6. Market Timing Advantage (1.0% weight)
**File**: `features/MarketTimingFeature.ts`

Time-decay edge modeling:
- >24 hrs: 90% edge preservation (optimal)
- 8-24 hrs: 60% preservation (good)
- 2-8 hrs: 30% preservation (acceptable)
- <2 hrs: 10% preservation (poor)

**Key Insights**: Edge decreases as game approaches

### 7. Injury Timing Edge (1.0% weight)
**File**: `features/InjuryTimingFeature.ts`

Injury news timing advantage:
- >12 hrs: Early advantage (8/10 score)
- 4-12 hrs: Moderate advantage (6/10)
- <4 hrs: Late (3/10, lines adjusted)

**Key Insights**: Act before lines adjust to injury news

### 8. Cross Market Discrepancy (0.5% weight)
**File**: `features/CrossMarketFeature.ts`

Related prop arbitrage detection:
- Player points vs team total
- Rebounds vs double-double
- Correlation >70% threshold

**Key Insights**: Market inefficiency between correlated props

## Integration with Canonical Entities & CLV

The pipeline is fully integrated with Phase 2 canonical entities and CLV tracking:

```typescript
// Canonical IDs flow through context
context.canonicalGameId = rawProp.canonical_game_id;
context.canonicalPlayerId = rawProp.canonical_player_id;

// CLV data flows from tracking service
context.clvData = {
  trackingId: clvTracking.id,
  submittedLine: rawProp.line,
  submittedOdds: rawProp.overOdds,
  clvBps: clvTracking.clv_bps,
};

// Features can now use canonical IDs for cross-feed correlation
// Features can leverage CLV data for better predictions
```

## Testing

Each feature can be tested in isolation:

```typescript
import { SteamDetectionFeature } from './services/professional/features';

describe('SteamDetectionFeature', () => {
  it('should detect steam move with high confidence', async () => {
    const feature = new SteamDetectionFeature();

    const context: ProfessionalContext = {
      // ... context with line movement data
      marketData: {
        lineMovementHistory: new Map([
          ['prop_123', [
            { timestamp: Date.now() - 600000, line: 25.5, volume: 100 },
            { timestamp: Date.now() - 300000, line: 26.0, volume: 200 },
            { timestamp: Date.now(), line: 27.0, volume: 350 },
          ]],
        ]),
      },
    };

    const result = await feature.calculate(context);

    expect(result.data.hasSteam).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.data.steamDirection).toBe('over');
  });
});
```

## Temporal Integration

Each feature can be wrapped as a Temporal Activity:

```typescript
import { SteamDetectionFeature } from './services/professional';

export async function steamDetectionActivity(
  context: ProfessionalContext
): Promise<ProfessionalFeatureResult> {
  const feature = new SteamDetectionFeature();
  return await feature.calculate(context);
}
```

## Observability

Each feature execution includes:
- Calculation time metrics
- Confidence scores
- Detailed metadata for debugging

Pipeline provides aggregated metrics:
- Total duration
- Features executed/skipped/failed
- Composite score calculation

## Rollout Notes

### Production Deployment

The professional pipeline is controlled by the `USE_NEW_PROFESSIONAL_PIPELINE` feature flag, allowing safe, gradual rollout to production.

**Feature Flag**:
```bash
# Enable new modular pipeline
USE_NEW_PROFESSIONAL_PIPELINE=true

# Use legacy grading engine (default)
USE_NEW_PROFESSIONAL_PIPELINE=false
```

**Rollout Strategy**:
1. **Development/Test**: Validate functionality with test props
2. **Staging**: Performance testing with production-like volume
3. **Production Canary**: 10% traffic for initial validation
4. **Production Full**: 100% traffic after canary success

**Key Metrics to Monitor**:
- `professional_pipeline_duration_seconds` - Processing time (target: p95 < 2s)
- `professional_pipeline_composite_score` - Score distribution consistency
- `professional_pipeline_error_total` - Error rate (target: 0%)
- `professional_feature_skipped_total` - Data availability issues
- `professional_clv_available_total` - CLV tracking health

**Validation**:
```bash
# Run comparison script to validate consistency
npx tsx scripts/compare_professional_pipelines.ts --limit=1000

# Expected: <5% average score variance vs legacy system
```

**Emergency Rollback**:
```bash
# Disable feature flag immediately
export USE_NEW_PROFESSIONAL_PIPELINE=false

# Restart API service
kubectl rollout restart deployment/api -n production
```

**Complete Rollout Guide**: See `docs/runbooks/professional_pipeline_rollout.md` for detailed instructions, metrics references, and troubleshooting procedures.

**Expected Outcomes**:
- ✅ Zero scoring regression (<5% variance)
- ✅ Performance maintained (p95 < 2 seconds)
- ✅ Enhanced observability (11 Prometheus metrics)
- ✅ Temporal-ready architecture for Phase 3
- ✅ Improved testability and maintainability

## Next Steps

- [ ] **Step 3**: Create unit tests for all features (80%+ coverage)
- [ ] **Step 4**: Add Prometheus metrics for monitoring
- [ ] **Step 5**: Prepare features for Temporal Activities
- [ ] **Step 6**: Update ProfessionalPropProcessor to use new pipeline
- [ ] **Step 7**: Validate zero regression against historical props
- [ ] **Step 8**: Complete documentation and summary

## References

- **Design Doc**: `docs/modernization/phase2_prof_pipeline.md`
- **Original Implementation**: `src/agents/GradingAgent/scoring/gradingEngine.ts`
- **Phase 2 Canonical Entities**: `docs/modernization/phase2_canonical_entities.md`
- **CLV Tracking**: `src/services/clv/CLVTrackingService.ts`
