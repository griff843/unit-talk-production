# RETRY_POLICY_CONTRACT_v1.1.md

Unit Talk – Clean-Room Doctrine  
Phase 3 — Distribution Determinism (Design Only)  
Status: DRAFT

---

# 1. Purpose

This contract defines the deterministic, bounded retry model for Outbox records.

Retry must be:

- Pure
- Monotonic
- Bounded in attempts
- Bounded in time
- Version-locked
- Reproducible from stored fields only

---

# 2. Core Invariants

| ID       | Invariant                                    |
| -------- | -------------------------------------------- |
| RTRY-001 | attempt_count strictly monotonic             |
| RTRY-002 | attempt_count ≤ max_attempts                 |
| RTRY-003 | next_attempt_at strictly increasing          |
| RTRY-004 | Backoff function pure and bounded            |
| RTRY-005 | Retry window bounded                         |
| RTRY-006 | No runtime tuning without new policy_version |

Violation ⇒ FROZEN.

---

# 3. Closed Inputs

Retry may depend only on:

- policy_version
- env
- event_type
- attempt_count
- last_error_at
- prior next_attempt_at
- max_attempts
- retry_class (closed enum)

Retry must NOT depend on current runtime time for scheduling computation.

---

# 4. Retry Class Model (Closed Enum)

retry_class ∈:

- TRANSIENT
- RATE_LIMIT
- PLATFORM_ERROR

Mapping from last_error_code → retry_class MUST be defined in policy_version.

Unknown error_code ⇒ FROZEN.

---

# 5. Backoff Function Definition

## 5.1 Backoff Type

Backoff MUST be exponential with cap: base_delay =
base_delay_seconds(policy_version, event_type, retry_class) delay =
min(base_delay \* 2^(attempt_count - 1), max_delay_seconds)

Where:

- base_delay_seconds is constant under policy_version
- max_delay_seconds is constant under policy_version
- Both are immutable per policy_version

---

# 6. next_attempt_at Computation

Scheduling MUST NOT use runtime now.

Define: base_time = max(prior_next_attempt_at, last_error_at) next_attempt_at =
base_time + delay

Rules:

- next_attempt_at > prior_next_attempt_at
- next_attempt_at > last_error_at
- Must be UTC
- Must be stored on record

If next_attempt_at ≤ prior_next_attempt_at ⇒ FROZEN.

---

# 7. Total Retry Window Bound

Define:

max_total_retry_window_seconds (constant per policy_version)

If:

(next_attempt_at - created_at) > max_total_retry_window_seconds

⇒ Transition to FAILED_FINAL immediately.

---

# 8. Attempt Accounting

attempt_count increments only if:

- Outbound call executed AND
- Receipt verification failed

attempt_count must not increment on:

- Lease claim only
- Crash without outbound call
- Freeze

---

# 9. Terminal Transition

If attempt_count ≥ max_attempts:

- state → FAILED_FINAL
- next_attempt_at must not be advanced
- No further retry allowed

If attempt_count > max_attempts ⇒ FROZEN.

---

# 10. Freeze Conditions (Retry-Specific)

System MUST FROZEN if:

- attempt_count decreases
- attempt_count increments without executed attempt
- attempt_count > max_attempts
- max_attempts differs from policy constant
- next_attempt_at non-monotonic
- retry_class undefined
- backoff function undefined for inputs
- total retry window exceeded without terminal transition

---

# 11. Binary Acceptance Criteria

Contract accepted only if:

- Backoff fully defined
- Delay bounded
- Retry window bounded
- No runtime scheduling dependency
- retry_class closed
- max_attempts deterministic
- Monotonic rules explicit
- Freeze triggers exhaustive

Otherwise ⇒ FAIL.

---

# 12. Threshold and Freeze Code Authority

Any threshold or freeze-eligible condition references SLO_REGISTRY_TABLE_v1.1
(no local thresholds). Any freeze reason references canonical codes only via
FREEZE_REASON_CODE_CANON_v1.0.

---

# 13. Canonical Binding

- CONSTITUTION_v1.0 (supreme design-layer authority)
- OPERATIONAL_AUDIT_LOG_CONTRACT_v1.1 (deterministic ordering and integrity)
- FREEZE_DETECTION_LAW_v1.1 (freeze trigger law)
- FREEZE_AUTHORITY_MODEL_v1.1 (freeze authority)
- FREEZE_REASON_CODE_CANON_v1.0 (canonical freeze enum authority)
- SLO_REGISTRY_TABLE_v1.1 (threshold authority)
- UNKNOWN_STATE_POLICY_v1.1 (unknown-state gating and escalation)

---

# 14. Final Declaration

Retry under Clean-Room Doctrine is:

- Exponential-with-cap
- Attempt-bounded
- Time-bounded
- Deterministic
- Version-locked
- Fail-closed

There is no infinite retry. There is no runtime adjustment. There is no silent
drift.
