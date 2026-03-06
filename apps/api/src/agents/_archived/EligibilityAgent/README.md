# 🎖️ EligibilityAgent (PromotionAgent)

_Recommended Rename: PromotionAgent → EligibilityAgent_

The EligibilityAgent promotes validated raw propositions to daily picks based on
scoring thresholds, quality metrics, and business rules.

## 🎯 Purpose

Manages the promotion pipeline from raw props to final picks:

- Raw proposition scoring and evaluation
- Quality threshold validation
- Business rule application for promotion eligibility
- Daily picks curation and selection
- Performance tracking and optimization

## 🏗️ Architecture

### Core Components

- **Scoring Evaluator**: Applies scoring logic to raw propositions
- **Quality Filter**: Validates proposition quality and reliability
- **Business Rules Engine**: Applies promotion criteria and constraints
- **Pick Curator**: Selects and organizes promoted picks
- **Performance Monitor**: Tracks promotion success rates

### Processing Flow

```
Raw Props → Scoring → Quality Check → Business Rules → Promotion → Daily Picks → Performance Tracking
```

## ⚙️ Configuration

```typescript
interface EligibilityAgentConfig extends BaseAgentConfig {
  scoring: {
    minimumScore: number; // Minimum score for promotion
    confidenceThreshold: number; // Required confidence level
    qualityWeights: QualityWeights; // Quality factor weights
    scoringModels: string[]; // Active scoring models
  };

  promotion: {
    maxDailyPicks: number; // Maximum picks per day
    tierDistribution: TierLimits; // Picks per tier limits
    diversityRules: DiversityConfig; // Sport/league diversity
    cooldownPeriods: CooldownConfig; // Time between promotions
  };

  validation: {
    requireLineValidation: boolean; // Validate betting lines
    requirePlayerValidation: boolean; // Validate player data
    requireGameValidation: boolean; // Validate game information
    allowManualOverride: boolean; // Manual promotion override
  };
}
```

## 📊 Scoring System

### Quality Metrics

```typescript
interface QualityMetrics {
  dataQuality: {
    completeness: number; // Data completeness score (0-1)
    accuracy: number; // Data accuracy score (0-1)
    freshness: number; // Data freshness score (0-1)
    reliability: number; // Source reliability score (0-1)
  };

  marketMetrics: {
    liquidity: number; // Market liquidity score
    movement: number; // Line movement stability
    consensus: number; // Market consensus score
    value: number; // Betting value score
  };

  performanceMetrics: {
    historicalAccuracy: number; // Historical prediction accuracy
    modelConfidence: number; // ML model confidence
    expertRating: number; // Expert analysis rating
    communityFeedback: number; // Community sentiment score
  };
}
```

### Promotion Thresholds

- **Tier 1 (Elite)**: Score ≥ 85, Confidence ≥ 90%
- **Tier 2 (Premium)**: Score ≥ 70, Confidence ≥ 80%
- **Tier 3 (Standard)**: Score ≥ 55, Confidence ≥ 70%
- **Tier 4 (Monitor)**: Score ≥ 40, Confidence ≥ 60%
- **Rejected**: Score < 40 or Confidence < 60%

## 🚀 Usage

### Basic Promotion Operations

```typescript
const eligibilityAgent = new EligibilityAgent(config, dependencies);

// Process raw props for promotion
const promotionResults = await eligibilityAgent.processBatch([
  rawProp1,
  rawProp2,
  rawProp3,
]);

// Promote individual prop
const promoted = await eligibilityAgent.promoteProp(rawProp, {
  overrideThreshold: false,
  validateMarket: true,
  checkDiversity: true,
});

// Get daily picks
const dailyPicks = await eligibilityAgent.getDailyPicks({
  date: new Date(),
  tiers: ['tier1', 'tier2', 'tier3'],
  maxCount: 50,
});
```

### Integration with Workflows

```typescript
// In Temporal workflow
const promotionResult = await proxyActivities<EligibilityActivities>({
  startToCloseTimeout: '15m',
  retry: { maximumAttempts: 3 },
}).promoteEligibleProps({
  batchSize: 100,
  applyDiversityRules: true,
  validateQuality: true,
});
```

## 🎯 Business Rules Engine

