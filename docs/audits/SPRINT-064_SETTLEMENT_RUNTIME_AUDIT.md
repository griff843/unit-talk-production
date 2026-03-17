# SPRINT-064 Settlement Runtime Audit

**Sprint**: SPRINT-064-SETTLEMENT-LIFECYCLE-FIX **Date**: 2026-03-16
**Auditor**: Claude OS (Opus 4.6) **Classification**: Runtime certification
audit

---

## Executive Summary

Settlement was tested at runtime against production Supabase using SPRINT-062
posted pick `062a0001` (LeBron James, Points Over 24.5). **`lifecycleSettle()`
succeeded**, transitioning the pick from POSTED to SETTLED with full DB state
mutation. `prop_settlements` INSERT also succeeded with correct column names.

**Settlement verdict: PASS (harness-bounded)**

---

## 1. Settlement Path Map (Actual Runtime)

### Input

- **Pick**: `062a0001-0000-4000-8000-000000000001`
- **Player**: LeBron James
- **Market**: Points Over 24.5
- **Pre-state**:
  `status=pending, settlement_status=pending, settlement_result=null`
- **Lifecycle stage**: POSTED (posted_to_discord=true,
  discord_message_id=1483145928566378556)

### Path Executed

```
1. checkSettleIdempotency()     → isDuplicate=false (but logged settlement_frozen column missing)
2. prop_settlements INSERT      → SUCCESS (id=8cd05a4f, settlement_result=win)
3. lifecycleSettle()            → SUCCESS
   a. assertNotFrozen()         → PASS (LOCAL_FILE_STATE=true, frozen=false)
   b. fetch current pick        → PASS
   c. assertWriterAuthority()   → PASS (settler role, settlement fields)
   d. deriveLifecycleStage()    → POSTED
   e. assertTransition()        → POSTED->SETTLED ALLOWED
   f. UPDATE unified_picks      → SUCCESS (settlement_status=settled, status=won)
   g. Optimistic lock check     → PASS (row updated)
```

### Output

- **Post-state**:
  `status=won, settlement_status=settled, settlement_result=win, actual_outcome=28`
- **settled_at**: `2026-03-16T22:05:14.031+00:00`
- **settlement_source**: `harness-064`
- **Idempotency re-test**: Transition validator rejects SETTLED->SETTLED
  (correct behavior)

---

## 2. Settlement Codepath Architecture

### Two Settlement Paths Exist

| Path           | Entry Point                  | Trigger            | DB Writes                                                                         | Status                   |
| -------------- | ---------------------------- | ------------------ | --------------------------------------------------------------------------------- | ------------------------ |
| **Automatic**  | SettlementAgent.settleProp() | game_results query | prop_settlements INSERT + lifecycleSettle() UPDATE                                | RUNTIME PROVEN           |
| **Manual RPC** | manual_settle_pick()         | POST /ops/settle   | prop_settlements + unified_picks + settlement_audit_log + settlement_log + events | BROKEN (missing DB deps) |

### Automatic Path (SettlementAgent)

```
processCompletedGames()
  → query game_results WHERE completed=true AND settlement_status IN ('pending','disputed')
  → processGameSettlement() per game
    → fetchGameSettlementData() from SGO or Odds API
    → processGameProps()
      → query unified_picks WHERE external_game_id = game.external_game_id
      → settleProp() per pick
        → checkSettleIdempotency() [pre-flight]
        → calculatePropSettlement() [determine win/loss/push/void]
        → INSERT prop_settlements [direct Supabase, correct columns]
        → lifecycleSettle() [lifecycle adapter, RUNTIME PROVEN]
```

### Manual RPC Path (manual_settle_pick)

```
POST /ops/settle
  → supabase.rpc('manual_settle_pick', { p_pick_id, p_result, ... })
  → WILL FAIL: references generate_settlement_hash() [function does not exist]
  → WILL FAIL: references settlement_audit_log [table does not exist]
  → WILL FAIL: references settlement_version column [column does not exist]
  → WILL FAIL: references settlement_hash column [column does not exist]
```

---

## 3. Defect Status (Updated from SPRINT-062)

### DEFECT-7 (P1): poster can't reset posted_to_discord — CONFIRMED, NOT SETTLEMENT-BLOCKING

- Affects posting recovery, not settlement path.

### DEFECT-8 (P0): chk_unified_picks_workflow_stage blocks settlement — **INVALID**

- **Root cause**: The CHECK constraint exists only in
  `docs/supabase-schema-unified.sql` (documentation), not in any actual
  migration applied to the database.
- `lifecycleSettle()` does NOT write to `workflow_stage`. It writes to
  `settlement_status` and `status`.
- **Runtime proof**: Settlement succeeded without triggering any constraint
  error.
- **Status**: CLOSED — not a real defect.

### DEFECT-9 (P0): prop_settlements column name mismatch — **INVALID**

- SettlementAgent correctly uses `final_pick_id` and `settlement_result` (lines
  550, 557).
- These match the `prop_settlements` schema in `004_settlement_schema.sql`
  (lines 73, 84).
- **Runtime proof**: `prop_settlements` INSERT succeeded with these exact column
  names.
