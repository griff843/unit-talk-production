# WALK-FORWARD EVAL HARNESS v1.0

Blueprint Type: Model Acceptance & Rejection Contract  
Applies To: All projection models, meta-ensembles, and calibration layers  
Status: DRAFT (Phase 2A)  
Binding Over: Training pipeline, model deployment, model promotion gates

---

# 1. PURPOSE

Define the objective, non-negotiable evaluation framework for:

- Model acceptance
- Model rejection
- Model rollback
- Canary promotion
- Performance drift detection

No model is “good” because ROI looked nice. Models must demonstrate:

1. Calibration
2. Positive CLV
3. Stability across regimes
4. Robustness to execution timing
5. Controlled risk characteristics

---

# 2. WALK-FORWARD TRAINING STRUCTURE

## 2.1 Time-Based Splits (Mandatory)

We use rolling windows.

Example structure:

Train: Seasons 1–3  
Validate: Season 4  
Test: Season 5

Then roll forward:

Train: Seasons 2–4  
Validate: Season 5  
Test: Season 6

No random splits.  
No leakage.

---

## 2.2 Snapshot Consistency

For each bet_event used in training:

- Use entry-time market_snapshot only
- Never use closing snapshot as feature
- Store feature_vector_hash
- Store devig_method used

Training must reflect what was known at decision time.

---

# 3. PRIMARY ACCEPTANCE METRICS

These are hard gates.

---

## 3.1 Calibration

Metrics:

- Brier Score
- Log Loss
- Expected Calibration Error (ECE)

Thresholds (baseline target, adjustable by sport):

ECE < 0.03  
Brier improvement over market baseline ≥ 3%

If calibration fails: Model is rejected regardless of ROI.

---

## 3.2 CLV (Closing Line Value)

Measured as:

CLV_prob = closing_devig_prob - entry_devig_prob

Requirements:

- Mean CLV > 0
- Median CLV > 0
- CLV positive in ≥ 55% of bets
- CLV stable across time slices

If ROI positive but CLV negative → reject.

CLV is the primary dominance signal.

---

## 3.3 Edge Realism Distribution

Edge must not be extreme-tailed.

We measure:

- Edge mean
- Edge std deviation
- 95th percentile edge

Red flags:

- Too many extreme edges
- Unrealistic confidence clustering
- Edge collapses out-of-sample

---

## 3.4 Regime Stability

We segment by:

- Season
- Early vs late season
- High total vs low total games
- High liquidity vs low liquidity books

Performance must not collapse in any regime.

If performance is isolated to one season → reject.

---

# 4. SECONDARY METRICS

Used for ranking models, not gating.

- ROI at 0.25 Kelly
- ROI at flat 1 unit
- Hit rate per confidence tier
- EV accuracy vs realized ROI
- Execution timing performance

---

# 5. RISK & EXPOSURE CHECKS

Model must demonstrate:

- Reasonable uncertainty calibration
- No pathological correlation stacking
- No systematic overconfidence in specialty props

If risk flags exceed thresholds: Model enters review state.

---

# 6. CANARY DEPLOYMENT PROTOCOL

## 6.1 Shadow Mode

Before live promotion:

- Model runs in shadow for minimum 2 weeks (or X bet count)
- No public promotion
- All results logged
- CLV monitored

---

## 6.2 Canary Promotion

Small % of picks:

- 10–20% routing
- Compared against previous model version
- Must outperform in CLV and calibration

If degradation: Auto rollback.

---

# 7. DRIFT DETECTION

We monitor:

- Feature drift (distribution shift)
- Market regime shift
- Calibration drift
- CLV drift

Trigger thresholds:

- 2σ drop in CLV over rolling window
- ECE doubles vs baseline
- Feature distribution KL divergence > threshold

If triggered: Model enters audit mode.

---

# 8. LOSS CLASSIFICATION INTEGRATION

For every losing bet:

Postmortem must classify:

- variance
- projection miss
- news miss
- execution miss
- correlation miss
- price miss

Loss classification aggregated monthly.

If certain class dominates: Model retraining flagged.

---

# 9. REJECTION CONDITIONS (HARD STOP)

Model is rejected if:

- Negative CLV over evaluation window
- Calibration error exceeds threshold
- Performance collapses after accounting for juice
- Relies on features unavailable in production
- Leakage detected

No override allowed.

---

# 10. PROMOTION REQUIREMENTS

To move from candidate → production:

Must provide:

- Training window summary
- Calibration report
- CLV report
- Drift report
- Regime stability report
- Feature list with leakage audit
- Rollback plan

Governance marker required before activation.

---

# 11. VERSIONING

Every model version:

- Must increment model_version
- Must log feature_set_version
- Must log devig_spec_version
- Must be reproducible via snapshot hash

No silent changes.

---

END.
