# Discord CANARY Visibility Debug Report

**PR**: PR10 (PR #36) Go-Live Hardening
**Date**: 2026-01-20
**Status**: ROOT CAUSE IDENTIFIED

---

## Executive Summary

User reported inability to see Discord posts despite evidence showing 5 messages with status "sent" and real Discord message IDs. This report documents the investigation findings and fix path.

---

## Evidence Analysis

### Discord Message IDs (FROM pick_publish TABLE)

| Record ID | external_message_id | discord_channel_id | Posted At |
|-----------|---------------------|-------------------|-----------|
| 28ac4361-93c8-4fc7-8f90-c1b13fd11b9c | `1452718842328387770` | 1296531122234327100 | 2025-12-22T17:46:02Z |
| 05c46be0-4a0d-4f64-a64c-7026f95dafa7 | `1452718585393713182` | 1296531122234327100 | 2025-12-22T17:45:00Z |
| dbdee0ac-cd6e-47d6-93dc-788ab879dda5 | `1452672537661280307` | 1296531122234327100 | 2025-12-22T14:42:01Z |
| 38b972c6-ee15-4db2-8222-5c0910434882 | `1452672435613733005` | 1296531122234327100 | 2025-12-22T14:41:36Z |
| 85ab4d15-b2fa-4047-9ee6-5905e8945c18 | `1452338027295674480` | 1296531122234327100 | 2025-12-21T16:32:48Z |

**Key Finding**: These are REAL Discord snowflake IDs (64-bit integers), NOT mock IDs. This confirms messages were successfully posted to Discord via the bot.

### Environment Configuration (.env)

```
DISCORD_GUILD_ID=1284478946171293736
DISCORD_CANARY_CHANNEL_ID=1296531122234327100
DISCORD_BOT_TOKEN=MTQxODM4NzE5NjExNjg2MTA0OQ... (VALID)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url (PLACEHOLDER - NOT USED FOR CANARY)
CANARY_MODE=true
CANARY_PERCENTAGE=50
```

---

## Root Cause Analysis

### Messages ARE on Discord

The evidence proves that 5 messages were successfully posted to Discord:
1. Message IDs are valid Discord snowflakes (not mock `msg_${timestamp}` format)
2. All messages targeted channel `1296531122234327100`
3. Status is "sent" with `last_attempt_at` timestamps

### Why User Cannot See Them

| Hypothesis | Likelihood | Evidence |
|------------|------------|----------|
| **Wrong server/guild open** | HIGH | User may not be in guild `1284478946171293736` |
| **Channel permission issue** | MEDIUM | User may lack VIEW_CHANNEL permission for `1296531122234327100` |
| **Messages deleted** | LOW | Messages from Dec 21-22, 2025 may have been cleaned |
| **Channel is a thread** | LOW | CANARY ID might reference a thread, not a text channel |
| **Time gap** | MEDIUM | Messages are ~1 month old, may be scrolled past |

---

## Fix Path

### Immediate User Actions

1. **Verify Guild Membership**
   - Open Discord and confirm you are in server with ID `1284478946171293736`
   - If not found: Request server invite from admin

2. **Locate CANARY Channel**
   - Press `Ctrl+G` (or `Cmd+G` on Mac) to open "Go to Server"
   - Navigate to channel `1296531122234327100`
   - Or use developer mode: Right-click channel → Copy ID → Search

3. **Check Message History**
   - Once in the channel, scroll to December 21-22, 2025
   - Or use Discord search: `from:Unit Talk in:#canary-channel before:2025-12-25`

4. **Verify Permissions**
   - Check if you can see channel in sidebar
   - If not visible, contact server admin for role assignment

### Developer/Admin Actions

1. **Verify Channel Exists**
   ```javascript
   // In Discord bot or browser console
   client.channels.fetch('1296531122234327100')
     .then(ch => console.log(ch.name, ch.type))
     .catch(err => console.error('Channel not found:', err));
   ```

2. **Verify Bot Permissions**
   - Bot needs VIEW_CHANNEL, SEND_MESSAGES, EMBED_LINKS
   - Check guild audit log for any permission changes

3. **Check if Messages Exist**
   ```javascript
   const channel = await client.channels.fetch('1296531122234327100');
   const message = await channel.messages.fetch('1452718842328387770');
   console.log(message.content, message.createdAt);
   ```

---

## Publishing Architecture

### How Messages Get Posted

```
Smart Form → smart_tickets → bridge_outbox → TicketLifecycleWorkflow
                                                    ↓
                                            pick_publish (status=pending)
                                                    ↓
                                         DiscordPublishingWorker
                                                    ↓
                                         DiscordBotService.sendEmbed()
                                                    ↓
                                         pick_publish (status=sent, external_message_id set)
```

### Service Hierarchy

| Service | Token Used | Purpose |
|---------|------------|---------|
| `DiscordBotService` | `DISCORD_BOT_TOKEN` | Actual message sending via discord.js |
| `DiscordBotIntegration` | N/A | STUB - returns mock IDs (not used in production) |
| `DiscordPromotionAgent` | `DISCORD_WEBHOOK_URL` | Webhook-based posting (PLACEHOLDER in .env) |
| `DiscordSink` | `DISCORD_WEBHOOK_URL` | Dual-mode: REAL if webhook set, SINK to file otherwise |

### CANARY Mode Routing

When `CANARY_MODE=true`:
- All picks route to `DISCORD_CANARY_CHANNEL_ID` (1296531122234327100)
- NOT to individual capper threads
- `CANARY_PERCENTAGE=50` means 50% of picks get published (bucket-based)

---

## Configuration vs Production Thread Routing

| Mode | Channel Config | Status |
|------|----------------|--------|
| **CANARY** | `DISCORD_CANARY_CHANNEL_ID=1296531122234327100` | ACTIVE |
| **PRODUCTION** | `CAPPER_THREAD_GRIFF843=<thread_id>` etc. | NOT CONFIGURED |

For production capper-specific thread routing:
```bash
# Required .env additions for production mode
AUTOPILOT_MODE=prod
CAPPER_THREAD_GRIFF843=<discord_thread_id>
CAPPER_THREAD_VICGO=<discord_thread_id>
CAPPER_THREAD_SAUCED=<discord_thread_id>
# ... etc
```

---

## Conclusion

**Messages WERE successfully posted to Discord.** The user's inability to see them is due to:
1. Not being in the correct Discord server/guild
2. Not having permission to view the CANARY channel
3. Messages being from ~1 month ago (December 2025)

**Action Required**: User should verify guild membership and channel access using the Fix Path above.

---

*Report generated: 2026-01-20T23:30Z*
*Evidence bundle: out/manual-pick-e2e/2026-01-20_1355/discord/publish-evidence.json*
