# SOP: Lint Debt Policy - Legacy Quarantine

> **Sprint**: STRUCTURAL-DOMINANCE-FINALIZE-006 **Status**: AUTHORITATIVE **Last
> Updated**: 2026-02-28

---

## Overview

This document governs the containment and reduction of pre-existing lint
warnings in the codebase. Legacy lint debt is quarantined under a strict warning
budget that MUST NOT increase.

---

## Warning Budget System

### Current Budgets

| Package     | Baseline Date | Warning Budget | Status     |
| ----------- | ------------- | -------------- | ---------- |
| discord-bot | 2026-02-28    | 1650           | Quarantine |

### Budget Rules

1. **No Growth**: Warning count MUST NOT exceed budget
2. **Fail-Closed**: CI fails if warnings exceed budget
3. **Lock Improvements**: When warnings decrease, budget SHOULD be reduced
4. **No Exceptions**: New code MUST NOT introduce warnings

---

## CI Enforcement

### Budget Gate

The lint budget is enforced in CI via the `lint:budget` script:

```bash
# Run budget check
pnpm --filter discord-bot run lint:budget
```

### Gate Output

```
🔍 Discord Bot Lint Warning Budget Gate
=========================================
Budget: 1650 warnings (baseline from 2026-02-28)

Current state:
  Errors:   0
  Warnings: 1645
  Budget:   1650

✅ PASS: Warning budget OK (5 under budget)
```

### Failure Modes

| Condition          | Result | Action Required                                  |
| ------------------ | ------ | ------------------------------------------------ |
| Errors > 0         | FAIL   | Fix all lint errors                              |
| Warnings > Budget  | FAIL   | Fix new warnings or get approval to raise budget |
| Warnings <= Budget | PASS   | Continue                                         |

---

## Rule Relaxation Rationale

The following rules were relaxed from `error` to `warn` for discord-bot as part
of CI-TRUTH-UNBLOCK-005:

### Code Quality (Low Risk)

- `complexity` - Legacy functions have high cyclomatic complexity
- `max-lines` - Legacy files exceed line limits
- `max-lines-per-function` - Legacy functions are too long
- `max-depth` - Legacy code has deep nesting
- `max-params` - Legacy functions have many parameters
- `no-console` - Expected in Node.js applications
- `no-return-await` - Performance concern, not safety

### Style (Low Risk)

- `import/order` - Import ordering inconsistency
- `import/no-duplicates` - Duplicate imports
- `prefer-const` - Let vs const preference

### Type Safety (Medium Risk - Legacy Only)

- `@typescript-eslint/no-explicit-any` - Legacy code uses `any`
- `@typescript-eslint/no-non-null-assertion` - Legacy code uses `!`
- `@typescript-eslint/ban-ts-comment` - Legacy code uses `@ts-ignore`
- `@typescript-eslint/ban-types` - Legacy code uses deprecated types
- `@typescript-eslint/no-var-requires` - Legacy CommonJS imports

### Safety (Medium Risk - Legacy Only)

- `no-case-declarations` - Variable declarations in switch cases
- `security/detect-unsafe-regex` - Potential ReDoS patterns

---

## Debt Reduction Plan

### Phase 1: Containment (Current)

- [x] Establish baseline warning count
- [x] Implement CI budget gate
- [x] Document policy

### Phase 2: Quick Wins (Future Sprint)

- [ ] Fix auto-fixable warnings (11 currently)
- [ ] Address `prefer-const` violations
- [ ] Fix `import/order` violations

### Phase 3: Type Safety (Future Sprint)

- [ ] Replace `any` with proper types
- [ ] Remove `@ts-ignore` comments
- [ ] Add proper null checks

### Phase 4: Code Quality (Future Sprint)

- [ ] Refactor complex functions
- [ ] Split large files
- [ ] Reduce function parameters

---

## Budget Change Process

### To Reduce Budget (Encouraged)

1. Fix warnings and verify count decreased
2. Update `WARNING_BUDGET` in `scripts/lint-budget.js`
3. Commit with message: `chore(lint): reduce discord-bot warning budget to X`

### To Increase Budget (Requires Approval)

1. Document why increase is necessary
2. Get approval from tech lead
3. Create tracking issue for debt paydown
4. Update budget with justification comment

---

## Monitoring

### Metrics to Track

- Current warning count vs budget
- Warning reduction over time
- New warnings introduced per PR

### Health Indicators

- ✅ **Healthy**: Warnings decreasing over time
- ⚠️ **At Risk**: Warnings stable but not decreasing
- ❌ **Unhealthy**: Warnings increasing toward budget

---

## References

- Budget Script: `apps/discord-bot/scripts/lint-budget.js`
- ESLint Config: `apps/discord-bot/.eslintrc.js`
- CI Workflow: `.github/workflows/ci.yml`

---

**Document Owner**: Engineering Team **Sprint Reference**:
STRUCTURAL-DOMINANCE-FINALIZE-006
