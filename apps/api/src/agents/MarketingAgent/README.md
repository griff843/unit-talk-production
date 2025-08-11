# 📢 MarketingAgent

The MarketingAgent manages comprehensive marketing campaigns, user acquisition,
engagement strategies, and referral programs for the Unit Talk platform.

## 🎯 Purpose

Orchestrates marketing operations and user growth:

- Marketing campaign creation and management
- User acquisition and retention strategies
- Referral program automation
- Engagement tracking and optimization
- A/B testing and conversion optimization

## 🏗️ Architecture

### Core Components

- **Campaign Manager**: Creates and manages marketing campaigns
- **Engagement Engine**: Tracks and optimizes user engagement
- **Referral System**: Manages referral programs and rewards
- **Analytics Tracker**: Measures campaign performance and ROI
- **A/B Testing Framework**: Tests marketing strategies and content

### Processing Flow

```
Campaign Planning → Audience Targeting → Content Creation → Distribution → Performance Tracking → Optimization
```

## ⚙️ Configuration

```typescript
interface MarketingAgentConfig extends BaseAgentConfig {
  campaigns: {
    maxActiveCampaigns: number; // Maximum concurrent campaigns
    defaultDuration: number; // Default campaign duration (days)
    budgetLimits: BudgetConfig; // Budget constraints
    autoOptimization: boolean; // Enable automatic optimization
  };
  engagement: {
    trackingEnabled: boolean; // Enable engagement tracking
    retentionThreshold: number; // Retention rate threshold
    engagementGoals: EngagementGoals;
  };
  referrals: {
    enabled: boolean; // Enable referral program
    rewardStructure: RewardConfig; // Referral reward structure
    trackingPeriod: number; // Tracking period (days)
  };
}
```

## 📊 Campaign Types

### User Acquisition Campaigns

- **New User Onboarding**: Welcome sequences and initial engagement
- **Paid Advertising**: Social media and search advertising campaigns
- **Content Marketing**: Educational content and value proposition
- **Influencer Partnerships**: Collaboration with sports personalities
- **SEO Optimization**: Organic search visibility improvement

### Retention Campaigns

- **Re-engagement**: Win-back campaigns for inactive users
- **Loyalty Programs**: Reward programs for active users
- **Milestone Celebrations**: Achievement-based engagement
- **Seasonal Promotions**: Holiday and event-based campaigns
- **Product Updates**: Feature announcements and education

### Referral Campaigns

- **Friend Referral**: User-to-user referral programs
- **Social Sharing**: Social media sharing incentives
- **Affiliate Program**: Partner-based referral system
- **Influencer Referrals**: Content creator partnership programs
- **Corporate Partnerships**: B2B referral relationships

## 🚀 Usage

### Campaign Management

```typescript
const marketingAgent = new MarketingAgent(config, dependencies);

// Create new campaign
const campaign = await marketingAgent.createCampaign({
  name: 'Elite Tier Promotion',
  type: 'retention',
  duration: 30,
  targetAudience: 'premium_users',
  budget: 5000,
});

// Track campaign performance
const performance = await marketingAgent.getCampaignPerformance(campaignId);

// Optimize campaign based on results
await marketingAgent.optimizeCampaign(campaignId, {
  adjustBudget: true,
  refineTargeting: true,
  updateContent: false,
});
```

### Integration with Workflows

```typescript
// In Temporal workflow
const campaignResult = await proxyActivities<MarketingActivities>({
  startToCloseTimeout: '20m',
  retry: { maximumAttempts: 3 },
}).executeMarketingCampaign({
  campaignId: 'summer-promo-2024',
  channels: ['email', 'discord', 'push'],
  personalization: true,
});
```

## 📈 Engagement Tracking

### User Engagement Metrics

