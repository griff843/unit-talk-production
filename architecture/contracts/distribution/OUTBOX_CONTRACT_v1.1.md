# OUTBOX_CONTRACT_v1.1.md

Unit Talk – Clean-Room Doctrine  
Phase 3 — Distribution Determinism (Design Only)  
Status: DRAFT (Design Artifact – Not Implemented)

---

# 1. Purpose

The **Outbox** is the **single canonical distribution intent ledger**.

It is:

- **Projection-only** (derived from canonical state)
- **Append-only payload** (intent payload is immutable)
- **Deterministic** (routing + payload reproducible)
- **Replay-safe** (retries/replays cannot change intent)
- **Receipt-truth anchored** (delivered only when receipt verified)

It is not:

- A canonical data source
- A transformation surface
- A mutable event stream
- A place to “fix” payloads after the fact

---

# 2. Core Invariants (Fail-Closed)

| ID     | Invariant                    | Definition                                                            |
| ------ | ---------------------------- | --------------------------------------------------------------------- |
| OX-001 | Append-only intent payload   | `intent_payload` and its hash never change after insert               |
| OX-002 | Deterministic idempotency    | `idempotency_key` is deterministic and unique; duplicates rejected    |
| OX-003 | Deterministic routing        | Routing depends only on stored routing inputs + stored policy version |
| OX-004 | Replay does not re-render    | Replay never regenerates payload or routing                           |
| OX-005 | Bounded retry                | Attempts are capped; no infinite retry                                |
| OX-006 | Receipt truth                | Success requires verified receipt bound to payload+target             |
| OX-007 | Lease-based single attempt   | Only one consumer may attempt at a time (lease)                       |
| OX-008 | No silent drift              | Any hash/version mismatch triggers freeze                             |
| OX-009 | Terminal states are terminal | DELIVERED / DEAD_LETTER cannot transition back                        |
| OX-010 | No forbidden mutation        | Any attempt to mutate immutable fields triggers freeze                |

Any violation ⇒ **FROZEN** and distribution halts.

---

# 3. Outbox Record Structure (Design-Level Schema)

## 3.1 Required Fields (Insert-Time Required)

| Field               | Type      | Required | Notes                                  |
| ------------------- | --------- | -------- | -------------------------------------- |
| id                  | UUID      | YES      | Unique record ID                       |
| idempotency_key     | STRING    | YES      | Deterministic uniqueness key           |
| canonical_entity_id | UUID      | YES      | `unified_picks.id`                     |
| entity_type         | ENUM      | YES      | e.g. `UNIFIED_PICK`                    |
| event_type          | ENUM      | YES      | e.g. `PICK_POST`                       |
| env                 | ENUM      | YES      | `PROD` / `STAGING` / `DEV`             |
| policy_version      | STRING    | YES      | Version of routing policy used         |
| renderer_version    | STRING    | YES      | Version of payload renderer spec       |
| routing_inputs      | JSON      | YES      | Minimal deterministic inputs (see §8)  |
| routing_inputs_hash | STRING    | YES      | SHA256(routing_inputs)                 |
| routing_key         | STRING    | YES      | Deterministic route key (see §8)       |
| channel_target      | STRING    | YES      | Logical name (e.g. `vip_picks_canary`) |
| target_kind         | ENUM      | YES      | `DISCORD_WEBHOOK` / `DISCORD_CHANNEL`  |
| target_id           | STRING    | YES      | Webhook ID or Channel ID (as string)   |
| intent_payload      | JSON      | YES      | Fully rendered outbound payload        |
| payload_hash        | STRING    | YES      | SHA256(intent_payload)                 |
| state               | ENUM      | YES      | Initial state must be `PENDING`        |
| attempt_count       | INT       | YES      | Initial = 0                            |
| max_attempts        | INT       | YES      | Deterministic constant per env/event   |
| available_at        | TIMESTAMP | YES      | Initial = created_at                   |
| next_attempt_at     | TIMESTAMP | YES      | Initial = created_at                   |
| created_at          | TIMESTAMP | YES      | Insert-time                            |
| updated_at          | TIMESTAMP | YES      | Metadata updates only                  |

