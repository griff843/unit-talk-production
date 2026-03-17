# Layer 1 Defect & Certification Gap Inventory

**Sprint**: SPRINT-065-LAYER1-COMPLETION-VERIFICATION **Date**: 2026-03-16
**Classification**: Layer 1 exit blockers + certification gaps

---

## Layer 1 Exit Blockers

These defects or gaps directly prevent Layer 1 certification. Layer 1 cannot be
declared COMPLETE until every item in this section is resolved.

### GAP-L1-01: Scoring Pipeline Never Exercised at Runtime

| Field                   | Value                                                                                                                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Affected Subsystem**  | GradingAgent / Scoring Engine                                                                                                                                                                                                                                                   |
| **Description**         | computeScoreV2(), canonicalTier(), and evaluatePromotion() have never been exercised with real or realistic data at runtime. All SPRINT-062 picks were manually created with hardcoded tier='S' and promotion_band='HARD'. The scoring engine is fully implemented but dormant. |
| **Severity**            | **P0 — Layer 1 Exit Blocker**                                                                                                                                                                                                                                                   |
| **Evidence**            | `docs/audits/SPRINT-063_SCORING_PROMOTION_LINEAGE_AUDIT.md`, GradingAgent.ts, canaryRouter.ts:107 (v2_disabled fallback)                                                                                                                                                        |
| **Blocks Layer 1 Exit** | YES — Layer 1 requires "ingestion → scoring → promotion → Discord delivery → settlement"                                                                                                                                                                                        |
| **Root Cause**          | SCORING_ENGINE_V2 was not set during SPRINT-062. canaryDecide() returned v1. Even with v1, SPRINT-062 picks bypassed GradingAgent entirely (manual creation).                                                                                                                   |
| **Fix Required**        | Exercise the full scoring pipeline with real or realistic provider_offers data. Set SCORING_ENGINE_V2=true. Verify that CONSTITUTIONAL gates (5: feature snapshot, 6: probability primitives) do not silently block all picks.                                                  |

### GAP-L1-02: Two Competing Promotion Gates (V1 Legacy vs V2 Policy)

| Field                   | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | ------------------------ |
| **Affected Subsystem**  | GradingAgent / Promotion Policy                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Description**         | Two entirely separate promotion gates exist. V1 legacy: `meetsPromotionCriteria()` (GradingAgent.ts:855-882) uses hardcoded thresholds (edge≥8%, confidence≥85%, tier S or exceptional A). V2 policy: `evaluatePromotion()` (promotionPolicy.ts:329-455) uses 8 gates including 2 CONSTITUTIONAL. Neither has been verified to produce correct promotion decisions at runtime. When V2 is active, both gates must pass. When V2 is inactive, only V1 runs and all promoted picks get band='HARD' by default. |
| **Severity**            | **P0 — Layer 1 Exit Blocker**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Evidence**            | GradingAgent.ts:855-882 (meetsPromotionCriteria), promotionPolicy.ts:329-455 (evaluatePromotion), gradingEngine.ts:315-387 (canary routing)                                                                                                                                                                                                                                                                                                                                                                  |
| **Blocks Layer 1 Exit** | YES — promotion logic must be verified                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Root Cause**          | V2 infrastructure was built but never activated for real picks. The fallback `promotion_band: result.promotionBand                                                                                                                                                                                                                                                                                                                                                                                           |     | 'HARD'` masks the issue. |
| **Fix Required**        | Determine canonical promotion path (V1, V2, or transition plan). Exercise the chosen path with real scoring output. Verify CONSTITUTIONAL gates are satisfiable.                                                                                                                                                                                                                                                                                                                                             |

### GAP-L1-03: RecapAgent Non-Functional (Wrong Column Names)

| Field                   | Value                                                                                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Affected Subsystem**  | RecapAgent                                                                                                                                                                                                                                |
| **Description**         | RecapAgent queries `play_status` column which does not exist on unified_picks. Correct column is `status`. All recap methods (daily, weekly, monthly, parlay group, micro-recap) will throw Supabase "column not found" error at runtime. |
| **Severity**            | **P0 — Layer 1 Exit Blocker**                                                                                                                                                                                                             |
| **Evidence**            | recapService.ts lines 98, 145, 177, 421, 562, 627. index.ts line 247. All reference `play_status`. unified_picks has `status` (verified in packages/contracts/src/supabase.ts:6595-7000).                                                 |
| **Blocks Layer 1 Exit** | YES — recap is part of the full lifecycle                                                                                                                                                                                                 |
| **Root Cause**          | Schema drift. RecapAgent was written against an older/different schema that used `play_status`. The column was never renamed or the agent was never updated.                                                                              |
| **Fix Required**        | Replace `play_status` with `status` in all 7 locations. Replace `outcome` with `settlement_result` if also used incorrectly. Verify RecapAgent produces correct output with settled pick data.                                            |

