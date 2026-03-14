# Sprint Closeout: SPRINT-DISCORD-GATEWAY-INTENTS-ENABLEMENT

**Date**: 2026-03-14 **Status**: COMPLETE **Linear**: TBD **Branch**:
sprint/discord-gateway-intents-enablement → main

## Summary

Resolved Discord gateway disconnection ("Used disallowed intents") by removing
unnecessary `GatewayIntentBits.GuildPresences` from bot client configuration.
Added gateway connectivity status singleton and split health monitoring into
`discord_api` (REST) and `discord_gateway` (WebSocket) checks. Documented
explicit privileged intent requirements in PRODUCTION_DEPLOYMENT_GUIDE.md.

## Verification

- TypeScript: 0 errors
- Lifecycle gate: 988 files scanned, 0 violations, PASS
- GuildPresences removed from intents (3 privileged → 2 privileged)
- discord_gateway health check added to /health and /ready

## Remaining Operator Action

Enable Server Members Intent + Message Content Intent in Discord Developer
Portal (documented in HANDOFF_SUMMARY.md and PRODUCTION_DEPLOYMENT_GUIDE.md).

## Proof Location

out/sprints/SPRINT-DISCORD-GATEWAY-INTENTS-ENABLEMENT/2026-03-14/
