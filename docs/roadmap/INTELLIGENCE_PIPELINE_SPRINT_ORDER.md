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

### SPRINT-036 — Promotion Band Calibration

- Band assignment (A+/A/B/C/SUPPRESS)
- Band thresholds (versioned)
- Band downgrade rules (uncertainty, CLV, liquidity, resistance, risk)
- 49 unit tests

### SPRINT-037 — Walk-Forward Evaluation Hardening

- Band evaluation (CLV, ROI, calibration by band)
- Downgrade effectiveness analysis
- Regime stability (CV-based window analysis)
- 26 unit tests

### SPRINT-038 — Daily Metrics + Drift Rollups

- Daily rollup composition (band metrics + downgrade counts + attribution)
- Drift detector (6 categories: ROI, CLV, calibration, distribution,
  suppression, attribution)
- Warning/critical severity thresholds
- 24 unit tests

### SPRINT-039 — Model Calibration Loop

- Calibration engine (Platt scaling, histogram, identity methods)
- Calibration analysis (Brier, log loss, ECE, reliability curves)
- Pre/post calibration comparison with band-level breakdown
- Versioned calibration profiles with deterministic transforms
- 29 unit tests

---

## Next Sprint (LOCKED)

### SPRINT-040 — TBD

Next intelligence pipeline sprint to be defined.

---

## Cross-Reference

Architecture migration sprints (infrastructure/pipeline track) run in parallel
with intelligence pipeline sprints:

- **Roadmap**: `docs/roadmap/ARCHITECTURE_MIGRATION_SPRINT_ORDER.md`
- **Gap analysis**: `docs/system/analysis/system-gap-analysis.md`
- **Sprints 044A–044E**: Close 14 gaps between current and target architecture

These tracks are independent but share dependencies:

- Intelligence sprint work (scoring, CLV) depends on provider_offers being
  populated (SPRINT-044B) and scoring migration (SPRINT-044D)
- UNI-11, UNI-12, UNI-16 are blocked by architecture migration sprints

---

## Governance Rule

Claude must not begin work on future market intelligence layers, dashboard
polish, or unrelated feature expansion until the current locked sprint is
complete, committed, and linked to Linear.

No sprint reordering is allowed without:

1. explicit architecture decision,
2. repo documentation update,
3. commit proving the change.
