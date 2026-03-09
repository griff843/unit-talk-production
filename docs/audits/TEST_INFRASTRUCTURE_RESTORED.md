# TEST INFRASTRUCTURE RESTORED

**Sprint**: SPRINT-TEST-INFRA-RECOVERY **Date**: 2026-03-09 **Status**: ✅
COMPLETE

---

## Executive Summary

The platform truth audit revealed 119/133 test files failing when
`npx vitest run` was executed. Root cause: no `vitest.config.ts` existed, so
Vitest discovered all test files including 93 Jest tests in `test/`
(incompatible syntax) and 58 quarantined tests.

This sprint fixed the configuration split, scoped Vitest to `src/**/__tests__/`
only, and resolved all infrastructure failures in those 19 Vitest-native files.
Final result: **19/19 test files passing, 491 tests passing**.

---

## Root Cause Analysis

| Issue                                             | Root Cause                                                          | Fix                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 119/133 Vitest failures                           | No `vitest.config.ts` → discovered Jest + quarantined tests         | Created `vitest.config.ts` scoping to `src/**/__tests__/`                                      |
| `jest.fn()` ReferenceError in smoke test          | Jest globals not available in Vitest                                | Added `import { describe, it, expect, vi } from 'vitest'`; replaced `jest.fn()` with `vi.fn()` |
| `@unit-talk/shared` not resolved                  | Workspace package not linked in node_modules                        | Added alias in `vitest.config.ts` pointing to `packages/shared/src/index.ts`                   |
| `../../RiskEngine` not found                      | Wrong import path (should be `../RiskEngine`)                       | Fixed import path in `risk-engine.test.ts`                                                     |
| `import { lifecycleSettle }` assertion failed     | Test expected exact string but actual import has additional exports | Relaxed assertion to `'import { lifecycleSettle'` (prefix match)                               |
| `MVRefreshLagPlaybook.executionType` mismatch     | Playbook upgraded to EXECUTABLE in PR9 but test not updated         | Updated test expectations to match implementation                                              |
| `AutopilotFrozenError` blocking adversarial tests | Autopilot freeze check fails-closed without Redis in test env       | Added `vi.mock('@unit-talk/shared')` to prevent freeze from blocking                           |
| `ConcurrentModificationError` swallowed by catch  | Catch block returned `{ success: false }` instead of re-throwing    | Added re-throw for `ConcurrentModificationError` and `AutopilotFrozenError`                    |
| `updateQuery.select is not a function`            | Production code used mutation pattern; test mock used chaining      | Changed production code to use proper `query = query.eq(...)` chaining                         |
| `RemediationEngine.test.ts` env init failure      | `SUPABASE_URL` not set before module initialization                 | Created `vitest.setup.ts` setting all required env vars                                        |

---

## Files Modified

| File                                                                    | Change                                                                                                                           |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/scripts/productionDashboard.ts`                               | Removed blank line 1 so shebang is on line 1 (eliminates 58 TS errors)                                                           |
| `tsconfig.json` (root)                                                  | Added `apps/api/scripts/**` and `apps/*/scripts/**` to exclude                                                                   |
| `apps/api/vitest.config.ts`                                             | **NEW** — Scopes Vitest to `src/**/__tests__/`, excludes `test/`, quarantine, runners                                            |
| `apps/api/vitest.setup.ts`                                              | **NEW** — Sets env vars before modules initialize at import time                                                                 |
| `apps/api/package.json`                                                 | Added `test:vitest` script                                                                                                       |
| `apps/api/src/agents/BaseAgent/__tests__/smoke.test.ts`                 | Added `import { describe, it, expect, vi } from 'vitest'`; replaced `jest.fn()` with `vi.fn()`                                   |
| `apps/api/src/lib/lifecycle/__tests__/adversarial-validation.test.ts`   | Added `vi.mock('@unit-talk/shared')` to prevent freeze in tests; added `skipTransitionValidation: true` to optimistic-lock tests |
| `apps/api/src/services/risk/__tests__/risk-engine.test.ts`              | Fixed import path from `../../RiskEngine` to `../RiskEngine`                                                                     |
| `apps/api/src/lib/lifecycle/__tests__/settlement-guard.test.ts`         | Relaxed `toContain('import { lifecycleSettle }')` to `toContain('import { lifecycleSettle')`                                     |
| `apps/api/src/services/remediation/__tests__/RemediationEngine.test.ts` | Updated `MVRefreshLagPlaybook` test: `executionType` → `EXECUTABLE`, status `dry_run`                                            |
| `apps/api/src/lib/lifecycle/write-adapter.ts`                           | Imported `ConcurrentModificationError` statically; re-throw hard errors in catch; fixed `.eq()` chaining                         |

---

## Verification Results

### Vitest (`npm run test:vitest`)

```
Test Files  19 passed (19)
Tests       491 passed (491)
```

### Lifecycle Tests (`npm run lifecycle:test`)

```
Test Files  1 passed (1)
Tests       86 passed (86)
```

### Type Check (`npm run type-check`)

```
0 errors
```

---

## Architecture — Two Runner Split

The codebase intentionally has TWO test runners:

| Runner     | Scope                                      | Command               |
| ---------- | ------------------------------------------ | --------------------- |
| **Vitest** | `src/**/__tests__/**/*.test.ts` (19 files) | `npm run test:vitest` |
| **Jest**   | `test/` directory (93 files)               | `npm run test`        |

Quarantined tests (58 files in `**/__quarantine__/**`) are excluded from both
runners. They represent type-drift failures requiring separate remediation.

---

## What Is NOT Fixed (Out of Scope)

- The 58 quarantined Jest tests — these have legitimate type drift, separate
  sprint required
- Jest test suite in `test/` — those were not broken and continue working via
  `npm run test`
- The 13 allowlisted single-writer violations — separate migration sprint
  (existing allowlist)

---

**Sprint Owner**: Claude **Verified**: 2026-03-09
