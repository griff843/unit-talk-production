# MODEL TRAINING PIPELINE SPEC v1.0

Blueprint Type: Training/Validation/Deployment Contract  
Applies To: All sports, all bet types, all model families  
Status: RATIFIED (Phase 2A)  
Objective: Produce reproducible, non-leaky, walk-forward validated models with
governance gates

---

## 1. PURPOSE

Define the full training pipeline to produce:

- best-possible predictive power
- best-possible calibration
- positive CLV
- reproducible versions
- safe deployment via shadow/canary

This pipeline must be sport-agnostic at the framework level.

---

## 2. PIPELINE STAGES

1. Data Ingestion Normalization
2. Label Construction (Outcome Truth)
3. Feature Generation (Feature Store)
4. Dataset Slicing (Walk-forward)
5. Training (Multi-model)
6. Calibration Layer
7. Ensemble Weighting
8. Evaluation Harness (gates)
9. Packaging & Versioning
10. Shadow Deployment
11. Canary Promotion
12. Full Promotion

---

## 3. DATA INPUTS

Mandatory datasets:

- devig market snapshots (entry + close)
- information events (timestamped)
- historical player/team stats
- execution events
- settlement events
- loss attribution events
- portfolio state snapshots

All datasets must be time-aligned.

---

## 4. LABEL CONSTRUCTION (TRUTH)

For each bet_event:

Label fields:

- outcome_binary (win/loss/push)
- outcome_value (units profit)
- outcome_timestamp
- settlement_version_hash
- stat_source_id

Labels are immutable once settled.

---

## 5. FEATURE STORE INTEGRATION

Training MUST pull features only from:

- feature_store(feature_set_version)

Never compute features ad-hoc during training.

Feature integrity requirements:

- computed_at_utc stored
- window bounds stored
- feature_vector_hash stored
- leakage audit stored

---

## 6. WALK-FORWARD SPLITTING (MANDATORY)

No random splits.

We create:

- rolling train window
- rolling validation window
- rolling test window

Store metadata:

- train_start/end
- val_start/end
- test_start/end
- sample sizes
- per-sport segmentation

---

## 7. MODEL FAMILIES (ENSEMBLE)

Minimum ensemble set:

A) Baseline model (interpretable)

- logistic regression / bayesian baseline

B) Tree model

- gradient boosting (XGBoost/LightGBM)

C) Interaction model

- neural net / tab transformer (only if justified)

D) Regime classifier

- market regime + volatility model

E) CLV forecasting model

- predicts likely closing shift

All model outputs must produce:

- probability
- uncertainty
- feature importance (where applicable)

---

## 8. CALIBRATION LAYER

We calibrate probabilities via:

- isotonic regression OR
- Platt scaling OR
- beta calibration

Calibration is evaluated with:

- ECE
- Brier
- log loss

Calibration failures reject model regardless of ROI.

---

## 9. ENSEMBLE WEIGHTING

Weights are not static.

They are determined by:

- validation performance
- regime performance
- stability constraints

We store:

- ensemble_weight_version
- weights per regime bucket

---

## 10. EVALUATION HARNESS (BINDING)

All models must pass:

- calibration gates
- CLV gates
- regime stability gates
- edge realism gates
- leakage audit gates

Per WALK_FORWARD_EVAL_HARNESS_v1.

No exceptions.

---

## 11. PACKAGING & VERSIONING

Every released model must include:

- model_version
- feature_set_version
- devig_spec_version
- training_window_metadata
- calibration_method
- ensemble_weights
- hash of training config

Reproduction must be possible.

---

## 12. DEPLOYMENT FLOW (SAFE)

### 12.1 Shadow

- log-only
- compute all metrics
- no promotion

### 12.2 Canary

- 10–20% routing
- compare against incumbent model
- must outperform on CLV + calibration

### 12.3 Production

- full routing enabled
- drift detection armed
- autopilot transitions allowed

---

## 13. RETRAIN TRIGGERS

Retrain is triggered by:

- feature drift threshold
- calibration drift threshold
- CLV decay threshold
- dominant loss attribution class
- regime shift detection

All retrains logged.

---

## 14. ACCEPTANCE OUTPUT ARTIFACTS

Each training run produces:

- model_card.md
- calibration_report.md
- clv_report.md
- regime_stability_report.md
- leakage_audit.md
- deployment_plan.md

Stored under: out/model-runs/<model_version>/<date>/

---

## 15. BLACK LABEL VARIANTS

Tenants may use:

- different promotion thresholds
- different risk profiles

But the core model must remain governed unless tenant explicitly pays for custom
model training.

Tenant custom models must still use this pipeline.

---

END.
