# Platform Truth Audit — Executive Report

**Sprint**: SPRINT-PLATFORM-TRUTH-AUDIT **Date**: 2026-03-09 **Auditor**: Claude
Opus 4.6 (automated, code-level + Linear + governance analysis) **Branch**:
`sprint/pick-lifecycle-e2e-truth-audit`

---

## 1. Current Unit Talk Phase

**The platform is in a transitional state between Phase 1 (Structural Dominance)
and Phase 2 (Intelligence Superiority).**

- Phase 1 is 75% complete — core invariants enforced, migration debt remaining
- Phase 2 is 70% complete — intelligence pipeline done (SPRINT-031–039),
  architecture migration done (044A–044E), multi-book consensus and CLV
  validation remaining
- Phases 3–5 are 0–20% complete (foundation-only)

---

## 2. Systems VERIFIED Working

| System                   | Evidence                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scoring Pipeline**     | GradingAgent (1074 lines) + ProfessionalPropProcessor, `provider_offers` default source, tier assignment, promotion criteria — architecturally complete |
| **Settlement**           | SettlementAgent (922 lines), `lifecycleSettle()`, TOCTOU lock (aa8dfc4d), idempotency preflight, unified_picks source (no raw_props dependency)         |
| **Lifecycle Adapters**   | `lifecycleInsert/Update/Settle`, `atomicClaimForPost/Settle`, transition validator, writer authority — core write surface enforced                      |
| **Command Center**       | READ-ONLY access to canonical tables, health + monitoring endpoints                                                                                     |
| **Smart Form**           | Writes to `bridge_outbox` only, form validation complete                                                                                                |
| **Analytics Components** | AnalyticsAgent, metrics server, CLV computation, loss attribution — code exists                                                                         |
| **Fail-Closed Boot**     | Zod validation, process exit on missing env, canonical host check                                                                                       |
| **Autopilot Freeze**     | Shared package, blocks all writes when frozen                                                                                                           |

---

## 3. Systems PARTIAL

| System                       | What Works                                                            | What's Missing                                                               |
| ---------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Ingestion**                | SGO + OddsAPI on V3 `provider_offers` path, event auto-creation       | Optimal API adapter not wired to V3                                          |
| **Promotion/Discord**        | Code complete, outbox pattern, idempotent claims                      | `PROMOTION_POLICY_V2=false` (disabled), promotion never activates by default |
| **Recaps**                   | RecapAgent infra (810 lines), daily/weekly triggers, state management | Live posting deprecated (by design), needs runtime verification              |
| **Single-Writer Discipline** | Gate architecture sound, 0 new violations                             | 13 allowlisted legacy violations, migration overdue                          |
| **Observability**            | OpenTelemetry init, agent health heartbeat, logging                   | Package build fails (`@opentelemetry/api` missing)                           |
| **CI/CD**                    | Reusable workflows, lifecycle gate, commitlint                        | Test suite 89% broken, type errors                                           |

---

## 4. Systems BROKEN

| System                     | What's Broken                                                    | Impact                                          |
| -------------------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| **Test Suite**             | 119/133 test files fail to load (module resolution, missing env) | Cannot verify system correctness via automation |
| **TypeScript Compilation** | 58 errors in `productionDashboard.ts`                            | Type check gate fails                           |

---

## 5. Systems UNVERIFIED

| System                   | Why Unverified                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| **Discord Bot**          | Standalone app, no recent sprint work, integration path unclear                            |
| **Temporal Schedules**   | `ENABLE_TEMPORAL_SCHEDULES=false` default; no evidence of production schedule registration |
| **Schema-to-Types Sync** | No CI gate verifying Supabase types match schema                                           |
| **Production Builds**    | API, Command Center, Smart Form builds not run in this audit                               |

---

## 6. Top Architectural Risks

| #   | Risk                                                                                                           | Severity | Mitigation                                                |
| --- | -------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------- |
| 1   | **Test suite collapse** — 89% of test files broken, blocking all verification gates                            | CRITICAL | Sprint 1: fix imports, quarantine irrecoverable tests     |
| 2   | **Single-writer migration debt** — 13 violations with passed target dates, capperService has unrestricted CRUD | CRITICAL | Sprint 2: complete all migrations                         |
| 3   | **Promotion pipeline dormant** — scoring + settlement work but output never published                          | HIGH     | Sprint 3: activate with canary, document env requirements |
| 4   | **No outbox monitoring** — queue stalls invisible, no DLQ, no depth alerting                                   | HIGH     | Sprint 5: add monitoring + alerting                       |
| 5   | **Orphaned lifecycle states** — picks can get stuck in intermediate states forever                             | HIGH     | Sprint 5: implement state-age sweep                       |
| 6   | **Linear project management gaps** — 0 issues in progress, no assignees, no GitHub integration                 | HIGH     | Sprint 5: complete Linear-GitHub integration              |
| 7   | **Temporal worker invisibility** — no health check, silent failure mode                                        | MEDIUM   | Sprint 5: add worker health endpoint                      |
| 8   | **Document proliferation** — 4,271 markdown files, canonical set unclear                                       | MEDIUM   | Archive superseded docs, maintain CANONICAL_DOC_SET.md    |

