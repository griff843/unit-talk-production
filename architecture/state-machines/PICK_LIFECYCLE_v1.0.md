# PICK LIFECYCLE CONTRACT

> **Version**: 1.0.0 **Sprint**: LIFECYCLE-CONTRACT-LOCK-037 **Date**:
> 2026-02-18 **Status**: AUTHORITATIVE

This document is the **single source of truth** for pick lifecycle management in
the Unit Talk platform. All implementations MUST conform to this contract.

---

## Table of Contents

1. [Entities in Scope](#1-entities-in-scope)
2. [Canonical Fields](#2-canonical-fields)
3. [State Transitions (FSM)](#3-state-transitions-fsm)
4. [Invariants](#4-invariants)
5. [Error Taxonomy](#5-error-taxonomy)
6. [Single-Writer Authority Map](#6-single-writer-authority-map)
7. [Command Center Truth Model](#7-command-center-truth-model)
8. [Implementation Requirements](#8-implementation-requirements)

---

## 1. Entities in Scope

### 1.1 Ticket (smart_tickets)

A ticket represents a complete betting submission from a user.

| Field             | Type        | Nullable | Description                              |
| ----------------- | ----------- | -------- | ---------------------------------------- |
| `bet_slip_id`     | UUID        | NO       | Primary key, idempotency key             |
| `capper_id`       | UUID        | NO       | Submitting user                          |
| `sport`           | TEXT        | NO       | Sport enum (NBA, NFL, etc.)              |
| `ticket_type`     | TEXT        | NO       | single/parlay/round_robin                |
| `selection_count` | INTEGER     | NO       | Number of legs                           |
| `total_units`     | DECIMAL     | NO       | Total stake                              |
| `parlay_odds`     | DECIMAL     | YES      | Combined odds (parlays only)             |
| `status`          | TEXT        | NO       | submitted/processing/completed/cancelled |
| `created_at`      | TIMESTAMPTZ | NO       | Submission timestamp                     |
| `updated_at`      | TIMESTAMPTZ | NO       | Last modification                        |

### 1.2 Leg (unified_picks)

A leg represents a single selection within a ticket.

| Field         | Type    | Nullable | Description                  |
| ------------- | ------- | -------- | ---------------------------- |
| `id`          | UUID    | NO       | Primary key                  |
| `bet_slip_id` | UUID    | YES      | Parent ticket reference      |
| `leg_index`   | INTEGER | NO       | Position in ticket (0-based) |
| `user_id`     | UUID    | NO       | Capper reference             |
| `selection`   | TEXT    | NO       | What was selected            |
| `line`        | NUMERIC | YES      | Betting line                 |
| `odds`        | NUMERIC | NO       | Decimal/American odds        |
| `stake`       | NUMERIC | NO       | Unit amount                  |

### 1.3 Outbox Event (bridge_outbox)

Transactional outbox for reliable event delivery.

| Field           | Type        | Nullable | Description                         |
| --------------- | ----------- | -------- | ----------------------------------- |
| `id`            | UUID        | NO       | Event ID                            |
| `event_type`    | TEXT        | NO       | Event classification                |
| `payload`       | JSONB       | NO       | Full event payload                  |
| `status`        | TEXT        | NO       | pending/processing/completed/failed |
| `unique_key`    | TEXT        | YES      | Idempotency key (bet_slip_id)       |
| `attempts`      | INTEGER     | NO       | Retry count                         |
| `error_message` | TEXT        | YES      | Failure reason                      |
| `created_at`    | TIMESTAMPTZ | NO       | Event creation                      |
| `processed_at`  | TIMESTAMPTZ | YES      | Processing completion               |

### 1.4 Posting Receipt (embedded in unified_picks)

Discord posting metadata.

| Field                | Type    | Nullable | Description                         |
| -------------------- | ------- | -------- | ----------------------------------- |
| `posted_to_discord`  | BOOLEAN | NO       | Posted flag                         |
| `discord_message_id` | TEXT    | YES      | Message link ID                     |
| `discord_thread_id`  | TEXT    | YES      | Thread link ID                      |
| `promotion_band`     | TEXT    | YES      | HARD/SOFT/NONE                      |
| `promotion_status`   | TEXT    | NO       | not_promoted/queued/promoted/failed |

### 1.5 Settlement Record (embedded in unified_picks + prop_settlements)

Settlement outcome and audit trail.

| Field               | Type        | Nullable | Description                   |
| ------------------- | ----------- | -------- | ----------------------------- |
| `settlement_status` | TEXT        | NO       | pending/settled/void/disputed |
| `settlement_result` | TEXT        | YES      | win/loss/push                 |
| `settled_at`        | TIMESTAMPTZ | YES      | Settlement timestamp          |
| `settlement_source` | TEXT        | YES      | oddsapi/optimal/manual/backup |
| `settlement_hash`   | TEXT        | YES      | Idempotency hash              |
| `settlement_frozen` | BOOLEAN     | NO       | Immutability lock             |

---

## 2. Canonical Fields

### 2.1 Identifiers

| Identifier              | Format            | Scope                     | Notes                           |
| ----------------------- | ----------------- | ------------------------- | ------------------------------- |
| `pick_id`               | UUID v4           | unified_picks.id          | Primary pick identifier         |
| `bet_slip_id`           | UUID v4           | smart_tickets.bet_slip_id | Ticket/submission identifier    |
| `leg_index`             | INTEGER (0-based) | Within bet_slip_id        | Leg position                    |
| `capper_id` / `user_id` | UUID v4           | users.id                  | Submitter reference             |
| `event_id`              | UUID v4           | bridge_outbox.id          | Outbox event identifier         |
| `unique_key`            | TEXT              | bridge_outbox             | Idempotency key (= bet_slip_id) |

**Composite Key**: `(bet_slip_id, leg_index)` uniquely identifies a leg within a
ticket.

### 2.2 Timestamps

| Timestamp | Field                 | Set By          | Set At                         | Nullable |
| --------- | --------------------- | --------------- | ------------------------------ | -------- |
| Submitted | `created_at`          | Smart Form      | On INSERT                      | NO       |
| Placed    | `placed_at`           | Smart Form      | On INSERT                      | NO       |
| Queued    | `promotion_queued_at` | Promoter        | On promotion_status → queued   | YES      |
| Posted    | `promotion_posted_at` | Poster          | On posted_to_discord → true    | YES      |
| Settled   | `settled_at`          | SettlementAgent | On settlement_status → settled | YES      |
| Frozen    | `freeze_enforced_at`  | SettlementAgent | On settlement_frozen → true    | YES      |
| Updated   | `updated_at`          | Any writer      | On any UPDATE                  | NO       |

**NEW FIELDS REQUIRED** (to be added):

- `promotion_queued_at` - When added to promotion queue
- `promotion_posted_at` - When posted to Discord
- `blocked_at` - When blocked with reason
- `failed_at` - When processing failed

### 2.3 Status Enums

#### Pick Status (`status`)

```typescript
type PickStatus = 'pending' | 'won' | 'lost' | 'push' | 'void' | 'cancelled';
```

#### Settlement Status (`settlement_status`)

```typescript
type SettlementStatus = 'pending' | 'settled' | 'void' | 'disputed';
```

#### Promotion Status (`promotion_status`)

```typescript
type PromotionStatus = 'not_promoted' | 'queued' | 'promoted' | 'failed';
```

#### Outbox Status (`bridge_outbox.status`)

```typescript
type OutboxStatus = 'pending' | 'processing' | 'completed' | 'failed';
```

### 2.4 Reason Codes

| Field            | Type | Purpose                                         |
| ---------------- | ---- | ----------------------------------------------- |
| `blocked_reason` | TEXT | Why pick cannot proceed (machine-readable code) |
| `failed_reason`  | TEXT | Why processing failed (machine-readable code)   |
| `error_message`  | TEXT | Human-readable error description                |

**NEW FIELDS REQUIRED** (to be added):

- `blocked_reason` - Structured blocker code
- `failed_reason` - Structured failure code

### 2.5 Idempotency Keys

| Key          | Derivation                    | Scope                  |
| ------------ | ----------------------------- | ---------------------- |
| `submit_key` | `bet_slip_id`                 | Submission idempotency |
| `post_key`   | `pick_id + channel_id`        | Posting idempotency    |
| `settle_key` | `pick_id + settlement_source` | Settlement idempotency |

---

## 3. State Transitions (FSM)

### 3.1 Pick Lifecycle State Machine

```
                                    ┌──────────────────────────────────────┐
                                    │                                      │
                                    ▼                                      │
┌─────────┐     ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │
│ DRAFT   │────▶│  SUBMITTED  │──▶│   QUEUED    │──▶│   POSTED    │───────┤
└─────────┘     └─────────────┘   └─────────────┘   └─────────────┘       │
                      │                  │                 │               │
                      │                  │                 ▼               │
                      │                  │           ┌─────────────┐       │
                      │                  │           │  SETTLING   │───────┤
                      │                  │           └─────────────┘       │
                      │                  │                 │               │
                      │                  │                 ▼               │
                      │                  │           ┌─────────────┐       │
                      │                  └──────────▶│   SETTLED   │◀──────┘
                      │                              └─────────────┘
                      │                                    ▲
                      │                                    │
                      │           ┌─────────────┐          │
                      └──────────▶│   BLOCKED   │──────────┘
                                  └─────────────┘
                                        │
                                        ▼
                                  ┌─────────────┐
                                  │  CANCELLED  │
                                  └─────────────┘
```

### 3.2 Allowed Transitions

| From      | To        | Trigger                        | Writer          | Required Timestamps                         |
| --------- | --------- | ------------------------------ | --------------- | ------------------------------------------- |
| (new)     | SUBMITTED | Smart Form submit              | Smart Form      | `created_at`, `placed_at`                   |
| SUBMITTED | QUEUED    | Promotion eligibility check    | PromotionAgent  | `promotion_queued_at`                       |
| SUBMITTED | BLOCKED   | Validation failure             | PromotionAgent  | `blocked_at`, `blocked_reason`              |
| SUBMITTED | SETTLED   | Direct settlement (no Discord) | SettlementAgent | `settled_at`                                |
| QUEUED    | POSTED    | Discord post success           | DiscordPoster   | `promotion_posted_at`, `discord_message_id` |
| QUEUED    | BLOCKED   | Post eligibility lost          | PromotionAgent  | `blocked_at`, `blocked_reason`              |
| POSTED    | SETTLING  | Game started/ended             | SettlementAgent | -                                           |
| POSTED    | SETTLED   | Settlement complete            | SettlementAgent | `settled_at`, `settlement_result`           |
| SETTLING  | SETTLED   | Settlement complete            | SettlementAgent | `settled_at`, `settlement_result`           |
| BLOCKED   | QUEUED    | Manual unblock                 | Operator        | `promotion_queued_at`                       |
| BLOCKED   | CANCELLED | Manual cancel                  | Operator        | -                                           |
| SETTLED   | DISPUTED  | Dispute opened                 | Operator        | -                                           |
| DISPUTED  | SETTLED   | Dispute resolved               | SettlementAgent | `settled_at` (updated)                      |

### 3.3 Forbidden Transitions

| From      | To        | Reason                            |
| --------- | --------- | --------------------------------- |
| SETTLED   | CANCELLED | Settled picks cannot be cancelled |
| CANCELLED | \*        | Cancelled is terminal             |
| POSTED    | SUBMITTED | Cannot regress from posted        |
| SETTLED   | SUBMITTED | Cannot regress from settled       |
| SETTLED   | QUEUED    | Cannot regress from settled       |
| \*        | DRAFT     | Draft is initial-only (if used)   |

### 3.4 Promotion Status Transitions

| From         | To       | Trigger                      |
| ------------ | -------- | ---------------------------- |
| not_promoted | queued   | Passes promotion eligibility |
| queued       | promoted | Discord post success         |
| queued       | failed   | Discord post failure         |
| failed       | queued   | Manual retry                 |
| not_promoted | failed   | Blocked at validation        |

### 3.5 Settlement Status Transitions

| From     | To       | Trigger                     |
| -------- | -------- | --------------------------- |
| pending  | settled  | Settlement complete         |
| pending  | void     | Void (cancelled game, etc.) |
| settled  | disputed | Dispute opened              |
| disputed | settled  | Dispute resolved            |

---

## 4. Invariants

### 4.1 Idempotency Invariants

| Invariant         | Rule                                                     | Enforcement                                      |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------ |
| SUBMIT_IDEMPOTENT | Same `bet_slip_id` returns existing record, no duplicate | UNIQUE constraint + upsert                       |
| POST_IDEMPOTENT   | Same pick to same channel = no-op if already posted      | Check `posted_to_discord` + `discord_message_id` |
| SETTLE_IDEMPOTENT | Re-settle with same source = no-op unless override       | Check `settlement_hash`                          |
| OUTBOX_IDEMPOTENT | Same `unique_key` returns existing event                 | UNIQUE constraint on `unique_key`                |

### 4.2 Temporal Invariants

| Invariant               | Rule                                                           |
| ----------------------- | -------------------------------------------------------------- |
| MONOTONIC_TIMESTAMPS    | `promotion_posted_at` >= `promotion_queued_at` >= `created_at` |
| SETTLEMENT_AFTER_SUBMIT | `settled_at` >= `created_at`                                   |
| SETTLEMENT_AFTER_POST   | `settled_at` >= `promotion_posted_at` (if posted)              |
| FREEZE_AFTER_SETTLE     | `freeze_enforced_at` >= `settled_at`                           |

### 4.3 State Consistency Invariants

| Invariant             | Rule                                                                    |
| --------------------- | ----------------------------------------------------------------------- |
| POSTED_HAS_MESSAGE_ID | If `posted_to_discord = true` then `discord_message_id IS NOT NULL`     |
| SETTLED_HAS_RESULT    | If `settlement_status = 'settled'` then `settlement_result IS NOT NULL` |
| SETTLED_HAS_TIMESTAMP | If `settlement_status = 'settled'` then `settled_at IS NOT NULL`        |
| BLOCKED_HAS_REASON    | If state = BLOCKED then `blocked_reason IS NOT NULL`                    |
| FAILED_HAS_REASON     | If state = FAILED then `failed_reason IS NOT NULL`                      |

### 4.4 Settlement Immutability Invariants

| Invariant            | Rule                                                                        |
| -------------------- | --------------------------------------------------------------------------- |
| SETTLEMENT_IMMUTABLE | Once `settlement_result` is set, only `correct_settlement()` RPC can modify |
| FREEZE_IMMUTABLE     | Once `settlement_frozen = true`, no modification allowed                    |
| HASH_UNIQUE          | `settlement_hash` must be unique per pick                                   |

### 4.5 Outbox Invariants

| Invariant            | Rule                                                        |
| -------------------- | ----------------------------------------------------------- |
| OUTBOX_APPEND_ONLY   | bridge_outbox events are never deleted, only status updated |
| OUTBOX_CONSUMED_ONCE | Each unique_key processed exactly once (idempotent)         |
| OUTBOX_MAX_RETRIES   | After max_attempts, status = 'failed'                       |

---

## 5. Error Taxonomy

### 5.1 Blocker Codes (BLOCKED\_\*)

| Code                           | Meaning                          | Resolution                 |
| ------------------------------ | -------------------------------- | -------------------------- |
| `BLOCKED_VALIDATION_FAILED`    | Pick failed validation rules     | Fix data, resubmit         |
| `BLOCKED_DUPLICATE`            | Duplicate submission detected    | Use existing pick          |
| `BLOCKED_CAPPER_INACTIVE`      | Capper not active                | Activate capper            |
| `BLOCKED_GAME_STARTED`         | Game already in progress         | Cannot post                |
| `BLOCKED_LINE_STALE`           | Line moved beyond threshold      | Resubmit with current line |
| `BLOCKED_PROMOTION_INELIGIBLE` | Does not meet promotion criteria | Manual override or skip    |
| `BLOCKED_RATE_LIMITED`         | Too many submissions             | Wait and retry             |

### 5.2 Failure Codes (FAILED\_\*)

| Code                         | Meaning                        | Resolution          |
| ---------------------------- | ------------------------------ | ------------------- |
| `FAILED_DISCORD_API`         | Discord API error              | Auto-retry          |
| `FAILED_DISCORD_PERMISSIONS` | Bot lacks permissions          | Fix permissions     |
| `FAILED_SETTLEMENT_NO_DATA`  | No settlement data available   | Manual settlement   |
| `FAILED_SETTLEMENT_CONFLICT` | Conflicting settlement sources | Manual review       |
| `FAILED_SETTLEMENT_TIMEOUT`  | Settlement timed out           | Auto-retry          |
| `FAILED_OUTBOX_PARSE`        | Could not parse outbox payload | Manual review       |
| `FAILED_OUTBOX_EXHAUSTED`    | Max retries exceeded           | Manual intervention |

### 5.3 Invalid Codes (INVALID\_\*)

| Code                  | Meaning                            |
| --------------------- | ---------------------------------- |
| `INVALID_TRANSITION`  | Attempted illegal state transition |
| `INVALID_WRITER`      | Unauthorized writer for field      |
| `INVALID_TIMESTAMP`   | Temporal invariant violated        |
| `INVALID_IDEMPOTENCY` | Idempotency violation              |

### 5.4 Where Codes Appear

| Location       | Fields                            |
| -------------- | --------------------------------- |
| Database       | `blocked_reason`, `failed_reason` |
| API Response   | `error.code`, `error.message`     |
| Command Center | `blocked_reason` column, filters  |
| Outbox         | `error_message`                   |

---

## 6. Single-Writer Authority Map

### 6.1 Field → Writer Mapping

| Field(s)                                                                          | Authoritative Writer   | Other Writers           | Notes                          |
| --------------------------------------------------------------------------------- | ---------------------- | ----------------------- | ------------------------------ |
| `id`, `bet_slip_id`, `leg_index`, `user_id`, `selection`, `line`, `odds`, `stake` | Smart Form             | NONE                    | Immutable after creation       |
| `created_at`, `placed_at`                                                         | Smart Form             | NONE                    | Set once on INSERT             |
| `promotion_status`, `promotion_band`                                              | PromotionAgent         | Operator (override)     |                                |
| `promotion_queued_at`, `blocked_at`, `blocked_reason`                             | PromotionAgent         | Operator (override)     |                                |
| `posted_to_discord`, `discord_message_id`, `discord_thread_id`                    | DiscordPoster          | NONE                    |                                |
| `promotion_posted_at`                                                             | DiscordPoster          | NONE                    |                                |
| `settlement_status`, `settlement_result`, `settled_at`, `settlement_source`       | SettlementAgent        | Operator (via RPC only) |                                |
| `settlement_hash`, `settlement_frozen`, `freeze_enforced_at`                      | SettlementAgent        | NONE                    |                                |
| `status` (outcome)                                                                | SettlementAgent        | NONE                    | Derived from settlement_result |
| `failed_reason`, `failed_at`                                                      | Any Agent (on failure) |                         |                                |
| `updated_at`                                                                      | Any authorized writer  |                         | Auto-updated on any write      |

### 6.2 Writer Roles

| Role                | Services                 | Allowed Fields                                          |
| ------------------- | ------------------------ | ------------------------------------------------------- |
| `submitter`         | Smart Form               | Initial creation fields                                 |
| `promoter`          | PromotionAgent           | `promotion_*`, `blocked_*`                              |
| `poster`            | DiscordPoster            | `posted_to_discord`, `discord_*`, `promotion_posted_at` |
| `settler`           | SettlementAgent          | `settlement_*`, `settled_at`, `status`                  |
| `operator_override` | Command Center (via RPC) | Any field (with audit)                                  |

### 6.3 Enforcement Mechanism

```typescript
// Every write MUST pass through:
assertWriterAuthority(writerRole: WriterRole, fieldsToUpdate: string[]): void

// Throws INVALID_WRITER if:
// - writerRole not in allowed writers for any field in fieldsToUpdate
// - fieldsToUpdate contains immutable fields and writerRole != 'operator_override'
```

---

## 7. Command Center Truth Model

### 7.1 Required UI Columns

| Column         | Source                                     | Description             |
| -------------- | ------------------------------------------ | ----------------------- |
| Pick ID        | `unified_picks.id`                         | Unique identifier       |
| Capper         | `users.username` via `user_id`             | Who submitted           |
| Selection      | `selection`                                | What was picked         |
| Line           | `line`                                     | Betting line            |
| Odds           | `odds`                                     | Price                   |
| Status         | Computed                                   | Current lifecycle stage |
| Blocked Reason | `blocked_reason`                           | Why blocked (if any)    |
| Failed Reason  | `failed_reason`                            | Why failed (if any)     |
| Discord Status | `posted_to_discord` + `discord_message_id` | Posting state           |
| Settlement     | `settlement_status` + `settlement_result`  | Settlement state        |
| Created        | `created_at`                               | Submission time         |
| Age            | Computed                                   | Time since creation     |

### 7.2 Lifecycle Stage Computation

```typescript
function computeLifecycleStage(pick: UnifiedPick): LifecycleStage {
  if (pick.settlement_status === 'settled') return 'SETTLED';
  if (pick.settlement_status === 'disputed') return 'DISPUTED';
  if (pick.settlement_status === 'void') return 'VOID';
  if (pick.blocked_reason) return 'BLOCKED';
  if (pick.posted_to_discord) return 'POSTED';
  if (pick.promotion_status === 'queued') return 'QUEUED';
  if (pick.promotion_status === 'failed') return 'FAILED';
  return 'SUBMITTED';
}
```

### 7.3 "Why Not Posted?" Mapping

| Condition                                         | Display Reason               |
| ------------------------------------------------- | ---------------------------- |
| `blocked_reason = 'BLOCKED_VALIDATION_FAILED'`    | "Validation failed"          |
| `blocked_reason = 'BLOCKED_GAME_STARTED'`         | "Game already started"       |
| `blocked_reason = 'BLOCKED_LINE_STALE'`           | "Line moved"                 |
| `blocked_reason = 'BLOCKED_PROMOTION_INELIGIBLE'` | "Not eligible for promotion" |
| `promotion_status = 'failed'`                     | "Discord post failed"        |
| `promotion_status = 'not_promoted'` + eligible    | "Waiting in queue"           |
| `promotion_status = 'not_promoted'` + ineligible  | "Not eligible"               |

### 7.4 "Why Not Settled?" Mapping

| Condition                                        | Display Reason        |
| ------------------------------------------------ | --------------------- |
| `failed_reason = 'FAILED_SETTLEMENT_NO_DATA'`    | "No settlement data"  |
| `failed_reason = 'FAILED_SETTLEMENT_CONFLICT'`   | "Conflicting data"    |
| `settlement_status = 'pending'` + game not ended | "Game in progress"    |
| `settlement_status = 'pending'` + game ended     | "Awaiting settlement" |
| `settlement_status = 'disputed'`                 | "Under dispute"       |

### 7.5 Stuck Detection Thresholds

| Stage              | Threshold  | Stuck If                                |
| ------------------ | ---------- | --------------------------------------- |
| SUBMITTED → QUEUED | 5 minutes  | Not queued within 5 min of submission   |
| QUEUED → POSTED    | 15 minutes | Not posted within 15 min of queue       |
| POSTED → SETTLED   | 24 hours   | Not settled within 24 hours of game end |

### 7.6 Required CC Endpoints

| Endpoint                              | Purpose                            |
| ------------------------------------- | ---------------------------------- |
| `GET /api/lifecycle/counts`           | Counts by lifecycle stage          |
| `GET /api/lifecycle/stuck`            | List of stuck picks with reasons   |
| `GET /api/lifecycle/timeline/:pickId` | Full timeline for a pick           |
| `GET /api/lifecycle/blocked`          | List of blocked picks with reasons |
| `GET /api/lifecycle/failed`           | List of failed picks with reasons  |

---

## 8. Implementation Requirements

### 8.1 Transition Validator

```typescript
// Location: apps/api/src/lib/lifecycle/transition-validator.ts

export function assertTransition(
  currentState: LifecycleState,
  nextState: LifecycleState,
  context: TransitionContext
): void;

export function validateInvariants(pick: UnifiedPick): void;
```

### 8.2 Writer Authority Guard

```typescript
// Location: apps/api/src/lib/lifecycle/writer-authority.ts

export function assertWriterAuthority(
  writerRole: WriterRole,
  fieldsToUpdate: string[]
): void;

export function getAuthorizedFields(writerRole: WriterRole): string[];
```

### 8.3 Idempotency Guards

```typescript
// Submit
export function getOrCreatePick(betSlipId: UUID, payload: SubmitPayload): Pick;

// Post
export function postIfNotPosted(pickId: UUID, channelId: string): PostResult;

// Settle
export function settleIfNotSettled(
  pickId: UUID,
  settlement: Settlement
): SettleResult;
```

### 8.4 Error Response Format

```typescript
interface LifecycleError {
  code: string; // e.g., 'INVALID_TRANSITION'
  message: string; // Human-readable
  details?: {
    currentState?: string;
    attemptedState?: string;
    field?: string;
    reason?: string;
  };
}
```

### 8.5 Database Migrations Required

1. Add `promotion_queued_at` TIMESTAMPTZ to unified_picks
2. Add `promotion_posted_at` TIMESTAMPTZ to unified_picks
3. Add `blocked_at` TIMESTAMPTZ to unified_picks
4. Add `blocked_reason` TEXT to unified_picks
5. Add `failed_at` TIMESTAMPTZ to unified_picks
6. Add `failed_reason` TEXT to unified_picks

---

## Appendix A: State Encoding

### Composite State

The pick lifecycle state is encoded in multiple fields:

```typescript
interface LifecycleState {
  // From promotion_status
  promotionStatus: 'not_promoted' | 'queued' | 'promoted' | 'failed';

  // From posted_to_discord
  isPosted: boolean;

  // From settlement_status
  settlementStatus: 'pending' | 'settled' | 'void' | 'disputed';

  // From blocked_reason
  isBlocked: boolean;
  blockedReason?: string;

  // From failed_reason
  isFailed: boolean;
  failedReason?: string;
}
```

---

## Appendix B: Audit Trail

All lifecycle transitions MUST be logged to:

- Application logs (structured JSON)
- settlement_audit_log table (for settlement changes)
- Command Center event stream (real-time)

Log format:

```json
{
  "timestamp": "2026-02-18T12:00:00Z",
  "event": "LIFECYCLE_TRANSITION",
  "pick_id": "uuid",
  "from_state": "SUBMITTED",
  "to_state": "QUEUED",
  "writer": "PromotionAgent",
  "trace_id": "uuid",
  "details": {}
}
```

---

**Document Owner**: Engineering Team **Last Updated**: 2026-02-18 **Review
Cycle**: On any schema change
