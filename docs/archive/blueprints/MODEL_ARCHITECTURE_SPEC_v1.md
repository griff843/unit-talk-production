# MODEL ARCHITECTURE SPEC v1.0

Blueprint Type: Intelligence Core Design Contract (Design-Only)  
Applies To: ScoringAgent, Training Pipeline, Evaluation Harness, Postmortem
Engine  
Status: DRAFT (Phase 2A)  
Binding Over: All model development, promotion logic inputs, and learning loops

---

## 1) PURPOSE

Define the minimal-but-unstoppable architecture for a multi-sport, multi-market
betting intelligence engine that:

- Works across sports + bet types (props-first)
- Produces calibrated probabilities + uncertainty
- Measures itself against market truth (devig consensus + CLV)
- Learns from outcomes and execution timing
- Avoids leakage and narrative-driven overfitting
- Supports Black Label customization later without breaking truth

This spec defines WHAT models exist and HOW they interact. Implementation
details are Phase 2B.

---

## 2) CORE OUTPUTS (NON-NEGOTIABLE)

Every scored `bet_event` must have:

1. **Probability** aligned to the wager
   - Examples: p_over/p_under, p_home/p_away, p_yes/p_no

2. **Distribution** (or distribution proxy)
   - distribution_type + params OR quantile set

3. **Uncertainty score** (0-1)
   - used for confidence throttling and risk penalties

4. **Market-anchored edge**
   - Edge = P_model - P_market (from DEVIG_NORMALIZATION_SPEC)

5. **CLV forecast**
   - Expected probability movement to close (direction + magnitude)

6. **Reason codes + attribution**
   - explainable drivers (not “AI wrote this”)

---

## 3) MODEL FAMILY (THE “STACK”)

We use a layered, ensemble architecture:

### Layer A — Market Prior (always on)

A market-based baseline model derived from:

- devig consensus probability
- book profiles / liquidity weights
- time-to-start
- market phase (pregame/live)

Purpose:

- establish an efficient-market prior
- prevent hallucinated edge when data is thin

Output:

- P_prior
- uncertainty_prior

### Layer B — Stat Projection Models (sport-specific, reusable template)

These predict the underlying stat distribution:

- NBA points/rebounds/assists, etc.
- NFL passing/rushing/receiving yards, etc.
- MLB HR/hits/strikeouts, etc.
- NHL shots/goals/points, etc.

Outputs:

- distribution params (mean/var or quantiles)
- context-sensitive uncertainty

### Layer C — Price/Movement Models (execution alpha)

Models focused on:

- steam velocity
- market resistance
- disagreement between sharp vs retail books
- timing relative to information events

Outputs:

- CLV forecast (expected move)
- “execution quality” recommendation (now/wait/avoid)

### Layer D — Correlation/Risk Models (Phase 3 compatible)

Models correlation groups for:

- SGP legs
- same-player and same-team exposures
- portfolio correlation

Outputs:

- correlation_group quality_score
- covariance/correlation estimates (sparse allowed)

### Layer E — Meta-Ensemble (final probability)

Combines:

- P_prior (market)
- P_stat (projection-derived)
- P_move (timing/CLV)
- risk/uncertainty penalties

Final output:

- P_final
- uncertainty_final
- edge_final

---

## 4) UNIVERSAL BET EVENT NORMALIZATION

All bets must normalize into a single “evaluation form”:

### 4.1 Over/Under bets

Given a stat distribution F(x) and line L:

- p_over = 1 - F(L)
- p_under = F(L)

### 4.2 Team side bets (moneyline/spread)

Represent as win probability distribution or margin distribution.

- Moneyline: p_home_win / p_away_win
- Spread: margin distribution M; p_cover = P(M > spread_line) depending on side

### 4.3 Boolean props (anytime TD, HR, goal scorer)

Direct binary probability:

- p_yes, p_no = 1 - p_yes

---

## 5) FEATURE TAXONOMY (HIGH LEVEL)

We will govern features by classes (details in FEATURE_TAXONOMY doc later):

A) Player performance signals

