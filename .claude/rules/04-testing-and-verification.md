# Rule 04: Testing and Verification

> Reference: `CLAUDE_EXECUTION_CONTRACT.md` Section VI

## Test Categories

| Type | Command | Purpose |
|------|---------|---------|
| Unit | `npm run test:unit` | Component isolation |
| Integration | `npm run test:integration` | Cross-component |
| E2E | `npm run test:e2e` | Full flow |
| Lifecycle | `npm run lifecycle:test` | Contract enforcement |

## Pre-Implementation Verification

Before writing code:

```bash
# 1. Ensure clean state
git status

# 2. Run existing tests
npm run test

# 3. Verify types
npm run type-check

# 4. Check lifecycle gate (if touching unified_picks)
cd apps/api && npm run lifecycle:single-writer -- --strict
```

## Post-Implementation Verification

After writing code:

```bash
# 1. Type check (catches compile errors)
npm run type-check

# 2. Run affected tests
npm run test

# 3. Run lifecycle gate (if applicable)
cd apps/api && npm run lifecycle:single-writer -- --strict

# 4. Build (catches bundling issues)
npm run build
```

## Test Requirements by Change Type

| Change Type | Required Tests |
|-------------|----------------|
| New feature | Unit + Integration tests |
| Bug fix | Regression test for bug |
| Refactor | Existing tests must pass |
| Lifecycle change | Lifecycle contract tests |
| API change | E2E tests |
| Migration | Schema verification |

## Lifecycle-Specific Tests

```bash
# Run all lifecycle tests
cd apps/api && npm run lifecycle:test

# Run idempotency tests
cd apps/api && npx vitest run src/lib/lifecycle/__tests__/idempotency.test.ts

# Run transition tests
cd apps/api && npx vitest run src/lib/lifecycle/__tests__/lifecycle.test.ts
```

## Verification Checklist

### Before Claiming Completion

- [ ] `npm run type-check` passes
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds
- [ ] No new lint errors
- [ ] Lifecycle gate passes (if applicable)

### Before Merging

- [ ] All CI checks green
- [ ] No TODO comments for critical items
- [ ] Coverage not decreased
- [ ] Documentation updated (if needed)

## Failure Response

### Test Failure

1. **STOP** - Do not proceed
2. **ANALYZE** - Read error message
3. **FIX** - Address root cause
4. **VERIFY** - Re-run tests
5. **CONTINUE** - Only after green

### Gate Failure

1. **STOP** - Do not proceed
2. **IDENTIFY** - Which file/line violated
3. **REFACTOR** - Use lifecycle adapters
4. **VERIFY** - Re-run gate
5. **CONTINUE** - Only after green

## Proof Capture

Always capture verification output:

```bash
# Create proof directory
mkdir -p out/sprints/<SPRINT>/<DATE>/proofs

# Capture test output
npm run test 2>&1 | tee out/sprints/<SPRINT>/<DATE>/proofs/proof_tests.txt

# Capture type check
npm run type-check 2>&1 | tee out/sprints/<SPRINT>/<DATE>/proofs/proof_typecheck.txt

# Capture build
npm run build 2>&1 | tee out/sprints/<SPRINT>/<DATE>/proofs/proof_build.txt

# Capture gate
cd apps/api && npm run lifecycle:single-writer -- --strict 2>&1 | tee ../out/sprints/<SPRINT>/<DATE>/proofs/proof_gate.txt
```
