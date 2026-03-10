# Next 5 Sprints

**Last Updated**: 2026-03-10 **Source**: Phase status + drift report + system
gap analysis + risk engine roadmap + Linear backlog

> **Sprint queue refreshed 2026-03-10** after SPRINT-RISK-EXPOSURE-CORRELATION
> completion. Phase 3 core risk controls complete (70%). Focus shifts to Phase 1
> completion, promotion activation, and Phase 4 entry.

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

## Sprint 1: SPRINT-OBSERVABILITY-BUILD-FIX

**Priority**: P1 — HIGH **Phase**: Phase 1 (Structural Dominance — completion)
**Estimated Effort**: 1 day **Linear**: UNI-55 **Closes**: DRIFT-M5

**Objective**: Fix `packages/observability` build failure and add lifecycle
contract database columns.

**Tasks**:

1. Add `@opentelemetry/api` as dependency to `packages/observability`
2. Verify `pnpm --filter observability run build` succeeds
3. Add 6 lifecycle contract columns via migration: `promotion_queued_at`,
   `promotion_posted_at`, `blocked_at`, `blocked_reason`, `failed_at`,
   `failed_reason`
4. Update lifecycle adapters to populate new columns
5. Verify all 3 app builds pass (`api`, `command-center`, `smart-form`)

**Success Criteria**:

- `packages/observability` builds cleanly (closes DRIFT-M5)
- All 3 app builds verified (currently UNVERIFIED in status)
- 6 new columns added with migration + rollback documented
- Lifecycle adapters updated to write new timestamp/reason fields
- Type-check clean, all tests passing

**Why First**: Closes the last PARTIAL item in Phase 1 infrastructure and the
most actionable drift item. Build verification unblocks CI confidence.

---

## Sprint 2: SPRINT-PROMOTION-RUNTIME-ACTIVATION

**Priority**: P1 — HIGH **Phase**: Phase 1→3 bridge **Estimated Effort**: 1-2
days **Linear**: UNI-56

**Objective**: Document and validate the production environment configuration
needed to activate the full promotion pipeline end-to-end.

**Tasks**:

1. Create production environment runbook: all required env vars, values,
   validation checklist
2. Validate promotion pipeline in shadow mode (dry run with
   `PROMOTION_SHADOW_MODE=true`)
3. Test canary routing at `PROMOTION_CANARY_PERCENT=10` with test sport
4. Verify kill switch (`PROMOTION_KILL_SWITCH=true`) halts all promotion
5. Document rollback procedure for each activation step

**Success Criteria**:

- Runbook committed with step-by-step activation guide
- Shadow mode dry run completes with 10+ picks flowing through
- Canary routing verified functional
- Kill switch verified functional
- Promotion subsystem status can move PARTIAL → VERIFIED

**Why Second**: The promotion pipeline is fully wired but disabled by
configuration. This sprint validates it can be safely activated without code
changes.

---

## Sprint 3: SPRINT-DISCORD-RECAP-VERIFICATION

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

## Sprint 4: SPRINT-RISK-DASHBOARD-MONITORING

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

## Sprint 5: SPRINT-JEST-QUARANTINE-CLEANUP

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

| #     | Sprint                        | Priority | Phase     | Focus                                         | Linear |
| ----- | ----------------------------- | -------- | --------- | --------------------------------------------- | ------ |
| ~~1~~ | ~~RISK-BANKROLL-KELLY~~       | ~~P1~~   | ~~Ph 3~~  | ~~Bankroll + Kelly sizing~~ ✅ DONE           | UNI-53 |
| ~~1~~ | ~~RISK-EXPOSURE-CORRELATION~~ | ~~P1~~   | ~~Ph 3~~  | ~~Exposure + correlation + drawdown~~ ✅ DONE | UNI-54 |
| 1     | OBSERVABILITY-BUILD-FIX       | P1       | Phase 1   | Fix otel build + lifecycle columns + builds   | UNI-55 |
| 2     | PROMOTION-RUNTIME-ACTIVATION  | P1       | Phase 1→3 | Production env config + shadow validation     | UNI-56 |
| 3     | DISCORD-RECAP-VERIFICATION    | P2       | Phase 4   | Discord bot + RecapAgent runtime verify       | UNI-57 |
| 4     | RISK-DASHBOARD-MONITORING     | P2       | Phase 3   | Risk state visibility in Command Center       | TBD    |
| 5     | JEST-QUARANTINE-CLEANUP       | P2       | Phase 1   | Triage quarantined tests, close DRIFT-L2      | TBD    |

**Total estimated effort**: 7-11 days **Dependency chain**: All sprints are
independent and can run in any order.
