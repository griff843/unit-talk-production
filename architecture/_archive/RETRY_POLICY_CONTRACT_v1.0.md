# RETRY_POLICY_CONTRACT_v1.0.md

Unit Talk – Clean-Room Doctrine  
Phase 3 — Distribution Determinism (Design Only)  
Status: DRAFT

---

# 1. Purpose

This contract defines the **deterministic retry system** for Outbox delivery
attempts.

It specifies:

- Retry eligibility rules
- Backoff function definition
- Attempt counting semantics
- Monotonic timestamp rules
- Terminal failure rules
- Drift prevention rules
- Freeze triggers related to retry behavior

Retry policy must be:

- Pure (no side effects)
- Deterministic
- Version-bound (via policy_version)
- Reproducible from Outbox state alone
- Fail-closed

Retry policy must not:

- Depend on runtime configuration
- Use randomness
- Use wall-clock variance beyond deterministic UTC time reference
- Be tuned without minting a new policy_version

---

# 2. Core Invariants (Fail-Closed)

| ID       | Invariant               | Definition                                                        |
| -------- | ----------------------- | ----------------------------------------------------------------- |
| RPOL-001 | Bounded retries         | attempt_count never exceeds max_attempts                          |
| RPOL-002 | Deterministic backoff   | Same inputs ⇒ same next_attempt_at                                |
| RPOL-003 | Monotonic attempt_count | attempt_count strictly increases only on failed executed attempts |
| RPOL-004 | Monotonic scheduling    | next_attempt_at strictly increases per failure                    |
| RPOL-005 | No runtime tuning       | Retry parameters cannot change without new policy_version         |
| RPOL-006 | Terminal is terminal    | FAILED_FINAL cannot re-enter retry states                         |
| RPOL-007 | No skip                 | Eligible retries must not be skipped silently                     |
| RPOL-008 | No infinite loops       | No policy yields an unbounded retry chain                         |

Any invariant violation ⇒ FROZEN.

---

# 3. Inputs (Closed Set)

Retry behavior MAY depend only on:

- env
- policy_version
- event_type
- attempt_count
- max_attempts
- last_error_code (optional; closed enum if used)
- created_at (record creation time)
- prior next_attempt_at (for monotonicity check)
- deterministic UTC now (for eligibility evaluation only)

Retry behavior MUST NOT depend on:

- Hostname / pod identity
- External API response timing
- Random values
- Runtime feature flags
- Subscriber counts
- Channel existence checks

---

# 4. Attempt Counting Semantics (Binary)

## 4.1 Definition of “Attempt Executed”

An attempt is considered **executed** only if:

- An outbound platform call was initiated to the target

If claim/lease acquisition occurs but no outbound call is initiated:

- attempt_count MUST NOT change

## 4.2 When attempt_count Increments

attempt_count increments exactly once when:

- Attempt executed AND
- Delivery did not reach DELIVERED (receipt verification not completed)

attempt_count MUST be strictly monotonic.

Any decrement ⇒ FROZEN.

---

# 5. max_attempts Determinism

max_attempts MUST be derived solely from:

(env, policy_version, event_type)

It MUST NOT be modified per-record after insert.

If a record’s max_attempts differs from the policy-defined constant for its
policy_version ⇒ FROZEN.

---

# 6. Backoff Function (Deterministic)

## 6.1 Backoff Function Definition

Backoff delay MUST be computed as:delay_seconds = f(env, policy_version,
event_type, attempt_count, last_error_code?)

The function f MUST be:

- Pure
- Deterministic
- Total (defined for all allowed inputs)
- Bounded (upper limit exists)

If last_error_code is used, it must be a **closed enum** and must not introduce
undefined branches.

## 6.2 next_attempt_at Computation

For any failed executed attempt where attempt_count <
max_attempts:next_attempt_at = max(prior_next_attempt_at + 1s, now_utc +
delay_seconds)

Rules:

- next_attempt_at MUST be strictly greater than prior_next_attempt_at
- next_attempt_at MUST be in UTC
- next_attempt_at MUST be stored on the record and becomes the sole eligibility
  time for the next retry

If next_attempt_at <= prior_next_attempt_at ⇒ FROZEN.

---

# 7. Eligibility Rules (Binary)

A record is eligible for retry only if:

- state == RETRY_SCHEDULED AND
- now_utc >= next_attempt_at

If eligible and not processed, the system must not silently skip:

- If a consumer is running and system is not frozen, eligible retries must be
  attempted in deterministic order per CONSUMER_CONTRACT.

---

# 8. Terminal Failure Rules (Binary)

## 8.1 Failed Final Transition

If attempt_count >= max_attempts:

- state MUST transition to FAILED_FINAL
- next_attempt_at MUST NOT be advanced further
- record MUST NOT re-enter retry states

If attempt_count > max_attempts ⇒ FROZEN.

## 8.2 DLQ Transition

FAILED_FINAL MUST transition to DEAD_LETTER per DLQ contract (separate
artifact).

Retry policy does not allow DLQ bypass.

---

# 9. Error Classification (If Used)

If retry behavior varies by error type:

- last_error_code MUST be from a closed enum
- Mapping from error_code → retry_class MUST be defined within policy_version
- Any unknown error_code ⇒ FROZEN (no default mapping)

If error classification is not used, retry must still be deterministic solely by
attempt_count.

---

# 10. Freeze Triggers (Retry-Specific)

System MUST enter FROZEN if any occurs:

- attempt_count decreases
- attempt_count increments without executed attempt
- attempt_count > max_attempts
- max_attempts changes post-insert
- backoff function undefined for given inputs
- next_attempt_at non-monotonic (<= prior)
- next_attempt_at computed using non-approved inputs
- state transitions violate retry state machine (e.g., FAILED_FINAL →
  RETRY_SCHEDULED)

Freeze is global per environment (per CONSUMER_CONTRACT).

---

# 11. Binary Acceptance Criteria

This contract is accepted only if:

- Inputs are a closed set
- Attempt increment semantics are binary and unambiguous
- max_attempts is deterministic and version-bound
- Backoff function is defined, pure, and bounded
- next_attempt_at monotonic rule is explicit
- Eligibility rule is explicit
- Terminal failure rule is explicit
- Freeze triggers are exhaustive for retry behavior
- No runtime tuning is possible without new policy_version

If any undefined behavior exists ⇒ FAIL.

---

# 12. Final Declaration

Retry under Clean-Room Doctrine is:

- Deterministic
- Bounded
- Monotonic
- Version-locked
- Drift-detectable
- Fail-closed

There are no “best efforts.” There is no “retry forever.” There is no runtime
tuning without a new policy_version.
