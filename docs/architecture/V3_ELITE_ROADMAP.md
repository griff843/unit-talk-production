# V3 Elite Roadmap — Syndicate-Level Scoring Architecture

> **Authority**: Derived from `PIPELINE_CONTRACT_CLEANROOM_V3.md` +
> `DRIFT_REPORT.md` **Date**: 2026-03-04 **Goal**: Close every P0/P1 drift
> finding and build a syndicate-grade scoring system

---

## Situation

The drift audit found 6 P0 violations, 6 P1 misalignments, and 6 P2
non-canonical patterns. The core problem: **two parallel pipelines exist with no
bridge.**

| Pipeline       | Source          | Scoring                                    | Status                 |
| -------------- | --------------- | ------------------------------------------ | ---------------------- |
| Legacy (V1/V2) | raw_props       | Single-book, flat, no canonical IDs        | ACTIVE                 |
| V3 (designed)  | provider_offers | Multi-book, canonical IDs, consensus devig | BUILT BUT DISCONNECTED |

The V3 infrastructure is **surprisingly complete**. The modules exist:

| Module                       | Status  | What It Does                                                 |
| ---------------------------- | ------- | ------------------------------------------------------------ |
| `providerOffersIngestion.ts` | Working | OddsAPI -> provider_offers via RPC                           |
| `fetchBookOffers()`          | Working | Queries provider_offers, returns BookOffer[]                 |
| `computeConsensus()`         | Working | Multi-book weighted devig (sharp 1.5x, MM 1.2x, retail 1.0x) |
| `computeProbabilityLayer()`  | Working | Consensus -> edge -> uncertainty -> CLV forecast             |
| `computeScoreV2()`           | Working | 30-feature weighted average, sport-specific weights          |
| `promotionPolicy()`          | Working | 8 constitutional gates, fail-closed                          |
| Lifecycle adapters           | Working | lifecycleInsert, lifecycleUpdate, atomicClaimForPost         |
| provider_offers table        | Working | Multi-book schema, canonical IDs, immutability triggers      |
| provider_registry            | Working | Book profiles, liquidity tiers, data quality defaults        |
| Catalog views                | Working | view_provider_offers_current_v3, participant views           |

**The job is not building from scratch. It is CONNECTING existing components,
ENHANCING scoring quality, and VALIDATING with CLV.**

---

## Design Principles

1. **MARKET-ANCHORED**: Start from multi-book consensus truth. Don't fight the
   market — find where it's wrong.
2. **FAIL-CLOSED**: Missing data -> lower confidence -> less promotion. Never
   fabricate edge.
3. **SHADOW MODE**: New pipeline runs alongside legacy. Compare before
   switching.
4. **CLV-VALIDATED**: Every model change must show positive CLV or it gets
   reverted.
5. **AUDITABLE**: Every scoring decision persisted with market_snapshot,
   feature_snapshot, probability primitives.
6. **SINGLE-WRITER**: All canonical writes via lifecycle adapters. No
   exceptions.

---

## The V3 Scoring Architecture

```
provider_offers (multi-book odds from 5-10 sportsbooks)
    |
    v
MarketAnalyzer
    - fetchBookOffers() per (event, market, participant)
    - computeConsensus() with sharp-book weighting
    - Persist market_snapshots (auditable market truth)
    |
    v
market_snapshots (consensus_prob, devig_method, overround, weights)
    |
    v
FeatureExtractor (sport-specific)
    - Projection features (pace, usage, minutes, matchup)
    - Situational features (rest, travel, home/away)
    - Market features (efficiency, line stability, steam)
    - Historical features (CLV rate for this market type)
    |
    v
ScoringEnsemble
    - Model A: Market-anchored confidence (probabilityLayer)
    - Model B: Feature-weighted score (computeScoreV2)
    - Model C: Historical CLV predictor (future)
    - Ensemble: confidence-weighted blend
    |
    v
EdgeQuantifier
    - edge = p_model - p_market
    - edge_ci = [edge_lower, edge_upper] via uncertainty
    - market_efficiency_factor modulates edge threshold
    |
    v
PromotionGate (fail-closed)
    - Existing 8 gates (kill switch, policy, result, canary, band, hardOnly, feature, probability)
    - Gate 9: Minimum edge threshold (sport/market-specific)
    - Gate 10: Portfolio correlation check
    - Gate 11: CLV history check
    - Gate 12: Model agreement check
    |
    v
unified_picks (via lifecycleInsert, writerRole: 'scorer')
    |
    v
OperatorReview (Command Center via API)
    - Approve -> publish_outbox
    - Reject -> reason logged
    - Override -> audit trail
    |
    v
publish_outbox -> Discord -> receipt
    |
    v
SettlementAgent -> prop_settlements
    |
    v
CLV Loop -> model recalibration
```

