# STAT PROJECTION ARCHITECTURE v2.0

Status: ACTIVE Applies To: UNI-17 through UNI-23 + UNI-25 (Sprint 032 — INT-05
Stat Distribution Models) Supersedes: Layer B of MODEL_ARCHITECTURE_SPEC_v1.md
(stat projection layer only) Binding Over: All stat projection, feature
extraction, variance modeling, and evaluation code

---

## 1. DESIGN INVARIANTS

### 1.1 No Historical Average Modeling

Stat projections MUST NOT model stat values directly from historical averages.

Correct pipeline:

```
features → opportunity estimator → efficiency estimator → expected value → variance model → distribution model → probability vs line
```

### 1.2 Non-Constant Variance

Variance MUST NOT be a fixed value or a single historical standard deviation.
Variance must be a function of multiple uncertainty sources.

### 1.3 No Market Inputs in Stat Model

The statistical projection pipeline MUST NOT consume betting lines, odds,
implied probabilities, or any market-derived signal as an input feature.

Market information is introduced ONLY at the model blend layer (UNI-22).

---

## 2. PROJECTION PIPELINE

### 2.1 Mean Projection

```
expected_stat = opportunity_projection × efficiency_projection
```

**Opportunity variables:**

| Variable             | Source                | Description                           |
| -------------------- | --------------------- | ------------------------------------- |
| `minutes_projection` | Player form (UNI-18)  | Projected playing time                |
| `usage_rate`         | Role context (UNI-19) | Opportunity rate per unit time        |
| `role_stability`     | Role context (UNI-19) | Confidence in current role assignment |

**Efficiency variables:**

| Variable                        | Source                    | Description                    |
| ------------------------------- | ------------------------- | ------------------------------ |
| `stat_per_opportunity`          | Player form (UNI-18)      | Historical conversion rate     |
| `opponent_defensive_adjustment` | Opponent defense (UNI-20) | Matchup modifier               |
| `pace_environment_adjustment`   | Pace environment (UNI-21) | Game pace and context modifier |

### 2.2 Variance Model

```
variance = player_base_volatility
         + minutes_uncertainty
         + role_uncertainty
         + matchup_variance
```

| Component                | Source                    | Description                           |
| ------------------------ | ------------------------- | ------------------------------------- |
| `player_base_volatility` | Player form (UNI-18)      | Historical game-to-game stat variance |
| `minutes_uncertainty`    | Player form (UNI-18)      | Variance in projected minutes         |
| `role_uncertainty`       | Role context (UNI-19)     | Instability of role/usage assignment  |
| `matchup_variance`       | Opponent defense (UNI-20) | Opponent-induced variance inflation   |

### 2.3 Distribution Model

Distribution type is selectable per market:

| Market Type         | Default Distribution | Rationale                                |
| ------------------- | -------------------- | ---------------------------------------- |
| Points (continuous) | Normal               | Symmetric, high-volume stat              |
| Assists             | Normal               | Moderate volume, approximately symmetric |
| Rebounds            | Normal               | Moderate volume                          |
| Three-pointers made | Poisson              | Low-count discrete events                |
| Blocks              | Poisson              | Low-count discrete events                |
| Steals              | Poisson              | Low-count discrete events                |
| Combo stats (PRA)   | Normal               | Sum of normals → normal                  |

Distribution fitting:

```
Given: expected_value (μ), variance (σ²), distribution_type

Normal:  N(μ, σ²)
Poisson: Poi(λ) where λ = μ (variance constrained to mean)
```

Probability derivation:

```
p_over  = 1 - CDF(line)
p_under = CDF(line)
```

---

## 3. FEATURE EXTRACTOR CONTRACTS

### 3.1 Player Form (UNI-18)

Output interface:

```typescript
interface PlayerFormFeatures {
  // Opportunity side
  minutes_avg: number; // Rolling N-game average minutes
  minutes_trend: number; // Trend slope (-1 to +1)
  minutes_projection: number; // Projected minutes for target game
  minutes_uncertainty: number; // Variance in recent minutes

  // Efficiency side
  stat_per_minute: number; // Stat production rate per minute
  stat_per_opportunity: number; // Stat per usage opportunity
  stat_trend: number; // Recent trend direction (-1 to +1)

  // Variance side
  player_base_volatility: number; // Historical game-to-game variance
  consistency_score: number; // Inverse of coefficient of variation

  // Metadata
  games_sampled: number;
  window_size: number;
}
```

### 3.2 Role Context (UNI-19)

Output interface:

```typescript
interface RoleContextFeatures {
  // Opportunity side
  starter_probability: number; // 0-1 probability of starting
  usage_rate: number; // Usage rate / opportunity share
  snap_share: number; // Snap/minute share of team total

  // Variance side
  role_stability: number; // 0-1 how stable is current role
  role_uncertainty: number; // Variance contribution from role instability
  role_change_detected: boolean; // Recent role transition flag

  // Metadata
  games_sampled: number;
}
```

### 3.3 Opponent Defense (UNI-20)

Output interface:

```typescript
interface OpponentDefenseFeatures {
  // Efficiency side
  defensive_rating_vs_position: number; // Opponent strength vs this position
  stat_allowed_rank: number; // Rank in stat allowed (1=most, 30=least)
  opponent_defensive_adjustment: number; // Multiplier (>1 = favorable, <1 = tough)

  // Variance side
  matchup_volatility: number; // How variable are outcomes vs this opponent
  matchup_variance: number; // Variance contribution from matchup

  // Metadata
  games_sampled: number;
  opponent_team_id: string;
}
```

### 3.4 Pace Environment (UNI-21)

Output interface:

```typescript
interface PaceEnvironmentFeatures {
  // Efficiency side
  pace_factor: number; // Team pace relative to league average
  projected_game_total: number; // Expected combined score
  pace_environment_adjustment: number; // Multiplier for pace context

  // Opportunity side (minutes impact)
  rest_days: number; // Days since last game
  is_back_to_back: boolean;
  home_away_factor: number; // Home/away adjustment

  // Metadata
  team_id: string;
  opponent_team_id: string;
}
```

---

## 4. STAT DISTRIBUTION ENGINE OUTPUT CONTRACT (UNI-17)

Every prop projection MUST produce:

```typescript
interface StatProjectionOutput {
  /** Projected stat value (opportunity × efficiency) */
  expected_value: number;

  /** Composite variance from all uncertainty sources */
  variance: number;

  /** Distribution family used for this market */
  distribution_type: 'normal' | 'poisson';

  /** Distribution parameters as JSON (e.g., { mu, sigma } or { lambda }) */
  params_json: Record<string, number>;

  /** P(stat > line) from fitted distribution */
  p_over: number;

  /** P(stat < line) from fitted distribution */
  p_under: number;

  /** Composite uncertainty score (0-1, higher = less certain) */
  uncertainty_score: number;

  /** Hash of the input feature vector for reproducibility */
  feature_vector_hash: string;

  /** Version identifier for the feature set schema */
  feature_set_version: string;
}
```

Fail-closed: If any required feature extractor returns insufficient data, the
engine MUST return `{ ok: false, reason: string }` rather than fabricating a
projection.

---

## 5. MODEL BLEND LAYER (UNI-22) — MARKET INTRODUCTION POINT

Market information enters HERE and ONLY here.

```
p_blended = w_stat × p_stat + w_market × p_market_devig

where:
  w_stat   = f(stat_model_uncertainty, feature_completeness)
  w_market = 1 - w_stat
```

Blend weights are a function of stat model confidence:

- High uncertainty stat model → heavier market weight
- Low uncertainty stat model → heavier stat weight
- Configurable per sport/market type

Divergence tracking:

```typescript
interface BlendOutput {
  p_blended: number;
  p_stat: number;
  p_market: number;
  stat_weight: number;
  market_weight: number;
  divergence: number; // |p_stat - p_market|
  divergence_direction: number; // sign(p_stat - p_market)
}
```

