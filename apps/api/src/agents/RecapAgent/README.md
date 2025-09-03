# 📰 RecapAgent

The RecapAgent generates comprehensive daily and weekly recaps of betting
performance, market insights, and platform activity for user engagement and
analysis.

## 🎯 Purpose

Creates intelligent content summaries and recaps:

- Daily performance summaries and insights
- Weekly trend analysis and highlights
- Personalized user performance reports
- Market movement summaries
- Automated content generation for multiple channels

## 🏗️ Architecture

### Core Components

- **Recap Service**: Core recap generation engine
- **Embed Builder**: Rich media content creation
- **Content Formatter**: Multi-format content rendering
- **State Manager**: Recap generation state tracking
- **Distribution Manager**: Multi-channel content delivery

### Processing Flow

```
Data Collection → Analysis → Content Generation → Formatting → Distribution → State Update
```

## ⚙️ Configuration

```typescript
interface RecapAgentConfig extends BaseAgentConfig {
  generation: {
    dailyRecapTime: string; // Daily generation time (24h format)
    weeklyRecapDay: number; // Weekly recap day (0-6, Sunday=0)
    timezone: string; // Timezone for scheduling
    maxContentLength: number; // Maximum content length
  };
  content: {
    includeImages: boolean; // Include visual content
    includeCharts: boolean; // Include performance charts
    includeInsights: boolean; // Include AI-generated insights
    personalizeContent: boolean; // Enable user personalization
  };
  distribution: {
    channels: string[]; // Distribution channels
    formats: string[]; // Content formats
    autoPublish: boolean; // Automatic publishing
  };
}
```

## 📊 Recap Types

### Daily Recaps

- **Performance Summary**: Daily pick results and statistics
- **Market Highlights**: Significant market movements and opportunities
- **Top Performers**: Best picks and biggest wins
- **Trend Analysis**: Emerging patterns and insights
- **User Achievements**: Personal milestones and progress

### Weekly Recaps

- **Week in Review**: Comprehensive weekly performance analysis
- **Trend Deep Dive**: In-depth market trend analysis
- **Leaderboard Updates**: Contest and performance rankings
- **Strategy Insights**: Successful betting strategies and approaches
- **Community Highlights**: User achievements and social engagement

### Monthly Reports

- **Performance Analytics**: Comprehensive monthly performance review
- **Strategy Evolution**: How strategies performed over time
- **Market Analysis**: Monthly market trends and opportunities
- **ROI Analysis**: Return on investment insights and optimization
- **Goal Tracking**: Progress toward user-defined objectives

## 🚀 Usage

### Basic Recap Generation

```typescript
const recapAgent = new RecapAgent(config, dependencies);

// Generate daily recap
const dailyRecap = await recapAgent.generateDailyRecap({
  date: new Date(),
  userId: 'user123',
  includePersonalization: true,
});

// Generate weekly recap
const weeklyRecap = await recapAgent.generateWeeklyRecap({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-07'),
  format: 'discord',
});
```

### Integration with Workflows

```typescript
// In Temporal workflow
const recapResult = await proxyActivities<RecapActivities>({
  startToCloseTimeout: '15m',
  retry: { maximumAttempts: 3 },
}).generateAndDistributeRecap({
  type: 'daily',
  channels: ['discord', 'email', 'web'],
  personalized: true,
});
```

## 📝 Content Generation

### Performance Metrics Inclusion

```typescript
interface RecapMetrics {
  pickPerformance: {
    totalPicks: number; // Total picks analyzed
    winRate: number; // Overall win percentage
    avgOdds: number; // Average odds of picks
    roi: number; // Return on investment
    profitLoss: number; // Net profit/loss
  };

  tierBreakdown: {
    tier1: TierStats; // Elite tier performance
    tier2: TierStats; // Premium tier performance
    tier3: TierStats; // Standard tier performance
  };

  marketInsights: {
    hotSports: string[]; // Trending sports
    valueOpportunities: number; // High-value opportunities found
    lineMovements: number; // Significant line changes
  };
}
```

### Content Templates

- **Performance Summary**: Standardized performance reporting
- **Market Analysis**: Market trends and insights
- **User Journey**: Personal progress and achievements
- **Social Content**: Community engagement and highlights
- **Educational Content**: Tips, strategies, and learning opportunities

## 🎨 Embed Builder

### Rich Media Content

```typescript
interface EmbedContent {
  title: string; // Recap title
  description: string; // Main content description
  color: string; // Theme color
  thumbnail?: string; // Thumbnail image
  fields: EmbedField[]; // Structured data fields
  charts?: ChartData[]; // Performance charts
  footer: {
    text: string; // Footer information
    timestamp: Date; // Generation timestamp
  };
}
```

### Visual Components

- **Performance Charts**: Win rate, ROI, and trend visualizations
- **Infographics**: Key statistics and achievements
- **Heat Maps**: Activity and performance patterns
- **Progress Bars**: Goal achievement and progress tracking
- **Comparative Analysis**: Performance vs. benchmarks

