# Next 5 Sprints

**Last Updated**: 2026-03-14 (SPRINT-044-LAYER2-PHASE8-RECOVERY-REPLAY)
**Source**: Phase status + drift report + system gap analysis + risk engine
roadmap + Linear backlog

> **PHASE NAMING NOTICE** (added 2026-03-13): "Phase" labels in this file use
> the operational naming convention from `docs/status/PHASE_STATUS.md`. For
> canonical sprint classification, consult
> `docs/04_roadmap/layer_phase_execution_model.md`. The canonical Layer/Phase
> equivalent is noted inline where applicable.

> **Sprint queue refreshed 2026-03-10** after
> SPRINT-PROMOTION-RUNTIME-ACTIVATION completion. Promotion VERIFIED. Focus
> shifts to Phase 4 entry (Discord/Recaps), risk visibility, and test debt
> cleanup.

---

## ~~Sprint 1: SPRINT-RISK-BANKROLL-KELLY~~ ✅ COMPLETED (2026-03-10)

> Merged via PR #141. Tag: SPRINT-RISK-BANKROLL-KELLY (CI-minted). KellySizer
> module, bankroll-aware sizing in RiskEngine, kelly_fraction: 0 replaced in
> ProfessionalPropProcessor. 666/666 tests passing.

---

## ~~Sprint 1: SPRINT-RISK-EXPOSURE-CORRELATION~~ ✅ COMPLETED (2026-03-10)

> Merged via PR #142. Tag: SPRINT-RISK-EXPOSURE-CORRELATION (CI-minted). Sport
> exposure caps, CorrelationDetector, DrawdownTracker wired into RiskEngine.
> Also completes the scope of Sprint 5 (RISK-DRAWDOWN-PROTECTION). 701/701 tests
> passing.

---

## ~~Sprint 1: SPRINT-OBSERVABILITY-BUILD-FIX~~ ✅ COMPLETED (2026-03-10)

> Merged via PR #146. Tag: SPRINT-OBSERVABILITY-BUILD-FIX (CI-minted).
> Observability build verified PASS (DRIFT-M5 was pnpm Windows extraction issue
> — `@opentelemetry/api` already declared). API + Command Center builds verified
> PASS. Smart Form documented as pre-existing BROKEN. Lifecycle visibility
> columns already fully implemented (no work needed). 701/701 tests passing.

---

## ~~Sprint 1: SPRINT-PROMOTION-RUNTIME-ACTIVATION~~ ✅ COMPLETED (2026-03-10)

> Merged via PR #149. Tag: SPRINT-PROMOTION-RUNTIME-ACTIVATION (CI-minted).
> Enhanced runbook with staged activation (shadow→canary→prod), 12-var env
> reference, 41 guard tests, monitoring checklist, rollback procedures.
> Promotion: PARTIAL → VERIFIED. Vitest: 701 → 742.

---

## ~~Sprint 1: SPRINT-DISCORD-RECAP-VERIFICATION~~ ✅ COMPLETED (2026-03-10)

> Merged via PR #152. Tag: SPRINT-DISCORD-RECAP-VERIFICATION (CI-minted).
> Discord Bot: UNVERIFIED → VERIFIED (37+ commands, 16 services, 6 health
> endpoints, K8s-ready). RecapAgent: PARTIAL → VERIFIED (lifecycle-compliant,
> Temporal workflows, embed generation). 101 new verification tests (81
> recapUtils + 20 discordRouting). Vitest: 742 → 843.

---

## ~~Sprint 1: SPRINT-LAYER1-PHASE5-E2E-CLOSURE~~ ✅ COMPLETED (2026-03-14)

> Shadow guardrails + fault suite wired into CI; R2 deterministic replay proves
> full lifecycle traversal (SUBMITTED→GRADED→POSTED→SETTLED→RECAP, SHA-256
> verified). Phase 5 COMPLETE. Layer 1 COMPLETE. Layer 2 now unblocked. Proof:
> `out/sprints/SPRINT-LAYER1-PHASE5-E2E-CLOSURE/2026-03-14/`

---

## ~~Sprint: SPRINT-CLAUDE-OS-UPGRADE-COS001-005~~ ✅ COS-001 DONE / COS-002–005 IN REVIEW (2026-03-14)

> COS-001 complete: MODEL_SELECTION.md, sprint-plan Model/Routing fields (UNI-64
> Done). COS-002–005 in PR #170 on `sprint/claude-os-cos004-lane-model-rules`:
> Linear sync automation (UNI-65), phase proof template + generator (UNI-66),
> lane model rules (UNI-67), session baseline auto-trigger hook (UNI-68). PR
> #169 is redundant (superseded by #170 — close before merging).

---

## ~~Sprint 1: SPRINT-RISK-DASHBOARD-MONITORING~~ ✅ COMPLETED (2026-03-14)

