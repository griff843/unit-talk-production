# Runbook: Promotion Pipeline Activation

**Purpose:** Enable picks to flow from grading → Discord **Status Gate:** All
env vars below + worker restarted **Last Updated:** 2026-03-10
(SPRINT-PROMOTION-RUNTIME-ACTIVATION)

---

## Prerequisites

1. Temporal worker is running (`npm run worker:dev` or Docker)
2. Supabase is connected and `unified_picks` table has picks at
   `workflow_stage='approved'`
3. Discord webhook URL is provisioned
4. API health check returns `status: 'healthy'`

---

## Architecture: Gate Chain

Every Discord post passes through these gates in order. **All are fail-closed**
— missing or invalid values block posting.

```
GradingAgent
├─ PROMOTION_KILL_SWITCH ──► if 'true': all picks get promote=false
├─ PROMOTION_POLICY_V2 ───► if 'false': no V2 band assignment
├─ PROMOTION_CANARY_PERCENT ► 0-100% of picks routed through V2
├─ PROMOTION_CANARY_SPORTS ─► CSV sport filter (empty = all)
└─ Band assignment ────────► HARD / SOFT / SUPPRESS

DiscordPromotionAgent
├─ PROMOTION_KILL_SWITCH ──► if 'true': return early, no posting
├─ PROMOTION_SHADOW_MODE ──► if 'true': log only, skip webhook
├─ promotion_band gate ───► must be 'HARD' (or capper origin)
├─ tier gate ──────────────► must not be 'F'
├─ AutopilotGuard ─────────► AUTOPILOT_MODE check
│  ├─ 'off' ───────────────► BLOCKED
│  ├─ 'log_only' ──────────► BLOCKED (logged to autopilot_decisions)
│  ├─ 'canary' ────────────► hash-based % via AUTOPILOT_CANARY_PERCENTAGE
│  └─ 'prod' ──────────────► ALLOWED
├─ DISCORD_WEBHOOK_URL ────► must be set
└─ axios.post() ───────────► webhook call + receipt persistence
```

---

## Complete Environment Variable Reference

### Core Promotion Controls

| Variable                      | Values                   | Default | Controls                                                   |
| ----------------------------- | ------------------------ | ------- | ---------------------------------------------------------- |
| `AUTOPILOT_MODE`              | off/log_only/canary/prod | off     | Universal side-effect gate for all agents                  |
| `AUTOPILOT_CANARY_PERCENTAGE` | 0-100                    | 0       | % of requests allowed when mode=canary (SHA-256 bucketing) |
| `DISCORD_WEBHOOK_URL`         | URL string               | unset   | Target Discord webhook (required for posting)              |
| `PROMOTION_KILL_SWITCH`       | true/unset               | false   | Emergency halt — blocks ALL promotion and posting          |
| `PROMOTION_SHADOW_MODE`       | true/unset               | false   | Suppress Discord posting while running pipeline (opt-in)   |

### Scoring & Band Assignment

| Variable                   | Values             | Default | Controls                                                   |
| -------------------------- | ------------------ | ------- | ---------------------------------------------------------- |
| `PROMOTION_POLICY_V2`      | true/unset         | false   | Enable V2 HARD/SOFT/SUPPRESS band classification           |
| `PROMOTION_HARD_ONLY`      | true/unset         | false   | Restrict auto-promotion to HARD band only                  |
| `PROMOTION_SOFT_ENABLE`    | true/unset         | false   | Allow SOFT band to auto-promote (if HARD_ONLY is not true) |
| `PROMOTION_HARD_MIN_EV`    | decimal            | 0.01    | Minimum expected value for HARD band (1% default)          |
| `PROMOTION_HARD_MIN_CONF`  | 0-10               | 7       | Minimum confidence score for HARD band (7/10 default)      |
| `PROMOTION_CANARY_PERCENT` | 0-100              | 0       | % of picks routed through V2 policy (djb2 hash bucketing)  |
| `PROMOTION_CANARY_SPORTS`  | CSV (e.g. NFL,NBA) | ""      | Sport filter for V2 canary (empty = all sports)            |

### Related but Separate

