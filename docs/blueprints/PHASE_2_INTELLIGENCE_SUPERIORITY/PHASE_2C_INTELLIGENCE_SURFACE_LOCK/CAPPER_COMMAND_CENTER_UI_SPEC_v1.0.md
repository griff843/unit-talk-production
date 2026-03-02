# CAPPER COMMAND CENTER — SLATE COMPRESSION BLUEPRINT v1.0

Blueprint Type: Operator Intelligence Surface  
Applies To: Command Center (READ-ONLY), ScoringAgent outputs, Execution Engine
outputs  
Status: DRAFT (Post Phase 2B PASS)  
Authority: Intelligence Superiority Layer

---

# 1. PURPOSE

This blueprint defines the operator-facing intelligence surface that:

- Compresses 4–6 hours of manual research into 10–15 minutes.
- Translates probability primitives into decisive action.
- Preserves model moat integrity (no feature weights exposed).
- Increases CLV capture through better timing.
- Reduces low-quality pick submission.

This is not a model spec. This is not a governance contract. This is the
Intelligence Consumption Layer.

---

# 2. DESIGN PRINCIPLES

1. READ-ONLY over canonical data.
2. No model internals exposed.
3. Weak plays auto-hidden by default.
4. Ranking must outperform manual scanning.
5. Execution timing must be explicit.
6. Overrides allowed but logged.
7. Every decision measurable.

---

# 3. SYSTEM POSITIONING

market_snapshot (devig normalized) │ ▼ ScoringAgent → p_final → p_market_devig →
edge_final → uncertainty_final → clv_forecast │ ▼ Execution Engine →
execution_state │ ▼ Command Center — Capper Console (READ-ONLY)

No write authority. No lifecycle mutation. No override of model math.

---

# 4. CAPPER WORKFLOW (10–15 MINUTES)

## Step 1 — Open Slate (0:00)

- Navigate to Capper Console → Slate
- Default filters auto-apply
- Slate Health indicator must be GREEN

---

## Step 2 — Autopilot Shortlist (0:30–2:00)

System auto-eliminates weak plays.

Default filter rules:

- edge_final < E_MIN → hidden
- uncertainty_final > U_MAX → hidden
- clv_forecast < 0 (beyond tolerance) → hidden
- execution_state = AVOID → hidden
- weak consensus + low books_used → hidden
- data_quality_flag != good → hidden

Target: Reduce slate size by ~60–80%.

---

## Step 3 — Scan Top 15 Ranked Plays (2:00–6:00)

Sort by:

Edge Rank (ascending)

For each row, validate in seconds:

- p_final vs p_market_devig spread
- uncertainty_final acceptable
- clv_forecast positive or neutral
- execution suggestion logical
- consensus strength adequate

---

## Step 4 — Build Pick Queue (6:00–10:00)

Select 3–7 plays.

Command Center shows:

- Correlation cluster warnings
- Exposure indicators (Phase 3-ready)
- Risk tier badge
- Execution timing suggestions

WAIT plays move to Watchlist.

---

## Step 5 — Submit / Approve (10:00–15:00)

Autopilot route:

- Send to Smart Form (prefilled)

Manual route:

- Smart Form submission appears in Validation tab.

Timer stops at final queue confirmation.

---

# 5. SCREEN ARCHITECTURE

## 5.1 Navigation

Command Center └── Capper Console ├── Slate ├── Watchlist ├── Pick Validation
├── Risk & Exposure ├── Performance └── Ops / Health

---

# 6. SLATE PAGE STRUCTURE

## 6.1 Top Summary Strip

Displays:

- Total scored plays
- Eligible plays
- Median edge
- Median uncertainty
- % positive CLV
- Market volatility count

Purpose: Instant slate density read.

---

## 6.2 Slate Table Columns

### Identity

- Rank
- Event
- Market + Line

### Probability Truth

- edge_final
- p_final
- p_market_devig
- Δp (display only)
- uncertainty_final

### Timing

- clv_forecast (with arrow)
- execution_state badge

### Market Structure

- books_used count
- consensus strength badge
- resistance / steam / volatility flags

### Risk (Phase 3-ready)

- risk tier badge
- exposure warning icon
- correlation cluster icon

---

# 7. DEEP CARD (RIGHT PANEL)

Always shows:

## Truth Block

- p_final
- p_market_devig
- edge_final
- uncertainty_final
- clv_forecast

## Execution

- FIRE_NOW / WAIT / AVOID
- reason codes (non-sensitive)

## Consensus

- books_used list
- dispersion summary

## Market Conditions

- resistance flag
- volatility flag
- steam flag

## Risk

- exposure delta preview
- correlation group members

## Override

- Override & Submit
- Override requires reason selection
- Logged for audit

---

# 8. SMART FORM INTEGRATION

When a capper submits a pick:

1. Pick scored via V3 adapter.
2. Appears instantly in Pick Validation tab.
3. Displays:
   - p_final
   - p_market_devig
   - edge_final
   - uncertainty_final
   - clv_forecast
   - execution_state
   - consensus strength

System verdict:

- Approved
- Needs Review
- Rejected (primary reason shown)

Rejected picks explain:

- Edge below minimum
- Uncertainty too high
- Negative CLV forecast
- Weak consensus
- High resistance

No silent failure.

---

# 9. SUCCESS METRICS

## 9.1 Time-to-Pick

Start: Slate open  
Stop: Queue finalized  
Target median ≤ 15 minutes.

---

## 9.2 Quality Metrics

- CLV by rank decile
- Hit rate vs baseline
- ROI vs historical capper-only method

---

## 9.3 Behavioral Metrics

- Override rate
- Override performance delta
- Adoption rate of Autopilot mode

---

# 10. FAILURE CONDITIONS

Design fails if:

- Override rate > 40%
- Top decile CLV not superior
- Weak plays frequently manually selected
- Slate reduction < 50%

---

# 11. INTELLIGENCE LOCK CRITERIA (PHASE 2C)

Capper Console considered validated when:

- Top-ranked plays show positive mean CLV
- Edge deciles monotonic in performance
- Operator time-to-pick ≤ 15 minutes median
- No increase in volatility-driven losses
- Override logging operational

At that point:

INTELLIGENCE_SUPERIORITY_LOCK_v1 may be justified.

---

END.
