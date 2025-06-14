# RecapAgent Production Deployment Guide

## Overview
The RecapAgent automatically generates and posts daily, weekly, and monthly performance recaps to Discord, matching the exact format shown in your examples.

## Environment Variables Required

```bash
# Discord Configuration
DISCORD_RECAP_WEBHOOK=https://discord.com/api/webhooks/your-webhook-url

# Supabase Configuration  
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# Optional: Force specific recap type for testing
FORCE_RECAP_TYPE=daily|weekly|monthly|all

# Node Environment
NODE_ENV=production
```

## Deployment Steps

### 1. Install Dependencies
```bash
npm install discord.js
```

### 2. Database Setup
Ensure your Supabase database has the required tables:
- `final_picks` - Main picks table
- `unit_talk_alerts_log` - For tracking processed picks
- Required fields: `outcome`, `units`, `profit_loss`, `capper`, `parlay_id`, etc.

### 3. Discord Webhook Setup
1. Go to your Discord server settings
2. Navigate to Integrations > Webhooks
3. Create a new webhook for the recap channel
4. Copy the webhook URL to `DISCORD_RECAP_WEBHOOK`

### 4. Schedule Configuration
The RecapAgent runs automatically at:
- **Daily**: 9:00 AM every day
- **Weekly**: 10:00 AM every Monday  
- **Monthly**: 11:00 AM on the 1st of each month

### 5. Manual Testing
```bash
# Test daily recap
npm run test:recap daily

# Test weekly recap  
npm run test:recap weekly

# Test monthly recap
npm run test:recap monthly
```

## Production Monitoring

### Health Checks
The agent provides health check endpoints:
```bash
GET /health - Overall agent health
GET /metrics - Performance metrics
```

### Metrics Tracked
- `recapsSent` - Total recaps sent successfully
- `recapsFailed` - Total failed recap attempts
- `avgProcessingTimeMs` - Average processing time
- `dailyRecaps` - Count of daily recaps sent
- `weeklyRecaps` - Count of weekly recaps sent  
- `monthlyRecaps` - Count of monthly recaps sent

### Logging
All operations are logged with structured JSON:
```json
{
  "timestamp": "2025-01-27T10:00:00Z",
  "level": "info",
  "message": "Daily recap sent successfully",
  "agent": "RecapAgent",
  "recapType": "daily",
  "picksProcessed": 15,
  "netUnits": 2.5
}
```

## Troubleshooting

### Common Issues

1. **No picks found for recap**
   - Check if picks exist in database for the date range
   - Verify `play_status` and `outcome` fields are populated

2. **Discord webhook errors**
   - Verify webhook URL is correct and active
   - Check Discord server permissions

3. **Database connection issues**
   - Verify Supabase credentials
   - Check network connectivity

### Debug Mode
Set `FORCE_RECAP_TYPE=all` to test all recap types manually.

## Customization

### Modifying Embed Format
Edit `src/agents/RecapAgent/recapFormatter.ts` to customize:
- Colors and styling
- Field layouts
- Emoji usage
- Footer text

### Adjusting Schedule
Modify the `RECAP_SCHEDULE` object in `src/agents/RecapAgent/index.ts`:
```typescript
private readonly RECAP_SCHEDULE = {
  daily: '0 9 * * *',    // 9 AM daily
  weekly: '0 10 * * 1',  // 10 AM Monday  
  monthly: '0 11 1 * *'  // 11 AM 1st of month
};
```

### Adding New Recap Types
1. Add new method to `RecapService`
2. Create formatter method in `RecapFormatter`
3. Add trigger method to main `RecapAgent` class

## Performance Optimization

### Database Queries
- Indexes on `created_at`, `play_status`, `outcome` fields
- Consider partitioning large tables by date

### Memory Usage
- Process recaps in batches for large datasets
- Implement pagination for monthly recaps

### Rate Limiting
- Discord webhooks: 30 requests per minute
- Built-in rate limiting in the agent

## Security Considerations

### Environment Variables
- Store sensitive credentials in secure environment
- Use secrets management in production

### Database Access
- Use read-only database user for recap queries
- Implement proper error handling for database failures

### Discord Webhooks
- Rotate webhook URLs periodically
- Monitor for unauthorized usage

## Monitoring and Alerts

### Set up alerts for:
- Failed recap attempts
- Database connection issues
- Discord webhook failures
- Processing time anomalies

### Recommended monitoring tools:
- Prometheus for metrics collection
- Grafana for visualization
- PagerDuty for alerting

## Backup and Recovery

### Data Backup
- Regular Supabase database backups
- Export recap configurations

### Recovery Procedures
- Manual recap triggers for missed periods
- Database restoration procedures
- Webhook reconfiguration steps