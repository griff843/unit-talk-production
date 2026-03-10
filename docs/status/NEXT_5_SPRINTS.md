# Next 5 Sprints

**Last Updated**: 2026-03-10 **Source**: Phase status + drift report + system
gap analysis + risk engine roadmap + Linear backlog

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

## Sprint 1: SPRINT-DISCORD-RECAP-VERIFICATION

**Priority**: P2 — MEDIUM **Phase**: Phase 4 (Automation Supremacy — entry)
**Estimated Effort**: 1-2 days **Linear**: UNI-57

**Objective**: Verify Discord bot integration and RecapAgent runtime behavior.
Move Discord Bot from UNVERIFIED and Recaps from PARTIAL.

**Tasks**:

1. Audit Discord bot standalone deployment — verify connection, commands, health
2. Test Discord posting end-to-end with a test channel webhook
3. Verify RecapAgent daily/weekly triggers fire correctly
4. Verify recap content generation produces valid output
5. Document Discord bot operational status and any gaps

**Success Criteria**:

- Discord Bot subsystem status: UNVERIFIED → VERIFIED or documented gaps
- Recaps subsystem status: PARTIAL → VERIFIED or documented gaps
- Discord posting confirmed functional with test webhook
- RecapAgent triggers verified in Temporal workflow
- All existing tests passing

**Why Third**: Two subsystems are at UNVERIFIED/PARTIAL with no recent sprint
work. Verification is low-effort and unblocks Phase 4 planning.

---

## Sprint 2: SPRINT-RISK-DASHBOARD-MONITORING

**Priority**: P2 — MEDIUM **Phase**: Phase 3 (Risk Engine Dominance —
visibility) **Estimated Effort**: 2-3 days **Linear**: TBD

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
**Estimated Effort**: 1-2 days **Linear**: TBD **Closes**: DRIFT-L2

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

| #     | Sprint                           | Priority | Phase      | Focus                                         | Linear |
| ----- | -------------------------------- | -------- | ---------- | --------------------------------------------- | ------ |
| ~~1~~ | ~~RISK-BANKROLL-KELLY~~          | ~~P1~~   | ~~Ph 3~~   | ~~Bankroll + Kelly sizing~~ ✅ DONE           | UNI-53 |
| ~~1~~ | ~~RISK-EXPOSURE-CORRELATION~~    | ~~P1~~   | ~~Ph 3~~   | ~~Exposure + correlation + drawdown~~ ✅ DONE | UNI-54 |
| ~~1~~ | ~~OBSERVABILITY-BUILD-FIX~~      | ~~P1~~   | ~~Ph 1~~   | ~~Build verification + DRIFT-M5~~ ✅ DONE     | UNI-55 |
| ~~1~~ | ~~PROMOTION-RUNTIME-ACTIVATION~~ | ~~P1~~   | ~~Ph 1→3~~ | ~~Runbook + guard tests~~ ✅ DONE             | UNI-56 |
| 1     | DISCORD-RECAP-VERIFICATION       | P2       | Phase 4    | Discord bot + RecapAgent runtime verify       | UNI-57 |
| 2     | RISK-DASHBOARD-MONITORING        | P2       | Phase 3    | Risk state visibility in Command Center       | TBD    |
| 3     | JEST-QUARANTINE-CLEANUP          | P2       | Phase 1    | Triage quarantined tests, close DRIFT-L2      | TBD    |

**Total estimated effort**: 5-8 days **Dependency chain**: All sprints are
independent and can run in any order.
