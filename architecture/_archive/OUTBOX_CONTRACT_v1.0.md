# OUTBOX_CONTRACT_v1.0.md

Unit Talk – Clean-Room Doctrine  
Phase 3 — Distribution Determinism (Design Only)  
Status: DRAFT (Design Artifact – Not Implemented)

---

# 1. Purpose

The **Outbox** is the **single canonical intent log** for external distribution.

It is:

- An **append-only projection layer**
- A **distribution intent ledger**
- A **deterministic delivery queue**
- The **only legal source of outbound delivery attempts**

It is **not**:

- A source of scoring logic
- A transformation layer
- A mutable state store
- A distribution output table

The Outbox defines the **contract between Canonical State (unified_picks)** and
**External Distribution Systems (Discord, future channels)**.

---

# 2. Core Invariants

These invariants are absolute and fail-closed.

| ID     | Invariant                                 | Enforcement                           |
| ------ | ----------------------------------------- | ------------------------------------- |
| OX-001 | Outbox is append-only                     | No UPDATE to intent payload           |
| OX-002 | Exactly one canonical writer              | Single writer authority only          |
| OX-003 | Intent payload immutable                  | JSON immutable after insert           |
| OX-004 | Idempotency enforced by deterministic key | Duplicate keys rejected               |
| OX-005 | Routing inputs deterministic              | Derived only from canonical state     |
| OX-006 | Distribution must produce receipt         | No receipt = not delivered            |
| OX-007 | Retry bounded                             | No infinite retries                   |
| OX-008 | Replay safe                               | Replays cannot mutate canonical truth |

Violation of any invariant → **system freeze required**

---

# 3. Outbox Record Structure (Design-Level Schema)

The Outbox represents **intent to distribute**.

## 3.1 Required Fields

| Field               | Type      | Required                         | Description                         |
| ------------------- | --------- | -------------------------------- | ----------------------------------- |
| id                  | UUID      | YES                              | Unique record identifier            |
| idempotency_key     | STRING    | YES                              | Deterministic unique key            |
| canonical_entity_id | UUID      | YES                              | unified_picks primary key           |
| entity_type         | ENUM      | YES                              | e.g., PICK_PROMOTION                |
| event_type          | ENUM      | YES                              | e.g., PICK_POST                     |
| routing_key         | STRING    | YES                              | Deterministic routing hash          |
| channel_target      | STRING    | YES                              | Logical channel name                |
| intent_payload      | JSON      | YES                              | Fully rendered distribution payload |
| payload_hash        | STRING    | YES                              | SHA256 of intent_payload            |
| state               | ENUM      | YES                              | See State Machine                   |
| attempt_count       | INTEGER   | YES                              | Default 0                           |
| max_attempts        | INTEGER   | YES                              | Deterministic constant              |
| next_attempt_at     | TIMESTAMP | YES                              | For retry scheduling                |
| receipt_reference   | STRING    | NO (becomes required on success) |
| error_code          | STRING    | NO                               |
| error_reason        | STRING    | NO                               |
| created_at          | TIMESTAMP | YES                              |
| updated_at          | TIMESTAMP | YES                              |

---

# 4. Allowed States

Outbox records exist in one of the following states:

| State           | Meaning                           |
| --------------- | --------------------------------- |
| PENDING         | Intent created, not yet attempted |
| IN_PROGRESS     | Actively being delivered          |
| RETRY_SCHEDULED | Failed, retry pending             |
| DELIVERED       | Receipt verified                  |
| FAILED_FINAL    | Max attempts exhausted            |
| DEAD_LETTER     | Moved to DLQ                      |
| FROZEN          | System freeze triggered           |

No other states permitted.

---

# 5. State Transitions

## 5.1 Legal Transitions Only

