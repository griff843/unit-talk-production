# Discord Publishing Specification v1.0

**Status**: Production-Ready
**Owner**: Platform Engineering
**Last Updated**: 2026-01-14
**Compliance**: Production Charter Required

---

## Executive Summary

This specification defines Discord as an **output-only channel** with gated, automated publishing. Discord is the primary user-facing interface for Unit Talk's betting intelligence platform, delivering real-time picks, alerts, and recaps through a secure, role-based publish-only architecture.

**Core Principles**:
- ✅ **Output-Only**: Discord receives data, never sources it
- ✅ **Gated Publishing**: All publishes go through `pick_publish` outbox table
- ✅ **Automated Delivery**: Zero manual intervention required
- ✅ **Audit Trail**: Complete publish history with correlation IDs
- ✅ **No Silent Failures**: All failures logged, tracked, and routed to DLQ

---

## 1. Discord as Output-Only Channel

### 1.1 Architecture Principle

Discord is a **read-only presentation layer** for users. All data originates from:
- `picks` table (canonical pick storage)
- `pick_publish` outbox (publish queue)
- `daily_recaps` table (recap content)
- Temporal workflows (orchestration)

**Discord NEVER**:
- Sources betting data
- Makes business logic decisions
- Stores authoritative records
- Bypasses the outbox pattern

### 1.2 Data Flow

```
[Smart Form / API]
        ↓
   [picks table]
        ↓
  [pick_publish outbox] ← Gating layer
        ↓
[DiscordPublishingWorker] ← Automated polling
        ↓
  [DiscordPublisher] ← Rate limiting + DLQ
        ↓
   [Discord API]
        ↓
  [User Channels] ← Output-only presentation
```

### 1.3 Guarantees

- **Exactly-once delivery**: Idempotency via `external_message_id`
- **At-least-once attempt**: Retry with exponential backoff
- **Failure handling**: DLQ routing for permanent failures
- **Audit trail**: Complete publish history in `pick_publish` table

---

## 2. Publishing Flow Architecture

### 2.1 Outbox Pattern (Gating Layer)

All Discord publishes MUST go through the `pick_publish` outbox table:

```sql
CREATE TABLE pick_publish (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID NOT NULL REFERENCES picks(id),
  tenant_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  channel TEXT NOT NULL, -- 'DISCORD', 'CANARY', 'WEBHOOK', 'EMAIL'
  discord_channel_id TEXT, -- Resolved Discord channel ID
  thread_id TEXT, -- Optional thread ID for capper threads
  message_type TEXT NOT NULL, -- 'new_pick', 'graded_pick', 'daily_recap', 'weekly_recap'
  metadata JSONB, -- Pick context for embed rendering
  external_message_id TEXT, -- Discord message ID for idempotency
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX idx_pick_publish_pending ON pick_publish (status, next_attempt_at)
  WHERE status = 'pending';
```

**Insertion Points**:
- Smart Form submission → `pick_publish` row created
- Grading completion → `pick_publish` row for graded embed
- Daily recap generation → `pick_publish` row for recap
- Alert triggers → `pick_publish` row for alert

### 2.2 Automated Publishing Worker

**DiscordPublishingWorker** (`apps/api/src/workers/DiscordPublishingWorker.ts`):

```typescript
// Polling configuration
const POLL_INTERVAL = 10_000; // 10 seconds
const BATCH_SIZE = 10; // Process 10 records per batch

// Worker responsibilities:
// 1. Poll pick_publish for pending records
// 2. Resolve channel routing (DISCORD vs CANARY)
// 3. Apply rate limiting
// 4. Publish via DiscordPublisher
// 5. Update status: pending → sent | failed
// 6. Route failures to DLQ after max_attempts
```

**Key Features**:
- Batch processing for efficiency
- Exponential backoff: 1min → 5min → 15min
- Circuit breaker for Discord API failures
- Health checks for monitoring

### 2.3 Publishing Service

**DiscordPublisher** (`apps/api/src/services/publishing/DiscordPublisher.ts`):

```typescript
interface PublishRequest {
  pickId: string;
  tenantId: string;
  channelId: string; // Resolved Discord channel ID
  threadId?: string;
  messageType: 'new_pick' | 'graded_pick' | 'daily_recap' | 'weekly_recap';
  context: PickContext; // Embed rendering context
  traceId?: string; // Correlation ID for tracing
  source: string; // 'canonical' | 'legacy' | 'professional'
  attemptNumber?: number;
  maxAttempts?: number;
}

// Service responsibilities:
// 1. Rate limiting (channel + global)
// 2. Embed rendering via DiscordTemplates
// 3. API call to Discord
// 4. DLQ routing on permanent failure
// 5. Metrics recording
```

