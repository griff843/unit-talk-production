# Skill: Intelligence Analysis

## Purpose

Run CLV edge computation, calibration analysis, and strategy simulation against
a pick cohort. Surfaces whether the grading model is producing well-calibrated,
edge-positive outputs.

## When to Use

- After deploying a new scoring model version to validate output quality
- When ROI is trending negative and root cause needs diagnosing
- Before a sprint that changes grading weights or promotion thresholds
- When preparing a performance report for a weekly cohort

## Invocation

```
/intelligence-analysis --cohort <pick_ids | date_range> [--strategy <name>] [--calibration]
```

`--strategy`: run R5 strategy simulation (flat-unit, kelly-025, etc.)
`--calibration`: include Brier score and ECE calibration metrics

## Required Inputs

- Cohort: either explicit pick IDs or a date range (e.g.,
  `2026-03-01:2026-03-07`)
- Optionally: strategy name from predefined list
- Optionally: `--calibration` flag

## Procedure

### Step 1: Pull Cohort

```bash
# Via mcp-state: query_picks with date filter
# Returns picks with promotion_band, confidence, lines, outcomes
```

Minimum cohort for statistical significance: 30 picks.

### Step 2: CLV Edge Computation

```bash
# Via mcp-intelligence: compute_clv for each pick
# Source: @unit-talk/intelligence (calculateEdge, calculateCLVProb)
```

Aggregate: mean edge, % edge-positive, edge by promotion_band.

### Step 3: Calibration (if --calibration)

```bash
# Via mcp-intelligence: compute_calibration
# Source: @unit-talk/intelligence (computeBrierScore, computeCalibrationMetrics)
```

Key metrics:

- Brier score (lower is better, < 0.25 is good)
- ECE — Expected Calibration Error (< 0.05 is well-calibrated)
- Reliability buckets (predicted vs actual win rate)

### Step 4: Strategy Simulation (if --strategy)

```bash
# Via mcp-intelligence: run_strategy_simulation
# Source: apps/api/src/lib/verification/strategy/
```

Available strategies: flat-unit, flat-unit-friction, kelly-025, kelly-010

Reports: ROI, Sharpe ratio, max drawdown, win rate.

### Step 5: Report

```markdown
## Intelligence Analysis — <date>

Cohort: X picks | <date_range>

### CLV Edge Summary

| Band   | Mean Edge | % Edge+ | Count |
| ------ | --------- | ------- | ----- |
| HARD   | X%        | X%      | X     |
| STRONG | X%        | X%      | X     |
| MEDIUM | X%        | X%      | X     |
| LIGHT  | X%        | X%      | X     |

### Calibration (if requested)

Brier Score: X (threshold: < 0.25) ECE: X (threshold: < 0.05) Status: ✅
CALIBRATED | ⚠️ DRIFT | ❌ MISCALIBRATED

### Strategy Simulation (if requested)

Strategy: <name> ROI: X% | Sharpe: X | Max Drawdown: X% | Win Rate: X%
```

## Relevant Repo Paths

| Path                                      | Role                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `packages/intelligence/src/`              | CLV, probability, calibration (pure math)                            |
| `apps/api/src/services/clv/`              | CLV engine (I/O-dependent)                                           |
| `apps/api/src/lib/verification/strategy/` | R5 strategy simulation                                               |
| `packages/mcp-intelligence/src/tools/`    | MCP tools: compute_clv, compute_calibration, run_strategy_simulation |
| `packages/mcp-state/src/tools/`           | MCP tool: query_picks                                                |

## Expected Output

- CLV edge table by promotion band
- Calibration metrics (Brier, ECE) if requested
- Strategy simulation results if requested
- Overall model health assessment
