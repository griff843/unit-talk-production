# Edge Engine PRE/POST Score Specification

**Sprint**: SPRINT-EDGE-ENGINE-PRESCORE-SPLIT-098
**Date**: 2026-02-21
**Status**: IMPLEMENTED

---

## 1. Overview

This specification defines the split of Edge Engine scoring into two distinct phases:

| Score | Purpose | Data Boundary |
|-------|---------|---------------|
| **edge_score_pre** | Selection/Production decisions | Entry-time data ONLY |
| **edge_score_post** | Validation/CLV analysis | Full close data allowed |

**Non-Negotiable Principle**: Decision scores (PRE) MUST only use information available at decision time. No closing lines, no outcomes, no post-start data.

---

## 2. Score Definitions

### 2.1 edge_score_pre (Selection Score)

**Purpose**: Used for promotion, posting, and tiering decisions.

**Model Version**: `v1.0.1-pre`

**Temporal Boundary**: Data available at `decision_timestamp` only.

```typescript
interface EdgeScorePreOutput {
  edge_score_pre: number;      // 0-100
  tier_pre: 'S' | 'A' | 'B' | 'PASS';
  kelly_fraction_pre: number;  // 0.00-0.05
  pre_flags: string[];

  // Component breakdown
  pre_components: {
    projection_delta_score: number;    // 0-40
    probability_quality_score: number; // 0-20
    juice_efficiency_score: number;    // 0-15
    historical_factor_score: number;   // 0-15
    early_movement_score: number;      // 0-10
  };

  model_version_pre: 'v1.0.1-pre';
  computed_at: string;
}
```

### 2.2 edge_score_post (Validation Score)

**Purpose**: Used for CLV validation, model calibration, and retrospective analysis.

**Model Version**: `v1.0.1-post` (or `v1.0.0` if unchanged from V1)

**Temporal Boundary**: Full data including closing lines permitted.

```typescript
interface EdgeScorePostOutput {
  edge_score_post: number;     // 0-100 (same as v1.0.0)
  tier_post: 'S' | 'A' | 'B' | 'PASS';
  kelly_fraction_post: number;
  clv_pct: number;
  clv_direction: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  market_resistance_flag: 'WITH' | 'AGAINST' | 'NEUTRAL';
  post_flags: string[];

  // Component breakdown (v1.0.0 components)
  post_components: {
    clv_score: number;
    resistance_score: number;
    probability_score: number;
    juice_score: number;
    historical_score: number;
  };

  model_version_post: 'v1.0.1-post';
  computed_at: string;
}
```

---

## 3. PRE Score Components

### 3.1 Component Weights

| Component | Weight | Range | Description |
|-----------|--------|-------|-------------|
| Projection Delta | 40% | 0-40 | Model/consensus projection vs line |
| Probability Quality | 20% | 0-20 | Entry position strength |
| Juice Efficiency | 15% | 0-15 | Vig-adjusted value at entry |
| Historical Factor | 15% | 0-15 | Market type performance |
| Early Movement | 10% | 0-10 | Open→entry movement direction |

**Total**: 100 points maximum

### 3.2 Projection Delta Score (0-40 points)

Measures edge between model projection and line at entry time.

```
projection_delta = (projection - entry_line) / entry_line * 100

For OVER bets:
  delta > 0 = favorable (projection > line)

projection_delta_score = clamp(projection_delta * 4, 0, 40)
```

**Data Source**: `unified_picks.projection` or consensus projections (NOT closing lines).

### 3.3 Probability Quality Score (0-20 points)

Same logic as v1.0.0 but scaled to 20 max:

```
prob_quality_score =
  if entry_implied >= 0.55 AND odds <= -130: 20
  if entry_implied >= 0.50 AND odds <= -110: 16
  if entry_implied >= 0.45: 10
  if entry_implied >= 0.40: 6
  else: 0
```

### 3.4 Juice Efficiency Score (0-15 points)

```
juice_score =
  if odds > -115 OR odds > 0: 15 (low juice / plus money)
  if odds > -125: 11
  if odds > -140: 6
  else: 0
```

### 3.5 Historical Factor Score (0-15 points)

Market type performance adjustment (scaled from v1.0.0):

```
MARKET_WEIGHTS_PRE = {
  'points': 15,
  'rebounds': 12,
  'assists': 12,
  'threes': 10,
  'pts_reb_ast': 13,
  'strikeouts': 12,
  'hits': 10,
  'default': 8
}
```

### 3.6 Early Movement Score (0-10 points)

Movement from market open to entry (NOT to close).

```
early_movement_pct = (entry_line - opening_line) / opening_line * 100

For OVER bets:
  Positive movement (line went up before entry) = favorable

early_movement_score =
  if movement WITH our side: clamp(|movement| * 2, 0, 10)
  if movement AGAINST: clamp(-|movement| * 1, -5, 0)
  if NEUTRAL (< 0.5%): 5
```

**Data Source**: `provider_offers WHERE is_closing = FALSE` (opening/early lines only).

---

## 4. Tier Thresholds

### 4.1 PRE Tier Thresholds

| Tier | edge_score_pre | Description |
|------|----------------|-------------|
| **S** | ≥ 75 | Strong selection - high confidence |
| **A** | ≥ 60 | Good selection - confident |
| **B** | ≥ 45 | Moderate selection - cautious |
| **PASS** | < 45 | Insufficient edge - no action |

