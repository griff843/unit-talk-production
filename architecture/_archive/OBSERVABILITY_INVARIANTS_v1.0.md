# OBSERVABILITY INVARIANTS

Version: v1.0 Phase: Phase 4 — Operational Determinism Status: DESIGN ONLY
Master Roadmap Reference: governance/master-roadmap/MASTER_ROADMAP_v1.0.md

---

# 1. PURPOSE

This document defines the mandatory measurable signals that allow Unit Talk to
deterministically evaluate its own operational health.

If a system state cannot be derived from explicit signals defined herein, the
system is considered non-deterministic and therefore in violation of Phase 4.

This document does not define enforcement implementation. It defines required
measurable invariants.

---

# 2. GLOBAL PRINCIPLE

All operational health states must be derived from:

- Canonical database state
- Measurable consumer metrics
- Explicit counters
- Deterministic timestamps

Synthetic optimism is forbidden.

If health cannot be proven, health must default to UNKNOWN (not HEALTHY).

---

# 3. REQUIRED SIGNAL CATEGORIES

The system must expose measurable signals in the following domains:

1. Ingestion
2. Distribution
3. Consumer Processing
4. Retry & DLQ
5. Settlement
6. Discord Delivery
7. Environment Isolation
8. Freeze State
9. Command Center Projection Integrity

Each category must define measurable signals below.

---

# 4. INGESTION INVARIANTS

The system must expose:

- `last_ingest_timestamp`
- `ingest_events_per_minute`
- `ingest_error_rate`
- `ingest_latency_ms`

Violation Conditions:

- No ingest activity beyond defined SLO window
- Error rate exceeds defined threshold
- Latency exceeds defined threshold

Health cannot be reported as HEALTHY if ingest_error_rate > threshold.

---

# 5. DISTRIBUTION INVARIANTS

The system must expose:

- `outbox_pending_count`
- `outbox_oldest_unprocessed_timestamp`
- `outbox_processing_rate`
- `consumer_active_lease_count`

Violation Conditions:

- Oldest unprocessed intent exceeds SLO window
- Pending count growth slope positive beyond threshold window
- Lease count zero while pending_count > 0

Distribution health is derived from backlog age + slope, not from event
presence.

---

# 6. CONSUMER PROCESSING INVARIANTS

The system must expose:

- `consumer_last_processed_timestamp`
- `consumer_processing_rate`
- `consumer_idle_duration`
- `consumer_lease_expiration_count`

Violation Conditions:

- No processing advancement beyond threshold window
- Lease expiration count increasing
- Processing rate collapse beyond defined slope

If consumer_last_processed_timestamp does not advance, system cannot report
HEALTHY.

---

# 7. RETRY & DLQ INVARIANTS

The system must expose:

- `retry_attempt_rate`
- `retry_saturation_ratio`
- `dlq_count`
- `dlq_growth_rate`

Violation Conditions:

- Retry saturation ratio exceeds defined threshold
- DLQ growth slope positive beyond acceptable window
- DLQ_count > defined maximum threshold

Retry loops without bounded convergence must trigger DEGRADED or FREEZE.

---

# 8. SETTLEMENT INVARIANTS

The system must expose:

- `unsettled_pick_count`
- `oldest_unsettled_timestamp`
- `settlement_processing_rate`

Violation Conditions:

- Oldest unsettled exceeds defined window
- Settlement processing rate drops below threshold

Settlement cannot silently stall.

---

# 9. DISCORD DELIVERY INVARIANTS

The system must expose:

- `pending_delivery_count`
- `delivery_confirmation_latency`
- `delivery_failure_rate`

Violation Conditions:

- Confirmation latency exceeds threshold
- Failure rate exceeds threshold
- Pending deliveries grow without confirmation

Discord success must be verified via receipt confirmation, not dispatch attempt.

---

# 10. ENVIRONMENT ISOLATION INVARIANTS

The system must expose:

- `environment_identifier`
- `cross_environment_event_count`

Violation Conditions:

- Any event processed by consumer not matching environment identifier
- Any intent delivered across environment boundaries

Cross-environment contamination is a Tier 3 incident.

---

# 11. FREEZE STATE INVARIANTS

The system must expose:

- `freeze_active_flag`
- `freeze_reason_code`
- `freeze_trigger_timestamp`

Freeze must be derived from measurable violation signals, not manual toggles.

Manual override must be logged in audit log.

---

# 12. COMMAND CENTER PROJECTION INVARIANT

Command Center state must be computed from:

- Signals defined above
- Explicit SLO thresholds
- Explicit violation conditions

Command Center may not:

- Infer health from absence of alerts
- Override freeze state silently
- Mask violation flags

UI state must equal computed operational state.

---

# 13. HEALTH STATE COMPUTATION MODEL

Health state must be one of:

- HEALTHY
- DEGRADED
- FROZEN
- UNKNOWN

Rules:

HEALTHY:

- No violation conditions active
- All signals within SLO

DEGRADED:

- One or more violation conditions active
- No integrity risk

FROZEN:

- Freeze trigger active
- Determinism at risk

UNKNOWN:

- Required signals unavailable
- Metrics collection failure
- Ambiguous state

Default state is UNKNOWN if signal integrity fails.

---

# 14. FORBIDDEN CONDITIONS

The following are prohibited:

- Reporting HEALTHY when violation conditions exist
- Suppressing retry saturation visibility
- Ignoring backlog growth slope
- Silent DLQ accumulation
- Synthetic health derived from absence of errors
- UI divergence from measurable state

---

# 15. COMPLETION REQUIREMENT

This contract is complete when:

- All signal names are defined
- All violation conditions are enumerated
- Health computation logic is deterministic
- Default-to-UNKNOWN rule enforced
- No ambiguity exists in violation detection

Ratification required under:
governance/ratifications/PHASE4_OPERATIONAL_DETERMINISM_RATIFICATION_v1.0.md

---

## Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.
