# PR7: Incident Routing + Ops Digest

## Overview

PR7 implements a comprehensive incident routing system that broadcasts SLO incidents to Discord and optionally logs them to Notion. It also includes a weekly ops digest feature for summarizing operational health.

**Branch**: `feat/pr7-incident-routing`

## Features

### 1. Incident Routing
- Real-time SLO incident notifications to Discord
- Optional Notion logging for incident tracking
- Idempotent delivery with deduplication
- Cooldown per incident_key and slo_id (no spam)
- Full traceability with correlation_id, incident_key, slo_id, environment

### 2. Discord Integration
- Fortune-100 quality Discord embeds
- Color-coded severity (red = critical, orange = warning, green = resolved)
- Automatic role escalation for critical incidents
- Message caching for status update edits
- Rate limiting (2 seconds between messages)
- Retry with exponential backoff

### 3. Notion Logging
- Page creation per incident
- Status updates on ACK/RESOLVE
- Rate limit handling
- Retry with exponential backoff

### 4. Weekly Ops Digest
- Scheduled Monday 9:00 AM America/New_York
- Incident summary (total, critical, warning, open, acknowledged, resolved)
- Top noisy SLOs
- Timing metrics (avg/median time to ack/resolve)
- SLO health summary
- Evaluation health

## Configuration

### Environment Variables

All features are **disabled by default**. Enable via environment variables:

```bash
# Feature Flags (ALL default OFF)
OPS_DISCORD_ALERTS_ENABLED=false      # Enable Discord incident alerts
OPS_NOTION_LOGGING_ENABLED=false      # Enable Notion incident logging
OPS_DIGEST_ENABLED=false              # Enable weekly digest

# Discord Configuration
OPS_DISCORD_CHANNEL_ID=               # Discord channel for ops alerts
OPS_DISCORD_ESCALATION_ROLE_ID=       # Role to ping for critical incidents
OPS_DIGEST_CHANNEL_ID=                # Channel for weekly digest (defaults to OPS_DISCORD_CHANNEL_ID)

# Notion Configuration
NOTION_API_KEY=                       # Notion integration API key
OPS_NOTION_DATABASE_ID=               # Notion database for incident logging

# Worker Configuration
OPS_NOTIFICATION_WORKER_ENABLED=false # Enable the notification worker
OPS_POLL_INTERVAL_MS=60000            # Polling interval (default 60 seconds)

# Rate Limiting
OPS_NOTIFICATION_COOLDOWN_MINUTES=15  # Cooldown between notifications for same incident
OPS_NOTIFICATION_MAX_PER_HOUR=20      # Maximum notifications per hour

# Digest Schedule
OPS_DIGEST_CRON=0 9 * * 1             # Cron expression (default: Monday 9 AM)
OPS_DIGEST_TIMEZONE=America/New_York  # Timezone for digest schedule

# General
COMMAND_CENTER_URL=                   # URL for Command Center links in embeds
```

## Database Schema

### Tables (ops schema)

#### `ops.incident_notifications`
Tracks all sent notifications with idempotency.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| incident_key | VARCHAR(255) | Incident identifier |
| slo_id | UUID | SLO identifier |
| destination | VARCHAR(50) | discord, notion, etc. |
| message_id | VARCHAR(255) | External message ID |
| correlation_id | UUID | Request correlation |
| payload | JSONB | Notification payload |
| payload_hash | VARCHAR(64) | SHA256 of payload |
| severity | VARCHAR(20) | warning, critical |
| incident_status | VARCHAR(20) | open, acknowledged, resolved |
| routing_reason | VARCHAR(100) | Why notification was sent |
| sent_at | TIMESTAMPTZ | When sent |
| created_at | TIMESTAMPTZ | Record creation |

**Unique Constraint**: `(incident_key, destination)` - prevents duplicate notifications

#### `ops.notification_prefs`
Stores notification preferences per channel.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| channel_id | VARCHAR(255) | Discord channel ID |
| enabled | BOOLEAN | Whether notifications enabled |
| min_severity | VARCHAR(20) | Minimum severity to notify |
| cooldown_minutes | INT | Override cooldown |
| created_at | TIMESTAMPTZ | Record creation |
| updated_at | TIMESTAMPTZ | Last update |

