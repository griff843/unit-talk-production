# SPRINT-PHASE11-GAP-CLOSURE-1

**Status**: COMPLETE **Date**: 2026-03-18 **Lane**: Lane 1 — Implementation

## Summary

Fixed P2 defect in `useAgentLogs.ts` where an early return at line 140
unconditionally served hardcoded mock data, making the real database query code
unreachable. The agents dashboard now queries the `agent_logs` table directly
with fail-closed behavior (empty state + error on failure, no mock fallbacks).

## Defect Fixed

**P2: useAgentLogs.ts mock bypass** — Line 140 early `return` always served 5
hardcoded mock log entries. Real database code at line 142+ was unreachable dead
code. Agents page showed fabricated data instead of production truth.

## Fix Applied

- Removed 47 lines of hardcoded mock data array
- Removed unconditional early return that bypassed database query
- Removed mock-data fallback in error handler (replaced with `setLogs([])`)
- Removed mock-data fallback in catch handler (replaced with `setLogs([])`)
- Production path now: `getSupabaseClient()` → query `agent_logs` → transform →
  display. On failure: empty logs + error state surfaced to UI.

## Phase 11 Gap Status After This Sprint

| Gap        | Description                                     | Status     |
| ---------- | ----------------------------------------------- | ---------- |
| P2 defect  | useAgentLogs.ts mock bypass                     | **CLOSED** |
| GAP-PH11-1 | Routine analysis/backfill manual-trigger only   | OPEN       |
| GAP-PH11-2 | No workflow failure escalation                  | OPEN       |
| GAP-PH11-3 | Settlement/recap scheduling policy undocumented | OPEN       |

## Files Changed

- `apps/command-center/src/hooks/useAgentLogs.ts` — mock data removed,
  fail-closed behavior
- `apps/command-center/src/__tests__/useAgentLogs.test.ts` — 8 new tests

## Verification

- CC vitest: 143/143 (12 files, 8 new tests)
- CC type-check: clean (0 errors)
