# 🎯 CampaignAgent (PromoAgent)

_Recommended Rename: PromoAgent → CampaignAgent_

The CampaignAgent manages promotional campaigns, discount structures, and
special offers for user acquisition and retention.

## 🎯 Purpose

Manages promotional campaign operations:

- Discount and promotion campaign creation
- BOGO (Buy One Get One) offer management
- Seasonal and event-based promotions
- User eligibility and qualification management
- Promotion code generation and validation

## 🏗️ Architecture

### Core Components

- **Campaign Creator**: Designs and configures promotional campaigns
- **Eligibility Engine**: Determines user qualification for promotions
- **Code Generator**: Creates and manages promotional codes
- **Usage Tracker**: Monitors promotion usage and effectiveness
- **Reward Calculator**: Calculates discounts and promotional values

### Processing Flow

```
Campaign Creation → Eligibility Check → Code Generation → User Application → Usage Tracking → Performance Analysis
```

## ⚙️ Configuration

```typescript
interface CampaignAgentConfig extends BaseAgentConfig {
  campaigns: {
    maxActivePromos: number; // Maximum concurrent promotions
    defaultDuration: number; // Default promotion duration (days)
    allowStacking: boolean; // Allow multiple promotions per user
    autoExpiry: boolean; // Automatic promotion expiry
  };

  eligibility: {
    userTierRestrictions: boolean; // Tier-based eligibility
    usageHistoryCheck: boolean; // Check previous usage
    geographicRestrictions: boolean; // Location-based restrictions
    subscriptionRequirements: boolean; // Subscription-based eligibility
  };

  codes: {
    autoGenerate: boolean; // Auto-generate promotion codes
    codeLength: number; // Promotional code length
    expiryTracking: boolean; // Track code expiry
    usageLimit: number; // Max uses per code
  };
}
```

## 🎁 Promotion Types

### Discount Promotions

- **Percentage Discounts**: 10%, 20%, 50% off subscriptions
- **Fixed Amount Discounts**: $5, $10, $25 off purchases
- **Tiered Discounts**: Increasing discounts based on spend
- **First-Time User Discounts**: New customer incentives
- **Loyalty Discounts**: Repeat customer rewards

### BOGO Offers

- **Buy One Get One Free**: Classic BOGO promotions
- **Buy One Get One Half Off**: Partial discount on second item
- **Buy X Get Y Free**: Volume-based promotions
- **Upgrade Promotions**: Free tier upgrades with purchase
- **Extended Access**: Additional months/features with subscription

### Time-Limited Offers

- **Flash Sales**: Short-duration high-discount promotions
- **Weekend Specials**: Time-specific promotional offers
- **Holiday Promotions**: Seasonal and holiday campaigns
- **Event-Based Offers**: Promotions tied to sports events
- **Limited-Time Features**: Temporary feature access

## 🚀 Usage

### Campaign Management

```typescript
const campaignAgent = new CampaignAgent(config, dependencies);

// Create percentage discount campaign
const discountCampaign = await campaignAgent.createCampaign({
  name: 'Summer Sale 2024',
  type: 'percentage',
  value: 30,
  startDate: '2024-06-01',
  endDate: '2024-08-31',
  conditions: {
    minAmount: 50,
    maxUses: 1000,
    eligibleProducts: ['premium', 'elite'],
  },
});

// Create BOGO campaign
const bogoCampaign = await campaignAgent.createCampaign({
  name: 'BOGO Premium',
  type: 'bogo',
  value: 1,
  conditions: {
    eligibleProducts: ['premium'],
  },
});

// Check user eligibility
const eligible = await campaignAgent.checkEligibility(userId, campaignId);
```

### Integration with Workflows

```typescript
// In Temporal workflow
const campaignResult = await proxyActivities<CampaignActivities>({
  startToCloseTimeout: '10m',
  retry: { maximumAttempts: 3 },
}).applyCampaignToUser({
  userId: 'user123',
  campaignId: 'summer-sale-2024',
  validateEligibility: true,
});
```

## 🎫 Promotional Code System

### Code Generation