#### `ops.notification_cursor`
Tracks polling position for idempotency.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(50) | Cursor identifier |
| last_processed_at | TIMESTAMPTZ | Last poll time |
| run_count | INT | Number of poll runs |
| updated_at | TIMESTAMPTZ | Last update |

#### `ops.digest_history`
Stores generated digest records.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| period_start | TIMESTAMPTZ | Digest period start |
| period_end | TIMESTAMPTZ | Digest period end |
| digest_data | JSONB | Full digest data |
| discord_message_id | VARCHAR(255) | Discord message ID |
| correlation_id | UUID | Request correlation |
| generated_at | TIMESTAMPTZ | Generation time |
| sent_at | TIMESTAMPTZ | Delivery time |

### Functions

#### `should_send_notification(p_incident_key, p_slo_id, p_destination)`
Checks if notification should be sent (cooldown + deduplication).

Returns:
- `should_send` (BOOLEAN): Whether to send
- `reason` (TEXT): Why decision was made
- `existing_message_id` (TEXT): If updating existing notification

#### `record_notification_sent(...)`
Records that a notification was sent. Handles upsert for idempotency.

#### `get_incidents_pending_notification(p_destination, p_limit)`
Gets incidents that need notification.

#### `get_weekly_digest_data(p_period_start, p_period_end)`
Aggregates data for weekly digest.

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    OpsNotificationWorker                        │
│  - Orchestrates polling and routing                             │
│  - Manages component lifecycle                                  │
│  - Provides status endpoints                                    │
└─────────────────────────────────────────────────────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│OpsIncidentRouter│   │OpsDigestScheduler│   │                 │
│                 │   │                 │   │   Health/Status │
│ - Poll incidents│   │ - Weekly cron   │   │   Endpoints     │
│ - Route to dests│   │ - Aggregate data│   │                 │
│ - Dedupe/cooldown│  │ - Send digest   │   │                 │
└─────────────────┘   └─────────────────┘   └─────────────────┘
            │                    │
            ▼                    ▼
┌─────────────────┐   ┌─────────────────┐
│OpsDiscordSender │   │OpsNotionLogger  │
│                 │   │                 │
│ - Rate limiting │   │ - Page creation │
│ - Retry logic   │   │ - Status updates│
│ - Embed building│   │ - Rate limits   │
└─────────────────┘   └─────────────────┘
```

### Data Flow

1. **Polling Loop** (every 60-120 seconds)
   ```
   OpsIncidentRouter.pollAndRoute()
   └── getIncidentsPendingNotification()
       └── For each incident:
           ├── makeRoutingDecision()
           ├── checkShouldSend() (cooldown/dedupe)
           ├── sendDiscordNotification() or sendNotionNotification()
           └── recordNotificationSent()
   ```

2. **Weekly Digest** (Monday 9 AM)
   ```
   OpsDigestScheduler.generateAndSendDigest()
   └── fetchDigestData()
       └── recordDigest()
           └── sendDigestNotification()
               └── updateDigestMessageId()
   ```

## Usage

### Starting the Worker

```typescript
import { Client } from 'discord.js';
import { getOpsNotificationWorker } from './services/ops';

// Get the worker instance
const worker = getOpsNotificationWorker();

// Initialize Discord (if using Discord alerts)
const discordClient = new Client({ /* intents */ });
await discordClient.login(process.env.DISCORD_BOT_TOKEN);
worker.initializeDiscord(discordClient);

// Initialize Notion (if using Notion logging)
worker.initializeNotion();

// Start the worker
await worker.start();

// Later, to stop:
await worker.stop();
```

### Manual Triggers

```typescript
// Trigger immediate poll
const pollResult = await worker.triggerPoll();
console.log(`Processed: ${pollResult.processed}, Notified: ${pollResult.notified}`);

// Trigger immediate digest
const digestResult = await worker.triggerDigest();
console.log(`Digest sent: ${digestResult.success}, Message ID: ${digestResult.messageId}`);
```

### Status Checks

```typescript
// Get worker status
const status = await worker.getStatus();
console.log('Running:', status.running);
console.log('Poll count:', status.pollCount);
console.log('Last poll:', status.lastPollTime);

// Get router status
const routerStatus = await worker.getRouterStatus();
console.log('Recent notifications:', routerStatus?.recentNotifications);

