# DATA MOAT REQUIREMENTS v1.0

Blueprint Type: Implementation Enforcement Checklist  
Applies To: All ingestion, scoring, execution, settlement, analytics systems  
Status: REQUIRED BEFORE PHASE 2A COMPLETE  
Purpose: Convert Data Moat Architecture into auditable engineering requirements

---

# 1. CORE RULE

A data moat does not exist unless it is:

• Persisted  
• Versioned  
• Queryable  
• Time-correct  
• Enforced by gates

This document defines the minimum viable implementation standard.

---

# 2. REQUIRED DATA DOMAINS

The following datasets MUST exist in production:

---

## 2.1 Market Snapshot Domain

Required for every promoted pick:

- entry_market_snapshot_id
- multi-book odds
- devig_fair_probabilities
- overround
- devig_method
- snapshot_timestamp
- time_to_start_bucket
- dispersion_metric
- opening_line
- closing_line (backfilled post-game)

FAIL CONDITION: If any promoted pick lacks entry snapshot → gate fails.

---

## 2.2 Devig Normalization Domain

Every snapshot must include:

- devig_method_version
- consensus_weights
- book_count
- normalization_hash

FAIL CONDITION: If snapshot missing normalization metadata → scoring blocked.

---

## 2.3 Feature Snapshot Domain

For every scored event:

- feature_set_version
- feature_vector_hash
- feature_values_json
- computed_at_utc
- window_bounds

FAIL CONDITION: If model output exists without feature_vector_hash → promotion
blocked.

---

## 2.4 Execution Telemetry Domain

For every published pick:

- publish_timestamp
- routing_policy_version
- execution_strategy
- entry_price
- slippage
- availability_post_publish
- CLV_at_close
- time_to_entry_seconds

FAIL CONDITION: If pick published without execution log → integrity breach.

---

## 2.5 Settlement Domain

For every graded pick:

- settlement_timestamp
- final_stat_value
- result
- settlement_version
- stat_source
- settlement_hash

FAIL CONDITION: If settlement mutation occurs without override flag → hard
freeze.

---

## 2.6 Loss Attribution Domain

For every settled pick:

- expected_value_at_entry
- realized_value
- clv_delta
- loss_classification_code
- attribution_timestamp

Loss categories must be one of:

- PROJECTION_MISS
- VARIANCE
- EXECUTION_MISS
- NEWS_MISS
- CORRELATION_MISS
- PRICE_MISS

FAIL CONDITION: If settled pick lacks loss attribution → moat incomplete.

---

## 2.7 Model Metrics Domain

Daily metrics must compute:

- rolling_CLV_mean
- rolling_CLV_median
- ECE
- Brier score
- drift_score
- regime_distribution

FAIL CONDITION: If metrics not computed daily → autopilot downgraded.

---

## 2.8 Portfolio State Domain

Must log daily snapshot:

- exposure_by_sport
- exposure_by_participant
- correlation_matrix_hash
- drawdown_curve
- risk_multiplier_state

FAIL CONDITION: If exposure snapshot missing → risk blind spot.

---

# 3. DATA QUALITY ENFORCEMENT

All domains must satisfy:

- NOT NULL enforcement where required
- Foreign key integrity
- Immutable hash storage for:
  - feature vectors
  - settlement records
  - devig normalization

Schema drift must fail CI.

---

# 4. TIME CORRECTNESS ENFORCEMENT

For all feature construction:

Feature timestamp must be:

<= decision timestamp

Never allowed:

Feature timestamp > bet_event timestamp

Leakage detection must exist.

FAIL CONDITION: Any forward-leak → model version invalidated.

---

# 5. VERSIONING REQUIREMENTS

Each record must include version linkage:

- model_version
- feature_set_version
- devig_spec_version
- autopilot_state_version
- drift_threshold_version

Without versioning, reproducibility is broken.

---

# 6. STORAGE REQUIREMENTS

Data must be:

- Append-only where applicable
- Mutation logged
- Historical retention guaranteed
- Archival tier defined

Cold storage acceptable, but loss of history is forbidden.

---

# 7. QUERYABILITY REQUIREMENTS

System must support queries:

- CLV by sport
- CLV by model_version
- Loss class frequency by feature bucket
- Execution alpha by routing strategy
- Drift by feature
- Correlation clustering analysis

If queries cannot be executed → moat is ornamental.

---

# 8. CLAUDE AUDIT CHECKLIST

Claude must verify:

1. All required domains exist
2. Foreign keys enforced
3. NOT NULL constraints applied
4. Hash columns exist
5. Drift detection job exists
6. Daily metrics job exists
7. Loss attribution job exists
8. Execution telemetry exists
9. Promotion requires feature_vector_hash
10. Publish requires execution log

Audit output must classify each domain:

- IMPLEMENTED
- PARTIAL
- MISSING
- INCONSISTENT

---

# 9. ACCEPTANCE CRITERIA FOR PHASE 2A

Phase 2A is complete only when:

- 100% of promoted picks contain all required domain linkages
- 100% of settled picks contain attribution
- Drift detection runs automatically
- Execution telemetry linked to CLV
- Daily model metrics available in Command Center
- Claude audit returns zero MISSING domains

Until then: Data moat is not active.

---

END.