*Note: PRE thresholds are slightly lower than POST since we have less information.*

### 4.2 POST Tier Thresholds (unchanged from v1.0.0)

| Tier | edge_score_post | Description |
|------|-----------------|-------------|
| **S** | ≥ 80 | Exceptional edge |
| **A** | ≥ 65 | Strong edge |
| **B** | ≥ 50 | Moderate edge |
| **PASS** | < 50 | Insufficient edge |

---

## 5. Leakage Prohibitions (MANDATORY)

### 5.1 Forbidden Data in PRE Score

The following data sources are **STRICTLY PROHIBITED** in PRE score computation:

| Data | Reason |
|------|--------|
| `provider_offers WHERE is_closing = TRUE` | Future data (closing line) |
| `unified_picks.closing_line` | Future data |
| `unified_picks.closing_odds` | Future data |
| `unified_picks.result` | Outcome data |
| `unified_picks.settlement_*` | Settlement data |
| `prop_settlements.*` | Settlement data |
| Any timestamp > `decision_timestamp` | Future data |

### 5.2 Permitted Data in PRE Score

| Data | Reason |
|------|--------|
| `unified_picks.bet_line` | Entry-time data |
| `unified_picks.bet_odds` | Entry-time data |
| `unified_picks.projection` | Model projection (available pre-bet) |
| `provider_offers WHERE is_closing = FALSE` | Opening/early lines |
| `provider_offers WHERE recorded_at <= decision_time` | Historical lines |
| Market type, sport, player metadata | Static reference data |

### 5.3 Runtime Guard

PRE score computation MUST include runtime assertion:

```typescript
function assertNoFutureData(offers: ProviderOffer[]): void {
  for (const offer of offers) {
    if (offer.is_closing === true) {
      throw new Error('LEAKAGE_VIOLATION: PRE score received closing line data');
    }
  }
}
```

---

## 6. Usage Boundaries

### 6.1 PRE Score Usage (Selection/Production)

- ✅ Promotion decisions
- ✅ Posting decisions
- ✅ Tier display in UI
- ✅ Kelly sizing for live bets
- ✅ Alert generation

### 6.2 POST Score Usage (Validation Only)

- ✅ CLV tracking and reporting
- ✅ Model calibration
- ✅ Retrospective analysis
- ✅ Edge validation reports
- ❌ NOT for promotion/posting decisions
- ❌ NOT for live tiering display

---

## 7. Kelly Fraction (PRE)

Calculated using PRE score confidence:

```
// Estimate edge from PRE score (simplified)
edge_estimate_pre = (edge_score_pre - 45) / 100  // Maps 45+ to positive edge

// Convert to probability adjustment
prob_adjustment = edge_estimate_pre * 0.1  // Conservative
true_prob_pre = entry_implied + prob_adjustment
true_prob_pre = clamp(true_prob_pre, 0.01, 0.99)

// Kelly calculation (same as v1.0.0)
b = decimal_odds - 1
kelly_raw = (true_prob_pre * b - (1 - true_prob_pre)) / b

// Fractional Kelly (25%) capped at 5%
kelly_fraction_pre = clamp(kelly_raw * 0.25, 0, 0.05)
```

---

## 8. PRE Flags

Risk flags detected during PRE computation:

| Flag | Condition |
|------|-----------|
| `no_projection` | Projection data missing |
| `stale_opening` | No opening line available |
| `high_juice` | Entry odds > -140 |
| `low_volume_market` | Historical factor < 10 |
| `adverse_early_movement` | Line moved against by > 3% before entry |

---

## 9. Artifact Storage

### 9.1 scored_legs Table

Both scores written with distinct model versions:

```sql
-- PRE score row
INSERT INTO scored_legs (
  leg_id, model_version, model_name, edge_score, tier, kelly_fraction,
  feature_contributions, computed_at, is_latest, meta
) VALUES (
  $leg_id, 'v1.0.1-pre', 'edge_engine_pre', $edge_score_pre, $tier_pre,
  $kelly_fraction_pre, $pre_components, $computed_at, true, $meta
);

-- POST score row
INSERT INTO scored_legs (
  leg_id, model_version, model_name, edge_score, tier, kelly_fraction,
  feature_contributions, computed_at, is_latest, meta
) VALUES (
  $leg_id, 'v1.0.1-post', 'edge_engine_post', $edge_score_post, $tier_post,
  $kelly_fraction_post, $post_components, $computed_at, true, $meta
);
```

### 9.2 feature_snapshots Table

Feature snapshots include PRE-only inputs:

```sql
INSERT INTO feature_snapshots (
  leg_id, model_version, model_name, feature_vector, computed_at, meta
) VALUES (
  $leg_id, 'v1.0.1-pre', 'edge_engine_pre', $pre_features_json, $computed_at, $meta
);
```

---

## 10. Validation Criteria

1. **No-Future-Data Test**: PRE computation must pass guard script
2. **Determinism Test**: Same inputs → identical outputs for both scores
3. **Correlation Test**: PRE and POST should be positively correlated (r > 0.3)
4. **Tier Consistency**: tier_pre derived only from edge_score_pre
5. **Promotion Wiring**: All promotion logic uses tier_pre only

---

**Model Versions**:
- PRE: `v1.0.1-pre`
- POST: `v1.0.1-post`

**Author**: SPRINT-EDGE-ENGINE-PRESCORE-SPLIT-098