---

## The Scoring Model — What Makes It Syndicate-Level

### Layer 1: Market Truth (Consensus Devig)

The market is the prior. Multi-book consensus probability is the starting point.

```
Input:  BookOffer[] from 5-10 sportsbooks
Weight: sharp(1.5x) > market_maker(1.2x) > retail(1.0x)
        * liquidity_tier * data_quality
Devig:  Proportional method (fair_prob = implied_prob / overround)
Output: p_market (true market probability)
        market_efficiency = 1 / overround_spread
```

Pinnacle sets the anchor. DraftKings/FanDuel confirm. Retail books (BetMGM,
PointsBet) add noise but increase sample size. The consensus is always better
than any single book.

### Layer 2: Feature-Based Adjustment

We're not predicting outcomes from scratch. We're predicting **where the market
is wrong**.

```
p_adjustment = SUM(feature_i * weight_i) normalized to [-0.04, +0.04]

The adjustment is BOUNDED by market efficiency:
  - High-efficiency market (NFL spread): max adjustment = +/- 0.02
  - Low-efficiency market (player prop): max adjustment = +/- 0.06
```

Sport-specific feature registries:

**NBA**:

- pace_factor: game expected pace vs league average
- usage_rate: player's % of team possessions
- minutes_projection: expected minutes (load management, blowout risk)
- matchup_quality: opposing defense ranking for this stat
- rest_days: 0 (B2B penalty), 1 (normal), 2+ (rest bonus)
- home_away_split: home/away performance differential
- referee_tendencies: ref crew pace/foul rate (advanced)

**NFL**:

- target_share: % of team passing targets
- snap_count_projection: expected snaps
- red_zone_rate: red zone target/carry rate
- weather_factor: wind, precipitation, temperature
- indoor_outdoor: dome advantage
- divisional_game: familiarity factor

**MLB**:

- pitcher_matchup: opposing pitcher quality (ERA, WHIP, K rate)
- park_factor: park-specific run environment
- platoon_split: L/R matchup advantage
- bullpen_fatigue: recent bullpen usage

### Layer 3: Confidence-Weighted Blend

```
p_final = p_market + (p_adjustment * confidence_weight * (1 - uncertainty))

Where:
  confidence_weight = f(feature_completeness, model_agreement, historical_accuracy)
  uncertainty = f(book_count, market_maturity, feature_gaps, model_variance)
```

The more uncertain we are, the more we trust the market (p_adjustment shrinks
toward 0). The more confident, the more our model moves the probability.

### Edge Quantification

```
edge = p_final - p_market
edge_lower = edge - (uncertainty * z_95)
edge_upper = edge + (uncertainty * z_95)

Promotion requires: edge_lower > 0 (entire CI is positive)
Tier assignment uses: edge magnitude + confidence + feature completeness
```

### Syndicate-Level Metrics (Targets)

| Metric           | Target     | Meaning                                      |
| ---------------- | ---------- | -------------------------------------------- |
| CLV hit rate     | > 55%      | Beat closing line more often than not        |
| Edge accuracy    | r > 0.3    | Predicted edge correlates with realized edge |
| Tier calibration | S > A > B  | Higher tiers win at higher rates             |
| Monthly drawdown | < 20 units | Risk-controlled                              |
| Sharpe ratio     | > 0.5      | Risk-adjusted returns                        |

---

## Phase Plan

### Phase 0: Data Foundation Lock (Sprint 021)

**Objective**: Prove multi-book data flows and returns real consensus
probabilities.

