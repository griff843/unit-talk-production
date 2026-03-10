# Next 5 Sprints

**Last Updated**: 2026-03-10 **Source**: Phase status + drift report + system
gap analysis + risk engine roadmap + Linear backlog

> **Sprint queue refreshed 2026-03-10** after SPRINT-RISK-BANKROLL-KELLY
> completion. Phase 3 (Risk Engine Dominance) is the active frontier. Phase 1/2
> cleanup runs in parallel.

---

## ~~Sprint 1: SPRINT-RISK-BANKROLL-KELLY~~ ✅ COMPLETED (2026-03-10)

> Merged via PR #141. Tag: SPRINT-RISK-BANKROLL-KELLY (CI-minted). KellySizer
> module, bankroll-aware sizing in RiskEngine, kelly_fraction: 0 replaced in
> ProfessionalPropProcessor. 666/666 tests passing.

---

## Sprint 1: SPRINT-RISK-EXPOSURE-CORRELATION

**Priority**: P1 — HIGH **Phase**: Phase 3 (Risk Engine Dominance) **Estimated
Effort**: 2-3 days **Linear**: UNI-54

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

**Why First**: Completes the core risk controls. Without exposure limits and
correlation detection, the system could concentrate bets dangerously. Bankroll
state from SPRINT-RISK-BANKROLL-KELLY is now available for drawdown calculation.

---

## Sprint 2: SPRINT-OBSERVABILITY-BUILD-FIX

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

**Why Second**: Closes the last PARTIAL item in Phase 1 infrastructure and the
most actionable drift item. Build verification unblocks CI confidence. Can run
in parallel with Sprint 1.

---

## Sprint 3: SPRINT-PROMOTION-RUNTIME-ACTIVATION

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

**Why Third**: The promotion pipeline is fully wired but disabled by
configuration. This sprint validates it can be safely activated without code
changes.

---

## Sprint 4: SPRINT-DISCORD-RECAP-VERIFICATION

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

**Why Fourth**: Two subsystems are at UNVERIFIED/PARTIAL with no recent sprint
work. Verification is low-effort and unblocks Phase 4 planning.

---

## Sprint 5: SPRINT-RISK-DRAWDOWN-PROTECTION

**Priority**: P1 — HIGH **Phase**: Phase 3 (Risk Engine Dominance) **Estimated
Effort**: 2-3 days **Linear**: TBD

**Objective**: Implement drawdown protection and session-level loss tracking in
the RiskEngine to freeze promotion during losing streaks.

**Tasks**:

1. Implement daily/session loss tracking — compute realized P&L from settled
   picks
2. Implement drawdown freeze trigger — halt promotion when cumulative loss
   exceeds configurable threshold
3. Implement automatic freeze release — resume when conditions clear (new day,
   partial recovery)
4. Wire drawdown state into `RiskEngine.evaluateForPromotion()` blocked_reasons
5. Add 20+ tests for drawdown tracking, freeze trigger/release, edge cases

**Success Criteria**:

- Drawdown freeze triggers at configurable threshold (e.g., -10% of bankroll)
- Freeze blocks all promotions until release conditions met
- Daily loss tracking computed from settled `unified_picks` records
- RiskDecision includes drawdown state in warnings/blocked_reasons
- All existing tests passing + 20+ new tests

**Why Fifth**: Completes the defensive layer of Phase 3. Without drawdown
protection, a losing streak could deplete bankroll before the system reacts.

**Depends On**: SPRINT-RISK-EXPOSURE-CORRELATION (exposure caps framework)

---

## Summary

| #     | Sprint                       | Priority | Phase       | Focus                                         | Linear |
| ----- | ---------------------------- | -------- | ----------- | --------------------------------------------- | ------ |
| ~~1~~ | ~~RISK-BANKROLL-KELLY~~      | ~~P1~~   | ~~Phase 3~~ | ~~Bankroll + Kelly sizing~~ ✅ DONE           | UNI-53 |
| 1     | RISK-EXPOSURE-CORRELATION    | P1       | Phase 3     | Exposure caps + correlation + drawdown freeze | UNI-54 |
| 2     | OBSERVABILITY-BUILD-FIX      | P1       | Phase 1     | Fix otel build + lifecycle columns + builds   | UNI-55 |
| 3     | PROMOTION-RUNTIME-ACTIVATION | P1       | Phase 1→3   | Production env config + shadow validation     | UNI-56 |
| 4     | DISCORD-RECAP-VERIFICATION   | P2       | Phase 4     | Discord bot + RecapAgent runtime verify       | UNI-57 |
| 5     | RISK-DRAWDOWN-PROTECTION     | P1       | Phase 3     | Drawdown freeze + session loss tracking       | TBD    |

**Total estimated effort**: 8-12 days **Dependency chain**: Sprint 1 → Sprint 5
(sequential); Sprints 2, 3, 4 (parallel, independent)
