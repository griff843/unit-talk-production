# VIP Automation System

Backend automation system for Unit Talk's VIP/VIP+ Discord flows.

## Components

### 1. Curated Alert Aggregator (`curated-alert-aggregator.js`)
- Monitors upstream alert channels (#steam-alerts, #injury-shockwave, #hedge-lab)
- Applies filtering logic: Tier S OR (Tier A AND edge ≥12 AND confidence ≥88)
- Forwards qualifying alerts to #alerts-feed with @VIP ping (respects daily cap)
- Implements idempotency using embed footer `Idem` values
- Tracks daily VIP ping counts and resets at midnight

### 2. VIP+ Insight Mirror Bot (`vipplus-mirror-bot.js`)
- Monitors #vipplus-insights for new posts
- After configured delay (15 min prod, 1 min test), posts lite version to #trader-insights
- Strips sensitive details, keeps key bullet points
- Manages mirror queue with persistent state across restarts

### 3. Orchestrator (`index.js`)
- Runs both bots in parallel with auto-restart
- Graceful shutdown handling
- Status monitoring and logging
- Process management

## Quick Start

```bash
# Install dependencies
cd apps/vip-automation
npm install

# Start all bots
npm run start:all

# Or start individually
npm run start:aggregator
npm run start:mirror
```

## Docker

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f vip-automation
```

## Configuration

Set in root `.env`:

```env
# Test settings (prod uses 15 minutes, 3 pings)
TEST_DELAY_MINUTES=1
MAX_DAILY_PINGS=3

# Channel IDs
CHANNEL_STEAM_ID=1418224521818800188
CHANNEL_INJURY_ID=1418224567075340370
CHANNEL_HEDGE_ID=1418224620913426442
CHANNEL_CURATED_ID=1418224476004290620
CHANNEL_VIPPLUS_INSIGHTS_ID=1288613114815840466
CHANNEL_TRADER_INSIGHTS_ID=1356613995175481405

# Discord
DISCORD_TOKEN=your_bot_token
DISCORD_GUILD_ID=1284478946171293736
VIP_ROLE_IDS=1288831350710865972
```

## State Management

- `aggregator-state.json`: Tracks processed Idem keys and daily ping counts
- `mirror-state.json`: Manages pending mirror jobs across restarts

## Filtering Logic

### Curated Alerts
- **Tier S**: Always qualifies
- **Tier A**: Requires edge ≥12% AND confidence ≥88%
- **Freshness**: Must be ≤300 seconds
- **Idempotency**: Uses footer `Idem:` value to prevent duplicates

### VIP+ Mirroring
- **Delay**: 15 minutes (production) / 1 minute (testing)
- **Content**: Strips detailed analysis, keeps key actionable points
- **Scheduling**: Persistent queue survives bot restarts

## Monitoring

The system provides:
- Real-time console logging
- Health checks for Docker
- Auto-restart on failures
- Daily counter resets
- State persistence

## Testing

Use the VIP E2E test to validate:

```bash
node scripts/tests/vip_bot_e2e_test.js
```

Expected behavior:
- Curated PASS/FAIL filtering works correctly
- VIP ping capping respects daily limits
- Idempotency prevents duplicate forwards
- VIP+ mirrors arrive after configured delay

## Production Deployment

1. Set production values in `.env`:
   ```env
   TEST_DELAY_MINUTES=15
   MAX_DAILY_PINGS=3
   ```

2. Deploy via Docker:
   ```bash
   docker-compose up -d
   ```

3. Monitor logs:
   ```bash
   docker-compose logs -f vip-automation
   ```

## Troubleshooting

### Common Issues

1. **No curated alerts appearing**: Check bot permissions in alert channels
2. **VIP pings not working**: Verify VIP_ROLE_IDS and bot mention permissions
3. **Mirrors not appearing**: Ensure trader-insights channel ID is correct
4. **State not persisting**: Check file permissions in data directory

### Debug Mode

Set `LOG_LEVEL=debug` in environment for verbose logging.