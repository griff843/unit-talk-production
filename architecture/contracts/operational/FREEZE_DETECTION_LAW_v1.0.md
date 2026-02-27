# FREEZE DETECTION LAW

Version: v1.0 Phase: Phase 4 — Operational Determinism Status: DESIGN ONLY
Master Roadmap Reference: governance/master-roadmap/MASTER_ROADMAP_v1.0.md

---

# 1. PURPOSE

This document defines the deterministic conditions under which Unit Talk MUST
enter a frozen operational state.

Freeze exists to prevent:

- silent degradation
- uncontrolled replay/retry amplification
- integrity drift
- cross-environment contamination
- delivery nondeterminism

Freeze is a safety state, not an alert. Freeze is fail-closed.

---

# 2. DEFINITIONS

## 2.1 Freeze State

A Freeze State is an operational mode where:

- outbound delivery is halted
- consumer advancement is halted (except permitted read-only diagnostics)
- system reports FROZEN in all health projections
- operator intervention is required to resume

## 2.2 Freeze Trigger

A Freeze Trigger is a measurable, deterministic violation condition that
mandates freeze.

Freeze triggers must be:

- derived from explicit signals (no heuristics)
- version-locked
- environment-scoped
- non-silent
- recorded

---

# 3. GLOBAL FREEZE INVARIANTS

## 3.1 Fail-Closed Default

If freeze evaluation cannot be performed deterministically due to missing
required signals, the system state MUST be UNKNOWN, and outbound delivery MUST
be halted until determinism is restored.

## 3.2 Environment Scope

Freeze is always scoped to a single environment (DEV/STAGING/PROD).
Cross-environment freeze propagation is forbidden.

## 3.3 Freeze Requires a Reason Code

Every freeze must include:

- freeze_reason_code (closed enum)
- freeze_trigger_timestamp (UTC)
- freeze_evidence_pointer (deterministic link to signals/rows)

If reason code is missing, freeze is invalid and system must not resume.

---

# 4. FREEZE REASON CODES (CLOSED ENUM)

The allowed freeze_reason_code values are:

1. ROUTING_AMBIGUITY
2. POLICY_HASH_MISMATCH
3. IMMUTABILITY_VIOLATION
4. IDEMPOTENCY_VIOLATION
5. RECEIPT_FINGERPRINT_MISMATCH
6. OUTBOX_BACKLOG_STALL
7. CONSUMER_STALL
8. RETRY_SATURATION
9. DLQ_SURGE
10. CROSS_ENV_CONTAMINATION
11. DISCORD_DELIVERY_INTEGRITY_FAIL
12. SETTLEMENT_STALL
13. HEALTH_SIGNAL_INTEGRITY_FAIL
14. COMMAND_CENTER_TRUTH_DIVERGENCE

No additional reason codes are permitted without a version bump.

---

# 5. MANDATORY FREEZE TRIGGERS

## 5.1 ROUTING_AMBIGUITY

Freeze MUST trigger when:

- match_count == 0 OR match_count > 1 for a given intent

Evidence must include:

- intent_id
- policy_version
- routing_inputs_hash
- match_count

---

## 5.2 POLICY_HASH_MISMATCH

Freeze MUST trigger when:

- policy_hash used at execution time differs from policy_hash recorded in intent

Evidence must include:

- intent_id
- policy_version
- policy_hash_expected
- policy_hash_observed

---

## 5.3 IMMUTABILITY_VIOLATION

Freeze MUST trigger when:

- any immutable field in outbox or receipt record is mutated

Evidence must include:

- record_id
- field_name(s)
- before_hash
- after_hash

---

## 5.4 IDEMPOTENCY_VIOLATION

Freeze MUST trigger when:

- a second intent is created with the same idempotency_key but a different
  payload_hash

Evidence must include:

- idempotency_key
- original_intent_id + payload_hash
- conflicting_intent_id + payload_hash

---

## 5.5 RECEIPT_FINGERPRINT_MISMATCH

Freeze MUST trigger when:

- receipt_fingerprint does not match the computed fingerprint from
  (payload_hash + routing_inputs_hash + target_id + renderer_version)

