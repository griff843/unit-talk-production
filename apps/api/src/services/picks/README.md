# Picks Service - Canonical Picks Architecture

This module implements a dual-driver database system for picks management with full idempotency support, audit logging, and outbox pattern for reliable Discord publishing.

## Architecture Overview

### Database Drivers

The system supports two database drivers:

1. **UnifiedPicksDriver** - Legacy driver for `unified_picks` table
2. **CanonicalPicksDriver** - Modern driver for `picks` + `pick_publish` tables

The driver is selected via the `PICK_DRIVER` environment variable with automatic fallback to unified if canonical tables are not available.

### Key Components

- **PicksDriverFactory**: Creates and manages driver instances with runtime DDL checks
- **AuditLogger**: Comprehensive audit logging for compliance and observability
- **PickPublisher**: Handles Discord publishing with direct or outbox pattern
- **PicksReaderService**: View-based reads with automatic fallback

## Environment Variables

```bash
# Driver Selection
PICK_DRIVER=canonical          # Options: 'unified' | 'canonical' (default: 'canonical')

# Publishing Mode
PUBLISH_MODE=outbox           # Options: 'direct' | 'outbox' (default: 'outbox')

# Default Tenant (for single-tenant deployments)
DEFAULT_TENANT_ID=00000000-0000-0000-0000-000000000001
```

## API Endpoints

### POST /api/domain/picks/insert

Insert a new pick with full idempotency support.

**Request Headers:**
- `Idempotency-Key` (optional): Request-level idempotency key

**Request Body:**
```json
{
  "tenantId": "string (optional)",
  "userId": "string (required)",
  "league": "string (required)",
  "playerId": "string (optional)",
  "playerName": "string (optional)",
  "gameId": "string (optional)",
  "gameDate": "string (optional, ISO date)",
  "marketType": "string (required)",
  "line": "number (required)",
  "side": "string (required, 'over' | 'under')",
  "odds": "number (optional, default: -110)",
  "stakeText": "string (optional)",
  "stake": "number (optional, default: 1.0)",
  "userScore": "number (optional, 1-10)",
  "betSlipId": "string (optional)",
  "autoPublish": "boolean (optional, default: true)",
  "threadId": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "pickId": "uuid",
  "pick": {
    "id": "uuid",
    "tenantId": "uuid",
    "userId": "uuid",
    "selection": "over",
    "odds": -110,
    "stake": 1.0,
    "status": "pending",
    "createdAt": "ISO timestamp"
  },
  "idempotent": false,
  "driver": "canonical",
  "publishMode": "outbox",
  "correlationId": "string"
}
```

### GET /api/domain/picks/status

Get system status including driver availability.

**Response:**
```json
{
  "success": true,
  "currentDriver": "canonical",
  "driverAvailability": {
    "canonical": true,
    "unified": true
  },
  "publishMode": "outbox",
  "configuredDriver": "canonical",
  "configuredPublishMode": "outbox"
}
```

## Idempotency

The system provides three levels of idempotency:

1. **Request-level**: Via `Idempotency-Key` header
2. **Pick-level**: Auto-generated hash from pick details (tenantId, userId, playerId, marketType, line, side, date)
3. **Bet-slip-level**: Via `betSlipId` field

### Idempotency Key Generation

```typescript
// Auto-generated idempotency key
hash(tenantId + userId + playerId + marketType + line + side + date)
```

If the same pick is submitted multiple times, the original pick is returned without creating a duplicate.

## Outbox Pattern

The system supports two publishing modes:

### Outbox Mode (Recommended)
- Picks are written to `pick_publish` table with `status='pending'`
- Background worker polls the table and publishes to Discord
- Exponential backoff retry: 1min, 5min, 15min
- Maximum 3 retry attempts

### Direct Mode
- Picks are immediately published to Discord
- Optionally writes to `pick_publish` table with `status='sent'`
- Useful for time-sensitive live picks

## Audit Logging

All operations are logged to `audit_events` table:

