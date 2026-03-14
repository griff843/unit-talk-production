# Next 5 Sprints

**Last Updated**: 2026-03-14 (SPRINT-043-LAYER2-PHASE7-RELIABILITY-MONITORING)
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

## Sprint 1: SPRINT-044 — TBD

**Priority**: TBD **Phase**: TBD **Linear**: TBD

**Note**: SPRINT-044 is next. Define scope via `/sprint-plan` before beginning.
Phase 4 automation work (edge ranking feeds, market alerts) or further Layer 2
refinements are likely candidates.

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
| 1     | SPRINT-044 TBD                    | TBD      | TBD         | Define via /sprint-plan                               | TBD       |

**Total estimated effort**: 3-5 days **Dependency chain**: All sprints are
independent and can run in any order.
