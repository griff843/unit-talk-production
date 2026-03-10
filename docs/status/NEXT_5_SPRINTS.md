# Next 5 Sprints

**Last Updated**: 2026-03-09 **Source**: Phase status + drift report + system
gap analysis + risk engine roadmap + Linear backlog

> **Sprint queue populated 2026-03-09** after SPRINT-RISK-ENGINE-INTEGRATION
> completion. Phase 3 (Risk Engine Dominance) is the active frontier. Phase 1/2
> cleanup runs in parallel.

---

## Sprint 1: SPRINT-RISK-BANKROLL-KELLY

**Priority**: P1 — HIGH **Phase**: Phase 3 (Risk Engine Dominance) **Estimated
Effort**: 2-3 days **Linear**: TBD

**Objective**: Implement bankroll management and Kelly criterion dynamic sizing
in RiskEngine, replacing the current threshold-only gate with proper bet sizing.

**Tasks**:

1. Implement `BankrollManager` — track bankroll state, unit sizing, max exposure
2. Implement Kelly criterion dynamic sizing in `ExposureCalculator` (currently
   threshold-only)
3. Wire bankroll-aware sizing into `RiskEngine.evaluateForPromotion()` output
4. Add bankroll state persistence (DB table or config)
5. Add 20+ unit tests for sizing logic, edge cases, bankroll depletion

**Success Criteria**:

- `RiskEngine.evaluateForPromotion()` returns recommended unit size (not just
  allow/block)
- Kelly sizing produces correct fractional Kelly values for given edge/odds
- Bankroll limits enforced: max single-bet exposure, daily loss cap
- 630+ existing tests still passing + 20+ new tests
- Type-check clean, lifecycle gate passing

**Why First**: RiskEngine gate is wired but only does threshold checks. Without
proper sizing, promotion decisions lack portfolio-level awareness. This is the
highest-value Phase 3 deliverable.

---

## Sprint 2: SPRINT-RISK-EXPOSURE-CORRELATION

**Priority**: P1 — HIGH **Phase**: Phase 3 (Risk Engine Dominance) **Estimated
Effort**: 2-3 days **Linear**: TBD

**Objective**: Implement aggregate exposure caps, correlation controls, and
drawdown freeze rules in RiskEngine.

**Tasks**:

1. Implement aggregate exposure caps in `PortfolioRiskManager` — per-sport,
   per-event, per-market type limits
2. Implement correlation detection — identify correlated bets (same game,
   same-side, parlay overlap)
3. Implement drawdown freeze — halt promotion when drawdown exceeds threshold
4. Wire all controls into `RiskEngine.evaluateForPromotion()` decision pipeline
5. Add 20+ tests for exposure limits, correlation blocking, drawdown freeze
   trigger/release

**Success Criteria**:

- Correlated bets detected and blocked (e.g., 3+ bets on same game)
- Aggregate exposure caps enforced (e.g., max 5 units per sport per day)
- Drawdown freeze triggers at configurable threshold (e.g., -10 units)
- Freeze releases automatically when conditions clear
- All existing tests passing + 20+ new tests

**Why Second**: Completes the core risk controls. Without exposure limits and
correlation detection, the system could concentrate bets dangerously.

**Depends On**: SPRINT-RISK-BANKROLL-KELLY (bankroll state required for drawdown
calculation)

---

## Sprint 3: SPRINT-OBSERVABILITY-BUILD-FIX

**Priority**: P1 — HIGH **Phase**: Phase 1 (Structural Dominance — completion)
**Estimated Effort**: 1 day **Linear**: TBD **Closes**: DRIFT-M5

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

**Why Third**: Closes the last PARTIAL item in Phase 1 infrastructure and the
most actionable drift item. Build verification unblocks CI confidence.

---

## Sprint 4: SPRINT-PROMOTION-RUNTIME-ACTIVATION

**Priority**: P1 — HIGH **Phase**: Phase 1→3 bridge **Estimated Effort**: 1-2
days **Linear**: TBD

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

**Why Fourth**: The promotion pipeline is fully wired but disabled by
configuration. This sprint validates it can be safely activated without code
changes.

---

## Sprint 5: SPRINT-DISCORD-RECAP-VERIFICATION

**Priority**: P2 — MEDIUM **Phase**: Phase 4 (Automation Supremacy — entry)
**Estimated Effort**: 1-2 days **Linear**: TBD

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

**Why Fifth**: Two subsystems are at UNVERIFIED/PARTIAL with no recent sprint
work. Verification is low-effort and unblocks Phase 4 planning.

---

## Summary

| #   | Sprint                       | Priority | Phase     | Focus                                         |
| --- | ---------------------------- | -------- | --------- | --------------------------------------------- |
| 1   | RISK-BANKROLL-KELLY          | P1       | Phase 3   | Bankroll management + Kelly dynamic sizing    |
| 2   | RISK-EXPOSURE-CORRELATION    | P1       | Phase 3   | Exposure caps + correlation + drawdown freeze |
| 3   | OBSERVABILITY-BUILD-FIX      | P1       | Phase 1   | Fix otel build + lifecycle columns + builds   |
| 4   | PROMOTION-RUNTIME-ACTIVATION | P1       | Phase 1→3 | Production env config + shadow validation     |
| 5   | DISCORD-RECAP-VERIFICATION   | P2       | Phase 4   | Discord bot + RecapAgent runtime verify       |

**Total estimated effort**: 7-11 days **Dependency chain**: Sprint 1 → Sprint 2
(sequential); Sprints 3, 4, 5 (parallel, independent)
