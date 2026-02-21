# Edge Engine V1 Specification

**Sprint**: SPRINT-EDGE-ENGINE-V1-IMPLEMENT-097
**Model Version**: v1.0.0
**Date**: 2026-02-21
**Status**: IMPLEMENTED

---

## 1. Overview

Edge Engine v1 is a deterministic scoring system that evaluates betting edge
using Closing Line Value (CLV) as the primary signal, combined with market
resistance and probability analysis.

**Canonical Data Sources**:
- Entry odds: `unified_picks.bet_odds`, `unified_picks.bet_line`
- Closing odds: `provider_offers WHERE is_closing=TRUE` (immutable trigger)
- Fallback closing: `unified_picks.closing_odds`, `unified_picks.closing_line`

**Output Destinations**:
- `feature_snapshots`: Frozen scoring inputs
- `scored_legs`: Scoring outputs with model_version

---

## 2. Output Schema

```typescript
interface EdgeEngineV1Output {
  // Core outputs
  edge_score: number;           // 0-100 (quantile normalized)
  tier: 'S' | 'A' | 'B' | 'PASS';
  kelly_fraction: number;       // 0.00-0.05 (capped at 5%)

  // CLV metrics
  clv_pct: number;              // Percentage CLV (positive = good)
  clv_direction: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

  // Market analysis
  market_resistance_flag: 'WITH' | 'AGAINST' | 'NEUTRAL';
  line_movement_pct: number;    // Percentage line moved

  // Risk assessment
  risk_flags: string[];         // ['steam_fade', 'stale_line', etc.]

  // Metadata
  model_version: 'v1.0.0';
  computed_at: string;          // ISO timestamp
}
```

---

## 3. Scoring Formula

### 3.1 Implied Probability Conversion

American odds → Implied probability:

```
impliedProb(odds) =
  if odds < 0: |odds| / (|odds| + 100)
  if odds > 0: 100 / (odds + 100)
  if odds = 0: 0.5 (edge case)
```

**Examples**:
- -110 → 110/210 = 0.5238 (52.38%)
- +150 → 100/250 = 0.4000 (40.00%)
- -200 → 200/300 = 0.6667 (66.67%)

### 3.2 CLV Calculation

CLV measures edge captured by betting before close:

```
clv_pct = (closing_implied - entry_implied) / entry_implied * 100

For OVER/YES selections:
  clv_pct > 0 → line moved IN your favor (closing shows higher implied %)
  clv_pct < 0 → line moved AGAINST you

For UNDER/NO selections:
  Invert the calculation (use opposite side implied)
```

**Example**:
- Entry: -110 (52.38% implied)
- Close: -130 (56.52% implied)
- CLV = (0.5652 - 0.5238) / 0.5238 * 100 = +7.90%

### 3.3 Edge Score Components

Total edge_score = sum of weighted components, normalized to 0-100:

| Component | Weight | Range | Description |
|-----------|--------|-------|-------------|
| CLV Score | 40% | 0-40 | Primary edge signal from closing line |
| Market Resistance | 25% | 0-25 | Movement since entry |
| Probability Quality | 15% | 0-15 | Fair value at entry |
| Juice Efficiency | 10% | 0-10 | Vig-adjusted value |
| Historical Factor | 10% | 0-10 | Market type performance |

#### 3.3.1 CLV Score (0-40 points)

```
clv_score = clamp(clv_pct * 4, -20, 40)

Mapping:
  +10% CLV → 40 points (max)
  +5% CLV  → 20 points
  0% CLV   → 0 points
  -5% CLV  → -20 points (floor)
```

#### 3.3.2 Market Resistance Score (0-25 points)

```
line_movement_pct = (closing_line - entry_line) / entry_line * 100

For OVER bets:
  Positive movement (line went up) = favorable = WITH market

resistance_score =
  if movement WITH market: clamp(|movement| * 2.5, 0, 25)
  if movement AGAINST market: clamp(-|movement| * 1.5, -15, 0)
  if NEUTRAL (movement < 0.5%): 10 points (neutral bonus)
```

#### 3.3.3 Probability Quality Score (0-15 points)

Rewards entries at strong implied probability positions:

```
prob_score =
  if entry_implied >= 0.55 AND odds <= -130: 15 (strong favorite position)
  if entry_implied >= 0.50 AND odds <= -110: 12 (moderate favorite)
  if entry_implied >= 0.45: 8 (slight favorite)
  if entry_implied >= 0.40: 5 (even money)
  else: 0 (underdog)
```

