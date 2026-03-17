# LIFECYCLE TRUTH GAP MEMO

**Sprint**: SPRINT-063-LIFECYCLE-TRUTH-RESTORATION **Date**: 2026-03-16
**Authority**: This document supersedes any prior lifecycle completion claims
**Classification**: Architecture failure disclosure

---

## Executive Summary

A live E2E truth audit (SPRINT-062) proved that Discord posting works across
four lanes. However, the audit also proved that **settlement, scoring
certification, and recap are not operational**. The system currently certifies
**transport** (ingestion → promotion → publish), not **full pick-machine truth**
(submit → score → promote → publish → settle → recap).

Phase and layer status documents have drifted ahead of lifecycle certification.
This memo documents the exact gaps with file-level precision.

---

## 1. What Is Actually Proven

| Lifecycle Segment   | Status | Evidence                                             |
| ------------------- | ------ | ---------------------------------------------------- |
| Smart Form → Outbox | PASS   | BridgeWorker processes bridge_outbox → unified_picks |
| Lifecycle Adapters  | PASS   | Single-writer gate: 0 violations, 998 files scanned  |
| Promotion/Posting   | PASS   | 4 real Discord snowflake IDs (SPRINT-062)            |
| Idempotency         | PASS   | atomicClaimForPost prevents double-posting           |
| Optimistic Locking  | PASS   | ConcurrentModificationError on TOCTOU race           |
| Autopilot Freeze    | PASS   | Hard fail-closed guard on all lifecycle writes       |

## 2. What Is NOT Proven

| Lifecycle Segment       | Status     | Blocker                                                  |
| ----------------------- | ---------- | -------------------------------------------------------- |
| Auto-Scoring            | NOT PROVEN | Optimal API down during audit; manual tier/band used     |
| Tier Derivation (live)  | NOT PROVEN | canonicalTier() code exists but was never exercised      |
| Promotion Policy (live) | NOT PROVEN | 8-gate evaluatePromotion() never ran; picks pre-approved |
| Settlement              | NOT PROVEN | No completed games in test window; external data needed  |
| prop_settlements INSERT | NOT PROVEN | Never executed against real data                         |
| Recap / Stats           | NOT PROVEN | RecapAgent queries nonexistent columns (see Section 5)   |
| Full Lifecycle Closure  | NOT PROVEN | No pick has traversed SUBMIT→SCORE→POST→SETTLE→RECAP     |

## 3. Settlement Path Analysis

### What SPRINT-062 Reported (Defects 8 & 9)

- **DEFECT-8**: "`chk_unified_picks_workflow_stage` only allows `pending_review`
  and `approved`"
- **DEFECT-9**: "`prop_settlements` schema mismatch: code uses
  `pick_id`/`outcome`, DB has `final_pick_id`/`settlement_result`"

### What Code Inspection Reveals

**DEFECT-8 is inaccurate.** The `lifecycleSettle()` function
(`apps/api/src/lib/lifecycle/write-adapter.ts:356-477`) does NOT write to
`workflow_stage`. It writes to:

- `settlement_status` ('settled' | 'void')
- `settlement_result` ('win' | 'loss' | 'push')
- `status` ('won' | 'lost' | 'push' | 'void')
- `settled_at` (timestamp)
- `actual_outcome` (decimal)

The `workflow_stage` CHECK constraint (`docs/supabase-schema-unified.sql:98`)
allows `('draft', 'pending_review', 'approved', 'published', 'settled')` — but
settlement doesn't touch this column. Lifecycle stage is DERIVED from multiple
fields by `deriveLifecycleStage()` (`transition-validator.ts:160-195`), not
stored in `workflow_stage`.

**DEFECT-9 is inaccurate.** The SettlementAgent code
(`apps/api/src/agents/SettlementAgent/index.ts:549-561`) correctly uses
`final_pick_id` and `settlement_result`, which match the migration schema
(`apps/api/migrations/004_settlement_schema.sql:68-112`).

### Caveat

The SPRINT-062 report may have observed a DIFFERENT runtime constraint that is
not visible in migration source files. Without database access, this cannot be
confirmed or denied. **If an operator observed a constraint error at runtime,
that runtime state is higher authority than migration source files.** The
migration source shows no blocking constraint, but production DB state may
differ.

### True Settlement Blockers

1. **External data dependency**: SettlementAgent requires completed games in
   `game_results` table with settlement data from SGO or Odds API. Neither was
   available during the audit window.
2. **No test harness**: There is no in-process settlement test path that can
   exercise the full `settleProp()` → `lifecycleSettle()` chain without external
   data.
