# LIFECYCLE PROOF MATRIX

**Sprint**: SPRINT-065-LAYER1-COMPLETION-VERIFICATION (updated from SPRINT-064)
**Date**: 2026-03-16 **Last Update**: SPRINT-065 Layer 1 audit — no status
changes; matrix confirmed accurate **Authority**: This matrix is the canonical
lifecycle certification status. All other documents must be consistent with this
matrix.

---

## Matrix Legend

- **PASS**: Proven by runtime evidence (receipts, traces, gate outputs)
- **PARTIAL**: Some evidence exists but incomplete or with caveats
- **FAIL**: Not proven or proven to not work
- **N/A**: Not applicable to this segment

---

## Lifecycle Segment Matrix

| Segment              | Code Exists | Tests Pass | Runtime Proven               | Certification |
| -------------------- | ----------- | ---------- | ---------------------------- | ------------- |
| Smart Form → Outbox  | YES         | YES        | YES                          | **PASS**      |
| BridgeWorker Ingest  | YES         | YES        | YES                          | **PASS**      |
| Lifecycle Insert     | YES         | YES        | YES                          | **PASS**      |
| Lifecycle Update     | YES         | YES        | YES                          | **PASS**      |
| Single-Writer Gate   | YES         | YES        | YES                          | **PASS**      |
| Auto-Approval        | YES         | YES        | NOT PROVEN                   | **PARTIAL**   |
| GradingAgent Scoring | YES         | PARTIAL    | NOT PROVEN                   | **FAIL**      |
| computeScoreV2       | YES         | YES        | NOT PROVEN                   | **FAIL**      |
| canonicalTier        | YES         | YES        | NOT PROVEN                   | **FAIL**      |
| evaluatePromotion    | YES         | YES        | NOT PROVEN                   | **FAIL**      |
| Canary Routing       | YES         | YES        | PARTIAL (v1)                 | **PARTIAL**   |
| Atomic Claim (Post)  | YES         | YES        | YES                          | **PASS**      |
| Discord Posting      | YES         | YES        | YES (4 posts)                | **PASS**      |
| pick_publish Outbox  | YES         | YES        | YES                          | **PASS**      |
| Embed Generation     | YES         | YES        | PARTIAL (5 defects)          | **PARTIAL**   |
| Optimistic Locking   | YES         | YES        | YES                          | **PASS**      |
| Autopilot Freeze     | YES         | YES        | YES                          | **PASS**      |
| SettlementAgent      | YES         | PARTIAL    | PARTIAL (trigger not tested) | **PARTIAL**   |
| lifecycleSettle      | YES         | YES        | YES (SPRINT-064 harness)     | **PASS**      |
| prop_settlements     | YES         | N/A        | YES (SPRINT-064 harness)     | **PASS**      |
| RecapAgent           | YES         | PARTIAL    | NOT PROVEN                   | **FAIL**      |
| Recap Column Mapping | NO\*        | NO         | NO                           | **FAIL**      |

\*RecapAgent queries `play_status` and `outcome` columns that do not exist in
the current `unified_picks` schema.

---

## Cross-Cutting Concerns

| Concern               | Status      | Evidence                                                                                |
| --------------------- | ----------- | --------------------------------------------------------------------------------------- |
| Idempotency (post)    | **PASS**    | atomicClaimForPost prevents dupes                                                       |
| Idempotency (settle)  | **PARTIAL** | Transition validator blocks re-settle; checkSettleIdempotency degraded (missing column) |
| Idempotency (submit)  | **PASS**    | bet_slip_id uniqueness enforced                                                         |
| Transition Validation | **PASS**    | assertTransition() on every update                                                      |
| Writer Authority      | **PASS**    | assertWriterAuthority() on every write                                                  |
| Immutability Guards   | **PARTIAL** | settlement_guard_seal trigger function exists but NOT ATTACHED to table (DEFECT-12)     |
| Clock Injection (R1)  | **PASS**    | resolveNow(context.clock) in adapters                                                   |

---

## Infrastructure Matrix