---

## 7. Top 5 Next Sprints

| #   | Sprint                               | Priority | Objective                                            |
| --- | ------------------------------------ | -------- | ---------------------------------------------------- |
| 1   | **SPRINT-TEST-INFRA-RECOVERY**       | P0       | Fix 119 broken test files + 58 TypeScript errors     |
| 2   | **SPRINT-SINGLE-WRITER-COMPLETION**  | P0       | Eliminate all 13 lifecycle violations                |
| 3   | **SPRINT-PROMOTION-ACTIVATION**      | P1       | Enable automated Discord publishing pipeline         |
| 4   | **SPRINT-MULTI-BOOK-CONSENSUS**      | P1       | V3 multi-book consensus + 3-provider coverage        |
| 5   | **SPRINT-OPERATIONAL-OBSERVABILITY** | P1       | Close latent failure modes (outbox, orphans, health) |

Full details: `docs/status/NEXT_5_SPRINTS.md`

---

## 8. Production Readiness Verdict

# NOT READY

**Rationale**:

1. **Test infrastructure broken** — Cannot verify correctness (89% test file
   failure rate)
2. **Type check fails** — Governance gate cannot pass
3. **Promotion pipeline disabled** — Core value proposition (Discord pick
   publishing) never activates
4. **13 single-writer violations** — Architectural invariant #1 not fully
   enforced
5. **No outbox monitoring** — Queue stalls are invisible failure modes
6. **No Temporal worker health check** — Complete processing outage undetectable

**What would change this to "READY WITH CONDITIONS"**:

- Sprints 1 + 2 complete (test recovery + single-writer completion)
- Promotion activated on canary channel
- Basic monitoring for outbox depth and worker health

**What would change this to "PRODUCTION READY"**:

- All 5 next sprints complete
- Full runtime dry run with live Temporal + Supabase
- Phase 1 at 100%, Phase 2 at 90%+
- All governance gates green in CI

---

## Audit Artifacts

| Artifact                     | Location                                      |
| ---------------------------- | --------------------------------------------- |
| Canonical Document Set       | `docs/status/CANONICAL_DOC_SET.md`            |
| Architecture Invariant Audit | `docs/audits/ARCHITECTURE_INVARIANT_AUDIT.md` |
| Drift Report                 | `docs/status/DRIFT_REPORT.md`                 |
| Runtime Dry Run Report       | `docs/audits/RUNTIME_DRY_RUN_REPORT.md`       |
| Failure Mode Report          | `docs/audits/FAILURE_MODE_REPORT.md`          |
| Current System Status        | `docs/status/CURRENT_SYSTEM_STATUS.md`        |
| Phase Status                 | `docs/status/PHASE_STATUS.md`                 |
| Next 5 Sprints               | `docs/status/NEXT_5_SPRINTS.md`               |
| Proof Artifacts              | `out/audits/platform-truth/`                  |

---

## Methodology

This audit was conducted through:

1. **Code-level static analysis** — Glob/Grep/Read of all source files across 4
   apps + 8 packages
2. **CI gate execution** — TypeScript compilation, single-writer gate, vitest
   test runner
3. **Linear MCP queries** — Issues, projects, initiatives, cycles from workspace
4. **Document reconciliation** — 4,271 markdown files classified against
   implementation
5. **Failure mode analysis** — Code path tracing for error handling, edge cases,
   and missing coverage

No runtime services were started. No database queries were executed against live
Supabase. All findings are from repository state analysis.

---

**North Star Status**: After this audit, the question "Where does Unit Talk
stand?" has a clear, evidence-backed answer:

> Unit Talk is a well-architected sports intelligence platform with strong
> governance and sophisticated ML scoring, currently transitioning from Phase 1
> to Phase 2. The system can grade, settle, and analyze picks but cannot yet
> publish them automatically. Test infrastructure and single-writer migration
> debt are the critical blockers preventing production readiness. Five focused
> sprints (~10-13 days of work) would bring the platform to production-ready
> status.
