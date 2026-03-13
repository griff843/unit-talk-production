# Runbook: End-to-End Replay and Shadow Verification

Version: 1.0 Status: Canonical Authority: Operations Layer Sprint:
SPRINT-VERIFICATION-DOCS-GOVERNANCE-ALIGNMENT

This runbook documents operational procedures for running deterministic replay
verification (R2 — COMPLETE) and shadow mode verification (R3 — COMPLETE).

---

# 1. Overview

The Verification & Simulation Control Plane provides two operational
verification modes:

| Mode   | Purpose                                         | Status      |
| ------ | ----------------------------------------------- | ----------- |
| Replay | Prove pipeline determinism from recorded events | OPERATIONAL |
| Shadow | Verify pipeline parity alongside production     | OPERATIONAL |

Use this runbook to:

- run a deterministic replay against a recorded event journal
- interpret replay pass/fail results
- record production events for future replay
- run shadow mode guardrail verification

---

# 2. Prerequisites

```bash
# Ensure pnpm dependencies are installed
pnpm install

# Ensure API package is built
pnpm --filter unit-talk-platform run build

# Confirm replay CLI is available
node apps/api/dist/scripts/run-replay.js --help
```

---

# 3. Replay Procedures

## 3.1 Run Replay Against Demo Fixture

The test fixture ships with the codebase and is always available:

```bash
cd apps/api
pnpm replay:run --fixture
```

Expected output on success:

```
[REPLAY] Loading event journal from fixture...
[REPLAY] Loaded N events
[REPLAY] Run 1: Starting replay...
[REPLAY] Run 1: Complete. Hash: <sha256>
[REPLAY] Run 2: Starting replay...
[REPLAY] Run 2: Complete. Hash: <sha256>
[DETERMINISM] Run 1 hash: <sha256>
[DETERMINISM] Run 2 hash: <sha256>
[DETERMINISM] PASS - hashes match
[PROOF] Bundle written to out/replays/<run-id>/<timestamp>/
[GATES] All 7 acceptance gates: PASS
EXIT 0
```

## 3.2 Run Replay Against a Recorded Journal

```bash
cd apps/api
pnpm replay:run --store=<path-to-events.jsonl>
```

Optional flags:

- `--from=<iso-timestamp>` — replay only events at or after this time
- `--to=<iso-timestamp>` — replay only events before or at this time
- `--run-id=<id>` — custom run ID for proof bundle naming
- `--out=<directory>` — custom proof bundle output directory

## 3.3 Interpret Replay Results

### PASS (exit 0)

All 7 acceptance gates passed. The proof bundle at
`out/replays/<run-id>/<timestamp>/` confirms:

- Pipeline is deterministic over this event journal
- Lifecycle traces are consistent between Run 1 and Run 2
- No unhandled errors during either run

### FAIL (exit 1)

Check the proof bundle `errors.jsonl` and `summary.json` for details.

Common causes:

| Symptom                               | Likely Cause                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| Hash mismatch between Run 1 and Run 2 | Nondeterministic behavior — `Date.now()` called directly instead of via clock |
| Error in `errors.jsonl`               | Lifecycle operation failed — check event payload and adapter state            |
| Trace count mismatch                  | Event journal has inconsistent event sequence — check event store integrity   |
| Proof bundle not written              | Filesystem permission issue or invalid output path                            |

## 3.4 Recording Production Events

To capture a production event journal for future replay:

```typescript
import { ProductionEventRecorder } from '../lib/verification/production-event-recorder';
import { JournalEventStore } from '../lib/verification/event-store';

const store = new JournalEventStore({
  persistToPath: 'out/journals/prod.jsonl',
});
const recorder = new ProductionEventRecorder(store);

// Call after each production lifecycle event:
await recorder.recordGrading(gradingSnapshot);
await recorder.recordPosting(postingSnapshot);
await recorder.recordSettlement(settlementSnapshot);
```

The resulting JSONL file at `out/journals/prod.jsonl` can be used as input to
`pnpm replay:run --store=out/journals/prod.jsonl`.

---

# 4. Proof Bundle Reference

After each replay run, the proof bundle is written to:

```
out/replays/<run-id>/<timestamp>/
├── events.jsonl              # event journal used in this run
├── lifecycle-traces.jsonl    # per-event lifecycle trace
├── clock-log.jsonl           # VirtualEventClock advancement record
├── errors.jsonl              # any errors encountered (empty = clean run)
└── summary.json              # run metadata and determinism result
```

### Reading summary.json

