# INCIDENT CLASSIFICATION

Version: v1.0 Phase: Phase 4 — Operational Determinism Status: DESIGN ONLY
Master Roadmap Reference: governance/master-roadmap/MASTER_ROADMAP_v1.0.md

---

# 1. PURPOSE

This document defines the deterministic classification system for operational
incidents in Unit Talk.

Incidents are derived from measurable violation conditions defined in:

- OBSERVABILITY_INVARIANTS_v1.0.md
- FREEZE_DETECTION_LAW_v1.0.md

Incident classification determines:

- Escalation level
- Visibility requirements
- Freeze requirement
- Recovery protocol strictness

Classification must be algorithmic. Subjective severity assignment is forbidden.

---

# 2. GLOBAL PRINCIPLES

1. Every violation condition produces exactly one incident.
2. Every incident must map to exactly one tier.
3. Incident tier is derived from violation type — not operator opinion.
4. No incident may be suppressed.
5. Incident creation must be logged in operational audit log.
6. Incident state transitions must be immutable (append-only).

---

# 3. INCIDENT TIERS (CLOSED ENUM)

The only valid tiers are:

- TIER_0
- TIER_1
- TIER_2
- TIER_3

No additional tiers permitted without version increment.

---

# 4. TIER DEFINITIONS

## 4.1 TIER_0 — Cosmetic

Definition: Non-functional anomaly that does not affect determinism, delivery,
or data integrity.

Examples:

- Minor latency spike below SLO freeze threshold
- Temporary UI render inconsistency (without truth divergence)
- Non-critical metrics collection delay

Requirements:

- Must be logged
- No freeze
- No delivery halt
- No operator intervention required

---

## 4.2 TIER_1 — Operational Degradation

Definition: Measurable performance degradation without integrity risk.

Examples:

- Elevated retry rate below saturation threshold
- Backlog growth within warning band
- Ingestion latency above target but below freeze threshold

Requirements:

- Visible in Command Center
- No freeze required
- Must escalate to TIER_2 if persists beyond defined time window
- Operator notification recommended

Escalation Rule: If degradation duration > TIER1_MAX_DURATION_SECONDS →
reclassify to TIER_2

---

## 4.3 TIER_2 — Determinism Risk

Definition: Condition that threatens delivery determinism but has not yet
violated canonical integrity.

Examples:

- Consumer stall
- Outbox backlog stall
- Retry saturation threshold crossed
- DLQ growth beyond warning band
- Discord delivery confirmation delay beyond threshold
- Settlement stall beyond warning window

Requirements:

- Freeze MAY be required depending on trigger
- Must be visible
- Must generate operator alert
- Must log evidence pointer
- Escalates to TIER_3 if integrity boundary crossed

---

## 4.4 TIER_3 — Integrity Violation

Definition: Violation of canonical truth, immutability, routing determinism, or
cross-environment isolation.

Examples:

- Routing ambiguity
- Policy hash mismatch
- Idempotency violation
- Receipt fingerprint mismatch
- Cross-environment contamination
- Immutability mutation
- Command Center truth divergence

Requirements:

- Freeze REQUIRED
- Outbound delivery halted
- Operator acknowledgment mandatory
- Resume must be explicitly authorized
- Incident cannot auto-resolve

---

# 5. INCIDENT CREATION RULES

An incident must be created when:

- A violation condition defined in Phase 4 contracts evaluates to TRUE.

Incident record must include:

- incident_id
- incident_tier
- violation_type
- environment
- detection_timestamp_utc
- evidence_pointer
- freeze_triggered (boolean)
- freeze_reason_code (if applicable)

Incident records are append-only. Status transitions must be logged as separate
events.

---

# 6. INCIDENT STATE MACHINE

Valid incident states:

- OPEN
- ACKNOWLEDGED
- MITIGATED
- RESOLVED

Rules:

OPEN → ACKNOWLEDGED ACKNOWLEDGED → MITIGATED MITIGATED → RESOLVED

Direct OPEN → RESOLVED transitions are forbidden.

Each transition must include:

- operator_id (if manual)
- timestamp_utc
- reason_note
- evidence_pointer

---

# 7. ESCALATION LOGIC

Escalation must occur when:

- TIER_1 persists beyond defined duration → TIER_2
- TIER_2 escalates to integrity boundary → TIER_3
- Multiple concurrent TIER_2 incidents exceed concurrency threshold

Escalation must:

- Create new incident record
- Reference original incident_id
- Preserve historical lineage

---

# 8. VISIBILITY REQUIREMENTS

Command Center must display:

- Active incidents grouped by tier
- Incident age
- Freeze status
- Evidence summary

Command Center may not:

- Collapse tiers into generic “error”
- Hide TIER_2 or TIER_3 incidents
- Override tier logic

---

# 9. FORBIDDEN CONDITIONS

The following are prohibited:

- Manual downgrade of incident tier
- Auto-resolution without evidence
- Silent tier suppression
- Treating freeze-required event as TIER_1 or TIER_2
- Reclassifying TIER_3 to lower tier without new version bump

---

# 10. ACCEPTANCE CRITERIA (BINARY)

PASS only if:

- Tiers are closed enum
- Each tier has measurable examples
- Escalation rules are deterministic
- Freeze requirement defined for TIER_3
- Incident state machine is explicit
- No subjective language present

FAIL if incident classification depends on operator interpretation.

---

## Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

END OF INCIDENT CLASSIFICATION
