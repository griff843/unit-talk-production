# Layer 1 Exit Requirements Matrix

**Sprint**: SPRINT-066-SCORING-CERTIFICATION (updated from SPRINT-065) **Date**:
2026-03-16 **Authority**: Derived from
`docs/04_roadmap/layer_phase_execution_model.md` §2 +
`docs/contracts/PICK_LIFECYCLE_CONTRACT.md`

> **Layer 1 — Functional Pick Machine**: "Core pipelines work. The system can
> execute a pick end-to-end: ingestion → scoring → promotion → Discord delivery
> → settlement. No Layer 1 exit is possible while any critical pipeline path is
> broken, undefined, or untested. Layer 1 is complete when a production pick can
> reliably traverse the full lifecycle without manual intervention and the
> result is deterministic, auditable, and recoverable."

---

## Exit Requirements

### L1-R01: Submission / Bridge Ingestion

| Field               | Value                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| **Requirement**     | Smart Form submits picks via bridge_outbox; BridgeWorker ingests into unified_picks via lifecycleInsert |
| **Why It Matters**  | Entry point for all picks. If broken, nothing enters the pipeline.                                      |
| **Evidence Source** | BridgeWorker.ts uses lifecycleInsert (writerRole: submitter); bridge_outbox table functional            |
| **Current Status**  | **PASS**                                                                                                |
| **Maturity**        | **CERTIFIED**                                                                                           |
| **Blocker**         | None                                                                                                    |

### L1-R02: Promotion into unified_picks

| Field               | Value                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Requirement**     | GradingAgent promotes scored picks into unified_picks via lifecycle adapters                                                           |
| **Why It Matters**  | Picks must enter the canonical table through the scoring pipeline, not manual insertion                                                |
| **Evidence Source** | GradingAgent.promoteToUnifiedPicks() uses lifecycleInsert; but SPRINT-062 picks were manually created, bypassing GradingAgent entirely |
| **Current Status**  | **PARTIAL**                                                                                                                            |
| **Maturity**        | **IMPLEMENTED** (never verified with real scored picks)                                                                                |
| **Blocker**         | Scoring pipeline (L1-R04) must run first to produce promotable picks                                                                   |

### L1-R03: Single-Writer Enforcement on unified_picks

| Field               | Value                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- |
| **Requirement**     | All unified_picks writes go through lifecycle adapters; CI gate enforces 0 violations |
| **Why It Matters**  | Core invariant. Without it, any code can corrupt pick state.                          |
| **Evidence Source** | `npm run lifecycle:single-writer -- --strict` → 0 violations, 998 files scanned       |
| **Current Status**  | **PASS**                                                                              |
| **Maturity**        | **CERTIFIED**                                                                         |
| **Blocker**         | None                                                                                  |

### L1-R04: Grading/Scoring Execution

| Field               | Value                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Requirement**     | computeScoreV2() produces a score (0-100), EV%, and per-feature breakdown from live provider_offers data                                                                                                                                                                                                                                                                                                                    |
| **Why It Matters**  | Scoring is the intelligence engine. Without it, tier/band/promotion are meaningless.                                                                                                                                                                                                                                                                                                                                        |
| **Evidence Source** | SPRINT-066: computeScoreV2 exercised with realistic GradingFeatureSet (S-tier: 76.35, A-tier: 66.86, D-tier: 54.29). 25 vitest tests pass. Harness JSON proof: `out/sprints/SPRINT-066-SCORING-CERTIFICATION/2026-03-16/proofs/proof_harness_output.json`. featureVectorHash and featureSnapshotId now generated (required for Gate 7). Weight validation warnings are pre-existing (weights module, not a scoring defect). |
| **Current Status**  | **PARTIAL**                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Maturity**        | **VERIFIED** (synthetic data; live provider_offers not yet exercised)                                                                                                                                                                                                                                                                                                                                                       |
| **Blocker**         | Remaining: live provider_offers round-trip (SGO/OddsAPI) not tested. SCORING_ENGINE_V2 env var not set in production agents yet. Full E2E with real data pending SPRINT-068.                                                                                                                                                                                                                                                |

