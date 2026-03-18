# Current Phase Status

**Last Updated**: 2026-03-18 (SPRINT-PH11-GAP-CLOSURE-4) **Authority**:
`docs/04_roadmap/layer_phase_execution_model.md` **Operational Progress**:
`docs/status/PHASE_STATUS.md`

---

## Canonical Layer / Phase Position

Per `docs/04_roadmap/layer_phase_execution_model.md`:

| Layer | Phase  | Name                         | Status                                                                                                                                                                                                                                                                                                                                                                 |
| ----- | ------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | 0      | Governance Lock              | COMPLETE                                                                                                                                                                                                                                                                                                                                                               |
| **1** | 1      | Runtime Truth                | COMPLETE                                                                                                                                                                                                                                                                                                                                                               |
| **1** | 2      | Data Truth                   | COMPLETE                                                                                                                                                                                                                                                                                                                                                               |
| **1** | 3      | Distribution Determinism     | COMPLETE                                                                                                                                                                                                                                                                                                                                                               |
| **1** | 4      | Operational Determinism      | COMPLETE (worker health + pipeline observability verified)                                                                                                                                                                                                                                                                                                             |
| **1** | **5**  | **Platform Stabilization**   | **COMPLETE** — R3 shadow guardrails + R4 fault suite wired into CI; E2E lifecycle traversal proven via R2 replay (SPRINT-LAYER1-PHASE5-E2E-CLOSURE, 2026-03-14)                                                                                                                                                                                                        |
| **2** | **6**  | **Operator Control Plane**   | **COMPLETE** — GET/PUT /ops/autopilot, POST /ops/picks/:id/override, PUT /api/risk/config/:key; AutopilotGuard.persistMode(); migration 20260314120000; 12 new vitest tests (SPRINT-042-LAYER2-PHASE6-OPERATOR-CONTROL-PLANE, 2026-03-14)                                                                                                                              |
| **2** | **7**  | **Reliability & Monitoring** | **COMPLETE** — SLO framework (4 SLOs), GET /api/health/summary (HEALTHY/DEGRADED/CRITICAL), PlatformThresholdEvaluator, SLO_DEFINITIONS.md + ON_CALL_RUNBOOK.md; 921/921 vitest (SPRINT-043-LAYER2-PHASE7-RELIABILITY-MONITORING, PR #191, UNI-74 Done)                                                                                                                |
| **2** | **8**  | **Recovery & Replay**        | **COMPLETE** — POST /ops/recovery/replay + GET /ops/recovery/replays; deterministic replay from production journal; JOURNAL_BACKUP_PROCEDURE.md; ON_CALL_RUNBOOK.md Scenario 6; 926/926 vitest (SPRINT-044-LAYER2-PHASE8-RECOVERY-REPLAY, PR #199, UNI-77 Done)                                                                                                        |
| **3** | **9**  | **SmartForm UX**             | **COMPLETE** — WCAG 2.1 AA (aria-labels, htmlFor, role attributes); 5 form components; bridge_outbox single-writer compliance; idempotency via bet_slip_id; client+server Zod validation; 8 custom SmartForm gates (SPRINT-051, PR #227, UNI-86 Done)                                                                                                                  |
| **3** | **10** | **Command Center UX**        | **COMPLETE** — 18 production dashboard pages; 60+ API proxy routes; 100% RBAC auth coverage (69 routes, 5 roles, 13 permissions); PermissionGate UI; audit trail on all actions; 104+ CC vitest (SPRINT-049/050/054/058/061/074/075/082)                                                                                                                               |
| **3** | **11** | **Workflow Optimization**    | **COMPLETE** — WorkflowRegistry 18 entries/6 categories; batch operations (promote/reject/requeue up to 100); 15 Temporal schedules (4 routine analysis added); pnpm ops:list CLI; core pipeline fully automated; routine analysis workflows scheduled (SPRINT-PH11-GAP-CLOSURE-2); workflow failure escalation to operator Discord alerts (SPRINT-PH11-GAP-CLOSURE-3) |
| 4     | 12     | Edge Detection               | PLANNED                                                                                                                                                                                                                                                                                                                                                                |
| 4     | 13     | Market Resistance            | PLANNED                                                                                                                                                                                                                                                                                                                                                                |
| 4     | 14     | CLV Analytics                | PLANNED                                                                                                                                                                                                                                                                                                                                                                |

**Layer 3 status**: COMPLETE — Phases 9, 10, and 11 all COMPLETE. All bounded
gaps from the Layer 3 exit audit have been closed.

**Next planned work**: Layer 4 planning.

---

## Layer 1 Completion Gate

**Layer 1 is COMPLETE as of 2026-03-14 (SPRINT-LAYER1-PHASE5-E2E-CLOSURE).**

**Phase 5 final status:**

- ~~Commit R1–R5 verification infrastructure to git (DRIFT-H5)~~ ✅ RESOLVED —
  PR #157 merged (a6f69276), 53 files on origin/main
- ~~Validate shadow mode (R3) and fault injection (R4) in CI~~ ✅ COMPLETE —
  `shadow-guardrails` + `fault-suite` jobs wired into `ci.yml`; 7/7 + 10/10
  gates pass
- ~~Complete E2E smoke test suite (full-lifecycle pick proof)~~ ✅ COMPLETE — R2
  deterministic replay: 11 events, 3 picks, full path
  (SUBMITTED→GRADED→POSTED→SETTLED→RECAP), SHA-256 verified

**Layer 2 work is now unblocked.**

Note: R5 (Execution Simulation) is classified as Layer 4 / Phase 12 per
`docs/04_roadmap/layer_phase_execution_model.md` §7. It is not a Phase 5 gating
requirement.

---

## Layer 2 Completion Gate

**Layer 2 is COMPLETE as of 2026-03-14.**

All three Layer 2 phases delivered and verified:

- **Phase 6 — Operator Control Plane**: COMPLETE (SPRINT-042, PR #189) — GET/PUT
  /ops/autopilot, POST /ops/picks/:id/override, PUT /api/risk/config/:key;
  AutopilotGuard.persistMode() + setCanaryPercentage(); 12 new vitest tests
- **Phase 7 — Reliability & Monitoring**: COMPLETE (SPRINT-043, PR #191, UNI-74
  Done) — 4 SLOs, unified health summary, PlatformThresholdEvaluator alerting,
  SLO_DEFINITIONS.md + ON_CALL_RUNBOOK.md; 11 new vitest tests
- **Phase 8 — Recovery & Replay**: COMPLETE (SPRINT-044, PR #199, UNI-77 Done) —
  POST /ops/recovery/replay, GET /ops/recovery/replays, journal backup
  procedure, ON_CALL_RUNBOOK.md Scenario 6; 5 new vitest tests

**Post-completion verification**: SPRINT-LAYER2-PLATFORM-VERIFICATION-LOCK
(2026-03-14) — 1,569/1,569 tests passing, all 8 subsystems VERIFIED, 19 findings
(0 P0, 3 P1, 9 P2). P1 findings remediated:

- F-001 (weak auth) → SPRINT-045-OPERATOR-AUTH-HARDENING (JWT on all /ops
  routes)
- F-003 (schema drift) → SPRINT-045-SCHEMA-TYPE-SYNC (35 tables regenerated)

**Post-verification hardening sprints**:

- SPRINT-046-OPERATOR-AUDIT-TRAIL — immutable audit log + query endpoint
- SPRINT-047-INGESTION-UNIT-COVERAGE-LOCK — 45 IngestionAgent unit tests

**Layer 3 work is now unblocked.**

---

## Layer 3 Completion Gate

**Layer 3 is COMPLETE as of 2026-03-18.**

All three Layer 3 phases delivered and verified.

### Phase 9 — SmartForm UX: COMPLETE

- 5 form components (BetSlipPanel, GamePickForm, ManualEntryForm,
  SportsbookManualEntry, KeyboardShortcutsHelp), all non-trivial (128–1691 LOC)
- WCAG 2.1 AA compliance: aria-labels, htmlFor/id, role=alert+aria-live,
  aria-expanded, aria-controls across all components
- Single-writer compliance: V3 endpoint writes exclusively to `bridge_outbox`
- Idempotency: `bet_slip_id` uniqueness check before insert, duplicate detection
- Validation: Client-side (validation.ts) + server-side (Zod schema in route.ts)
- Error handling: Toast notifications, validation errors, loading states
- Test coverage: Unit tests (validation, reducer) + E2E Playwright tests
- Build gates: 8 custom SmartForm gates (no-mocks, no-bypass, endpoints,
  contracts, runtime-audit, no-dev-routes, no-direct-db, no-fallback)

### Phase 10 — Command Center UX: COMPLETE

- 18 production dashboard pages (13 primary, 5 secondary), all with real data
  fetching, loading/error states, and proper Next.js 'use client' directives
- 60+ API proxy routes covering: agents, alerts, analytics, cappers, health,
  picks, replay, risk, settlement, workflows, remediation, ops-submit, audit,
  grading, monitoring, temporal, lifecycle, admin controls
- 100% RBAC auth coverage: 69 business routes protected via
  `requireOperatorIdentity` + `enforcePermission`; only `/api/health` (k8s
  probe) intentionally unprotected
- 5 RBAC roles (CAPPER, ANALYST, VIEWER, OPS, ADMIN) with 13 permission types
- PermissionGate UI component gates sensitive features client-side
- Audit trail: RBACService logs every action with actor, IP, timestamp, resource
- 104+ CC vitest tests across 11 test files

**P2 Defect (resolved)**: `useAgentLogs.ts` mock data bypass — **CLOSED**
(SPRINT-PHASE11-GAP-CLOSURE-1, PR #314). Hook now queries real `agent_logs`
table with fail-closed error handling.

### Phase 11 — Workflow Optimization: COMPLETE

**Delivered:**

- WorkflowRegistry: 18 entries across 6 categories (analysis, backfill, feed,
  health, settlement, ops)
- Batch operations: promote/reject/requeue up to 100 picks per request via
  lifecycle adapters with audit logging
- Temporal scheduling: 15 schedules configured (11 original + 4 routine analysis
  added by SPRINT-PH11-GAP-CLOSURE-2)
- Operator CLI: `pnpm ops:list` with category filtering + risk indicators; 6+
  operator commands (workflows:start, workflows:status, recap:daily, etc.)
- Core automation: pick submission → grading → promotion → alerts fully
  automated
- Settlement and recap agent code complete but fail-closed behind env flags

**Gaps closed (from Layer 3 exit audit bounded punch list):**

1. ~~Routine analysis/backfill workflows manual-trigger only~~ → **CLOSED**
   (SPRINT-PH11-GAP-CLOSURE-2, PR #315): 4 analysis workflows now have Temporal
   scheduled triggers (verify-slo every 30m, check-grading-status every 15m,
   analyze-grading-promotion daily 4 AM, edge-validation-report daily 5 AM)
2. ~~No workflow failure escalation~~ → **CLOSED** (SPRINT-PH11-GAP-CLOSURE-3,
   PR #316): all 4 scheduled analysis workflows now call `sendWorkflowFailure()`
   on error, posting critical alerts to Discord operator webhook; 11 escalation
   tests
3. **Settlement/recap scheduling policy** — intentional fail-closed design.
   SettlementAgent requires `SETTLEMENT_AGENT_ENABLED=true` and recap schedules
   require `ENABLE_RECAP_SCHEDULES=true`. These are deliberate operator-gated
   env flags, not a deficiency. No action required.

**P2 defect** (useAgentLogs.ts mock data bypass): **CLOSED**
(SPRINT-PHASE11-GAP-CLOSURE-1, PR #314)

---

## Operational Progress Reference

The pre-canonicalization operational phase tracking is at
`docs/status/PHASE_STATUS.md`. That file uses different phase naming (Structural
Dominance, Intelligence Superiority, etc.) and tracks completion percentages for
ongoing work streams.

The two documents serve different purposes:

- This file → canonical layer/phase position (governance classification)
- `docs/status/PHASE_STATUS.md` → operational progress tracking (work completion
  %)
