# SLO DEFINITION

Version: v1.0 Phase: Phase 4 — Operational Determinism Status: DESIGN ONLY
Master Roadmap Reference: governance/master-roadmap/MASTER_ROADMAP_v1.0.md

---

# 1. PURPOSE

This document defines the Service Level Objectives (SLOs) that govern
operational health in Unit Talk.

SLOs define:

- Acceptable latency bounds
- Acceptable processing bounds
- Acceptable retry/dlq bounds
- Escalation thresholds
- Freeze thresholds

SLOs are mathematical. SLOs are measurable. SLOs are version-locked. SLOs may
not be subjective.

---

# 2. GLOBAL PRINCIPLES

1. Every SLO must define:
   - Metric name
   - Unit of measurement
   - Observation window
   - Target threshold
   - Warning threshold (if applicable)
   - Freeze threshold (if applicable)

2. SLO breach must be computable from stored metrics.

3. If required metrics are unavailable, state = UNKNOWN (not HEALTHY).

4. SLO compliance must be environment-scoped.

---

# 3. INGESTION SLO

## 3.1 Metric

`ingest_latency_ms`

Unit: milliseconds  
Window: rolling 5-minute window  
Target: ≤ 500 ms  
Warning: > 500 ms and ≤ 2000 ms  
Freeze: > 2000 ms sustained for 60 seconds

## 3.2 Metric

`ingest_error_rate`

Unit: percentage (0–100)  
Window: rolling 5-minute window  
Target: ≤ 1%  
Warning: > 1% and ≤ 5%  
Freeze: > 5%

---

# 4. DISTRIBUTION SLO

## 4.1 Metric

`outbox_oldest_unprocessed_age_seconds`

Unit: seconds  
Window: real-time  
Target: ≤ 10 seconds  
Warning: > 10 and ≤ 30  
Freeze: > 30

## 4.2 Metric

`outbox_backlog_growth_rate`

Unit: intents per minute slope  
Window: rolling 3-minute window  
Target: slope ≤ 0  
Warning: slope > 0 and ≤ 10/min  
Freeze: slope > 10/min sustained 2 minutes

---

# 5. CONSUMER SLO

## 5.1 Metric

`consumer_idle_duration_seconds`

Unit: seconds  
Window: real-time  
Target: ≤ 5  
Warning: > 5 and ≤ 20  
Freeze: > 20 while outbox_pending_count > 0

## 5.2 Metric

`consumer_processing_rate`

Unit: intents per second  
Window: rolling 1-minute window  
Target: ≥ expected_baseline_rate  
Warning: < baseline_rate × 0.5  
Freeze: < baseline_rate × 0.25 sustained 2 minutes

Baseline rate must be explicitly defined per environment.

---

# 6. RETRY SLO

## 6.1 Metric

`retry_saturation_ratio`

Definition: retry_attempts / successful_dispatches  
Window: rolling 5-minute window  
Target: ≤ 0.1  
Warning: > 0.1 and ≤ 0.3  
Freeze: > 0.3

---

# 7. DLQ SLO

## 7.1 Metric

`dlq_count`

Unit: count  
Target: 0  
Warning: > 0 and ≤ 10  
Freeze: > 10

## 7.2 Metric

`dlq_growth_rate`

Unit: events per minute  
Window: rolling 5-minute window  
Freeze: > 5 per minute

DLQ growth sustained beyond freeze threshold triggers TIER_2 or TIER_3 depending
on cause.

---

# 8. DISCORD DELIVERY SLO

## 8.1 Metric

`delivery_confirmation_latency_seconds`

Unit: seconds  
Window: per intent  
Target: ≤ 3  
Warning: > 3 and ≤ 10  
Freeze: > 10

## 8.2 Metric

`delivery_failure_rate`

Unit: percentage  
Window: rolling 5-minute window  
Target: ≤ 1%  
Warning: > 1% and ≤ 5%  
Freeze: > 5%

---

# 9. SETTLEMENT SLO

## 9.1 Metric

`oldest_unsettled_age_seconds`

Unit: seconds  
Target: ≤ 300  
Warning: > 300 and ≤ 900  
Freeze: > 900

---

# 10. HEALTH STATE DERIVATION

Health state must be derived as:

If any Freeze threshold breached → FROZEN  
Else if any Warning threshold breached → DEGRADED  
Else if metrics unavailable → UNKNOWN  
Else → HEALTHY

Order of precedence:

FROZEN > DEGRADED > UNKNOWN > HEALTHY

---

# 11. SLO BREACH EVENT REQUIREMENTS

Every SLO breach must generate:

- slo_id
- metric_name
- observed_value
- threshold_value
- breach_level (WARNING | FREEZE)
- environment
- timestamp_utc

SLO breaches must be logged in operational audit log.

---

# 12. FORBIDDEN CONDITIONS

- Reporting HEALTHY while freeze threshold breached
- Reporting HEALTHY while metrics unavailable
- Suppressing breach events
- Using heuristics instead of defined math
- Changing thresholds without version bump

---

# 13. VERSIONING RULE

Any change to thresholds requires:

- Version increment (v1.1+)
- Decision Log entry
- Explicit change summary
- Ratification update

---

# 14. ACCEPTANCE CRITERIA (BINARY)

PASS only if:

- Every SLO has explicit thresholds
- Every SLO has measurable metric
- Health derivation rule defined
- Precedence rule defined
- No ambiguous language present
- No undefined baseline terms remain

FAIL if thresholds are vague or undefined.

---

## Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

END OF SLO DEFINITION