### L1-R05: Tier/Band Derivation Correctness

| Field               | Value                                                                                                                                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Requirement**     | canonicalTier() computes tier from (score, edge, risk). classifyBand() computes HARD/SOFT/NONE from (tier, EV, confidence).                                                                                                                                                                                              |
| **Why It Matters**  | Tier and band drive the promotion decision and Discord channel routing.                                                                                                                                                                                                                                                  |
| **Evidence Source** | SPRINT-066: canonicalTier verified for S (edge=30, risk=1.04), A (edge=8, risk=2.64), D (edge=-9, risk=9) tiers. classifyBand produces HARD (S-tier), SOFT (A-tier), NONE (D-tier) as expected. 5 tier-specific vitest tests pass. computeScoreV2 tier output matches direct canonicalTier call (determinism confirmed). |
| **Current Status**  | **PARTIAL**                                                                                                                                                                                                                                                                                                              |
| **Maturity**        | **VERIFIED** (synthetic data; matches real data format)                                                                                                                                                                                                                                                                  |
| **Blocker**         | Remaining: not yet verified with live provider_offers inputs. Full E2E pending SPRINT-068.                                                                                                                                                                                                                               |

### L1-R06: Promotion Decision Logic

| Field               | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Requirement**     | evaluatePromotion() 8-gate policy determines whether a scored pick is promoted                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Why It Matters**  | This is the quality gate between scoring and publishing. Without it, unqualified picks post or qualified picks are blocked.                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Evidence Source** | SPRINT-066: evaluatePromotion exercised with all 8 gates. CONSTITUTIONAL Gate 7 (featureSnapshotId + featureVectorHash) — FIXED: computeScoreV2 now generates both fields. CONSTITUTIONAL Gate 8 (ProbabilityPrimitives) — SATISFIED: harness passes valid pFinal/uncertaintyFinal/pMarketDevig/edgeFinal. S-tier scenario: promote=true, band=HARD. A-tier: promote=true, band=SOFT. D-tier: promote=false, band=NONE. Tests verify blocked states (missing snapshot, missing probability, zero canary percent, disabled policy). |
| **Current Status**  | **PARTIAL**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Maturity**        | **VERIFIED** (synthetic data; all 8 gates confirmed satisfiable)                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Blocker**         | Remaining: V1/V2 canary routing (SCORING_ENGINE_V2 env var) not set in production agents. PROMOTION_POLICY_V2 and PROMOTION_CANARY_PERCENT not configured in production env. Full E2E with real picks pending SPRINT-068.                                                                                                                                                                                                                                                                                                          |

### L1-R07: Discord Publish Path

| Field               | Value                                                                                                                                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Requirement**     | DiscordPromotionAgent posts picks to Discord via webhook; receipt stored in pick_publish outbox and unified_picks                                                                                                                       |
| **Why It Matters**  | Discord delivery is the primary output of the pick machine.                                                                                                                                                                             |
| **Evidence Source** | 4 real Discord posts in SPRINT-062 with valid snowflake IDs. atomicClaimForPost idempotency works. pick_publish outbox functional (after SPRINT-062 schema fixes). 3 posting paths (capper, system, legacy) all use lifecycle adapters. |
| **Current Status**  | **PASS**                                                                                                                                                                                                                                |
| **Maturity**        | **CERTIFIED** (runtime-proven with 4 real posts)                                                                                                                                                                                        |
| **Blocker**         | 5 embed cosmetic defects (DRIFT-H7) do not block Layer 1 exit but are quality gaps                                                                                                                                                      |

### L1-R08: Settlement Path

