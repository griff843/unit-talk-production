# CONSUMER_CONTRACT_v1.0.md

Unit Talk – Clean-Room Doctrine  
Phase 3 — Distribution Determinism (Design Only)  
Status: DRAFT

---

# 1. Purpose

The Consumer Contract defines the deterministic execution rules for processing
Outbox records.

The Consumer is responsible for:

- Lease acquisition
- Delivery attempt execution
- Receipt verification
- Retry scheduling
- DLQ transition
- Freeze propagation

The Consumer is not allowed to:

- Re-render payloads
- Modify routing
- Modify immutable fields
- Introduce runtime overrides
- Skip verification
- Recover from freeze autonomously

The Consumer must operate as a pure execution engine over the Outbox ledger.

---

# 2. Core Invariants (Fail-Closed)

| ID     | Invariant                      | Definition                                      |
| ------ | ------------------------------ | ----------------------------------------------- |
| CC-001 | Consumer is stateless          | No delivery logic depends on process memory     |
| CC-002 | Lease exclusivity enforced     | Only lease holder may mutate state              |
| CC-003 | Payload immutability respected | intent_payload never re-rendered                |
| CC-004 | Receipt must be verified       | No success without receipt binding              |
| CC-005 | Retry bounded                  | attempt_count strictly monotonic                |
| CC-006 | No silent recovery             | Any invariant violation ⇒ FROZEN                |
| CC-007 | Deterministic scheduling       | Eligibility derived only from stored timestamps |
| CC-008 | No out-of-band posting         | All posts must originate from Outbox record     |

---

# 3. Consumer Eligibility Rules

A Consumer may process a record only if:

- state ∈ {PENDING, RETRY_SCHEDULED}
- now >= available_at (PENDING) OR
- now >= next_attempt_at (RETRY_SCHEDULED)

If eligibility conditions not met ⇒ no action.

---

# 4. Lease Acquisition Protocol

## 4.1 Claim Conditions

Consumer may transition record to IN_PROGRESS only if:

- No active lease OR
- lease_expires_at < now

On claim:

- lease_owner set
- lease_token generated
- claimed_at set
- lease_expires_at set (per policy_version)
- state → IN_PROGRESS

## 4.2 Lease Violation

If any consumer attempts to mutate record without holding:

(lease_owner, lease_token)

⇒ FROZEN.

---

# 5. Delivery Attempt Rules

Consumer must:

- Use stored intent_payload verbatim
- Use stored target_kind
- Use stored target_id
- Not modify payload
- Not re-resolve routing

No transformation allowed.

---

# 6. Receipt Verification Protocol

A record may transition to DELIVERED only if:

1. External platform returns receipt_reference
2. receipt_payload captured
3. receipt_payload_hash computed
4. intent_fingerprint verified inside external artifact
5. target binding verified
6. receipt_reference bound to correct target_id

Failure at any verification step ⇒ treat as failed attempt.

---

# 7. Attempt Accounting

On failed attempt:

- attempt_count incremented exactly once
- last_error_code recorded
- last_error_reason recorded
- last_error_at recorded

attempt_count must never decrease.

If attempt_count > max_attempts ⇒ FROZEN.

If attempt_count == max_attempts ⇒ FAILED_FINAL.

---

# 8. Retry Scheduling

On failure and attempt_count < max_attempts:

- next_attempt_at computed using deterministic backoff
- state → RETRY_SCHEDULED

Backoff must be derived from:

(policy_version, env, event_type, attempt_count)

No randomness allowed.

---

# 9. DLQ Transition

When state == FAILED_FINAL:

Consumer must transition to DEAD_LETTER.

DEAD_LETTER is terminal.

Consumer must never requeue same record.

Requeue requires new Outbox record (handled outside consumer).

---

# 10. Replay Rules

Replay means reattempting an existing record.

Replay must:

- Use original intent_payload
- Preserve routing
- Preserve target
- Preserve policy_version
- Preserve renderer_version

Replay must not:

- Regenerate payload
- Regenerate routing
- Modify idempotency_key

---

# 11. Freeze Propagation

Consumer must trigger FROZEN state if:

- Lease violation detected
- Immutable field mutation attempted
- routing_key mismatch
- payload_hash mismatch
- policy_version mismatch
- receipt binding fails
- attempt_count anomaly detected
- multiple concurrent lease claims detected
- replay produces different routing
- out-of-band delivery detected

Freeze means:

- All consumer threads halt
- No further attempts processed
- Manual investigation required

---

# 12. Idempotent External Appearance

Consumer must ensure that:

- Duplicate deliveries are prevented via idempotency_key enforcement
- External platform must not receive duplicate messages for same record

If external duplicate detected ⇒ FROZEN.

---

# 13. Ordering Guarantees

If multiple Outbox records are eligible:

Consumer must process in deterministic order:

- Primary: created_at ascending
- Secondary: delivery_priority ascending
- Tertiary: id ascending

No parallel non-deterministic execution allowed unless lease isolation preserves
order determinism.

---

# 14. Crash Recovery Rules

If consumer crashes:

- Lease expiration allows safe reclaim
- attempt_count must not increment unless attempt executed
- Duplicate delivery must be prevented by idempotency

Crash must not produce:

- Lost state
- Duplicate post
- Skipped record

---

# 15. Forbidden Behaviors

Strictly forbidden:

- Manual state mutation
- Direct posting outside Outbox
- Skipping receipt verification
- Modifying policy_version
- Altering target_id
- Skipping DLQ
- Ignoring freeze conditions

Detection ⇒ FROZEN.

---

# 16. Binary Acceptance Criteria

Contract accepted only if:

- Lease model defined
- Delivery semantics defined
- Receipt verification fully defined
- Retry bounded
- DLQ terminal
- Freeze conditions exhaustive
- No undefined consumer behavior
- Deterministic ordering defined
- No runtime overrides allowed

Otherwise ⇒ FAIL.

---

# 17. Final Declaration

The Consumer under Clean-Room Doctrine is:

- Deterministic
- Lease-safe
- Stateless
- Replay-stable
- Idempotent
- Fail-closed

It does not decide. It does not transform. It executes deterministically.
