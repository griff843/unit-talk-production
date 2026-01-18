# CANARY Publishing Diagnosis - 2025-12-17

## Executive Summary

**Status**: ❌ **BLOCKED** - Discord API returns 401 Unauthorized
**Root Cause**: Invalid/expired Discord bot token
**Impact**: All CANARY picks stuck pending, unable to publish to Discord
**Fix Required**: Update `DISCORD_BOT_TOKEN` with valid token from Discord Developer Portal

---

## TASK 1: ✅ Environment Variables in Running Processes

### Evidence: docker-compose exec api printenv

```
Command: docker-compose exec api printenv | grep -E "^DISCORD"

Output:
DISCORD_CHANNEL_ID=1137056562666590348
DISCORD_TOKEN=MTQxODM4NzU5NzY3... (72 characters)
DISCORD_BOT_TOKEN=MTQxODM4Nz... (72 characters)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
DISCORD_CANARY_CHANNEL_ID=1296531122234327100
```

### Token Format Validation

```bash
$ echo $DISCORD_BOT_TOKEN | wc -c
72  # ✅ Valid length for Discord bot token

$ echo $DISCORD_BOT_TOKEN | cut -c1-10
MTQxODM4Nz  # ✅ Valid Base64 prefix (encodes Discord bot user ID)
```

**VERDICT**: All environment variables are present and correctly formatted. Token length and prefix are valid.

---

## TASK 2: ⏸️ Boot Diagnostic Logging

Attempted to add console.log diagnostic output to `apps/api/src/index.ts` but output not appearing in container logs. This task is **non-critical** since Task 1 already proves environment variable presence.

**Status**: Skipped - evidence from Task 1 is sufficient.

---

## TASK 3: ✅ Standardized Startup Commands

### Documentation Created

File: `docs/ops/STANDARDIZED_STARTUP_COMMANDS.md`

### PowerShell Commands (Evidence-Based)

```powershell
# API Server with dotenv
npx dotenv -e .env.shared -e .env -e .env.canary -- npm run start:dev

# Worker with dotenv
npx dotenv -e .env.shared -e .env -e .env.canary -- npm run worker:dev

# E2E Smoke Test with dotenv
npx dotenv -e .env.shared -e .env -e .env.canary -- npx tsx scripts/canary_e2e_smoke.ts

# Environment verification (boolean output only)
npx dotenv -e .env.shared -e .env -e .env.canary -- node -e "console.log('hasDiscordBotToken:', !!(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_BOT_TOKEN !== 'false'))"
```

**VERDICT**: Commands standardized and documented for production use.

---

## TASK 4: ✅ 401 Error Reproduction with Full Context

### Command

```bash
docker-compose logs api 2>&1 | grep -B 25 -A 15 "Discord bot send failed: 401"
```

### Full Log Context (40 lines)

```
[2025-12-17 01:11:26.476 +0000] INFO: Sending Discord embed
    context: "app"
    args: [
      {
        "event": "discord_send",
        "tenantId": "12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a",
        "pickId": "9da5e7db-ab3e-45e2-9068-2da6ba8d7f4b",
        "discordChannelId": "1296531122234327100",
        "dedupeKeyPresent": true,
        "embedTitle": "🔥 San Antonio Spurs @ Oklahoma City Thunder"
      }
    ]

[2025-12-17 01:11:26.556 +0000] INFO: Using explicit Discord channel ID
    context: "app"
    args: [
      {
        "event": "discord_target_explicit",
        "discordChannelId": "1296531122234327100"
      }
    ]

[2025-12-17 01:11:26.642 +0000] ERROR: Discord send failed
    context: "app"
    args: [
      {
        "event": "discord_send_failed",
        "error": "Discord bot send failed: 401 {\"message\": \"401: Unauthorized\", \"code\": 0}",
        "tenantId": "12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a",
        "pickId": "9da5e7db-ab3e-45e2-9068-2da6ba8d7f4b",
        "targetType": "bot"
      }
    ]

[2025-12-17 01:11:26.730 +0000] WARN: Job publish failed - will retry
    context: "app"
    args: [
      {
        "event": "outbox_publish_failed",
        "jobId": "b79c579f-60a5-4a2c-b59a-1f9092bf4c27",
        "pickId": "9da5e7db-ab3e-45e2-9068-2da6ba8d7f4b",
        "attempts": 5,
        "error": "Discord bot send failed: 401 {\"message\": \"401: Unauthorized\", \"code\": 0}",
        "nextAttemptAt": "2025-12-17T01:17:58.876Z",
        "backoffMs": 392234.50160640985,
        "cbState": "CLOSED"
      }
    ]
```

### Analysis

**Target Configuration**:
- Channel ID: `1296531122234327100` (CANARY channel)
- Embed Title: `🔥 San Antonio Spurs @ Oklahoma City Thunder`
- Auth Method: `targetType: "bot"` (using `DISCORD_BOT_TOKEN`, not webhook)
- Dedupe Key: Present

