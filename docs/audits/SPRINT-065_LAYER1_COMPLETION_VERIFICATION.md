# SPRINT-065: Layer 1 Completion Verification Report

**Sprint**: SPRINT-065-LAYER1-COMPLETION-VERIFICATION **Date**: 2026-03-16
**Lane**: Lane 2 (Audit / Truth) **Model**: Opus — certification audit requiring
maximum-depth reasoning

---

## 1. Executive Verdict

**Layer 1 is NOT COMPLETE.**

Layer 1 is classified as **PARTIALLY CERTIFIED**. Three of thirteen exit
requirements are fully certified (submission, single-writer, Discord publish).
Five are partially working. Five are failing or have never been exercised at
runtime.

The system currently certifies **transport** (ingestion → publish) and **bounded
settlement** (harness-proven lifecycleSettle). It does NOT certify scoring,
promotion policy, recap, or the full end-to-end lifecycle path.

No single pick has ever traversed SUBMIT → SCORE → PROMOTE → POST → SETTLE →
RECAP. This is the definition of Layer 1. Layer 1 is not done.

---

## 2. Exact Layer 1 Exit Requirements

See `docs/status/LAYER1_EXIT_REQUIREMENTS.md` for the full matrix with evidence,
maturity classification, and blockers for each requirement.

13 requirements derived from:

- `docs/04_roadmap/layer_phase_execution_model.md` §2 (Layer 1 definition)
- `docs/contracts/PICK_LIFECYCLE_CONTRACT.md` (lifecycle contract)
- Layer 1 Phases 0-5 scope (Governance Lock through Platform Stabilization)

---

## 3. Layer 1 Status by Requirement

| Req    | Name                          | Status      | Maturity     |
| ------ | ----------------------------- | ----------- | ------------ |
| L1-R01 | Submission / Bridge Ingestion | **PASS**    | CERTIFIED    |
| L1-R02 | Promotion into unified_picks  | **PARTIAL** | IMPLEMENTED  |
| L1-R03 | Single-Writer Enforcement     | **PASS**    | CERTIFIED    |
| L1-R04 | Grading/Scoring Execution     | **FAIL**    | IMPLEMENTED  |
| L1-R05 | Tier/Band Derivation          | **FAIL**    | IMPLEMENTED  |
| L1-R06 | Promotion Decision Logic      | **FAIL**    | IMPLEMENTED  |
| L1-R07 | Discord Publish Path          | **PASS**    | CERTIFIED    |
| L1-R08 | Settlement Path               | **PARTIAL** | VERIFIED     |
| L1-R09 | Idempotency and Immutability  | **PARTIAL** | VERIFIED     |
| L1-R10 | Recap/Stat Generation         | **FAIL**    | DESIGNED     |
| L1-R11 | Replay/Simulation Support     | **PARTIAL** | IMPLEMENTED  |
| L1-R12 | Observability/Traceability    | **PARTIAL** | VERIFIED     |
| L1-R13 | Full Lifecycle E2E Path       | **FAIL**    | NOT ACHIEVED |

**Summary**: 3 PASS, 5 PARTIAL, 5 FAIL

---

## 4. What Is Truly Working in Layer 1

These segments are genuinely operational and should be preserved as stable
foundation. They are not overclaimed.

### 4.1 Submission Pipeline (CERTIFIED)

- Smart Form → bridge_outbox → BridgeWorker → lifecycleInsert → unified_picks
- BridgeWorker uses lifecycle adapters correctly (writerRole: submitter)
- bridge_outbox idempotency via unique_key constraint
- Temporal worker integration functional

### 4.2 Single-Writer Discipline (CERTIFIED)

- 0 violations, 998 files scanned, 0 allowlisted
- CI gate enforces on every commit
- All lifecycle adapters (insert, update, settle, atomic claim) working
- Writer authority and transition validation functional at application level

### 4.3 Discord Publishing (CERTIFIED)

