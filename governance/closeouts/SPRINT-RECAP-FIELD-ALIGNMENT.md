# SPRINT-RECAP-FIELD-ALIGNMENT — Closeout

**Sprint**: SPRINT-RECAP-FIELD-ALIGNMENT **Date**: 2026-03-18 **Status**:
COMPLETE **Commit**: (pending)

## Summary

HF-3 from the Production Day Simulation Audit is **CLOSED**.

RecapService and RecapAgent were querying non-existent columns (`play_status`,
`outcome`) instead of the real settlement lifecycle fields (`settlement_status`,
`settlement_result`). All recap data retrieval is now aligned with the canonical
`unified_picks` schema.

## Changes

| File                                                                   | Change                                                                                                                |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/agents/RecapAgent/recapService.ts`                       | 4 query methods: `play_status` → `settlement_status`, `outcome` → `settlement_result`                                 |
| `apps/api/src/agents/RecapAgent/recapService.ts`                       | `mapRawPickToUnifiedPick`: reads `settlement_result` → `outcome`, `settlement_status` → `play_status` (with fallback) |
| `apps/api/src/agents/RecapAgent/recapService.ts`                       | Micro-recap trigger: uses `settlement_status`/`settlement_result`                                                     |
| `apps/api/src/agents/RecapAgent/index.ts`                              | `monitorUnifiedPicks`: `play_status='pending'` → `settlement_status IS NULL`                                          |
| `apps/api/src/agents/RecapAgent/__tests__/recapFieldAlignment.test.ts` | 14 contract tests proving correct field usage                                                                         |

## Verification

- Type check: PASS
- API vitest: 1128/1128 (14 new)
- Lifecycle gate: PASS (0 violations)

## What Changed

### Before (BROKEN)

```
.in('play_status', ['settled', 'graded'])   ← column does not exist in unified_picks
.not('outcome', 'is', null)                 ← column does not exist in unified_picks
```

### After (FIXED)

```
.eq('settlement_status', 'settled')         ← real column per schema
.not('settlement_result', 'is', null)       ← real column per schema
```

### Mapper (mapRawPickToUnifiedPick)

```
play_status: raw.settlement_status ?? raw.play_status   ← reads real column
outcome: raw.settlement_result ?? raw.outcome            ← reads real column
```

All internal `p.outcome` references (processRecapData, calculateCapperStats,
calculateTierStats, calculateCurrentStreak, findBestPick, etc.) continue working
because the mapper maps `settlement_result` → `outcome`.

## Production Audit Hard-Fail Status

- **HF-1** (canary routing disconnected): CLOSED
  (SPRINT-DISCORD-ROUTING-INTEGRATION)
- **HF-2** (downstream performance propagation): CLOSED
  (SPRINT-CAPPER-PERFORMANCE-MV-CREATION)
- **HF-3** (recap field mismatch): **CLOSED** by this sprint
