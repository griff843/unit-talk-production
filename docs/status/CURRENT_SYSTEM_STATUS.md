# Current System Status

**Last Updated**: 2026-03-14 (SPRINT-DISCORD-PROMOTION-BAND-NULL-FIX) **Audit
Sources**: SPRINT-DISCORD-PROMOTION-BAND-NULL-FIX (promotion_band null bug fixed
in GradingAgent; 4 approved picks backfilled; 35c700ad);
SPRINT-DOCKER-COMPOSE-STARTUP-AUDIT (all 12 services verified healthy; Discord
posting root cause traced — promotion_band=null + external feeds down; worker
heartbeat false negative discovered); SPRINT-FRONTEND-DOCKER-PERMANENT-HARDENING
(manifest-first layer caching + node:20 standardization across all 3 frontend
Dockerfiles; discord-bot chown-R eliminated; f0993ce7);
SPRINT-DOCKER-SHARED-TYPES-TRUTH-SWEEP (command-center + dashboard Docker builds
restored — stale shared-types steps removed from all 3 frontend Dockerfiles);
SPRINT-SMARTFORM-DOCKER-BUILD-TRUTH-FIX (Smart Form Docker build restored);
SPRINT-LAYER1-PHASE5-E2E-CLOSURE (R3 shadow guardrails + R4 fault suite wired
into CI; E2E lifecycle traversal proven; Phase 5 COMPLETE; Layer 1 COMPLETE);
SPRINT-DISCORD-WORKER-HEALTH-RESTORE (bcbc20f7); SPRINT-VERIFICATION-GIT-COMMIT
(a6f69276)

---

## Subsystem Readiness Matrix