> `/api/risk/status` + `/api/risk/decisions` endpoints added;
> `computeCorrelation` + `computeDrawdown` public methods on RiskEngine;
> CorrelationPanel + DrawdownPanel in Command Center; DRIFT-L4 closed (false
> positive); 898/898 vitest; PR #177, UNI-69 Done.

---

## ~~Sprint 1: SPRINT-JEST-QUARANTINE-CLEANUP~~ ✅ COMPLETED (2026-03-14)

> All 58 quarantined Jest tests permanently deleted with documented rationale
> (MANIFEST.md). DRIFT-L2 closed. CI/CD Pipeline: PARTIAL → VERIFIED. Jest:
> 643/643 passing (35 suites, 0 quarantined). Vitest: 898/898 passing. PR merged
> to main, tag SPRINT-JEST-QUARANTINE-CLEANUP minted by CI. UNI-70 Done.

---

## ~~Sprint 1: SPRINT-041-MARKET-TYPE-EXPOSURE-CAPS~~ ✅ COMPLETED (2026-03-14)

> Market-type level exposure caps added to ExposureCalculator
> (markets!inner(category) join + byMarketType aggregation + breach detection);
> market_type_kelly_limit = 0.35 config seeded; MarketTypePanel + 3-col grid in
> Command Center risk dashboard; Phase 3 → 100% complete. 5 new vitest tests;
> 901/903 vitest; PR #185.

---

## ~~Sprint 1: SPRINT-042-LAYER2-PHASE6-OPERATOR-CONTROL-PLANE~~ ✅ COMPLETED (2026-03-14)

> Layer 2 / Phase 6 — Operator Control Plane. Added GET/PUT /ops/autopilot, POST
> /ops/picks/:id/override, PUT /api/risk/config/:key; AutopilotGuard
> persistMode() + setCanaryPercentage(); migration 20260314120000; 12 new vitest
> tests; 910/910 vitest clean. PR #189.

---

## ~~Sprint 1: SPRINT-043-LAYER2-PHASE7-RELIABILITY-MONITORING~~ ✅ COMPLETED (2026-03-14)

> Layer 2 / Phase 7 — Reliability & Monitoring. SLO framework (4 SLOs + GET
> /api/slo/status); GET /api/health/summary (HEALTHY/DEGRADED/CRITICAL);
> PlatformThresholdEvaluator; SLO_DEFINITIONS.md + ON_CALL_RUNBOOK.md; 11 new
> vitest tests; 921/921 vitest. PR #191.

---

## ~~Sprint 1: SPRINT-044-LAYER2-PHASE8-RECOVERY-REPLAY~~ ✅ COMPLETED (2026-03-14)

> Layer 2 / Phase 8 — Recovery & Replay. POST /ops/recovery/replay + GET
> /ops/recovery/replays; ops-recovery.ts route; JOURNAL_BACKUP_PROCEDURE.md;
> ON_CALL_RUNBOOK.md Scenario 6; 5 new vitest tests; 926/926 vitest. Layer 2
> 100% complete. PR #199, UNI-77 Done, tag
> SPRINT-044-LAYER2-PHASE8-RECOVERY-REPLAY.

---

## ~~Sprint 1: SPRINT-LAYER2-PLATFORM-VERIFICATION-LOCK~~ ✅ COMPLETED (2026-03-14)

> Full platform verification audit after Layer 2 completion. 1,569 tests
> passing. 19 findings (0 P0, 3 P1, 9 P2). All 8 subsystems VERIFIED. Platform
> claims confirmed: observable, controllable, recoverable, deterministic.

---

## ~~Sprint 1: SPRINT-045-OPERATOR-AUTH-HARDENING~~ ✅ COMPLETED (2026-03-14)

> Weak "Bearer admin-\*" token auth replaced with JWT-based operatorAuth
> middleware in 6 files (ops.ts, ops-control.ts, ops-recovery.ts, slo.ts,
> risk.ts, api-server.ts). All gates pass: 1,569 tests, 0 TS errors, 0
> single-writer violations.

---

## ~~Sprint 1: SPRINT-045-SCHEMA-TYPE-SYNC~~ ✅ COMPLETED (2026-03-14)

> Schema types regenerated: 21 → 34 tables. All V3 canonical tables + lifecycle
> columns included. packages/shared-types/src/supabase.ts updated. All gates
> pass.

---

## ~~Sprint 1: SPRINT-046-OPERATOR-AUDIT-TRAIL~~ ✅ COMPLETED (2026-03-14)

> Immutable `operator_audit_log` table with DB trigger rejecting UPDATE/DELETE;
> `operatorAuditLog` middleware wired to all /ops and /admin routes;
> `GET /ops/audit-log` query endpoint with pagination + filters; schema types
> regenerated (35 tables); 7 new vitest; 933/933 vitest; PR #210.

---

## Sprint 1: SPRINT-047-INGESTION-UNIT-COVERAGE-LOCK