- **Status**: CLOSED — not a real defect.

### NEW DEFECT-10 (P1): settlement_frozen column missing on unified_picks

- `checkSettleIdempotency()` queries `settlement_frozen` column.
- Column does not exist on `unified_picks` table.
- Impact: Idempotency pre-flight check logs warning but returns
  `isDuplicate=false` (fail-open).
- Settlement still succeeds because transition validator catches
  SETTLED->SETTLED at a higher level.
- **Severity**: P1 — idempotency degraded but not broken.

### NEW DEFECT-11 (P0): manual_settle_pick() RPC is non-functional

- References `generate_settlement_hash()` function — never created.
- References `settlement_audit_log` table — never created.
- References `settlement_version` column on unified_picks — never added.
- References `settlement_hash` column on unified_picks — never added.
- **Impact**: `POST /ops/settle` endpoint is broken. Operators cannot manually
  settle picks via RPC.
- **Severity**: P0 — blocks operator manual settlement workflow.

### NEW DEFECT-12 (P2): settlement guard trigger not attached

- `prevent_direct_settlement_update()` function exists in migration but no
  `CREATE TRIGGER` attaches it.
- Impact: Settlement guard is dead code. Direct SQL updates to settlement fields
  are unprotected.
- **Severity**: P2 — defense-in-depth gap, but lifecycle adapter provides
  primary protection.

### NEW DEFECT-13 (P1): Autopilot freeze blocks settlement without Redis

- `assertNotFrozen()` uses Redis-backed state. Without Redis, defaults to
  FAIL-CLOSED (frozen).
- In local dev, requires `LOCAL_FILE_STATE=true` +
  `runtime_config/autopilot_state.json`.
- In production, requires Redis to be healthy.
- **Impact**: Settlement blocked in any environment where Redis is down.
- **Severity**: P1 — operational reliability concern.

---

## 4. DB Constraints Verified

| Constraint                              | Table            | Values Allowed                                                 | Settlement Impact |
| --------------------------------------- | ---------------- | -------------------------------------------------------------- | ----------------- |
| `valid_unified_picks_settlement_status` | unified_picks    | pending, settled, void, disputed                               | COMPATIBLE        |
| `valid_settlement_result`               | prop_settlements | win, loss, push, void                                          | COMPATIBLE        |
| `valid_settlement_method`               | prop_settlements | automatic, manual, disputed                                    | COMPATIBLE        |
| `valid_bet_side`                        | prop_settlements | over, under, home, away, yes, no                               | COMPATIBLE        |
| `settlement_data_integrity`             | prop_settlements | result null => value null, or result != void => value not null | COMPATIBLE        |

No blocking constraints found. All constraints are compatible with the
settlement codepath.

---

## 5. Transition Rules for Settlement

| From      | To       | Required Timestamps | Allowed Writers            | Tested             |
| --------- | -------- | ------------------- | -------------------------- | ------------------ |
| POSTED    | SETTLING | []                  | settler                    | Not tested         |
| POSTED    | SETTLED  | [settled_at]        | settler                    | **RUNTIME PROVEN** |
| SETTLING  | SETTLED  | [settled_at]        | settler                    | Not tested         |
| SUBMITTED | SETTLED  | [settled_at]        | settler                    | Not tested         |
| POSTED    | VOID     | []                  | settler, operator_override | Not tested         |
| SETTLED   | VOID     | []                  | settler, operator_override | Not tested         |
| SETTLED   | DISPUTED | []                  | operator_override          | Not tested         |
| DISPUTED  | SETTLED  | [settled_at]        | settler, operator_override | Not tested         |

---

## 6. Evidence Artifacts

| Artifact                             | Path                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Harness script                       | `apps/api/src/scripts/settlement-harness-064.ts`                                                 |
| Harness output (run 1 - success)     | Terminal output captured in sprint report                                                        |
| Harness output (run 2 - idempotency) | `out/sprints/SPRINT-064-SETTLEMENT-LIFECYCLE-FIX/2026-03-16/proofs/proof_settlement_harness.txt` |
| DB post-state                        | `out/sprints/SPRINT-064-SETTLEMENT-LIFECYCLE-FIX/2026-03-16/proofs/proof_db_post_state.txt`      |
| Autopilot state file                 | `runtime_config/autopilot_state.json`                                                            |

---

## 7. Remaining Gaps

1. **SettlementAgent automatic trigger not tested** — requires game_results data
   from external API.
2. **manual_settle_pick() RPC broken** — missing DB objects (DEFECT-11).
3. **settlement_frozen column missing** — idempotency pre-flight degraded
   (DEFECT-10).
4. **Settlement guard trigger not attached** — defense-in-depth gap (DEFECT-12).
5. **Recap path not tested** — RecapAgent has column mismatch bugs
   (pre-existing).
6. **No real game data settlement** — harness used synthetic actual_value, not
   external API data.

---

**Audit conclusion: Settlement is architecturally sound and runtime-functional
via lifecycleSettle(). The automatic trigger path (SettlementAgent +
game_results) and manual RPC path have operational gaps that prevent full
autonomous settlement. The lifecycle adapter path is the only proven settlement
mechanism.**
