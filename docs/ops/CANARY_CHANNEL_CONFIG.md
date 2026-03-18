# Canary Channel Configuration

**Status**: PENDING OPERATOR CONFIGURATION
**Authority**: Required by `docs/ops/PRODUCTION_READINESS_CONTRACT.md` §5.4, §13
**Last Updated**: 2026-03-18

> This file must be populated with confirmed Discord channel IDs before any
> canary-mode audit gate can be evaluated. An audit cannot verify correct channel
> routing without a documented expected-channel reference.

---

## Purpose

Defines the designated canary Discord channel(s) used for canary-mode pick
posting (`AUTOPILOT_MODE=canary`). These channels receive pick posts during
canary testing and must be:

- separate from all subscriber-facing channels,
- accessible only to operators and testers,
- correctly configured in the production environment (`DISCORD_CANARY_WEBHOOK_URL`
  or equivalent env var).

---

## Required Fields

The following must be populated before the canary-mode audit gate is run:

| Field | Value | Status |
|-------|-------|--------|
| Canary channel name | *(operator to fill)* | PENDING |
| Canary channel ID | *(operator to fill — 18-digit Discord snowflake)* | PENDING |
| Canary webhook URL env var | `DISCORD_CANARY_WEBHOOK_URL` *(confirm name)* | PENDING |
| Canary channel type | Internal / operator-only | PENDING |
| Confirmed separate from subscriber channels | *(operator to confirm: yes/no)* | PENDING |

---

## How to Complete This File

1. Navigate to the canary Discord channel in the Unit Talk server.
2. Copy the channel ID (right-click channel → Copy Channel ID with Developer
   Mode enabled).
3. Replace the `*(operator to fill)*` placeholders above with actual values.
4. Confirm the channel is not accessible to subscribers.
5. Confirm the env var name matches what is configured in the production
   environment.
6. Update **Status** column to CONFIRMED for each field.
7. Change the document-level status from `PENDING OPERATOR CONFIGURATION` to
   `CONFIRMED`.

---

## Audit Prerequisite

The production-day audit will verify canary channel routing by checking that
posts in canary mode appear in the channel ID documented here and do **not**
appear in subscriber channels. If this file is in `PENDING` state, the
canary-mode audit gate returns `INSUFFICIENT EVIDENCE`.