| Variable      | Default | Note                                                                              |
| ------------- | ------- | --------------------------------------------------------------------------------- |
| `SHADOW_MODE` | false   | ShadowModeService for decision audit trails (separate from PROMOTION_SHADOW_MODE) |

---

## Staged Activation Procedure

### Stage 1: Shadow Validation (No Discord Posts)

Verify the full pipeline runs without side effects.

```bash
# .env or deployment config
AUTOPILOT_MODE=log_only
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/<id>/<token>
PROMOTION_POLICY_V2=true
PROMOTION_CANARY_PERCENT=100
PROMOTION_SHADOW_MODE=true
# PROMOTION_KILL_SWITCH — leave unset (false)
```

**What happens**: Grading assigns promotion bands. DiscordPromotionAgent runs
but logs "Shadow mode — skipped post" instead of calling the webhook. Autopilot
decisions are logged to `autopilot_decisions` table.

**Verification**:

```sql
-- Check picks received promotion bands
SELECT id, promotion_band, tier, workflow_stage
FROM unified_picks
WHERE promotion_band IS NOT NULL
ORDER BY created_at DESC LIMIT 10;

-- Check autopilot decision log
SELECT action_type, decision, mode, reason, created_at
FROM autopilot_decisions
ORDER BY created_at DESC LIMIT 20;
```

```bash
# Health check should show 'degraded' (shadow mode active)
curl http://localhost:3010/health
```

**Success criteria**: Picks have `promotion_band='HARD'`, autopilot decisions
logged, health status `degraded`, zero Discord messages sent.

### Stage 2: Canary Activation (Limited Live Posts)

Route a small percentage through to Discord.

```bash
AUTOPILOT_MODE=canary
AUTOPILOT_CANARY_PERCENTAGE=10           # 10% of picks go live
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/<id>/<token>
PROMOTION_POLICY_V2=true
PROMOTION_CANARY_PERCENT=100
PROMOTION_SHADOW_MODE=                   # unset — allow live posting
# PROMOTION_KILL_SWITCH — leave unset
```

**Optional: restrict to specific sports first**:

```bash
PROMOTION_CANARY_SPORTS=NFL              # Only NFL picks go through canary
```

**What happens**: ~10% of picks (by SHA-256 hash bucketing) are posted to
Discord. The rest are blocked with reason logged. Bucketing is deterministic —
same pick always gets the same bucket.

**Verification**:

```sql
-- Check which picks were posted
SELECT id, posted_to_discord, discord_message_id, promotion_band
FROM unified_picks
WHERE posted_to_discord = true
ORDER BY updated_at DESC LIMIT 10;

-- Check outbox receipts
SELECT * FROM pick_publish
WHERE status = 'posted'
ORDER BY sent_at DESC LIMIT 10;

-- Check autopilot decisions (should see mix of ALLOWED and REJECTED)
SELECT decision, COUNT(*) as cnt
FROM autopilot_decisions
WHERE action_type = 'DISCORD_POST'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY decision;
```

**Discord channel**: Verify embeds appear correctly — formatting, fields, odds.

**Success criteria**: ~10% of eligible picks posted to Discord, embeds render
correctly, outbox receipts persist, no duplicate posts.

### Stage 3: Full Activation

```bash
AUTOPILOT_MODE=prod
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/<id>/<token>
PROMOTION_POLICY_V2=true
PROMOTION_CANARY_PERCENT=100
PROMOTION_HARD_ONLY=true                 # Only HARD band (recommended start)
# PROMOTION_KILL_SWITCH — leave unset
# PROMOTION_SHADOW_MODE — leave unset
```

**What happens**: All HARD-band picks are posted to Discord. AutopilotGuard
allows all side effects in `prod` mode.

**Verification**:

```sql
-- Healthy health check
-- Health should show status='healthy'
curl http://localhost:3010/health
```

---

## Kill Switch Verification

To verify the kill switch works correctly:

```bash
# Set kill switch
PROMOTION_KILL_SWITCH=true
```

**Expected behavior**:

- GradingAgent: sets `promote=false` for all picks (no band assignment)
- DiscordPromotionAgent: `promoteToDiscord()` logs diagnostic and returns early
- Health check: reports `status='unhealthy'`
- No picks are posted to Discord

