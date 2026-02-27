# FREEZE AUTHORITY MODEL

Version: v1.1 Phase: Phase 4 — Operational Determinism Status: DESIGN ONLY

Master Roadmap Reference: governance/master-roadmap/MASTER_ROADMAP_v1.0.md

1. PURPOSE

This contract defines the single authoritative freeze decision model for Unit
Talk.

Freeze is not a UI concept. Freeze is not an SLO side-effect. Freeze is not an
incident escalation.

Freeze is a deterministic state controlled by a single evaluation authority.

There must be exactly one freeze evaluator in the system.

If freeze authority is distributed, Phase 4 integrity is broken.

2. FREEZE INVARIANT

Freeze state is globally unique per environment.

Freeze state is binary: ACTIVE or INACTIVE.

Freeze state is derived from freeze triggers.

Freeze state cannot be set directly by UI.

Freeze state cannot be overridden silently.

Freeze release requires explicit operator intervention.

Freeze state transitions must be audit logged.

3. FREEZE EVALUATOR (SINGLE AUTHORITY)

There must exist exactly one freeze evaluator function:

evaluateFreeze(environment_state) → freeze_state

No other component may independently set freeze state.

Components may emit freeze signals, but only the freeze evaluator determines
final freeze state.

If multiple freeze setters exist, contract is violated.

4. FREEZE SIGNAL SOURCES

The following sources may emit freeze signals:

SLO_FREEZE_BREACH

HEALTH_SIGNAL_INTEGRITY_FAIL

COMMAND_CENTER_TRUTH_DIVERGENCE

RETRY_SATURATION

DLQ_SURGE

CONSUMER_STALL

SETTLEMENT_STALL

UNKNOWN_STATE_TIMEOUT

AUDIT_LOG_INTEGRITY_FAIL

No additional freeze sources permitted without version increment.

5. FREEZE PRECEDENCE RULE

If ANY freeze signal is ACTIVE:

→ Freeze state MUST be ACTIVE.

There is no weighted voting. There is no majority logic. There is no suppression
hierarchy.

Freeze is triggered by first valid freeze signal.

6. FREEZE STATE MACHINE

Allowed transitions:

INACTIVE → ACTIVE ACTIVE → INACTIVE

No other transitions allowed.

6.1 INACTIVE → ACTIVE

Occurs when:

At least one freeze signal becomes ACTIVE

Freeze evaluator confirms signal validity

Audit log entry FREEZE_TRIGGERED is created

Transition must include:

freeze_reason_code

timestamp_utc

triggering_signal_snapshot

6.2 ACTIVE → INACTIVE (RESUME)

Occurs only when:

All freeze signals are cleared

Operator explicitly resumes

FREEZE_RESUMED audit entry is recorded

Automatic resume is forbidden.

If freeze clears automatically without operator action, contract is violated.

7. CANONICAL FREEZE REASON BINDING

`freeze_reason_code` is defined exclusively in `FREEZE_REASON_CODE_CANON_v1.0`.

This document MUST NOT define a local enum.

Any non-canonical `freeze_reason_code` is a contract violation.

7.1 BINDING REQUIREMENTS

All freeze signals referenced in this document must use values from the
canonical enum:

- CONSUMER_STALL
- RETRY_SATURATION
- DLQ_SURGE
- SETTLEMENT_STALL
- HEALTH_SIGNAL_INTEGRITY_FAIL
- COMMAND_CENTER_TRUTH_DIVERGENCE
- UNKNOWN_STATE_TIMEOUT
- AUDIT_LOG_INTEGRITY_FAIL

  7.2 PRIMARY REASON DETERMINATION

Only one primary freeze_reason_code may be active at time of trigger.

If multiple signals exist:

earliest timestamp determines primary reason

others recorded as secondary_signals

8. FREEZE SIGNAL VALIDATION

Before freeze activates:

Freeze evaluator must verify:

Signal has evidence pointer

Signal is not stale

Signal matches SLO registry

Environment identifier matches runtime

If validation fails:

HEALTH_SIGNAL_INTEGRITY_FAIL freeze must trigger instead

No freeze without validated evidence.

9. FREEZE DURATION TRACKING

When freeze activates:

Must record:

freeze_start_timestamp

freeze_duration_seconds (monotonic)

freeze_resume_timestamp

Freeze duration must be measurable deterministically.

10. FORBIDDEN CONDITIONS

The following are prohibited:

Multiple freeze evaluators

Silent freeze activation

Silent freeze clearance

Automatic resume

Manual resume without evidence validation

Freeze suppression flag

Environment-mixed freeze state

Freeze dependent on UI availability

If any prohibited condition occurs: → Trigger AUDIT_LOG_INTEGRITY_FAIL → Freeze
remains ACTIVE

11. FREEZE INTERACTION WITH COMMAND CENTER

Command Center must:

Display freeze state exactly as computed

Not compute freeze independently

Not suppress freeze signals

Not resolve freeze

If displayed freeze != evaluator freeze: → COMMAND_CENTER_TRUTH_DIVERGENCE

12. FREEZE INTERACTION WITH DISTRIBUTION

If freeze == ACTIVE:

New outbox consumption must halt

Retry loops must halt

Discord delivery must halt

Settlement writer may continue only if freeze not settlement-related

If freeze cause is settlement-related:

settlement must halt as well

Freeze scope must be explicit in freeze_reason_code.

13. ACCEPTANCE CRITERIA (BINARY)

PASS only if:

Single freeze evaluator defined

Freeze signals enumerated

State machine defined

Resume requires operator intervention

Freeze reason codes closed enum

Precedence rule deterministic

Validation requirements defined

Interaction with Command Center defined

Interaction with distribution defined

FAIL if any component can independently activate or clear freeze.

---

## Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

END OF FREEZE AUTHORITY MODEL