## 3.2 Attempt/Lease Fields (Mutable, Contracted)

| Field            | Type      | Required | Meaning                    |
| ---------------- | --------- | -------- | -------------------------- |
| claimed_at       | TIMESTAMP | NO       | When lease acquired        |
| lease_owner      | STRING    | NO       | Consumer instance identity |
| lease_token      | STRING    | NO       | Unique claim token         |
| lease_expires_at | TIMESTAMP | NO       | Lease expiration boundary  |

## 3.3 Receipt Fields (Required on Delivery)

| Field                | Type      | Required on DELIVERED | Meaning                         |
| -------------------- | --------- | --------------------- | ------------------------------- |
| receipt_type         | ENUM      | YES                   | e.g. `DISCORD_MESSAGE`          |
| receipt_reference    | STRING    | YES                   | e.g. Discord snowflake          |
| receipt_payload      | JSON      | YES                   | Minimal verifiable receipt data |
| receipt_payload_hash | STRING    | YES                   | SHA256(receipt_payload)         |
| delivered_at         | TIMESTAMP | YES                   | Verified delivery time          |

## 3.4 Error Fields (Mutable)

| Field             | Type      | Optional | Meaning               |
| ----------------- | --------- | -------- | --------------------- |
| last_error_code   | STRING    | YES      | Normalized error code |
| last_error_reason | STRING    | YES      | Human-readable reason |
| last_error_at     | TIMESTAMP | YES      | Error time            |

## 3.5 Linking Fields (For DLQ / supersession)

| Field                | Type   | Optional | Meaning                                      |
| -------------------- | ------ | -------- | -------------------------------------------- |
| supersedes_outbox_id | UUID   | YES      | Links a corrective re-intent to prior record |
| dlq_reason           | STRING | YES      | Reason for DLQ terminalization               |

---

# 4. Allowed States (Closed Set)

| State           | Meaning                                         |
| --------------- | ----------------------------------------------- |
| PENDING         | Intent exists, eligible at `available_at`       |
| IN_PROGRESS     | Lease acquired; attempting delivery             |
| RETRY_SCHEDULED | Failed attempt; waiting until `next_attempt_at` |
| DELIVERED       | Receipt verified; terminal                      |
| FAILED_FINAL    | Attempts exhausted; terminal precursor          |
| DEAD_LETTER     | Terminal; removed from normal processing        |
| FROZEN          | System freeze; terminal until manual thaw       |

No other states allowed.

---

# 5. State Transitions (Only These)

| From            | To              | Condition                                   |
| --------------- | --------------- | ------------------------------------------- |
| PENDING         | IN_PROGRESS     | Lease acquired and `now >= available_at`    |
| IN_PROGRESS     | DELIVERED       | Receipt verified and bound (see §11)        |
| IN_PROGRESS     | RETRY_SCHEDULED | Delivery failed; retry eligible             |
| RETRY_SCHEDULED | IN_PROGRESS     | Lease acquired and `now >= next_attempt_at` |
| RETRY_SCHEDULED | FAILED_FINAL    | `attempt_count >= max_attempts`             |
| FAILED_FINAL    | DEAD_LETTER     | DLQ terminalization applied                 |
| ANY             | FROZEN          | Any kill condition triggers                 |

Forbidden transitions: all others. Attempt ⇒ freeze.

---

# 6. Immutability Rules

## 6.1 Immutable After Insert (Never Change)

- id
- idempotency_key
- canonical_entity_id
- entity_type
- event_type
- env
- policy_version
- renderer_version
- routing_inputs
- routing_inputs_hash
- routing_key
- channel_target
- target_kind
- target_id
- intent_payload
- payload_hash
- created_at

## 6.2 Mutable (Only These May Change)