- rolling windows, season baseline, matchup context

B) Team/pace/context signals

- pace, usage, opponent style, game environment

C) Availability and role signals (via information_event)

- lineup confirmed, injuries, role volatility flags

D) Market signals

- devig consensus, dispersion, sharp/retail disagreement

E) Timing/execution signals

- time-to-start, post-news window, steam velocity

Leakage policy:

- No features derived from future outcomes
- No “closing price” used as training input for picks made earlier
- Training must be walk-forward only

---

## 6) TRAINING DESIGN (NON-NEGOTIABLE)

### 6.1 Walk-forward training

We use time-based splits:

- Train: historical window
- Validate: subsequent slice
- Test: most recent slice No random splits.

### 6.2 Labels

Primary label depends on market:

- Over/Under: outcome of stat vs line at bet time (or distribution label)
- Moneyline: win/loss
- Spread: cover/not cover
- Boolean: event occurred yes/no

Market truth anchor:

- Use devig consensus probability snapshots as “market prior” and baseline
  comparator.

### 6.3 Calibration is mandatory

Every model output must be calibrated:

- isotonic / platt / beta calibration (chosen per market family)
- calibration assessed by reliability diagrams + Brier score

We prefer:

- calibrated + slightly conservative over
- aggressive and miscalibrated

---

## 7) EVALUATION HARNESS (HOW WE PROVE DOMINANCE)

We do not declare a model “good” because it wins a backtest. We require
market-aware dominance metrics:

### 7.1 Primary Metrics

- **CLV**: probability delta to close (must be positive on average)
- **Calibration**: Brier score, ECE (expected calibration error)
- **Edge realism**: distribution of edge vs market; penalize extreme tails
- **Robustness**: stability across seasons, slates, and books

### 7.2 Secondary Metrics

- ROI at fixed staking (small Kelly fraction) with transaction costs
- Hit rate stratified by confidence bucket
- Performance by market type and by sport

### 7.3 Kill Conditions

A model is rejected if:

- calibration degrades beyond threshold
- CLV is negative beyond tolerance
- performance collapses outside a single sport/season regime
- it relies on unavailable features in production

---

## 8) LEARNING LOOP (WHY WE LOST → WHAT WE CHANGE)

### 8.1 Postmortem engine inputs

For every settled bet_event:

- entry snapshot
- closing snapshot
- info events timeline
- execution timestamp
- model_version + feature_set_version

### 8.2 Postmortem outputs

Must classify loss into:

- variance
- projection_miss
- role/news_miss
- execution_miss (bad timing vs movement)
- price_miss (market already efficient)
- correlation_miss (SGP/portfolio)

### 8.3 Feedback routing (controlled)

Postmortems do NOT auto-change the model. They create:

- action items
- candidate feature additions
- candidate calibration updates
- retrain triggers All changes require model governance approval.

---

## 9) MODEL GOVERNANCE (CANARY + ROLLBACK)

Every model change must be:

- versioned
- canaried
- evaluated on live shadow before full enablement

Required artifacts per model release:

- training data window summary
- evaluation report
- calibration report
- CLV report
- drift report
- rollback plan

No “silent” model changes.

---

## 10) PRODUCTION INTEGRATION CONTRACT (WHAT THE APP EXPECTS)

When ScoringAgent scores a bet_event, it MUST write:

- model_name, model_version
- P_final + uncertainty_final
- distribution_type + params/quantiles
- feature_set_version + feature_vector_hash
- edge vs devig consensus
- clv_forecast
- reason codes + attribution summary

If any required field is missing:

- scoring result is invalid
- promotion is blocked
- record is flagged for operator review

---

## 11) PHASE 2A NEXT DOCS (IN ORDER)

After this is ratified, we create:

1. WALK_FORWARD_EVAL_HARNESS_v1.md (formal metrics + thresholds)
2. FEATURE_TAXONOMY_v1.md (governed catalog + leakage ratings)
3. DATA_MOAT_REQUIREMENTS_v1.md (now derived from model needs, not vibes)

END.
