# 🏆 ContestAgent

The ContestAgent manages competitions, leaderboards, and contest-based
engagement features for the Unit Talk platform.

## 🎯 Purpose

Orchestrates competitive features and user engagement:

- Contest creation and management
- Real-time leaderboard tracking
- Prize pool distribution
- Fair play monitoring and enforcement
- Performance-based rankings and rewards

## 🏗️ Architecture

### Core Components

- **Contest Manager**: Creates and manages contest lifecycle
- **Leaderboard Engine**: Real-time ranking calculations
- **Fair Play Monitor**: Detects and prevents cheating
- **Prize Distributor**: Handles reward distribution
- **Performance Tracker**: Tracks user contest performance

### Processing Flow

```
Contest Creation → User Registration → Performance Tracking → Leaderboard Updates → Prize Distribution
```

## ⚙️ Configuration

```typescript
interface ContestAgentConfig extends BaseAgentConfig {
  contests: {
    maxActiveContests: number; // Maximum concurrent contests
    defaultDuration: number; // Default contest duration (hours)
    minParticipants: number; // Minimum participants to start
    maxParticipants: number; // Maximum contest capacity
  };
  leaderboards: {
    updateInterval: number; // Update frequency (ms)
    historyRetention: number; // History retention (days)
  };
  fairPlay: {
    enabled: boolean; // Enable fair play monitoring
    suspicionThreshold: number; // Threshold for suspicious activity
    autoSuspend: boolean; // Auto-suspend suspected accounts
  };
}
```

## 🏆 Contest Types

### Daily Contests

- **24-hour competitions** with rolling entry
- **Pick-based scoring** using tier-weighted points
- **Progressive prize pools** based on participation
- **Fair play monitoring** for competitive integrity

### Weekly Tournaments

- **7-day tournaments** with multiple scoring rounds
- **Leaderboard progression** throughout the week
- **Bonus multipliers** for consistent performance
- **Championship qualifications** for top performers

### Monthly Championships

- **Elite competitions** for qualified users
- **Higher stakes** with premium prize pools
- **Advanced analytics** and performance insights
- **Recognition and badges** for winners

## 📊 Scoring System

### Point Calculation

```typescript
interface ContestScoring {
  tierMultipliers: {
    tier1: 10; // Elite picks: 10x points
    tier2: 7; // Premium picks: 7x points
    tier3: 5; // Standard picks: 5x points
    tier4: 2; // Monitor picks: 2x points
  };
  bonusPoints: {
    winStreak: number; // Bonus for consecutive wins
    accuracy: number; // Accuracy bonus threshold
    volume: number; // Volume bonus for active participation
  };
}
```

### Leaderboard Metrics

- **Total Points**: Accumulated contest points
- **Win Rate**: Percentage of successful picks
- **Consistency**: Performance stability over time
- **Risk-Adjusted Returns**: ROI considering bet sizes
- **Participation**: Contest activity and engagement

## 🚀 Usage

### Basic Contest Management

```typescript
const contestAgent = new ContestAgent(config, dependencies);

// Create new contest
const contest = await contestAgent.createContest({
  name: 'Daily Elite Challenge',
  duration: 24,
  maxParticipants: 1000,
  prizePool: 5000,
});

// Register user for contest
await contestAgent.registerUser(userId, contestId);

// Update leaderboard
await contestAgent.updateLeaderboard(contestId);
```

### Integration with Workflows

```typescript
// In Temporal workflow
const contestResult = await proxyActivities<ContestActivities>({
  startToCloseTimeout: '10m',
  retry: { maximumAttempts: 3 },
}).processContestRound({
  contestId: 'daily-001',
  updateLeaderboards: true,
  distributePrizes: false,
});
```

## 🛡️ Fair Play System

### Detection Methods

- **Statistical Analysis**: Unusual win rate patterns
- **Behavioral Analysis**: Betting pattern anomalies
- **Network Analysis**: Account clustering detection
- **Temporal Analysis**: Timing pattern irregularities

### Fair Play Metrics

```typescript
interface FairPlayMetrics {
  suspiciousActivity: number; // Flagged activities count
  accountsSuspended: number; // Suspended accounts
  investigationsOpen: number; // Active investigations
  falsePositiveRate: number; // Detection accuracy
}
```

