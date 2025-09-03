# Shadow Mode System Guide

## Overview

The Shadow Mode system enables the Unit Talk platform to run the complete grading → promotion → monitoring flow without publishing to public Discord channels. This allows for testing, analysis, and validation of the system behavior while collecting real data about "would-be" promotions.

## Key Features

- ✅ **Complete Flow Execution**: Full system runs without public side effects
- ✅ **Shadow Data Logging**: All decisions logged to dedicated shadow tables
- ✅ **Optional Preview**: Private Discord channel for shadow previews
- ✅ **Auto-Cleanup**: Configurable cleanup of old shadow data
- ✅ **Leak Prevention**: Zero public messages when shadow mode is enabled
- ✅ **Metrics Collection**: Shadow metrics snapshots for analysis
- ✅ **Auto-Learning Continuity**: Real behavior data collection continues

## Configuration

### Environment Variables

```bash
# Shadow mode control
SHADOW_MODE=false                            # true = shadow only, false = normal operation

# Optional: Private Discord channel for shadow previews  
SHADOW_PRIVATE_CHANNEL_ID=                   # Discord channel ID for shadow previews

# Cleanup configuration
SHADOW_MAX_DAYS=7                           # Auto-cleanup age in days (default: 7)
```

## Database Schema

### Shadow Tables

#### `shadow_promoted_picks`
```sql
CREATE TABLE shadow_promoted_picks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decided_action TEXT NOT NULL,              -- 'instant', 'queued-10am', 'rejected-gate', 'rejected-recheck'
    reasons JSONB,                             -- Array of decision reasons
    pick_id TEXT NOT NULL,                     -- Original pick ID
    prop_id TEXT,                             -- Prop ID
    tier TEXT,                                -- S, A, B, C
    confidence DECIMAL,                       -- 0.0 - 1.0
    expected_value DECIMAL,                   -- EV calculation
    player_name TEXT,                         -- Player name
    stat_type TEXT,                          -- points, rebounds, etc.
    line DECIMAL,                            -- Betting line
    sport TEXT,                              -- NBA, NFL, MLB, etc.
    professional_score INTEGER,              -- Professional grading score
    risk_score DECIMAL,                      -- Risk assessment
    clv_bps INTEGER,                         -- CLV in basis points
    steam_strength INTEGER,                  -- Steam detection strength
    correlation_risk TEXT,                   -- Portfolio correlation
    created_at TIMESTAMPTZ DEFAULT NOW()     -- Record creation time
);
```

#### `shadow_metrics_snapshots`
```sql
CREATE TABLE shadow_metrics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    window TEXT NOT NULL,                     -- '7d', '30d', 'lifetime'
    posted_ev DECIMAL,                        -- Posted expected value
    avg_confidence DECIMAL,                   -- Average confidence
    hit_rate DECIMAL,                        -- Success rate
    total_picks INTEGER,                     -- Total picks count
    s_tier_picks INTEGER,                    -- S-tier picks count
    avg_odds INTEGER,                        -- Average odds
    clv_bps DECIMAL,                        -- CLV performance in BPS
    roi DECIMAL,                            -- Return on investment
    created_at TIMESTAMPTZ DEFAULT NOW()    -- Snapshot time
);
```

## System Integration

### Service Integration Points

1. **PromotionGatekeeper**: Routes all promotion decisions through PublishGuard
2. **AutoRecheckService**: Shadow logs recheck decisions and actions
3. **PickMonitoringService**: Routes alerts through PublishGuard
4. **RollingMetricsService**: Writes shadow metrics snapshots
5. **AlertAgent**: Complete Discord leak prevention

### Data Flow in Shadow Mode

```
Pick Evaluation → Promotion Gates → PublishGuard → Shadow Logging
                                               → No Public Discord
                                               → Optional Shadow Preview
```

### Data Flow in Normal Mode

