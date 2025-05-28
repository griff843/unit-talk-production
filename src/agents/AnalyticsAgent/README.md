# AnalyticsAgent

The AnalyticsAgent is responsible for analyzing betting performance and generating insights for cappers on the Unit Talk platform.

## Features

- ROI analysis across multiple timeframes
- Trend detection and analysis
- Performance tracking by stat type
- Streak and volatility analysis
- Automated alerts for significant trends

## Configuration

```typescript
interface AnalyticsAgentConfig {
  // Base configuration
  agentName: 'AnalyticsAgent';
  enabled: boolean;
  version: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  metricsEnabled: boolean;

  // Analysis settings
  analysisConfig: {
    minPicksForAnalysis: number;
    roiTimeframes: number[];
    streakThreshold: number;
    trendWindowDays: number;
  };

  // Alert thresholds
  alertConfig: {
    roiAlertThreshold: number;
    streakAlertThreshold: number;
    volatilityThreshold: number;
  };

  // Metrics collection
  metricsConfig: {
    interval: number;
    prefix: string;
  };
}
```

## Database Tables

The agent interacts with the following Supabase tables:

- `final_picks`: Source of betting data
- `analytics_summary`: Overall performance metrics
- `roi_by_tier`: ROI analysis by capper tier
- `roi_by_ticket_type`: ROI analysis by ticket type

## Metrics

The agent collects the following metrics:

```typescript
interface AnalyticsMetrics {
  totalAnalyzed: number;
  capperCount: number;
  avgROI: number;
  profitableCappers: number;
  activeStreaks: number;
  processingTimeMs: number;
  errorCount: number;
  lastRunStats: {
    startTime: string;
    endTime: string;
    recordsProcessed: number;
  };
}
```

## Usage

```typescript
import { AnalyticsAgent } from './agents/AnalyticsAgent';

const agent = new AnalyticsAgent(config, supabase, errorConfig);
await agent.runAnalysis();
```

## Analysis Types

### ROI Analysis
- Calculates return on investment across configured timeframes
- Tracks win rates and profit/loss
- Segments by capper tier and ticket type

### Trend Analysis
- Detects winning and losing streaks
- Calculates edge volatility
- Assigns confidence scores to trends
- Monitors performance by stat type

### Performance Analysis
- Tracks best and worst performing stat types
- Calculates overall capper performance
- Monitors streak information

## Error Handling

The agent implements retry logic for:
- Network errors
- Supabase timeouts
- Rate limiting issues

## Best Practices

1. Configure appropriate thresholds for your use case
2. Monitor the error rate and processing time
3. Regularly validate the analysis results
4. Keep alert thresholds balanced to avoid noise
5. Use the metrics to tune performance

## Dependencies

- Supabase client
- Temporal workflow
- Base agent functionality
- Metrics collection
- Logging system 