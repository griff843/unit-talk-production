# Lifecycle State Machine — Current System

> Generated: 2026-03-07 | Sprint: SPRINT-SYSTEM-DOCUMENTATION-FOUNDATION

---

## Overview

The pick lifecycle is governed by a finite state machine with 11 stages. State
is **derived** from multiple fields on `unified_picks`, not stored as a single
column.

**Contract**: `docs/contracts/PICK_LIFECYCLE_CONTRACT.md` (v1.0)
**Implementation**: `apps/api/src/lib/lifecycle/`

---

## Lifecycle Stages

```
DRAFT             Initial state (optional, rarely used)
SUBMITTED         Pick created, awaiting promotion evaluation
QUEUED            Passed promotion, waiting for Discord posting
POSTED            Successfully posted to Discord
SETTLING          Game in progress, awaiting settlement
SETTLED           Game finished, outcome determined, frozen
BLOCKED           Cannot proceed (validation failed, game started)
FAILED            Posting attempt failed
CANCELLED         Manually cancelled
DISPUTED          Settlement disputed
VOID              Game void/cancelled
```

---

## State Transition Diagram

```
                         +----------+
                         |          |
                         v          |
+-------+   +----------+   +------+---+   +--------+
| DRAFT |-->| SUBMITTED|-->| QUEUED    |-->| POSTED |---+
+-------+   +----+-----+   +-----+----+   +---+----+   |
                  |               |            |        |
                  |               |            v        |
                  |               |       +---------+   |
                  |               |       | SETTLING|---+
                  |               |       +----+----+   |
                  |               |            |        |
                  |               |            v        |
                  |               |       +---------+   |
                  |               +------>| SETTLED |<--+
                  |                       +----+----+
                  |                            ^
                  v                            |
             +---------+                  +----------+
             | BLOCKED |---------------->| DISPUTED |
             +----+----+                  +----------+
                  |
                  v
             +-----------+
             | CANCELLED |
             +-----------+
```

---

## State Derivation Logic

**File**: `apps/api/src/lib/lifecycle/transition-validator.ts`

State is derived from multiple `unified_picks` fields:

```
1. if status === 'cancelled'                           -> CANCELLED
2. if settlement_status === 'void'                     -> VOID
3. if settlement_status === 'disputed'                 -> DISPUTED
4. if settlement_status === 'settled'                  -> SETTLED
5. if blocked_reason is set                            -> BLOCKED
6. if failed_reason is set                             -> FAILED
7. if posted_to_discord AND discord_message_id set     -> POSTED
8. if promotion_status === 'queued'                    -> QUEUED
9. else                                                -> SUBMITTED
```

---

## Allowed Transitions (18 total)

| From      | To        | Trigger Agent                  | Required                                |
| --------- | --------- | ------------------------------ | --------------------------------------- |
| SUBMITTED | QUEUED    | GradingAgent (promoter)        | promotion_queued_at                     |
| SUBMITTED | BLOCKED   | GradingAgent (promoter)        | blocked_reason                          |
| QUEUED    | POSTED    | DiscordPromotionAgent (poster) | promotion_posted_at, discord_message_id |
| QUEUED    | FAILED    | DiscordPromotionAgent (poster) | failed_reason                           |
| QUEUED    | BLOCKED   | AuditAgent / Operator          | blocked_reason                          |
| POSTED    | SETTLING  | SettlementAgent (settler)      | --                                      |
| POSTED    | SETTLED   | SettlementAgent (settler)      | settled_at, settlement_result           |
| POSTED    | VOID      | SettlementAgent (settler)      | --                                      |
| SETTLING  | SETTLED   | SettlementAgent (settler)      | settled_at, settlement_result           |
| SETTLING  | VOID      | SettlementAgent (settler)      | --                                      |
| SETTLED   | DISPUTED  | Operator (operator_override)   | --                                      |
| DISPUTED  | SETTLED   | Operator (operator_override)   | settled_at                              |
| BLOCKED   | QUEUED    | Operator (operator_override)   | promotion_queued_at                     |
| BLOCKED   | CANCELLED | Operator (operator_override)   | --                                      |
| FAILED    | QUEUED    | Operator (operator_override)   | promotion_queued_at                     |

---

## Writer Roles

| Role                | Services                  | Authority                                                  |
| ------------------- | ------------------------- | ---------------------------------------------------------- |
| `submitter`         | Smart Form / BridgeWorker | Initial pick fields (selection, line, odds, stake)         |
| `promoter`          | GradingAgent              | promotion_status, promotion_band, blocked_reason           |
| `poster`            | DiscordPromotionAgent     | posted_to_discord, discord_message_id, promotion_posted_at |
| `settler`           | SettlementAgent           | settlement_status, settlement_result, settled_at           |
| `operator_override` | Command Center            | Any field (with audit logging)                             |

---

## Timestamp Invariants

All timestamps must satisfy monotonic ordering:

```
created_at <= promotion_queued_at <= promotion_posted_at <= settled_at <= freeze_enforced_at
```

- promotion_queued_at >= created_at
- promotion_posted_at >= promotion_queued_at
- settled_at >= created_at
- settled_at >= promotion_posted_at (if posted)
- freeze_enforced_at >= settled_at

---

## State Consistency Invariants

| Invariant             | Rule                                                              |
| --------------------- | ----------------------------------------------------------------- |
| POSTED_HAS_MESSAGE_ID | If posted_to_discord=true then discord_message_id IS NOT NULL     |
| SETTLED_HAS_RESULT    | If settlement_status='settled' then settlement_result IS NOT NULL |
| SETTLED_HAS_TIMESTAMP | If settlement_status='settled' then settled_at IS NOT NULL        |

---

## Lifecycle Adapters

**File**: `apps/api/src/lib/lifecycle/write-adapter.ts`

| Adapter                      | Purpose                           | Writer Role         |
| ---------------------------- | --------------------------------- | ------------------- |
| `lifecycleInsert()`          | Initial submission                | submitter, promoter |
| `lifecycleUpdate()`          | State transitions                 | Any authorized role |
| `lifecycleClaimForPosting()` | Atomic Discord claim (idempotent) | poster              |
| `lifecycleSettle()`          | Settlement recording              | settler             |

All adapters validate:

1. Writer authority (role allowed to modify target fields)
2. Transition validity (current -> next stage is allowed)
3. Timestamp monotonicity
4. State consistency invariants
5. Autopilot freeze check (fail-closed)

---

## Idempotency Guards

| Operation | Guard                                                | Prevents                         |
| --------- | ---------------------------------------------------- | -------------------------------- |
| Submit    | `bet_slip_id` existence check                        | Duplicate picks from same ticket |
| Post      | `atomicClaimForPost()` WHERE posted_to_discord=false | Double-posting to Discord        |
| Settle    | `settlement_hash` check                              | Re-settlement with same source   |

---

## Autopilot Freeze

All writes to unified_picks are blocked when autopilot is frozen. This is a hard
fail-closed safety mechanism with no bypass path.

```
assertNotFrozen() -> throws AutopilotFrozenError if frozen
```

---

## Stuck Pick Detection

| Transition          | Threshold  | Escalation       |
| ------------------- | ---------- | ---------------- |
| SUBMITTED -> QUEUED | 5 minutes  | AuditAgent flags |
| QUEUED -> POSTED    | 15 minutes | AuditAgent flags |
| POSTED -> SETTLED   | 24 hours   | AuditAgent flags |