3. **Transition requirement**: Picks must be in POSTED state (derived from
   `posted_to_discord=true` + `discord_message_id IS NOT NULL`) before
   settlement can proceed.

## 4. Scoring Path Analysis

The 4 picks posted in SPRINT-062 were **manually created** with hardcoded
`tier='S'` and `promotion_band='HARD'`. The scoring engine was never exercised:

- `computeScoreV2()`
  (`apps/api/src/agents/GradingAgent/scoring/computeScoreV2.ts`) — weighted sum
  of 40+ features — never ran
- `canonicalTier()`
  (`apps/api/src/agents/GradingAgent/scoring/TierScale.ts:54-78`) —
  multi-dimensional tier derivation — never ran
- `evaluatePromotion()`
  (`apps/api/src/agents/GradingAgent/scoring/promotionPolicy.ts:329-455`) —
  8-gate promotion policy with 2 CONSTITUTIONAL gates — never ran
- `canaryDecide()`
  (`apps/api/src/agents/GradingAgent/scoring/canaryRouter.ts:97-141`) — V1/V2
  scoring engine routing — never ran

**Root cause**: Optimal API was down (503). Without live provider offers,
GradingAgent cannot exercise the full feature → score → tier → band pipeline.

## 5. Recap Path Analysis

The RecapAgent (`apps/api/src/agents/RecapAgent/recapService.ts`) queries
`unified_picks` using columns that **do not exist** in the current schema:

- `.in('play_status', ['settled', 'graded'])` — `play_status` does not exist
  (correct column: `status`)
- `.not('outcome', 'is', null)` — `outcome` does not exist (correct column:
  `settlement_result`)

This means **RecapAgent is non-functional** independent of whether settled picks
exist. It would produce Supabase query errors on any execution attempt.

**File**:
`apps/api/src/agents/RecapAgent/recapService.ts:95-99, 142-146, 174-178`

## 6. Embed Contract Defects

Five embed defects documented in detail at
`docs/audits/SPRINT-063_EMBED_CONTRACT_AUDIT.md`:

1. `build:unknown` in Discord footer — `buildInfo.ts:38-43` fallback
2. `env:development` in Discord footer — `buildInfo.ts:72` NODE_ENV default
3. Inconsistent capper visibility — 3 parallel embed builders
4. Inconsistent headshot enrichment — silent DB lookup failures
5. Raw enum leakage (e.g., THREE_POINTERS) — incomplete STAT_TYPE_DISPLAY_MAP

## 7. Replay/Simulation Truth

The verification infrastructure (R1-R5, ~8,400 lines, 48 files) is
architecturally sound but **not integrated into operational certification**:

- R2 ReplayOrchestrator runs against test fixtures only (CLI-only)
- The API replay endpoint (`/api/replay`) uses Temporal, NOT R2
- Shadow mode (R3) is dormant (disabled in production)
- Fault injection (R4) is CI-optional (disabled by default)
- Strategy simulation (R5) is scaffold-only (no consumer)
- SPRINT-062 did NOT use any replay/simulation infrastructure

Full analysis at `docs/audits/SPRINT-063_REPLAY_SIMULATION_TRUTH_AUDIT.md`.

## 8. Impact on Phase/Layer Claims

| Claim in Status Docs | Truth                                              |
| -------------------- | -------------------------------------------------- |
| Phase 3: 100%        | Risk engine is 100%. Lifecycle is NOT.             |
| Layer 2: COMPLETE    | Operator control + monitoring yes. Settlement no.  |
| Phase 4: 55%         | UI is delivered. Settlement/recap not operational. |
| Lifecycle: certified | Transport only. Not full pick-machine truth.       |

## 9. Required Follow-Up Work

### Minimum for One Settled Pick (bounded)

1. Create a test harness that can exercise `settleProp()` with synthetic
   game_results data (no external API dependency)
2. Fix RecapAgent column references (`play_status` → `status`, `outcome` →
   `settlement_result`)
3. Verify at runtime that `lifecycleSettle()` succeeds against production DB
   schema (resolve DEFECT-8 ambiguity)
4. Execute one full lifecycle path: submit → score → promote → publish → settle
   → recap

### Minimum for Scoring Certification

1. Exercise `computeScoreV2()` with real or realistic feature data
2. Verify `canaryDecide()` routes to V2 when `SCORING_ENGINE_V2=true`
3. Run `evaluatePromotion()` through all 8 gates with real pick data

---

**This memo is fail-closed. No lifecycle segment is certified until runtime
proof exists.**
