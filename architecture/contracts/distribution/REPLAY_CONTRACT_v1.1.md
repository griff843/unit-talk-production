# REPLAY_CONTRACT_v1.1.md

Unit Talk – Clean-Room Doctrine  
Phase 3 — Distribution Determinism (Design Only)  
Status: DRAFT

---

# 1. Purpose

Defines deterministic replay semantics for Outbox records.

Replay restores delivery truth. Replay never changes intent, routing, policy, or
environment.

---

# 2. Core Invariants (Fail-Closed)

| ID      | Invariant                                          |
| ------- | -------------------------------------------------- |
| RPL-001 | Replay never mutates immutable fields              |
| RPL-002 | Replay never recomputes routing                    |
| RPL-003 | Replay never overrides retry bounds                |
| RPL-004 | Replay requires lease for outbound call            |
| RPL-005 | Receipt recovery may occur without lease           |
| RPL-006 | Terminal states remain terminal                    |
| RPL-007 | policy_version and policy_hash must match registry |
| RPL-008 | Replay is environment-scoped                       |

Violation ⇒ FROZEN.

---

# 3. Replay vs Retry (Closed Definitions)

Retry:

- Scheduled re-attempt governed by RETRY_POLICY.

Replay:

- Deterministic re-execution of recovery procedure for a stored record.

Replay does not introduce new scheduling dimension.

---

# 4. Allowed Replay States (Closed Set)

Replay allowed only when state ∈:

- IN_PROGRESS
- RETRY_SCHEDULED
- FAILED_FINAL (receipt recovery only)

Replay forbidden when state ∈:

- DELIVERED
- DEAD_LETTER
- FROZEN
- PENDING

Forbidden replay attempt ⇒ FROZEN.

---

# 5. Lease Requirements

Outbound call during replay requires:

- Active valid lease
- lease_owner matches executing consumer
- lease not expired

Receipt recovery (artifact lookup only) may occur without lease.

Outbound call without lease ⇒ FROZEN.

---

# 6. Attempt Count Mutation Rules

attempt_count increments only when:

- Outbound call executed AND
- Verification fails

attempt_count MUST NOT increment for:

- Artifact lookup
- Receipt recovery
- No-op replay
- Crash recovery validation

Mutation outside this rule ⇒ FROZEN.

---

# 7. Policy Integrity Validation

Replay must verify:

- policy_version exists
- policy_hash matches canonical policy registry
- routing_key derived from stored routing_inputs matches stored routing_key

Mismatch ⇒ FROZEN.

Replay must never recompute routing under altered policy content.

---

# 8. Replay Procedure (Deterministic Order)

1. Environment validation (env matches runtime)
2. Freeze state check (if FROZEN ⇒ stop)
3. Immutable field hash validation
4. Terminal state validation
5. Receipt existence check (receipt fields present and valid)
6. Artifact lookup (bounded)
7. If artifact found ⇒ DELIVERED (atomic write)
8. If outbound eligible and lease valid:
   - Send stored intent_payload verbatim
   - Capture receipt_reference
   - Verify artifact
   - On success ⇒ DELIVERED
   - On failure ⇒ increment attempt_count per rule
9. If retry bounds exceeded ⇒ FAILED_FINAL or DLQ per Retry/DLQ contracts

No alternate execution path allowed.

---

# 9. Forbidden Mutations

Replay must never modify:

- intent_payload
- payload_hash
- intent_fingerprint
- routing_inputs
- routing_inputs_hash
- routing_key
- policy_version
- policy_hash
- renderer_version
- target_kind
- target_id
- idempotency_key
- env
- created_at

Attempted mutation ⇒ FROZEN.

---

# 10. Replay Drift Freeze Triggers

System MUST FROZEN if:

- policy_hash mismatch with registry
- routing_key mismatch on recompute
- env mismatch
- immutable field hash mismatch
- receipt mismatch
- outbound call attempted without lease
- attempt_count mutated improperly
- terminal state replay attempted

---

# 11. Binary Acceptance Criteria

Contract accepted only if:

- Replay vs Retry clearly separated
- Lease rules explicit
- attempt_count mutation rules explicit
- policy integrity validated
- Immutable fields explicitly listed
- Terminal states protected
- Execution order deterministic
- Drift freeze triggers exhaustive
- No undefined replay behavior

Otherwise ⇒ FAIL.

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

Replay under Clean-Room Doctrine is:

- Deterministic
- Lease-bound
- Policy-locked
- Immutable
- Receipt-aware
- Retry-bounded
- Drift-intolerant
- Fail-closed

Replay restores truth. Replay never alters truth.