**Rate Limiting**:
- **Channel limit**: 5 messages/10 seconds per channel
- **Global limit**: 50 messages/1 second across all channels
- Token bucket algorithm with waiting

### 2.4 Core Sender Logic

**discord-sender.ts** (`apps/api/src/publish/discord-sender.ts`):

```typescript
// Channel routing priority:
// 1. Explicit discordChannelId (from pick_publish.discord_channel_id)
// 2. Capper-specific thread (env.capperThreads[capperName])
// 3. Alerts channel fallback (env.alertsChannelId)
// 4. Webhook URL fallback (process.env.DISCORD_WEBHOOK_URL)

// Idempotency:
// - X-Idempotency-Key header (dedupeKey = pick_publish.id)
// - external_message_id database tracking

// Error handling:
// - Retryable: 429 rate limit, 503 service unavailable, network errors
// - Non-retryable: 400 bad request, 404 not found, 403 forbidden
```

---

## 3. Role-Based Visibility Matrix

### 3.1 Tier Hierarchy

```
owner > admin > staff > vip_plus > vip > capper > trial > member
```

### 3.2 Channel Access Matrix

| Channel Type | Member | Trial | VIP | VIP+ | Capper | Staff | Admin | Owner |
|-------------|--------|-------|-----|------|--------|-------|-------|-------|
| **Public Channels** |
| #general | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| #free-picks | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| #education | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **VIP Channels** |
| #vip-picks | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| #vip-general | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| #vip-analysis | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **VIP+ Channels** |
| #vip-plus-picks | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| #vip-plus-elite | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| #vip-plus-support | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Capper Channels** |
| #capper-hub | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| #capper-analytics | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Staff Channels** |
| #staff-chat | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| #moderation | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Admin Channels** |
| #admin | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| #system-alerts | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Testing Channels** |
| #canary | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

### 3.3 Permissions by Tier

```typescript
interface TierPermissions {
  // Content access
  canViewVIPContent: boolean;
  canViewVipPlusContent: boolean;
  canAccessCoaching: boolean;

  // Actions
  canSubmitPicks: boolean;
  canCreateThreads: boolean;
  canUseDMs: boolean;

  // Admin
  canUseAdminCommands: boolean;
  canUseModeratorCommands: boolean;
  canEditConfig: boolean;

  // Rate limits
  maxPicksPerDay: number;
  maxDMsPerHour: number;
  cooldownSeconds: number;
}

// Tier-specific permissions
const TIER_PERMISSIONS: Record<UserTier, TierPermissions> = {
  member: {
    canViewVIPContent: false,
    canViewVipPlusContent: false,
    canAccessCoaching: false,
    canSubmitPicks: true,
    canCreateThreads: true,
    canUseDMs: true,
    canUseAdminCommands: false,
    canUseModeratorCommands: false,
    canEditConfig: false,
    maxPicksPerDay: 3,
    maxDMsPerHour: 5,
    cooldownSeconds: 120,
  },
  vip: {
    canViewVIPContent: true,
    canViewVipPlusContent: false,
    canAccessCoaching: false,
    maxPicksPerDay: 10,
    maxDMsPerHour: 10,
    cooldownSeconds: 60,
  },
  vip_plus: {
    canViewVIPContent: true,
    canViewVipPlusContent: true,
    canAccessCoaching: true,
    maxPicksPerDay: 25,
    maxDMsPerHour: 15,
    cooldownSeconds: 30,
  },
  admin: {
    canViewVIPContent: true,
    canViewVipPlusContent: true,
    canAccessCoaching: true,
    canUseAdminCommands: true,
    canUseModeratorCommands: true,
    canEditConfig: true,
    maxPicksPerDay: 50,
    maxDMsPerHour: 50,
    cooldownSeconds: 0,
  },
};
```

### 3.4 Channel Resolution Logic

**ChannelResolver** (`apps/api/src/services/publishing/ChannelResolver.ts`):