- 4 real Discord posts with valid snowflake IDs (SPRINT-062)
- 3 posting paths (capper, system, legacy) all functional
- atomicClaimForPost and atomicClaimParlayForPost idempotency working
- pick_publish outbox functional (after SPRINT-062 schema fixes)
- Receipt persistence (discord_message_id, meta.discord_receipt) working
- Parlay-aware atomic posting working
- Snowflake validation working
- Retry/reset on failure working

### 4.4 Settlement Core (VERIFIED, harness-bounded)

- lifecycleSettle() transitions POSTED → SETTLED at runtime
- prop_settlements INSERT works with correct column names
- Transition validator accepts POSTED → SETTLED for settler role
- Writer authority accepts settler for settlement fields
- Optimistic locking prevents concurrent settlement
- DB constraints compatible (valid_unified_picks_settlement_status)
- DEFECT-8 (workflow_stage constraint) confirmed INVALID
- DEFECT-9 (column name mismatch) confirmed INVALID

### 4.5 Core Idempotency (VERIFIED)

- Submit: bet_slip_id uniqueness enforced
- Post: atomicClaimForPost prevents double-posting
- Settle: transition validator rejects SETTLED → SETTLED
- Autopilot freeze: fail-closed guard operational

### 4.6 Governance Infrastructure (CERTIFIED)

- 73 database migrations applied
- CI pipeline with lifecycle gate, type-check, tests
- Sprint governance framework operational
- Proof artifact system operational

---

## 5. What Is Broken or Uncertified in Layer 1

### 5.1 Scoring Pipeline (FAIL — Never Exercised)

**Root cause**: The scoring engine (computeScoreV2, canonicalTier,
evaluatePromotion) has never been exercised with real data at runtime.

**Evidence chain**:

1. SPRINT-062 picks were manually created with tier='S', band='HARD'
2. SCORING_ENGINE_V2 was not set → canaryDecide() returned v1
3. V1 path does not call evaluatePromotion()
4. V1 fallback: `promotion_band: result.promotionBand || 'HARD'` → always HARD
5. GradingAgent.meetsPromotionCriteria() uses hardcoded thresholds, not V2
   policy
6. No provider_offers data was available (external APIs needed)

**What this means**: The intelligence layer of the pick machine is dormant. Tier
and band have never been computed from scoring output. Promotion decisions have
never been policy-gated. The system currently publishes manually-classified
picks, not intelligently-graded picks.

**Files**: GradingAgent.ts, computeScoreV2.ts, TierScale.ts, promotionPolicy.ts,
canaryRouter.ts, gradingEngine.ts

### 5.2 Promotion Policy (FAIL — Two Competing Gates)

**Root cause**: Two entirely separate promotion gates exist and neither has been
verified at runtime with real data.

- **V1 Legacy** (`meetsPromotionCriteria`, GradingAgent.ts:855-882): Hardcoded
  thresholds (edge≥8%, confidence≥85%, tier S or exceptional A). Falls back to
  band='HARD' when V2 is not active.
- **V2 Policy** (`evaluatePromotion`, promotionPolicy.ts:329-455): 8 gates
  including 2 CONSTITUTIONAL (feature snapshot ID required, probability
  primitives required). Never run.

**Risk**: CONSTITUTIONAL gates 5 and 6 may silently block ALL picks when V2 is
activated, because feature snapshot ID and probability primitives may not be
populated by the current pipeline.

### 5.3 RecapAgent (FAIL — Wrong Column Names)

**Root cause**: RecapAgent queries `play_status` column which does not exist.
Correct column is `status`.

**Affected locations** (7 references):

- recapService.ts:98 — daily recap query
- recapService.ts:145 — weekly recap query
- recapService.ts:177 — monthly recap query
- recapService.ts:421 — parlay group query
- recapService.ts:562 — micro-recap trigger
- recapService.ts:627 — mapping function
- index.ts:247 — unified_picks monitor

**Impact**: Every RecapAgent operation crashes at runtime with Supabase "column
not found" error. RecapAgent is classified as DESIGNED, not IMPLEMENTED.

### 5.4 Settlement Natural Path (PARTIAL — Harness-Only)

**What is proven**: lifecycleSettle() works. prop_settlements works. Transition
validation works. Optimistic locking works.

