# Settlement Migration Status

> Updated: 2026-03-08 | Sprint: SPRINT-044R

---

## Summary

SettlementAgent has been migrated off `raw_props`. The active settlement flow
now sources entirely from `unified_picks` and writes via `lifecycleSettle()`.

---

## Before (Pre-044R)

```
game_results (completed)
  → raw_props (SELECT by external_game_id + settlement_status='pending')
    → calculate settlement
      → INSERT prop_settlements (raw_prop_id FK)
      → UPDATE raw_props (settlement_status, settlement_result, settled_at)
      → unified_picks lookup by raw_prop_id (BROKEN — column didn't exist)
```

**Problems:**

- Settlement data sourced from `raw_props` (legacy table with no active writer
  post-044Q)
- `prop_settlements` linked to `raw_prop_id` (legacy FK)
- `unified_picks` lookup by `raw_prop_id` was non-functional (column doesn't
  exist)
- `raw_props` settlement status updates were orphaned writes

---

## After (Post-044R)

```
game_results (completed)
  → unified_picks (SELECT by external_game_id + settlement_status IS NULL or 'pending')
    → calculate settlement (using pick.side, pick.market, pick.stat_type, etc.)
      → INSERT prop_settlements (final_pick_id FK)
      → lifecycleSettle(pick.id) — canonical single-writer settlement
      → settleExecutionTelemetry() — CLV tracking
      → attributeLoss() — loss classification (if loss)
```

**Improvements:**

- Settlement reads from canonical `unified_picks` (active, maintained table)
- `prop_settlements` uses `final_pick_id` (proper FK to unified_picks)
- `lifecycleSettle()` enforces single-writer discipline
- No `raw_props` reads or writes in the settlement path
- Bet side determination uses `pick.side` (explicit field, not heuristic)

---

## Changes Made

| File                                           | Change                                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `apps/api/src/agents/SettlementAgent/index.ts` | `processGameProps()` — queries `unified_picks` instead of `raw_props`                                |
| Same                                           | `settleProp()` — inserts `prop_settlements` with `final_pick_id`, calls `lifecycleSettle()` directly |
| Same                                           | `calculatePropSettlement()` — returns `final_pick_id` instead of `raw_prop_id`, uses `pick.side`     |
| Same                                           | `updateUnifiedPickSettlement()` — removed (logic inlined into `settleProp()`)                        |
| Same                                           | `initialize()` — removed `raw_props` from required tables                                            |
| Same                                           | `manualSettle()` — queries `prop_settlements` by `final_pick_id`                                     |
| Same                                           | `PropSettlement` interface — `raw_prop_id` → `final_pick_id`                                         |

---

## Field Mapping

| Settlement Need | Old Source (raw_props)                                    | New Source (unified_picks)                            |
| --------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| Identity        | raw_props.id                                              | unified_picks.id                                      |
| Game linkage    | raw_props.external_game_id                                | unified_picks.external_game_id                        |
| Pending filter  | raw_props.settlement_status='pending'                     | unified_picks.settlement_status IS NULL or 'pending'  |
| Player name     | raw_props.player_name                                     | unified_picks.player_name                             |
| Stat type       | raw_props.stat_type                                       | unified_picks.stat_type                               |
| Line            | raw_props.line                                            | unified_picks.line                                    |
| Bet side        | raw_props.selection/prediction/side/direction (heuristic) | unified_picks.side (explicit)                         |
| Market          | raw_props.market/market_type                              | unified_picks.market                                  |
| SGO key         | raw_props.external_prop_id or metadata.sgo_market_key     | unified_picks.external_prop_id or meta.sgo_market_key |

---

## Verification

- Type check: PASS (0 errors)
- Single-writer gate: PASS (0 new violations)
- Zero `.from('raw_props')` queries in SettlementAgent
- All raw_props references are comments only (6 sprint-reference comments)