### GAP-L1-04: SettlementAgent Natural Trigger Path Untested

| Field                   | Value                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Affected Subsystem**  | SettlementAgent                                                                                                                                                                                                                                                                                         |
| **Description**         | SettlementAgent.processCompletedGames() has never been tested with real game_results data from SGO or OddsAPI. SPRINT-064 proved lifecycleSettle() works via a harness with synthetic data. The automatic trigger path (external API → game_results → settleProp → lifecycleSettle) has never executed. |
| **Severity**            | **P1 — Layer 1 Exit Blocker**                                                                                                                                                                                                                                                                           |
| **Evidence**            | SPRINT-064 settlement proof (harness-bounded PASS). SettlementAgent.ts:209 (processCompletedGames). No game_results rows from external APIs exist in the test window.                                                                                                                                   |
| **Blocks Layer 1 Exit** | YES — settlement must work without manual intervention                                                                                                                                                                                                                                                  |
| **Root Cause**          | External API dependency (SGO/OddsAPI must return completed game data) and no games were completed in the test window.                                                                                                                                                                                   |
| **Fix Required**        | Either (a) wait for real games and verify automatic path, or (b) create a bounded harness that exercises processCompletedGames() → settleProp() → lifecycleSettle() with synthetic game_results. Option (b) is acceptable for Layer 1 certification if documented as harness-bounded.                   |

### GAP-L1-05: Full Lifecycle E2E Path Never Traversed

| Field                   | Value                                                                                                                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Affected Subsystem**  | Cross-cutting (entire pipeline)                                                                                                                                                                                                                           |
| **Description**         | No single pick has ever traversed SUBMIT → SCORE → PROMOTE → POST → SETTLE → RECAP. Proven segments: SUBMIT → POST (SPRINT-062, manual tier/band). POST → SETTLE (SPRINT-064, harness-bounded). SCORE, PROMOTE, and RECAP have never executed at runtime. |
| **Severity**            | **P0 — Layer 1 Exit Blocker**                                                                                                                                                                                                                             |
| **Evidence**            | LIFECYCLE_PROOF_MATRIX.md "Full: Submit → Score → Post → Settle → Recap: FAIL"                                                                                                                                                                            |
| **Blocks Layer 1 Exit** | YES — this IS the Layer 1 definition                                                                                                                                                                                                                      |
| **Root Cause**          | Dependent on all other gaps being resolved first.                                                                                                                                                                                                         |
| **Fix Required**        | After fixing GAP-L1-01 through GAP-L1-04, run one pick through the full natural lifecycle.                                                                                                                                                                |

---

## Layer 1 Quality Gaps

These items are not strict Layer 1 exit blockers but represent incomplete
defense-in-depth, operational risk, or certification quality issues.

### GAP-L1-06: Settlement Immutability Guard Not Attached

| Field                   | Value                                                                                                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Affected Subsystem**  | Settlement / DB Triggers                                                                                                                                                                                              |
| **Description**         | `prevent_direct_settlement_update()` function exists in migration 20260215100000 but NO CREATE TRIGGER attaches it to unified_picks. The defense-in-depth layer against raw SQL settlement modifications is inactive. |
| **Severity**            | **P2 — Quality Gap**                                                                                                                                                                                                  |
| **Evidence**            | SPRINT-064 audit. supabase/migrations/20260215100000_settlement_guard_seal_patch.sql (function defined, no trigger).                                                                                                  |
| **Blocks Layer 1 Exit** | NO — lifecycle adapters enforce at application level. DB trigger is defense-in-depth.                                                                                                                                 |
| **Fix Required**        | Create migration to attach trigger.                                                                                                                                                                                   |

### GAP-L1-07: settlement_frozen Column Missing

| Field                   | Value                                                                                                                                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Affected Subsystem**  | Settlement Idempotency                                                                                                                                                                                                              |
| **Description**         | `settlement_frozen` column does not exist on unified_picks. checkSettleIdempotency() queries it and degrades gracefully (returns isDuplicate=false with warning). The PICK_LIFECYCLE_CONTRACT.md specifies this column as required. |
| **Severity**            | **P1 — Quality Gap**                                                                                                                                                                                                                |
| **Evidence**            | DEFECT-10 from SPRINT-064. idempotency.ts:277-379.                                                                                                                                                                                  |
| **Blocks Layer 1 Exit** | NO — settlement idempotency works via transition validator at a higher level. But the contract specifies this column.                                                                                                               |
| **Fix Required**        | Add settlement_frozen BOOLEAN DEFAULT FALSE to unified_picks.                                                                                                                                                                       |

### GAP-L1-08: manual_settle_pick() RPC Non-Functional