**What is NOT proven**: SettlementAgent.processCompletedGames() has never
executed with real game_results data. The automatic trigger path (external API →
game_results → settleProp → lifecycleSettle) has never fired.

**Missing DB objects** (7 total, DEFECT-10/11/12):

1. generate_settlement_hash() function
2. settlement_audit_log table
3. settlement_freeze_config table
4. settlement_version column on unified_picks
5. settlement_hash column on unified_picks
6. settlement_frozen column on unified_picks
7. freeze_enforced_at column on unified_picks

Plus: prevent_direct_settlement_update trigger not attached.

### 5.5 Replay/Simulation Infrastructure (PARTIAL — Dormant)

**What exists**: R1-R5 (8,400 lines, 48 files), all with unit tests and CI
integration (R3/R4 as optional jobs).

**What is dormant**:

- R2 ReplayOrchestrator: CLI-only, not connected to API replay endpoint
- R3 Shadow mode: disabled in production
- R4 Fault injection: CI-optional, disabled by default
- R5 Strategy simulation: scaffold only, no consumer
- API /ops/recovery/replay uses Temporal, NOT R2

**Impact on Layer 1**: Phase 5 (Platform Stabilization) explicitly requires
"End-to-end E2E verification, smoke tests, shadow mode, fault injection." If
Phase 5 is strictly interpreted, replay infrastructure must be activated for
Layer 1 exit.

---

## 6. False or Outdated Layer 1 Completion Claims

### Claim: "Layer 1 ALL phases 0–5: COMPLETE"

**Source**: MEMORY.md, PHASE_STATUS.md (Phase 1 at 97%) **Truth**: Layer 1 is
NOT complete. The scoring pipeline has never run. Recap is broken. Full E2E path
has never been traversed. Phase 1 at 97% refers to the operational "Phase 1 —
Structural Dominance" in the informal naming, NOT Layer 1 completion. The
informal phase naming in PHASE_STATUS.md does not map 1:1 to Layer 1 phases.
This naming confusion is itself a drift issue.

### Claim: "Phase 3: 100%"

**Source**: PHASE_STATUS.md **Truth**: The risk engine IS 100% complete. But
PHASE_STATUS.md "Phase 3" is not canonical Layer 1 Phase 3 (Distribution
Determinism). It's the informal "Phase 3 — Risk Engine Dominance" which maps to
Layer 2 Phases 6-7. This naming collision causes confusion about what Layer 1
actually requires.

### Claim: "Layer 2: COMPLETE"

