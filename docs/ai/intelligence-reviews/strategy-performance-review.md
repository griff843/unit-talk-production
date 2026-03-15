# Intelligence Review: Strategy Performance

> **Purpose**: Evaluate betting strategy performance — Kelly vs flat unit
> sizing, ROI trends, drawdown analysis. Run weekly or after any bankroll
> configuration change.
>
> **CLI**: `pnpm strategy:simulate` and `pnpm strategy:compare` **Script**:
> `apps/api/src/scripts/run-strategy.ts` **Predefined strategies**: `flat-unit`,
> `flat-unit-friction`, `kelly-025`, `kelly-010`

---

## Procedure

### Step 1: Run Strategy Simulation

```bash
# Simulate all predefined strategies against recent pick history
SUPABASE_URL=http://localhost:54321 SUPABASE_SERVICE_ROLE_KEY=test-key \
  pnpm strategy:simulate

# Compare two strategies head-to-head
SUPABASE_URL=http://localhost:54321 SUPABASE_SERVICE_ROLE_KEY=test-key \
  pnpm strategy:compare --strategy-a kelly-025 --strategy-b flat-unit
```

Proof artifacts: `out/strategy-runs/<strategyId>/<date>/`

For live production: replace dummy env vars with actual Supabase credentials.

### Step 2: Extract Key Metrics

From simulation output, record per strategy:

| Metric              | Description                        |
| ------------------- | ---------------------------------- |
| `roi_pct`           | Return on investment (%)           |
| `win_rate`          | Win rate (%)                       |
| `avg_edge`          | Average CLV edge captured (%)      |
| `max_drawdown_pct`  | Maximum drawdown from peak (%)     |
| `sharpe_ratio`      | Risk-adjusted return (if computed) |
| `total_units`       | Total units wagered                |
| `net_units`         | Net profit in units                |
| `periods_evaluated` | Number of time windows evaluated   |

### Step 3: Compare Against Baselines

Compare current metrics to:

- Prior week's report (from `out/ai/reports/strategy-perf-<prior-date>.md`)
- Target thresholds (set by risk policy):
  - `roi_pct > 0` — minimum viability
  - `max_drawdown_pct < 15%` — risk policy limit
  - `kelly-025` should outperform `flat-unit` over 20+ picks

### Step 4: Bankroll Risk Check

From the risk engine (`apps/api/src/lib/risk/`):

- Are Kelly fractions within expected range?
- Any market-type exposure cap violations?
- Any BLOCKED picks due to exposure limit breaches?

Check `get_pipeline_status` for BLOCKED picks or stale outbox (may indicate risk
engine blocking posting).

### Step 5: Report

```markdown
## Strategy Performance Review — <date>

### Simulation Window

- Picks evaluated: N
- Date range: YYYY-MM-DD to YYYY-MM-DD
- Strategies compared: flat-unit, flat-unit-friction, kelly-025, kelly-010

### Results

| Strategy  | ROI  | Win Rate | Avg Edge | Max Drawdown | Net Units |
| --------- | ---- | -------- | -------- | ------------ | --------- |
| flat-unit | X.X% | X%       | X.X%     | -X.X%        | +/-X      |
| kelly-025 | X.X% | X%       | X.X%     | -X.X%        | +/-X      |
| kelly-010 | X.X% | X%       | X.X%     | -X.X%        | +/-X      |

### vs Prior Week

| Strategy  | ROI Δ   | Drawdown Δ | Trend                      |
| --------- | ------- | ---------- | -------------------------- |
| flat-unit | +/-X.X% | +/-X.X%    | IMPROVING/STABLE/DEGRADING |
| kelly-025 | +/-X.X% | +/-X.X%    | IMPROVING/STABLE/DEGRADING |

### Risk Policy Compliance

- Max drawdown within policy (< 15%): YES / NO
- Exposure caps honored: YES / NO / UNKNOWN
- BLOCKED picks due to risk engine: N

### Verdict

PASS — all strategies within acceptable parameters WATCH — <strategy> showing
<issue>; monitor next week INVESTIGATE — <strategy> below viability threshold;
check CLV inputs and market mix FAIL — policy violation: <what>; immediate
remediation required

### Recommended Action

<one sentence>
```

---

## Escalation Path

| Verdict     | Action                                                       |
| ----------- | ------------------------------------------------------------ |
| PASS        | Archive report in `out/ai/reports/strategy-perf-<date>.md`   |
| WATCH       | Note in Linear or DRIFT_REPORT.md as LOW/MEDIUM              |
| INVESTIGATE | File DRIFT_REPORT.md item as MEDIUM; check edge-drift-review |
| FAIL        | File DRIFT_REPORT.md as HIGH; create remediation sprint      |

---

## Relevant Repo Paths

| Path                                           | Role                                |
| ---------------------------------------------- | ----------------------------------- |
| `apps/api/src/lib/verification/strategy/`      | R5 strategy evaluation engine       |
| `apps/api/src/scripts/run-strategy.ts`         | CLI entry point                     |
| `apps/api/src/lib/risk/`                       | Kelly sizing, exposure caps         |
| `out/strategy-runs/`                           | Strategy simulation proof artifacts |
| `apps/api/src/lib/verification/test-fixtures/` | Demo fixtures for testing           |
