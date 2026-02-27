SLO REGISTRY TABLE

Version: v1.1 Phase: Phase 4 — Operational Determinism Status: DESIGN ONLY

Master Roadmap Reference: governance/master-roadmap/MASTER_ROADMAP_v1.0.md

1. PURPOSE

This contract defines the authoritative registry of all Service Level Objectives
(SLOs) in Unit Talk.

SLOs may not exist implicitly. SLOs may not be defined in prose only. SLOs may
not be inferred from metrics.

Every SLO must be registered here with:

Deterministic identifier

Metric binding

Thresholds

Breach classification

Freeze eligibility

Escalation tier

If an SLO is not present in this registry, it does not exist.

2. GLOBAL INVARIANTS

Registry is a closed table.

SLO IDs are immutable.

SLO IDs may not be reused.

Every SLO must bind to exactly one metric.

Every SLO must define warning and/or freeze thresholds.

Every freeze-eligible SLO must map to a freeze_reason_code.

Registry changes require version increment.

3. REQUIRED FIELDS (PER SLO ENTRY)

Each SLO entry must include:

slo_id (unique, immutable)

metric_name

measurement_window_seconds

warning_threshold_operator

warning_threshold_value

freeze_threshold_operator (if applicable)

freeze_threshold_value (if applicable)

freeze_reason_code (if freeze-eligible)

incident_tier_on_warning

incident_tier_on_freeze

environment_scope (global | distribution | settlement | discord)

monotonicity_required (true | false)

No nullable critical fields permitted.

4. SLO REGISTRY (v1.0)

The following SLOs are registered:

4.1 SLO_OUTBOX_OLDEST_AGE

slo_id: SLO_OUTBOX_OLDEST_AGE

metric_name: outbox_oldest_age_seconds

measurement_window_seconds: 60

warning_threshold_operator: >

warning_threshold_value: 60

freeze_threshold_operator: >

freeze_threshold_value: 180

freeze_reason_code: CONSUMER_STALL

incident_tier_on_warning: 1

incident_tier_on_freeze: 2

environment_scope: distribution

monotonicity_required: true

4.2 SLO_OUTBOX_BACKLOG_GROWTH

slo_id: SLO_OUTBOX_BACKLOG_GROWTH

metric_name: backlog_growth_rate

measurement_window_seconds: 120

warning_threshold_operator: >

warning_threshold_value: 0

freeze_threshold_operator: >

freeze_threshold_value: 5

freeze_reason_code: CONSUMER_STALL

incident_tier_on_warning: 1

incident_tier_on_freeze: 2

environment_scope: distribution

monotonicity_required: false

4.3 SLO_RETRY_SATURATION

slo_id: SLO_RETRY_SATURATION

metric_name: retry_saturation_ratio

measurement_window_seconds: 60

warning_threshold_operator: >

warning_threshold_value: 0.7

freeze_threshold_operator: >

freeze_threshold_value: 0.9

freeze_reason_code: RETRY_SATURATION

incident_tier_on_warning: 1

incident_tier_on_freeze: 2

environment_scope: distribution

monotonicity_required: false

4.4 SLO_DLQ_GROWTH

slo_id: SLO_DLQ_GROWTH

metric_name: dlq_growth_rate

measurement_window_seconds: 120

warning_threshold_operator: >

warning_threshold_value: 0

freeze_threshold_operator: >

freeze_threshold_value: 3

freeze_reason_code: DLQ_SURGE

incident_tier_on_warning: 1

incident_tier_on_freeze: 2

environment_scope: distribution

monotonicity_required: false

4.5 SLO_DISCORD_DELIVERY_LATENCY

slo_id: SLO_DISCORD_DELIVERY_LATENCY

metric_name: delivery_confirmation_latency_seconds

measurement_window_seconds: 60

warning_threshold_operator: >

warning_threshold_value: 10

freeze_threshold_operator: >

freeze_threshold_value: 30

freeze_reason_code: DISCORD_DELIVERY_INTEGRITY_FAIL

incident_tier_on_warning: 1

incident_tier_on_freeze: 2

environment_scope: discord

monotonicity_required: false

4.6 SLO_SETTLEMENT_OLDEST_UNSETTLED

slo_id: SLO_SETTLEMENT_OLDEST_UNSETTLED

metric_name: oldest_unsettled_age_seconds

measurement_window_seconds: 300

warning_threshold_operator: >

warning_threshold_value: 600

freeze_threshold_operator: >

freeze_threshold_value: 1800

freeze_reason_code: SETTLEMENT_STALL

incident_tier_on_warning: 1

incident_tier_on_freeze: 2

environment_scope: settlement

monotonicity_required: true

4.7 SLO_HEALTH_SIGNAL_INTEGRITY

slo_id: SLO_HEALTH_SIGNAL_INTEGRITY

metric_name: health_signal_integrity_flag

measurement_window_seconds: 10

warning_threshold_operator: ==

warning_threshold_value: false

freeze_threshold_operator: ==

freeze_threshold_value: false

freeze_reason_code: HEALTH_SIGNAL_INTEGRITY_FAIL

incident_tier_on_warning: 2

incident_tier_on_freeze: 3

environment_scope: global

monotonicity_required: false

4.8 SLO_UNKNOWN_DURATION

slo_id: SLO_UNKNOWN_DURATION

metric_name: unknown_duration_seconds

measurement_window_seconds: 1

warning_threshold_operator: >

warning_threshold_value: 60

freeze_threshold_operator: >

freeze_threshold_value: 120

freeze_reason_code: UNKNOWN_STATE_TIMEOUT

incident_tier_on_warning: 1

incident_tier_on_freeze: 2

environment_scope: global

monotonicity_required: true

5. BINDING RULES

Every freeze_threshold_value must correspond to a `freeze_reason_code` defined
in `FREEZE_REASON_CODE_CANON_v1.0`.

No other values may be used.

Every SLO breach must produce an audit log entry.

Every freeze breach must emit a freeze signal.

Freeze evaluator must consume freeze-eligible SLO breaches.

SLO definitions must not be duplicated elsewhere.

6. FORBIDDEN CONDITIONS

The following are prohibited:

Implicit SLOs not listed in registry

Threshold overrides without version bump

Environment mixing

Silent threshold changes

Metric name drift

SLO ID reuse

If any occur: → Trigger HEALTH_SIGNAL_INTEGRITY_FAIL freeze.

7. ACCEPTANCE CRITERIA (BINARY)

PASS only if:

All SLOs are explicitly listed

Each has warning and/or freeze threshold

Each freeze-eligible SLO maps to freeze_reason_code

Incident tiers defined

No free-form thresholds exist elsewhere

FAIL if any freeze condition exists outside registry.

---

## Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

END OF SLO REGISTRY TABLE
