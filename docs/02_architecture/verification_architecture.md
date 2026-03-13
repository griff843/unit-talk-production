# Verification & Simulation Control Plane — Architecture

Version: 1.0 Status: Canonical Authority: Architecture Layer Sprint:
SPRINT-VERIFICATION-DOCS-GOVERNANCE-ALIGNMENT

This document is the authoritative architecture reference for the Unit Talk
Verification & Simulation Control Plane.

It defines the purpose, components, execution modes, proof requirements, and
phased rollout for the verification subsystem.

---

# 1. Purpose

The Verification & Simulation Control Plane exists to prove that the Unit Talk
pipeline produces correct, deterministic behavior — without requiring live
provider uptime, wall-clock advancement, or production side effects.

This is not a test harness. It is **verification infrastructure**: a permanent
part of the platform architecture that enables truth-backed evolution of
scoring, promotion, settlement, and autopilot logic.

## 1.1 Why It Is Necessary

The Unit Talk pipeline processes time-sensitive data, makes consequential
promotion decisions, and delivers results to external channels (Discord). Manual
testing and CI unit tests alone cannot prove:

- that the pipeline behaves identically on replay as it did on first execution
- that changing a scoring rule does not cause nondeterministic promotion
  decisions
- that a model update does not silently break settlement logic
- that the pipeline handles provider failures without corrupting pick state

The Verification & Simulation Control Plane provides infrastructure to prove all
of these properties systematically and repeatably.

## 1.2 Core Principle: One Pipeline, Multiple Modes

The same pipeline code runs in every execution mode. Behavioral differences are
achieved exclusively through adapter injection — not by branching or duplicating
pipeline logic.

This principle ensures:

- verification runs test the same code as production runs
- a bug found in replay mode is a real bug in production
- adapter-level behavior can be verified independently of pipeline logic

---

# 2. Execution Modes

The `ExecutionMode` type governs adapter selection and side-effect routing:

```
production | replay | shadow | fault | simulation
```

| Mode         | Side Effects | Data Source               | Clock                     | Description                                      |
| ------------ | ------------ | ------------------------- | ------------------------- | ------------------------------------------------ |
| `production` | Full         | Live Supabase             | Wall clock                | Normal production operation                      |
| `replay`     | Suppressed   | JournalEventStore         | VirtualEventClock         | Deterministic replay from recorded event journal |
| `shadow`     | Suppressed   | Live Supabase (read)      | Wall clock                | Parallel execution alongside production          |
| `fault`      | Suppressed   | JournalEventStore or live | VirtualEventClock or wall | Controlled fault injection scenarios             |
| `simulation` | Suppressed   | Synthetic                 | VirtualEventClock         | Fully synthetic event stream                     |

The `RunController` validates that mode, clock provider, and adapter set are
compatible before any run begins. An invalid combination is rejected at
initialization time.

---

# 3. Component Inventory

## 3.1 Clock Abstraction

| Component           | File       | Status   | Description                                  |
| ------------------- | ---------- | -------- | -------------------------------------------- |
| `RealClockProvider` | `clock.ts` | COMPLETE | Returns `Date.now()` — used in production    |
| `VirtualEventClock` | `clock.ts` | COMPLETE | Advances monotonically from event timestamps |
| `resolveNow()`      | `clock.ts` | COMPLETE | Mode-aware clock resolution helper           |

The `VirtualEventClock` is initialized at the timestamp of the first event in
the journal. It advances to each subsequent event timestamp before dispatching
that event. This eliminates wall-clock dependency from replay runs.

## 3.2 Adapter Contracts

| Adapter Interface     | File          | Production Implementation        | Non-Production Implementation                       |
| --------------------- | ------------- | -------------------------------- | --------------------------------------------------- |
| `PublishAdapter`      | `adapters.ts` | Discord publishing               | `recording-publish.ts` — records without posting    |
| `NotificationAdapter` | `adapters.ts` | Operator alert delivery          | `null-notification.ts` — suppresses all alerts      |
| `FeedAdapter`         | `adapters.ts` | Live provider_offers queries     | `replay-feed.ts` — reads from JournalEventStore     |
| `SettlementAdapter`   | `adapters.ts` | Live Supabase settlement records | `replay-settlement.ts` — returns historical records |
| `RecapAdapter`        | `adapters.ts` | Live recap delivery              | `null-recap.ts` / `recording-recap.ts`              |

The `assertManifestConsistency()` function validates that all adapters in a
given run agree on their execution mode. A manifest inconsistency (e.g., a
production publish adapter paired with a replay feed adapter) is a hard error.

