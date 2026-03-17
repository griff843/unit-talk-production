# REPLAY & SIMULATION TRUTH AUDIT

**Sprint**: SPRINT-063-LIFECYCLE-TRUTH-RESTORATION **Date**: 2026-03-16
**Verdict**: PARTIAL — Infrastructure is real but not operationally integrated

---

## Infrastructure Inventory

| Layer | Component             | Lines | Classification     |
| ----- | --------------------- | ----- | ------------------ |
| R1    | RunController         | ~200  | REAL-AND-CANONICAL |
| R1    | Adapter Contracts     | ~200  | REAL-AND-CANONICAL |
| R2    | ReplayOrchestrator    | 355   | REAL-AND-CANONICAL |
| R2    | IsolatedPickStore     | 161   | REAL-AND-CANONICAL |
| R2    | VirtualEventClock     | 184   | REAL-AND-CANONICAL |
| R2    | EventStore (JSONL)    | ~150  | REAL-AND-CANONICAL |
| R2    | ReplayLifecycleRunner | ~250  | REAL-AND-CANONICAL |
| R3    | ShadowOrchestrator    | ~130  | PARTIAL (dormant)  |
| R3    | ShadowComparator      | ~200  | PARTIAL (dormant)  |
| R3    | DivergenceClassifier  | ~100  | PARTIAL (dormant)  |
| R4    | FaultOrchestrator     | ~250  | REAL-AND-CANONICAL |
| R4    | Scenarios F1-F10      | ~49KB | REAL-AND-CANONICAL |
| R4    | AssertionEngine       | ~100  | REAL-AND-CANONICAL |
| R5    | ExecutionSimulator    | ~100  | SCAFFOLD-ONLY      |
| R5    | StrategyComparator    | ~100  | SCAFFOLD-ONLY      |
| R5    | BankrollSimulator     | ~100  | SCAFFOLD-ONLY      |
| —     | API Replay Endpoint   | 693   | PARTIAL (Temporal) |
| —     | Dashboard Replay UI   | ~200  | PARTIAL (UI only)  |

**Total**: ~8,400 lines across 48 files in `apps/api/src/lib/verification/`

---

## Classification Definitions

- **REAL-AND-CANONICAL**: Code is production-quality, tested, CLI-accessible,
  and functionally correct for its intended scope.
- **PARTIAL**: Code exists and works but is either dormant, not integrated into
  operations, or covers only a subset of the lifecycle.
- **SCAFFOLD-ONLY**: Code exists but has no consumer, no operational
  integration, and has never been exercised against real data.

---

## Detailed Assessment

### R1: RunController & Adapter Contracts — REAL-AND-CANONICAL

**Path**: `apps/api/src/lib/verification/run-controller.ts`,
`apps/api/src/lib/verification/adapters.ts`

The RunController validates execution modes (production, replay, shadow, fault,
simulation) and ensures clock/adapter compatibility. The adapter contract
defines 5 interfaces (Publish, Notification, Feed, Settlement, Recap) with
mode-safe routing. Production uses `PublishProductionAdapter` for real Discord
posting.

**Certification scope**: Mode validation and adapter dispatch. Does NOT certify
that all adapters are wired to real backends.

### R2: Deterministic Replay Engine — REAL-AND-CANONICAL

**Path**: `apps/api/src/lib/verification/replay-orchestrator.ts` + related

The replay engine loads events from a JSONL event store, creates a
VirtualEventClock, advances deterministically, dispatches lifecycle events
(PICK_SUBMITTED, PICK_GRADED, PICK_POSTED, PICK_SETTLED, RECAP_TRIGGERED), and
runs them through ReplayLifecycleRunner with the same validators as production.
All writes go to IsolatedPickStore (never production).

**CLI access**: `pnpm replay:run --fixture` **Test fixture**:
`demo-events.jsonl` (14 events) **Test coverage**: `recovery-replay.test.ts`
verifies ordering + trace

**Critical gap**: R2 is NOT integrated into the API replay endpoint. The
dashboard's `/api/replay` route
(`apps/command-center/src/app/api/replay/route.ts`, 693 lines) uses Temporal
workflows, not the R2 engine. There are TWO separate replay implementations that
are not connected.