| From            | To              | Condition                     |
| --------------- | --------------- | ----------------------------- |
| PENDING         | IN_PROGRESS     | Delivery attempt started      |
| IN_PROGRESS     | DELIVERED       | Receipt verified              |
| IN_PROGRESS     | RETRY_SCHEDULED | Delivery failed               |
| RETRY_SCHEDULED | IN_PROGRESS     | Retry time reached            |
| RETRY_SCHEDULED | FAILED_FINAL    | attempt_count >= max_attempts |
| FAILED_FINAL    | DEAD_LETTER     | Manual DLQ processing         |
| ANY             | FROZEN          | Kill condition triggered      |

---

## 5.2 Forbidden Transitions

- DELIVERED → ANY
- FAILED_FINAL → PENDING
- DEAD_LETTER → PENDING
- DELIVERED → RETRY
- IN_PROGRESS → PENDING

If detected → freeze.

---

# 6. Immutability Rules

The following fields are immutable after insertion:

- id
- idempotency_key
- canonical_entity_id
- entity_type
- event_type
- routing_key
- channel_target
- intent_payload
- payload_hash
- created_at

Allowed to change:

- state
- attempt_count
- next_attempt_at
- receipt_reference
- error_code
- error_reason
- updated_at

No other mutation permitted.

---

# 7. Idempotency Key Definition

The idempotency key MUST be deterministic.

## 7.1 Composition

Rules:

- Must be reproducible
- Must be collision resistant
- Must guarantee no duplicate intent for same canonical state

Duplicate idempotency_key → reject insert.

---

# 8. Routing Determinism Inputs

Routing is derived exclusively from:

- unified_picks tier
- unified_picks sport
- unified_picks visibility level
- environment (prod/staging)
- distribution policy config (versioned)

Routing MUST NOT use:

- runtime randomness
- Discord API response
- external mutable config
- non-versioned environment overrides

Routing must be reproducible from canonical state + versioned policy.

---

# 9. Replay Behavior

Replay means:

- Reattempting delivery for an existing Outbox record
- No mutation to canonical state
- No payload regeneration

Replay rules:

- Only allowed for state IN_PROGRESS or RETRY_SCHEDULED
- Cannot regenerate intent_payload
- Cannot modify routing_key
- Cannot modify channel_target
- Must use original payload_hash

Replay must be safe and idempotent.

---

# 10. Bounded Retry Policy

Retry strategy must be deterministic:

- attempt_count increments atomically
- next_attempt_at computed via deterministic backoff
- max_attempts fixed constant per environment

After max_attempts:

→ state = FAILED_FINAL

No auto-revive allowed.

---

# 11. Receipt Truth

Delivery is valid only if:

- External platform returns a verifiable receipt
- receipt_reference stored
- receipt format validated

For Discord:

- receipt_reference must equal Snowflake ID
- Snowflake must be parseable
- Channel ID must match expected target

No receipt = not delivered.

---

# 12. Forbidden Mutations

The following actions are strictly forbidden:

- Updating intent_payload
- Rewriting routing_key
- Changing idempotency_key
- Regenerating payload_hash
- Altering canonical_entity_id
- Deleting delivered records
- Hard deleting failed records

Detection → immediate freeze.

---

# 13. Kill Conditions

The system must enter FROZEN state if:

- Duplicate idempotency_key detected
- Illegal state transition attempted
- Payload hash mismatch detected
- Routing drift detected
- Receipt channel mismatch
- Attempt count overflow
- Immutable field update attempt

Freeze means:

- No further distribution attempts
- Alert emitted
- Manual intervention required

---

# 14. Binary Acceptance Criteria

This contract is accepted only if:

- All fields explicitly defined
- All states enumerated
- All transitions explicitly defined
- Idempotency formula deterministic
- Retry bounded
- Replay safe
- Forbidden mutations defined
- Freeze conditions defined
- No undefined behavior exists

If any undefined behavior exists → contract rejected.

---

# 15. Final Declaration

The Outbox is:

- A deterministic intent ledger
- An immutable projection surface
- The only legal distribution trigger
- A replay-safe, idempotent delivery contract

It is not optional. It is not mutable. It is not bypassable.

Phase 3 design proceeds only if this contract is ratified.
