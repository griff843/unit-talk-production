# REPLAY_CONTRACT_v1.0.md

Unit Talk – Clean-Room Doctrine  
Phase 3 — Distribution Determinism (Design Only)  
Status: DRAFT

---

# 1. Purpose

This contract defines deterministic **replay** semantics for Outbox records.

Replay exists to guarantee:

- Idempotent external appearance under crash/restart
- Safe re-attempt without payload or routing drift
- Deterministic recovery when receipt is missing or uncertain
- Strict separation between replay vs new intent creation

Replay is not:

- A rerender mechanism
- A routing recomputation mechanism
- A way to change targets
- A way to override policy_version
- A way to bypass retry bounds
- A way to resurrect terminal records

---

# 2. Core Invariants (Fail-Closed)

| ID      | Invariant                     | Definition                                    |
| ------- | ----------------------------- | --------------------------------------------- |
| RPL-001 | Replay never changes intent   | intent_payload, payload_hash immutable        |
| RPL-002 | Replay never changes routing  | routing_inputs, routing_key, target immutable |
| RPL-003 | Replay is bounded             | Replay cannot create infinite loops           |
| RPL-004 | Replay must be receipt-aware  | If artifact exists, do not repost             |
| RPL-005 | Replay must be deterministic  | Same stored record ⇒ same behavior            |
| RPL-006 | Terminal states are terminal  | DELIVERED/DEAD_LETTER/FROZEN never replayed   |
| RPL-007 | Replay cannot override policy | policy_version is locked                      |
| RPL-008 | Drift detection required      | Any mismatch ⇒ FROZEN                         |

Violation ⇒ FROZEN.

---

# 3. Definitions (Binary)

## 3.1 Retry vs Replay

- **Retry**: scheduled re-attempt after a failed executed attempt; governed by
  RETRY_POLICY.
- **Replay**: deterministic recovery attempt when prior external action may have
  succeeded but local receipt/state is missing or uncertain (e.g., crash after
  post).

Replay must not increment attempt_count unless a new outbound call is executed
and fails verification.

---

# 4. Allowed Replay States (Closed Set)

Replay may be executed only when state ∈:

- IN_PROGRESS (lease held)
- RETRY_SCHEDULED (eligible)
- FAILED_FINAL (receipt recovery only; no outbound call allowed)

Replay is forbidden when state ∈:

- DELIVERED
- DEAD_LETTER
- FROZEN
- PENDING (must follow normal flow)

Any forbidden replay attempt ⇒ FROZEN.

---

# 5. Replay Preconditions

Replay requires:

- env present and matches runtime env identity
- policy_version present and recognized
- payload_hash matches intent_payload (re-hash)
- routing_inputs_hash matches routing_inputs (re-hash)
- target_kind and target_id present
- intent_fingerprint present in intent_payload and equals payload_hash (full
  SHA256)

Any precondition failure ⇒ FROZEN.

---

# 6. Replay Procedure (Deterministic)

Replay MUST execute in this order:

1. **Terminal Check**
   - If state == DELIVERED → stop (no-op)
   - If state == DEAD_LETTER → forbidden → FROZEN
   - If state == FROZEN → stop (system halted)

2. **Receipt Presence Check**
   - If receipt_reference exists → validate receipt fields + immutability
   - If valid → ensure state == DELIVERED
   - If receipt fields present but invalid/mismatched → FROZEN

3. **Artifact Existence Check (Bounded)**
   - Use RECEIPT_VERIFICATION contract:
     - If receipt_reference unknown: bounded lookup by exact intent_fingerprint
       within target_id window
   - If artifact found:
     - Transition to DELIVERED atomically with receipt fields
     - Do not perform outbound call

4. **Outbound Call Eligibility** Outbound call allowed only if:
   - state ∈ {IN_PROGRESS, RETRY_SCHEDULED}
   - record is eligible by timestamps
   - lease held by current consumer (if applicable)

If not eligible, stop (no mutation).

5. **Outbound Call Execution**
   - Send stored intent_payload verbatim to stored target
   - Capture receipt_reference
   - Verify artifact immediately by receipt_reference
   - If verified → DELIVERED (atomic write)
   - If not verified → failed attempt accounting + retry scheduling

Replay must never rerender payload or recompute routing.

---

# 7. Replay Bounds (No Infinite Loops)

Replay is bounded by:

- max_attempts (existing retry bounds)
- max_total_retry_window_seconds (retry window bound)
- receipt lookup bounds (receipt contract)
- lease TTL bounds (consumer contract)

Replay must not introduce new loop dimensions.

If replay attempts exceed retry bounds ⇒ transition to FAILED_FINAL / DLQ per
existing contracts.

---

# 8. Forbidden Mutations During Replay

Replay must never change:

- intent_payload
- payload_hash
- intent_fingerprint
- routing_inputs
- routing_inputs_hash
- routing_key
- policy_version
- renderer_version
- target_kind
- target_id
- idempotency_key
- env

Any mutation attempt ⇒ FROZEN.

---

# 9. Replay and Terminal States

## 9.1 DELIVERED

- Replay is a no-op.
- Receipt immutability enforced.
- Any receipt mutation attempt ⇒ FROZEN.

## 9.2 FAILED_FINAL

Replay may only perform artifact existence check to recover receipt truth.
Outbound call is forbidden in FAILED_FINAL. If artifact found → DELIVERED. If
not found → remains FAILED_FINAL.

## 9.3 DEAD_LETTER

Replay forbidden.

## 9.4 FROZEN

Replay forbidden; system halted.

---

# 10. Drift Detection (Replay-Specific Freeze Triggers)

System MUST FROZEN if:

- payload_hash mismatch with intent_payload
- intent_fingerprint missing or mismatch
- routing_inputs_hash mismatch
- routing_key mismatch
- policy_version missing/unknown
- target mismatch or cross-env target detected
- receipt exists but fails binding checks
- multiple artifacts match fingerprint in bounded lookup
- any immutable field mutation attempted

Freeze is environment-scoped (ENV contract).

---

# 11. Binary Acceptance Criteria

Contract accepted only if:

- Replay definition is distinct from retry
- Allowed states closed-set
- Replay procedure is ordered and deterministic
- Artifact lookup bounded and defined
- Outbound call eligibility explicit
- Forbidden mutations explicit
- Terminal-state rules explicit
- Drift detection exhaustive
- No undefined replay behavior exists

Otherwise ⇒ FAIL.

---

# 12. Final Declaration

Replay under Clean-Room Doctrine is:

- Deterministic
- Receipt-aware
- Artifact-validated
- Drift-intolerant
- Bounded
- Fail-closed

Replay restores truth. Replay does not change truth.