| Field               | Value                                                                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Requirement**     | SettlementAgent settles picks via lifecycleSettle() after games complete; prop_settlements fact record created                                                                                                         |
| **Why It Matters**  | Settlement closes the pick lifecycle. Without it, picks remain permanently pending.                                                                                                                                    |
| **Evidence Source** | SPRINT-064 proved lifecycleSettle() at runtime (harness-bounded). Pick 062a0001 transitioned POSTED→SETTLED. prop_settlements INSERT works. Transition validator, writer authority, optimistic locking all functional. |
| **Current Status**  | **PARTIAL**                                                                                                                                                                                                            |
| **Maturity**        | **VERIFIED** (harness-bounded; not natural-path)                                                                                                                                                                       |
| **Blocker**         | SettlementAgent automatic trigger requires game_results from external API (SGO/OddsAPI) — not tested. manual_settle_pick() RPC broken (7 missing DB objects). Settlement guard trigger not attached (DEFECT-12).       |

### L1-R09: Idempotency and Immutability

| Field               | Value                                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Requirement**     | Submit, post, and settle operations are idempotent. Settled picks are immutable.                                                                                                                                                                              |
| **Why It Matters**  | Prevents data corruption from retries, race conditions, and unauthorized modifications.                                                                                                                                                                       |
| **Evidence Source** | Submit: bet_slip_id uniqueness PASS. Post: atomicClaimForPost PASS. Settle: transition validator rejects SETTLED→SETTLED PASS. checkSettleIdempotency degraded (queries missing settlement_frozen column). Settlement guard trigger not attached (DEFECT-12). |
| **Current Status**  | **PARTIAL**                                                                                                                                                                                                                                                   |
| **Maturity**        | **VERIFIED** (core idempotency works; immutability guard incomplete)                                                                                                                                                                                          |
| **Blocker**         | settlement_frozen column missing (DEFECT-10). Guard trigger not attached (DEFECT-12). settlement_audit_log table missing (DEFECT-11).                                                                                                                         |

### L1-R10: Recap/Stat Generation from Settled Truth

| Field               | Value                                                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Requirement**     | RecapAgent generates daily/weekly/monthly recaps from settled picks                                                                                                                                                            |
| **Why It Matters**  | Recap closes the information loop — operators and users see results.                                                                                                                                                           |
| **Evidence Source** | RecapAgent queries `play_status` column which DOES NOT EXIST on unified_picks. Correct column is `status`. Every recap method (daily, weekly, monthly, parlay, micro) will throw Supabase "column not found" error at runtime. |
| **Current Status**  | **FAIL**                                                                                                                                                                                                                       |
| **Maturity**        | **DESIGNED** (code exists but is non-functional due to wrong column names)                                                                                                                                                     |
| **Blocker**         | RecapAgent uses `play_status` (7 references across recapService.ts and index.ts). Must be changed to `status`. Also references `outcome` which should be `settlement_result`.                                                  |

### L1-R11: Replay/Simulation/Certification Support

| Field               | Value                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Requirement**     | Replay engine can deterministically replay lifecycle events for certification and incident recovery                                                                                                                                                                                                                                                          |
| **Why It Matters**  | Layer 1 definition requires "recoverable" results. Phase 5 (Platform Stabilization) explicitly includes E2E verification, shadow mode, and fault injection.                                                                                                                                                                                                  |
| **Evidence Source** | R1 (clock injection) PASS — in lifecycle adapters. R2 (ReplayOrchestrator) CLI-only, not integrated into API endpoint. R3 (Shadow mode) dormant. R4 (Fault injection) CI-optional, disabled by default. R5 (Strategy simulation) scaffold only. API /ops/recovery/replay uses Temporal, not R2. SPRINT-062 did NOT use any replay/simulation infrastructure. |
| **Current Status**  | **PARTIAL**                                                                                                                                                                                                                                                                                                                                                  |
| **Maturity**        | **IMPLEMENTED** (infrastructure exists but not exercised for certification)                                                                                                                                                                                                                                                                                  |
| **Blocker**         | R2 not connected to dashboard replay. R3/R4 not activated. No lifecycle event replay has been performed for certification.                                                                                                                                                                                                                                   |

