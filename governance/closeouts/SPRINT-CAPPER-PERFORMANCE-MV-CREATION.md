# SPRINT-CAPPER-PERFORMANCE-MV-CREATION — Closeout

**Sprint**: SPRINT-CAPPER-PERFORMANCE-MV-CREATION **Date**: 2026-03-18
**Status**: COMPLETE **Commit**: 5c270366

## Summary

HF-2 from the Production Day Simulation Audit is **CLOSED**.

Missing downstream capper performance surfaces created and settlement
propagation wired:

- `mv_capper_daily_rollup` materialized view — aggregates settled picks by
  capper + day
- `v_capper_streaks` view — computes current win/loss streaks and last-10 record
- `refresh_capper_daily_rollup()` RPC — concurrent MV refresh callable from
  application code
- SettlementAgent calls refresh after each settlement cycle (non-blocking)
- `/api/cappers` route now resolves against real database surfaces

## Files Changed

| File                                                                  | Change                                 |
| --------------------------------------------------------------------- | -------------------------------------- |
| `supabase/migrations/20260318120000_capper_performance_views.sql`     | MV + view + refresh function + indexes |
| `apps/api/src/agents/SettlementAgent/index.ts`                        | Post-settlement MV refresh hook        |
| `apps/api/src/routes/__tests__/cappers.test.ts`                       | 5 route handler tests                  |
| `apps/api/src/agents/SettlementAgent/__tests__/capperRefresh.test.ts` | 3 settlement refresh tests             |
| `apps/api/src/lib/__tests__/capperPerformanceViews.test.ts`           | 17 migration schema contract tests     |

## Verification

- Type check: PASS
- API vitest: 1114/1114 (25 new)
- Lifecycle gate: PASS (0 violations)
- All pre-commit hooks: PASS

## What Now Updates After Settlement

1. SettlementAgent settles picks via `lifecycleSettle()`
2. After cycle completes with >0 settled picks, `refresh_capper_daily_rollup()`
   RPC fires
3. `mv_capper_daily_rollup` refreshes concurrently (no read lock)
4. `v_capper_streaks` is a real-time view (always fresh on query)
5. `/api/cappers`, CC capper dashboard, and Discord bot capper stats all read
   from these surfaces

## What Downstream Surfaces Are Now Unblocked

- `/api/cappers` — no longer returns DB error for missing relation
- CC `/dashboard/cappers` page — renders real data via proxy
- Discord bot `getCapperStats()` — queries real rollup + streak data
- CC ops-confidence widget — reads latest rollup day

## Production Audit Hard-Fail Status

- **HF-1** (canary routing disconnected): CLOSED (previous sprint)
- **HF-2** (downstream performance propagation): **CLOSED** by this sprint
- **HF-3** (recap field mismatch): OPEN — future sprint