| Component              | Functional | Integrated  | Used in SPRINT-062 | Rating      |
| ---------------------- | ---------- | ----------- | ------------------ | ----------- |
| R1 RunController       | YES        | YES         | NO                 | **PASS**    |
| R2 ReplayOrchestrator  | YES        | NO\*        | NO                 | **PARTIAL** |
| R3 Shadow Mode         | YES        | NO          | NO                 | **PARTIAL** |
| R4 Fault Injection     | YES        | PARTIAL\*\* | NO                 | **PARTIAL** |
| R5 Strategy Simulation | YES        | NO          | NO                 | **FAIL**    |
| API Replay Endpoint    | YES        | YES         | NO                 | **PARTIAL** |

\*R2 is CLI-only; not connected to dashboard replay endpoint. \*\*R4 is
CI-optional (disabled by default).

---

## End-to-End Path Certification

| Path                                         | Status     |
| -------------------------------------------- | ---------- |
| Submit → Ingest → Store                      | **PASS**   |
| Submit → Score → Tier → Band                 | **FAIL**   |
| Submit → Approve → Post → Discord            | **PASS\*** |
| Submit → Score → Promote → Post → Discord    | **FAIL**   |
| Submit → Post → Settle                       | **PASS\*** |
| Submit → Post → Settle → Recap               | **FAIL**   |
| Full: Submit → Score → Post → Settle → Recap | **FAIL**   |

\*Uses manual tier/band, not computed scoring. \*\*Settlement via harness with
synthetic game data (SPRINT-064).

---

## Summary Scoreboard

| Category           | PASS   | PARTIAL | FAIL   | Total  |
| ------------------ | ------ | ------- | ------ | ------ |
| Lifecycle Segments | 12     | 2       | 7      | 21     |
| Cross-Cutting      | 5      | 2       | 0      | 7      |
| Infrastructure     | 1      | 4       | 1      | 6      |
| E2E Paths          | 3      | 0       | 3      | 6      |
| **TOTAL**          | **21** | **8**   | **11** | **40** |

**Lifecycle Certification**: 52.5% PASS, 20% PARTIAL, 27.5% FAIL **Change from
SPRINT-063**: +2 PASS, -2 FAIL (settlement proven)

---

## What Must Change for Full Certification

### Settlement (COMPLETED in SPRINT-064):

1. ~~Exercise `lifecycleSettle()` against a test pick with synthetic game
   results~~ **DONE**
2. ~~Verify prop_settlements INSERT works with correct column names~~ **DONE**
3. ~~Verify transition POSTED->SETTLED is allowed~~ **DONE**

### Settlement remaining (2 items):

1. Fix manual_settle_pick() RPC: create missing tables/functions (DEFECT-11)
2. Attach settlement guard trigger to unified_picks (DEFECT-12)

### Minimum for settle->recap path (2 items):

1. Fix RecapAgent column references (`play_status` → `status`, `outcome` →
   `settlement_result`)
2. Verify the full settle → recap path produces correct output

### Minimum for scoring certification (2 items):

1. Set `SCORING_ENGINE_V2=true` and exercise `computeScoreV2()` →
   `canonicalTier()` → `evaluatePromotion()` with real or realistic feature data
2. Verify that CONSTITUTIONAL gates (5, 6) don't silently block all picks

### Minimum for full E2E certification (all of the above plus):

1. One pick traverses SUBMIT → SCORE → PROMOTE → POST → SETTLE → RECAP with
   runtime traces at each stage

---

## Layer 1 Exit Status (SPRINT-065 Verification)

**Layer 1 Verdict**: NOT COMPLETE (PARTIALLY CERTIFIED)

See `docs/status/LAYER1_EXIT_REQUIREMENTS.md` for the 13-row exit requirements
matrix. See `docs/audits/SPRINT-065_LAYER1_DEFECT_GAP_INVENTORY.md` for the 5
exit blockers and 6 quality gaps.

| Summary                                  | Count                |
| ---------------------------------------- | -------------------- |
| PASS (CERTIFIED)                         | 3 of 13 requirements |
| PARTIAL (VERIFIED/IMPLEMENTED)           | 5 of 13 requirements |
| FAIL (IMPLEMENTED/DESIGNED/NOT ACHIEVED) | 5 of 13 requirements |

**Minimum closure sequence**: Scoring Certification → Recap Schema Fix → Full
Lifecycle E2E Certification (3 sprints)
