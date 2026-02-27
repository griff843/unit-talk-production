# COMMAND CENTER TRUTH MODEL

Version: v1.1 Phase: Phase 4 — Operational Determinism Status: DESIGN ONLY
Master Roadmap Reference: governance/master-roadmap/MASTER_ROADMAP_v1.0.md

---

# 1. PURPOSE

This contract defines the deterministic truth model for the Command Center.

Command Center is a projection surface. It must not invent state. It must not
mask violations. It must not present optimistic health when determinism is
unproven.

Command Center must be a pure function of:

- canonical operational signals
- Phase 4 SLO thresholds
- incident classification rules
- freeze state

If truth cannot be proven, Command Center must present UNKNOWN.

---

# 2. NON-NEGOTIABLE INVARIANTS

## 2.1 Projection-Only

Command Center MUST NOT:

- write to operational state
- modify outbox/receipt state
- modify freeze state
- modify incident state
- suppress alerting

If Command Center is capable of changing system state, this contract is
violated.

## 2.2 Fail-Closed Display

If required signals are missing, stale, or contradictory:

- computed_state MUST be UNKNOWN
- UI MUST display UNKNOWN
- no “healthy” banners are permitted

## 2.3 No Synthetic Health

Command Center MUST NOT infer health from:

- absence of errors
- lack of alerts
- time since last incident alone
- UI-level caches without evidence

Health must be computed from Phase 4 signals.

---

# 3. INPUTS (CANONICAL)

Command Center truth computation MUST use only:

1. Observability signals defined in:
   - OBSERVABILITY_INVARIANTS_v1.1.md

2. SLO thresholds defined in:
   - SLO_REGISTRY_TABLE_v1.1.md

3. Incident tiering defined in:
   - INCIDENT_CLASSIFICATION_v1.0.md

4. Freeze state defined in:
   - FREEZE_DETECTION_LAW_v1.1.md

5. Backlog/lag evaluation defined in:
   - BACKLOG_AND_LAG_DETERMINISM_v1.1.md

6. Audit log ordering defined in:
   - OPERATIONAL_AUDIT_LOG_CONTRACT_v1.1.md

7. Canonical freeze reason codes defined in:
   - FREEZE_REASON_CODE_CANON_v1.0.md

No additional inputs are permitted without version bump.

---

# 4. OUTPUTS (CLOSED ENUM)

Command Center MUST output exactly:

- HEALTHY
- DEGRADED
- FROZEN
- UNKNOWN

No other states permitted.

---

# 5. COMPUTATION RULES (DETERMINISTIC)

## 5.1 Precedence

State precedence order is:

FROZEN > DEGRADED > UNKNOWN > HEALTHY

Meaning:

- If any freeze trigger is active → FROZEN regardless of any other signal.
- If no freeze but any warning-level SLO breach exists → DEGRADED.
- If no freeze/degraded but any required signal missing → UNKNOWN.
- Else → HEALTHY.

## 5.2 Freeze Rule

Command Center MUST compute FROZEN if:

- freeze_active_flag == true OR
- any freeze threshold breach is active (even if freeze flag missing)

If freeze flag is missing while freeze threshold is breached:

- state MUST be UNKNOWN
- incident MUST be created: COMMAND_CENTER_TRUTH_DIVERGENCE (Tier 3)

## 5.3 Degraded Rule

Command Center MUST compute DEGRADED if:

- any warning threshold breach exists OR
- backlog evaluator state == DEGRADING OR
- TIER_1 incident exists and is OPEN/ACKNOWLEDGED

## 5.4 Unknown Rule

Command Center MUST compute UNKNOWN if:

- any required signal is missing or stale OR
- health signal integrity fails (per FREEZE_DETECTION_LAW reason
  HEALTH_SIGNAL_INTEGRITY_FAIL) OR
- computation cannot be performed deterministically

Unknown may not be displayed as Healthy.

## 5.5 Healthy Rule

HEALTHY is allowed only if:

- no freeze trigger active
- no warning threshold breach exists
- no required signal missing
- no Tier 2 or Tier 3 incident open

---

# 6. REQUIRED PANELS (MINIMUM)

Command Center MUST display:

1. Global Health (HEALTHY/DEGRADED/FROZEN/UNKNOWN)
2. Active Freeze (flag + reason code + timestamp)
3. Active Incidents (grouped by tier, sorted by age)
4. Backlog & Lag:
   - pending_count
   - oldest_age_seconds
   - backlog_growth_rate
   - consumer_idle_duration
   - processing_rate
5. Retry & DLQ:
   - retry_saturation_ratio
   - dlq_count
   - dlq_growth_rate
6. Discord Delivery:
   - pending_delivery_count
   - delivery_confirmation_latency
   - delivery_failure_rate
7. Settlement:
   - oldest_unsettled_age_seconds
   - unsettled_count

If any panel cannot be backed by signals, it must explicitly show “UNAVAILABLE”
and cause UNKNOWN state.

---

# 7. FORBIDDEN UI BEHAVIORS

Command Center MUST NOT:

- show “All Systems Operational” if state != HEALTHY
- hide FROZEN state behind a minor banner
- allow filtering that removes Tier 2/3 incidents from view by default
- allow “resolve” actions without evidence logging (design-level prohibition)
- display cached values without a timestamp and freshness indicator

---

# 8. TRUTH DIVERGENCE KILL CONDITION

If the Command Center displayed state differs from computed state:

- An incident MUST be created: COMMAND_CENTER_TRUTH_DIVERGENCE (Tier 3)
- Freeze MUST trigger (reason COMMAND_CENTER_TRUTH_DIVERGENCE)
- Outbound delivery MUST halt

Command Center cannot be allowed to lie. A lying control plane is a system
integrity breach.

---

# 9. DETERMINISTIC REPLAY REQUIREMENT

Operational state MUST be reconstructable via deterministic replay ordered by
`(environment, stream_id, seq)` as defined in
`OPERATIONAL_AUDIT_LOG_CONTRACT_v1.1`.

If audit log replay produces a different state than Command Center displays,
`COMMAND_CENTER_TRUTH_DIVERGENCE` MUST trigger.

---

# 10. AUDIT INTEGRITY FREEZE REQUIREMENT

Any audit ordering or integrity violation MUST force FROZEN state using
`freeze_reason_code = AUDIT_LOG_INTEGRITY_FAIL`.

This includes:

- Sequence gaps in audit log
- Hash chain validation failures
- Timestamp monotonicity violations
- Cross-environment contamination in audit stream

---

# 11. CANONICAL BINDING REFERENCES

This contract binds to the following authoritative documents:

- `OPERATIONAL_AUDIT_LOG_CONTRACT_v1.1` — Audit log structure and ordering
- `FREEZE_DETECTION_LAW_v1.1` — Freeze trigger conditions
- `FREEZE_REASON_CODE_CANON_v1.0` — Canonical freeze reason codes
- `SLO_REGISTRY_TABLE_v1.1` — SLO thresholds and breach classification

`freeze_reason_code` values used in this contract MUST exist in
`FREEZE_REASON_CODE_CANON_v1.0`.

This contract MUST NOT define local freeze reason codes.

---

# 12. ACCEPTANCE CRITERIA (BINARY)

PASS only if:

- Inputs are explicitly enumerated and closed
- Outputs are closed enum
- State precedence defined
- Freeze/degrade/unknown/healthy rules are deterministic
- Required panels listed with measurable fields
- Truth divergence triggers a Tier 3 incident + freeze
- Forbidden behaviors explicitly listed

FAIL if any health presentation can occur without signal-backed computation.

---

## Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

END OF COMMAND CENTER TRUTH MODEL