```typescript
interface EngagementMetrics {
  acquisition: {
    newUsers: number; // New user signups
    sources: Record<string, number>; // Traffic sources
    conversionRate: number; // Signup conversion rate
    cost: number; // Customer acquisition cost
  };

  retention: {
    dayOneRetention: number; // Day 1 retention rate
    weekOneRetention: number; // Week 1 retention rate
    monthlyRetention: number; // Monthly retention rate
    churnRate: number; // User churn rate
  };

  engagement: {
    dailyActiveUsers: number; // Daily active users
    sessionDuration: number; // Average session duration
    pagesPerSession: number; // Pages viewed per session
    interactionRate: number; // User interaction rate
  };
}
```

### Behavioral Segmentation

- **High-Value Users**: Premium subscribers and active participants
- **At-Risk Users**: Declining engagement patterns
- **New Users**: Recent signups requiring onboarding
- **Dormant Users**: Inactive users requiring re-engagement
- **Champions**: High engagement and referral activity

## 🎁 Referral Program Management

### Referral System Architecture

```typescript
interface ReferralProgram {
  structure: {
    referrerReward: number; // Reward for referrer
    refereeReward: number; // Reward for new user
    tierMultipliers: TierConfig; // Tier-based multipliers
    cappedRewards: boolean; // Reward caps enabled
  };

  tracking: {
    attributionWindow: number; // Attribution window (days)
    requiredActions: string[]; // Actions required for reward
    minimumActivity: ActivityConfig;
  };

  validation: {
    preventFraud: boolean; // Anti-fraud measures
    verificationRequired: boolean; // Email/phone verification
    coolingPeriod: number; // Time between referrals
  };
}
```

### Referral Tracking

- **Attribution Tracking**: Multi-touch attribution modeling
- **Conversion Tracking**: Referral-to-conversion analytics
- **Fraud Prevention**: Suspicious activity detection
- **Reward Distribution**: Automated reward processing
- **Performance Analytics**: Referral program effectiveness

## 🧪 A/B Testing Framework

### Testing Capabilities

```typescript
interface ABTest {
  name: string; // Test identifier
  variants: {
    control: TestVariant; // Control group
    treatment: TestVariant[]; // Treatment variants
  };
  metrics: {
    primary: string; // Primary success metric
    secondary: string[]; // Secondary metrics
  };
  allocation: {
    trafficSplit: number[]; // Traffic allocation per variant
    minimumSampleSize: number; // Statistical significance requirement
  };
  duration: {
    startDate: Date; // Test start date
    endDate: Date; // Test end date
    minRuntime: number; // Minimum test duration
  };
}
```

### Testing Scenarios

- **Subject Line Optimization**: Email marketing subject lines
- **Landing Page Variants**: Conversion page optimization
- **Onboarding Flows**: User onboarding sequence testing
- **Pricing Strategies**: Subscription pricing optimization
- **Feature Announcements**: Communication strategy testing

## 📊 Performance Analytics

### Campaign ROI Tracking

```typescript
interface CampaignROI {
  investment: {
    totalSpend: number; // Total campaign investment
    channelBreakdown: Record<string, number>;
    timeBreakdown: Record<string, number>;
  };

  returns: {
    newRevenue: number; // Revenue from new users
    retainedRevenue: number; // Revenue from retained users
    lifetimeValue: number; // Customer lifetime value
  };

  metrics: {
    roi: number; // Return on investment
    paybackPeriod: number; // Customer payback period
    marginContribution: number; // Profit margin contribution
  };
}
```

### Attribution Modeling

- **First-Touch Attribution**: Credit to first interaction
- **Last-Touch Attribution**: Credit to final interaction
- **Multi-Touch Attribution**: Credit distributed across touches
- **Time-Decay Attribution**: Weighted by recency
- **Position-Based Attribution**: Weighted by position in funnel

## 🔄 Automation Features

### Automated Campaigns

- **Welcome Series**: Automated new user onboarding
- **Abandoned Cart**: Re-engagement for incomplete actions
- **Win-Back**: Automated dormant user campaigns
- **Milestone Triggers**: Achievement-based campaigns
- **Behavioral Triggers**: Action-based campaign activation