```sql
-- Confirm no new posts since kill switch activation
SELECT COUNT(*) FROM unified_picks
WHERE posted_to_discord = true
  AND updated_at > '<kill-switch-activation-time>';
-- Expected: 0
```

**To deactivate**: unset `PROMOTION_KILL_SWITCH` (or set to anything other than
`'true'`). No worker restart needed — checked on every cycle.

---

## Pick Eligibility Queries

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

## Rollback Procedures

### Immediate Halt (No Restart Required)

All three options take effect on the next scheduler cycle (~2 min):

| Method      | Command                      | Scope                     | Reversibility      |
| ----------- | ---------------------------- | ------------------------- | ------------------ |
| Kill switch | `PROMOTION_KILL_SWITCH=true` | Promotion only            | Unset to resume    |
| Shadow mode | `PROMOTION_SHADOW_MODE=true` | Discord posting only      | Unset to resume    |
| Autopilot   | `AUTOPILOT_MODE=log_only`    | ALL side effects (global) | Set back to `prod` |

### Severity-Based Rollback Guide

| Scenario                | Recommended Action                                       |
| ----------------------- | -------------------------------------------------------- |
| Bad embed formatting    | `PROMOTION_SHADOW_MODE=true` — fix formatting, re-enable |
| Wrong picks posted      | `PROMOTION_KILL_SWITCH=true` — investigate band logic    |
| Discord rate limited    | `AUTOPILOT_MODE=canary` with low % — reduce volume       |
| Unexpected side effects | `AUTOPILOT_MODE=off` — full halt, investigate            |
| System-wide incident    | `AUTOPILOT_MODE=off` — blocks ALL agents                 |

### Recovery After Rollback

1. Fix the root cause
2. Re-enable in shadow mode first (`PROMOTION_SHADOW_MODE=true`)
3. Verify picks flow through without posting
4. Remove shadow mode to resume live posting

---

## Monitoring Checklist

### Health Endpoint

```bash
curl http://localhost:3010/health
```

Expected fields in Discord promotion health:

- `status`: healthy / degraded / unhealthy
- `webhookConfigured`: true
- `shadowModeEnabled`: false (when live)
- `killSwitchActive`: false
- `pendingCount`: number of picks awaiting posting
- `recentlyPosted`: count posted in last 24h
- `oldestPendingMinutes`: age of oldest unposted pick

### Alert Thresholds

| Metric                 | Warning  | Critical  |
| ---------------------- | -------- | --------- |
| `oldestPendingMinutes` | > 60     | > 120     |
| `pendingCount`         | > 50     | > 200     |
| `status`               | degraded | unhealthy |

### Key Logs to Watch

```
# Successful post
"Discord post succeeded" pick_id=<id> message_id=<snowflake>

# Shadow mode skip
"Shadow mode — skipped capper post"

# Kill switch block
"Promotion kill switch active — skipping all posting"

# Autopilot block
"Discord post blocked by AutopilotGuard" mode=<mode> reason=<reason>

# Autopilot allow
"Discord post allowed by AutopilotGuard" mode=<mode>
```

---

## Gate States Reference

| Gate        | Env Var                       | Active Value             | Blocking Value           |
| ----------- | ----------------------------- | ------------------------ | ------------------------ |
| Kill switch | `PROMOTION_KILL_SWITCH`       | unset or `false`         | `true`                   |
| Shadow mode | `PROMOTION_SHADOW_MODE`       | unset                    | `true`                   |
| Autopilot   | `AUTOPILOT_MODE`              | `prod`                   | `off`, `log_only`, unset |
| Canary %    | `AUTOPILOT_CANARY_PERCENTAGE` | 1-100 (when mode=canary) | `0`                      |
| Webhook     | `DISCORD_WEBHOOK_URL`         | set                      | unset                    |
| V2 policy   | `PROMOTION_POLICY_V2`         | `true`                   | unset                    |
| Band canary | `PROMOTION_CANARY_PERCENT`    | 1-100                    | `0`                      |
| Band sports | `PROMOTION_CANARY_SPORTS`     | CSV                      | empty (allows all)       |
