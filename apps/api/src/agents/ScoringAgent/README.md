# 📊 ScoringAgent

The ScoringAgent is the core business intelligence engine that scores and evaluates
sports betting picks using advanced machine learning models and market analysis.

## 🎯 Purpose

Evaluates betting propositions using:

- Multi-model ensemble scoring
- Market resistance analysis
- Risk assessment and position sizing
- Performance tracking and optimization
- Automated tier classification

## 🏗️ Architecture

### Core Components

- **SyndicateGradingEngine**: Multi-model ensemble scoring
- **PerformanceAnalyzer**: Historical performance tracking
- **RiskManager**: Portfolio risk assessment and position sizing
- **Batch Processor**: Efficient bulk processing capabilities

### Processing Flow

```
Pick Submission → Feature Extraction → Model Ensemble → Risk Analysis → Tier Assignment → Final Grade
```

## ⚙️ Configuration

```typescript
interface ScoringAgentConfig extends BaseAgentConfig {
  batchSize: number; // Default: 50
  batchTimeoutMs: number; // Default: 30000
  maxRetries: number; // Default: 3
  confidenceThreshold: number; // Default: 0.7
  tierThresholds: TierConfig; // Tier classification thresholds
}
```

### Risk Configuration

```typescript
interface RiskConfig {
  maxPositionSize: 0.05; // 5% max position
  maxCorrelation: 0.7; // 70% max correlation
  maxDrawdown: 0.2; // 20% max drawdown
  minSharpeRatio: 1.0; // Minimum Sharpe ratio
  kellyMultiplier: 0.25; // Kelly criterion multiplier
}
```

## 📊 Metrics

### Performance Metrics

```typescript
interface ScoringMetrics {
  picksProcessed: number; // Total picks processed
  picksGraded: number; // Successfully graded picks
  avgGradingTimeMs: number; // Average processing time
  tierDistribution: object; // Distribution across tiers
  avgConfidence: number; // Average confidence score
  promotedToFinal: number; // Picks promoted to final
  throughputPerMinute: number; // Processing throughput
}
```

## 🎚️ Tier System

### Tier Classifications

- **Tier 1 (Elite)**: >85% confidence, highest expected value
- **Tier 2 (Premium)**: 70-85% confidence, high expected value
- **Tier 3 (Standard)**: 55-70% confidence, positive expected value
- **Tier 4 (Monitor)**: 40-55% confidence, neutral expected value
- **Rejected**: <40% confidence, negative expected value

## 🚀 Usage

### Basic Usage

```typescript
const scoringAgent = new ScoringAgent(config, dependencies);

// Score a single pick
const result = await scoringAgent.scorePick(pick);

// Batch process multiple picks
const results = await scoringAgent.processBatch(picks);
```

### Integration with Workflows

```typescript
// In Temporal workflow
const scoringResult = await proxyActivities<ScoringActivities>({
  startToCloseTimeout: '5m',
  retry: { maximumAttempts: 3 },
}).scoreAndPromotePicks(picks);
```

## 🔄 Processing Pipeline

### 1. Feature Extraction

- Player statistics and trends
- Market conditions and line movement
- Historical performance data
- Weather and injury reports
- Public betting percentages

### 2. Model Ensemble

- Machine learning models (XGBoost, Neural Networks)
- Statistical models (Poisson, Monte Carlo)
- Market resistance algorithms
- Expert system rules

### 3. Risk Assessment

- Portfolio correlation analysis
- Position sizing optimization
- Drawdown protection
- Kelly criterion application

### 4. Quality Control

- Confidence scoring
- Outlier detection
- Historical validation
- Performance tracking

## 📈 Performance Optimization

### Batch Processing

- Configurable batch sizes (default: 50)
- Timeout protection (30 seconds)
- Parallel model execution
- Efficient memory management

### Caching Strategy

- Model prediction caching
- Feature computation caching
- Market data caching
- Historical lookup optimization

## 🚨 Error Handling

### Retry Logic

- Exponential backoff retry
- Circuit breaker pattern
- Graceful degradation
- Error categorization

### Monitoring

- Health check endpoints
- Prometheus metrics
- Alert thresholds
- Performance tracking

## 🧪 Testing

### Test Coverage

```bash
# Unit tests
npm test src/agents/ScoringAgent

# Integration tests
npm run test:integration -- --grep "ScoringAgent"

# Performance tests
npm run test:performance -- --agent=scoring
```

### Test Data

- Historical pick samples
- Market condition scenarios
- Edge case validation
- Performance benchmarks

## 🔧 Troubleshooting

### Common Issues

1. **Slow Processing**: Check batch size and timeout settings
2. **Low Confidence Scores**: Verify feature data quality
3. **High Memory Usage**: Monitor batch processing efficiency
4. **Model Errors**: Check model file integrity and versions

### Debug Commands

```bash
# Agent health check
npm run agents:test -- --agent=scoring

# Performance analysis
npm run scripts:performance -- --focus=scoring

# Batch processing test
npm run test:scoring-batch
```

## 📊 Business Impact

### Key Performance Indicators

- **Accuracy**: Pick win rate vs. predicted confidence
- **ROI**: Return on investment across all tiers
- **Sharp Ratio**: Risk-adjusted returns
- **Max Drawdown**: Worst losing streak performance
- **Volume**: Daily processing capacity

### Success Metrics

- Tier 1 picks: >65% win rate
- Overall ROI: >8% monthly
- Processing time: <500ms per pick
- Uptime: >99.9% availability

## 🔗 Dependencies

### Internal Dependencies

- BaseAgent framework
- Supabase database
- Redis caching
- Temporal workflows

### External Dependencies

- Sports data APIs
- Market data feeds
- Machine learning models
- Feature engineering pipeline

## 📝 Configuration Examples

### Production Configuration

```json
{
  "agentName": "ScoringAgent"
  "enabled": true,
  "batchSize": 100,
  "confidenceThreshold": 0.75,
  "tierThresholds": {
    "tier1": 0.85,
    "tier2": 0.7,
    "tier3": 0.55,
    "tier4": 0.4
  }
}
```

### Development Configuration

```json
{
  "agentName": "ScoringAgent"
  "enabled": true,
  "batchSize": 10,
  "confidenceThreshold": 0.6,
  "logLevel": "debug"
}
```
