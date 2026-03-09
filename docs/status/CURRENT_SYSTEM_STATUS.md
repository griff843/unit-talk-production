# Current System Status

**Last Updated**: 2026-03-09 **Audit Source**: SPRINT-PLATFORM-TRUTH-AUDIT
(automated code-level analysis)

---

## Subsystem Readiness Matrix

| Subsystem              | Status     | Evidence                                                                                    | Blocking Issues                                       |
| ---------------------- | ---------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Ingestion**          | PARTIAL    | SGO + OddsAPI on V3 path; Optimal API still legacy                                          | Optimal adapter not wired to `provider_offers`        |
| **Scoring**            | VERIFIED   | GradingAgent + ProfessionalPropProcessor complete; provider_offers as default source        | None                                                  |
| **Promotion**          | PARTIAL    | Code complete; outbox pattern implemented; promotion policy DISABLED by default             | `PROMOTION_POLICY_V2=false` default                   |
| **Settlement**         | VERIFIED   | lifecycleSettle + TOCTOU lock + idempotency preflight; no raw_props dependency              | None                                                  |
| **Recaps**             | PARTIAL    | RecapAgent infra complete; daily/weekly triggers exist; live posting deprecated (by design) | Needs runtime verification                            |
| **Command Center**     | VERIFIED   | READ-ONLY; health + ops-confidence + monitoring endpoints                                   | None                                                  |
| **Analytics**          | VERIFIED   | AnalyticsAgent + metrics server + CLV computation + loss attribution                        | Needs runtime verification                            |
| **Discord Bot**        | UNVERIFIED | Standalone bot exists; integration unclear                                                  | No recent sprint work                                 |
| **Smart Form**         | VERIFIED   | Writes to `bridge_outbox` only; form validation complete                                    | None                                                  |
| **Lifecycle Adapters** | PARTIAL    | Core adapters (insert/update/settle/claim) complete; 13 legacy violations pending           | Single-writer migration overdue                       |
| **CI/CD Pipeline**     | PARTIAL    | Reusable workflows + lifecycle gate exist; test suite 89% broken                            | Test imports broken                                   |
| **Observability**      | PARTIAL    | OpenTelemetry + logging + agent health heartbeat exist; package build fails                 | `@opentelemetry/api` missing in observability package |

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

| Component              | Status                | Notes                                             |
| ---------------------- | --------------------- | ------------------------------------------------- |
| TypeScript Compilation | BROKEN                | 58 errors in `productionDashboard.ts`             |
| Test Suite             | BROKEN                | 119/133 test files fail to load                   |
| Single-Writer Gate     | PASS (with allowlist) | 13 allowlisted violations, 0 new                  |
| Build (API)            | UNVERIFIED            | Requires `pnpm --filter api run build`            |
| Build (Command Center) | UNVERIFIED            | Requires `pnpm --filter command-center run build` |
| Build (Smart Form)     | UNVERIFIED            | Requires `pnpm --filter smart-form run build`     |
| Git Status             | CLEAN                 | No uncommitted changes                            |
| Database Schema        | 73 migrations         | Latest: Mar 8, 2026                               |

---

## Agent Status

| Agent                 | Lifecycle Compliant | Active | Notes                                             |
| --------------------- | ------------------- | ------ | ------------------------------------------------- |
| GradingAgent          | YES                 | YES    | Uses `lifecycleInsert()` with `promoter` role     |
| SettlementAgent       | YES                 | YES    | Uses `lifecycleSettle()` with `settler` role      |
| DiscordPromotionAgent | PARTIAL             | YES    | Uses `atomicClaimForPost()` but L988-993 bypasses |
| RecapAgent            | YES                 | YES    | Uses `lifecycleUpdate()`                          |
| IngestionAgent        | N/A                 | YES    | Writes to `provider_offers` (different table)     |
| FeedAgent             | N/A                 | YES    | Writes to `provider_offers`/`raw_props`           |
| AlertAgent            | NO                  | YES    | Direct writes (allowlisted)                       |
| AnalyticsAgent        | N/A                 | YES    | Read-only analytics                               |
| NotificationAgent     | N/A                 | YES    | Notifications only                                |
| PlayerEnrichmentAgent | N/A                 | YES    | Reads participants                                |
| AuditAgent            | N/A                 | YES    | Audit trail only                                  |
| OperatorAgent         | N/A                 | YES    | Manual operations                                 |

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
                                       │ lifecycleInsert(promoter)
                              ┌────────▼────────┐
                              │ unified_picks    │ ← CANONICAL
                              │ (lifecycle FSM)  │
                              └──┬──────────┬───┘
                                 │          │
                    ┌────────────▼──┐  ┌────▼───────────┐
                    │ Discord       │  │ Settlement     │
                    │ Promotion     │  │ Agent          │
                    │ (DISABLED)    │  │ (VERIFIED)     │
                    └───────────────┘  └────────────────┘
```

---

## Key Environment Flags

| Flag                        | Default           | Effect                         |
| --------------------------- | ----------------- | ------------------------------ |
| `GRADING_DATA_SOURCE`       | `provider_offers` | Scoring data source            |
| `USE_PRO_SCORER`            | `true`            | Professional ML scoring        |
| `USE_PROJECTIONS`           | `true`            | Projection edge integration    |
| `PROMOTION_POLICY_V2`       | `false`           | Auto-promotion (DISABLED)      |
| `PROMOTION_KILL_SWITCH`     | `false`           | Emergency promotion block      |
| `ENABLE_TEMPORAL_SCHEDULES` | `false`           | Scheduled workflows (DISABLED) |
| `DEMO_MODE`                 | `false`           | Demo/mock behavior             |
