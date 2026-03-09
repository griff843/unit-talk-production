# Next 5 Sprints

**Last Updated**: 2026-03-09 **Source**: Drift report + failure modes + phase
status + Linear backlog

> **Status as of 2026-03-09**: Sprints 1, 2, 3, 5 COMPLETE. Sprint 4 is next.

---

## Sprint 1: SPRINT-TEST-INFRA-RECOVERY ✅ DONE

**Priority**: P0 — CRITICAL **Phase**: Phase 1 (Structural Dominance)
**Estimated Effort**: 1-2 days

**Objective**: Restore test suite to functional state.

**Tasks**:

1. Fix 119 broken test file imports (module resolution errors)
2. Fix `productionDashboard.ts` TypeScript errors (58 errors, one file)
3. Move irrecoverable tests to `__quarantine__/` with MANIFEST entries
4. Verify `npm run type-check` passes clean
5. Verify test pass rate > 90%

**Success Criteria**:

- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → ≥90% test files pass
- All governance gates green

**Why First**: Every other sprint depends on verification gates. Without passing
tests and type checks, no sprint can be properly closed per governance rules.

---

## Sprint 2: SPRINT-SINGLE-WRITER-COMPLETION ✅ DONE

**Priority**: P0 — CRITICAL **Phase**: Phase 1 (Structural Dominance)
**Estimated Effort**: 2-3 days

**Objective**: Eliminate all 13 single-writer violations.

**Tasks**:

1. Migrate `DiscordPromotionAgent` L988-993 → `resetPostingClaim()`
2. Migrate `AlertAgent` direct writes → `lifecycleUpdate()`
3. Migrate `capperService.ts` INSERT/UPDATE/DELETE → lifecycle adapters
4. Migrate remaining 10 allowlisted files to lifecycle adapters
5. Remove all entries from `single-writer-allowlist.ts`
6. Run gate in strict mode → 0 violations, 0 allowlisted

**Success Criteria**:

- `npm run lifecycle:single-writer -- --strict` → PASS (0 violations, 0
  allowlisted)
- All tests still passing

**Why Second**: Single-writer discipline is the #1 architectural invariant.
Completing this eliminates the largest category of architectural debt.

---

## Sprint 3: SPRINT-PROMOTION-ACTIVATION ✅ DONE

**Priority**: P1 — HIGH **Phase**: Phase 1/Phase 2 bridge **Estimated Effort**:
2 days

**Objective**: Enable automated pick promotion and Discord publishing.

**Tasks**:

1. Validate promotion policy with canary picks (`PROMOTION_POLICY_V2=true`)
2. Wire `ENABLE_TEMPORAL_SCHEDULES=true` with required schedule documentation
3. Test Discord posting end-to-end with webhook
4. Document required environment variables for production activation
5. Create runbook for enabling/disabling promotion
6. Close UNI-15 (Publish outbox — Discord posting pipeline alignment)

**Success Criteria**:

- Picks graded → promoted → posted to Discord (canary channel)
- Promotion kill switch verified functional
- Runbook committed

**Why Third**: The system grades and settles picks but never publishes them.
This is the highest-value feature gap — turning latent intelligence into visible
output.

---

## Sprint 4: SPRINT-MULTI-BOOK-CONSENSUS

**Priority**: P1 — HIGH **Phase**: Phase 2 (Intelligence Superiority)
**Estimated Effort**: 3-4 days **Linear**: UNI-11, UNI-13

**Objective**: Implement V3 multi-book consensus scoring pipeline.

**Tasks**:

1. Build market offer aggregator and book adapters (UNI-13)
2. Connect V3 multi-book consensus scoring pipeline (UNI-11)
3. Wire Optimal API adapter to `provider_offers` (closing DRIFT-M3)
4. Implement consensus devig engine
5. Shadow scoring service — run V3 alongside legacy (UNI-12)

**Success Criteria**:

- 3 providers feeding `provider_offers`
- Consensus scoring producing devigged probabilities
- Shadow mode comparison with legacy scoring

**Why Fourth**: Core intelligence differentiator. Multi-book consensus is the
foundation for edge calculation accuracy.

---

## Sprint 5: SPRINT-OPERATIONAL-OBSERVABILITY ✅ DONE

**Priority**: P1 — HIGH **Phase**: Phase 1/Phase 2 bridge **Estimated Effort**:
2 days

**Objective**: Close operational blindspots identified in failure mode analysis.

**Tasks**:

1. Add outbox depth monitoring + alerting (closes FM-2)
2. Add orphaned lifecycle state sweep (closes FM-5)
3. Add Temporal worker health endpoint (closes FM-9)
4. Fix observability package build (`@opentelemetry/api` dependency)
5. Add schema-to-types synchronization CI check (closes FM-6)
6. Complete Linear-GitHub integration (closes UNI-14, DRIFT-H4)
7. Document production environment variable requirements

**Success Criteria**:

- Outbox depth alerts configured
- Orphaned pick detection running
- Worker health endpoint responding
- Observability package builds cleanly
- GitHub integration auto-linking PRs to Linear issues

**Why Fifth**: Closes the most dangerous latent failure modes before scaling the
platform. Without observability, problems become invisible until they cause
visible harm.

---

## Summary

| #   | Sprint                    | Priority | Phase     | Focus                                 |
| --- | ------------------------- | -------- | --------- | ------------------------------------- | -------- |
| 1   | TEST-INFRA-RECOVERY       | P0       | Phase 1   | Fix broken tests + type errors        | ✅ DONE  |
| 2   | SINGLE-WRITER-COMPLETION  | P0       | Phase 1   | Eliminate 13 lifecycle violations     | ✅ DONE  |
| 3   | PROMOTION-ACTIVATION      | P1       | Phase 1→2 | Enable Discord publishing pipeline    | ✅ DONE  |
| 4   | MULTI-BOOK-CONSENSUS      | P1       | Phase 2   | V3 consensus scoring + multi-provider | **NEXT** |
| 5   | OPERATIONAL-OBSERVABILITY | P1       | Phase 1→2 | Close latent failure modes            | ✅ DONE  |

**Total estimated effort**: 10-13 days **Dependency chain**: Sprint 1 → Sprint 2
→ Sprints 3, 4, 5 (parallel)