Evidence must include:

- intent_id
- receipt_id (if exists)
- expected_fingerprint
- observed_fingerprint

---

## 5.6 OUTBOX_BACKLOG_STALL

Freeze MUST trigger when BOTH are true:

- outbox_pending_count > 0
- outbox_oldest_unprocessed_age_seconds > SLO_MAX_OUTBOX_AGE_SECONDS

Evidence must include:

- pending_count
- oldest_unprocessed_timestamp
- computed_age_seconds
- threshold_seconds

---

## 5.7 CONSUMER_STALL

Freeze MUST trigger when BOTH are true:

- outbox_pending_count > 0
- consumer_last_processed_age_seconds > SLO_MAX_CONSUMER_IDLE_SECONDS

Evidence must include:

- consumer_last_processed_timestamp
- computed_age_seconds
- threshold_seconds

---

## 5.8 RETRY_SATURATION

Freeze MUST trigger when:

- retry_saturation_ratio >= RETRY_SATURATION_FREEZE_THRESHOLD

Evidence must include:

- retry_attempt_rate
- retry_saturation_ratio
- threshold

---

## 5.9 DLQ_SURGE

Freeze MUST trigger when:

- dlq_growth_rate >= DLQ_GROWTH_FREEZE_THRESHOLD OR
- dlq_count >= DLQ_MAX_FREEZE_THRESHOLD

Evidence must include:

- dlq_count
- dlq_growth_rate
- thresholds

---

## 5.10 CROSS_ENV_CONTAMINATION

Freeze MUST trigger immediately when:

- cross_environment_event_count > 0

Evidence must include:

- offending_event_ids
- observed_env
- expected_env
- target_id

This is a Tier 3 incident.

---

## 5.11 DISCORD_DELIVERY_INTEGRITY_FAIL

Freeze MUST trigger when:

- delivery_failure_rate >= DISCORD_FAILURE_FREEZE_THRESHOLD OR
- delivery_confirmation_latency_seconds >= DISCORD_CONFIRM_FREEZE_THRESHOLD

Evidence must include:

- failure_rate
- confirmation_latency
- thresholds

---

## 5.12 SETTLEMENT_STALL

Freeze MUST trigger when:

- oldest_unsettled_age_seconds >= SETTLEMENT_STALL_FREEZE_THRESHOLD

Evidence must include:

- oldest_unsettled_timestamp
- computed_age_seconds
- threshold

---

## 5.13 HEALTH_SIGNAL_INTEGRITY_FAIL

Freeze MUST trigger when:

- required observability signals are unavailable, stale, or contradictory

Evidence must include:

- missing_signal_names
- staleness_windows
- contradiction summary

If signals are missing, system cannot claim healthy.

---

## 5.14 COMMAND_CENTER_TRUTH_DIVERGENCE

Freeze MUST trigger when:

- Command Center reports HEALTHY while system-computed health state is
  DEGRADED/FROZEN/UNKNOWN OR
- Command Center suppresses freeze_active_flag

Evidence must include:

- computed_state
- displayed_state
- timestamp

---

# 6. FREEZE RECORD REQUIREMENTS

A freeze event must be recorded with:

- env
- freeze_reason_code
- freeze_trigger_timestamp_utc
- freeze_evidence_pointer
- operator_ack_required = true

No freeze may exist without a recorded freeze event.

---

# 7. RESUME CONDITIONS (DETERMINISTIC)

System may resume only when:

1. The triggering condition is proven resolved via measurable signals
2. A resume action is explicitly invoked by authorized operator
3. Resume is logged with evidence pointers
4. No other freeze triggers remain active

Automatic resume is forbidden.

---

# 8. ACCEPTANCE CRITERIA (BINARY)

PASS only if:

- Reason codes are a closed enum
- Every trigger is measurable and deterministic
- Evidence fields are explicitly defined
- Resume conditions are deterministic and operator-gated
- Missing signals cause UNKNOWN and halt outbound delivery
- Freeze is environment-scoped
- No heuristic language exists

FAIL if any freeze trigger depends on subjective interpretation.

---

## Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

END OF FREEZE DETECTION LAW
