# Smart Form E2E Trace - Complete Flow Analysis

**PR**: PR #36 Go-Live Hardening **Date**: 2026-01-20 **Author**: Release
Integrity Engineer

---

## Executive Summary

This document traces the complete end-to-end flow from Smart Form submission to
Discord posting, based on **repository discovery evidence** (not assumptions).
The trace reveals multiple parallel publishing paths and a critical gap where
the canonical `pick_publish` table is not integrated into the production flow.

---

## Flow Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         SMART FORM E2E FLOW                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   Smart Form UI                                                               │
│        │                                                                      │
│        ▼                                                                      │
│   POST /api/submit-ticket                                                     │
│        │                                                                      │
│        ├────────────────┬────────────────┬────────────────┐                  │
│        ▼                ▼                ▼                ▼                  │
│   smart_tickets    unified_picks    bridge_outbox    (Response)              │
│        │                │                │                                    │
│        │                │                ▼                                    │
│        │                │         BridgeWorker                               │
│        │                │                │                                    │
│        │                │                ▼                                    │
│        │                │    eventDrivenGradingWorkflow                      │
│        │                │                                                     │
│        │                ▼                                                     │
│        │           AlertAgent.monitorLivePicks()                             │
│        │                │                                                     │
│        │                ▼                                                     │
│        │        sendDiscordAlert()                                            │
│        │                │                                                     │
│        │                ▼                                                     │
│        │           Discord Channel (capper thread)                           │
│        │                                                                      │
│   (PARALLEL PATH)                                                             │
│        └──────► SmartFormBridge.processSubmission() ◄── (Optional trigger)   │
│                        │                                                      │
│                        ├── daily_picks                                        │
│                        ├── pick_insights                                      │
│                        └── unified_picks (auto-approved)                     │
│                                                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│   ❌ CANONICAL pick_publish TABLE: NOT INTEGRATED IN PRODUCTION FLOW         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Flow Trace

### Step 1: Smart Form Submission

**File**: `apps/smart-form/app/api/submit-ticket/route.ts`

**Evidence Location**: Lines 1-150+ (POST handler)

**Actions**:

1. Receives ticket data from Smart Form UI
2. Generates unique `bet_slip_id` (UUID)
3. Validates capper exists via `/api/cappers` route
4. **Writes to `smart_tickets` table**
5. **Writes legs to `unified_picks` table**
6. **Writes event to `bridge_outbox` table**:
   ```typescript
   {
     event_type: 'ticket_submitted',
     payload: { bet_slip_id, capper_id, selection_count },
     unique_key: bet_slip_id,  // Idempotency key
     status: 'pending',
     attempts: 0,
     max_attempts: 3
   }
   ```

**Tables Written**: | Table | Purpose | |-------|---------| | `smart_tickets` |
Ticket metadata | | `unified_picks` | Individual pick legs | | `bridge_outbox` |
Event for async processing |

---

### Step 2: Bridge Outbox Publishing

**File**: `apps/smart-form/bridge/publish.ts`

**Evidence Location**: Lines 21-69 (`publishTicketSubmitted` function)

**Key Implementation**:

```typescript
await supabase.from('bridge_outbox').insert({
  event_type: 'ticket_submitted',
  payload: eventData,
  unique_key: eventData.bet_slip_id,
  status: 'pending',
  attempts: 0,
  max_attempts: 3,
  next_attempt_at: new Date(Date.now() + 5000),
});
```

**Idempotency**: Uses `bet_slip_id` as unique key, handles duplicate submission
gracefully.

---

### Step 3: BridgeWorker Event Processing

**File**: `apps/api/src/workers/BridgeWorker.ts`

**Evidence Location**: Lines 1-300+

**Responsibilities**:

1. Polls `bridge_outbox` table for `status = 'pending'`
2. Handles `ticket_submitted` event type
3. Triggers grading workflows
4. Updates outbox status to `processed` or `failed`

**Event Handler**:

```typescript
this.eventSubscriptions.set(
  'ticket_submitted',
  this.handleBridgeOutboxTicketSubmitted.bind(this)
);
```