**Source**: Multiple status docs **Truth**: Layer 2 operator control,
reliability monitoring, and recovery/replay infrastructure are delivered. But
Layer 2 completion cannot be legitimately claimed while Layer 1 is incomplete
(per layer_phase_execution_model.md §4.1: "Lower-layer work must be resolved
before upper-layer work is claimed as complete"). Layer 2 WORK is done. Layer 2
CLAIM is premature.

### Claim: "Layer 3 started"

**Source**: PHASE_STATUS.md, NEXT_5_SPRINTS.md **Truth**: Layer 3 UX work has
been delivered (auth, permissions, Smart Form UX, workflows, alerts, health
dashboard). But per §4.1: "Layers 3 and 4 must not be started if Layer 1 truth
gaps remain unresolved." This is a sequencing violation per the canonical
execution model. The work was done, but the claim that Layer 3 is legitimately
started while Layer 1 is incomplete is false under the governance model.

**Mitigating context**: The Layer 3 work was done in parallel under the lane
model (Lane 4: Governance/Docs and Lane 1: Implementation can run in parallel).
The UX work itself is not wasted. But it cannot be used to claim platform
readiness per §4.5: "UX Must Not Imply Operational Readiness."

---

## 7. Replay/Certification Support Verdict

**Verdict**: PARTIAL — infrastructure exists but is not exercised for Layer 1
certification.

| Component              | Status   | Issue                                 |
| ---------------------- | -------- | ------------------------------------- |
| R1 RunController       | PASS     | Clock injection in lifecycle adapters |
| R2 ReplayOrchestrator  | PARTIAL  | CLI-only, not API-connected           |
| R3 Shadow mode         | DORMANT  | Not activated in any environment      |
| R4 Fault injection     | DORMANT  | CI-optional, disabled by default      |
| R5 Strategy simulation | SCAFFOLD | No consumer                           |
| API Replay endpoint    | PARTIAL  | Uses Temporal, not R2                 |

**Phase 5 Assessment**: Phase 5 (Platform Stabilization) requires "End-to-end
E2E verification, smoke tests, shadow mode, fault injection." The current state
satisfies:

- E2E verification: NO (no full lifecycle path proven)
- Smoke tests: PARTIAL (individual segment tests exist)
- Shadow mode: NO (dormant)
- Fault injection: NO (dormant)

**Phase 5 is NOT satisfied.**

---

## 8. Recommended Layer 1 Closure Sequence

The minimum truthful path to Layer 1 completion requires these sprints in this
order. This is not a wishlist — it is a dependency chain.

### Sprint 1: SCORING-CERTIFICATION (P0, 1-2 sessions)

**Goal**: Exercise computeScoreV2 → canonicalTier → evaluatePromotion with real
or realistic data. Determine whether CONSTITUTIONAL gates are satisfiable.
**Depends on**: Nothing **Unblocks**: Sprint 3 (E2E path) **Tasks**:

1. Set SCORING_ENGINE_V2=true
2. Create or source realistic provider_offers data
3. Run GradingAgent.gradeProp() against test data
4. Verify computeScoreV2 produces score, EV, feature breakdown
5. Verify canonicalTier computes tier from score+edge+risk
6. Verify evaluatePromotion 8-gate policy produces band classification
7. Determine if CONSTITUTIONAL gates (5, 6) are satisfiable with current
   pipeline
8. If gates are unsatisfiable, determine minimum fix (feature snapshot creation,
   probability primitive population)
9. Capture proof artifacts

### Sprint 2: RECAP-SCHEMA-FIX (P0, 1 session)

**Goal**: Fix RecapAgent column references and verify recap works against
settled pick data. **Depends on**: Nothing (can run in parallel with Sprint 1)
**Unblocks**: Sprint 3 (E2E path) **Tasks**:

1. Replace `play_status` with `status` in all 7 locations
2. Replace `outcome` with `settlement_result` if used
3. Verify RecapAgent produces correct output with settled pick data (pick
   062a0001 from SPRINT-064)
4. Capture proof artifacts

### Sprint 3: FULL-LIFECYCLE-E2E-CERTIFICATION (P0, 1-2 sessions)

**Goal**: One pick traverses SUBMIT → SCORE → PROMOTE → POST → SETTLE → RECAP
with runtime traces at every stage. **Depends on**: Sprint 1 + Sprint 2
**Unblocks**: Layer 1 exit declaration **Tasks**:

1. Submit a real pick via Smart Form or bridge_outbox
2. Verify GradingAgent processes it (scoring → tier → band → promotion)
3. Verify DiscordPromotionAgent publishes it
4. Settle the pick (via harness or automatic trigger if game completes)
5. Verify RecapAgent generates recap from settled data
6. Capture full lifecycle trace as proof artifact
7. Update LIFECYCLE_PROOF_MATRIX.md: "Full: Submit → Score → Post → Settle →
   Recap: PASS"

### Sprint 4 (Optional): SETTLEMENT-RPC-REPAIR (P1)

**Goal**: Create missing DB objects for manual_settle_pick() and attach
settlement guard trigger. **Depends on**: Nothing **Not required for Layer 1
exit**: Manual RPC is a Layer 2 operator tool. Settlement guard trigger is
defense-in-depth. **Tasks**: Create 7 missing DB objects, attach trigger, verify
manual RPC.

### Sprint 5 (Optional): PHASE-5-ACTIVATION (P1)

**Goal**: Activate shadow mode (R3) and fault injection (R4) for production
pipeline. Connect R2 to API replay endpoint. **Depends on**: Sprint 3 (need
working pipeline to shadow) **Assessment**: If Phase 5 is strictly required for
Layer 1 exit, this sprint is mandatory. If Phase 5 can be satisfied by
harness-based certification (the approach used in SPRINT-062 and SPRINT-064),
this is optional for Layer 1 exit but recommended for operational confidence.

---

## 9. Files Created/Updated

| File                                                       | Action     | Description                            |
| ---------------------------------------------------------- | ---------- | -------------------------------------- |
| `docs/status/LAYER1_EXIT_REQUIREMENTS.md`                  | **NEW**    | 13-row exit requirements matrix        |
| `docs/audits/SPRINT-065_LAYER1_DEFECT_GAP_INVENTORY.md`    | **NEW**    | 5 exit blockers + 6 quality gaps       |
| `docs/audits/SPRINT-065_LAYER1_COMPLETION_VERIFICATION.md` | **NEW**    | This report                            |
| `docs/status/LIFECYCLE_PROOF_MATRIX.md`                    | **UPDATE** | Correction for recap maturity          |
| `docs/status/CURRENT_SYSTEM_STATUS.md`                     | **UPDATE** | Layer 1 overclaim correction           |
| `docs/status/PHASE_STATUS.md`                              | **UPDATE** | Layer 1 completion language correction |
| `docs/status/NEXT_5_SPRINTS.md`                            | **UPDATE** | Reordered for Layer 1 closure          |
| `docs/status/DRIFT_REPORT.md`                              | **UPDATE** | New drift item for Layer 1 overclaim   |

---

## 10. Commands Run

```
# Code exploration (parallel agents)
- Scoring/grading pipeline inspection (31 tool uses)
- Recap/settlement/bridge inspection (33 tool uses)
- Discord publish path inspection (31 tool uses)
# Document reads
- layer_phase_execution_model.md
- PICK_LIFECYCLE_CONTRACT.md
- LIFECYCLE_PROOF_MATRIX.md
- LIFECYCLE_TRUTH_GAP_MEMO.md
- SPRINT-063 scoring/promotion lineage audit
- SPRINT-064 settlement runtime audit
- SPRINT-064 settlement proof report
- CURRENT_SYSTEM_STATUS.md
- PHASE_STATUS.md
- NEXT_5_SPRINTS.md
- DRIFT_REPORT.md
```

---

## 11. Proof Artifact Paths

| Artifact                  | Path                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| Layer 1 exit requirements | `docs/status/LAYER1_EXIT_REQUIREMENTS.md`                                                    |
| Defect/gap inventory      | `docs/audits/SPRINT-065_LAYER1_DEFECT_GAP_INVENTORY.md`                                      |
| This verification report  | `docs/audits/SPRINT-065_LAYER1_COMPLETION_VERIFICATION.md`                                   |
| Sprint closeout           | `out/sprints/SPRINT-065-LAYER1-COMPLETION-VERIFICATION/2026-03-16/SPRINT_CLOSEOUT_REPORT.md` |

---

## Appendix: Naming Confusion — PHASE_STATUS.md vs Layer Model

The informal phase naming in PHASE_STATUS.md does NOT map to Layer 1 phases:

| PHASE_STATUS.md (informal)         | Canonical Layer/Phase          |
| ---------------------------------- | ------------------------------ |
| Phase 1 — Structural Dominance     | Layer 1, Phases 0-3            |
| Phase 2 — Intelligence Superiority | Layer 1/4, Data + Intelligence |
| Phase 3 — Risk Engine Dominance    | **Layer 2**, Phases 6-7        |
| Phase 4 — Automation Supremacy     | **Layer 3**, Phase 11          |
| Phase 5 — Enterprise Scaling       | **Not in canonical model**     |

This naming collision is a documentation drift issue. PHASE_STATUS.md tracks
operational work categories, not canonical layer/phase completion. When
PHASE_STATUS.md says "Phase 1: 97%", it means "Structural Dominance work is 97%
done", NOT "Layer 1 Phase 1 (Runtime Truth) is 97% done."

The canonical layer/phase model in `layer_phase_execution_model.md` is the
authority for Layer 1 exit criteria. PHASE_STATUS.md is an operational tracking
document that uses different terminology.
