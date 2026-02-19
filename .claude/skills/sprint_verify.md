# Skill: Sprint Verify

## Purpose

Run all verification checks after implementation is complete.

## Invocation

```
/sprint-verify
```

## Procedure

### Step 1: Type Check

```bash
npm run type-check
```

**Expected**: No errors

**If fails**:
1. Read error messages
2. Fix type issues
3. Re-run type check
4. Only proceed when clean

### Step 2: Run Tests

```bash
npm run test
```

**Expected**: All tests pass

**If fails**:
1. Identify failing tests
2. Determine if failure is:
   - Bug in implementation → Fix code
   - Outdated test → Update test
   - New test needed → Add test
3. Re-run tests
4. Only proceed when green

### Step 3: Lifecycle Gate (if applicable)

Only if sprint touched `unified_picks` or lifecycle-related code:

```bash
cd apps/api && npm run lifecycle:single-writer -- --strict
```

**Expected**: GATE PASSED, 0 violations

**If fails**:
1. Identify violation file/line
2. Refactor to use lifecycle adapter
3. Re-run gate
4. Only proceed when green

### Step 4: Build

```bash
npm run build
```

**Expected**: Build succeeds

**If fails**:
1. Read build errors
2. Fix bundling/compilation issues
3. Re-run build
4. Only proceed when successful

### Step 5: E2E Tests (if applicable)

Only for changes affecting user-facing flows:

```bash
npm run test:e2e
```

### Step 6: Summary

After all checks pass:

```markdown
## Verification Summary

| Check | Status | Details |
|-------|--------|---------|
| Type Check | ✅ | Clean |
| Tests | ✅ | X/X passing |
| Lifecycle Gate | ✅ | 0 violations |
| Build | ✅ | Success |

All checks passing. Ready for proof bundle.
```

## Failure Protocol

If ANY check fails:

1. **DO NOT proceed** to proof bundle
2. **FIX** the issue
3. **RE-RUN** the failing check
4. **RE-RUN** all subsequent checks
5. Only claim complete when ALL green

## Verification Order

The order matters:

1. **Type Check** - Catches compile errors first
2. **Tests** - Catches logic errors
3. **Gate** - Catches policy violations
4. **Build** - Catches bundling issues

Never skip steps. Never reorder.
