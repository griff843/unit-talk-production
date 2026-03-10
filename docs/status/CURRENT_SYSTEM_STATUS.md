# Current System Status

**Last Updated**: 2026-03-10 **Audit Source**: SPRINT-DISCORD-RECAP-VERIFICATION
(Discord bot architecture audited — 37+ commands, 6 health endpoints, K8s-ready,
fail-closed defaults; RecapAgent lifecycle-compliant, Temporal workflows
defined; 101 new verification tests)

---

## Subsystem Readiness Matrix

| Subsystem              | Status   | Evidence                                                                                                                                                                                                                                                                                        | Blocking Issues                                                 |
| ---------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Ingestion**          | VERIFIED | SGO + OddsAPI on V3 path via `provider_offers`; Optimal API not in use (by design — 2-provider architecture)                                                                                                                                                                                    | None                                                            |
| **Scoring**            | VERIFIED | GradingAgent + ProfessionalPropProcessor complete; computeConsensus() + probabilityLayer + ShadowScoringService all implemented; 76 new consensus tests; real Kelly fraction from pFinal + odds; sport exposure caps, correlation detection, drawdown freeze (SPRINT-RISK-EXPOSURE-CORRELATION) | None                                                            |
| **Promotion**          | VERIFIED | Agent wired + shadow mode fixed (opt-in); outbox pattern implemented; runbook committed with staged activation (shadow→canary→prod); 41 guard tests (kill switch, canary, band config); all gates fail-closed (SPRINT-PROMOTION-RUNTIME-ACTIVATION)                                             | Requires runtime env config to activate (`AUTOPILOT_MODE=prod`) |
| **Settlement**         | VERIFIED | lifecycleSettle + TOCTOU lock + idempotency preflight; no raw_props dependency                                                                                                                                                                                                                  | None                                                            |
| **Recaps**             | VERIFIED | RecapAgent lifecycle-compliant (`lifecycleUpdate` with `poster` role); Temporal workflows defined (daily/weekly/monthly/micro); RecapFormatter generates comprehensive Discord embeds; RecapStateManager for idempotent operation; 81 recapUtils unit tests (SPRINT-DISCORD-RECAP-VERIFICATION) | Temporal scheduling config external to codebase                 |
| **Command Center**     | VERIFIED | READ-ONLY; health + ops-confidence + monitoring endpoints                                                                                                                                                                                                                                       | None                                                            |
| **Analytics**          | VERIFIED | AnalyticsAgent + metrics server + CLV computation + loss attribution; CLV edge validation layer: `clvAnalyzer`, `edgeValidator`, `edgeCalibrator` (46 tests)                                                                                                                                    | Needs runtime verification                                      |
| **Discord Bot**        | VERIFIED | Full-featured bot (37+ slash commands, 16 services, 6 health endpoints, K8s probes, Docker deployment, blue-green support); separate from DiscordPromotionAgent; fail-closed feature flags (safe-mode=true, discord-publish=false); 20 discordRouting tests (SPRINT-DISCORD-RECAP-VERIFICATION) | Runtime env config required (`DISCORD_TOKEN`, `DISCORD_MODE`)   |
| **Smart Form**         | VERIFIED | Writes to `bridge_outbox` only; form validation complete                                                                                                                                                                                                                                        | None                                                            |
| **Lifecycle Adapters** | VERIFIED | Core adapters complete; 0 violations, 0 allowlist entries (SPRINT-SINGLE-WRITER-COMPLETION)                                                                                                                                                                                                     | None                                                            |
| **CI/CD Pipeline**     | PARTIAL  | Reusable workflows + lifecycle gate exist; vitest 843/843; Jest quarantined separately                                                                                                                                                                                                          | Jest tests in `test/` partially broken (separate infra)         |
| **Observability**      | VERIFIED | FM-2/FM-5/FM-9 closed; outbox depth + orphaned picks + worker heartbeat in /health; `packages/observability` build verified PASS (SPRINT-OBSERVABILITY-BUILD-FIX)                                                                                                                               | None                                                            |

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

| Component              | Status        | Notes                                                                                                                                        |
| ---------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript Compilation | CLEAN         | 0 errors (scripts/ excluded via tsconfig; shebang fixed)                                                                                     |
| Test Suite (Vitest)    | CLEAN         | 843/843 passing — scoped to `src/**/__tests__/` (+101 Discord/Recap verification tests SPRINT-DISCORD-RECAP-VERIFICATION)                    |
| Test Suite (Jest)      | PARTIAL       | `test/` Jest suite: 14 pass, ~79 quarantined/broken                                                                                          |
| Single-Writer Gate     | PASS          | 0 violations, 0 allowlisted (SPRINT-SINGLE-WRITER-COMPLETION)                                                                                |
| Build (API)            | PASS          | `pnpm --filter unit-talk-platform run build` exits 0 (SPRINT-OBSERVABILITY-BUILD-FIX)                                                        |
| Build (Command Center) | PASS          | `pnpm --filter unit-talk-command-center run build` exits 0; dynamic server warnings during SSG are expected (SPRINT-OBSERVABILITY-BUILD-FIX) |
| Build (Smart Form)     | BROKEN        | Next.js 14.2.35 pnpm extraction fails on Windows (`dist/bin/next` missing); pre-existing, not caused by any sprint                           |
| Git Status             | CLEAN         | No uncommitted changes on sprint branch                                                                                                      |
| Database Schema        | 73 migrations | Latest: Mar 8, 2026                                                                                                                          |

---

## Agent Status

| Agent                 | Lifecycle Compliant | Active | Notes                                                                                                                                               |
| --------------------- | ------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| GradingAgent          | YES                 | YES    | Uses `lifecycleInsert()` with `promoter` role; RiskEngine pre-flight gate (fail-closed); passes sizing inputs (winProb + decimalOdds) to RiskEngine |
| SettlementAgent       | YES                 | YES    | Uses `lifecycleSettle()` with `settler` role                                                                                                        |
| DiscordPromotionAgent | YES                 | YES    | Uses `atomicClaimForPost()`; L988-993 bypass removed (SPRINT-SINGLE-WRITER-COMPLETION)                                                              |
| RecapAgent            | YES                 | YES    | Uses `lifecycleUpdate()`                                                                                                                            |
| IngestionAgent        | N/A                 | YES    | Writes to `provider_offers` (different table)                                                                                                       |
| FeedAgent             | N/A                 | YES    | Writes to `provider_offers`/`raw_props`                                                                                                             |
| AlertAgent            | YES                 | YES    | Migrated to `lifecycleUpdate()` (SPRINT-SINGLE-WRITER-COMPLETION)                                                                                   |
| AnalyticsAgent        | N/A                 | YES    | Read-only analytics                                                                                                                                 |
| NotificationAgent     | N/A                 | YES    | Notifications only                                                                                                                                  |
| PlayerEnrichmentAgent | N/A                 | YES    | Reads participants                                                                                                                                  |
| AuditAgent            | N/A                 | YES    | Audit trail only                                                                                                                                    |
| OperatorAgent         | N/A                 | YES    | Manual operations                                                                                                                                   |

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