- state
- attempt_count
- available_at (ONLY allowed to move forward; never backward)
- next_attempt_at (ONLY allowed to move forward; never backward)
- claimed_at
- lease_owner
- lease_token
- lease_expires_at
- receipt_type
- receipt_reference
- receipt_payload
- receipt_payload_hash
- delivered_at
- last_error_code
- last_error_reason
- last_error_at
- supersedes_outbox_id
- dlq_reason
- updated_at

Any mutation outside this list ⇒ freeze.

---

# 7. Lease / Claim Model (Multi-Consumer Safe)

## 7.1 Lease Acquisition Requirements

A consumer may transition to IN_PROGRESS only if:

- state is `PENDING` or `RETRY_SCHEDULED`
- `now >= eligible_time` (available_at or next_attempt_at)
- lease fields are empty OR lease is expired

On acquisition:

- set `lease_owner`
- set `lease_token`
- set `lease_expires_at = now + LEASE_TTL`
- set `claimed_at = now`
- set `state = IN_PROGRESS`

## 7.2 Lease Exclusivity

Only the consumer holding the current (owner, token) may:

- attempt delivery
- write receipt fields
- schedule retry
- move to DELIVERED

Any write by non-lease-holder ⇒ freeze.

## 7.3 Lease Expiration

If lease expires before completion:

- record may be reclaimed by another consumer
- payload/routing MUST NOT change
- attempt_count monotonicity must hold

---

# 8. Deterministic Routing Inputs

## 8.1 routing_inputs (Required JSON)

routing_inputs MUST be the minimal deterministic set needed to reproduce
routing:

- canonical_entity_id
- canonical_visibility (tier/segment)
- sport
- league
- market_type (if applicable)
- distribution_band (if applicable)
- created_at_day (UTC date bucket)
- policy_version

No runtime-only values allowed.

## 8.2 routing_key

routing_key MUST be deterministic: routing_key = SHA256(env + policy_version +
canonical_visibility + sport + league + event_type)

No randomness. No external fetch. No mutable config.

---

# 9. Idempotency Key Definition

Idempotency must guarantee single intent for identical appearance:
idempotency_key = SHA256( canonical_entity_id + event_type + env +
policy_version + target_kind + target_id + payload_hash ) Duplicate
idempotency_key ⇒ reject insert.

---

# 10. Replay Behavior (Strict)

Replay means re-attempting delivery for the same outbox record.

Replay is allowed only when:

- state is IN_PROGRESS (lease held) OR RETRY_SCHEDULED (eligible)

Replay MUST NOT:

- regenerate payload
- regenerate routing_inputs
- change target_id
- change policy_version
- change renderer_version

Replay MUST use the stored intent_payload and payload_hash.

Any deviation ⇒ freeze.

---

# 11. Receipt Truth & Verification Binding

A record may enter DELIVERED only if:

- receipt_reference is present
- receipt_payload is present
- receipt_payload_hash is present
- delivered_at is set
- receipt is verified to match:
  - target_kind + target_id
  - channel_target logical mapping under policy_version
  - payload_hash binding (must be verifiable via platform response or
    deterministic content markers)

If receipt is parse-valid but fails binding ⇒ freeze.

---

# 12. Bounded Retry Policy (Deterministic)

Rules:

- attempt_count increments exactly once per failed attempt
- attempt_count is monotonic (never decreases)
- if attempt_count >= max_attempts ⇒ FAILED_FINAL
- next_attempt_at uses deterministic backoff:
  - backoff = f(attempt_count, env, event_type) (versioned under policy)

No unbounded retry. No “retry forever.”

---

# 13. DLQ Policy (Deterministic, Terminal)

DEAD_LETTER is terminal.

A DLQ’d record:

- MUST NOT re-enter normal processing
- MUST NOT be mutated except to add dlq_reason/updated_at
- MUST NOT be deleted

If re-delivery is needed, it must be a NEW outbox record that:

