# NotificationAgent

The NotificationAgent is a centralized notification service that handles all outbound communications in the Unit Talk platform. It supports multiple channels, handles retries, and provides delivery guarantees.

## Features

- Multi-channel notification support
- Retry logic with exponential backoff
- Channel failover
- Delivery tracking and metrics
- Priority-based routing
- PII handling and redaction
- Rate limiting per channel

## Configuration

### Environment Variables

```env
NOTIFICATION_ENABLED=true
NOTIFICATION_METRICS_INTERVAL=60000
NOTIFICATION_METRICS_PREFIX=notification
NOTIFICATION_MAX_RETRIES=3

# Discord Configuration
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
DISCORD_ENABLED=true

# Notion Configuration
NOTION_API_KEY=secret_...
NOTION_DATABASE_ID=...
NOTION_ENABLED=true

# Email Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=notifications@unittalk.com
SMTP_PASS=secret
EMAIL_ENABLED=true

# SMS Configuration
SMS_PROVIDER=twilio
SMS_API_KEY=...
SMS_ENABLED=true
```

### Agent Config

```typescript
interface NotificationAgentConfig {
  agentName: 'NotificationAgent';
  enabled: boolean;
  metricsConfig: {
    interval: number;
    prefix: string;
  };
  channels: {
    discord?: {
      webhookUrl: string;
      enabled: boolean;
    };
    notion?: {
      apiKey: string;
      databaseId: string;
      enabled: boolean;
    };
    email?: {
      smtpConfig: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
          user: string;
          pass: string;
        };
      };
      enabled: boolean;
    };
    sms?: {
      provider: string;
      apiKey: string;
      enabled: boolean;
    };
  };
}
```

## Metrics

### Standard Metrics
- `notification_sent_total`: Total notifications sent
- `notification_success_rate`: Success rate percentage
- `notification_error_rate`: Error rate percentage
- `notification_retry_rate`: Retry rate percentage

### Channel Metrics
- `notification_channel_latency`: Average latency per channel
- `notification_channel_errors`: Error count per channel
- `notification_channel_success`: Success count per channel
- `notification_channel_retry`: Retry count per channel

### Queue Metrics
- `notification_queue_size`: Current queue size
- `notification_queue_latency`: Queue processing latency
- `notification_queue_age`: Age of oldest queued notification

## Health Checks

The agent performs the following health checks:

1. Channel Connectivity
   - Discord webhook availability
   - Notion API status
   - SMTP server connectivity
   - SMS provider status

2. Database Connectivity
   - Notification log table access
   - Queue table access

3. Resource Usage
   - Queue size monitoring
   - Rate limit status
   - Channel quotas

## Failure Modes

### Channel Failures
- **Symptom**: Cannot send to specific channel
- **Impact**: Messages queued for retry
- **Recovery**: Automatic failover to alternative channels
- **Escalation**: Alert after 3 retry failures

### Rate Limiting
- **Symptom**: Too many requests error
- **Impact**: Delayed message delivery
- **Recovery**: Exponential backoff
- **Escalation**: Spread load across channels

### Database Failures
- **Symptom**: Cannot log notifications
- **Impact**: Delivery tracking affected
- **Recovery**: In-memory queue with periodic flush
- **Escalation**: Alert on queue size threshold

## Usage

### Sending Notifications

```typescript
const result = await notificationAgent.sendNotification({
  type: 'system',
  message: 'System maintenance scheduled',
  channels: ['discord', 'email'],
  priority: 'high'
});
```

### Channel-Specific Options

```typescript
const result = await notificationAgent.sendNotification({
  type: 'onboarding',
  message: 'Welcome to Unit Talk!',
  channels: ['email'],
  priority: 'low',
  meta: {
    email: {
      template: 'welcome',
      attachments: ['welcome.pdf']
    }
  }
});
```

### Handling Failures

```typescript
try {
  await notificationAgent.sendNotification({...});
} catch (error) {
  if (error instanceof NotificationError) {
    console.error(`Failed channels: ${error.failedChannels}`);
    console.error(`Successful channels: ${error.successfulChannels}`);
  }
}
```

## Testing

Run the test suite:

```bash
npm test src/agents/NotificationAgent
```

### Test Coverage

- Unit tests: 95%
- Integration tests: 90%
- E2E tests: 75%

## Dependencies

- Discord API
- Notion API
- SMTP server
- SMS provider API
- Supabase

## Contributing

1. Check existing issues or create a new one
2. Fork the repository
3. Create a feature branch
4. Add tests for new functionality
5. Submit a pull request

## Troubleshooting

Common issues and solutions:

1. Failed Deliveries
   - Check channel configurations
   - Verify API keys and credentials
   - Review rate limits
   - Check error logs

2. High Latency
   - Monitor queue size
   - Check channel health
   - Review rate limits
   - Consider channel scaling

3. Missing Notifications
   - Check notification logs
   - Verify channel status
   - Review retry queue
   - Check failover settings 