### Smart Optimization

```typescript
interface AutoOptimization {
  budget: {
    reallocateSpend: boolean; // Automatic budget reallocation
    pauseUnderperforming: boolean; // Pause poor performers
    scaleWinners: boolean; // Scale successful campaigns
  };

  targeting: {
    lookalikeModealing: boolean; // Create lookalike audiences
    behavioralUpdates: boolean; // Update based on behavior
    excludeConverted: boolean; // Exclude converted users
  };

  content: {
    dynamicContent: boolean; // Dynamic content optimization
    personalizedMessaging: boolean; // Personalized communications
    testWinningVariants: boolean; // Promote winning A/B tests
  };
}
```

## 🧪 Testing

### Test Coverage

```bash
# Unit tests
npm test src/agents/MarketingAgent

# Campaign management tests
npm run test:campaigns

# Referral system tests
npm run test:referrals

# A/B testing framework tests
npm run test:ab-testing

# Performance tests
npm run test:marketing-performance
```

### Test Scenarios

- Campaign creation and management
- Referral tracking accuracy
- A/B test statistical validity
- Performance analytics accuracy
- Automation trigger reliability

## 🔧 Troubleshooting

### Common Issues

1. **Campaign Performance Issues**
   - Review targeting parameters
   - Check budget spend patterns
   - Analyze conversion funnel
   - Optimize creative content

2. **Referral Tracking Problems**
   - Verify attribution logic
   - Check reward distribution
   - Monitor fraud detection
   - Validate tracking codes

3. **A/B Test Validity Issues**
   - Ensure statistical significance
   - Check sample size requirements
   - Verify random allocation
   - Monitor external factors

### Debug Commands

```bash
# Campaign health check
npm run marketing:campaigns-status

# Referral system validation
npm run marketing:referrals-check

# A/B test analysis
npm run marketing:ab-test-analysis

# Performance dashboard
npm run marketing:performance-dashboard
```

## 📊 Business Impact

### Key Performance Indicators

- **Customer Acquisition Cost (CAC)**: Cost to acquire new users
- **Customer Lifetime Value (CLV)**: Long-term user value
- **Return on Marketing Investment (ROMI)**: Marketing ROI
- **User Retention Rate**: User retention across time periods
- **Referral Conversion Rate**: Referral program effectiveness

### Success Metrics

- CAC < $50 for premium user acquisition
- CLV:CAC ratio > 3:1 for sustainable growth
- ROMI > 300% for all marketing campaigns
- Monthly user retention > 80%
- Referral conversion rate > 15%

## 🔗 Integration Points

### Data Sources

- AnalyticsAgent: User behavior and engagement data
- ContestAgent: Competition engagement metrics
- NotificationAgent: Communication effectiveness data
- User management: Demographics and preferences

### External Integrations

- Email marketing platforms (Mailchimp, SendGrid)
- Social media advertising (Facebook, Google Ads)
- Analytics platforms (Google Analytics, Mixpanel)
- CRM systems (Salesforce, HubSpot)
- Attribution platforms (Branch, Adjust)

## 📝 Configuration Examples

### Production Configuration

```json
{
  "agentName": "MarketingAgent",
  "enabled": true,
  "campaigns": {
    "maxActiveCampaigns": 20,
    "defaultDuration": 30,
    "autoOptimization": true
  },
  "engagement": {
    "trackingEnabled": true,
    "retentionThreshold": 0.7
  },
  "referrals": {
    "enabled": true,
    "trackingPeriod": 30
  }
}
```

### Development Configuration

```json
{
  "agentName": "MarketingAgent",
  "enabled": true,
  "campaigns": {
    "maxActiveCampaigns": 5,
    "defaultDuration": 7
  },
  "referrals": {
    "enabled": false
  },
  "logLevel": "debug"
}
```
