# Runbook: Promotion Pipeline Activation

**Purpose:** Enable picks to flow from grading → Discord **Status Gate:** All
env vars below + worker restarted **Last Updated:** 2026-03-09
(SPRINT-PROMOTION-PIPELINE-ACTIVATION)

---

## Prerequisites

1. Temporal worker is running (`npm run worker:dev` or Docker)
2. Supabase is connected and `unified_picks` table has picks at
   `workflow_stage='approved'`
3. Discord webhook URL is provisioned

---

## Step 1: Set Required Env Vars

```bash
# Minimum required for Discord posting to work
AUTOPILOT_MODE=prod
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/<id>/<token>

# Shadow mode MUST be unset or false (opt-in shadow mode)
# PROMOTION_SHADOW_MODE=true   ← do NOT set this if you want live posting

# For scored picks to receive promotion_band='HARD' via scoring pipeline:
PROMOTION_POLICY_V2=true
PROMOTION_CANARY_PERCENT=100
# PROMOTION_KILL_SWITCH must NOT be 'true'
```

---

## Step 2: Verify Gate Chain

Run the health check from within the API:

```typescript
import { getDiscordPublishHealth } from './agents/DiscordPromotionAgent';
const health = await getDiscordPublishHealth();
console.log(health);
// Expected:
// { status: 'healthy', webhookConfigured: true, shadowModeEnabled: false, killSwitchActive: false }
```

Or check the logs when `promoteToDiscord()` runs — it now logs all gate states
at startup.

---

## Step 3: Ensure Picks Have Correct Fields

**Capper picks** (highest priority, no band/tier gate):

```sql
SELECT id, meta->>'pick_origin', posted_to_discord
FROM unified_picks
WHERE meta->>'pick_origin' = 'capper' AND posted_to_discord = false;
```

**System picks** (requires explicit approval):

```sql
SELECT id, meta->>'system_approved', posted_to_discord
FROM unified_picks
WHERE meta->>'pick_origin' = 'system'
  AND meta->>'system_approved' = 'true'
  AND posted_to_discord = false;
```

**Legacy picks** (scored via pipeline with HARD band):

```sql
SELECT id, promotion_band, tier, posted_to_discord
FROM unified_picks
WHERE promotion_band = 'HARD'
  AND meta->>'pick_origin' IS NULL
  AND posted_to_discord = false;
```

---

## Step 4: Restart the Worker

The Temporal worker must be restarted to pick up the new
`discordPromotionActivities` registration.

```bash
# Docker
docker-compose restart api

# Local
pnpm --filter api dev
```

---

## Step 5: Verify Discord Output

After the next 2-minute scheduler cycle, check:

1. **Outbox row created**:
   `SELECT * FROM pick_publish WHERE status = 'posted' ORDER BY sent_at DESC LIMIT 5;`
2. **Receipt persisted**:
   `SELECT id, discord_message_id, meta->'discord_receipt' FROM unified_picks WHERE posted_to_discord = true ORDER BY updated_at DESC LIMIT 5;`
3. **Discord channel**: Check the webhook target channel for new pick embeds

---

## Gate States Reference

| Gate        | Env Var                    | Active Value              | Blocking Value           |
| ----------- | -------------------------- | ------------------------- | ------------------------ |
| Kill switch | `PROMOTION_KILL_SWITCH`    | `false` or unset          | `true`                   |
| Shadow mode | `PROMOTION_SHADOW_MODE`    | unset or `false`          | `true`                   |
| Autopilot   | `AUTOPILOT_MODE`           | `prod`                    | `off`, `log_only`, unset |
| Webhook     | `DISCORD_WEBHOOK_URL`      | set                       | unset                    |
| V2 policy   | `PROMOTION_POLICY_V2`      | `true` (for scored picks) | `false` or unset         |
| Canary      | `PROMOTION_CANARY_PERCENT` | `> 0`                     | `0`                      |

---

## Rollback

To immediately pause Discord posting without restarting the worker:

```bash
# Option 1: Kill switch (instant, survives restart)
PROMOTION_KILL_SWITCH=true

# Option 2: Shadow mode (instant, suppresses all posting)
PROMOTION_SHADOW_MODE=true

# Option 3: AutopilotGuard (blocks all side effects globally)
AUTOPILOT_MODE=log_only
```