| Task                             | Description                                                                        | Risk   |
| -------------------------------- | ---------------------------------------------------------------------------------- | ------ |
| Verify provider_offers ingestion | Confirm 2+ providers per market in provider_offers                                 | LOW    |
| Automate participant resolution  | Seed provider_player_map or auto-resolve function                                  | MEDIUM |
| Create market_snapshots table    | Migration with consensus_prob, devig_method, overround, weights                    | LOW    |
| End-to-end proof script          | Query provider_offers -> fetchBookOffers -> computeConsensus -> real probabilities | LOW    |

**Start with game-level markets** (moneyline, spread, total) which don't need
participant_id. Add player props after participant resolution is automated.

**Acceptance**: fetchBookOffers() returns 2+ BookOffer for a real NBA market.
computeConsensus() returns ok:true.

---

### Phase 1A: V3 Scoring Pipeline (Sprint 022)

**Objective**: New scoring service reads from provider_offers, replaces
raw_props as scoring source.

| Task                     | Description                                                                           | Risk   |
| ------------------------ | ------------------------------------------------------------------------------------- | ------ |
| Create V3ScoringPipeline | Service: provider_offers -> consensus -> probability -> score -> promote -> lifecycle | HIGH   |
| Create V3ScoringAgent    | Agent: scheduled poll, health heartbeat, processes unscored markets                   | MEDIUM |
| Scoring ledger           | Track scored (event, market, participant) combinations for idempotency                | LOW    |
| Shadow mode              | V3 runs alongside legacy, picks tagged pick_source='v3_scoring', start as NO_POST     | MEDIUM |

**Key design**: V3ScoringPipeline is market-centric, not prop-centric. It scores
all participants in a market at once (all books for LeBron Points O/U 24.5)
rather than processing individual raw_props rows.

**Acceptance**: V3 picks produced from real provider_offers data with multi-book
consensus. Edge values are real (not INSUFFICIENT_BOOKS).

---

### Phase 1B: Scoring Model Enhancement (Sprint 023)

**Objective**: Upgrade from basic weighted average to sport-specific feature
analysis.

| Task                              | Description                                                           | Risk   |
| --------------------------------- | --------------------------------------------------------------------- | ------ |
| Sport-specific feature registries | NBA, NFL, MLB registries with real features and tuned weights         | HIGH   |
| Market efficiency scoring         | Modulate edge threshold by market efficiency                          | MEDIUM |
| Confidence interval modeling      | edge_ci = [lower, upper] via uncertainty propagation                  | MEDIUM |
| Multi-model ensemble scaffold     | Model A (market) + Model B (features) with configurable blend weights | MEDIUM |

**Acceptance**: Different sports produce materially different scoring results.
Market efficiency modulates promotion. Confidence intervals computed.

---

### Phase 2: CLV + Learning Loop (Sprint 024)

**Objective**: Close the feedback loop. Validate model edge via CLV.

| Task                   | Description                                                                         | Risk   |
| ---------------------- | ----------------------------------------------------------------------------------- | ------ |
| ClosingLineAgent       | Snapshot provider_offers at game start (is_closing=true), capture closing consensus | MEDIUM |
| CLV computation        | Compare opening vs closing probability for each pick. Track by sport/market/tier    | LOW    |
| Walk-forward harness   | Backtest scoring model: train on N months, test on next, slide window               | HIGH   |
| Recalibration triggers | Alert if CLV goes negative for 50+ plays. Sport-specific model review               | LOW    |

**Acceptance**: CLV tracked for all posted picks. Walk-forward backtest produces
reportable results.

---

### Phase 3: Operator + Publish Layer (Sprint 025)

**Objective**: Build operator finalization and publish outbox per V3 contract.

| Task                           | Description                                                                            | Risk   |
| ------------------------------ | -------------------------------------------------------------------------------------- | ------ |
| Create publish_outbox table    | Migration: (pick_id, channel, status, discord_message_id, operator fields, timestamps) | LOW    |
| Operator finalization          | Command Center: approve/reject/override via API with audit trail                       | MEDIUM |
| PublishAgent reads from outbox | Post from publish_outbox, not unified_picks directly                                   | MEDIUM |
| Command Center -> API proxy    | All writes through API endpoints with RBAC                                             | MEDIUM |

**Acceptance**: Full flow: scoring -> promotion -> operator approve -> outbox ->
Discord -> receipt. Audit trail for all operator actions.

---

### Phase 4: Governance + Cleanup (Sprint 026)

