# DLQ_CONTRACT_v1.1.md

Unit Talk – Clean-Room Doctrine  
Phase 3 — Distribution Determinism (Design Only)  
Status: DRAFT

---

# 1. Purpose

The Dead Letter Queue (DLQ) defines the deterministic terminal state for Outbox
records that cannot be delivered.

DLQ guarantees:

- Terminal immutability
- Historical integrity
- Deterministic supersession
- Isolation from active flow
- Clear distinction between expected and violation-based terminalization

---

# 2. Core Invariants

| ID      | Invariant                                     |
| ------- | --------------------------------------------- |
| DLQ-001 | DEAD_LETTER is terminal                       |
| DLQ-002 | DLQ transition is atomic                      |
| DLQ-003 | No resurrection allowed                       |
| DLQ-004 | Supersession is additive, not mutative        |
| DLQ-005 | DLQ records immutable except allowed metadata |
| DLQ-006 | DLQ isolated from active processing           |
| DLQ-007 | Normal terminal DLQ does not imply freeze     |
| DLQ-008 | Violation-based DLQ triggers freeze           |

Violation ⇒ FROZEN.

---

# 3. DLQ Transition Semantics

## 3.1 Preconditions

Record may transition to DEAD_LETTER only if:

- state == FAILED_FINAL
- attempt_count == max_attempts OR
- retry_window_exceeded OR
- explicit invariant violation detected

## 3.2 Atomic Transition Rule

DLQ transition MUST be atomic with:

- state update
- dlq_reason set
- dlq_at set
- final_error fields set

Partial transition forbidden.

If crash occurs before commit ⇒ state remains FAILED_FINAL.

---

# 4. DLQ Categories

dlq_category ∈:

- NORMAL_TERMINAL
- VIOLATION_TERMINAL

## 4.1 NORMAL_TERMINAL

Examples:

- MAX_ATTEMPTS_EXCEEDED
- RETRY_WINDOW_EXCEEDED

Does NOT trigger system freeze.

## 4.2 VIOLATION_TERMINAL

Examples:

- POLICY_VIOLATION
- RECEIPT_VERIFICATION_FAILURE
- INVARIANT_BREACH

MUST trigger system FROZEN.

---

# 5. DEAD_LETTER State Rules

When state == DEAD_LETTER:

- No lease may be acquired
- No retry scheduling
- No state mutation except allowed metadata
- No transition to active states

Attempted resurrection ⇒ FROZEN.

---

# 6. Supersession Model

Supersession allowed only if:

- Original record state == DEAD_LETTER
- System not in FROZEN state
- Superseding record references same canonical_entity_id
- supersedes_outbox_id references a DEAD_LETTER record

Superseding record must:

- Have new id
- Have new idempotency_key
- Have new routing_inputs
- Have new payload_hash

Reusing original idempotency_key ⇒ FROZEN.

---

# 7. DLQ Timestamp Rules

dlq_at must:

- Be UTC
- Be >= last_error_at
- Be >= created_at

Non-monotonic timestamp ⇒ FROZEN.

---

# 8. Resurrection Prevention

System MUST FROZEN if:

- DEAD_LETTER → FAILED_FINAL
- DEAD_LETTER → RETRY_SCHEDULED
- DEAD_LETTER → IN_PROGRESS
- Lease fields written to DEAD_LETTER
- attempt_count modified in DEAD_LETTER

---

# 9. DLQ Isolation

Consumer must never:

- Claim DEAD_LETTER records
- Include DEAD_LETTER in ordering
- Retry DEAD_LETTER

Attempt ⇒ FROZEN.

---

# 10. Binary Acceptance Criteria

Contract accepted only if:

- Atomic DLQ transition defined
- DLQ categories defined
- Supersession guardrails defined
- Resurrection prevention explicit
- Timestamp monotonicity defined
- Isolation rules defined
- Freeze interaction defined
- No undefined terminal behavior

Otherwise ⇒ FAIL.

---

# 11. Threshold and Freeze Code Authority

Any threshold or freeze-eligible condition references SLO_REGISTRY_TABLE_v1.1
(no local thresholds). Any freeze reason references canonical codes only via
FREEZE_REASON_CODE_CANON_v1.0.

---

# 12. Canonical Binding

- CONSTITUTION_v1.0 (supreme design-layer authority)
- OPERATIONAL_AUDIT_LOG_CONTRACT_v1.1 (deterministic ordering and integrity)
- FREEZE_DETECTION_LAW_v1.1 (freeze trigger law)
- FREEZE_AUTHORITY_MODEL_v1.1 (freeze authority)
- FREEZE_REASON_CODE_CANON_v1.0 (canonical freeze enum authority)
- SLO_REGISTRY_TABLE_v1.1 (threshold authority)
- UNKNOWN_STATE_POLICY_v1.1 (unknown-state gating and escalation)

---

# 13. Final Declaration

DLQ under Clean-Room Doctrine is:

- Terminal
- Atomic
- Immutable
- Categorized
- Supersession-safe
- Isolation-enforced
- Fail-closed

There is no resurrection. There is no silent recovery. There is no partial
state.