| Subsystem              | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Blocking Issues                                                                                                                                              |
| ---------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Ingestion**          | VERIFIED | SGO + OddsAPI on V3 path via `provider_offers`; Optimal API not in use (by design — 2-provider architecture)                                                                                                                                                                                                                                                                                                                                                                                                                | None                                                                                                                                                         |
| **Scoring**            | VERIFIED | GradingAgent + ProfessionalPropProcessor complete; computeConsensus() + probabilityLayer + ShadowScoringService all implemented; 76 new consensus tests; real Kelly fraction from pFinal + odds; sport exposure caps, correlation detection, drawdown freeze (SPRINT-RISK-EXPOSURE-CORRELATION)                                                                                                                                                                                                                             | None                                                                                                                                                         |
| **Promotion**          | VERIFIED | Agent wired + shadow mode fixed (opt-in); outbox pattern implemented; runbook committed with staged activation (shadow→canary→prod); 41 guard tests (kill switch, canary, band config); all gates fail-closed (SPRINT-PROMOTION-RUNTIME-ACTIVATION); `promotion_band` null bug fixed — GradingAgent now sets `'HARD'` fallback for all picks passing `meetsPromotionCriteria()`; 4 null-band approved picks backfilled via operator_override (SPRINT-DISCORD-PROMOTION-BAND-NULL-FIX, 35c700ad)                             | Requires runtime env config to activate (`AUTOPILOT_MODE=prod`); external feeds currently down (Optimal 503 + SGO fallback failing — external, no local fix) |
| **Settlement**         | VERIFIED | lifecycleSettle + TOCTOU lock + idempotency preflight; no raw_props dependency                                                                                                                                                                                                                                                                                                                                                                                                                                              | None                                                                                                                                                         |
| **Recaps**             | VERIFIED | RecapAgent lifecycle-compliant (`lifecycleUpdate` with `poster` role); Temporal workflows defined (daily/weekly/monthly/micro); RecapFormatter generates comprehensive Discord embeds; RecapStateManager for idempotent operation; 81 recapUtils unit tests (SPRINT-DISCORD-RECAP-VERIFICATION)                                                                                                                                                                                                                             | Temporal scheduling config external to codebase                                                                                                              |
| **Command Center**     | VERIFIED | READ-ONLY; health + ops-confidence + monitoring endpoints                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | None                                                                                                                                                         |
| **Analytics**          | VERIFIED | AnalyticsAgent + metrics server + CLV computation + loss attribution; CLV edge validation layer: `clvAnalyzer`, `edgeValidator`, `edgeCalibrator` (46 tests)                                                                                                                                                                                                                                                                                                                                                                | Needs runtime verification                                                                                                                                   |
| **Discord Bot**        | VERIFIED | Full-featured bot (37+ slash commands, 16 services, 6 health endpoints, K8s probes, Docker deployment, blue-green support); separate from DiscordPromotionAgent; fail-closed feature flags (safe-mode=true, discord-publish=false); 20 discordRouting tests (SPRINT-DISCORD-RECAP-VERIFICATION)                                                                                                                                                                                                                             | Runtime env config required (`DISCORD_TOKEN`, `DISCORD_MODE`)                                                                                                |
| **Smart Form**         | VERIFIED | Writes to `bridge_outbox` only; form validation complete; Docker build restored (SPRINT-SMARTFORM-DOCKER-BUILD-TRUTH-FIX)                                                                                                                                                                                                                                                                                                                                                                                                   | None                                                                                                                                                         |
| **Lifecycle Adapters** | VERIFIED | Core adapters complete; 0 violations, 0 allowlist entries (SPRINT-SINGLE-WRITER-COMPLETION)                                                                                                                                                                                                                                                                                                                                                                                                                                 | None                                                                                                                                                         |
| **CI/CD Pipeline**     | PARTIAL  | Reusable workflows + lifecycle gate + R3 shadow guardrails + R4 fault suite wired (SPRINT-LAYER1-PHASE5-E2E-CLOSURE, 2026-03-14); vitest 843/843; Jest quarantined separately                                                                                                                                                                                                                                                                                                                                               | Jest tests in `test/` partially broken (separate infra — SPRINT-JEST-QUARANTINE-CLEANUP pending)                                                             |
| **Observability**      | VERIFIED | FM-2/FM-5/FM-9 closed; outbox depth + orphaned picks + worker heartbeat in /health; dead_letter quarantine + ops_worker_heartbeats applied (SPRINT-DISCORD-WORKER-HEALTH-RESTORE, bcbc20f7); `packages/observability` build verified PASS (SPRINT-OBSERVABILITY-BUILD-FIX)                                                                                                                                                                                                                                                  | None                                                                                                                                                         |
| **Verification (R1)**  | VERIFIED | Mode-safe adapter layer: ExecutionMode enum (production/replay/shadow/fault/simulation), RunController, VirtualEventClock, RealClockProvider; `assertManifestConsistency()` validates adapter/mode alignment (SPRINT-VERIFICATION-SIMULATION-LAYER-R1)                                                                                                                                                                                                                                                                      | None                                                                                                                                                         |
| **Verification (R2)**  | VERIFIED | Deterministic replay engine: JournalEventStore (JSONL), IsolatedPickStore, ReplayOrchestrator (dual-run), DeterminismValidator (SHA-256), ProductionEventRecorder, ReplayProofWriter; CLI `pnpm replay:run`; proof bundles in `out/replays/` (SPRINT-VERIFICATION-SIMULATION-LAYER-R2)                                                                                                                                                                                                                                      | None                                                                                                                                                         |
| **Verification (R3)**  | VERIFIED | Shadow mode: shadow comparator, divergence classifier (severity: CRITICAL/HIGH/LOW), PASS/PASS_WITH_WARNINGS/FAIL verdict engine, critical divergence alert capture (NullNotificationAdapter), proof bundle generation (`out/shadow-runs/<run-id>/`), CLI guardrail runner (`scripts/run-shadow-guardrails.ts`); 35 new verification tests (SPRINT-VERIFICATION-SHADOW-DIVERGENCE-GUARDRAILS)                                                                                                                               | None                                                                                                                                                         |
| **Verification (R4)**  | VERIFIED | Fault injection: F1–F10 canonical scenarios, FaultInjector, 4 fault adapters (publish/feed/settlement/recap), InvariantAssertionEngine, FaultOrchestrator, FaultProofWriter; 40/40 assertions pass; all gates A–G PASS; production safety enforced (fault adapters throw in production mode) (SPRINT-VERIFICATION-SIMULATION-LAYER-R4)                                                                                                                                                                                      | None                                                                                                                                                         |
| **Verification (R5)**  | VERIFIED | Execution simulation: ExecutionSimulator (slippage/latency/rejection), BankrollSimulator (flat/kelly staking, drawdown, correlation), StrategyEvaluationEngine (4 predefined strategies), StrategyComparator, StrategyProofWriter; proof bundles to `out/strategy-runs/`; CLI `pnpm strategy:simulate` / `pnpm strategy:compare`; all 7 gates A–G PASS; Claude OS: 8/8 required artifacts PASS_WITH_LIMITATIONS (optional discord/browser probes skipped — unrelated to R5 scope) (SPRINT-VERIFICATION-SIMULATION-LAYER-R5) | None — code committed + pushed (DRIFT-H5 resolved, SPRINT-VERIFICATION-GIT-COMMIT)                                                                           |

