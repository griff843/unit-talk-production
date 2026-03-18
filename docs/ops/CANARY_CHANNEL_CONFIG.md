# Canary Channel Configuration

**Status**: CONFIRMED
**Authority**: Required by `docs/ops/PRODUCTION_READINESS_CONTRACT.md` §5.4, §13
**Last Updated**: 2026-03-18 (SPRINT-CANARY-CHANNEL-CONFIG-CONFIRMATION)

> Canary audit gate was previously blocked by this file being in PENDING state.
> Operator has confirmed the channel ID and separation. This file is now
> operationally populated. The raw webhook secret is NOT stored here — it lives
> in the environment as `DISCORD_CANARY_WEBHOOK_URL`.

---

## Purpose

Defines the designated canary Discord channel used for canary-mode pick posting
(`DISCORD_MODE=canary`). This channel receives pick posts during canary testing
and must be:

- separate from all subscriber-facing channels,
- accessible only to operators and testers,
- correctly configured in the production environment via `DISCORD_CANARY_WEBHOOK_URL`.

---

## Confirmed Fields

| Field                                       | Value                  | Status    |
| ------------------------------------------- | ---------------------- | --------- |
| Canary channel name                         | *(operator-optional)*  | OPTIONAL  |
| Canary channel ID                           | `1296531122234327100`  | CONFIRMED |
| Canary webhook URL env var                  | `DISCORD_CANARY_WEBHOOK_URL` | CONFIRMED |
| Canary channel type                         | Internal / operator-only | CONFIRMED |
| Confirmed separate from subscriber channels | Yes — operator confirmed 2026-03-18 | CONFIRMED |

> **Security note**: The raw webhook URL is configured as
> `DISCORD_CANARY_WEBHOOK_URL` in the environment. It is present in `.env`
> (gitignored) and must be set in K8s Secrets / runtime environment for
> production. Do not commit the raw webhook URL to any tracked file.

---

## Env Var Authority

The canary routing system reads `DISCORD_CANARY_WEBHOOK_URL` in two places:

- `apps/api/src/config/discordRouting.ts` — routing resolver; throws if missing
  in `DISCORD_MODE=canary`
- `apps/api/src/lib/canaryPublisher.ts` — direct webhook publisher

If `DISCORD_CANARY_WEBHOOK_URL` is unset when `DISCORD_MODE=canary`, the
runtime throws:

```
DISCORD_CANARY_WEBHOOK_URL is required in canary mode but not configured
```

The `.env.runtime.local.example` also documents `DISCORD_CANARY_PUBLISH_CHANNEL_ID`
as a supplemental channel ID env var, but the routing gate uses the webhook URL
as the primary routing key. Both should be set in production.

---

## Audit Verification

The production-day canary audit gate verifies:

1. `DISCORD_MODE=canary` routes posts to the webhook backed by channel
   `1296531122234327100`.
2. Posts do **not** appear in any subscriber-facing channel.
3. `DISCORD_CANARY_WEBHOOK_URL` is set and non-empty in the audited environment.

This file is **no longer in PENDING state**. The canary-mode audit gate may now
proceed to evidence collection.