```json
{
  "runId": "...",
  "timestamp": "2026-03-13T10:00:00Z",
  "eventCount": 4,
  "run1Hash": "abc123...",
  "run2Hash": "abc123...",
  "determinism": "PASS",
  "gateResults": {
    "G1": "PASS",
    "G2": "PASS",
    "G3": "PASS",
    "G4": "PASS",
    "G5": "PASS",
    "G6": "PASS",
    "G7": "PASS"
  }
}
```

---

# 5. Shadow Mode Procedures

**Status: OPERATIONAL (R3 — COMPLETE)** **Verified by**:
SPRINT-VERIFICATION-SHADOW-DIVERGENCE-GUARDRAILS

## 5.1 Shadow Guardrail Runner

The shadow guardrail runner executes a shadow comparison run and emits a PASS /
PASS_WITH_WARNINGS / FAIL verdict.

```bash
node scripts/run-shadow-guardrails.ts
```

The runner is located at `apps/api/src/scripts/run-shadow-guardrails.ts`.

## 5.2 Expected Output — PASS

When no divergences are detected:

```
[SHADOW] Starting shadow guardrail run...
[SHADOW] Comparator: 0 divergences detected
[SHADOW] Verdict: PASS
[PROOF] Bundle written to out/shadow-runs/<run-id>/
EXIT 0
```

## 5.3 Expected Output — FAIL

When critical divergences are detected:

```
[SHADOW] Starting shadow guardrail run...
[SHADOW] Comparator: 3 divergences detected (1 CRITICAL, 2 HIGH)
[SHADOW] Critical divergence alert captured
[SHADOW] Verdict: FAIL
[PROOF] Bundle written to out/shadow-runs/<run-id>/
EXIT 1
```

A FAIL verdict indicates the shadow pipeline produced results that diverge from
production behavior at a CRITICAL or HIGH severity level. Investigate the proof
bundle before proceeding with any autopilot canary activation.

## 5.4 Divergence Severity Levels

| Severity | Meaning                                               |
| -------- | ----------------------------------------------------- |
| CRITICAL | Pipeline output is materially wrong; blocks promotion |
| HIGH     | Significant behavioral difference; requires review    |
| LOW      | Minor difference; advisory only                       |

## 5.5 Proof Bundle Location

After each shadow run, the proof bundle is written to:

```
out/shadow-runs/<run-id>/
```

The bundle contains the divergence report, verdict, and run metadata.

## 5.6 Interpreting Shadow Divergence Reports

- A PASS verdict confirms shadow pipeline parity for the tested event sequence.
- A PASS_WITH_WARNINGS verdict indicates LOW-severity divergences only; pipeline
  is functionally consistent.
- A FAIL verdict indicates CRITICAL or HIGH divergences; do not proceed with
  canary activation until root cause is identified and resolved.

---

# 6. Fault Injection Procedures

**Status: IN PROGRESS (R4)**

Fault injection procedures will be documented here when R4 is complete.

Current status:

- Fault mode adapter infrastructure is in place
- Fault scenario library is not yet implemented
- No operational fault injection procedure is available

When R4 is complete, this section will document:

- How to define and run a fault scenario
- How to read fault run proof bundles
- How to interpret fail-closed behavior evidence

---

# 7. Truth Lane Reminder

Replay and shadow proof bundles prove **pipeline truth** only.

They do not prove:

- that external providers are ACTIVE
- that the scheduler fires at correct intervals
- that Discord posts were delivered

For provider truth status, check:

- `docs/system/current/grading-data-source-status.md`
- `docs/system/current/ingestion-freshness-policy.md`

Use the required provider truth status labels: `ACTIVE` / `DEGRADED` /
`BLOCKED_UPSTREAM`.

---

# 8. Canonical References

| Document                         | Path                                                                   |
| -------------------------------- | ---------------------------------------------------------------------- |
| Master verification architecture | `docs/02_architecture/verification_architecture.md`                    |
| Replay & shadow framework        | `docs/02_architecture/DETERMINISTIC_REPLAY_AND_SHADOW_FRAMEWORK_v1.md` |
| Virtual event clock              | `docs/02_architecture/VIRTUAL_EVENT_CLOCK_SPEC_v1.md`                  |
| Fault injection                  | `docs/02_architecture/SCENARIO_AND_FAILURE_INJECTION_SPEC_v1.md`       |
| Autopilot rollout                | `docs/ops/AUTOPILOT_ROLLOUT_RUNBOOK.md`                                |
