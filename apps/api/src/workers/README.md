# Master Temporal Worker

This directory contains the master Temporal worker script that starts all agents
together.

## Usage

### Development

```bash
npm run agents:dev
```

This will start the master worker with all registered agents using the
`unit-talk-main` task queue.

### Production

```bash
NODE_ENV=production npm run agents:dev
```

## Agents Included

The master worker includes activities from the following agents:

- **BaseAgent** - Core agent functionality
- **AlertAgent** - Alert processing and notifications
- **AnalyticsAgent** - Data analytics and insights
- **AuditAgent** - Audit trail and compliance
- **ContestAgent** - Contest management
- **FeedAgent** - Data feed processing
- **GradingAgent** - Grading and evaluation
- **NotificationAgent** - User notifications
- **OperatorAgent** - Operator actions
- **PlayerEnrichmentAgent** - Player data enrichment
- **CampaignAgent** - Campaign management

## Configuration

The worker uses the following configuration:

- **Task Queue**: `unit-talk-main`
- **Max Concurrent Activities**: 100
- **Max Concurrent Workflows**: 100
- **Max Activities per Second**: 200

## Environment Variables

Ensure the following environment variables are set:

- `TEMPORAL_ADDRESS` - Temporal server address
- `TEMPORAL_NAMESPACE` - Temporal namespace
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)

## Logging

The worker provides comprehensive logging:

- Agent loading status
- Task processing information
- Error handling and recovery
- Graceful shutdown notifications

## Error Handling

The worker includes robust error handling:

- Uncaught exception handling
- Unhandled promise rejection handling
- Graceful shutdown on SIGINT/SIGTERM
- Circuit breaker integration for external services
