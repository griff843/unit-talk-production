# DATA MOAT ARCHITECTURE v1.0

Blueprint Type: Proprietary Signal & Feedback Moat Contract  
Applies To: Ingestion, Feature Store, Execution, Settlement, Recaps, Analytics  
Status: RATIFIED (Phase 2A)  
Objective: Create compounding proprietary signals that markets cannot easily
copy

---

## 1. PURPOSE

A “data moat” is not “more data.”

A data moat is:

- Proprietary signal generation
- Compounding feedback loops
- High-quality labels
- Unique execution telemetry
- Market microstructure understanding

This document defines the moat-building architecture for Unit Talk.

---

## 2. MOAT PRINCIPLES

### 2.1 Compounding Advantage

Every bet placed must increase future edge.

### 2.2 Timestamped Truth Only

Signals are only valid if they are:

- time-correct
- reproducible
- non-leaky

### 2.3 Execution Is Data

How we fire bets becomes a proprietary signal.

### 2.4 Losses Are Labels

Why we lost is as valuable as wins.

---

## 3. MOAT LAYERS

### Layer A — Market Microstructure Dataset (Core Moat)

We store granular market state at decision time.

Required:

- multi-book odds snapshots (devig normalized)
- dispersion metrics
- overround / vig dynamics
- liquidity tier proxies
- time-to-start bucket
- price movement velocity
- opening → current → close deltas

Moat signal:

- market resistance score
- “sharp disagreement” indices
- stale line probability model inputs

---

### Layer B — Execution Quality Dataset (Syndicate Moat)

We store execution telemetry per pick:

- publish time
- entry time
- routing strategy
- slippage observed
- availability after publish
- CLV achieved
- time-to-entry percentile
- fire-now vs wait outcomes

Moat signal:

- execution alpha profile per market type
- routing weights that increase CLV
- timing policies that beat market drift

---

### Layer C — Context + Role Volatility Dataset (Prop Moat)

We store structured, timestamped context events:

- injuries with impact scores
- lineup confirmations
- starting pitcher / goalie confirmations
- teammate absence deltas
- minutes volatility
- usage volatility
- role stability index

Moat signal:

- role shift detection model
- volatility-aware staking
- player-specific uncertainty priors

---

### Layer D — Settlement + Grading Forensics Dataset (Truth Moat)

We store settlement with forensic richness:

- actual outcome
- outcome timestamp
- stat source
- reconciliation fields
- disputes (if any)
- settled version hash

Moat signal:

- model error decomposition
- calibration drift attribution
- systematic bias detection by sport/market

---

### Layer E — Loss Attribution Dataset (Learning Moat)

For every settled bet:

- expected value at entry
- realized value
- CLV delta
- category of miss:
  - projection miss
  - variance
  - news miss
  - execution miss
  - correlation miss
  - price miss

Moat signal:

- automatic “what went wrong” learning
- feature weakness identification
- retrain triggers grounded in error class frequency

---

## 4. MOAT TABLES (CANONICAL LOGICAL ENTITIES)

(Names may map to existing schema; this is the required logical set.)

1. market_snapshots (entry + close)
2. devig_snapshots (fair probs + weights + method)
3. information_events (injuries/lineups/news)
4. scored_events (model outputs + uncertainty)
5. execution_events (timing/routing/slippage)
6. settlement_events (results + hashes)
7. loss_attribution_events (reason codes)
8. feature_snapshots (feature_vector_hash + values)
9. model_metrics (calibration/CLV/drift)
10. portfolio_state_snapshots (exposure/drawdown)

Moat is the _relationships_ between these tables.

---

## 5. FEATURE STORE AS MOAT

Feature sets must be:

- versioned
- time-sliced
- reproducible
- stored with hashes

We keep:

- raw feature values
- computed features
- derived interactions
- feature drift baselines

Without a governed feature store, no moat exists.

---

## 6. FEEDBACK LOOPS (COMPOUNDING)

### Loop 1 — CLV → Execution Policy

CLV outcomes update routing weights and timing rules.

### Loop 2 — Loss Attribution → Feature Expansion

Dominant loss classes trigger targeted feature work.

### Loop 3 — Drift → Model Weighting

Drift triggers model reweighting and retraining.

### Loop 4 — Exposure → Promotion Threshold

Exposure saturation forces threshold tightening.

---

## 7. BLACK LABEL MOAT EXTENSION

Black Label tenants produce additional data:

- alternative routing policies
- alternative user bases (more volume)
- different market regimes

But tenant data must remain isolated.

Core moat can use:

- aggregated, anonymized performance signals only
- never raw tenant proprietary picks

---

## 8. NON-COPYABLE ADVANTAGES (THE REAL MOAT)

Competitors can copy:

- basic projections
- basic odds scraping
- basic filters

They cannot easily copy:

- execution telemetry at scale
- loss attribution labeling discipline
- drift-based adaptation loop
- promotion threshold governance with CLV anchors
- portfolio-level correlation control integrated into pick delivery

That’s the moat.

---

## 9. ACCEPTANCE GATES

Moat is considered “active” only if:

- 100% of promoted picks have entry market_snapshot + feature_vector_hash
- 100% of published picks have execution_events logged
- 100% of settled picks have loss_attribution classification
- Model metrics (CLV + calibration) computed daily
- Drift detection runs and can trigger guarded autopilot

---

END.