| Field                   | Value                                                                                                                                                                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Affected Subsystem**  | Settlement / Operator Tools                                                                                                                                                                                                                                                        |
| **Description**         | manual_settle_pick() RPC references 7 DB objects that were never created: generate_settlement_hash() function, settlement_audit_log table, settlement_freeze_config table, settlement_version column, settlement_hash column, settlement_frozen column, freeze_enforced_at column. |
| **Severity**            | **P1 — Quality Gap**                                                                                                                                                                                                                                                               |
| **Evidence**            | DEFECT-11 from SPRINT-064. SPRINT-065 exploration found 7 (not 4) missing objects.                                                                                                                                                                                                 |
| **Blocks Layer 1 Exit** | NO — automatic settlement via lifecycleSettle works. Manual RPC is a Layer 2 operator tool.                                                                                                                                                                                        |
| **Fix Required**        | Create all 7 missing DB objects via migrations.                                                                                                                                                                                                                                    |

### GAP-L1-09: Embed Cosmetic Defects

| Field                   | Value                                                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Affected Subsystem**  | Discord Embeds                                                                                                                                           |
| **Description**         | 5 embed defects: build:unknown footer, env:development footer, inconsistent capper fields, silent headshot lookup failures, raw SNAKE_CASE enum leakage. |
| **Severity**            | **P2 — Quality Gap**                                                                                                                                     |
| **Evidence**            | DRIFT-H7. docs/audits/SPRINT-063_EMBED_CONTRACT_AUDIT.md                                                                                                 |
| **Blocks Layer 1 Exit** | NO — Discord delivery works. These are cosmetic issues.                                                                                                  |
| **Fix Required**        | Fix buildInfo.ts defaults, normalize enum display, add headshot fallback.                                                                                |

### GAP-L1-10: Replay Infrastructure Not Exercised for Certification

| Field                   | Value                                                                                                                                                                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Affected Subsystem**  | R2/R3/R4 Verification Infrastructure                                                                                                                                                                                                                                               |
| **Description**         | R1-R5 (8,400 lines, 48 files) exists and has unit tests. R2 ReplayOrchestrator is CLI-only, not connected to API replay endpoint. R3 Shadow mode is dormant. R4 Fault injection is CI-optional and disabled by default. None were used for SPRINT-062 or SPRINT-064 certification. |
| **Severity**            | **P1 — Quality Gap**                                                                                                                                                                                                                                                               |
| **Evidence**            | docs/audits/SPRINT-063_REPLAY_SIMULATION_TRUTH_AUDIT.md. Phase 5 (Platform Stabilization) requires E2E verification, shadow mode, and fault injection.                                                                                                                             |
| **Blocks Layer 1 Exit** | DEPENDS — Phase 5 is a Layer 1 phase. If Phase 5 is required for Layer 1 exit, this blocks. If Phase 5 can be satisfied by other means (harness-based certification), this does not block.                                                                                         |
| **Fix Required**        | Either activate R3/R4 for certification, or document that harness-based certification satisfies Phase 5 requirements.                                                                                                                                                              |

### GAP-L1-11: PICK_LIFECYCLE_CONTRACT.md Specifies Missing Columns

| Field                   | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Affected Subsystem**  | Schema / Contract                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Description**         | The canonical lifecycle contract specifies columns that do not exist on unified_picks: settlement_hash, settlement_frozen, blocked_reason (exists), failed_reason (exists), promotion_queued_at (exists), promotion_posted_at (exists). Some contract-specified columns DO exist (blocked_at, blocked_reason, failed_at, failed_reason, promotion_queued_at, promotion_posted_at). Settlement-specific columns (settlement_hash, settlement_frozen) do NOT exist. |
| **Severity**            | **P2 — Contract Drift**                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Evidence**            | PICK_LIFECYCLE_CONTRACT.md §1.5. packages/contracts/src/supabase.ts (generated types).                                                                                                                                                                                                                                                                                                                                                                            |
| **Blocks Layer 1 Exit** | NO — contract specifies aspirational state. The functional path works without these columns.                                                                                                                                                                                                                                                                                                                                                                      |
| **Fix Required**        | Add missing columns or update contract to match reality.                                                                                                                                                                                                                                                                                                                                                                                                          |

---

## Summary

| Category                  | Count | Items                       |
| ------------------------- | ----- | --------------------------- |
| **Layer 1 Exit Blockers** | 5     | GAP-L1-01 through GAP-L1-05 |
| **Quality Gaps**          | 6     | GAP-L1-06 through GAP-L1-11 |
| **Total**                 | 11    |                             |

### Exit Blocker Dependency Chain

```
GAP-L1-01 (Scoring) ─────┐
GAP-L1-02 (Promotion) ───┤
                          ├──► GAP-L1-05 (Full E2E Path)
GAP-L1-03 (Recap) ───────┤
GAP-L1-04 (Settlement) ──┘
```

All 4 component gaps must be resolved before GAP-L1-05 (Full E2E) can be
attempted. GAP-L1-01 and GAP-L1-02 are upstream of GAP-L1-05. GAP-L1-03 is
downstream of GAP-L1-04 (needs settled picks to recap).