// Get digest status
const digestStatus = await worker.getDigestStatus();
console.log('Next digest:', digestStatus?.nextScheduled);
```

## Discord Embed Format

### Incident Notification

```
🔴 OPS INCIDENT: API Latency P99
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: 🚨 OPEN

🚨 CRITICAL ALERT - @ops-team

📊 SLO Details              📈 Metrics
SLO: API Latency P99        Current: 150
Severity: CRITICAL          Threshold: 100
ID: slo-abc12...            Delta: +50

⏱️ Timeline
Opened: <relative timestamp>
Acknowledged: -
Resolved: -

🔍 Evidence
endpoint: /api/picks
latency_ms: 150

🔗 Actions
[Open Command Center](https://command.unit-talk.com/dashboard/ops)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRODUCTION | incident: abc12345 | corr: def67890
```

### Weekly Digest

```
📊 Weekly Ops Digest
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Period: Jan 13, 2026 - Jan 20, 2026
Environment: PRODUCTION

📋 Incident Summary      ⏱️ Response Metrics
🔴 Critical: 2           Avg Time to Ack: 15 min
🟡 Warning: 8            Avg Time to Resolve: 45 min
📊 Total: 10             Median TTR: 30 min

🚨 Open: 1
👀 Acknowledged: 2
✅ Resolved: 7

🔊 Top Noisy SLOs
1. API Latency: 5 incidents
2. Error Rate: 3 incidents

🔍 Evaluation Health     📊 Current SLO Health
Total Evaluations: 1000  🟢 Healthy: 8
Successful: 995          🟡 Warning: 2
Error Rate: 0.5%         🔴 Critical: 0

🔗 Full Report
[Open Ops Dashboard](https://command.unit-talk.com/dashboard/ops)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRODUCTION | Weekly Digest | corr: abc12345
```

## Testing

Run the tests:

```bash
# From apps/api directory
npm test -- --testPathPattern="incident-routing"
```

### Test Coverage

- Routing decision logic (feature flags, escalation, destinations)
- Discord embed building (colors, fields, traceability)
- Escalation content (role mentions, severity checks)
- Digest embed building
- Feature flag defaults (all OFF)
- Idempotency semantics

## Troubleshooting

### Common Issues

**No notifications being sent**
1. Check feature flags are enabled: `OPS_DISCORD_ALERTS_ENABLED=true`
2. Verify channel ID is configured: `OPS_DISCORD_CHANNEL_ID`
3. Check worker is running: `worker.getStatus()`
4. Check for cooldown: `should_send_notification()` in database

**Duplicate notifications**
1. Check unique constraint exists on `ops.incident_notifications`
2. Verify `incident_key` is being set correctly
3. Check `record_notification_sent()` is being called

**Digest not sending**
1. Verify `OPS_DIGEST_ENABLED=true`
2. Check cron schedule: `OPS_DIGEST_CRON`
3. Check timezone: `OPS_DIGEST_TIMEZONE`
4. Verify `ops.digest_history` for already sent digests

**Rate limiting**
1. Check Discord rate limit: 2 seconds between messages
2. Check Notion rate limit: exponential backoff
3. Check max per hour: `OPS_NOTIFICATION_MAX_PER_HOUR`

## Security

- All database operations use `service_role` key
- RLS policies restrict access to service_role only
- No user-facing data in ops notifications
- Correlation IDs for audit trail
- No secrets logged or embedded

## Files

### Database
- `supabase/migrations/20260119_pr7_ops_notifications.sql`

### Services
- `apps/api/src/services/ops/OpsIncidentRouter.ts` - Core routing logic
- `apps/api/src/services/ops/OpsDiscordSender.ts` - Discord integration
- `apps/api/src/services/ops/OpsDiscordEmbedBuilder.ts` - Embed building
- `apps/api/src/services/ops/OpsNotionLogger.ts` - Notion integration
- `apps/api/src/services/ops/OpsDigestScheduler.ts` - Digest scheduling
- `apps/api/src/services/ops/OpsNotificationWorker.ts` - Main worker
- `apps/api/src/services/ops/index.ts` - Exports

### Tests
- `apps/api/src/tests/ops/incident-routing.test.ts`

---

**Author**: Engineering Team
**PR**: feat/pr7-incident-routing
**Created**: January 2026
