# Intelligence Review: Model Calibration

> **Purpose**: Audit the prediction model's calibration — whether predicted
> probabilities match actual outcomes. Run weekly or after any grading pipeline
> change.
>
> **MCP Tool**: `compute_calibration` (unit-talk-intelligence) **Minimum
> sample**: 10 predictions required for calibration to be meaningful. **Output
> statuses**: `CALIBRATED` | `DRIFT` | `MISCALIBRATED`

---

## Calibration Thresholds

From `packages/mcp-intelligence/src/adapters/`:

| Status          | ECE Threshold    | Brier Score Threshold | Meaning                                                 |
| --------------- | ---------------- | --------------------- | ------------------------------------------------------- |
| `CALIBRATED`    | < 0.05           | < 0.25                | Model is well-calibrated — probabilities match outcomes |
| `DRIFT`         | < 0.10           | < 0.30                | Mild miscalibration — monitor, investigate if sustained |
| `MISCALIBRATED` | ≥ 0.10 or ≥ 0.30 | either                | Significant miscalibration — action required            |

**ECE** = Expected Calibration Error (0 = perfect, 1 = worst) **Brier Score** =
Mean squared error of probability predictions (0 = perfect, 1 = worst) **Log
Loss** = Cross-entropy loss (lower = better calibrated)

---

## Procedure

### Step 1: Gather Settled Picks with Predictions

Collect settled picks that have both:

- `predicted_prob`: the model's probability estimate at time of grading
- `actual_outcome`: 1 (win) or 0 (loss) from settlement

Minimum: 10 picks. Recommended: 50+ for statistical reliability.

### Step 2: Run Calibration Computation

```
Tool: compute_calibration
Input: {
  "predictions": [
    { "predicted_prob": 0.62, "actual_outcome": 1 },
    { "predicted_prob": 0.55, "actual_outcome": 0 },
    ...
  ],
  "bucket_width": 0.1
}
```

Key output fields:

- `brier_score` — overall prediction accuracy
- `log_loss` — calibration quality
- `ece` — expected calibration error
- `mce` — maximum calibration error (worst bucket)
- `n_predictions` — sample size
- `status` — CALIBRATED / DRIFT / MISCALIBRATED

### Step 3: Segment Analysis (if n ≥ 30)

Run `compute_calibration` separately for:

- Moneyline vs Spread vs Total
- By sport (NBA, NFL, MLB, NHL)
- By promotion band (if available: SOFT, MEDIUM, HARD)

Segmented results reveal whether miscalibration is systemic or isolated.

### Step 4: Compare to Prior Week

From prior report in `out/ai/reports/calibration-<date>.md`:

```
ece_drift = current_ece - prior_ece
brier_drift = current_brier - prior_brier
```

**Drift thresholds**:

- `ece_drift > +0.02` → calibration is getting worse — investigate
- `brier_drift > +0.02` → prediction accuracy degrading — investigate

### Step 5: Correlate with Edge Drift

If both calibration DRIFT and edge DRIFT are detected simultaneously, the likely
cause is a shared upstream issue: odds feed quality, devig method accuracy, or
closing line selection. Correlate with `edge-drift-review.md`.

### Step 6: Report

```markdown
## Model Calibration Check — <date>

### Sample

- Picks evaluated: N
- Date range: YYYY-MM-DD to YYYY-MM-DD
- Settled and having predicted_prob: N

### Overall Calibration

| Metric      | Value | vs Last Week | Threshold                            |
| ----------- | ----- | ------------ | ------------------------------------ |
| ECE         | X.XXX | +/-X.XXX     | < 0.05 (CALIBRATED) / < 0.10 (DRIFT) |
| MCE         | X.XXX | +/-X.XXX     | —                                    |
| Brier Score | X.XXX | +/-X.XXX     | < 0.25 (CALIBRATED) / < 0.30 (DRIFT) |
| Log Loss    | X.XXX | +/-X.XXX     | —                                    |

### Status: CALIBRATED / DRIFT / MISCALIBRATED

### Segmented Results (if available)

| Segment   | ECE   | Brier | Status                         |
| --------- | ----- | ----- | ------------------------------ |
| Moneyline | X.XXX | X.XXX | CALIBRATED/DRIFT/MISCALIBRATED |
| Spread    | X.XXX | X.XXX | CALIBRATED/DRIFT/MISCALIBRATED |
| NBA       | X.XXX | X.XXX | CALIBRATED/DRIFT/MISCALIBRATED |

### Drift Analysis

- ECE trend vs prior week: +/-X.XXX (IMPROVING/STABLE/DEGRADING)
- Correlated edge drift: YES / NO (see edge-drift-review-<date>.md)

### Root Cause Hypotheses (if DRIFT or MISCALIBRATED)

1. <hypothesis>
2. <hypothesis>

### Verdict

CALIBRATED — no action required DRIFT — monitor; recheck next week; compare to
edge drift report MISCALIBRATED — escalate: file DRIFT_REPORT.md item; plan
calibration investigation sprint
```

---

## Escalation Path

| Status        | Action                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| CALIBRATED    | Archive report in `out/ai/reports/calibration-<date>.md`                |
| DRIFT         | Note in DRIFT_REPORT.md as LOW/MEDIUM; monitor for 2 consecutive weeks  |
| MISCALIBRATED | File DRIFT_REPORT.md as HIGH; create calibration fix sprint immediately |

---

## Relevant Repo Paths

| Path                                           | Role                                            |
| ---------------------------------------------- | ----------------------------------------------- |
| `packages/mcp-intelligence/src/tools/index.ts` | `compute_calibration` implementation            |
| `packages/intelligence/src/calibration/`       | Calibration math engine                         |
| `packages/intelligence/src/clv/`               | CLV engine (correlated with calibration)        |
| `.claude/skills/edge-check.md`                 | MCP skill for operator-facing calibration check |
| `out/ai/reports/`                              | Historical calibration reports                  |
| `apps/api/src/agents/GradingAgent.ts`          | Where predicted_prob is set on picks            |