- references the prior record via `supersedes_outbox_id`
- uses a new id
- has its own deterministic idempotency key

---

# 14. Forbidden Mutations (Explicit)

Strictly forbidden:

- Updating intent_payload
- Updating payload_hash
- Updating routing_inputs / routing_inputs_hash
- Updating routing_key
- Updating policy_version or renderer_version
- Updating target_id after insert
- Deleting records in terminal states
- Transitioning DELIVERED/DEAD_LETTER back to active states

Detection ⇒ freeze.

---

# 15. Kill / Freeze Conditions (Closed Set)

System must enter FROZEN if any occurs:

- Duplicate idempotency_key detected
- Illegal transition attempted
- Immutable field update attempted
- payload_hash mismatch with stored intent_payload
- routing_inputs_hash mismatch
- policy_version mismatch against stored policy_version
- renderer_version mismatch against stored renderer_version
- Lease violation (non-holder write)
- Concurrent lease acquisition detected
- attempt_count non-monotonic change detected
- receipt binding fails (wrong target or wrong payload binding)
- delivered state without required receipt fields

Freeze means:

- No further delivery attempts
- All consumers halt processing
- Manual intervention required to thaw

---

# 16. Binary Acceptance Criteria (PASS/FAIL)

This contract is accepted only if all are true:

- All fields are defined and typed
- States are enumerated as a closed set
- Transitions are a closed set (no undefined transitions)
- Immutability is explicit and exhaustive
- Lease model prevents concurrent delivery
- Idempotency key is deterministic and unique
- Routing inputs are deterministic and stored
- Replay behavior is strictly defined
- Retry is bounded and deterministic
- DLQ is terminal with explicit re-intent rule
- Receipt verification is required and bound to intent+target
- Freeze conditions cover every invariant

If any item is not satisfied ⇒ FAIL.

---

# 17. Operational State Gating

Outbound distribution MUST halt when operational state is FROZEN or UNKNOWN,
governed by FREEZE_DETECTION_LAW_v1.1 and UNKNOWN_STATE_POLICY_v1.1.

Any audit ordering or integrity violation MUST halt distribution and force
freeze using: freeze_reason_code = AUDIT_LOG_INTEGRITY_FAIL (canonical via
FREEZE_REASON_CODE_CANON_v1.0), with ordering governed by
OPERATIONAL_AUDIT_LOG_CONTRACT_v1.1.

---

# 18. Canonical Binding

- CONSTITUTION_v1.0 (supreme design-layer authority)
- OPERATIONAL_AUDIT_LOG_CONTRACT_v1.1 (deterministic ordering and integrity)
- FREEZE_DETECTION_LAW_v1.1 (freeze trigger law)
- FREEZE_AUTHORITY_MODEL_v1.1 (freeze authority)
- FREEZE_REASON_CODE_CANON_v1.0 (canonical freeze enum authority)
- SLO_REGISTRY_TABLE_v1.1 (threshold authority)
- UNKNOWN_STATE_POLICY_v1.1 (unknown-state gating and escalation)

---

# 19. Final Declaration

The Outbox is a deterministic, append-only intent ledger.

- Payload immutable
- Routing reproducible
- Delivery lease-safe
- Retries bounded
- Receipts verified
- Drift fail-closed

No bypass exists. No “fix it later” exists.

Phase 3 cannot proceed until this contract is ratified.

A) Receipt binding method (binary)

intent_payload MUST include intent_fingerprint.

intent_fingerprint MUST equal payload_hash (or a single explicitly defined
truncation rule).

Receipt verification MUST confirm the external artifact contains
intent_fingerprint in a deterministic location (e.g., embed footer).

Missing/mismatch ⇒ FROZEN.

B) Lease TTL determinism (binary)

LEASE_TTL MUST be derived solely from (env, policy_version, event_type).

TTL MUST NOT change without a new policy_version.

Any lease behavior inconsistent with stored policy_version ⇒ FROZEN.