### R3: Shadow Mode — PARTIAL (dormant)

**Path**: `apps/api/src/lib/verification/shadow-orchestrator.ts` + related

Runs reference + shadow pipelines in parallel against the same event stream.
ShadowComparator detects field-level divergence. DivergenceClassifier
categorizes as CLEAN, EXPECTED_SKEW, or CRITICAL_DIVERGENCE.

**CLI access**: `pnpm shadow:run --fixture` **CI gate**:
`inputs.run_shadow_guardrails` (disabled by default)

**Why dormant**: No production event feed configured. Mode is disabled in
production. Kill switch is off. Was not used in SPRINT-062.

### R4: Fault Injection — REAL-AND-CANONICAL (testing only)

**Path**: `apps/api/src/lib/verification/fault-orchestrator.ts`,
`apps/api/src/lib/verification/scenarios/index.ts`

F1-F10 canonical scenarios test: staleness, quality degradation, drawdown,
publication failure, settlement failure, concurrent modification, clock skew,
adapter failure, feed corruption, composite cascade.

**CLI access**: `pnpm fault:run --scenario=F1`, `pnpm fault:suite` **CI gate**:
`inputs.run_fault_suite` (disabled by default)

**Connected to real data**: NO — uses synthetic events only. This is intentional
for controlled testing.

### R5: Strategy Simulation — SCAFFOLD-ONLY

**Path**: `apps/api/src/lib/verification/execution-simulator.ts` + related

Models execution friction (line movement, latency, slippage). Uses seeded PRNG.
Compares strategies (flat-unit, kelly-025, etc.). Never modifies settlement
truth.

**No consumer**: Not called by any agent, not in dashboard, not in CI.

---

## Can Replay/Simulation Certify Each Lifecycle Segment?

| Segment    | R2 Replay | R3 Shadow | R4 Fault | R5 Sim | API Replay  |
| ---------- | --------- | --------- | -------- | ------ | ----------- |
| Ingestion  | YES       | YES       | YES      | NO     | NO          |
| Scoring    | PARTIAL\* | PARTIAL\* | YES      | NO     | NO          |
| Promotion  | YES       | YES       | YES      | NO     | NO          |
| Publish    | YES       | YES       | YES      | NO     | PARTIAL\*\* |
| Settlement | YES       | YES       | YES      | NO     | NO          |
| Recap      | YES       | PARTIAL   | PARTIAL  | NO     | NO          |

\*Scoring via replay uses mocked grading data from event store, not live scoring
engine. Does not exercise `computeScoreV2()` or `evaluatePromotion()`.

\*\*API Replay re-triggers grading workflows via Temporal but only for existing
events. Does not create new picks or exercise the full ingestion path.

---

## Was Replay Infrastructure Used in SPRINT-062?

**NO.** SPRINT-062 created manual test picks, posted them to Discord, and
verified receipts. It did not use:

- R2 ReplayOrchestrator
- R3 Shadow mode
- R4 Fault injection
- R5 Strategy simulation
- API Replay endpoint

The verification was manual/operational, not infrastructure-driven.

---

## Verdict

The verification infrastructure is **real, well-designed, and functional for
testing/CI purposes**. However:

1. It is **not integrated into operational certification** — SPRINT-062 didn't
   use it, and operators cannot trigger R2 replay from the dashboard.
2. The API replay endpoint and R2 engine are **two separate systems** with no
   bridge between them.
3. Shadow mode and fault injection are **CI-optional** (disabled by default).
4. Strategy simulation is **orphaned** (no consumer).

**Classification**: The replay/simulation layer is **partial certification
infrastructure** — it can test lifecycle correctness in isolation but is not yet
the canonical certification mechanism for production operations.

---

## Recommendations

1. Wire R2 ReplayOrchestrator into the API replay endpoint (or document why
   Temporal-based replay is preferred and retire R2 for operational use)
2. Enable shadow guardrails and fault suite in standard CI (not just opt-in)
3. Record production events to JSONL via ProductionEventRecorder to enable R2
   replay against real data
4. Decide whether R5 (strategy simulation) should be integrated or archived