**Objective**: Fix all P0 violations. Enforce single-writer. Retire raw_props
from scoring.

| Task                           | Description                                                                      | Risk   |
| ------------------------------ | -------------------------------------------------------------------------------- | ------ |
| Fix 6 single-writer violations | GradingAgent, RecapAgent, AlertAgent, CapperService, Discord Bot, Command Center | HIGH   |
| raw_props -> staging only      | Remove all scoring reads from raw_props                                          | MEDIUM |
| Smart Form catalog migration   | Switch props catalog to provider_offers views                                    | LOW    |
| CI gate enforcement            | Block non-lifecycle unified_picks writes, block scoring reads from raw_props     | LOW    |

**Acceptance**: Zero single-writer violations. Zero scoring reads from
raw_props. CI gates pass.

---

## Execution Sequence

```
Sprint 021: Phase 0 — DATA FOUNDATION
  Prove: multi-book data flows, consensus works on real data
  Deliverable: proof script showing real probabilities from 3+ books

Sprint 022: Phase 1A — V3 SCORING PIPELINE
  Build: V3ScoringPipeline + V3ScoringAgent in shadow mode
  Deliverable: V3 picks produced alongside legacy, comparison report

Sprint 023: Phase 1B — SCORING ENHANCEMENT
  Upgrade: sport-specific models, market efficiency, confidence intervals
  Deliverable: scoring quality metrics, A/B comparison vs Phase 1A

Sprint 024: Phase 2 — CLV + LEARNING
  Validate: closing line capture, CLV computation, walk-forward backtest
  Deliverable: CLV report by sport/market/tier, backtest results

Sprint 025: Phase 3 — OPERATOR + PUBLISH
  Build: publish_outbox, operator finalization, RBAC
  Deliverable: full audit trail for operator actions, outbox receipts

Sprint 026: Phase 4 — GOVERNANCE
  Fix: single-writer violations, raw_props retirement, CI gates
  Deliverable: clean drift report (zero P0 violations)
```

---

## What Exists vs What Must Be Built

| Component                         | Exists? | Action                                                 |
| --------------------------------- | ------- | ------------------------------------------------------ |
| provider_offers ingestion         | YES     | Verify, no changes                                     |
| fetchBookOffers()                 | YES     | Verify returns real data                               |
| computeConsensus()                | YES     | No changes                                             |
| computeProbabilityLayer()         | YES     | Wire to real consensus data                            |
| computeScoreV2()                  | YES     | Enhance with sport-specific features                   |
| promotionPolicy()                 | YES     | Add gates 9-12                                         |
| Lifecycle adapters                | YES     | Already used by BridgeWorker, DiscordPromo, Settlement |
| market_snapshots table            | NO      | Create (migration)                                     |
| publish_outbox table              | NO      | Create (migration)                                     |
| V3ScoringPipeline                 | NO      | Build (core new service)                               |
| V3ScoringAgent                    | NO      | Build (orchestrator)                                   |
| ClosingLineAgent                  | NO      | Build (CLV capture)                                    |
| Sport-specific feature registries | PARTIAL | Enhance (NBA exists, needs NFL/MLB/NHL)                |
| Market efficiency scoring         | NO      | Build                                                  |
| Walk-forward harness              | NO      | Build                                                  |
| Operator finalization audit trail | NO      | Build                                                  |

---

## Non-Goals (Explicitly Out of Scope)

- Automated bet execution (Unit Talk publishes picks, not places bets)
- Real-time odds streaming (poll-based is sufficient for now)
- Custom projection models (use public projections as features)
- Complete raw_props table deletion (deferred beyond Phase 4)
- Mobile app (Discord is the face per contract)

---

## Success Criteria (V3 Complete)

The system is "V3 Elite" when:

1. All scoring reads from `provider_offers`, never from `raw_props`
2. Every scored pick has a persisted `market_snapshot` with multi-book consensus
3. Every posted pick went through `publish_outbox` with operator approval
4. CLV is tracked and positive (>55% hit rate) for at least one sport
5. Zero single-writer violations (CI gate enforced)
6. Operator actions have full audit trail (who, what, when, why)
7. Model demonstrates real edge via walk-forward backtest
8. System is fail-closed: missing data blocks promotion, never fabricates edge
