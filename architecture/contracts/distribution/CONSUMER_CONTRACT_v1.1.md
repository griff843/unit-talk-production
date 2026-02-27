# CONSUMER_CONTRACT_v1.1.md

Unit Talk – Clean-Room Doctrine  
Phase 3 — Distribution Determinism (Design Only)  
Status: DRAFT

---

# 1. Purpose

The Consumer executes Outbox records deterministically.

The Consumer is:

- Non-authoritative
- Stateless with respect to business truth
- Fully dependent on Outbox for state
- Deterministic in behavior

The Consumer does not own truth. It executes stored intent.

---

# 2. Statelessness Definition (Binary)

Consumer may not persist authoritative state.

Authoritative state lives exclusively in Outbox.

Consumer identity is ephemeral.

All decisions must derive solely from:

- Outbox record
- policy_version
- deterministic system time (UTC)

No process memory may influence routing, ordering, or decision logic.

---

# 3. Execution Model (Single-Consumer Determinism)

Under Clean-Room Phase 3:

Only one active consumer instance may process records per environment.

Parallel consumers are forbidden.

This removes ordering ambiguity.

If multiple consumers detected ⇒ FROZEN.

---

# 4. Eligibility Rules

Record eligible only if:

- state ∈ {PENDING, RETRY_SCHEDULED}
- now >= eligibility timestamp
- no active lease OR lease expired

Eligibility evaluation must not mutate record.

---

# 5. Lease Model (Deterministic)

Lease acquisition must be atomic.

Lease TTL derived solely from:

(env, policy_version, event_type)

Lease expiration does not increment attempt_count.

Only transition to IN_PROGRESS increments no counters.

---

# 6. Delivery Execution Rules

Consumer must:

- Use stored intent_payload verbatim
- Use stored target_kind + target_id
- Not regenerate payload
- Not modify routing

Delivery attempt is defined as:

Outbound platform call initiated.

---

# 7. Atomic Delivery + Receipt Rule

Transition to DELIVERED must be atomic with receipt write.

DELIVERED state requires:

- receipt_reference
- receipt_payload
- receipt_payload_hash
- delivered_at

If crash occurs before state mutation:

- Replay must verify existence of external artifact using intent_fingerprint
- If artifact exists, state may safely transition to DELIVERED

Duplicate external post must not occur.

---

# 8. Attempt Accounting Rules

attempt_count increments only if:

- Delivery attempt executed AND
- Receipt verification failed

attempt_count must be strictly monotonic.

next_attempt_at must be strictly greater than prior next_attempt_at.

---

# 9. Retry Scheduling Determinism

Backoff function:

f(policy_version, env, event_type, attempt_count)

Must be pure and reproducible.

No randomness allowed.

---

# 10. DLQ Transition

FAILED_FINAL → DEAD_LETTER only.

DEAD_LETTER is terminal.

Consumer must not requeue.

---

# 11. Freeze Scope Definition

Freeze is global per environment.

When freeze triggered:

- No Outbox records may be processed
- Consumer must halt immediately
- Freeze persists until manual resolution
- Restart does not clear freeze

---

# 12. Idempotent External Appearance

Before posting, consumer must:

- Check whether receipt_reference already exists OR
- Verify existence of artifact using intent_fingerprint

If artifact exists:

- Do not repost
- Transition to DELIVERED

Duplicate external artifact creation ⇒ FROZEN.

---

# 13. Ordering Guarantee

Records must be processed strictly in:

1. created_at ascending
2. delivery_priority ascending
3. id ascending

Single-consumer model guarantees ordering.

---

# 14. Crash Recovery Model

On restart:

- Expired leases reclaimable
- attempt_count not incremented unless outbound call confirmed
- External artifact presence check required before retry

Crash must not produce:

- Lost delivery
- Duplicate delivery
- State drift

---

# 15. Forbidden Behaviors

Strictly forbidden:

- Multiple concurrent consumers
- Direct external posting outside Outbox
- Receipt skipping
- State mutation outside contract
- Ignoring freeze state
- Altering immutable fields

Violation ⇒ FROZEN.

---

# 16. Binary Acceptance Criteria

Contract accepted only if:

- Statelessness precisely defined
- Single-consumer model enforced
- Atomic delivery + receipt rule defined
- Crash recovery deterministic
- Freeze scope defined
- Retry bounded
- No undefined concurrency
- Ordering deterministic
- Idempotency guaranteed under crash

Otherwise ⇒ FAIL.

---

# 17. Operational State Gating

Consumer MUST NOT process Outbox records while operational state is FROZEN or
UNKNOWN, governed by FREEZE_DETECTION_LAW_v1.1 and UNKNOWN_STATE_POLICY_v1.1.

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

The Consumer under Clean-Room Doctrine is:

- Deterministic
- Single-threaded per environment
- Lease-safe
- Crash-safe
- Idempotent
- Fail-closed

It executes truth. It does not create truth.