---

## Allowed Statuses

| Status         | Meaning                                                          |
| -------------- | ---------------------------------------------------------------- |
| **VERIFIED**   | Code exists, architecture sound, governance compliance confirmed |
| **PARTIAL**    | Code exists but incomplete, disabled, or has known gaps          |
| **ASSUMED**    | Expected to work based on documentation but not verified         |
| **BROKEN**     | Code exists but does not function correctly                      |
| **UNVERIFIED** | Insufficient evidence to determine status                        |

---

## Infrastructure Health

| Component              | Status        | Notes                                                                                                                                                                                                                        |
| ---------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript Compilation | CLEAN         | 0 errors (scripts/ excluded via tsconfig; shebang fixed)                                                                                                                                                                     |
| Test Suite (Vitest)    | CLEAN         | 843/843 passing — scoped to `src/**/__tests__/` (+101 Discord/Recap verification tests SPRINT-DISCORD-RECAP-VERIFICATION)                                                                                                    |
| Test Suite (Jest)      | PARTIAL       | `test/` Jest suite: 14 pass, ~79 quarantined/broken                                                                                                                                                                          |
| Single-Writer Gate     | PASS          | 0 violations, 0 allowlisted (SPRINT-SINGLE-WRITER-COMPLETION)                                                                                                                                                                |
| Build (API)            | PASS          | `pnpm --filter unit-talk-platform run build` exits 0 (SPRINT-OBSERVABILITY-BUILD-FIX)                                                                                                                                        |
| Build (Command Center) | PASS          | `pnpm --filter unit-talk-command-center run build` exits 0; dynamic server warnings during SSG are expected (SPRINT-OBSERVABILITY-BUILD-FIX)                                                                                 |
| Build (Smart Form)     | PASS          | Docker `development` target build succeeds; stale `packages/shared-types` build step removed; manifest-first layer caching; node:18→20-alpine (SPRINT-FRONTEND-DOCKER-PERMANENT-HARDENING)                                   |
| Build (Command Center) | PASS          | Docker `development` target build succeeds; stale `packages/shared-types` build step removed; manifest-first layer caching; node:20-alpine (SPRINT-FRONTEND-DOCKER-PERMANENT-HARDENING)                                      |
| Build (Dashboard)      | PASS          | Docker `development` target build succeeds; stale `packages/shared-types` build step removed; manifest-first layer caching; node:18→20-alpine; no `@unit-talk/*` workspace deps (SPRINT-FRONTEND-DOCKER-PERMANENT-HARDENING) |
| Git Status             | CLEAN         | No uncommitted changes on sprint branch                                                                                                                                                                                      |
| Database Schema        | 73 migrations | Latest: Mar 8, 2026                                                                                                                                                                                                          |

---

## Agent Status