### Enforcement Actions

- **Warning System**: Progressive warnings for minor violations
- **Temporary Suspension**: Time-based account restrictions
- **Contest Exclusion**: Barring from specific contests
- **Permanent Ban**: Complete platform exclusion for severe violations

## 📈 Prize Distribution

### Prize Pool Management

```typescript
interface PrizePool {
  totalAmount: number; // Total prize money
  distribution: {
    first: number; // Winner percentage
    second: number; // Runner-up percentage
    third: number; // Third place percentage
    participation: number; // Participation rewards
  };
  currency: 'USD' | 'credits'; // Prize currency type
}
```

### Distribution Rules

- **Performance-based**: Rewards based on leaderboard position
- **Participation rewards**: Base rewards for all participants
- **Bonus multipliers**: Additional rewards for achievements
- **Fair distribution**: Ensures equitable prize allocation

## 🔄 Contest Lifecycle

### Pre-Contest Phase

1. **Contest Creation** - Define parameters and rules
2. **Registration Period** - User sign-up and preparation
3. **Rule Communication** - Clear contest guidelines
4. **System Preparation** - Technical setup and validation

### Active Contest Phase

1. **Performance Tracking** - Real-time score monitoring
2. **Leaderboard Updates** - Live ranking updates
3. **Fair Play Monitoring** - Continuous integrity checks
4. **User Engagement** - Progress notifications and updates

### Post-Contest Phase

1. **Final Scoring** - Complete performance calculation
2. **Prize Distribution** - Reward allocation and delivery
3. **Results Publication** - Winner announcements
4. **Performance Analysis** - Contest insights and feedback

## 🧪 Testing

### Test Coverage

```bash
# Unit tests
npm test src/agents/ContestAgent

# Contest simulation tests
npm run test:contest-simulation

# Fair play detection tests
npm run test:fairplay

# Performance tests
npm run test:contest-performance
```

### Test Scenarios

- Contest creation and management
- Leaderboard accuracy and updates
- Fair play detection effectiveness
- Prize distribution accuracy
- Performance under high load

## 🔧 Troubleshooting

### Common Issues

1. **Leaderboard Sync Issues**
   - Check database connectivity
   - Verify update interval settings
   - Monitor processing queue

2. **Fair Play False Positives**
   - Review detection thresholds
   - Analyze flagged patterns
   - Adjust sensitivity settings

3. **Prize Distribution Errors**
   - Verify calculation logic
   - Check payment gateway integration
   - Monitor transaction logs

### Debug Commands

```bash
# Contest health check
npm run contest:health

# Leaderboard validation
npm run contest:validate-leaderboards

# Fair play analysis
npm run contest:fairplay-report
```

## 📊 Business Impact

### Key Performance Indicators

- **User Engagement**: Contest participation rates
- **Retention**: User return rates for contests
- **Revenue Impact**: Contest-driven subscription increases
- **Fair Play**: Integrity maintenance and user trust

### Success Metrics

- > 70% user participation in daily contests
- <2% fair play violation rate
- > 90% user satisfaction with contest experience
- 15% increase in user retention through contests

## 🔗 Integration Points

### Data Sources

- GradingAgent: Pick performance data
- AnalyticsAgent: User behavior insights
- NotificationAgent: Contest updates and alerts
- User management: Account and subscription data

### External Integrations

- Payment processors for prize distribution
- Identity verification for fair play
- Analytics platforms for contest insights
- Communication channels for notifications

## 📝 Configuration Examples

### Production Configuration

```json
{
  "agentName": "ContestAgent",
  "enabled": true,
  "contests": {
    "maxActiveContests": 10,
    "defaultDuration": 24,
    "minParticipants": 10,
    "maxParticipants": 1000
  },
  "fairPlay": {
    "enabled": true,
    "suspicionThreshold": 0.8,
    "autoSuspend": false
  }
}
```

### Development Configuration

```json
{
  "agentName": "ContestAgent",
  "enabled": true,
  "contests": {
    "maxActiveContests": 3,
    "defaultDuration": 1,
    "minParticipants": 2
  },
  "logLevel": "debug"
}
```