```typescript
interface PromotionalCode {
  code: string; // Unique promotional code
  campaignId: string; // Associated campaign
  type: 'single' | 'multi'; // Single or multi-use code
  maxUses: number; // Maximum usage count
  currentUses: number; // Current usage count
  expiryDate: Date; // Code expiration date
  active: boolean; // Code active status
}
```

### Code Categories

- **Universal Codes**: Available to all users (SUMMER30)
- **Targeted Codes**: Specific user or segment codes
- **Single-Use Codes**: One-time use promotional codes
- **Referral Codes**: User-generated referral codes
- **Partner Codes**: Third-party partnership codes

### Code Validation

```typescript
interface CodeValidation {
  isValid: boolean; // Code validity status
  reason?: string; // Validation failure reason
  discount: {
    type: 'percentage' | 'fixed';
    value: number;
    maxDiscount?: number; // Maximum discount amount
  };
  restrictions: {
    products: string[]; // Eligible products
    minAmount?: number; // Minimum purchase amount
    userTier?: string; // Required user tier
  };
}
```

## 📊 Eligibility Management

### User Qualification Criteria

```typescript
interface EligibilityRules {
  userTier: {
    required?: string[]; // Required user tiers
    excluded?: string[]; // Excluded user tiers
  };

  subscription: {
    hasActive: boolean; // Requires active subscription
    planTypes: string[]; // Eligible subscription plans
    duration?: number; // Minimum subscription duration
  };

  usage: {
    isNewUser: boolean; // New user requirement
    maxPreviousUses: number; // Maximum previous promotion usage
    excludeFrequentUsers: boolean; // Exclude frequent promotion users
  };

  geographic: {
    includedRegions: string[]; // Included geographic regions
    excludedRegions: string[]; // Excluded geographic regions
  };
}
```

### Dynamic Eligibility

- **Real-time Validation**: Live eligibility checking
- **Behavior-Based**: Eligibility based on user behavior
- **Time-Sensitive**: Time-based eligibility windows
- **Progressive**: Eligibility that changes over time
- **Conditional**: Multi-factor eligibility requirements

## 📈 Campaign Performance Tracking

### Usage Analytics

```typescript
interface CampaignMetrics {
  usage: {
    totalApplications: number; // Total promotion applications
    uniqueUsers: number; // Unique users who used promotion
    conversionRate: number; // Application to purchase conversion
    averageOrderValue: number; // Average order value with promotion
  };

  financial: {
    totalDiscount: number; // Total discount amount given
    revenueImpact: number; // Revenue impact (positive/negative)
    costPerAcquisition: number; // Cost per new customer acquired
    roi: number; // Return on investment
  };

  performance: {
    dailyUsage: Record<string, number>; // Daily usage patterns
    peakUsageTimes: string[]; // Peak usage time periods
    dropOffPoints: string[]; // Where users abandon promotion
  };
}
```

### A/B Testing Integration

- **Promotion Variants**: Test different discount amounts
- **Code Format Testing**: Test different code formats
- **Eligibility Rules**: Test different eligibility criteria
- **Duration Testing**: Test different campaign durations
- **Channel Testing**: Test different distribution channels

## 🔄 Campaign Lifecycle

### Pre-Launch Phase

1. **Campaign Design** - Define promotion structure and rules
2. **Eligibility Setup** - Configure user qualification criteria
3. **Code Generation** - Create promotional codes if needed
4. **Testing** - Validate campaign logic and eligibility
5. **Approval** - Business approval for campaign launch

### Active Campaign Phase

1. **Monitoring** - Real-time usage and performance tracking
2. **Optimization** - Adjust parameters based on performance
3. **Support** - Handle user questions and issues
4. **Fraud Detection** - Monitor for abuse and fraudulent usage
5. **Reporting** - Regular performance reporting

### Post-Campaign Phase

1. **Final Analytics** - Complete performance analysis
2. **ROI Calculation** - Calculate return on investment
3. **User Impact** - Analyze long-term user behavior impact
4. **Lessons Learned** - Document insights for future campaigns
5. **Data Archival** - Archive campaign data for historical analysis