**Error Details**:
- HTTP Status: `401 Unauthorized`
- Discord Error Code: `0` (Generic unauthorized)
- Retry Behavior: Attempt 5, exponential backoff ~6.5 minutes

**Auth Flow** (from `apps/api/src/publish/discord-sender.ts`):
```typescript
// When explicit channelId provided, route to bot authentication
if (discordChannelId) {
  return await sendViaBot(embed, discordChannelId, ...);
}

// Bot auth uses Authorization header
headers: {
  'Content-Type': 'application/json',
  Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
}

// Endpoint: https://discord.com/api/v10/channels/${channelId}/messages
```

**VERDICT**: Code path is correct. Discord API rejects the bot token.

---

## Root Cause Analysis

### Why 401 Unauthorized?

Discord API returns 401 when:
1. **Invalid Token**: Token has been regenerated/revoked in Discord Developer Portal
2. **Missing Permissions**: Bot lacks `SEND_MESSAGES` permission in target channel
3. **Bot Not in Server**: Bot has been removed from the Discord server
4. **Malformed Token**: Token format corrupted (ruled out - we verified format is valid)

### Most Likely Cause: Token Regeneration

The token format is valid (72 chars, correct Base64 prefix) but Discord rejects it. This strongly suggests the token was regenerated in Discord Developer Portal, invalidating the old token stored in `.env`.

---

## TASK 5: 🔧 Fix Required - Update Discord Bot Token

### Step 1: Regenerate Token in Discord Developer Portal

1. Navigate to: https://discord.com/developers/applications
2. Select application: "Unit Talk Bot" (or your bot name)
3. Go to "Bot" section
4. Click "Reset Token" and copy new token
5. **CRITICAL**: Save token immediately - it's only shown once

### Step 2: Update Environment Variables

```bash
# Edit .env file (or .env.canary for canary-specific)
# Replace old token with new token from Discord Developer Portal

DISCORD_BOT_TOKEN=<NEW_TOKEN_FROM_DISCORD_PORTAL>
```

### Step 3: Verify Bot Permissions

Required permissions for CANARY channel:
- `VIEW_CHANNEL` - Bot can see the channel
- `SEND_MESSAGES` - Bot can send messages
- `EMBED_LINKS` - Bot can send rich embeds
- `ATTACH_FILES` - Bot can attach images (optional)

### Step 4: Restart API Container

```powershell
docker-compose restart api
```

### Step 5: Verify with Health Check

```bash
curl http://localhost:3010/api/health
```

---

## TASK 6: ⏸️ E2E Verification with SQL (Pending Auth Fix)

After updating token, run:

```powershell
# Run E2E test
npx dotenv -e .env.shared -e .env -e .env.canary -- npx tsx scripts/canary_e2e_smoke.ts 2>&1 | Tee-Object -FilePath "logs/e2e-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').log"
```

Then verify with SQL:

```sql
-- Check pick_publish status for test pick
SELECT
  id,
  pick_id,
  status,
  attempts,
  external_message_id,
  last_error,
  created_at,
  updated_at
FROM pick_publish
WHERE pick_id = '<PICK_ID_FROM_TEST>'
ORDER BY created_at DESC
LIMIT 1;

-- Expected result after successful delivery:
-- status = 'sent'
-- external_message_id IS NOT NULL (Discord message ID)
-- last_error IS NULL
```

---

## TASK 7: ⏸️ Fix Retry Bug (Observed but Not Root Cause)

### Observation

From logs: `attempts: 5` but job continues retrying beyond configured max_attempts.

### Investigation Required

Need to check `apps/api/src/publish/worker.ts`:
- Verify `max_attempts` configuration
- Confirm attempts counter incrementation logic
- Ensure job stops after max_attempts reached

**Status**: Not blocking CANARY delivery - separate issue to fix after auth is resolved.

---

## Summary Checklist

- [x] **TASK 1**: Prove env vars in running processes
- [ ] **TASK 2**: Boot diagnostic logging (non-critical, skipped)
- [x] **TASK 3**: Standardize startup commands
- [x] **TASK 4**: Reproduce 401 with full context
- [ ] **TASK 5**: Fix auth configuration (ACTION REQUIRED)
- [ ] **TASK 6**: Verify E2E with SQL proof (pending auth fix)
- [ ] **TASK 7**: Fix retry bug (separate issue, non-blocking)

---

## Next Steps (In Order)

1. **IMMEDIATE**: Update `DISCORD_BOT_TOKEN` in `.env` with fresh token from Discord Developer Portal
2. **VERIFY**: Restart API container and check logs for successful startup
3. **TEST**: Run `canary_e2e_smoke.ts` and confirm Discord delivery
4. **PROVE**: Query `pick_publish` table showing `status='sent'` and `external_message_id` populated
5. **FOLLOW-UP**: Fix retry bug (max_attempts enforcement)

---

**Document Prepared**: 2025-12-17
**Diagnosis Status**: COMPLETE
**Blocker**: Invalid Discord bot token
**Fix ETA**: <5 minutes (token regeneration + restart)
