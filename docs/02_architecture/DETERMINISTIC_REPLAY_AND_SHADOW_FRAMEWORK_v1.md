# Deterministic Replay and Shadow Framework

Version: 1.0 Status: Canonical Authority: Architecture Layer Sprint:
SPRINT-VERIFICATION-DOCS-GOVERNANCE-ALIGNMENT

This document defines the architecture and specification of the Deterministic
Replay Engine (R2) and Shadow Mode framework (R3) for the Unit Talk platform.

---

# 1. Overview

The Deterministic Replay and Shadow Framework provides two complementary
verification capabilities:

**Deterministic Replay** (R2 — COMPLETE): Replay a recorded event journal
through the pipeline twice and verify that both runs produce identical SHA-256
lifecycle trace hashes.

**Shadow Mode** (R3 — IN PROGRESS): Run the pipeline in parallel with production
on live data, with all side effects suppressed, and compare shadow outputs
against production state.

Both capabilities share the same adapter infrastructure and mode-safe pipeline
architecture.

---

# 2. Deterministic Replay Engine

## 2.1 Architecture

The replay engine processes a JSONL event journal through the full pick
lifecycle.

```
JournalEventStore (JSONL)
        │
        ▼
VirtualEventClock ← advances to each event timestamp
        │
        ▼
ReplayOrchestrator
        ├── Run 1: ReplayLifecycleRunner → LifecycleTraces → SHA-256 hash
        └── Run 2: ReplayLifecycleRunner → LifecycleTraces → SHA-256 hash
                                               │
                                               ▼
                                  DeterminismValidator.compare()
                                               │
                              ┌────────────────┴────────────────┐
                              │ PASS (hashes match)             │ FAIL (hashes differ)
                              ▼                                 ▼
                     ReplayProofWriter                  Error report + exit 1
                     out/replays/<run-id>/
```

## 2.2 Event Journal Format

Events are stored in JSONL format. Each line is one event:

```json
{"type":"PICK_SUBMITTED","timestamp":"2026-03-01T10:00:00Z","sequenceNumber":1,"payload":{...}}
{"type":"PICK_GRADED","timestamp":"2026-03-01T10:01:00Z","sequenceNumber":2,"payload":{...}}
{"type":"PICK_POSTED","timestamp":"2026-03-01T10:02:00Z","sequenceNumber":3,"payload":{...}}
{"type":"PICK_SETTLED","timestamp":"2026-03-01T10:05:00Z","sequenceNumber":4,"payload":{...}}
```

Valid `ReplayEventType` values:

- `PICK_SUBMITTED`
- `PICK_GRADED`
- `PICK_POSTED`
- `PICK_SETTLED`
- `RECAP_TRIGGERED`

## 2.3 Determinism Hash

After each replay run, the `ReplayOrchestrator` computes a SHA-256 hash of the
concatenated lifecycle traces, ordered by sequenceNumber.

The hash covers:

- event type
- event timestamp
- lifecycle role applied
- pick state after the operation
- any errors produced

If Run 1 hash equals Run 2 hash: determinism VERIFIED. If they differ:
nondeterministic behavior detected — replay FAIL.

## 2.4 Acceptance Gates

The CLI (`run-replay.ts`) evaluates 7 gates before reporting PASS:

| Gate | Description                                        |
| ---- | -------------------------------------------------- |
| G1   | Event journal loaded without error                 |
| G2   | Run 1 completed without unhandled errors           |
| G3   | Run 2 completed without unhandled errors           |
| G4   | Run 1 and Run 2 lifecycle trace counts match       |
| G5   | Run 1 and Run 2 SHA-256 hashes match               |
| G6   | All expected event types observed in correct order |
| G7   | Proof bundle written successfully to output path   |

Gate failure = FAIL, exit code 1.

## 2.5 Isolated Storage Guarantee

All replay runs use `IsolatedPickStore` — an in-memory pick store that never
interacts with Supabase. This is enforced by the `RunController`.

Any attempt to construct a replay run with a production database adapter is
rejected at initialization time with a hard error.

## 2.6 Recording Production Events

`ProductionEventRecorder` records production lifecycle events as they occur:

- `GradingSnapshot` — emitted after each grading operation
- `PostingSnapshot` — emitted after each Discord post
- `SettlementSnapshot` — emitted after each settlement

Recorded events are appended to a `JournalEventStore` with monotonic
sequenceNumbers. The resulting journal can be used as input to `run-replay.ts`.

---

# 3. Shadow Mode Framework

**Status: IN PROGRESS (R3)**

## 3.1 Purpose

Shadow mode runs the pipeline in parallel with production using live read data,
with all side effects suppressed. It compares shadow outputs against production
outputs to detect behavioral drift.

## 3.2 Foundation in Place (R1/R2)

The following shadow-mode infrastructure is already complete:

- `ExecutionMode = 'shadow'` defined in the mode enum
- `recording-publish.ts` — records publish attempts without Discord calls
- `null-notification.ts` — suppresses all operator notifications
- `recording-recap.ts` — records recap outputs without delivery
- `RunController` supports shadow mode validation

## 3.3 Remaining Work (R3)

- Shadow pipeline comparison engine: compare shadow lifecycle traces against
  production lifecycle traces for same event sequence
- Shadow run output diffing: detect and report behavioral differences
- Shadow mode operational runbook

## 3.4 Shadow Mode Governance Connection

Shadow mode readiness is a prerequisite before making stronger claims about
autopilot promotion safety. See `docs/ops/AUTOPILOT_ROLLOUT_RUNBOOK.md` for gate
requirements.

Until R3 is complete:

- Shadow mode infrastructure is available but not operationally validated
- Claims about shadow-mode canary safety cannot be made with verified evidence

---

# 4. Replay vs. Shadow — Comparison

| Property            | Replay (R2)                               | Shadow (R3)                                                    |
| ------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| Data source         | Recorded JSONL journal                    | Live Supabase (read-only)                                      |
| Clock               | VirtualEventClock                         | Wall clock                                                     |
| Side effects        | Fully suppressed                          | Fully suppressed                                               |
| Proof artifact      | `out/replays/<run-id>/`                   | TBD (R3 definition)                                            |
| What it proves      | Pipeline determinism over a fixed journal | Pipeline behavior matches production expectations in real-time |
| Provider dependency | None (no live provider needed)            | Reads production data (provider must be ACTIVE)                |
| Status              | COMPLETE                                  | IN PROGRESS                                                    |

---

# 5. What This Framework Does NOT Prove

- **Live provider truth**: Neither replay nor shadow mode verifies that external
  providers (SGO, OddsAPI) are reachable or returning valid data.
- **Scheduler truth**: Neither mode verifies that Temporal workflows fire at
  correct intervals.
- **Production delivery**: Suppressed side effects means no Discord posts,
  notifications, or webhooks are verified.

For provider truth status, see `docs/05_operations/observability_strategy.md`
Section 14.

---

# 6. Canonical References

| Document                         | Path                                                             |
| -------------------------------- | ---------------------------------------------------------------- |
| Master verification architecture | `docs/02_architecture/verification_architecture.md`              |
| Clock specification              | `docs/02_architecture/VIRTUAL_EVENT_CLOCK_SPEC_v1.md`            |
| Fault injection specification    | `docs/02_architecture/SCENARIO_AND_FAILURE_INJECTION_SPEC_v1.md` |
| Operational runbook              | `docs/ops/RUNBOOK_E2E_REPLAY_AND_SHADOW_v1.md`                   |
| Autopilot governance             | `docs/ops/AUTOPILOT_ROLLOUT_RUNBOOK.md`                          |