```
Pick Evaluation → Promotion Gates → PublishGuard → Public Discord Publishing
                                               → Normal Database Logging
```

## Usage Examples

### Enable Shadow Mode

```bash
# Set environment variable
export SHADOW_MODE=true

# Optional: Set private preview channel
export SHADOW_PRIVATE_CHANNEL_ID=1234567890

# Start services - all picks will be shadow logged
npm run start:dev
```

### Monitor Shadow Data

```sql
-- Check recent shadow promotions
SELECT 
    decided_action,
    tier,
    confidence,
    expected_value,
    player_name,
    reasons,
    created_at
FROM shadow_promoted_picks 
ORDER BY created_at DESC 
LIMIT 20;

-- Analyze shadow promotion patterns
SELECT 
    decided_action,
    COUNT(*) as count,
    AVG(confidence) as avg_confidence,
    AVG(expected_value) as avg_ev
FROM shadow_promoted_picks 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY decided_action;

-- Review shadow metrics
SELECT * FROM shadow_metrics_snapshots 
ORDER BY created_at DESC 
LIMIT 10;
```

### Validate Shadow Behavior

```bash
# Run comprehensive shadow mode tests
npm run test:shadow

# Run end-to-end shadow validation
npm run test:shadow-e2e

# Watch tests during development
npm run test:shadow-watch
```

## Testing

### Unit Tests

```bash
# Run all shadow mode tests
npm run test:shadow

# Run with coverage
npm run test:shadow-coverage

# Watch mode for development
npm run test:shadow-watch
```

### Integration Tests

```bash
# End-to-end shadow mode validation
npm run test:shadow-e2e
```

### Test Scenarios Covered

1. **S-Tier Instant Picks**: High confidence picks routed to shadow
2. **A-Tier Scheduled Picks**: Medium confidence picks queued for 10am
3. **Rejected Picks**: Low quality picks logged with rejection reasons
4. **Recheck Decisions**: Auto-recheck actions logged to shadow
5. **Alert Generation**: Monitoring alerts routed to shadow preview
6. **Metrics Collection**: Performance metrics snapshots
7. **Leak Prevention**: Zero public Discord messages
8. **Error Handling**: Graceful handling of shadow mode failures

## Monitoring and Analysis

### Key Metrics to Monitor

1. **Shadow Pick Volume**: Number of picks that would have been promoted
2. **Decision Distribution**: Breakdown by instant/scheduled/rejected
3. **Tier Performance**: Shadow performance by tier (S, A, B, C)
4. **Confidence Analysis**: Distribution of confidence scores
5. **Expected Value Trends**: EV analysis of shadow picks
6. **CLV Performance**: Closing line value of shadow picks

### Sample Analysis Queries

```sql
-- Daily shadow pick volume
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_picks,
    COUNT(*) FILTER (WHERE decided_action = 'instant') as instant_picks,
    COUNT(*) FILTER (WHERE decided_action = 'queued-10am') as scheduled_picks,
    COUNT(*) FILTER (WHERE decided_action LIKE 'rejected-%') as rejected_picks
FROM shadow_promoted_picks 
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Shadow pick performance by tier
SELECT 
    tier,
    COUNT(*) as picks,
    AVG(confidence) as avg_confidence,
    AVG(expected_value) as avg_ev,
    AVG(clv_bps) as avg_clv
FROM shadow_promoted_picks 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY tier
ORDER BY tier;

-- Most common rejection reasons
SELECT 
    reason,
    COUNT(*) as occurrences
FROM shadow_promoted_picks,
     LATERAL jsonb_array_elements_text(reasons) as reason
WHERE decided_action LIKE 'rejected-%'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY reason
ORDER BY occurrences DESC
LIMIT 10;
```

## Production Usage

### Deployment Process

1. **Enable Shadow Mode**: Set `SHADOW_MODE=true` in production environment
2. **Monitor Shadow Data**: Collect data for 48-72 hours
3. **Analyze Results**: Review shadow pick performance and patterns
4. **Validate System**: Ensure no public messages leaked during shadow mode
5. **Production Decision**: Based on analysis, proceed with live deployment

