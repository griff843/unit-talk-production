# Phase Status

**Last Updated**: 2026-03-14 (SPRINT-CLAUDE-OS-LIFECYCLE-AUTOMATION-HARDENING)
**Source**: Linear initiatives + repo implementation + sprint closeouts

---

> **NAMING CONVENTION NOTICE** (added 2026-03-13)
>
> This file uses the **pre-canonicalization operational phase naming**
> established before `docs/04_roadmap/layer_phase_execution_model.md` was
> ratified.
>
> | This file (operational)            | Canonical model (`layer_phase_execution_model.md`)                                        |
> | ---------------------------------- | ----------------------------------------------------------------------------------------- |
> | Phase 1 — Structural Dominance     | Layer 1, Phases 0–3 (Governance Lock → Distribution Determinism)                          |
> | Phase 2 — Intelligence Superiority | Layer 1 / Layer 4 (Data Truth + Intelligence work)                                        |
> | Phase 3 — Risk Engine Dominance    | Layer 2, Phase 6–7 (Operator Control + Reliability)                                       |
> | Phase 4 — Automation Supremacy     | Layer 3, Phase 11 (Workflow Optimization)                                                 |
> | Phase 5 — Enterprise Scaling       | **NOT Phase 5 in canonical model** — canonical Phase 5 = Platform Stabilization (Layer 1) |
>
> **For sprint classification**: use
> `docs/04_roadmap/layer_phase_execution_model.md` (Phases 0–14). **For progress
> tracking**: use the completion percentages and work items in this file. These
> two documents serve different purposes and must not be conflated.

---

## PHASE 1 — Structural Dominance

**Linear Status**: Active | **Health**: At Risk **Initiative**: Lock runtime,
enforce canonical state, deterministic outbox, settlement immutability

### Completed Work

- Single-writer discipline architecture (lifecycle adapters, gate, allowlist)
- Fail-closed boot enforcement
- Canonical Supabase host validation
- Lifecycle state machine (DRAFT → SETTLED)
- Outbox pattern for Discord publishing (pick_publish)
- Bridge outbox for Smart Form (bridge_outbox)
- Settlement immutability (DB triggers + lifecycle guards)
- TOCTOU lock for settlement (latest sprint)
- Idempotency guards (submit/post/settle)
- Autopilot freeze mechanism
- 73 database migrations applied
- CI pipeline with lifecycle gate

### Additional Completed Work (Sprint Closeouts through 2026-03-09)

- Single-writer migration: 0 violations, 0 allowlist entries
  (SPRINT-SINGLE-WRITER-COMPLETION)
- Promotion pipeline wired: DiscordPromotionAgent Temporal activities + shadow
  mode fixed (SPRINT-PROMOTION-PIPELINE-ACTIVATION)
- Test infrastructure: vitest 701/701, type-check 0 errors
  (SPRINT-TEST-INFRA-RECOVERY + subsequent sprints)
- Observability: FM-2 (outbox depth), FM-5 (orphaned picks), FM-9 (worker
  heartbeat) (SPRINT-OPERATIONAL-OBSERVABILITY)
- Build verification: API PASS, Command Center PASS, Observability PASS
  (SPRINT-OBSERVABILITY-BUILD-FIX, 2026-03-10)

### Additional Completed Work (Sprint Closeouts through 2026-03-13)

- Promotion activation runbook: staged shadow→canary→prod, 41 guard tests (kill
  switch, canary band, config validation), 12-var env reference, monitoring
  checklist + rollback procedures (SPRINT-PROMOTION-RUNTIME-ACTIVATION, UNI-56,
  2026-03-10) — vitest 742/742
- Discord worker health restore: dead_letter quarantine applied,
  ops_worker_heartbeats wired, /ops/status: ready, 6 unrecoverable outbox rows
  quarantined (SPRINT-DISCORD-WORKER-HEALTH-RESTORE, bcbc20f7, 2026-03-13)
