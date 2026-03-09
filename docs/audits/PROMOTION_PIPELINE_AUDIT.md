# Promotion Pipeline Audit

**Sprint:** SPRINT-PROMOTION-PIPELINE-ACTIVATION **Date:** 2026-03-09
**Status:** ✅ Root causes identified and fixed

---

## Executive Summary

The promotion pipeline (graded picks → Discord) was dormant due to three layered
architectural gaps:

1. `DiscordPromotionAgent` had no Temporal activity and was never invoked by the
   scheduler
2. `isPromotionShadowMode()` defaulted to `true` (opt-out) blocking all posting
   silently
3. `AutopilotGuard` defaults to `off` unless `AUTOPILOT_MODE=prod` is set

---

## Audit Trail: Gate Chain

### Gate 0: PromotionPolicy Kill Switch

- Env: `PROMOTION_KILL_SWITCH`
- Default: `false` — **does not block**
- Code: `parsePromotionPolicyConfig().killSwitch`

### Gate 1: `isPromotionShadowMode()` — **PRIMARY BLOCKER (fixed)**

- File: `agents/DiscordPromotionAgent/index.ts:57`
- Old code: `return process.env['PROMOTION_SHADOW_MODE'] !== 'false'`
- **Effect**: Defaults to `true` → ALL posting silently skipped in every
  processing loop
- Same pattern in `services/PromotionGatekeeper.ts:312`
- **Fix**: Changed to `=== 'true'` (opt-in shadow mode, matching all other
  shadow patterns)

### Gate 2: `AutopilotGuard.determineMode()` — **SECONDARY BLOCKER (env var)**

- File: `lib/AutopilotGuard.ts:368`
- Default: `off` (all side effects blocked)
- Controlled by `AUTOPILOT_MODE` env var
- Only `prod` or `canary` allows Discord posts
- **Required env var**: `AUTOPILOT_MODE=prod`

### Gate 3: Pick-Level Gates in `postEliteCardToDiscord()`

- `pick.tier === 'F'` → blocked
- `!pick.promotion_band` → blocked
- `pick.promotion_band !== 'HARD'` → blocked (legacy/system path)
- `!DISCORD_WEBHOOK_URL` → return null (no Discord call)
- Posting gate (missing fields) → blocked
- Embed readiness gate → blocked

### Gate 4: Pick Selection Requirements

- **Capper picks**: `meta.pick_origin = 'capper'`, `posted_to_discord = false`
- **System picks**: `meta.pick_origin = 'system'`,
  `meta.system_approved = 'true'`
- **Legacy picks**: `promotion_band = 'HARD'`, `meta.pick_origin IS NULL`

### Gate 5: Promotion Policy (`PROMOTION_POLICY_V2`)

- Applies to scored picks entering the system path
- `PROMOTION_POLICY_V2=true` required for V2 scoring to produce
  `promotion_band='HARD'`
- Feature snapshot + probability primitives required (constitutional gates)

---

## Invocation Gap (Architectural Fix)

**Before:** `promoteToDiscord()` was never called by any scheduler, workflow, or
Temporal worker.

- `syndicate-scheduler.ts` comment said "handled by DiscordPromotionAgent" but
  didn't call it
- No `activities.ts` existed for the agent
- Not registered in `start-all-agents.ts`
- Agent only ran if executed directly as a script

**After:** Wired into Temporal runtime:

1. Created `agents/DiscordPromotionAgent/activities.ts` with
   `runDiscordPromotion()` activity
2. Registered in `workers/start-all-agents.ts` via
   `...discordPromotionActivities`
3. Called from `discordAlertWorkflow` in `syndicate-scheduler.ts` (runs every 2
   minutes)
4. Added `DiscordPromotionActivities` interface to `types/activities.ts`

---

## Files Modified

| File                                         | Change                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| `agents/DiscordPromotionAgent/index.ts`      | Fixed `isPromotionShadowMode()` opt-out → opt-in; added startup diagnostics |
| `agents/DiscordPromotionAgent/activities.ts` | CREATED — Temporal activities wrapper                                       |
| `services/PromotionGatekeeper.ts`            | Fixed same inverted shadow mode default                                     |
| `workers/start-all-agents.ts`                | Added discordPromotionActivities registration                               |
| `workflows/syndicate-scheduler.ts`           | Added activity proxy + call in discordAlertWorkflow                         |
| `types/activities.ts`                        | Added DiscordPromotionActivities interface                                  |

---

## Required Env Vars for Production Activation

```
# Required
AUTOPILOT_MODE=prod
DISCORD_WEBHOOK_URL=<your-discord-webhook-url>

# Must NOT be set, or set to false
PROMOTION_SHADOW_MODE=         # unset = posting active (was the bug: previously required ='false')

# For scored picks to get promotion_band='HARD'
PROMOTION_POLICY_V2=true
PROMOTION_CANARY_PERCENT=100   # or desired rollout %
```

See `docs/runbooks/PROMOTION_PIPELINE_ACTIVATION.md` for full activation guide.
