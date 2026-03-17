# SPRINT-064 Settlement Harness Specification

**Sprint**: SPRINT-064-SETTLEMENT-LIFECYCLE-FIX **Date**: 2026-03-16
**Classification**: BOUNDED TEMPORARY HARNESS

---

## Harness Identity

| Field     | Value                                            |
| --------- | ------------------------------------------------ |
| Name      | settlement-harness-064                           |
| Location  | `apps/api/src/scripts/settlement-harness-064.ts` |
| Type      | Bounded temporary harness                        |
| Runtime   | `npx tsx` (TypeScript execution)                 |
| DB target | Production Supabase (real schema)                |
| Scope     | Single-pick settlement via lifecycleSettle()     |

---

## Classification

This harness is classified as a **bounded temporary harness**, NOT canonical
certification infrastructure.

**Why not canonical:**

- Uses synthetic game data (actual_value=28), not real external API results
- Does not exercise SettlementAgent.processCompletedGames() or
  calculatePropSettlement()
- Does not test SGO/Odds API data fetch
- Does not test manual_settle_pick() RPC path
- Tests only the lifecycleSettle() adapter, not the full agent orchestration

**What it certifies:**

- lifecycleSettle() can transition a pick from POSTED to SETTLED
- unified_picks settlement fields are writable without blocking constraints
- prop_settlements INSERT works with correct column names (final_pick_id,
  settlement_result)
- Transition validator accepts POSTED->SETTLED for settler role
- Writer authority accepts settler for settlement fields
- Autopilot freeze check works with file-based local state

**What it does NOT certify:**

- SettlementAgent automatic trigger from game_results
- SGO/Odds API data fetch and actual_value resolution
- calculatePropSettlement() with real game data
- manual_settle_pick() RPC (known broken — DEFECT-11)
- Recap path after settlement
- Multi-pick batch settlement
- Void/dispute settlement paths

---

## Harness Phases

| Phase   | Description                              | Status                |
| ------- | ---------------------------------------- | --------------------- |
| PHASE-1 | Locate candidate pick from SPRINT-062    | PASS                  |
| PHASE-2 | Capture pre-settlement state             | PASS                  |
| PHASE-3 | Insert synthetic game_results row        | FAIL (UUID format)    |
| PHASE-4 | Insert prop_settlements record           | PASS                  |
| PHASE-5 | Check settle idempotency pre-flight      | PASS (with warning)   |
| PHASE-6 | Execute lifecycleSettle()                | PASS                  |
| PHASE-7 | Capture post-settlement state            | PASS                  |
| PHASE-8 | Test idempotency (re-settle should skip) | PASS (via transition) |
| PHASE-9 | Verify prop_settlements row              | PASS                  |

---

## Prerequisites

| Requirement                         | Value                                |
| ----------------------------------- | ------------------------------------ |
| SUPABASE_URL                        | Production Supabase URL              |
| SUPABASE_SERVICE_ROLE_KEY           | Service role key                     |
| LOCAL_FILE_STATE                    | `true` (for local dev without Redis) |
| REDIS_URL                           | Must be UNSET for local dev          |
| runtime_config/autopilot_state.json | Must exist with `frozen: false`      |
| Candidate pick                      | POSTED state pick in unified_picks   |

---

## Execution

```bash
# From apps/api directory:
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
export LOCAL_FILE_STATE=true
unset REDIS_URL

npx tsx src/scripts/settlement-harness-064.ts
```

---

## Known Limitations

1. **game_results UUID**: Harness uses non-standard UUID format. Fixed by using
   `gen_random_uuid()` or Supabase-generated UUIDs.
2. **settlement_frozen column**: Missing on unified_picks.
   checkSettleIdempotency() logs warning but does not block settlement.
3. **Double prop_settlements**: Running harness twice creates duplicate
   prop_settlements rows for the same pick (prop_settlements INSERT happens
   before lifecycleSettle transition check).

---

## Upgrade Path to Canonical Harness

To upgrade this to a canonical certification harness:

1. Replace synthetic actual_value with real game_results data
2. Exercise calculatePropSettlement() with actual game scores
3. Add SettlementAgent.processCompletedGames() integration
4. Add void/dispute settlement path testing
5. Add multi-pick batch settlement testing
6. Fix game_results UUID generation
7. Add cleanup/rollback capability
8. Add to CI as optional gate
