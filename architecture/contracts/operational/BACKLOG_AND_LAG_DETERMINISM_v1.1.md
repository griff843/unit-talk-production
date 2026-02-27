# BACKLOG AND LAG DETERMINISM

Version: v1.1 Phase: Phase 4 — Operational Determinism Status: DESIGN ONLY
Master Roadmap Reference: governance/master-roadmap/MASTER_ROADMAP_v1.0.md

---

# 1. PURPOSE

This contract defines the deterministic measurement, computation, and
interpretation rules for:

- Outbox backlog
- Consumer lag
- Backlog growth slope
- Processing throughput
- Stalled advancement detection

No backlog/lag reporting may rely on subjective interpretation. All definitions
must be computable from measurable signals and canonical timestamps.

---

# 2. DEFINITIONS (CANONICAL)

## 2.1 Intent Backlog (Outbox Backlog)

`outbox_pending_count`: Count of outbox intents in a pending/eligible state (per
Outbox Contract) that are not terminal and not confirmed delivered.

`outbox_oldest_unprocessed_timestamp`: Minimum `created_at_utc` among all
pending/eligible intents.

`outbox_oldest_unprocessed_age_seconds`:
`now_utc - outbox_oldest_unprocessed_timestamp`

## 2.2 Consumer Lag

`consumer_last_processed_timestamp`: Timestamp of the last successfully advanced
outbox intent (terminalized or progressed to next state) by the active consumer
for the environment.

`consumer_idle_duration_seconds`: `now_utc - consumer_last_processed_timestamp`

## 2.3 Throughput

`consumer_processing_rate`: Number of intents advanced per unit time.

Canonical unit: `intents_per_second` over a rolling window.

## 2.4 Backlog Growth Slope

`outbox_backlog_growth_rate`: Slope of pending backlog over time, computed as
intents/minute over a rolling window.

---

# 3. REQUIRED SIGNALS (MUST EXIST)

The following signals are mandatory:

- outbox_pending_count
- outbox_oldest_unprocessed_timestamp
- consumer_last_processed_timestamp
- consumer_processing_rate (rolling)
- retry_attempt_rate (rolling)
- dlq_count
- dlq_growth_rate (rolling)

If any mandatory signal is unavailable or stale, health state MUST be UNKNOWN
and outbound delivery MUST be halted until restored (per
`FREEZE_DETECTION_LAW_v1.1` / `HEALTH_SIGNAL_INTEGRITY_FAIL`).

---

# 4. COMPUTATION RULES (DETERMINISTIC)

## 4.1 Time Source

All time computations MUST use:

- UTC timestamps
- a single system time source (`now_utc`)
- monotonically non-decreasing timestamps in records

## 4.2 Rolling Windows (CLOSED ENUM)

Rolling windows must be selected only from:

- WINDOW_60S
- WINDOW_180S
- WINDOW_300S

No other window lengths permitted without version bump.

Default windows:

- processing_rate: WINDOW_60S
- backlog_growth_rate: WINDOW_180S
- retry_rate: WINDOW_300S
- dlq_growth_rate: WINDOW_300S

## 4.3 Backlog Growth Rate Formula

Let:

- `B_t` = outbox_pending_count at time t (sampled once per second or per defined
  cadence)
- Compute slope using two-point delta across window:

For window length `W` seconds:

- `growth_rate_intents_per_minute = ((B_now - B_now_minus_W) / W) * 60`

If sampling is missing:

- Use the most recent sample at or before each boundary; if either boundary is
  missing → signal integrity fails.

## 4.4 Processing Rate Formula

Let:

- `A_now` = count of intents advanced during the window (advancement = any state
  transition that moves an intent forward OR terminalizes) Then:
- `processing_rate_intents_per_second = A_now / W`

Advancement MUST be defined as:

- outbox record state transition event OR terminal receipt creation (as defined
  in Outbox/Receipt contracts)

If advancement cannot be measured deterministically, processing_rate is invalid.

---

# 5. STALL DEFINITIONS (BINARY)

## 5.1 Consumer Stall

Consumer stall exists if BOTH are true:

- outbox_pending_count > 0
- consumer_idle_duration_seconds > CONSUMER_STALL_THRESHOLD_SECONDS

