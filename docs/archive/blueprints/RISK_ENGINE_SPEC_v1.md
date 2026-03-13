# RISK ENGINE SPEC v1.0

Blueprint Type: Capital Allocation + Exposure Control Contract  
Applies To: Promotion Layer, Execution Engine, Portfolio Manager, Black Label
Profiles  
Status: RATIFIED (Phase 2A)  
Binding Over: Unit sizing, exposure caps, correlation throttles, freeze rules,
and drawdown control

---

## 1. PURPOSE

The Risk Engine governs capital allocation and exposure control across:

- All sports
- All bet types (props-first)
- Singles + same-game multi-leg (SGP)
- Multi-event portfolios

It exists to:

1. Protect bankroll under variance
2. Allocate capital to highest quality edges
3. Prevent correlation blow-ups
4. Enforce deterministic risk rules (no vibes)
5. Enable scale (syndicate-grade discipline)

Model edge is worthless if risk can mathematically bankrupt the system.

---

## 2. REQUIRED INPUTS

Per bet_event (from model + execution):

- P_final
- uncertainty_final
- edge_final (vs devig consensus)
- price_decimal / price_american
- market_snapshot id (entry)
- clv_forecast
- execution_state (FIRE_NOW / WAIT / etc.)
- correlation_group_id (nullable)
- sport / league / market_type
- liquidity tier distribution + book profiles
- data_quality_flag

Portfolio state:

- bankroll_total
- bankroll_available
- current_exposure_by_sport
- current_exposure_by_market_type
- current_exposure_by_event
- current_exposure_by_player/team
- open positions count
- rolling PnL and drawdown metrics

---

## 3. RISK OUTPUTS

For every candidate pick, Risk Engine outputs:

- stake_units (or stake_fraction)
- max_stake_units
- throttle_reason_codes
- allow / reduce / reject decision
- exposure deltas (what this adds to the book)
- risk_flags_json (correlation, liquidity, volatility, drawdown)

---

## 4. BANKROLL MODEL

### 4.1 Units Standard

- 1 Unit = configurable fraction of bankroll (Operator-defined)
- Default internal: 1U = 1% bankroll (adjustable per profile)

### 4.2 Reserve Capital

A portion of bankroll is untouchable to prevent ruin:

- reserve_fraction_default = 15%
- bankroll_available = bankroll_total × (1 - reserve_fraction)

---

## 5. BASE STAKING (FRACTIONAL KELLY)

We compute a base Kelly fraction:

Kelly = (b\*p - q) / b  
Where:

- b = decimal_odds - 1
- p = P_final
- q = 1 - p

Production rule:

- stake_fraction = kelly × kelly_multiplier

Default:

- kelly_multiplier = 0.25 (quarter-kelly)

Hard clamps:

- stake_fraction_min = 0 (no negative)
- stake_fraction_max = 0.02 (2% bankroll cap per single pick default)

Converted to units:

- stake_units = stake_fraction / unit_fraction

---

## 6. UNCERTAINTY & QUALITY PENALTIES

Stake is multiplicatively penalized by:

### 6.1 Uncertainty penalty

penalty_uncertainty = (1 - uncertainty_final)

Example: uncertainty 0.30 → penalty 0.70

### 6.2 Data quality penalty

good = 1.0  
partial = 0.7  
suspect = 0.3

### 6.3 Liquidity penalty

high = 1.0  
medium = 0.85  
low = 0.65  
unknown = 0.75

Final: stake_units = stake_units × penalty_uncertainty × penalty_quality ×
penalty_liquidity

---

## 7. EXPOSURE CAPS (HARD LIMITS)

Caps prevent portfolio concentration.

### 7.1 By sport

- max_exposure_sport = 20% bankroll_available

### 7.2 By event/game

- max_exposure_event = 7% bankroll_available

### 7.3 By market type

- player_props: 25%
- spreads: 15%
- totals: 15%
- moneyline: 10%
- specialty props: 8%

(Defaults; operator can tune)

### 7.4 By participant (player/team)

- max_exposure_participant = 5% bankroll_available

If a pick would exceed a cap:

- reduce stake to fit cap OR reject if reduction falls below minimum.

---

## 8. CORRELATION CONTROL (SGP + PORTFOLIO)

### 8.1 Correlation groups

If correlation_group_id exists:

- compute correlation risk multiplier

Rules:

- same-game multi-leg correlation requires group scoring
- do not sum independent Kelly for correlated legs

### 8.2 Same-game parlay rule (baseline)

For SGP legs:

- aggregate risk is capped by event cap (7%)
- individual legs must be throttled
- correlation penalty applies to each additional leg

Example correlation penalty:

- leg1: 1.00
- leg2: 0.80
- leg3: 0.65
- leg4+: 0.50

(Refined in Phase 3 with correlation matrix)

### 8.3 Portfolio overlap guard

If too many picks touch:

- same player
- same team
- same market condition (pace, injuries)

Then throttle.

---

## 9. DRAW DOWN PROTECTION

### 9.1 Rolling drawdown metrics

Track:

- 7-day drawdown
- 30-day drawdown
- peak-to-trough drawdown

### 9.2 Automatic throttle tiers

If drawdown exceeds:

- 7-day DD > 5% → stakes × 0.80
- 7-day DD > 8% → stakes × 0.60
- 30-day DD > 12% → stakes × 0.50

### 9.3 Freeze mode trigger

If:

- DD exceeds 15% OR
- calibration drift + negative CLV detected

Then:

- freeze autopilot promotions
- allow operator manual-only

Freeze is logged and alert-triggered.

---

## 10. EDGE QUALITY BUCKETS (RISK-AWARE)

Even if edge exists, risk can veto.

Buckets:

- A+ (high edge, low uncertainty, positive CLV forecast)
- A
- B
- C (allowed only if exposure low)
- REJECT

Promotion logic must respect these buckets.

---

## 11. EXECUTION INTEGRATION

Risk Engine and Execution Engine interact:

- FIRE_NOW can raise max stake if CLV forecast strong + liquidity high
- WAIT can lower stake until confirmation
- AVOID forces reject

If execution_state != FIRE_NOW:

- stake_units may be set to 0 until re-evaluation.

---

## 12. BLACK LABEL PROFILES (TENANT-SAFE)

Each tenant can choose a risk profile:

- Conservative (lower caps, lower Kelly multiplier)
- Balanced (default)
- Aggressive (higher caps, still bounded)
- Volume (lower per-pick, higher count)

Rules:

- Profiles may adjust parameters, never violate invariants:
  - single-writer truth
  - devig integrity
  - settlement immutability
  - outbox determinism

---

## 13. LOGGING & AUDIT

Every risk decision must log:

- inputs snapshot (market_snapshot id)
- model_version
- execution_version
- risk_version
- computed stake + penalties applied
- caps evaluated + outcomes
- reason codes

No silent stake changes.

---

## 14. KILL CONDITIONS (AUTO STOP)

Auto-freeze if any occurs:

- Negative CLV persists over threshold window
- Calibration drift triggers (ECE > limit)
- Duplicate publish evidence (integrity breach)
- Settlement replay safety compromised
- Major provider outage with suspect data flag widespread

Freeze requires explicit operator unfreeze.

---

## 15. VERSIONING

Log:

- risk_engine_version
- parameter_set_version
- tenant_profile_version

Changes require:

- evaluation using WALK_FORWARD_EVAL_HARNESS
- governance closeout marker
- canary rollout

---

END.
