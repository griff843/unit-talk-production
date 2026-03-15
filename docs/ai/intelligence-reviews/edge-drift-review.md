# Intelligence Review: Edge Drift

> **Purpose**: Detect CLV edge drift across books, bet types, and market
> segments. Run weekly or after any odds feed configuration change.
>
> **MCP Tool**: `compute_clv` (unit-talk-intelligence) **Math Note**: 2% vig
> approximation — directional for standard lines, less reliable for heavily
> juiced lines.

---

## Procedure

### Step 1: Gather CLV Samples

For each major book and bet type combination, call `compute_clv` with closing
odds:

```
Tool: compute_clv
Input: {
  "book_offers": [
    { "odds": <BOOK_A_ODDS>, "book_profile": "sharp" },
    { "odds": <BOOK_B_ODDS>, "book_profile": "recreational" }
  ],
  "devig_method": "additive",
  "closing_odds": <CLOSING_ODDS>
}
```

Minimum sample: 20 picks across at least 3 book profiles and 2 bet types.

Key output fields:

- `consensus_fair_prob` — consensus devigged probability
- `consensus_fair_odds` — fair odds implied by consensus
- `edge_pct` — edge vs closing line (positive = beating closing)
- `edge_positive` — boolean: are we beating closing?
- `clv_estimate` — estimated CLV value

### Step 2: Segment by Bet Type

Group CLV results by:

- Moneyline vs Spread vs Total
- Sport (NBA, NFL, MLB, NHL)
- Book profile (sharp vs recreational)

### Step 3: Compute Drift Metrics

For each segment, compare to prior week's baseline (if available in
`out/ai/reports/`):

```
edge_drift = current_avg_edge_pct - baseline_avg_edge_pct
```

**Thresholds**:

- `|edge_drift| < 0.005` → STABLE (no action)
- `0.005 ≤ |edge_drift| < 0.015` → WATCH (note, monitor next week)
- `|edge_drift| ≥ 0.015` → DRIFT (investigate root cause)
- `edge_positive rate < 50%` → ALERT (CLV degradation — escalate)

### Step 4: Report

```markdown
## Edge Drift Review — <date>

### Summary

- Picks sampled: N
- Avg edge (all): X.X%
- Avg edge (moneyline): X.X% | Spread: X.X% | Total: X.X%
- Edge-positive rate: X%

### Drift Assessment

| Segment                 | Avg Edge | vs Last Week | Status             |
| ----------------------- | -------- | ------------ | ------------------ |
| Moneyline — sharp books | X.X%     | +/-X.X%      | STABLE/WATCH/DRIFT |
| Spread — recreational   | X.X%     | +/-X.X%      | STABLE/WATCH/DRIFT |

### Verdict

STABLE — no action required WATCH — monitor <segment>; recheck next week DRIFT —
investigate <segment>; check odds feed config and book profile weights ALERT —
CLV degradation across all segments; escalate to sprint

### Root Cause Hypotheses (if DRIFT or ALERT)

1. <hypothesis>
2. <hypothesis>
```

---

## Escalation Path

| Verdict | Action                                                                  |
| ------- | ----------------------------------------------------------------------- |
| STABLE  | Archive report in `out/ai/reports/edge-drift-<date>.md`                 |
| WATCH   | Note in Linear or DRIFT_REPORT.md as LOW severity                       |
| DRIFT   | File DRIFT_REPORT.md item as MEDIUM; plan investigation sprint          |
| ALERT   | File DRIFT_REPORT.md item as HIGH/CRITICAL; schedule sprint immediately |

---

## Relevant Repo Paths

| Path                                           | Role                                           |
| ---------------------------------------------- | ---------------------------------------------- |
| `packages/mcp-intelligence/src/tools/index.ts` | `compute_clv` implementation                   |
| `packages/intelligence/src/clv/`               | CLV math engine                                |
| `docs/ops/SLO_DEFINITIONS.md`                  | SLO for `lifecycle_attainment` (CLV-dependent) |
| `out/ai/reports/`                              | Historical edge drift reports                  |