- Verification control plane R1–R5 committed to origin/main via PR #157
  (a6f69276, 2026-03-13); DRIFT-H5 resolved; R1 clock injection in lifecycle
  adapters (SPRINT-VERIFICATION-GIT-COMMIT)

### Remaining Gaps

- Promotion requires runtime env config: `AUTOPILOT_MODE=prod`,
  `PROMOTION_CANARY_PERCENT>0`, `DISCORD_WEBHOOK_URL`
- Jest test suite in `test/`: ✅ CLEAN — 643/643 passing (35 suites, 0
  quarantined — SPRINT-JEST-QUARANTINE-CLEANUP, 2026-03-14)
- Smart Form build pre-existing BROKEN on Windows (Next.js 14.2.35 pnpm
  extraction)
- Shadow mode (R3) and fault injection (R4) CI integration pending (code
  verified, not yet wired into CI pipeline)
- E2E smoke test suite (full-lifecycle pick proof) pending

### Assessment

**PHASE 1 is 97% complete.** Core invariants enforced, migration debt cleared,
promotion pipeline fully activated with staged runbook + 41 guard tests, worker
health restored, verification control plane on origin/main. Remaining gaps are
runtime promotion config, Jest quarantine, Smart Form Windows build, and Phase 5
E2E closure items.

---

## PHASE 2 — Intelligence Superiority

**Linear Status**: Active | **Health**: At Risk **Initiative**: Market data
normalization, consensus probability, sharp signal extraction, model separation,
stat distributions, CLV validation

### Completed Work (Intelligence Pipeline — SPRINT-031 through SPRINT-039)

- Model separation (sharp consensus, signal-enhanced CLV)
- Stat projection pipeline (modules + test suite)
- Signal math corrections (Z-score, Kelly)
- Market reaction layer
- Outcome tracking + baseline ROI
- Production pick selection engine
- Promotion band calibration (49 tests)
- Walk-forward evaluation hardening (26 tests)
- Daily metrics + drift rollups (24 tests)
- Model calibration loop (29 tests)
- CLV edge validation layer: `clvAnalyzer`, `edgeValidator`, `edgeCalibrator` —
  46 tests (SPRINT-PHASE2-CLV-EDGE-VALIDATION, 2026-03-10)

### Completed Work (Architecture Migration — SPRINT-044A through 044E)

- Pipeline unblocker (writer authority + promotion policy)
- Ingestion migration (provider_offers + SGO adapter)
- Settlement verification (SGO + bet_side confirmation)
- Scoring migration (GradingAgent → provider_offers + closing snapshots)
- Cleanup (PlayerEnrichmentAgent + raw_props retirement)

### Remaining Work (Linear Todo — Sprint 029)

- UNI-11: V3 multi-book consensus scoring pipeline ✅ (implemented — see
  DRIFT-M-CONSENSUS resolution)
- UNI-12: Shadow scoring service — V3 alongside legacy ✅ (implemented)
- UNI-13: Market offer aggregator and book adapters ✅ (implemented)
- UNI-16: Edge validation framework — CLV backtesting ✅ **DONE**
  (SPRINT-PHASE2-CLV-EDGE-VALIDATION, 2026-03-10)
- UNI-15: Publish outbox — Discord posting pipeline alignment ✅
  (SPRINT-PROMOTION-PIPELINE-ACTIVATION)
- UNI-14: Complete Linear migration — GitHub integration (Urgent — DRIFT-H4)

### Assessment

**PHASE 2 is 80% complete.** Intelligence pipeline sprints (031-039) are done.
Architecture migration (044A-044E) is done. CLV edge validation (UNI-16) is
done. Multi-book consensus, shadow scoring, and market aggregator are fully
implemented. Only remaining gap: Linear-GitHub integration (UNI-14).

---

## PHASE 3 — Risk Engine Dominance

**Linear Status**: Planned | **Health**: On Track **Initiative**: Bankroll
management, Kelly criterion, exposure caps, correlation controls, drawdown
freeze

### Completed Work

