# Skill: Edge Check

## Purpose

Run quick directional edge and calibration checks on a set of market prices or
model predictions. Use this to validate whether a pick has positive CLV at time
of bet, or whether the scoring model is drifting from calibration.

## When to Use

- Before posting a manually-sourced pick: verify the book odds show positive
  edge
- After a losing streak: check if model calibration has drifted
- Reviewing a set of picks from a specific market type for CLV pattern
- Directional check on whether closing line confirms or denies the opening edge
- Routine calibration audit (weekly or after > 50 new settled picks)

## Invocation

```
/edge-check clv --odds <book1_odds> <book2_odds> [--closing <closing_odds>]
/edge-check calibration --data <predictions_json>
```

Or invoked conversationally: "Check the edge on DraftKings -110, FanDuel -108,
BetMGM -112."

## Procedure

### Part A: CLV Edge Check

#### Step 1: Gather Book Offers

Collect 2+ American odds values from different books for the **same side** of
the market. More books = more reliable consensus.

Example: DraftKings -110, FanDuel -108, BetMGM -112

#### Step 2: Compute CLV

Call `compute_clv` (unit-talk-intelligence):

```
Tool: compute_clv
Input: {
  "book_offers": [
    { "odds": -110, "book_profile": "retail" },
    { "odds": -108, "book_profile": "retail" },
    { "odds": -112, "book_profile": "retail" }
  ],
  "devig_method": "proportional",
  "closing_odds": -106
}
```

**Input fields:**

| Field                          | Required | Notes                                             |
| ------------------------------ | -------- | ------------------------------------------------- |
| `book_offers[].odds`           | YES      | American odds per book (≥2 books)                 |
| `book_offers[].book_profile`   | no       | `retail` \| `market_maker` \| `sharp`             |
| `book_offers[].liquidity_tier` | no       | `low` \| `medium` \| `high`                       |
| `book_offers[].data_quality`   | no       | `good` \| `partial` \| `suspect`                  |
| `devig_method`                 | no       | `proportional` (default), `shin`, `power`         |
| `closing_odds`                 | no       | Closing line American odds — enables CLV estimate |

**Output fields:**

| Field                 | Meaning                                                             |
| --------------------- | ------------------------------------------------------------------- |
| `consensus_fair_prob` | Devigged consensus probability (0.0–1.0)                            |
| `consensus_fair_odds` | Fair American odds                                                  |
| `edge_pct`            | EV as % of stake (positive = +EV bet)                               |
| `edge_positive`       | Boolean: `true` if bet has positive expected value                  |
| `clv_estimate`        | CLV in probability points vs closing line (null if no closing_odds) |
| `model_version`       | `inline-<method>`                                                   |

**Math drift warning**: This tool uses a 2% vig approximation (one-sided odds
input). For standard juice (-105 to -115) the approximation is accurate within
~0.5%. For heavily juiced lines or alternate markets, treat as directional only.
See `packages/mcp-intelligence/src/adapters/index.ts` for the documented drift.

#### Step 3: Interpret CLV Result

| Condition              | Interpretation                                   |
| ---------------------- | ------------------------------------------------ |
| `edge_pct > 3.0`       | Strong positive edge — above noise threshold     |
| `1.0 < edge_pct ≤ 3.0` | Modest edge — consistent with the model          |
| `edge_pct ≤ 0`         | No edge at open; closing line will determine CLV |
| `clv_estimate > 0`     | Beat the close — confirms positive CLV           |
| `clv_estimate < 0`     | Negative CLV — closing line moved against us     |

### Part B: Calibration Check

#### Step 1: Prepare Prediction Data

Gather settled picks with their model predicted probability and actual outcome:

```json
[
  { "predicted_prob": 0.62, "actual_outcome": 1 },
  { "predicted_prob": 0.55, "actual_outcome": 0 },
  ...
]
```

Minimum: 10 predictions. Meaningful signal requires ≥ 50. `actual_outcome`: 1 =
win, 0 = loss, 0.5 = push.