### Best Practices

1. **Limited Duration**: Use shadow mode for specific testing periods, not continuously
2. **Data Analysis**: Always analyze shadow data before making production changes
3. **Cleanup Management**: Ensure `SHADOW_MAX_DAYS` is set appropriately
4. **Monitoring Setup**: Set up alerts for shadow mode system health
5. **Documentation**: Document all shadow mode testing periods and results

### Troubleshooting

#### Common Issues

1. **Shadow Data Not Logging**:
   ```bash
   # Check shadow mode environment variable
   echo $SHADOW_MODE
   
   # Verify database connection
   npm run test:shadow
   
   # Check service logs
   docker logs unit-talk-api
   ```

2. **Discord Messages Still Appearing**:
   ```bash
   # Verify no service bypasses PublishGuard
   grep -r "sendDiscordAlert" src/
   
   # Run leak prevention tests
   npm run test:shadow -- --grep="leak prevention"
   ```

3. **Shadow Cleanup Not Working**:
   ```sql
   -- Check shadow data age
   SELECT MIN(created_at), MAX(created_at), COUNT(*) 
   FROM shadow_promoted_picks;
   
   -- Manual cleanup if needed
   DELETE FROM shadow_promoted_picks 
   WHERE created_at < NOW() - INTERVAL '7 days';
   ```

#### Debug Commands

```bash
# Test shadow mode detection
node -e "console.log('Shadow mode:', require('./src/shadow/ShadowMode').ShadowModeService.getInstance().isShadowMode())"

# Check shadow database tables
npm run db:validate:schema

# Run shadow mode health check
npm run test:shadow-e2e --scenario="health-check"
```

## Security Considerations

1. **No Sensitive Data**: Shadow mode logs the same data as normal operations
2. **Discord Leak Prevention**: Multiple layers prevent public Discord messages
3. **Database Access**: Shadow tables follow same access controls as production tables
4. **Environment Isolation**: Clear separation between shadow and production modes
5. **Audit Trail**: All shadow operations are logged for compliance

## Future Enhancements

### Planned Features

1. **A/B Testing**: Compare shadow mode results with actual production performance
2. **Advanced Analytics**: Machine learning analysis of shadow vs. actual outcomes
3. **Shadow Replay**: Ability to replay historical picks through current shadow mode
4. **Performance Benchmarking**: Automated comparison of shadow metrics vs. production
5. **Shadow Mode Scheduling**: Automated shadow mode periods for continuous validation

### API Extensions

1. **Shadow Mode API**: REST endpoints for managing shadow mode programmatically
2. **Analytics Dashboard**: Real-time shadow mode analytics and visualization  
3. **Shadow Webhooks**: Programmatic notifications for shadow mode events
4. **Export Utilities**: Automated export of shadow data for external analysis

---

## Quick Reference

### Essential Commands
```bash
# Enable shadow mode
export SHADOW_MODE=true

# Run shadow tests
npm run test:shadow

# End-to-end validation  
npm run test:shadow-e2e

# Monitor shadow data
npm run db:query -- "SELECT * FROM shadow_promoted_picks ORDER BY created_at DESC LIMIT 10"
```

### Key Files
- `src/shadow/ShadowMode.ts` - Core shadow mode service
- `src/promotion/PublishGuard.ts` - Central routing logic
- `migrations/003_shadow_mode_tables.sql` - Database schema
- `test/shadow-mode/` - Comprehensive test suite
- `scripts/test-shadow-mode.ts` - E2E validation script

### Environment Variables
- `SHADOW_MODE` - Enable/disable shadow mode
- `SHADOW_PRIVATE_CHANNEL_ID` - Optional private Discord channel
- `SHADOW_MAX_DAYS` - Auto-cleanup age in days