- Risk engine foundation migration deployed
  (`20260302150401_risk_engine_foundation.sql`)
- Market policy table created (`20260306210000_market_policy.sql`)
- RiskEngine service implemented with Kelly threshold, event-level exposure,
  drift detection
- RiskEngine pre-flight gate wired into GradingAgent
  `promoteFromProviderOffer()` — fail-closed (SPRINT-RISK-ENGINE-INTEGRATION,
  2026-03-09)
- 17 integration tests: 10 RiskEngine scenarios + 7 GradingAgent gate tests
- Bankroll-aware Kelly sizing: `KellySizer.ts` with `computeKellySize()`,
  `computeKellyFraction()`, `americanToDecimal()` (SPRINT-RISK-BANKROLL-KELLY,
  2026-03-10)
- RiskEngine returns `RiskSizing` with recommended units, fractional Kelly, cap
  enforcement
- ProfessionalPropProcessor: `kelly_fraction: 0` replaced with real computation
  from pFinal + odds
- GradingAgent passes sizing inputs (winProbability + decimalOdds) to RiskEngine
  gate
- 36 new Kelly sizer tests (666 total vitest passing)
- Sport-level exposure caps via ExposureCalculator extension with `events` join
  (SPRINT-RISK-EXPOSURE-CORRELATION, 2026-03-10)
- CorrelationDetector: same-event and same-participant cluster detection from
  pending ticket_legs
- DrawdownTracker: daily P&L computation with configurable freeze threshold
- 5 new risk_engine_config fields: sport_kelly_limit,
  correlation_max_same_event, correlation_max_same_participant,
  drawdown_freeze_threshold, drawdown_lookback_days
- All 3 new gate checks wired into RiskEngine.evaluateForPromotion()
  (fail-closed)
- 35 new exposure/correlation/drawdown tests (701 total vitest passing)

### Additional Completed Work (SPRINT-RISK-DASHBOARD-MONITORING, 2026-03-14)

- `GET /api/risk/status` endpoint: parallel aggregation of ExposureState,
  DriftState, CorrelationState, DrawdownState via `Promise.allSettled` (PR #177,
  UNI-69)
- `GET /api/risk/decisions` endpoint: paginated risk decision audit trail with
  sport/date/severity/type filters
- `computeCorrelation` + `computeDrawdown` public methods on RiskEngine
  (standalone dashboard access without running full promotion gate)
- Command Center risk dashboard: CorrelationPanel + DrawdownPanel added; live
  `/api/risk/status` proxy + `/api/risk/decisions` proxy routes
- 4 new vitest tests (computeCorrelation + computeDrawdown public method
  coverage); 898/898 total passing
- DRIFT-L4 closed as false positive: `ops_worker_heartbeats` schema has
  `worker_name` + `last_heartbeat_at` matching `health.ts` query exactly

### Additional Completed Work (SPRINT-041-MARKET-TYPE-EXPOSURE-CAPS, 2026-03-14)

- Market-type level exposure caps via `markets!inner(category)` join in
  ExposureCalculator; `byMarketType` aggregation + breach detection
- `market_type_kelly_limit = 0.35` seeded into `risk_engine_config`
- RiskEngine gate check for market-type dimension (step 5b in
  `evaluateForPromotion()`)
- Command Center risk dashboard: MarketTypePanel added; 3-col grid
- 5 new vitest tests; 901/903 total (2 pre-existing failures in
  risk-integration.test.ts — not introduced by this sprint)