## 🛡️ Fraud Prevention

### Anti-Abuse Measures

```typescript
interface FraudPrevention {
  detection: {
    duplicateAccounts: boolean; // Detect duplicate accounts
    unusualUsage: boolean; // Flag unusual usage patterns
    velocityChecks: boolean; // Rate limiting checks
    deviceFingerprinting: boolean; // Device-based detection
  };

  prevention: {
    cooldownPeriods: number; // Time between promotion uses
    maxUsesPerUser: number; // Maximum uses per user
    requireVerification: boolean; // Email/phone verification
    manualReview: boolean; // Manual review for high-value promotions
  };
}
```

### Monitoring and Alerts

- **Usage Anomalies**: Unusual promotion usage patterns
- **Code Sharing**: Promotional code sharing detection
- **Account Abuse**: Multiple accounts per user detection
- **Bot Detection**: Automated usage detection
- **Financial Impact**: High-cost promotion usage alerts

## 🧪 Testing

### Test Coverage

```bash
# Unit tests
npm test src/agents/CampaignAgent

# Promotion logic tests
npm run test:promotion-logic

# Eligibility engine tests
npm run test:eligibility

# Code generation tests
npm run test:code-generation

# Performance tests
npm run test:campaign-performance
```

### Test Scenarios

- Campaign creation and configuration
- Eligibility rule validation
- Promotional code generation and validation
- Usage tracking accuracy
- Fraud prevention effectiveness

## 🔧 Troubleshooting

### Common Issues

1. **Eligibility Problems**
   - Review qualification criteria
   - Check user data accuracy
   - Verify tier and subscription status
   - Monitor geographic restrictions

2. **Code Issues**
   - Verify code generation logic
   - Check expiry date handling
   - Monitor usage limit enforcement
   - Validate code format requirements

3. **Performance Issues**
   - Monitor campaign usage patterns
   - Check database query performance
   - Optimize eligibility checking
   - Review fraud prevention impact

### Debug Commands

```bash
# Campaign status check
npm run campaign:status

# Eligibility testing
npm run campaign:test-eligibility

# Code validation
npm run campaign:validate-codes

# Performance analysis
npm run campaign:performance-report
```

## 📊 Business Impact

### Key Performance Indicators

- **Conversion Rate**: Promotion to purchase conversion
- **Customer Acquisition Cost**: Cost per new customer acquired
- **Average Order Value**: Impact on purchase amounts
- **User Retention**: Long-term retention of promoted users
- **ROI**: Return on promotional investment

### Success Metrics

- > 25% conversion rate for targeted promotions
- <$30 customer acquisition cost through promotions
- > 15% increase in average order value
- > 70% retention rate for promotion users after 90 days
- > 200% ROI on promotional campaigns

## 🔗 Integration Points

### Data Sources

- User management: User profiles and subscription data
- AnalyticsAgent: User behavior and engagement metrics
- MarketingAgent: Campaign coordination and attribution
- Payment systems: Purchase and subscription data

### External Integrations

- Payment processors for discount application
- Email marketing for promotion distribution
- CRM systems for customer data
- Analytics platforms for performance tracking
- Fraud detection services for abuse prevention

## 📝 Configuration Examples

### Production Configuration

```json
{
  "agentName": "CampaignAgent",
  "enabled": true,
  "campaigns": {
    "maxActivePromos": 15,
    "defaultDuration": 30,
    "allowStacking": false,
    "autoExpiry": true
  },
  "eligibility": {
    "userTierRestrictions": true,
    "usageHistoryCheck": true,
    "geographicRestrictions": false
  },
  "codes": {
    "autoGenerate": true,
    "codeLength": 8,
    "usageLimit": 1
  }
}
```

### Development Configuration

```json
{
  "agentName": "CampaignAgent",
  "enabled": true,
  "campaigns": {
    "maxActivePromos": 5,
    "defaultDuration": 7,
    "allowStacking": true
  },
  "eligibility": {
    "userTierRestrictions": false,
    "usageHistoryCheck": false
  },
  "logLevel": "debug"
}
```
