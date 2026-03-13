# PROMOTION BAND LOGIC SPEC v1.0

Blueprint Type: Deterministic Promotion & Publication Contract  
Applies To: ScoringAgent, Execution Engine, Risk Engine, AlertAgent, Outbox  
Status: RATIFIED (Phase 2A)  
Binding Over: What becomes an official pick, how it is labeled, how it is
routed, and how it is sized

---

# 1. PURPOSE

The Promotion Band Logic defines:

• Which scored bets become official picks  
• How they are tiered (A+, A, B, etc.)  
• How they are labeled publicly  
• How they are sized  
• When they are suppressed

It is the deterministic bridge between:

Model → Execution → Risk → Discord → Recap

No subjective overrides allowed outside defined operator pathway.

---

# 2. INPUT CONTRACT

Each bet_event entering promotion must include:

From Model:

- P_final
- edge_final
- uncertainty_final
- model_version
- clv_forecast
- feature_set_version

From Execution:

- execution_state
- routing_profile
- timing_metadata

From Risk:

- stake_units
- throttle_reason_codes
- allow / reduce / reject
- exposure_state

From Market:

- devig consensus prob
- liquidity tier mix
- data_quality_flag

If any required input missing → auto-reject.

---

# 3. PROMOTION BANDS

Bands are deterministic buckets driven by edge, uncertainty, CLV, and risk
status.

## 3.1 A+ (Signature Play)

Criteria:

- edge_final ≥ E_A_PLUS
- uncertainty_final ≤ U_LOW
- clv_forecast positive
- execution_state = FIRE_NOW
- stake_units ≥ minimum A+ threshold
- no throttle_reason_codes

Public Label: "Top Play" / "Signature Edge"

Constraints:

- Max per slate: configurable (default 3)
- Max correlation overlap: strict

---

## 3.2 A (Core Play)

Criteria:

- edge_final ≥ E_A
- uncertainty_final ≤ U_MED
- clv_forecast ≥ 0
- execution_state in {FIRE_NOW, WAIT_FOR_CONFIRMATION}
- risk allow or reduced (not rejected)

Public Label: "Core Play"

---

## 3.3 B (Standard Edge)

Criteria:

- edge_final ≥ E_B
- uncertainty acceptable
- clv_forecast neutral or mildly positive
- risk allow or reduced

Public Label: "Official Play"

---

## 3.4 C (Limited / Lean)

Criteria:

- edge modest
- uncertainty moderate
- liquidity sufficient
- no structural red flags

Constraints:

- Lower stake multiplier
- Optional public publication depending on tenant policy

---

## 3.5 REJECT

Automatic rejection if:

- edge < minimum threshold
- data_quality_flag != good (unless override profile)
- execution_state = AVOID
- risk decision = reject
- excessive correlation
- negative clv_forecast beyond tolerance

Rejected bets are logged, not published.

---

# 4. EDGE THRESHOLD GOVERNANCE

Edge thresholds must be:

- Explicitly defined per sport + market type
- Versioned
- Evaluated via WALK_FORWARD_EVAL_HARNESS

Example (illustrative only):

- E_A_PLUS = 0.06 probability edge
- E_A = 0.04
- E_B = 0.025
- E_MIN = 0.015

No arbitrary per-slate adjustment allowed.

---

# 5. UNCERTAINTY GOVERNANCE

Uncertainty gates:

- U_LOW = ≤ 0.25
- U_MED = ≤ 0.40
- Above 0.50 → cannot exceed B band
- Above 0.65 → auto C or reject

Uncertainty must penalize overconfident thin-data plays.

---

# 6. CLV FORECAST INTEGRATION

Promotion must consider clv_forecast:

If:

- Strong positive forecast → promote earlier
- Neutral forecast → standard
- Negative forecast → downgrade one band
- Strong negative → reject

CLV forecast protects against chasing stale edges.

---

# 7. STAKE MULTIPLIER BY BAND

Base stake from Risk Engine is multiplied by band factor:

- A+ → × 1.25
- A → × 1.00
- B → × 0.75
- C → × 0.50

Multipliers must never violate exposure caps.

---

# 8. SLATE CONCENTRATION CONTROL

To prevent overloading a slate:

- Max total promoted picks per event
- Max promoted picks per player
- Max A/A+ per sport per day

If exceeded:

- downgrade lowest edge among candidates.

---

# 9. PUBLIC LABELING RULES (DISCORD SURFACE)

Each promoted pick must embed:

- Band label
- Units
- Edge classification (internal, not probability %)
- Confidence tier
- Timestamp
- Model version (hidden internal)
- No raw probability disclosure publicly

Brand shield: public sees "sharp curation," not internal math.

---

# 10. OPERATOR OVERRIDE PROTOCOL

Operator override allowed only if:

- override_reason logged
- does not violate hard risk caps
- does not bypass settlement immutability
- override flag stored

Overrides audited monthly.

---

# 11. METRICS TRACKED BY BAND

For each band track:

- CLV mean
- ROI
- Hit rate
- Calibration
- Drawdown
- Volume

Bands must justify existence statistically.

If band underperforms consistently:

- threshold recalibration required.

---

# 12. FAILURE MODES

Auto-review triggered if:

- A+ band underperforms B band over evaluation window
- CLV negative in higher bands
- Excessive override frequency
- Edge distribution drifting

Promotion logic enters audit state if triggered.

---

# 13. VERSIONING

Log:

- promotion_logic_version
- threshold_set_version
- band_config_version

Changes require:

- Walk-forward validation
- Canary release
- Governance closeout marker

---

END.