| Agent                 | Lifecycle Compliant | Active | Notes                                                                                                                                                                                                                                                                      |
| --------------------- | ------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GradingAgent          | YES                 | YES    | Uses `lifecycleInsert()` with `promoter` role; RiskEngine pre-flight gate (fail-closed); passes sizing inputs (winProb + decimalOdds) to RiskEngine; `promotion_band='HARD'` fallback set for all promoted picks — no null writes (SPRINT-DISCORD-PROMOTION-BAND-NULL-FIX) |
| SettlementAgent       | YES                 | YES    | Uses `lifecycleSettle()` with `settler` role                                                                                                                                                                                                                               |
| DiscordPromotionAgent | YES                 | YES    | Uses `atomicClaimForPost()`; L988-993 bypass removed (SPRINT-SINGLE-WRITER-COMPLETION)                                                                                                                                                                                     |
| RecapAgent            | YES                 | YES    | Uses `lifecycleUpdate()`                                                                                                                                                                                                                                                   |
| IngestionAgent        | N/A                 | YES    | Writes to `provider_offers` (different table)                                                                                                                                                                                                                              |
| FeedAgent             | N/A                 | YES    | Writes to `provider_offers`/`raw_props`                                                                                                                                                                                                                                    |
| AlertAgent            | YES                 | YES    | Migrated to `lifecycleUpdate()` (SPRINT-SINGLE-WRITER-COMPLETION)                                                                                                                                                                                                          |
| AnalyticsAgent        | N/A                 | YES    | Read-only analytics                                                                                                                                                                                                                                                        |
| NotificationAgent     | N/A                 | YES    | Notifications only                                                                                                                                                                                                                                                         |
| PlayerEnrichmentAgent | N/A                 | YES    | Reads participants                                                                                                                                                                                                                                                         |
| AuditAgent            | N/A                 | YES    | Audit trail only                                                                                                                                                                                                                                                           |
| OperatorAgent         | N/A                 | YES    | Manual operations                                                                                                                                                                                                                                                          |

---

## Data Pipeline Flow (Current)

```
                              ┌─────────────────┐
                              │   SGO / OddsAPI  │
                              │   (providers)    │
                              └────────┬────────┘
                                       │
                              ┌────────▼────────┐
                              │ provider_offers  │ ← V3 canonical landing
                              │ (CANONICAL)      │
                              └────────┬────────┘
                                       │
                              ┌────────▼────────┐
                              │  GradingAgent    │ ← ML scoring + tier
                              │  (Professional)  │
                              └────────┬────────┘
                                       │ RiskEngine.evaluateForPromotion()
                                       │ (fail-closed gate)
                                       │ lifecycleInsert(promoter)
                              ┌────────▼────────┐
                              │ unified_picks    │ ← CANONICAL
                              │ (lifecycle FSM)  │
                              └──┬──────────┬───┘
                                 │          │
                    ┌────────────▼──┐  ┌────▼───────────┐
                    │ Discord       │  │ Settlement     │
                    │ Promotion     │  │ Agent          │
                    │ (WIRED/GATED) │  │ (VERIFIED)     │
                    └───────────────┘  └────────────────┘
```

---

## Key Environment Flags

| Flag                        | Default           | Effect                                                       |
| --------------------------- | ----------------- | ------------------------------------------------------------ |
| `GRADING_DATA_SOURCE`       | `provider_offers` | Scoring data source                                          |
| `USE_PRO_SCORER`            | `true`            | Professional ML scoring                                      |
| `USE_PROJECTIONS`           | `true`            | Projection edge integration                                  |
| `PROMOTION_POLICY_V2`       | `false`           | Auto-promotion policy (must be `true` for V2 promotion)      |
| `PROMOTION_KILL_SWITCH`     | `false`           | Emergency promotion block                                    |
| `ENABLE_TEMPORAL_SCHEDULES` | `false`           | Scheduled workflows                                          |
| `AUTOPILOT_MODE`            | `'off'`           | **Must be `prod`** for Discord posting (AutopilotGuard gate) |
| `DISCORD_WEBHOOK_URL`       | unset             | **Required** for Discord posting                             |
| `PROMOTION_CANARY_PERCENT`  | `0`               | **Must be >0** (e.g., `100`) to enable canary routing        |
| `PROMOTION_SHADOW_MODE`     | unset             | Set `true` to suppress Discord posting (dry run)             |
| `DEMO_MODE`                 | `false`           | Demo/mock behavior                                           |