#### Step 2: Compute Calibration

Call `compute_calibration` (unit-talk-intelligence):

```
Tool: compute_calibration
Input: {
  "predictions": [ ... ],
  "bucket_width": 0.1
}
```

**Output fields:**

| Field           | Meaning                                                           |
| --------------- | ----------------------------------------------------------------- |
| `brier_score`   | Mean squared error of predictions (lower = better; random = 0.25) |
| `log_loss`      | Log loss (lower = better)                                         |
| `ece`           | Expected Calibration Error (0 = perfect; < 0.05 = good)           |
| `mce`           | Maximum Calibration Error (worst bucket deviation)                |
| `n_predictions` | Sample count                                                      |
| `status`        | `CALIBRATED` \| `DRIFT` \| `MISCALIBRATED`                        |

**Status thresholds:**

| Status          | ECE    | Brier  |
| --------------- | ------ | ------ |
| `CALIBRATED`    | < 0.05 | < 0.25 |
| `DRIFT`         | < 0.10 | < 0.30 |
| `MISCALIBRATED` | ≥ 0.10 | ≥ 0.30 |

### Step 3: Report

```markdown
## Edge Check — <computed_at>

### CLV Analysis

Books: <book1> <odds1>, <book2> <odds2>, ... Devig method: proportional

| Metric           | Value                 |
| ---------------- | --------------------- | ----- |
| Fair probability | X.X%                  |
| Fair odds        | <american>            |
| Edge (EV %)      | +X.X%                 | -X.X% |
| Edge positive    | yes / no              |
| CLV estimate     | +X.Xpp / -X.Xpp / N/A |

**Verdict**: ✅ Positive edge | ⚠️ Near-zero | ❌ Negative EV

### Calibration Analysis (N=<n_predictions>)

| Metric      | Value | Threshold | Status   |
| ----------- | ----- | --------- | -------- |
| Brier score | X.XXX | < 0.25    | ✅/⚠️/❌ |
| ECE         | X.XXX | < 0.05    | ✅/⚠️/❌ |
| MCE         | X.XXX | —         | —        |
| Log loss    | X.XXX | —         | —        |

**Status**: CALIBRATED | DRIFT | MISCALIBRATED

### Recommendation

<one-line recommendation based on edge + calibration state>
```

## Escalation Paths

| Finding                                             | Recommended Action                                              |
| --------------------------------------------------- | --------------------------------------------------------------- |
| `edge_pct > 0` + `clv_estimate > 0`                 | Model confirmed positive; proceed                               |
| `edge_pct > 0` + `clv_estimate < -2`                | Edge eroded at close; investigate market movement               |
| `status = DRIFT`                                    | Monitor for 2 more weeks; do not adjust model weights yet       |
| `status = MISCALIBRATED`                            | File investigation sprint; check shadow_scoring_runs divergence |
| `clv_estimate` consistently negative over 20+ picks | Market timing or line shopping issue                            |

For MISCALIBRATED: run `get_shadow_divergence` via unit-talk-intelligence to
check if shadow scoring is diverging from production.

## Relevant Repo Paths

| Path                                              | Role                                                     |
| ------------------------------------------------- | -------------------------------------------------------- |
| `packages/mcp-intelligence/src/tools/index.ts`    | `compute_clv`, `compute_calibration`                     |
| `packages/mcp-intelligence/src/adapters/index.ts` | Inline math; math drift documented                       |
| `apps/api/src/lib/probability/devigConsensus.ts`  | Canonical devig (2-sided, weighted)                      |
| `apps/api/src/lib/verification/`                  | R3 shadow mode, R5 strategy simulation                   |
| `docs/ops/SLO_DEFINITIONS.md`                     | Grading latency SLO that may indicate calibration issues |

## Expected Output

- Fair probability and American odds from book consensus
- EV% and CLV estimate (if closing odds provided)
- Calibration metrics: Brier, ECE, MCE, log_loss
- Status: CALIBRATED / DRIFT / MISCALIBRATED
- One-line recommendation
