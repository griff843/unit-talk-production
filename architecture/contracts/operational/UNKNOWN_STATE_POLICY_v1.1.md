# UNKNOWN_STATE_POLICY_v1.1

**Version:** v1.1 **Phase:** Phase 4 — Operational Determinism **Status:**
DESIGN ONLY

---

## 1. Purpose

This contract defines the deterministic handling of **UNKNOWN** operational
state.

UNKNOWN is not a healthy state. UNKNOWN is a bounded tolerance window used only
when required signals are missing, stale, or contradictory.

UNKNOWN must never be passive. UNKNOWN must deterministically escalate to freeze
when thresholds are exceeded.

---

## 2. Definitions

### 2.1 UNKNOWN State

UNKNOWN is the computed operational health state when the system cannot prove:

- HEALTHY
- DEGRADED
- FROZEN

because required truth signals are unavailable or invalid.

### 2.2 Required Truth Signals

Required truth signals are the minimum signal set that must be present and valid
to compute deterministic operational state.

If any required truth signal is missing, stale, or contradictory, state MUST be
UNKNOWN.

### 2.3 Unknown Window

Unknown Window is the maximum permitted duration the system may remain in
UNKNOWN before mandatory escalation.

---

## 3. Global Invariants

1. UNKNOWN is fail-closed for outbound delivery.
2. UNKNOWN must halt outbound delivery until state becomes determinable.
3. UNKNOWN must be measurable and time-bounded.
4. UNKNOWN must deterministically escalate if duration exceeds thresholds.
5. UNKNOWN resolution must be evidence-based and measurable.
6. UNKNOWN must be recorded in the operational audit log as a state transition
   event.

---

## 4. Entry Conditions (Deterministic)

System MUST enter UNKNOWN when any of the following are true:

1. Any required truth signal is missing.
2. Any required truth signal is stale beyond its staleness window.
3. Any required truth signal is contradictory to another required truth signal.
4. Audit integrity cannot be asserted.
5. Environment identity cannot be asserted.

UNKNOWN entry must record evidence pointers describing which condition(s)
triggered UNKNOWN.

---

## 5. Required Inputs (Minimum Set)

The system must define a minimum set of required truth signals sufficient to
compute state deterministically, including:

- environment identity
- audit stream identity
- last audit sequence visibility
- outbox backlog metrics (pending count, oldest age)
- consumer progress metrics (last processed age)
- discord delivery health metrics (failure rate, confirmation latency)
- settlement progress metrics (oldest unsettled age)

If any of these classes of signals are unavailable, state MUST be UNKNOWN.

This contract does not define thresholds; thresholds are defined in
`SLO_REGISTRY_TABLE_v1.1`.

---

## 6. Unknown Duration Tracking (Deterministic)

UNKNOWN duration must be tracked as:

- unknown_start_timestamp_utc
- current_timestamp_utc
- unknown_duration_seconds

UNKNOWN duration must be monotonic while UNKNOWN persists.

Any reset of unknown_start_timestamp_utc while still UNKNOWN is a contract
violation.

---

## 7. Escalation Rules (Deterministic)

### 7.1 Warning Escalation

If UNKNOWN duration exceeds the warning threshold for unknown duration, incident
tier escalation must occur according to incident classification rules.

### 7.2 Freeze Escalation

If UNKNOWN duration exceeds the freeze threshold for unknown duration, freeze
MUST trigger with:

- freeze_reason_code = UNKNOWN_STATE_TIMEOUT

UNKNOWN_STATE_TIMEOUT is mandatory for unknown-duration freeze escalation.

### 7.3 Canonical Binding References

This contract binds to the following authoritative documents:

- `OPERATIONAL_AUDIT_LOG_CONTRACT_v1.1` — Audit log structure and state
  transition logging
- `FREEZE_DETECTION_LAW_v1.1` — Freeze trigger conditions and escalation
  pathways
- `FREEZE_REASON_CODE_CANON_v1.0` — Canonical freeze reason codes
- `SLO_REGISTRY_TABLE_v1.1` — SLO thresholds including `SLO_UNKNOWN_DURATION`

`freeze_reason_code` values MUST be selected exclusively from
`FREEZE_REASON_CODE_CANON_v1.0`.

Warning and freeze thresholds for UNKNOWN duration MUST be sourced from
`SLO_REGISTRY_TABLE_v1.1`.

Cross-environment contamination escalation pathway MUST follow
`FREEZE_DETECTION_LAW_v1.1`.

This contract MUST NOT define `freeze_reason_code` or threshold values locally.

Any non-canonical value is a contract violation.

---

## 8. Resolution Rules (Deterministic)

UNKNOWN may resolve only when:

1. All required truth signals are present
2. All required truth signals are within staleness windows
3. No required truth signals are contradictory
4. Audit integrity can be asserted
5. Environment identity can be asserted

Resolution must be recorded as a state transition event with evidence pointers.

UNKNOWN must not self-resolve silently.

---

## 9. Audit Logging Requirements

Every UNKNOWN transition must be recorded in the operational audit log with:

- environment
- transition_type (ENTER_UNKNOWN | EXIT_UNKNOWN)
- timestamp_utc
- evidence_pointer
- required_signal_status_summary

Audit ordering guarantees are defined in `OPERATIONAL_AUDIT_LOG_CONTRACT_v1.1`.

---

## 10. Cross-Environment Separation Invariant

UNKNOWN state must never be computed using signals from a different environment.

If cross-environment signal contamination is detected, UNKNOWN must escalate
immediately to freeze via the contamination pathway defined in
`FREEZE_DETECTION_LAW_v1.1` (Section 5.10 `CROSS_ENV_CONTAMINATION`).

---

## 11. Acceptance Criteria (Binary)

PASS only if all are true:

1. UNKNOWN entry conditions are explicit and deterministic.
2. Required truth signal classes are explicitly defined.
3. Unknown duration tracking is monotonic and auditable.
4. Escalation includes deterministic freeze mapping to UNKNOWN_STATE_TIMEOUT.
5. UNKNOWN resolution requires measurable evidence and is audit-logged.
6. Cross-environment separation rule is explicit.

FAIL if UNKNOWN can persist without escalation rules or without audit
visibility.

---

## Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

**End of Document**