```typescript
// Environment variable mapping
VIP_PICKS_CHANNEL_ID=123456789 // Production VIP channel
DISCORD_CANARY_CHANNEL_ID=987654321 // Testing canary channel

// Channel type enum
type ChannelType = 'DISCORD' | 'CANARY' | 'WEBHOOK' | 'EMAIL';

// Safety check: CANARY !== DISCORD (prevent accidental production posts)
function validateCanarySafety(): boolean {
  const discordChannelId = process.env.VIP_PICKS_CHANNEL_ID;
  const canaryChannelId = process.env.DISCORD_CANARY_CHANNEL_ID;

  if (discordChannelId === canaryChannelId) {
    throw new Error('🚨 SAFETY VIOLATION: CANARY and DISCORD channels are the same!');
  }

  return true;
}
```

---

## 4. Failure Behavior & Circuit Breaker

### 4.1 Failure Classification

**Retryable Errors** (retry with exponential backoff):
- `429 Rate Limited` - Discord rate limit hit
- `503 Service Unavailable` - Discord API down
- `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND` - Network errors
- `CLIENT_NOT_READY` - Discord client reconnecting

**Non-Retryable Errors** (immediate DLQ routing):
- `400 Bad Request` - Invalid embed format
- `403 Forbidden` - Missing permissions
- `404 Not Found` - Channel doesn't exist
- `401 Unauthorized` - Invalid bot token
- `50001` - Missing channel access

### 4.2 Retry Strategy

```typescript
// Exponential backoff schedule
const RETRY_SCHEDULE = [
  { attempt: 1, delayMs: 60_000 },    // 1 minute
  { attempt: 2, delayMs: 300_000 },   // 5 minutes
  { attempt: 3, delayMs: 900_000 },   // 15 minutes
];

// After 3 attempts: route to DLQ
function calculateNextAttempt(attemptNumber: number): Date {
  const backoffMinutes = Math.pow(3, attemptNumber); // 3^1, 3^2, 3^3
  return new Date(Date.now() + backoffMinutes * 60 * 1000);
}
```

### 4.3 Circuit Breaker Pattern

```typescript
// Circuit breaker configuration
const CIRCUIT_BREAKER_CONFIG = {
  'discord-api': {
    failureThreshold: 3,      // Trip after 3 consecutive failures
    resetTimeoutMs: 60_000,   // Reset after 1 minute
    timeoutMs: 30_000,        // 30 second timeout per request
    retryAttempts: 2,         // Retry twice before marking as failure
  },
};

// Circuit breaker states
enum CircuitState {
  CLOSED,   // Normal operation
  OPEN,     // Tripped - reject all requests
  HALF_OPEN // Testing - allow one request to test recovery
}

// When circuit trips:
// 1. Reject new publish requests immediately
// 2. Return failure to worker
// 3. Worker marks attempts and schedules retry
// 4. After resetTimeout, allow test request (half-open)
// 5. If test succeeds → close circuit
// 6. If test fails → open circuit, reset timer
```

### 4.4 Dead Letter Queue (DLQ)

When a publish permanently fails (max attempts or non-retryable error):

```typescript
// Route to dead_letter_queue table
await dlqService.addToDLQ({
  source: 'discord_publisher',
  original_event_id: pickId,
  original_table: 'pick_publish',
  payload: {
    pickId,
    tenantId,
    channelId,
    messageType,
    context,
  },
  error_message: errorMessage,
  error_code: errorCode,
  retry_count: attemptNumber,
  max_retries_attempted: maxAttempts,
  metadata: {
    traceId,
    source,
    canonicalPlayerId,
    canonicalGameId,
  },
});

// DLQ table schema
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  original_event_id UUID,
  original_table TEXT,
  payload JSONB NOT NULL,
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER,
  max_retries_attempted INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  resolution_notes TEXT
);
```

### 4.5 Failure Monitoring & Alerts

**Metrics**:
- `discord_publish_failures_total{error_code, channel_id}`
- `discord_publish_dlq_routed_total{error_code}`
- `discord_circuit_breaker_state{service}`
- `discord_rate_limit_hits_total{scope}`

**Alerts**:
- DLQ accumulation > 10 items in 5 minutes
- Circuit breaker open for > 5 minutes
- Publish failure rate > 5% over 10 minutes
- No successful publishes in 15 minutes

---

## 5. Audit Trail Requirements

### 5.1 Complete Publish History

Every Discord publish MUST be traceable:

```sql
-- Query pick publish history
SELECT
  pp.id,
  pp.pick_id,
  pp.status,
  pp.channel,
  pp.discord_channel_id,
  pp.message_type,
  pp.attempts,
  pp.created_at,
  pp.sent_at,
  pp.failed_at,
  pp.external_message_id,
  pp.error_message,
  p.player_name,
  p.stat_type,
  p.line
FROM pick_publish pp
JOIN picks p ON p.id = pp.pick_id
WHERE pp.pick_id = $1
ORDER BY pp.created_at DESC;
```

### 5.2 Correlation IDs

All publishes include `traceId` for end-to-end tracing:

```typescript
// Generate trace ID
const traceId = `pub-${pickPublishId}-${Date.now()}`;

// Include in logs
logger.info('Publishing to Discord', {
  traceId,
  pickId,
  tenantId,
  channelId,
  messageType,
});

// Include in DLQ metadata
metadata: { traceId, source, canonicalPlayerId, canonicalGameId }

// Include in Discord embed footer (debug mode)
footer: { text: `Trace: ${traceId}` }
```

### 5.3 Metrics & Observability

**Prometheus Metrics**:
```typescript
// Publish attempts
discord_publish_attempts_total{channel_id, message_type, source}

// Publish successes
discord_publish_success_total{channel_id, message_type, source}

// Publish failures
discord_publish_failures_total{channel_id, message_type, error_code}

// Publish latency
discord_publish_duration_seconds{channel_id, message_type}

// Rate limiting
discord_rate_limit_waits_total{channel_id, scope}
discord_rate_limit_wait_duration_seconds{channel_id}

// Circuit breaker
discord_circuit_breaker_state{service} # 0=closed, 1=half-open, 2=open

// DLQ routing
discord_dlq_routed_total{error_code, channel_id}

// Outbox metrics
discord_outbox_pending_count
discord_outbox_oldest_age_seconds
```

---

## 6. Implementation Checklist

### 6.1 Required Components

- [x] `pick_publish` outbox table with proper indexes
- [x] `DiscordPublishingWorker` for automated polling
- [x] `DiscordPublisher` service with DLQ integration
- [x] `discord-sender.ts` with idempotency and routing
- [x] `ChannelResolver` with canary safety checks
- [x] `RateLimiter` for channel and global limits
- [x] `DiscordTemplates` for embed rendering
- [x] Circuit breaker for Discord API failures
- [x] Dead letter queue integration
- [x] Prometheus metrics exporter
- [x] Role-based permission system
- [ ] Admin dashboard for DLQ management
- [ ] Alerting rules for failure scenarios

### 6.2 Safety Requirements

- [x] Canary channel validation (CANARY !== DISCORD)
- [x] Idempotency via `external_message_id`
- [x] No silent failures (all failures logged and DLQ routed)
- [x] Complete audit trail with correlation IDs
- [x] Rate limiting to prevent Discord API abuse
- [x] Circuit breaker to prevent cascade failures
- [ ] Shadow mode testing capability
- [ ] Manual publish approval workflow (optional)

### 6.3 Testing Requirements

- [ ] Unit tests for discord-sender routing logic
- [ ] Integration tests for DiscordPublisher DLQ routing
- [ ] E2E tests for full publish pipeline
- [ ] Load tests for rate limiting behavior
- [ ] Chaos tests for circuit breaker behavior
- [ ] Canary deployment with production traffic sampling

---

## 7. Operational Runbook

### 7.1 Monitoring Dashboard

**Key Metrics to Monitor**:
- Outbox pending count (alert if > 50)
- Oldest outbox age (alert if > 5 minutes)
- Publish success rate (alert if < 95%)
- DLQ accumulation rate (alert if > 10/5min)
- Circuit breaker state (alert if open > 5min)

### 7.2 Incident Response