Threshold is defined in SLO_REGISTRY_TABLE_v1.1.

## 5.2 Backlog Stall

Backlog stall exists if BOTH are true:

- outbox_pending_count > 0
- outbox_oldest_unprocessed_age_seconds > OUTBOX_MAX_AGE_THRESHOLD_SECONDS

Threshold is defined in SLO_REGISTRY_TABLE_v1.1.

## 5.3 Backlog Amplification

Backlog amplification exists if:

- outbox_backlog_growth_rate > BACKLOG_GROWTH_FREEZE_THRESHOLD AND
- consumer_processing_rate < PROCESSING_RATE_MIN_THRESHOLD

Thresholds are defined in SLO_REGISTRY_TABLE_v1.1.

---

# 6. CLASSIFICATION OUTPUTS (CLOSED ENUM)

The backlog/lag evaluator MUST output exactly one of:

- STABLE
- DEGRADING
- STALLED
- AMPLIFYING
- UNKNOWN

Rules:

STABLE:

- backlog_growth_rate ≤ 0
- oldest_unprocessed_age within target

DEGRADING:

- backlog_growth_rate > 0 but below freeze threshold OR
- oldest_unprocessed_age in warning band

STALLED:

- consumer stall OR backlog stall is true

AMPLIFYING:

- backlog amplification is true OR
- retry saturation is true OR
- dlq_growth_rate exceeds warning band while backlog is growing

UNKNOWN:

- mandatory signals missing/stale/contradictory

---

# 7. RELATIONSHIP TO INCIDENT TIERS

Mapping must be deterministic:

- STABLE → no incident
- DEGRADING → TIER_1 (Operational Degradation)
- STALLED → TIER_2 (Determinism Risk)
- AMPLIFYING → TIER_2, escalates to TIER_3 if any integrity trigger occurs
  (policy hash mismatch, routing ambiguity, receipt mismatch, cross-env
  contamination)
- UNKNOWN → TIER_2 if outbound delivery is impacted; otherwise TIER_1

No subjective tier assignment allowed.

---

# 8. REQUIRED EVIDENCE POINTERS

Every time the system enters STALLED, AMPLIFYING, or UNKNOWN, it MUST produce an
evidence payload containing:

- env
- timestamp_utc
- outbox_pending_count
- outbox_oldest_unprocessed_timestamp
- outbox_oldest_unprocessed_age_seconds
- consumer_last_processed_timestamp
- consumer_idle_duration_seconds
- consumer_processing_rate
- backlog_growth_rate
- retry_attempt_rate
- dlq_count
- dlq_growth_rate
- thresholds referenced (by name)

Evidence must be immutable once recorded.

---

# 9. FORBIDDEN CONDITIONS

- Reporting STABLE if backlog_growth_rate is positive and oldest_unprocessed_age
  exceeds warning threshold
- Reporting STABLE when mandatory signals are missing
- Using “it seems” or “likely” language in any status
- Changing window lengths or formulas without version bump
- Deriving lag from UI-only state or logs without deterministic counters

---

# 10. CANONICAL BINDING REFERENCES

This contract binds to the following authoritative documents:

- `OPERATIONAL_AUDIT_LOG_CONTRACT_v1.1` — Audit log structure and ordering
- `FREEZE_DETECTION_LAW_v1.1` — Freeze trigger conditions
- `FREEZE_REASON_CODE_CANON_v1.0` — Canonical freeze reason codes
- `SLO_REGISTRY_TABLE_v1.1` — SLO thresholds and breach classification

All threshold values referenced in this contract MUST be sourced from
`SLO_REGISTRY_TABLE_v1.1`.

`freeze_reason_code` values MUST exist in `FREEZE_REASON_CODE_CANON_v1.0`.

This contract MUST NOT define local freeze reason codes or threshold values.

---

# 11. ACCEPTANCE CRITERIA (BINARY)

PASS only if:

- All metrics are defined with formulas
- All windows are closed enum
- All thresholds are referenced from SLO_REGISTRY_TABLE_v1.1
- Outputs are closed enum with deterministic rules
- Evidence payload requirements are explicit
- Unknown-state handling is fail-closed (halts outbound delivery)

FAIL if any evaluation depends on human interpretation.

---

## Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

END OF BACKLOG AND LAG DETERMINISM
