# Execution Simulation — Specification

Version: 1.0 Status: Canonical Authority: Architecture Layer Phase: R5 —
DEFERRED Sprint: SPRINT-VERIFICATION-DOCS-GOVERNANCE-ALIGNMENT

This document defines the intended architecture for the Execution Simulation
capability (R5) of the Unit Talk Verification & Simulation Control Plane.

**Current implementation status: NOT STARTED.**

The `simulation` execution mode is defined in the `ExecutionMode` type, but no
simulation infrastructure has been implemented. This document describes the
design intent so that R5 implementation can begin with a clear specification.

---

# 1. Purpose

Execution simulation enables the pipeline to run against fully synthetic event
streams — no production data, no live providers, no recorded events required.

This enables:

- strategy evaluation against constructed market scenarios
- regression testing of scoring models without historical data requirements
- walk-forward evaluation of new scoring rules before production deployment
- offline analysis of pipeline behavior under hypothetical market conditions

---

# 2. Relationship to R2 Replay

Execution simulation is not a replacement for deterministic replay. They serve
different purposes:

| Property     | Replay (R2)                       | Simulation (R5)                         |
| ------------ | --------------------------------- | --------------------------------------- |
| Data source  | Recorded production event journal | Synthetic event generator               |
| Purpose      | Verify pipeline determinism       | Evaluate strategy under new scenarios   |
| Clock        | VirtualEventClock (from journal)  | VirtualEventClock (from synthetic data) |
| Side effects | Suppressed                        | Suppressed                              |
| Status       | COMPLETE                          | DEFERRED                                |

---

# 3. Design Intent

## 3.1 Synthetic Event Generator

The simulation layer requires a synthetic event generator that can produce
well-formed `ReplayEvent` streams without requiring real production data.

Inputs to the generator:

- sport and market type parameters
- synthetic odds and edge values
- simulated grading outcome distributions
- configurable time windows

Output: a JSONL event journal compatible with `JournalEventStore`.

## 3.2 Strategy Evaluation Harness

The simulation harness runs the pipeline against synthetic scenarios and
collects:

- lifecycle traces (same format as R2 replay)
- promotion decision outcomes
- settlement outcome distributions
- portfolio-level metrics (win rate, ROI, drawdown)

Results are stored in a proof bundle in `out/simulations/<scenario-id>/`.

## 3.3 Walk-Forward Evaluation Connection

Simulation is the execution substrate for walk-forward model evaluation:

1. Generate a synthetic time-series of events representing historical market
   conditions
2. Run the pipeline against this synthetic history using a proposed scoring
   model
3. Collect outcome metrics
4. Compare against baseline model metrics

This enables A/B comparison of scoring models without production deployment.

---

# 4. Prerequisites

R5 cannot begin until:

1. R3 (Shadow Mode) is complete — shadow mode establishes the comparison
   infrastructure that simulation evaluation will reuse.
2. R4 (Fault Injection) is complete — fault injection scenarios provide
   templates for failure cases that simulation must handle.

---

# 5. What Simulation Does NOT Prove

- Simulation does not prove that the pipeline handles real market data
  correctly.
- Simulation does not prove live provider connectivity.
- Simulation does not validate scheduler behavior.
- Synthetic scenarios are only as realistic as the scenario design. A simulation
  PASS does not guarantee production correctness.

---

# 6. Canonical References

| Document                         | Path                                                                   |
| -------------------------------- | ---------------------------------------------------------------------- |
| Master verification architecture | `docs/02_architecture/verification_architecture.md`                    |
| Replay framework                 | `docs/02_architecture/DETERMINISTIC_REPLAY_AND_SHADOW_FRAMEWORK_v1.md` |
| Fault injection                  | `docs/02_architecture/SCENARIO_AND_FAILURE_INJECTION_SPEC_v1.md`       |
| Analytics roadmap                | `docs/analytics/ANALYTICS_ROADMAP_v4.md`                               |
| Model training roadmap           | `docs/analytics/MODEL_TRAINING_ROADMAP_v5.md`                          |