## 3.3 Event Store

| Component           | File             | Status   | Description                            |
| ------------------- | ---------------- | -------- | -------------------------------------- |
| `JournalEventStore` | `event-store.ts` | COMPLETE | JSONL-backed append-only event journal |

Event types recorded:

- `PICK_SUBMITTED`
- `PICK_GRADED`
- `PICK_POSTED`
- `PICK_SETTLED`
- `RECAP_TRIGGERED`

Each event contains: `type`, `timestamp`, `sequenceNumber`, `payload`.

## 3.4 Isolated Storage

| Component           | File                     | Status   | Description                                  |
| ------------------- | ------------------------ | -------- | -------------------------------------------- |
| `IsolatedPickStore` | `isolated-pick-store.ts` | COMPLETE | In-memory pick store; never touches Supabase |

The `IsolatedPickStore` implements the same interface as lifecycle adapters.
During replay, all pick mutations go to `IsolatedPickStore`. This ensures that
replay runs cannot write to or read from production data.

## 3.5 Replay Engine

| Component                 | File                           | Status   | Description                                                |
| ------------------------- | ------------------------------ | -------- | ---------------------------------------------------------- |
| `ReplayOrchestrator`      | `replay-orchestrator.ts`       | COMPLETE | Runs two independent replays; collects `determinismHash`   |
| `ReplayLifecycleRunner`   | `replay-lifecycle-runner.ts`   | COMPLETE | Executes lifecycle ops; produces `LifecycleTrace` records  |
| `DeterminismValidator`    | `determinism-validator.ts`     | COMPLETE | Compares Run 1 and Run 2 SHA-256 hashes                    |
| `ProductionEventRecorder` | `production-event-recorder.ts` | COMPLETE | Records production events to `JournalEventStore`           |
| `ReplayProofWriter`       | `replay-proof-writer.ts`       | COMPLETE | Writes proof bundle to `out/replays/<run-id>/<timestamp>/` |
| `RunController`           | `run-controller.ts`            | COMPLETE | Validates mode + clock + adapter compatibility             |

## 3.6 CLI Entry Point

```
apps/api/src/scripts/run-replay.ts
```

Usage:

```bash
pnpm replay:run --fixture
pnpm replay:run --store=<path-to-events.jsonl>
pnpm replay:run --store=<path> --from=<iso> --to=<iso> --run-id=<id> --out=<dir>
```

Exit codes:

- `0` — PASS (determinism verified, all acceptance gates passed)
- `1` — FAIL (nondeterminism detected or acceptance gates failed)

---

# 4. Phased Rollout

## R1 — Foundation (COMPLETE)

Deliverables:

- `ExecutionMode` type definition
- `VirtualEventClock` and `RealClockProvider`
- All adapter interface contracts
- `RunController` with mode/clock/adapter validation
- `assertManifestConsistency()` manifold guard
- All non-production adapter implementations

Evidence: Sprint `SPRINT-VERIFICATION-SIMULATION-LAYER-R1`

## R2 — Deterministic Replay Engine (COMPLETE)

Deliverables:

- `JournalEventStore` — JSONL-backed append-only event store
- `IsolatedPickStore` — no-production-DB in-memory pick store
- `ReplayOrchestrator` — dual-run replay with determinism hash collection
- `DeterminismValidator` — SHA-256 comparison between runs
- `ProductionEventRecorder` — records grading, posting, settlement snapshots
- `ReplayProofWriter` — generates proof bundles
- CLI `run-replay.ts` — full replay pipeline with 7 acceptance gates
- Test fixture: `test-fixtures/demo-events.jsonl`

Evidence: Sprint `SPRINT-VERIFICATION-SIMULATION-LAYER-R2`

## R3 — Shadow Mode (IN PROGRESS)

Objective: Run the pipeline in parallel with production. Compare pipeline
outputs against live production. Suppress all side effects.

Foundation already in place:

- `ExecutionMode = 'shadow'` defined
- `recording-publish.ts`, `null-notification.ts`, `recording-recap.ts` ready

Still in progress:

- Full shadow pipeline comparison engine
- Shadow run output diffing against production state
- Shadow run lifecycle trace comparison

This phase is a prerequisite for claiming shadow-mode canary safety.

## R4 — Fault Injection (IN PROGRESS)

Objective: Inject controlled failures into the pipeline during replay to verify
fail-closed behavior, freeze rules, and error handling.

Foundation already in place:

- `ExecutionMode = 'fault'` defined
- Adapter layer supports fault-mode routing

Still in progress:

- Fault scenario injection API
- Failure scenario library (provider timeout, DB write failure, clock skew,
  etc.)
- Fault run proof bundle structure

This phase is a prerequisite for validating AUTOPILOT_FREEZE_MATRIX behavior.

## R5 — Execution Simulation (DEFERRED)

Objective: Run the pipeline against fully synthetic event streams. Enable
strategy evaluation without production data.

Status: Mode `simulation` is defined in `ExecutionMode`. No simulation
infrastructure has been implemented.

This phase is deferred pending R3 and R4 completion.

---

# 5. Proof Bundle Specification

Every non-production run generates a proof bundle.

Location: `out/replays/<run-id>/<timestamp>/`

Contents:

| File                     | Description                                           |
| ------------------------ | ----------------------------------------------------- |
| `events.jsonl`           | Full event journal used in this run                   |
| `lifecycle-traces.jsonl` | Per-event lifecycle trace with role, pick state       |
| `clock-log.jsonl`        | VirtualEventClock advancement record                  |
| `errors.jsonl`           | Any errors encountered during the run                 |
| `summary.json`           | Run 1 hash, Run 2 hash, determinism verdict, metadata |

## Acceptance Gates (R2 Replay)

The CLI evaluates 7 acceptance gates:

1. Event journal loaded successfully
2. Run 1 completed without errors
3. Run 2 completed without errors
4. Run 1 and Run 2 lifecycle trace counts match
5. Run 1 and Run 2 SHA-256 hashes match
6. All expected lifecycle event types observed
7. Proof bundle written to output directory

---

# 6. Truth Lane Separation

Proof bundles from replay, shadow, and fault modes prove **pipeline truth**
only.

| Truth Lane      | What It Covers                                        | Verified By                            |
| --------------- | ----------------------------------------------------- | -------------------------------------- |
| Pipeline truth  | Lifecycle logic determinism and correctness           | Replay proof bundles, vitest           |
| Scheduler truth | Temporal workflows fire at correct intervals          | Temporal logs, scheduler health        |
| Provider truth  | External providers reachable and returning valid data | FeedAgent metrics, ingestion freshness |

These are independent lanes. A PASS in replay mode does not imply ACTIVE
provider status. See `docs/05_operations/observability_strategy.md` Section 14
for provider truth status definitions (ACTIVE / DEGRADED / BLOCKED_UPSTREAM).

---

# 7. Governance Connections

## Shadow Mode → Autopilot Governance

Shadow mode readiness (R3 complete) is a prerequisite before claiming stronger
autopilot safety in CANARY or PROD modes. The AUTOPILOT_ROLLOUT_RUNBOOK
documents gate requirements for autopilot promotion. Shadow mode provides the
verification substrate those gates depend on.

## Fault Injection → Freeze Rule Validation

Fault injection (R4 complete) enables verification of the
AUTOPILOT_FREEZE_MATRIX behavior under controlled failure conditions. This is
necessary to confirm that freeze rules activate correctly under real failure
scenarios, not only in theory.

## Replay → Walk-Forward Evaluation

The deterministic replay engine (R2 complete) is the evaluation substrate for
model and scoring rule walk-forward evaluation. Changes to scoring logic can be
validated by replaying historical event journals and comparing lifecycle traces
against baseline.

---

# Summary

The Verification & Simulation Control Plane provides the following capabilities:

| Capability                   | Phase | Status      |
| ---------------------------- | ----- | ----------- |
| Mode-safe pipeline execution | R1    | COMPLETE    |
| Deterministic replay         | R2    | COMPLETE    |
| Proof bundle generation      | R2    | COMPLETE    |
| Shadow mode                  | R3    | IN PROGRESS |
| Fault injection              | R4    | IN PROGRESS |
| Execution simulation         | R5    | DEFERRED    |

Canonical doc set:

- `docs/02_architecture/verification_architecture.md` (this document)
- `docs/02_architecture/DETERMINISTIC_REPLAY_AND_SHADOW_FRAMEWORK_v1.md`
- `docs/02_architecture/VIRTUAL_EVENT_CLOCK_SPEC_v1.md`
- `docs/02_architecture/SCENARIO_AND_FAILURE_INJECTION_SPEC_v1.md`
- `docs/02_architecture/EXECUTION_SIMULATION_SPEC_v1.md`
- `docs/ops/RUNBOOK_E2E_REPLAY_AND_SHADOW_v1.md`
