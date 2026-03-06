# Intelligence Pipeline Sprint Order (Locked)

Status: LOCKED Last Updated: 2026-03-06 Owner: Unit Talk Architecture

This document defines the required sprint sequence for the intelligence
pipeline. Claude Code must follow this order unless explicitly overridden by a
new architecture decision and committed governance update.

---

## Completed Sprints

### SPRINT-031 — Model Separation

- Sharp consensus separation
- Signal-enhanced CLV forecast
- Model blending

### SPRINT-032 — Stat Projection Pipeline

- Projection modules
- Projection test suite
- Architecture documentation

### SPRINT-032A — Signal Math Corrections

- Z-score normalization
- Kelly math corrections

### SPRINT-033 — Market Reaction Layer

- Market reaction scoring
- Alpha evaluation integration

### SPRINT-034 — Outcome Tracking + Baseline ROI

- Outcome bridge
- Loss attribution classifier
- Baseline ROI reporting

### SPRINT-035 — Production Pick Selection Engine

- Edge filter
- Liquidity filter
- Market resistance evaluation
- Risk sizing
- Pick policy
- Promotion pipeline integration

---

## Next Sprint (LOCKED)

### SPRINT-036 — Promotion Band Calibration

Purpose: Determine the publication quality tier for each selected pick.

Responsibilities:

- Assign band tiers (A+, A, B, C)
- Apply uncertainty caps
- Apply CLV forecast adjustments
- Enforce liquidity/risk downgrade rules
- Emit deterministic suppression reasons when a pick must not be published

Core Modules:

- analysis/promotion/band-assignment.ts
- analysis/promotion/band-thresholds.ts
- analysis/promotion/band-downgrade-rules.ts

Outputs:

- band classification
- downgrade reasons
- suppression reasons

Acceptance Criteria:

- Every selected pick receives a deterministic band or suppression decision
- Thresholds are versioned and testable
- Band assignment is deterministic across runs
- No selected pick reaches publication without passing band logic
- Results are queryable by band for later ROI / CLV / calibration analysis

---

## Future Sprint Order (Locked)

### SPRINT-037 — Walk-Forward Evaluation Hardening

Formalize evaluation gates against the current model/selection/banding stack.

### SPRINT-038 — Daily Metrics + Drift Rollups

Add daily rollups for CLV, ROI, attribution, and drift by model/band/market.

### SPRINT-039 — Model Calibration Loop

Add governed calibration refinement loop using measured outcomes and drift
evidence.

---

## Governance Rule

Claude must not begin work on future market intelligence layers, dashboard
polish, or unrelated feature expansion until Promotion Band Calibration
(SPRINT-036) is complete, committed, and linked to Linear.

No sprint reordering is allowed without:

1. explicit architecture decision,
2. repo documentation update,
3. commit proving the change.
