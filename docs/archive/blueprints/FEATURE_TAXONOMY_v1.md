# FEATURE TAXONOMY v1.0

Blueprint Type: Intelligence Feature Contract  
Applies To: All Projection Models, Meta-Ensembles, CLV Models  
Status: RATIFIED (Phase 2A)  
Binding Over: Training pipeline, scoring logic, feature engineering, leakage
audits

---

# 1. PURPOSE

Define the governed feature classes for all models.

Every feature must be:

• Categorized  
• Leakage rated  
• Timestamped  
• Reproducible  
• Linked to availability window  
• Traceable to source

No ad-hoc feature additions allowed.

---

# 2. FEATURE CLASSES (TOP LEVEL)

A) Player Performance Signals  
B) Team & Environment Signals  
C) Availability & Role Signals  
D) Market Structure Signals  
E) Execution & Timing Signals  
F) Correlation & Exposure Signals  
G) Meta & Stability Signals

---

# 3. CLASS A — PLAYER PERFORMANCE SIGNALS

Scope: player_prop markets primarily, adaptable to team contexts.

Examples:

• Rolling mean (last N games) • Rolling weighted mean (recency decay) • Season
baseline • Usage rate • Minutes share • Touch share • Shot rate per minute • Red
zone share (NFL) • Target share (NFL) • HR per PA (MLB) • Shot rate per 60 (NHL)

Derived signals:

• Rate × projected minutes • Opponent-adjusted rate • Home/away splits •
Back-to-back penalty

Leakage Rating: LOW  
(If strictly computed from pre-game historical data)

Update Frequency: Per game  
Stability Rating: Medium to High

---

# 4. CLASS B — TEAM & ENVIRONMENT SIGNALS

Examples:

• Pace • Possessions per game • Team offensive rating • Defensive efficiency •
Opponent DVP percentile • Weather (wind, temperature for MLB/NFL) • Park factors
(MLB) • Arena factors • Implied team total (devig consensus)

Derived:

• Pace-adjusted projection • Context volatility score

Leakage Rating: LOW  
Update Frequency: Per game  
Stability Rating: High

---

# 5. CLASS C — AVAILABILITY & ROLE SIGNALS

Derived from `information_event`.

Examples:

• Injury status • Lineup confirmed flag • Starting pitcher confirmed • Goalie
confirmed • Usage shift after teammate absence • Minutes volatility index • Role
stability score

Must include:

• reported_at_utc • effective_at_utc • confidence_score

Leakage Rating: MEDIUM (must respect timestamp)  
Update Frequency: Real-time  
Stability Rating: Medium

---

# 6. CLASS D — MARKET STRUCTURE SIGNALS

Derived from devig + market_snapshot.

Examples:

• Consensus devig probability • Book dispersion • Sharp vs retail disagreement •
Overround magnitude • Liquidity tier mix • Limit tier aggregate • Time-to-start
• Opening → current move delta • Market resistance metric

Leakage Rating: LOW (if using entry snapshot only)  
Update Frequency: Snapshot frequency  
Stability Rating: High

---

# 7. CLASS E — EXECUTION & TIMING SIGNALS

Examples:

• Steam velocity (Δ price / Δ time) • Post-news move magnitude • Time since
information_event • Entry timing percentile vs market lifecycle • CLV forecast
model inputs

Leakage Rating: MEDIUM  
Must ensure no use of future movement.

Update Frequency: Continuous  
Stability Rating: Medium

---

# 8. CLASS F — CORRELATION & EXPOSURE SIGNALS

Examples:

• Same-team multi-prop overlap • Same-player multi-market overlap • Game total
dependency • Covariance estimate from correlation_group • Portfolio exposure
score

Leakage Rating: LOW  
Update Frequency: Per slate  
Stability Rating: Medium

---

# 9. CLASS G — META & STABILITY SIGNALS

Used for uncertainty modeling.

Examples:

• Historical projection error variance • Player volatility score • Opponent
volatility index • Line stability score • Data quality flag • Market
completeness score

Leakage Rating: LOW  
Update Frequency: Rolling  
Stability Rating: High

---

# 10. LEAKAGE POLICY

Feature leakage levels:

LOW — safe if timestamped correctly  
MEDIUM — requires strict snapshot enforcement  
HIGH — forbidden (future info, closing line, final stats)

Closing snapshot values are NEVER valid features.

---

# 11. FEATURE GOVERNANCE REQUIREMENTS

Every feature must store:

• feature_name • feature_class • leakage_rating • source • computed_at_utc •
data_window_start • data_window_end • feature_set_version

No undocumented features allowed in model.

---

# 12. FEATURE ADDITION PROTOCOL

To add feature:

1. Define class
2. Define leakage rating
3. Define availability timestamp
4. Run walk-forward test
5. Evaluate impact on:
   - calibration
   - CLV
   - stability
6. Governance approval required

---

# 13. PHASE 2A COMPLETION STACK

After this doc:

✔ Unified Event Schema  
✔ Devig Spec  
✔ Model Architecture  
✔ Walk-Forward Harness  
✔ Feature Taxonomy

Next stage:

DATA_MOAT_REQUIREMENTS_v1  
(derived from feature + model needs)

END.