### Promotion Criteria

```typescript
interface PromotionRules {
  scoring: {
    minimumThresholds: TierThresholds; // Minimum scores per tier
    qualityGates: QualityGates; // Quality validation gates
    confidenceRequirements: ConfidenceConfig;
  };

  diversity: {
    maxPerSport: number; // Maximum picks per sport
    maxPerLeague: number; // Maximum picks per league
    maxPerPlayer: number; // Maximum picks per player
    maxPerGame: number; // Maximum picks per game
  };

  timing: {
    gameCutoff: number; // Hours before game start
    lineCutoff: number; // Hours for line validation
    cooldownBetweenPicks: number; // Hours between similar picks
  };

  volume: {
    dailyLimits: TierLimits; // Daily picks per tier
    weeklyLimits: TierLimits; // Weekly picks per tier
    maxPromotionRate: number; // Maximum promotion rate (%)
  };
}
```

### Rule Validation

- **Scoring Validation**: Minimum score and confidence requirements
- **Quality Validation**: Data quality and reliability checks
- **Diversity Validation**: Ensure pick variety across sports/leagues
- **Timing Validation**: Game start times and line freshness
- **Volume Validation**: Daily and weekly promotion limits

## 📈 Performance Tracking

### Promotion Metrics

```typescript
interface PromotionMetrics {
  processing: {
    totalProcessed: number; // Total raw props processed
    promotedCount: number; // Total promoted to daily picks
    rejectedCount: number; // Total rejected props
    promotionRate: number; // Overall promotion rate (%)
    avgProcessingTime: number; // Average processing time (ms)
  };

  quality: {
    scoringAccuracy: number; // Scoring prediction accuracy
    qualityValidation: number; // Quality check pass rate
    businessRulePass: number; // Business rule pass rate
    manualOverrides: number; // Manual override count
  };

  performance: {
    dailyPickSuccess: number; // Daily pick win rate
    tierPerformance: TierMetrics; // Performance by tier
    diversityAchieved: number; // Diversity rule compliance
    userSatisfaction: number; // User satisfaction score
  };
}
```

### Success Tracking

- **Win Rate Tracking**: Promoted pick success rates
- **Quality Correlation**: Quality scores vs. actual performance
- **User Engagement**: User interaction with promoted picks
- **Business Impact**: Revenue and retention impact
- **Model Accuracy**: Scoring model prediction accuracy

## 🔄 Promotion Pipeline

### Stage 1: Raw Prop Evaluation

```typescript
async function evaluateRawProp(rawProp: RawProp): Promise<EvaluationResult> {
  // Apply scoring logic
  const score = await applyScoringLogic(rawProp);

  // Validate data quality
  const quality = await validateQuality(rawProp);

  // Check business rules
  const rulesPass = await checkBusinessRules(rawProp);

  return {
    eligible: score.meets_threshold && quality.passes && rulesPass,
    score: score.value,
    confidence: score.confidence,
    tier: determineTier(score),
    reasons: [...score.reasons, ...quality.reasons, ...rulesPass.reasons],
  };
}
```

### Stage 2: Promotion Decision

- **Threshold Check**: Verify minimum scoring requirements
- **Quality Gate**: Ensure data quality standards
- **Diversity Check**: Maintain pick variety
- **Volume Check**: Respect daily/weekly limits
- **Final Validation**: Complete eligibility verification

### Stage 3: Daily Pick Creation

```typescript
interface DailyPick {
  id: string; // Unique pick identifier
  rawPropId: string; // Source raw prop ID
  tier: string; // Assigned tier
  score: number; // Promotion score
  confidence: number; // Confidence level
  sport: string; // Sport category
  league: string; // League identifier
  gameTime: Date; // Game start time
  player: string; // Player name
  statType: string; // Statistic type
  line: number; // Betting line
  prediction: 'over' | 'under'; // Pick direction
  reasoning: string[]; // Promotion reasoning
  promotedAt: Date; // Promotion timestamp
}
```

## 🔍 Quality Assurance

### Validation Checks