**Circuit Breaker**: Exponential backoff retry at 1min, 5min, 15min intervals.

---

### Step 4: Grading Workflow

**File**: `apps/api/src/workflows/event-driven-grading-simple.ts`

**Evidence Location**: Lines 129-330 (`eventDrivenGradingWorkflow`)

**Processing Steps**:

1. Idempotency check via `bet_slip_id`
2. Extract and validate selections
3. Process each leg with circuit breaker protection
4. Calculate combined grading result
5. Generate alerts for high-tier picks (S/A)
6. Store workflow result

**Grading Result Structure**:

```typescript
{
  tier: 'S-tier' | 'A-tier' | 'B-tier' | 'C-tier' | 'D-tier',
  confidence: number,
  edgeScore: number,
  professionalScore?: number,
  featureContributions?: { /* 8 professional features */ }
}
```

---

### Step 5: Discord Publishing (AlertAgent Path)

**File**: `apps/api/src/agents/AlertAgent/index.ts`

**Evidence Location**: Lines 520-712 (`monitorLivePicks`, `postLivePick`)

**Query Pattern**:

```typescript
const { data: livePicks } = await supabase
  .from('unified_picks')
  .select('*')
  .eq('play_status', 'pending')
  .eq('posted_to_discord', false)
  .order('created_at', { ascending: true });
```

**Channel Routing**:

- **Capper Thread**: `env.capperThreads[capperName]`
- **Fallback**: `SYSTEM_ALERTS_THREAD_ID` or `ADMIN_CHANNEL_ID`

**AutopilotGuard**: All Discord posts go through
`autopilotGuard.assertMayPerformSideEffect()`

**Post-Publish Update**:

```typescript
await supabase
  .from('unified_picks')
  .update({
    posted_to_discord: true,
    discord_post_id: messageId,
  })
  .eq('id', pickId);
```

---

### Step 6: Discord Publishing (DiscordPromotionAgent Path - PARALLEL)

**File**: `apps/api/src/agents/DiscordPromotionAgent/index.ts`

**Evidence Location**: Lines 100-128 (`promoteToDiscord`)

**Query Pattern**:

```typescript
const { data: picks } = await supabase
  .from('unified_picks')
  .select('*')
  .eq('posted_to_discord', false)
  .eq('auto_approved', true)
  .or('tier.in.("{S,A}"),bet_type.in.("{parlay,teaser,rr}")')
  .order('created_at', { ascending: false })
  .limit(10);
```

**Publish Method**: Webhook POST to `DISCORD_WEBHOOK_URL`

---

### Step 7: Discord Publishing (DailyPickPublisher Path - BATCH)

**File**: `apps/api/src/services/dailyPickPublisher.ts`

**Evidence Location**: Lines 38-95 (`publishDailyPicks`)

**Trigger**: Manual or scheduled batch publishing at 10 AM EST

**Method**: Discord.js client with EmbedBuilder

---

## Environment Configuration (Discovered)

**File**: `apps/api/src/config/env.ts`

| Variable                  | Purpose                               | Evidence          |
| ------------------------- | ------------------------------------- | ----------------- |
| `CAPPER_THREADS`          | JSON map of capper → thread ID        | Line 93-106       |
| `ALERTS_CHANNEL_ID`       | Alerts channel for hedge/injury/steam | Line 109          |
| `SYSTEM_ALERTS_THREAD_ID` | System error notifications            | Line 107          |
| `DISCORD_WEBHOOK_URL`     | Webhook for DiscordPromotionAgent     | env.ts            |
| `AUTOPILOT_MODE`          | off/log_only/canary/prod              | AutopilotGuard.ts |

**Example CAPPER_THREADS**:

```json
{
  "Griff843": "1234567890",
  "Vicgo": "0987654321",
  "Sauced": "1357924680"
}
```

---

## AutopilotGuard Integration

**File**: `apps/api/src/lib/AutopilotGuard.ts`

**Role**: Single choke-point for ALL external side effects

**Modes**: | Mode | Behavior | |------|----------| | `off` | All side effects
blocked | | `log_only` | Logged but not executed | | `canary` | Percentage-based
rollout | | `prod` | Full side effects allowed |