---

## 6. EVALUATION METRICS (UNI-23)

Required measurements:

| Metric                         | Formula                                                     | Purpose                    |
| ------------------------------ | ----------------------------------------------------------- | -------------------------- |
| **Brier score**                | mean((outcome - p)²)                                        | Overall calibration        |
| **Log loss**                   | -mean(y·log(p) + (1-y)·log(1-p))                            | Penalizes confident misses |
| **ECE**                        | Σ (bucket_weight × \|bucket_accuracy - bucket_confidence\|) | Expected calibration error |
| **Confidence bucket accuracy** | Per-bucket hit rate vs predicted probability                | Calibration shape          |
| **Stat alpha buckets**         | Group by (P_stat − P_market) bins, measure ROI per bin      | Edge detection             |

All metrics must be computed:

- Overall
- Per sport
- Per market type
- Per confidence bucket

---

## 7. SIGNAL QUALITY LAYER (UNI-25)

Converts blend output into ranked, actionable betting signals.

Inputs: `BlendOutput` (UNI-22) + `StatContext` (expected_value, variance, line,
confidence from UNI-17)

Key formulas:

```
z_score = (expected_value - line) / sqrt(variance)
  Both numerator and denominator in stat units → dimensionless result

edge = P_final - P_market

signal_strength = |edge| × confidence × z_normalized

signal_quality_score = 0.30 × edge_component
                     + 0.25 × confidence_component
                     + 0.25 × z_component
                     + 0.20 × uncertainty_penalty

model_uncertainty = sqrt(variance) / expected_value
  Coefficient of variation (dimensionless)

recommended_bet_size = full_kelly × kelly_fraction
  full_kelly = edge / (1 - P_market)
  kelly_fraction = 0.25 (quarter-Kelly default)
```

Output contract:

```typescript
interface SignalOutput {
  edge: number;
  edge_direction: 'over' | 'under';
  signal_strength: number;
  z_score: number;
  signal_quality_score: number;
  confidence: number;
  recommended_bet_size: number;
  model_uncertainty: number;
  blend: BlendOutput;
  signal_version: string;
}
```

---

## 8. EXECUTION ORDER

```
UNI-18  Player form feature extractor
  ↓
UNI-19  Role context feature extractor
  ↓
UNI-20  Opponent defense feature extractor
  ↓
UNI-21  Pace environment feature extractor
  ↓
UNI-17  Build stat distribution engine (consumes all features)
  ↓
UNI-22  Integrate into model blend (market introduction point)
  ↓
UNI-23  Calibration and evaluation scripts
  ↓
UNI-25  Signal quality layer (ranked betting signals)
```

Feature extractors (18-21) may execute in parallel but must all complete before
UNI-17.

Note: UNI-24 was pre-allocated to an unrelated issue
(SPRINT-REPO-TRUTH-LOCK-002). The Signal Quality Layer was assigned UNI-25.

---

## 9. FORBIDDEN PATTERNS

| Pattern                                 | Why                                          | Correct Alternative                   |
| --------------------------------------- | -------------------------------------------- | ------------------------------------- |
| `expected = mean(last_N_games)`         | Ignores opportunity/efficiency decomposition | Use opportunity × efficiency pipeline |
| `variance = stddev(last_N_games)`       | Constant variance, ignores context           | Use composite variance model          |
| `features.include(implied_probability)` | Market leakage into stat model               | Only introduce market at blend layer  |
| `features.include(betting_line)`        | Market leakage into stat model               | Line is comparison target, not input  |
| `p_over = historical_hit_rate`          | Circular reasoning                           | Derive from fitted distribution CDF   |

---

## 10. VERSIONING

- Feature set version: `stat-proj-v2.0`
- Feature vector hash: SHA-256 of sorted feature key-value pairs
- Blend version: `stat-market-blend-v1.0`
- Signal version: `signal-quality-v1.1` (SPRINT-032A corrected)

END.