### L1-R12: Observability/Traceability

| Field               | Value                                                                                                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Requirement**     | Sufficient observability exists to diagnose Layer 1 pipeline status at every stage                                                                                                                                                                                               |
| **Why It Matters**  | Cannot certify what cannot be observed.                                                                                                                                                                                                                                          |
| **Evidence Source** | Agent health endpoints exist. SLO tracking exists (/api/slo/status). Platform health summary exists (/api/health/summary). MCP tools exist (mcp-ops, mcp-state, mcp-intelligence, mcp-decision). 4 observability skills exist. pick_publish outbox provides posting audit trail. |
| **Current Status**  | **PARTIAL**                                                                                                                                                                                                                                                                      |
| **Maturity**        | **VERIFIED** (observability infrastructure exists and is integrated; but not used for scoring/settlement/recap stages which are not operational)                                                                                                                                 |
| **Blocker**         | Cannot observe scoring, settlement-agent-trigger, or recap stages because they don't run. Observability is adequate for what works; insufficient for what doesn't.                                                                                                               |

### L1-R13: Full Lifecycle E2E Path

| Field               | Value                                                                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Requirement**     | At least one pick traverses SUBMIT → SCORE → PROMOTE → POST → SETTLE → RECAP with runtime traces at every stage                                                                                            |
| **Why It Matters**  | This IS the Layer 1 definition. Everything else is a component. This is the system.                                                                                                                        |
| **Evidence Source** | No pick has ever traversed the full path. SPRINT-062 proved SUBMIT → POST (manual tier/band). SPRINT-064 proved POST → SETTLE (harness-bounded). SCORE, PROMOTE, and RECAP have never executed at runtime. |
| **Current Status**  | **FAIL**                                                                                                                                                                                                   |
| **Maturity**        | **NOT ACHIEVED**                                                                                                                                                                                           |
| **Blocker**         | Requires L1-R04 (scoring), L1-R06 (promotion), L1-R08 (natural settlement), L1-R10 (recap) to all work first.                                                                                              |

---

## Summary

| Req ID | Requirement                   | Status      | Maturity     |
| ------ | ----------------------------- | ----------- | ------------ |
| L1-R01 | Submission / Bridge Ingestion | **PASS**    | CERTIFIED    |
| L1-R02 | Promotion into unified_picks  | **PARTIAL** | IMPLEMENTED  |
| L1-R03 | Single-Writer Enforcement     | **PASS**    | CERTIFIED    |
| L1-R04 | Grading/Scoring Execution     | **PARTIAL** | VERIFIED     |
| L1-R05 | Tier/Band Derivation          | **PARTIAL** | VERIFIED     |
| L1-R06 | Promotion Decision Logic      | **PARTIAL** | VERIFIED     |
| L1-R07 | Discord Publish Path          | **PASS**    | CERTIFIED    |
| L1-R08 | Settlement Path               | **PARTIAL** | VERIFIED     |
| L1-R09 | Idempotency and Immutability  | **PARTIAL** | VERIFIED     |
| L1-R10 | Recap/Stat Generation         | **FAIL**    | DESIGNED     |
| L1-R11 | Replay/Simulation Support     | **PARTIAL** | IMPLEMENTED  |
| L1-R12 | Observability/Traceability    | **PARTIAL** | VERIFIED     |
| L1-R13 | Full Lifecycle E2E Path       | **FAIL**    | NOT ACHIEVED |

**Totals**: 3 PASS, 8 PARTIAL, 2 FAIL out of 13 requirements.

**SPRINT-066 delta**: R04, R05, R06 moved FAIL→PARTIAL (scoring pipeline
exercised, CONSTITUTIONAL gates satisfied).

**Layer 1 Verdict**: **NOT COMPLETE** — Recap (R10) and full E2E (R13) remain
FAIL. SPRINT-067 (recap schema fix) and SPRINT-068 (E2E cert) are the remaining
exit blockers.
