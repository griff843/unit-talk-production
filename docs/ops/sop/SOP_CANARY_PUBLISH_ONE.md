# SOP: Canary Publish One

**Sprint**: CANARY-LIFECYCLE-TRIGGER-008 **Version**: 1.0 **Last Updated**:
2026-02-28

---

## Overview

The `POST /ops/canary/publish-one` endpoint publishes exactly ONE pick through
the REAL lifecycle pipeline to the CANARY surface on STAGING. It creates
execution_events telemetry BEFORE the Discord POST and updates AFTER with the
real snowflake.

---

## When to Use

- Verifying execution telemetry pipeline on staging
- Testing real Discord webhook connectivity
- Validating snowflake receipt capture
- Single-pick staging verification before production deployment

---

## Prerequisites

### Environment Variables (REQUIRED)

```bash
# REQUIRED: Set Discord routing mode to canary
DISCORD_MODE=canary

# REQUIRED: Canary webhook URL (separate test channel)
DISCORD_CANARY_WEBHOOK_URL=https://discord.com/api/webhooks/<ID>/<TOKEN>
```

### Operator Authentication

Requires valid JWT token with operator privileges (via `operatorAuth`
middleware).

---

## Endpoint Specification

### Request

```http
POST /ops/canary/publish-one
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Request Body

```json
{
  "pick_id": "uuid", // Optional - if not provided, selects 1 eligible pick
  "dry_run": false // Optional - if true, validates but doesn't post
}
```

### Response (Success)

```json
{
  "status": "success",
  "pick_id": "123e4567-e89b-12d3-a456-426614174000",
  "execution_event_id": "ee-uuid-001",
  "discord_message_id": "1234567890123456789",
  "target_surface": "CANARY",
  "idempotent": false,
  "publish_latency_ms": 234,
  "correlationId": "ops-canary-publish-1709151234567-abc123",
  "timestamp": "2026-02-28T12:00:00.000Z"
}
```

### Response (Idempotent - Already Posted)

```json
{
  "status": "success",
  "pick_id": "123e4567-e89b-12d3-a456-426614174000",
  "target_surface": "CANARY",
  "idempotent": true,
  "reason": "ALREADY_POSTED",
  "correlationId": "...",
  "timestamp": "..."
}
```

### Response (No Eligible Picks)

```json
{
  "status": "noop",
  "reason": "NO_ELIGIBLE_PICK",
  "target_surface": "CANARY",
  "idempotent": false,
  "correlationId": "...",
  "timestamp": "..."
}
```

### Response (Mode Gate Failure - 403)

```json
{
  "status": "error",
  "error": "DISCORD_MODE must be \"canary\" to use this endpoint",
  "current_mode": "production",
  "target_surface": "CANARY",
  "idempotent": false,
  "correlationId": "...",
  "timestamp": "..."
}
```

---

## Example Usage

### Staging (via kubectl)

```bash
# Get operator JWT token
export JWT_TOKEN="..."

# Call the endpoint
curl -X POST "https://staging-api.unit-talk.com/ops/canary/publish-one" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"pick_id": "optional-uuid-here"}'
```

### With Specific Pick

```bash
curl -X POST "https://staging-api.unit-talk.com/ops/canary/publish-one" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"pick_id": "123e4567-e89b-12d3-a456-426614174000"}'
```

### Dry Run Mode

```bash
curl -X POST "https://staging-api.unit-talk.com/ops/canary/publish-one" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true}'
```

---

## Verification Queries

After calling the endpoint, verify success:

### Q1: Verify Pick Has Discord Receipt

```sql
SELECT id,
       posted_to_discord,
       discord_message_id,
       meta->'discord_receipt'->>'message_id' as receipt_message_id,
       meta->'discord_receipt'->>'posted_at' as posted_at
FROM unified_picks
WHERE id = '<pick_id>';
```

### Q2: Verify Snowflake Format

```sql
SELECT id,
       discord_message_id,
       LENGTH(discord_message_id) as id_length,
       discord_message_id ~ '^\d{17,20}$' as is_valid_snowflake
FROM unified_picks
WHERE id = '<pick_id>';
```

### Q3: Verify Execution Event Created

```sql
SELECT pick_id,
       status,
       target_surface,
       discord_message_id,
       publish_latency_ms,
       created_at,
       published_at
FROM execution_events
WHERE pick_id = '<pick_id>'
ORDER BY created_at DESC
LIMIT 1;
```

### Q4: Verify Audit Log Entry

```sql
SELECT actor, action, entity_id, details, created_at
FROM audit_log
WHERE entity_id = '<pick_id>'
  AND action LIKE 'CANARY%'
ORDER BY created_at DESC;
```

---

## Failure Modes & Recovery

| Failure             | Cause                            | Recovery                                 |
| ------------------- | -------------------------------- | ---------------------------------------- |
| 403 Mode Gate       | `DISCORD_MODE != canary`         | Set `DISCORD_MODE=canary` in environment |
| 401 Unauthorized    | Missing/invalid JWT              | Obtain valid operator JWT                |
| Discord POST Failed | Network/webhook error            | Check webhook URL, retry                 |
| Invalid Snowflake   | Discord returned non-standard ID | Investigate Discord response             |

---

## Security Considerations

1. **Operator Auth Required**: JWT principal extracted from token
2. **Mode Gate**: Fail-closed if `DISCORD_MODE != canary`
3. **Security Logging**: All requests logged to `security_events`
4. **Audit Trail**: All successful posts logged to `audit_log`
5. **No Production Risk**: Only operates on CANARY surface

---

## Related Documentation

- [Execution Telemetry Spec](../../blueprints/TELEMETRY_TRUTH_AUDIT_SPEC_v1.md)
- [Discord Routing Config](../../../apps/api/src/config/discordRouting.ts)
- [Lifecycle Contract](../../contracts/PICK_LIFECYCLE_CONTRACT.md)

---

**Document Owner**: Engineering Team **Sprint**: CANARY-LIFECYCLE-TRIGGER-008
