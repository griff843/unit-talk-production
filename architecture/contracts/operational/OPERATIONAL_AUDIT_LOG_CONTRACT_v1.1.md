# OPERATIONAL AUDIT LOG CONTRACT

Version: v1.1 Phase: Phase 4 — Operational Determinism Status: DESIGN ONLY
Master Roadmap Reference: governance/master-roadmap/MASTER_ROADMAP_v1.0.md

---

# 1. PURPOSE

This contract defines the immutable operational audit log for Unit Talk.

The operational audit log exists to:

- Record all freeze triggers
- Record all incident events
- Record all SLO breaches
- Record all health state transitions
- Record all operator interventions
- Provide deterministic evidence of system behavior

The audit log is append-only. It is immutable. It is environment-scoped.

No operational state change may occur without corresponding audit log entry.

---

# 2. GLOBAL INVARIANTS

1. Audit log is append-only.
2. Audit log records are immutable.
3. Each record must include environment identifier.
4. Each record must include UTC timestamp.
5. Each record must include deterministic evidence pointer.
6. Audit log writes must not be suppressible.
7. Audit log must not be writable by UI projection layer.

If an operational event occurs without an audit log record, the system is in
violation.

---

# 3. EVENT TYPES (CLOSED ENUM)

The only valid audit event types are:

- FREEZE_TRIGGERED
- FREEZE_RESUMED
- INCIDENT_CREATED
- INCIDENT_ESCALATED
- INCIDENT_ACKNOWLEDGED
- INCIDENT_MITIGATED
- INCIDENT_RESOLVED
- SLO_WARNING_BREACH
- SLO_FREEZE_BREACH
- HEALTH_STATE_CHANGED
- CONSUMER_STALL_DETECTED
- BACKLOG_STALL_DETECTED
- RETRY_SATURATION_DETECTED
- DLQ_SURGE_DETECTED
- DISCORD_DELIVERY_FAILURE_DETECTED
- SETTLEMENT_STALL_DETECTED
- COMMAND_CENTER_TRUTH_DIVERGENCE
- OPERATOR_OVERRIDE

No new event types permitted without version increment.

---

# 4. REQUIRED FIELDS (ALL EVENTS)

Every audit log record MUST include:

- audit_event_id (unique, immutable)
- event_type (closed enum)
- environment
- timestamp_utc
- triggering_component (e.g., distribution_consumer, settlement_engine,
  health_evaluator)
- evidence_pointer
- correlated_entity_id (intent_id / incident_id / freeze_id if applicable)
- previous_state (if state transition)
- new_state (if state transition)

No nullable critical fields permitted.

---

# 5. EVIDENCE POINTER REQUIREMENTS

Evidence pointer must reference:

- canonical identifiers (intent_id, incident_id, freeze_id)
- measurable signal snapshot
- threshold values used in evaluation
- hash values where integrity violations involved

Evidence must allow deterministic reconstruction of event cause.

Free-text explanations are supplemental only.

---

# 6. FREEZE EVENTS

## 6.1 FREEZE_TRIGGERED

Must include:

- freeze_reason_code
- freeze_trigger_timestamp_utc
- triggering_signal_snapshot

## 6.2 FREEZE_RESUMED

Must include:

- operator_id
- resume_timestamp_utc
- validation_snapshot proving trigger resolved

Automatic resume is forbidden. If FREEZE_RESUMED occurs without operator_id,
contract is violated.

---

# 7. INCIDENT EVENTS

## 7.1 INCIDENT_CREATED

Must include:

- incident_id
- incident_tier
- violation_type
- evidence_pointer

## 7.2 INCIDENT_ESCALATED

Must include:

- original_incident_id
- new_incident_tier
- escalation_reason

Tier downgrade is forbidden.

---

# 8. SLO BREACH EVENTS

## 8.1 SLO_WARNING_BREACH

Must include:

- slo_id
- metric_name
- observed_value
- threshold_value
- window

## 8.2 SLO_FREEZE_BREACH

Must include:

- slo_id
- metric_name
- observed_value
- threshold_value
- window
- freeze_reason_code

---

# 9. HEALTH STATE CHANGE EVENTS

When global health state transitions between:

- HEALTHY
- DEGRADED
- FROZEN
- UNKNOWN

A HEALTH_STATE_CHANGED event must be recorded including:

- previous_state
- new_state
- reason_code
- evidence_pointer

No silent health transitions allowed.

---

# 10. OPERATOR OVERRIDES

Operator overrides are restricted to:

- Freeze resume
- Incident acknowledgment

Override must include:

- operator_id
- reason_note
- timestamp_utc

Override may not suppress audit logging.

---

# 11. RETENTION INVARIANT

Audit log records must:

- Never be deleted
- Never be updated
- Be environment isolated
- Be queryable by timestamp and event_type

Archival strategy may exist, but immutability must be preserved.

---

# 12. FORBIDDEN CONDITIONS

The following are prohibited:

- Deleting audit log records
- Editing audit log records
- Suppressing event creation
- Batch rewriting history
- Logging without evidence pointer
- Writing audit entries from UI layer

If audit integrity is compromised, freeze must trigger under
`AUDIT_LOG_INTEGRITY_FAIL`.

## 12.1 CANONICAL FREEZE REASON BINDING

`freeze_reason_code` values used in audit events MUST exist in
`FREEZE_REASON_CODE_CANON_v1.0`.

This document MUST NOT define local freeze reason codes.

---

# 13. ACCEPTANCE CRITERIA (BINARY)

PASS only if:

- Event types are closed enum
- Required fields are explicitly defined
- Freeze/incident/SLO events enumerated
- Immutability explicitly required
- Health transitions logged
- Operator overrides logged
- No subjective language present

FAIL if any operational change can occur without audit log record.

---

## Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

END OF OPERATIONAL AUDIT LOG CONTRACT
