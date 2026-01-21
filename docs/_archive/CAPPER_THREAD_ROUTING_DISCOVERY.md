# Capper Thread Routing Discovery Report

**PR**: PR10 (PR #36) Go-Live Hardening
**Date**: 2026-01-20
**Status**: COMPLETE

---

## Executive Summary

This report documents the discovery of all capper thread routing logic in the Unit Talk codebase. The system supports a **three-tier fallback strategy** for resolving capper Discord threads: DB → ENV → AUTO-PROVISION.

---

## Routing Architecture Overview

```
                    ┌─────────────────────────────────────────┐
                    │         ROUTING SOURCES                  │
                    └─────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
   ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
   │  user_threads │          │  .env file   │          │ Auto-Provision│
   │   (Supabase)  │          │ (capperThreads│          │  (Discord API) │
   │   PRIORITY 1  │          │   object)     │          │   PRIORITY 3   │
   │               │          │  PRIORITY 2   │          │ (if enabled)   │
   └──────────────┘          └──────────────┘          └──────────────┘
          │                           │                           │
          └───────────────────────────┴───────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────────┐
                    │       CapperThreadResolver              │
                    │  apps/api/src/services/                 │
                    │  CapperThreadResolver.ts                │
                    └─────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┴───────────────────────────┐
          │                                                       │
          ▼                                                       ▼
   ┌──────────────┐                                      ┌──────────────┐
   │ Pick Posts   │                                      │    Alerts    │
   │ → Capper     │                                      │ → Dedicated  │
   │   Threads    │                                      │   Channels   │
   └──────────────┘                                      └──────────────┘
```

---

## Key Services and Files

### 1. CapperThreadResolver (`apps/api/src/services/CapperThreadResolver.ts`)

**Purpose**: Single source of truth for resolving capper thread IDs

**Lookup Order**:
1. **DB** (`user_threads` table) - If `CAPPER_THREAD_DB_ENABLED=true`
2. **ENV** (`capperThreads` object in config) - Fallback
3. **AUTO-PROVISION** - If `CAPPER_THREAD_AUTOCREATE=true` AND `CAPPERS_FORUM_ID` is set

**Key Methods**:
```typescript
class CapperThreadResolver {
  // Get thread from DB by discord_id
  async getFromDb(discordId: string, type: ThreadType): Promise<string|null>

  // Get thread from .env by capper handle
  private getFromEnv(handle?: string, type?: ThreadType): string|null

  // Persist to DB (upgrade env → db)
  private async persistToDb(discordId: string, type: ThreadType, threadId: string)

  // Main entry point - ensure threads exist
  async ensure(params: EnsureParams): Promise<EnsureResult>

  // Auto-create thread in Discord forum
  private async createCapperThread(forumId: string, handle: string, type: ThreadType)
}
```

**Thread Types**:
- `picks` - Capper's picks/betting thread
- `qa` - Capper's Q&A discussion thread

---

### 2. DiscordAlertRouter (`apps/api/src/services/DiscordAlertRouter.ts`)

**Purpose**: Route different alert types to appropriate Discord channels

**Routing Rules**:

| Alert Type | Destination | Config Source |
|------------|-------------|---------------|
| `pick_post` | Capper's thread | `env.capperThreads[capper]` |
| `hedge_opportunity` | Alerts channel | `env.alertsChannelId` |
| `middle_opportunity` | Alerts channel | `env.alertsChannelId` |
| `injury_impact` | Alerts channel | `env.alertsChannelId` |
| `steam_move` | Alerts channel | `env.alertsChannelId` |
| `line_movement` | Alerts channel | `env.alertsChannelId` |
| `stale_line` | Alerts channel | `env.alertsChannelId` |
| `system_error` | System alerts | `env.systemAlertsThreadId` |
| `processing_error` | System alerts | `env.systemAlertsThreadId` |

---

### 3. SmartFormBridge (`apps/api/src/services/SmartFormBridge.ts`)

**Purpose**: Process smart form submissions and route to Discord

**Routing Logic**:
```typescript
// Step 1: Validate capper has thread configured
const capperThreadId = this.getCapperThreadId(smartTicket.capper);
if (!capperThreadId) {
  throw new Error(`Invalid or inactive capper: ${smartTicket.capper}`);
}

// Step 2: Route based on market type
if (smartTicket.market_type === 'live') {
  // Live picks → game thread or capper thread
  const routingTarget = await this.determineRoutingTarget(smartTicket, capperThreadId);
  await this.processLivePick(pickId, routingTarget);
} else {
  // Pre-game → scheduled batch posting
  await this.scheduleForBatchPosting(pickId);
}
```

---

### 4. Environment Configuration (`apps/api/src/config/env.ts`)

**Capper Thread Mappings**:
```typescript
capperThreads: {
  'Noahthegoon': process.env.CAPPER_THREAD_NOAHTHEGOON || '',
  'KingRo623': process.env.CAPPER_THREAD_KINGRO623 || '',
  'Griff843': process.env.CAPPER_THREAD_GRIFF843 || '',
  'Jaybird': process.env.CAPPER_THREAD_JAYBIRD || '',
  'dub': process.env.CAPPER_THREAD_DUB || '',
  'Vicgo': process.env.CAPPER_THREAD_VICGO || '',
  'Sauced': process.env.CAPPER_THREAD_SAUCED || '',
  'Ziplock': process.env.CAPPER_THREAD_ZIPLOCK || '',
  'Squirrel': process.env.CAPPER_THREAD_SQUIRREL || '',
  'Polo': process.env.CAPPER_THREAD_POLO || '',
  'MoneyReef': process.env.CAPPER_THREAD_MONEYREEF || ''
}
```

**Other Thread Configs**:
```typescript
systemAlertsThreadId: process.env.SYSTEM_ALERTS_THREAD_ID || '',
alertsChannelId: process.env.ALERTS_CHANNEL_ID || ''
```

---

## Database Schema: user_threads

**Table**: `user_threads` (not currently applied)

**Purpose**: Database-first authority for capper thread mappings

**Schema** (from `upsert-user-threads.ts`):
```sql
CREATE TABLE user_threads (
  discord_id TEXT NOT NULL,
  thread_type TEXT NOT NULL CHECK (thread_type IN ('picks', 'qa')),
  thread_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (discord_id, thread_type)
);
```

**Feature Flags**:
- `CAPPER_THREAD_DB_ENABLED=true` - Enable DB lookup
- `CAPPER_THREAD_AUTOCREATE=true` - Enable auto-provisioning
- `CAPPERS_FORUM_ID=<discord_forum_id>` - Forum for auto-created threads

**Migration Status**: NOT APPLIED (migration file missing)

---

## Routing Flow Diagram

```
Smart Form Submission
        │
        ▼
┌───────────────────┐
│  SmartFormBridge  │
│  processSubmission│
└────────┬──────────┘
         │
         ▼
┌───────────────────┐     ┌─────────────────────────┐
│ getCapperThreadId │────►│ CapperThreadResolver    │
└────────┬──────────┘     │ 1. Check user_threads   │
         │                │ 2. Check env.capperThreads│
         │                │ 3. Auto-create if enabled │
         │                └─────────────────────────┘
         ▼
┌───────────────────┐
│ determineRouting  │
│ Target            │
└────────┬──────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 LIVE      SCHEDULED
    │         │
    ▼         ▼
┌─────────┐  ┌─────────────────┐
│ Game    │  │ scheduleFor     │
│ Thread  │  │ BatchPosting    │
│ OR      │  └─────────────────┘
│ Capper  │
│ Thread  │
└─────────┘
```

---

## Current Configuration Status

### CANARY Mode (Current)

| Setting | Value | Status |
|---------|-------|--------|
| `CANARY_MODE` | `true` | ACTIVE |
| `CANARY_PERCENTAGE` | `50` | SET |
| `DISCORD_CANARY_CHANNEL_ID` | `1296531122234327100` | CONFIGURED |

In CANARY mode, ALL picks route to the CANARY channel regardless of capper.

### Production Mode (Required for Go-Live)

| Setting | Required Value | Current Status |
|---------|----------------|----------------|
| `AUTOPILOT_MODE` | `prod` | NOT SET |
| `CAPPER_THREAD_GRIFF843` | `<thread_id>` | NOT SET |
| `CAPPER_THREAD_VICGO` | `<thread_id>` | NOT SET |
| `CAPPER_THREAD_SAUCED` | `<thread_id>` | NOT SET |
| ... | ... | ... |
| `ALERTS_CHANNEL_ID` | `<channel_id>` | NOT SET |
| `SYSTEM_ALERTS_THREAD_ID` | `<thread_id>` | NOT SET |

---

## Recommendations

### 1. Enable DB-First Routing (Recommended)

**Rationale**: DB provides flexibility, audit trail, and admin UI potential

**Steps**:
1. Apply `user_threads` table migration
2. Set `CAPPER_THREAD_DB_ENABLED=true`
3. Seed initial data via `upsert-user-threads.ts`

### 2. Configure Production Thread IDs

**Rationale**: Required for per-capper routing

**Template**:
```bash
# Add to .env for production
AUTOPILOT_MODE=prod
CAPPER_THREAD_GRIFF843=<discord_thread_id>
CAPPER_THREAD_VICGO=<discord_thread_id>
CAPPER_THREAD_SAUCED=<discord_thread_id>
CAPPER_THREAD_NOAHTHEGOON=<discord_thread_id>
CAPPER_THREAD_KINGRO623=<discord_thread_id>
CAPPER_THREAD_JAYBIRD=<discord_thread_id>
CAPPER_THREAD_DUB=<discord_thread_id>
CAPPER_THREAD_ZIPLOCK=<discord_thread_id>
CAPPER_THREAD_SQUIRREL=<discord_thread_id>
CAPPER_THREAD_POLO=<discord_thread_id>
CAPPER_THREAD_MONEYREEF=<discord_thread_id>
ALERTS_CHANNEL_ID=<channel_id>
SYSTEM_ALERTS_THREAD_ID=<thread_id>
```

### 3. Consider Auto-Provisioning

**Rationale**: Reduces manual setup, creates threads on-demand

**Steps**:
1. Create a Discord forum channel for cappers
2. Set `CAPPERS_FORUM_ID=<forum_channel_id>`
3. Set `CAPPER_THREAD_AUTOCREATE=true`
4. Set `CH_OPS_BRIEFING=<ops_channel_id>` for alerts

---

## Evidence Files

| File | Purpose |
|------|---------|
| `apps/api/src/services/CapperThreadResolver.ts` | Main resolver logic |
| `apps/api/src/services/DiscordAlertRouter.ts` | Alert routing |
| `apps/api/src/services/SmartFormBridge.ts` | Form processing |
| `apps/api/src/config/env.ts` | Environment config |
| `apps/api/src/scripts/upsert-user-threads.ts` | DB seeding script |
| `apps/api/src/scripts/smoke-capper-thread-routing.ts` | Testing script |

---

## Conclusion

The capper thread routing system is **well-architected** with a three-tier fallback strategy. Current blockers:

1. **user_threads migration not applied** - DB routing disabled
2. **Production thread IDs not configured** - CANARY mode only
3. **No auto-provisioning enabled** - Manual thread creation required

**Priority for Go-Live**: Configure production thread IDs in `.env` OR apply DB migration and seed via `upsert-user-threads.ts`.

---

*Report generated: 2026-01-20*
*Code evidence from: apps/api/src/services/*