## 📡 Multi-Channel Distribution

### Distribution Channels

- **Discord**: Rich embeds with interactive elements
- **Email**: Newsletter-style formatted content
- **Web Dashboard**: Interactive web-based recaps
- **Mobile Push**: Condensed mobile notifications
- **Social Media**: Shareable social content formats

### Format Optimization

```typescript
interface ChannelFormat {
  discord: {
    useEmbeds: boolean; // Rich embed formatting
    maxLength: 4000; // Discord character limit
    includeButtons: boolean; // Interactive buttons
  };

  email: {
    htmlTemplate: string; // Email HTML template
    plaintextFallback: boolean; // Plain text version
    includeImages: boolean; // Inline images
  };

  web: {
    responsive: boolean; // Responsive design
    interactive: boolean; // Interactive elements
    exportFormats: string[]; // Export options
  };
}
```

## 🔄 State Management

### Recap Generation State

```typescript
interface RecapState {
  id: string; // Unique recap identifier
  type: 'daily' | 'weekly' | 'monthly';
  status: 'pending' | 'generating' | 'completed' | 'error';
  progress: number; // Generation progress (0-100)
  startTime: Date; // Generation start time
  completedTime?: Date; // Completion timestamp
  metadata: {
    userCount: number; // Users included
    dataPoints: number; // Data points analyzed
    channels: string[]; // Distribution channels
  };
}
```

### Error Handling and Recovery

- **Partial Generation**: Handle incomplete data gracefully
- **Retry Logic**: Automatic retry for failed generations
- **Fallback Content**: Default content when data is unavailable
- **State Persistence**: Maintain state across restarts

## 📈 Performance Optimization

### Efficient Data Processing

- **Batch Processing**: Process multiple user recaps efficiently
- **Caching Strategy**: Cache frequently accessed data
- **Parallel Generation**: Generate multiple formats simultaneously
- **Resource Management**: Optimize memory and CPU usage

### Content Caching

```typescript
interface ContentCache {
  key: string; // Cache key
  content: RecapContent; // Cached content
  expiresAt: Date; // Expiration time
  metadata: {
    userId?: string; // User-specific cache
    type: string; // Recap type
    version: string; // Content version
  };
}
```

## 🧪 Testing

### Test Coverage

```bash
# Unit tests
npm test src/agents/RecapAgent

# Content generation tests
npm run test:recap-generation

# Distribution tests
npm run test:recap-distribution

# Performance tests
npm run test:recap-performance
```

### Test Scenarios

- Recap generation accuracy
- Multi-format content creation
- Distribution channel reliability
- Performance under load
- Error handling and recovery

## 🔧 Troubleshooting

### Common Issues

1. **Generation Timeouts**
   - Check data source availability
   - Monitor processing complexity
   - Adjust timeout settings

2. **Content Quality Issues**
   - Verify data accuracy
   - Review template formatting
   - Check personalization logic

3. **Distribution Failures**
   - Validate channel configurations
   - Check API rate limits
   - Monitor network connectivity

### Debug Commands

```bash
# Generate test recap
npm run recap:test-generation

# Validate content templates
npm run recap:validate-templates

# Check distribution channels
npm run recap:test-distribution
```

## 📊 Business Impact

### Key Performance Indicators

- **User Engagement**: Recap open and read rates
- **Content Quality**: User feedback and ratings
- **Distribution Reach**: Multi-channel delivery success
- **Personalization Effectiveness**: User-specific engagement

### Success Metrics

- > 80% recap open rate across all channels
- > 4.5/5 average user satisfaction rating
- <5% generation failure rate
- 95% on-time delivery across all channels

## 🔗 Integration Points

### Data Sources

- GradingAgent: Pick performance data
- AnalyticsAgent: Market insights and trends
- ContestAgent: Competition results and rankings
- User management: Personal preferences and settings

### Distribution Integrations

- Discord Bot: Rich embed delivery
- Email Service: Newsletter distribution
- Web Dashboard: Interactive recap display
- Push Notification Service: Mobile alerts

## 📝 Configuration Examples

### Production Configuration

```json
{
  "agentName": "RecapAgent",
  "enabled": true,
  "generation": {
    "dailyRecapTime": "08:00",
    "weeklyRecapDay": 1,
    "timezone": "America/New_York",
    "maxContentLength": 4000
  },
  "content": {
    "includeImages": true,
    "includeCharts": true,
    "personalizeContent": true
  },
  "distribution": {
    "channels": ["discord", "email", "web"],
    "autoPublish": true
  }
}
```

### Development Configuration

```json
{
  "agentName": "RecapAgent",
  "enabled": true,
  "generation": {
    "dailyRecapTime": "09:00",
    "maxContentLength": 2000
  },
  "distribution": {
    "channels": ["discord"],
    "autoPublish": false
  },
  "logLevel": "debug"
}
```