- (PR #185, UNI-72 Done)

### Additional Completed Work (SPRINT-042-LAYER2-PHASE6-OPERATOR-CONTROL-PLANE, 2026-03-14)

Layer 2 / Phase 6 — Operator Control Plane deliverables:

- `GET /ops/autopilot` — read current AutopilotGuard mode + status
- `PUT /ops/autopilot` — set mode at runtime without container restart; persists
  to `risk_engine_config` DB
- `POST /ops/picks/:id/override` — promote or reject any pick via
  `operator_override` lifecycle role
- `PUT /api/risk/config/:key` — update risk engine config values at runtime with
  14-key whitelist + 60s cache invalidation
- `AutopilotGuard.setCanaryPercentage()` + `persistMode()` methods added
- Migration: `autopilot_mode` + `canary_percentage` seed rows in
  `risk_engine_config`
- 12 new vitest tests; 910/910 total (34 suites) — pre-existing risk-integration
  failures resolved
- (PR #189)

### Additional Completed Work (SPRINT-043-LAYER2-PHASE7-RELIABILITY-MONITORING, 2026-03-14)

Layer 2 / Phase 7 — Reliability & Monitoring deliverables:

- `GET /api/slo/status` — 4-SLO attainment endpoint: lifecycle completion (95%
  target), Discord posting (98% target), grading latency p50 (<300s target),
  settlement accuracy (99.5% target); `Promise.allSettled` parallel queries;
  `deriveRateSloStatus` / `deriveLatencySloStatus` helpers exported for reuse
- `GET /api/health/summary` — unified platform health: HEALTHY/DEGRADED/CRITICAL
  status from 7 subsystems (4 SLO + risk_engine + outbox + workers); returns
  `slo_breaches`, `slo_warns`, `alert_count`, `high_alert_count`,
  `autopilot_mode`
- `PlatformThresholdEvaluator` — structured alerting service (drawdown freeze →
  HIGH, outbox depth >20 → MEDIUM, SLO breach → HIGH/WARN → MEDIUM, heartbeat
  stale >10min → HIGH); called by `/api/health/summary` with pre-computed SLOs
- `docs/ops/SLO_DEFINITIONS.md` — 4 SLOs with measurement queries and thresholds
- `docs/ops/ON_CALL_RUNBOOK.md` — 5 operational scenarios (drawdown freeze,
  Discord posting failure, risk gate blocking, heartbeat gap, external feed
  down)
- 11 new vitest tests; 921/921 total (35 suites)
- (PR #191)

### Additional Completed Work (SPRINT-044-LAYER2-PHASE8-RECOVERY-REPLAY, 2026-03-14)

Layer 2 / Phase 8 — Recovery & Replay deliverables:

- `POST /ops/recovery/replay` — deterministic replay from production event
  journal; accepts `journalPath` + `eventWindow { from, to }`; runs
  `ReplayOrchestrator` with non-production adapter manifest; returns
  `{ replayId, divergences, proofPath, status: "PASS"|"FAIL" }`; writes proof
  bundle to `out/replay-runs/<replayId>/`
- `GET /ops/recovery/replays` — list recent replay proof bundles (up to 20,
  sorted by most recent); returns `{ replayId, proofPath, ranAt }` per run
- `apps/api/src/routes/ops-recovery.ts` — new route file, mounted at `/ops` in
  `api-server.ts`; adminAuth guard; same pattern as `ops-control.ts`
- `docs/ops/JOURNAL_BACKUP_PROCEDURE.md` — journal backup/restore procedure,
  health checks, and replay trigger reference
- `docs/ops/ON_CALL_RUNBOOK.md §Scenario 6` — incident recovery runbook: journal
  backup, replay trigger, result interpretation, divergence handling, escalation
  steps
- 5 new vitest tests (JournalEventStore in-memory, storeFromJsonl,
  getEventsBetween, ReplayOrchestrator determinism hash, empty-store run);
  926/926 total
- Layer 2 complete: Phases 6 (Operator Control), 7 (Reliability), 8 (Recovery)
  all delivered

### Remaining Work

None — Layer 2 / Phase 8 is the final Layer 2 phase. All Layer 2 deliverables
are complete.

### Assessment

**PHASE 3 is 100% complete. Layer 2 is 100% complete.** All risk controls fully
implemented: Kelly sizing, exposure caps (total + event + sport + market-type),
correlation detection, drawdown freeze. Risk state fully visible in Command
Center (exposure, drift, correlation, drawdown, market-type panels). Decision
audit trail queryable via `/api/risk/decisions`. Operator control API live
(Phase 6): autopilot mode changeable at runtime, risk config updatable without
deploy, manual pick overrides via lifecycle adapter. Reliability monitoring live
(Phase 7): 4 SLOs defined and tracked, unified health summary with
HEALTHY/DEGRADED/CRITICAL derivation, structured alerting, on-call runbook (6
scenarios). Incident recovery live (Phase 8): deterministic replay from
production event journal, proof bundle generation, operator-accessible via
`/ops/recovery/replay`.

---

## PHASE 4 — Automation Supremacy

**Linear Status**: Planned | **Health**: On Track **Initiative**: Workflow
automation, edge ranking feeds, market alerts, context/recap automation

### Completed Work

- AlertAgent live with AI-generated advice
- RecapAgent infrastructure complete
- Temporal workflow orchestration in place
- Discord bot standalone deployment

### Additional Completed Work (Sprint Closeouts through 2026-03-13)

- Discord bot VERIFIED: 37+ slash commands, 16 services, 6 health endpoints, K8s
  probes, Docker deployment, blue-green support, fail-closed feature flags
  (SPRINT-DISCORD-RECAP-VERIFICATION, UNI-57, 2026-03-10) — 20 discordRouting
  tests
- RecapAgent VERIFIED: lifecycle-compliant (`lifecycleUpdate` with `poster`
  role), Temporal workflows (daily/weekly/monthly/micro), RecapFormatter Discord
  embeds, RecapStateManager for idempotent operation, 81 recapUtils unit tests
  (SPRINT-DISCORD-RECAP-VERIFICATION, UNI-57, 2026-03-10)
- Vitest: 843/843 passing (includes 101 Discord/Recap verification tests)

### Remaining Work

- Automated edge ranking feeds
- Full market alert automation
- Context-aware recap generation (RecapAgent infrastructure ready; scheduling
  config external to codebase)
- Workflow orchestration refinement

### Assessment

**PHASE 4 is 40% complete.** Discord bot fully verified and K8s-ready.
RecapAgent lifecycle-compliant with Temporal workflows and embed generation.
AlertAgent live. Core automation infrastructure complete. Remaining: edge
ranking feeds, full market alert automation, Temporal scheduling configuration.

---

## PHASE 5 — Enterprise Scaling

**Linear Status**: Planned | **Health**: On Track **Initiative**: Tenant
isolation, config scoping, branded delivery, tenant controls

### Completed Work

- None specific to enterprise scaling

### Remaining Work

- Multi-tenant architecture
- Config scoping per tenant
- Branded delivery channels
- Tenant-level controls

### Assessment

**PHASE 5 is 0% complete.** Not started.

---

## CLAUDE OS UPGRADE

**Source**: `docs/02_architecture/claude_os_ceiling_blueprint.md` §10
**Linear**: UNI-64 (Done), UNI-65–68 (In Review — PR #170)

Tracking AI operator tooling improvements separate from product phases.

### Completed

- **Phase A — Blueprint Committed**: ceiling blueprint ratified in
  `docs/02_architecture/claude_os_ceiling_blueprint.md` (COMPLETE)
- **COS-001 — Model Routing Formalization**: `docs/claude/MODEL_SELECTION.md`
  created; sprint-plan skill generates `Model:` + `Routing:` fields (UNI-64
  Done)

### Complete (PR #170 merged)

- **COS-002 — Linear Sync Automation**: `scripts/sprint-linear-sync.ts`; posts
  closeout comment + marks Done; `sprint:close --linear UNI-N` flag (UNI-65
  Done)
- **COS-003 — Phase Advancement Proof Template**:
  `docs/claude/PHASE_ADVANCEMENT_PROOF_TEMPLATE.md`;
  `scripts/generate-phase-proof.ts`; `sprint:close --phase N` flag + content
  validation (UNI-66 Done)
- **COS-004 — Lane Model Rules File**: `.claude/rules/07-lane-model.md`; Lanes
  1–6 definitions from blueprint §5 (UNI-67 Done)
- **COS-005 — Session Baseline Auto-Trigger**: `.claude/settings.json`
  UserPromptSubmit hook; `scripts/check-session-baseline.mjs` warns when
  baseline >30 min stale (UNI-68 Done)

### Complete (COS-006 — LLM Routing Engine, 2026-03-14)

- **COS-006 — LLM Routing Engine**: `tools/claude-os/src/llm-router.ts` (~460
  lines); 5 functions: `classifyTask`, `assignLanes`, `routeModels`,
  `recommendInstances`, `generatePrompts`; `route` CLI command added to
  `tools/claude-os/src/cli.ts`; Step 4.5 added to sprint-plan SKILL.md; LLM
  routing section added to PROMPT_TEMPLATES.md; architecture doc
  `docs/02_architecture/claude_os_llm_routing_engine.md`; Lane 2/3/5 hardcoded
  never-delegate; Mode A default (backward compatible);
  `LLM_ROUTING_DECISION.md` evidence artifact; (UNI-76 Done)

### Complete (SPRINT-CLAUDE-OS-LIFECYCLE-AUTOMATION-HARDENING, 2026-03-14)

- **Lifecycle Hardening**: `tools/claude-os/src/lifecycle-checker.ts` (new) — 5
  post-bundle lifecycle gates: proof_artifacts (file stat), bundle_verdict
  (verdict.json), working_tree (git status --porcelain), tag_on_remote (git
  ls-remote), status_sync (CURRENT_SYSTEM_STATUS.md grep); `checkLifecycle()`
  - `resolveArtifactRoot()` exports; `lifecycle-status` CLI command with
    human-readable + JSON output; exit code 1 on ACTION_REQUIRED; read-only, no
    shared state mutation; architecture doc
    `docs/02_architecture/claude_os_lifecycle_automation.md` (PR #201)

### Future

- **COS-007 — sprint:close validation**: validate `LLM_ROUTING_DECISION.md`
  exists and is well-formed during `sprint:close`
- **COS-008 — Mode B task envelopes**: artifact bundle format for external LLM
  advisory lanes
- **COS-009 — Mode B pilot**: ChatGPT-4o for Lane 4 docs advisory

### Assessment

**Claude OS Upgrade: COS-001–006 all COMPLETE + Lifecycle Hardening complete.
Post-bundle lifecycle now fully automated with single-command readout. Next:
COS-007 sprint:close validation.**

---

## Phase Summary

| Phase                                  | Status  | Completion | Blocking Issues                                                                                              |
| -------------------------------------- | ------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| **Phase 1** — Structural Dominance     | Active  | 97%        | Runtime env config (intentional fail-closed), Jest quarantine, Smart Form Windows build, Phase 5 E2E closure |
| **Phase 2** — Intelligence Superiority | Active  | 80%        | Linear-GitHub integration (UNI-14)                                                                           |
| **Phase 3** — Risk Engine Dominance    | Done    | 100%       | COMPLETE — all risk controls + operator API + monitoring + replay (Layer 2 Phases 6–8 all done)              |
| **Phase 4** — Automation Supremacy     | Active  | 40%        | Discord bot + RecapAgent VERIFIED; scheduling config external; edge ranking and alert automation not started |
| **Phase 5** — Enterprise Scaling       | Planned | 0%         | Blocked by Phase 4                                                                                           |
| **Claude OS Upgrade**                  | Active  | 95%        | COS-001–006 Done + Lifecycle Hardening done; COS-007 (sprint:close validation) next                          |

**Current Platform Phase**: Layer 2 / Phase 8 COMPLETE — Layer 2 fully done.
Phase 1 at 97%, Phase 4 advancing (40%); canonical Layer 1 / Phase 5 (Platform
Stabilization) is the active completion gate — see
`docs/06_status/current_phase.md` for canonical layer/phase position.