```typescript
interface ValidationSuite {
  dataValidation: {
    playerExists: boolean; // Player exists in database
    gameScheduled: boolean; // Game is properly scheduled
    lineCurrently: boolean; // Betting line is current
    statsAvailable: boolean; // Historical stats available
  };

  marketValidation: {
    lineMovement: boolean; // Acceptable line movement
    marketLiquidity: boolean; // Sufficient market liquidity
    oddsValidation: boolean; // Odds within normal ranges
    competitorPricing: boolean; // Competitive pricing check
  };

  riskValidation: {
    exposureCheck: boolean; // Risk exposure validation
    correlationCheck: boolean; // Correlation with other picks
    volumeCheck: boolean; // Volume risk assessment
    diversificationCheck: boolean; // Portfolio diversification
  };
}
```

### Error Handling

- **Data Inconsistencies**: Handle missing or conflicting data
- **Scoring Failures**: Fallback scoring mechanisms
- **Validation Errors**: Detailed error reporting and resolution
- **Performance Issues**: Performance optimization and monitoring
- **Business Rule Conflicts**: Rule priority and resolution

## 🧪 Testing

### Test Coverage

```bash
# Unit tests
npm test src/agents/EligibilityAgent

# Scoring logic tests
npm run test:scoring-logic

# Business rules tests
npm run test:business-rules

# Quality validation tests
npm run test:quality-validation

# Performance tests
npm run test:promotion-performance
```

### Test Scenarios

- Scoring accuracy and consistency
- Business rule application
- Quality validation effectiveness
- Promotion rate optimization
- Performance under load

## 🔧 Troubleshooting

### Common Issues

1. **Low Promotion Rates**
   - Review scoring thresholds
   - Check quality validation rules
   - Analyze business rule restrictions
   - Monitor data source quality

2. **Quality Issues**
   - Validate data source accuracy
   - Check scoring model performance
   - Review manual override usage
   - Monitor user feedback

3. **Performance Problems**
   - Optimize scoring algorithms
   - Check database query performance
   - Monitor processing queue depths
   - Review validation efficiency

### Debug Commands

```bash
# Promotion analysis
npm run eligibility:promotion-analysis

# Quality report
npm run eligibility:quality-report

# Performance metrics
npm run eligibility:performance-metrics

# Rule validation
npm run eligibility:validate-rules
```

## 📊 Business Impact

### Key Performance Indicators

- **Promotion Rate**: Percentage of raw props promoted
- **Pick Success Rate**: Win rate of promoted picks
- **Quality Score**: Average quality of promoted picks
- **User Satisfaction**: User feedback and engagement
- **Processing Efficiency**: Promotion pipeline performance

### Success Metrics

- 15-25% promotion rate from raw props to daily picks
- > 60% win rate for promoted picks across all tiers
- > 4.0/5.0 average quality score for promoted picks
- > 85% user satisfaction with daily pick quality
- <2 second average promotion processing time

## 🔗 Integration Points

### Data Sources

- IngestionAgent: Raw proposition data
- GradingAgent: Scoring and tier classification
- AnalyticsAgent: Performance and quality metrics
- Market data: Live odds and line movement

### Downstream Consumers

- FeedAgent: Daily pick content generation
- NotificationAgent: Pick alerts and notifications
- RecapAgent: Performance recap inclusion
- ContestAgent: Contest pick validation

## 📝 Configuration Examples

### Production Configuration

```json
{
  "agentName": "EligibilityAgent",
  "enabled": true,
  "scoring": {
    "minimumScore": 55,
    "confidenceThreshold": 0.7,
    "scoringModels": ["ensemble", "market", "statistical"]
  },
  "promotion": {
    "maxDailyPicks": 100,
    "tierDistribution": {
      "tier1": 10,
      "tier2": 20,
      "tier3": 35,
      "tier4": 35
    }
  },
  "validation": {
    "requireLineValidation": true,
    "requirePlayerValidation": true,
    "allowManualOverride": false
  }
}
```

### Development Configuration

```json
{
  "agentName": "EligibilityAgent",
  "enabled": true,
  "scoring": {
    "minimumScore": 40,
    "confidenceThreshold": 0.5
  },
  "promotion": {
    "maxDailyPicks": 20
  },
  "validation": {
    "requireLineValidation": false,
    "allowManualOverride": true
  },
  "logLevel": "debug"
}
```