**Priority**: P2 **Phase**: L2 / Phase 7 — Reliability **Linear**: TBD

**Scope**: Provider-independent unit tests for IngestionAgent (zero current
coverage). Fixture-driven, offline-only. Covers normalization, validation,
dedup, batch processing, error handling, adapter mapping, metrics.

---

## Summary

| #     | Sprint                            | Priority | Phase       | Focus                                                 | Linear    |
| ----- | --------------------------------- | -------- | ----------- | ----------------------------------------------------- | --------- |
| ~~1~~ | ~~RISK-BANKROLL-KELLY~~           | ~~P1~~   | ~~Ph 3~~    | ~~Bankroll + Kelly sizing~~ ✅ DONE                   | UNI-53    |
| ~~1~~ | ~~RISK-EXPOSURE-CORRELATION~~     | ~~P1~~   | ~~Ph 3~~    | ~~Exposure + correlation + drawdown~~ ✅ DONE         | UNI-54    |
| ~~1~~ | ~~OBSERVABILITY-BUILD-FIX~~       | ~~P1~~   | ~~Ph 1~~    | ~~Build verification + DRIFT-M5~~ ✅ DONE             | UNI-55    |
| ~~1~~ | ~~PROMOTION-RUNTIME-ACTIVATION~~  | ~~P1~~   | ~~Ph 1→3~~  | ~~Runbook + guard tests~~ ✅ DONE                     | UNI-56    |
| ~~1~~ | ~~DISCORD-RECAP-VERIFICATION~~    | ~~P2~~   | ~~Ph 4~~    | ~~Discord bot + RecapAgent verify~~ ✅ DONE           | UNI-57    |
| ~~1~~ | ~~LAYER1-PHASE5-E2E-CLOSURE~~     | ~~P1~~   | ~~L1/Ph 5~~ | ~~Shadow/fault CI + E2E smoke proof~~ ✅ DONE         | TBD       |
| ~~–~~ | ~~CLAUDE-OS-UPGRADE-COS001-005~~  | ~~P1~~   | ~~Meta~~    | ~~COS-001 done; COS-002–005 in PR #170~~ ⏳ REVIEW    | UNI-64–68 |
| ~~1~~ | ~~RISK-DASHBOARD-MONITORING~~     | ~~P1~~   | ~~L2/Ph 7~~ | ~~Risk dashboard + audit trail~~ ✅ DONE              | UNI-69    |
| ~~1~~ | ~~JEST-QUARANTINE-CLEANUP~~       | ~~P2~~   | ~~L1/Ph 0~~ | ~~Delete quarantined tests, close DRIFT-L2~~ ✅ DONE  | UNI-70    |
| ~~1~~ | ~~041-MARKET-TYPE-EXPOSURE-CAPS~~ | ~~P1~~   | ~~Ph 3~~    | ~~Market-type caps; Phase 3 → 100%~~ ✅ DONE          | UNI-72    |
| ~~1~~ | ~~042-LAYER2-PHASE6-OPERATOR-CP~~ | ~~P1~~   | ~~L2/Ph 6~~ | ~~Operator control API + pick override~~ ✅ DONE      | TBD       |
| ~~1~~ | ~~043-LAYER2-PHASE7-RELIABILITY~~ | ~~P1~~   | ~~L2/Ph 7~~ | ~~SLO framework + health summary + alerting~~ ✅ DONE | TBD       |
| ~~1~~ | ~~044-LAYER2-PHASE8-RECOVERY~~    | ~~P1~~   | ~~L2/Ph 8~~ | ~~Recovery & Replay; Layer 2 100% complete~~ ✅ DONE  | UNI-77    |
| ~~1~~ | ~~PLATFORM-VERIFICATION-LOCK~~    | ~~P0~~   | ~~L2~~      | ~~Full platform verification audit~~ ✅ DONE          | TBD       |
| ~~1~~ | ~~045-OPERATOR-AUTH-HARDENING~~   | ~~P1~~   | ~~L2/Sec~~  | ~~JWT auth on all /ops routes~~ ✅ DONE               | TBD       |
| ~~1~~ | ~~045-SCHEMA-TYPE-SYNC~~          | ~~P1~~   | ~~Infra~~   | ~~Regenerate schema types (34 tables)~~ ✅ DONE       | TBD       |
| ~~1~~ | ~~046-OPERATOR-AUDIT-TRAIL~~      | ~~P2~~   | ~~L2/Sec~~  | ~~Immutable audit log + query endpoint~~ ✅ DONE      | TBD       |
| 1     | 047-INGESTION-UNIT-COVERAGE-LOCK  | P2       | L2/Ph 7     | IngestionAgent unit tests (offline, fixture-driven)   | TBD       |

**Total estimated effort**: 3-5 days **Dependency chain**: All sprints are
independent and can run in any order.
