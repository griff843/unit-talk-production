# DLQ_CONTRACT_v1.0.md

Unit Talk – Clean-Room Doctrine  
Phase 3 — Distribution Determinism (Design Only)  
Status: DRAFT

---

# 1. Purpose

The Dead Letter Queue (DLQ) contract defines the deterministic terminal handling
of Outbox records that have exhausted retry attempts.

DLQ guarantees:

- Terminal state integrity
- Historical auditability
- No silent requeue
- No mutation of failed intent
- Deterministic supersession behavior
- Isolation from active distribution flow

DLQ is not:

- A retry extension
- A manual override bypass
- A dynamic recovery mechanism
- A soft failure state

DLQ is terminal unless a new Outbox intent is explicitly created.

---

# 2. Core Invariants (Fail-Closed)

| ID      | Invariant                                     |
| ------- | --------------------------------------------- |
| DLQ-001 | DEAD_LETTER is terminal                       |
| DLQ-002 | FAILED_FINAL must precede DEAD_LETTER         |
| DLQ-003 | No automatic requeue                          |
| DLQ-004 | DLQ records are immutable except metadata     |
| DLQ-005 | Supersession requires new Outbox record       |
| DLQ-006 | Historical linkage must be preserved          |
| DLQ-007 | DLQ processing must not affect active records |
| DLQ-008 | No deletion of DLQ records                    |

Violation ⇒ FROZEN.

---

# 3. DLQ Eligibility

A record may enter DEAD_LETTER only if:

- state == FAILED_FINAL
- attempt_count == max_attempts
- Retry policy has determined no further attempts are allowed

Direct transition from any other state ⇒ FROZEN.

---

# 4. DEAD_LETTER State Definition

When state == DEAD_LETTER:

- No further retry scheduling allowed
- No lease acquisition allowed
- No transition back to PENDING/RETRY_SCHEDULED/IN_PROGRESS
- No mutation of immutable fields
- No modification of intent_payload
- No modification of routing fields

DEAD_LETTER is terminal.

---

# 5. DLQ Metadata (Allowed Fields)

The following metadata fields may be set upon DLQ transition:

- dlq_reason (closed enum)
- dlq_at (timestamp)
- final_error_code
- final_error_reason
- updated_at

No other mutation allowed.

---

# 6. dlq_reason (Closed Enum)

dlq_reason ∈:

- MAX_ATTEMPTS_EXCEEDED
- RETRY_WINDOW_EXCEEDED
- POLICY_VIOLATION
- RECEIPT_VERIFICATION_FAILURE
- MANUAL_TERMINATION (if allowed under governance)
- FREEZE_PROPAGATION

Unknown reason ⇒ FROZEN.

---

# 7. Supersession Model

If a DLQ’d record requires corrective action:

A new Outbox record must be created.

Rules:

- New record MUST have new id
- New idempotency_key must reflect new intent
- New record MUST reference prior record via supersedes_outbox_id
- Prior record MUST remain DEAD_LETTER
- No mutation of original record allowed

Supersession is additive, not mutative.

---

# 8. Supersession Determinism

If superseding record is created:

- It must use current policy_version
- It must generate new routing_inputs
- It must produce new payload_hash
- It must not reuse prior idempotency_key

Reusing prior idempotency_key ⇒ FROZEN.

---

# 9. DLQ Isolation Rules

DEAD_LETTER records:

- Must not be processed by Consumer
- Must not be considered in retry eligibility
- Must not influence ordering of active records
- Must not be deleted or archived without governance contract

If Consumer attempts to process DEAD_LETTER ⇒ FROZEN.

---

# 10. DLQ Audit Requirements

Each DLQ transition must preserve:

- Full Outbox record history
- attempt_count
- retry schedule history (if logged)
- last_error_code
- policy_version

Historical determinism must remain reconstructable.

---

# 11. DLQ and Freeze Interaction

If record enters DEAD_LETTER due to invariant violation:

- Freeze state must be triggered (per other contracts)
- DLQ does not override freeze

If system is FROZEN:

- No new DLQ transitions may occur until freeze resolved

---

# 12. Forbidden Behaviors

Strictly forbidden:

- Manual state flip from DEAD_LETTER to active
- Deleting DLQ records
- Editing immutable fields of DLQ record
- Reusing idempotency_key for supersession
- Bypassing FAILED_FINAL state

Detection ⇒ FROZEN.

---

# 13. Binary Acceptance Criteria

Contract accepted only if:

- DEAD_LETTER terminal behavior defined
- Supersession model explicit
- dlq_reason closed enum
- No automatic requeue allowed
- No mutation of immutable fields allowed
- Historical linkage preserved
- Consumer isolation explicit
- Freeze interaction defined
- No undefined DLQ behavior exists

Otherwise ⇒ FAIL.

---

# 14. Final Declaration

DLQ under Clean-Room Doctrine is:

- Terminal
- Immutable
- Audit-preserving
- Supersession-only
- Isolation-safe
- Fail-closed

There is no silent recovery. There is no hidden retry. There is no state
mutation.