#### 3.3.4 Juice Efficiency Score (0-10 points)

Rewards avoiding excessive vig:

```
vig_pct = entry_implied - true_probability (estimated)

juice_score =
  if odds > -115: 10 (low juice)
  if odds > -125: 7
  if odds > -140: 4
  else: 0 (high juice)
```

#### 3.3.5 Historical Factor Score (0-10 points)

Market type performance adjustment:

```
historical_score = MARKET_WEIGHTS[stat_type] || 5

MARKET_WEIGHTS = {
  'points': 10,
  'rebounds': 8,
  'assists': 8,
  'threes': 7,
  'pts_reb_ast': 9,
  'strikeouts': 8,
  'hits': 7,
  'default': 5
}
```

### 3.4 Final Edge Score

```
raw_score = clv_score + resistance_score + prob_score + juice_score + historical_score

// Normalize to 0-100
edge_score = clamp(raw_score, 0, 100)
```

---

## 4. Tier Assignment

Deterministic tier thresholds:

| Tier | Edge Score | Description |
|------|------------|-------------|
| **S** | ≥ 80 | Exceptional edge - strong bet |
| **A** | ≥ 65 | Strong edge - confident bet |
| **B** | ≥ 50 | Moderate edge - cautious bet |
| **PASS** | < 50 | Insufficient edge - no bet |

---

## 5. Kelly Fraction Calculation

Optimal bet sizing using simplified Kelly:

```
// Estimate true probability from CLV-adjusted model
true_prob = entry_implied * (1 + clv_pct/100)
true_prob = clamp(true_prob, 0.01, 0.99)

// Convert American odds to decimal
decimal_odds =
  if odds > 0: (odds / 100) + 1
  if odds < 0: (100 / |odds|) + 1

// Kelly formula
b = decimal_odds - 1
p = true_prob
q = 1 - p

kelly_raw = (p * b - q) / b

// Apply fractional Kelly (25%) and cap at 5%
kelly_fraction = clamp(kelly_raw * 0.25, 0, 0.05)
```

---

## 6. Market Resistance Flag

```
market_resistance_flag =
  if line_movement_pct > 1.0%:  'WITH' (line moved in favor)
  if line_movement_pct < -1.0%: 'AGAINST' (line moved against)
  else: 'NEUTRAL'
```

---

## 7. Risk Flags

Array of detected risk conditions:

| Flag | Condition |
|------|-----------|
| `steam_fade` | Line moved against entry by >5% |
| `stale_line` | No line movement (closing = entry) |
| `low_juice_capture` | CLV < 1% despite movement |
| `high_volatility` | Multiple direction changes |
| `no_closing_data` | Closing line not available |
| `underdog_fade` | Underdog position lost value |

---

## 8. Determinism Guarantees

### 8.1 Input Determinism

All inputs are frozen at computation time:
- Entry odds/line from unified_picks (immutable after settlement)
- Closing odds/line from provider_offers (trigger-enforced immutability)

### 8.2 Computation Determinism

- No random operations
- No floating point precision issues (use fixed decimal)
- All intermediate values rounded to 4 decimal places
- Same inputs always produce identical outputs

### 8.3 Output Determinism

- Results written to feature_snapshots (idempotent)
- Results written to scored_legs with model_version lock
- Re-computation produces byte-identical results

---

## 9. Implementation Contract

```typescript
// File: apps/api/src/agents/ScoringAgent/edgeEngineV1.ts

export function computeEdgeV1(input: EdgeV1Input): EdgeEngineV1Output {
  // 1. Convert odds to implied probabilities
  // 2. Calculate CLV
  // 3. Compute component scores
  // 4. Sum and normalize edge_score
  // 5. Assign tier
  // 6. Calculate Kelly fraction
  // 7. Detect risk flags
  // 8. Return deterministic output
}
```

---

## 10. Validation Criteria

1. **Determinism Test**: Same input → identical JSON output
2. **CLV Calculation**: Verified against known examples
3. **Tier Boundaries**: Edge cases at 50, 65, 80 thresholds
4. **Kelly Bounds**: Never exceeds 5%, never negative
5. **Risk Flag Coverage**: All conditions trigger correctly

---

**Model Version**: v1.0.0
**Hash**: (computed at runtime from spec)
**Author**: SPRINT-EDGE-ENGINE-V1-IMPLEMENT-097