- `pick.submitted` - Pick creation
- `pick.status_changed` - Status updates
- `pick.workflow_changed` - Workflow stage changes
- `discord.posted` - Successful Discord publish
- `publish.failed` - Failed publish attempts
- `pick.idempotent_duplicate` - Duplicate detection

### Example Audit Usage

```typescript
import { auditLogger } from './services/picks';

// Log pick submission
await auditLogger.logPickSubmitted(pickId, tenantId, userId, {
  marketType: 'points',
  line: 25.5,
  side: 'over',
  odds: -110,
});

// Log Discord post
await auditLogger.logDiscordPosted(publishId, tenantId, {
  pickId,
  messageId: 'msg-123',
  threadId: 'thread-123',
  channel: 'DISCORD',
});
```

## Views-Based Reads

The `PicksReaderService` provides optimized reads with automatic fallback:

1. Attempts to read from `vw_recent_picks` view (optimized)
2. Falls back to direct joins on `picks` table
3. Falls back to `unified_picks` table if canonical not available

```typescript
import { picksReaderService } from './services/picks';

const recentPicks = await picksReaderService.getRecentPicks(tenantId, 50);
```

## Database Schema

### picks Table (Canonical)

```sql
CREATE TABLE picks (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  prop_id UUID,
  selection TEXT NOT NULL,
  odds INTEGER NOT NULL,
  stake DECIMAL(8,2) NOT NULL,
  confidence INTEGER,
  workflow_stage TEXT NOT NULL DEFAULT 'draft',
  status TEXT NOT NULL DEFAULT 'pending',
  idempotency_key TEXT,
  bet_slip_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT picks_tenant_idempotency_unique UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT picks_tenant_bet_slip_unique UNIQUE (tenant_id, bet_slip_id)
);
```

### pick_publish Table (Outbox)

```sql
CREATE TABLE pick_publish (
  id UUID PRIMARY KEY,
  pick_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  channel TEXT NOT NULL DEFAULT 'DISCORD',
  status TEXT NOT NULL DEFAULT 'pending',
  thread_id TEXT,
  external_message_id TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### audit_events Table

```sql
CREATE TABLE audit_events (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  actor_id UUID,
  actor_type TEXT NOT NULL DEFAULT 'user',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Testing

Run tests:

```bash
npm run test -- picks
```

Unit tests cover:
- ✅ Canonical driver insert and idempotency
- ✅ Publish record creation (outbox pattern)
- ✅ Publish status updates
- ✅ Runtime DDL checks
- ✅ Audit logging for all event types
- ✅ Driver factory with automatic fallback

## Migration Path

### Phase 1: Dual-driver support (Current)
- Both `unified_picks` and `picks` tables operational
- `PICK_DRIVER` defaults to `canonical`
- Automatic fallback to `unified` if canonical tables missing

### Phase 2: Gradual migration
- Run canonical driver in production
- Monitor metrics and audit logs
- Migrate historical data from `unified_picks` to `picks`

### Phase 3: Deprecate unified
- Remove `unified_picks` driver
- Remove compatibility layer
- Full canonical architecture

## Best Practices

1. **Always use idempotency keys** for external API calls
2. **Use outbox mode** for reliable publishing
3. **Monitor audit logs** for compliance
4. **Check driver status** via `/api/domain/picks/status`
5. **Handle game resolution** - if `gameId` is missing, still insert (will be backfilled later)

## Troubleshooting

### Driver fallback to unified
If you see "falling back to unified driver" in logs:
1. Check that canonical tables exist: `SELECT * FROM picks LIMIT 1;`
2. Run migrations: `supabase migration up`
3. Verify RLS policies are enabled

### Idempotency not working
1. Check idempotency key uniqueness constraint
2. Verify tenant_id matches
3. Check audit logs for `pick.idempotent_duplicate` events

### Outbox not publishing
1. Verify background worker is running
2. Check `pick_publish` table for pending records
3. Review `last_error` column for failures
4. Check audit logs for `publish.failed` events

## Future Enhancements

- [ ] Multi-leg parlay support
- [ ] Game resolution service
- [ ] Webhook notifications
- [ ] GraphQL API
- [ ] Real-time subscriptions
