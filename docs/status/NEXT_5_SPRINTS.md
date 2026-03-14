# Next 5 Sprints

**Last Updated**: 2026-03-14 (SPRINT-LAYER1-PHASE5-E2E-CLOSURE) **Source**:
Phase status + drift report + system gap analysis + risk engine roadmap + Linear
backlog

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

## Sprint 1: SPRINT-RISK-DASHBOARD-MONITORING

**Priority**: P1 — HIGH **Phase**: Layer 2 / Phase 7 — Reliability & Monitoring
**Estimated Effort**: 2-3 days **Linear**: TBD

> Layer 1 is COMPLETE (2026-03-14). This sprint is now unblocked.

**Objective**: Add risk state visibility to the Command Center — exposure
heatmap, correlation clusters, drawdown status, and risk decision audit trail.

**Tasks**:

1. Add `/api/risk/status` endpoint returning current ExposureState,
   CorrelationState, DrawdownState
2. Add `/api/risk/decisions` endpoint for historical risk decision audit trail
3. Build Command Center risk dashboard page with exposure/correlation/drawdown
   panels
4. Add risk event query helpers for filtering by event_type, severity, date
   range
5. Add tests for new endpoints and query helpers

**Success Criteria**:

- Risk state visible in Command Center (not just logs)
- Historical risk decisions queryable by date, sport, decision type
- Exposure heatmap shows per-sport and per-event concentration
- Drawdown freeze status clearly visible with trigger/release history
- All existing tests passing + new endpoint tests

**Why Fourth**: Core risk controls exist but are invisible to operators.
Dashboard visibility enables monitoring and tuning of risk parameters.

---

## Sprint 3: SPRINT-JEST-QUARANTINE-CLEANUP

**Priority**: P2 — MEDIUM **Phase**: Phase 1 (Structural Dominance — completion)
| Canonical: Layer 1 / Phase 0 (Governance Lock) **Estimated Effort**: 1-2 days
**Linear**: TBD **Closes**: DRIFT-L2

**Objective**: Triage and resolve quarantined Jest tests. Either fix, migrate to
vitest, or permanently archive with documented rationale.

**Tasks**:

1. Read `test/__quarantine__/MANIFEST.md` and categorize each test
2. Fix tests that are still relevant and can be repaired
3. Migrate valuable tests to vitest runner (`src/__tests__/`)
4. Archive permanently broken tests with documented "won't fix" rationale
5. Update CI to remove Jest runner if all tests migrated

**Success Criteria**:

- Quarantine count reduced from ~79 to <10
- Remaining quarantined tests documented with clear rationale
- No regression in vitest suite
- CI/CD Pipeline subsystem status: PARTIAL → VERIFIED

**Why Fifth**: Long-standing debt. Closes DRIFT-L2 and unblocks CI/CD Pipeline
moving to VERIFIED status.

---

## Summary

| #     | Sprint                           | Priority | Phase       | Focus                                              | Linear |
| ----- | -------------------------------- | -------- | ----------- | -------------------------------------------------- | ------ |
| ~~1~~ | ~~RISK-BANKROLL-KELLY~~          | ~~P1~~   | ~~Ph 3~~    | ~~Bankroll + Kelly sizing~~ ✅ DONE                | UNI-53 |
| ~~1~~ | ~~RISK-EXPOSURE-CORRELATION~~    | ~~P1~~   | ~~Ph 3~~    | ~~Exposure + correlation + drawdown~~ ✅ DONE      | UNI-54 |
| ~~1~~ | ~~OBSERVABILITY-BUILD-FIX~~      | ~~P1~~   | ~~Ph 1~~    | ~~Build verification + DRIFT-M5~~ ✅ DONE          | UNI-55 |
| ~~1~~ | ~~PROMOTION-RUNTIME-ACTIVATION~~ | ~~P1~~   | ~~Ph 1→3~~  | ~~Runbook + guard tests~~ ✅ DONE                  | UNI-56 |
| ~~1~~ | ~~DISCORD-RECAP-VERIFICATION~~   | ~~P2~~   | ~~Ph 4~~    | ~~Discord bot + RecapAgent verify~~ ✅ DONE        | UNI-57 |
| ~~1~~ | ~~LAYER1-PHASE5-E2E-CLOSURE~~    | ~~P1~~   | ~~L1/Ph 5~~ | ~~Shadow/fault CI + E2E smoke proof~~ ✅ DONE      | TBD    |
| 1     | RISK-DASHBOARD-MONITORING        | **P1**   | L2 / Ph 7   | Risk visibility (Layer 1 COMPLETE — now unblocked) | TBD    |
| 2     | JEST-QUARANTINE-CLEANUP          | P2       | L1 / Ph 0   | Triage quarantined tests, close DRIFT-L2           | TBD    |

**Total estimated effort**: 3-5 days **Dependency chain**: All sprints are
independent and can run in any order.