**Evidence Trail**: Every decision logged to `autopilot_decisions` table

---

## Message Formatting

**File**: `apps/api/src/services/EnhancedDiscordFormatter.ts`

**Features**:

- Tier-based color coding (Gold=S, Green=A, Blue=B, Purple=C)
- Live indicator (red pulse)
- Edge score, Kelly %, EV display
- Risk assessment badges
- Fortune 100-grade visual design

---

## Critical Gap: pick_publish Table

### Expected Flow (per E2E Test)

```
Smart Form → TicketLifecycleWorkflow → pick_publish → DiscordPublishingWorker → Discord
```

### Actual Flow (Discovered)

```
Smart Form → bridge_outbox → BridgeWorker → unified_picks → AlertAgent → Discord
```

### Missing Components

| Component                 | Status                                       |
| ------------------------- | -------------------------------------------- |
| `TicketLifecycleWorkflow` | Referenced in E2E test, **NOT IMPLEMENTED**  |
| Write to `pick_publish`   | Schema exists, **NO PRODUCTION CODE WRITES** |
| `DiscordPublishingWorker` | Referenced in E2E test, **NOT IMPLEMENTED**  |

### Evidence of Gap

```bash
# Search results for pick_publish insert
grep -r "pick_publish.*insert" --include="*.ts"
# Only found in: scripts/phase6-e2e-validation.ts (test script, not production)
```

---

## Flow Verification Checklist

| Step | Component                | Status      | Evidence File                                         |
| ---- | ------------------------ | ----------- | ----------------------------------------------------- |
| 1    | Smart Form POST          | EXISTS      | apps/smart-form/app/api/submit-ticket/route.ts        |
| 2    | smart_tickets write      | EXISTS      | apps/smart-form/app/api/submit-ticket/route.ts        |
| 3    | unified_picks write      | EXISTS      | apps/smart-form/app/api/submit-ticket/route.ts        |
| 4    | bridge_outbox write      | EXISTS      | apps/smart-form/bridge/publish.ts                     |
| 5    | BridgeWorker consume     | EXISTS      | apps/api/src/workers/BridgeWorker.ts                  |
| 6    | Grading workflow         | EXISTS      | apps/api/src/workflows/event-driven-grading-simple.ts |
| 7    | pick_publish write       | **MISSING** | NOT FOUND                                             |
| 8    | DiscordPublishingWorker  | **MISSING** | NOT FOUND                                             |
| 9    | AlertAgent polling       | EXISTS      | apps/api/src/agents/AlertAgent/index.ts               |
| 10   | Discord post             | EXISTS      | Multiple paths (AlertAgent, DiscordPromotionAgent)    |
| 11   | posted_to_discord update | EXISTS      | apps/api/src/agents/AlertAgent/index.ts:695           |

---

## Recommendations

### Option A: Integrate pick_publish (Canonical Compliance)

1. Implement `TicketLifecycleWorkflow` that writes to `pick_publish`
2. Create `DiscordPublishingWorker` that consumes from `pick_publish`
3. Retire direct AlertAgent/DiscordPromotionAgent unified_picks polling

### Option B: Document Current Flow (Accept Reality)

1. Update E2E tests to match actual flow
2. Consider `pick_publish` as future enhancement
3. Document `unified_picks.posted_to_discord` as the current mechanism

### Option C: Hybrid Approach

1. Use `pick_publish` for audit trail and retry queue
2. Keep AlertAgent for real-time processing
3. Add bridge from grading workflow → `pick_publish` for observability

---

## Conclusion

The Smart Form E2E flow **WORKS** but follows a different path than the
canonical architecture suggests. The actual flow uses
`unified_picks.posted_to_discord` flag for state management rather than the
`pick_publish` outbox pattern.

**Current Status**: FUNCTIONAL (via AlertAgent/DiscordPromotionAgent paths)
**Canonical Compliance**: PARTIAL (pick_publish not integrated)

---

_Document generated from repository evidence discovery. No assumptions made._