**Scenario: High DLQ Accumulation**
1. Check Discord API status (https://discordstatus.com)
2. Review DLQ entries for common error codes
3. If 403/404 errors: verify channel IDs in env config
4. If 429 errors: review rate limiter configuration
5. If 503 errors: wait for Discord API recovery
6. Reprocess DLQ entries after resolution

**Scenario: Circuit Breaker Tripped**
1. Check circuit breaker state: `discord_circuit_breaker_state{service="discord-api"}`
2. Review recent error logs for root cause
3. If transient issue: wait for auto-recovery (1 minute)
4. If persistent issue: investigate Discord API connectivity
5. Manual circuit reset: restart DiscordPublishingWorker

**Scenario: No Publishes in 15 Minutes**
1. Check DiscordPublishingWorker health: `GET /health`
2. Verify outbox has pending records: `SELECT COUNT(*) FROM pick_publish WHERE status='pending'`
3. Check Discord client connection status
4. Review worker logs for errors
5. Restart worker if unhealthy

### 7.3 Manual Reprocessing

```sql
-- Reprocess failed publishes
UPDATE pick_publish
SET
  status = 'pending',
  attempts = 0,
  next_attempt_at = NOW(),
  error_message = NULL
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '1 hour'
  AND error_code IN ('503', 'ECONNRESET', 'ETIMEDOUT');
```

---

## 8. Future Enhancements

### 8.1 Shadow Mode Testing

```typescript
// Enable shadow mode for testing without live publishes
const SHADOW_MODE = process.env.SHADOW_MODE === 'true';

if (SHADOW_MODE) {
  logger.info('[SHADOW MODE] Would publish to Discord', { pickId, channelId });
  return { success: true, messageId: `shadow-${Date.now()}` };
}
```

### 8.2 Manual Approval Workflow

For high-value picks or sensitive content:

```sql
-- Add approval fields to pick_publish
ALTER TABLE pick_publish ADD COLUMN requires_approval BOOLEAN DEFAULT false;
ALTER TABLE pick_publish ADD COLUMN approved_by UUID REFERENCES users(id);
ALTER TABLE pick_publish ADD COLUMN approved_at TIMESTAMPTZ;

-- Worker skips records requiring approval
WHERE status = 'pending'
  AND (requires_approval = false OR approved_at IS NOT NULL)
```

### 8.3 A/B Testing for Embeds

```typescript
// Test different embed formats with subset of users
const embedVariant = getABTestVariant(userId, 'embed_format');

const embed = embedVariant === 'A'
  ? DiscordTemplates.renderNewPickV1(context)
  : DiscordTemplates.renderNewPickV2(context);
```

---

## Appendix A: File Locations

**Core Publishing**:
- `apps/api/src/publish/discord-sender.ts` - Core sending logic
- `apps/api/src/services/publishing/DiscordPublisher.ts` - Publisher service
- `apps/api/src/workers/DiscordPublishingWorker.ts` - Automated worker
- `apps/api/src/services/publishing/ChannelResolver.ts` - Channel routing
- `apps/api/src/services/publishing/DiscordTemplates.ts` - Embed templates

**Supporting Services**:
- `apps/api/src/services/publishing/RateLimiter.ts` - Rate limiting
- `apps/api/src/services/DeadLetterQueueService.ts` - DLQ management
- `apps/api/src/monitoring/PublishingMetrics.ts` - Metrics collection
- `apps/api/src/services/enhanced-circuit-breaker.ts` - Circuit breaker

**Discord Bot**:
- `apps/discord-bot/src/utils/roleUtils.ts` - Tier detection
- `apps/discord-bot/src/utils/permissions.ts` - Permission checks
- `apps/discord-bot/src/config/onboardingConfig.ts` - Onboarding config

**Database Migrations**:
- `supabase/migrations/20251102_pick_publish_outbox.sql` - Outbox table
- `supabase/migrations/20250130_phase1_dead_letter_queue.sql` - DLQ table

---

## Appendix B: Environment Variables

```bash
# Discord Bot Configuration
DISCORD_TOKEN=your_bot_token
DISCORD_BOT_TOKEN=your_bot_token # Alias for compatibility

# Channel IDs
VIP_PICKS_CHANNEL_ID=123456789 # Production VIP picks channel
DISCORD_CANARY_CHANNEL_ID=987654321 # Testing canary channel
ALERTS_CHANNEL_ID=111222333 # General alerts channel

# Role IDs
VIP_ROLE_ID=444555666
VIP_PLUS_ROLE_ID=777888999
ADMIN_ROLE_ID=101010101
STAFF_ROLE_ID=121212121
TRIAL_ROLE_ID=131313131
MEMBER_ROLE_ID=141414141

# Worker Configuration
BRIDGE_OUTBOX_POLL_INTERVAL=10000 # 10 seconds
BRIDGE_OUTBOX_BATCH_SIZE=10
ENABLE_BRIDGE_OUTBOX=true
ENABLE_DISCORD_PUBLISHING=true

# Testing
SHADOW_MODE=false # Set to true for testing without live publishes
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-14 | Platform Engineering | Initial specification |

---

**End of Document**
