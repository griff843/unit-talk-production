# Merge Policy

> **Sprint**: CI-MERGE-GUARD-ENFORCEMENT-055 **Status**: ACTIVE **Reference**:
> `CLAUDE_EXECUTION_CONTRACT.md` Section VII

---

## Purpose

This policy ensures code quality and stability by enforcing mandatory
verification gates before any merge to main. It eliminates the possibility of
merging broken code or bypassing quality checks.

### Why This Exists

1. **Type Safety**: TypeScript errors caught early prevent runtime failures
2. **Build Integrity**: All apps must build successfully to prevent deployment
   failures
3. **Test Coverage**: Required tests must pass to maintain functionality
4. **Clean State**: Uncommitted changes create confusion and deployment issues
5. **Hook Compliance**: Git hooks enforce standards; bypassing them undermines
   quality

---

## Required Gates

### All gates must pass before merge.

| Gate                     | Command                                         | Purpose                       |
| ------------------------ | ----------------------------------------------- | ----------------------------- |
| **Type Check**           | `npm run type-check`                            | Verify TypeScript compilation |
| **API Build**            | `npm run build --workspace=apps/api`            | Verify API compiles           |
| **Command Center Build** | `npm run build --workspace=apps/command-center` | Verify UI compiles            |
| **Smart Form Build**     | `npm run build --workspace=apps/smart-form`     | Verify form compiles          |
| **Required Tests**       | `npm run test`                                  | Verify functionality          |
| **Git Status**           | `git status --porcelain`                        | Verify clean working tree     |
| **No Bypass**            | Manual check                                    | Verify no --no-verify usage   |

---

## Required Tests

The following test suites are considered **required** and must pass:

### Critical Tests (MUST PASS)

- **Lifecycle Tests**: `npm run lifecycle:test` (apps/api)
- **Single-Writer Gate**: `npm run lifecycle:single-writer -- --strict`
  (apps/api)
- **Type Check**: `npm run type-check`

### Standard Tests (SHOULD PASS)

- API unit tests: `npm run test --workspace=apps/api`
- All workspace unit tests: `npm run test`

### Optional Tests (Environment-Dependent)

- E2E tests requiring browser installation (Playwright)
- Performance tests with timing thresholds
- Visual regression tests

### Test Priority Order

1. **Critical** - Merge BLOCKED if these fail
2. **Standard** - Investigate failures, document known issues
3. **Optional** - Run in CI with appropriate browser setup

---

## Verification Process

### Running Verification

```bash
# Full verification (recommended)
npm run verify:merge

# Manual verification (if needed)
npm run type-check
npm run build --workspace=apps/api
npm run build --workspace=apps/command-center
npm run build --workspace=apps/smart-form
npm run test
git status
```

### Expected Output

Successful verification:

```
======================================================================
MERGE READINESS VERIFICATION
Sprint: CI-MERGE-GUARD-ENFORCEMENT-055
======================================================================

Running: Type check
...
Running: API build
...
Running: Command Center build
...
Running: Smart Form build
...
Running: Required tests
...
Checking: Git status clean
...
Checking: No --no-verify commits
...

======================================================================
GATE RESULTS
======================================================================

\u2705 Type check: PASS
\u2705 API build: PASS
\u2705 Command Center build: PASS
\u2705 Smart Form build: PASS
\u2705 Required tests: PASS
\u2705 Git status clean: PASS
\u2705 No --no-verify bypass: PASS

======================================================================
\u2705 MERGE READY
All gates passed. Safe to merge to main.
======================================================================
```

---

## Failure Handling

### If Verification Fails

1. **STOP** - Do not merge
2. **IDENTIFY** - Note which gate(s) failed
3. **FIX** - Address the root cause
4. **RE-RUN** - Execute `npm run verify:merge` again
5. **MERGE** - Only after all gates pass

### Common Failures and Fixes

| Failure    | Likely Cause                   | Fix                     |
| ---------- | ------------------------------ | ----------------------- |
| Type check | TypeScript errors              | Fix type issues         |
| Build      | Missing dependencies or errors | Fix build errors        |
| Tests      | Failing assertions             | Fix failing tests       |
| Git status | Uncommitted changes            | Commit or stash changes |

### What Happens on Failure

- **Sprint Status**: FAIL (not COMPLETE)
- **No Bypass**: Cannot skip gates
- **Documentation**: Failure must be documented
- **Re-verification**: Required before merge

---

## Forbidden Actions

These actions are **strictly prohibited**:

| Action                       | Consequence                 |
| ---------------------------- | --------------------------- |
| `git commit --no-verify`     | Bypasses hooks, sprint FAIL |
| `git push --force` to main   | History destruction         |
| Merging without verification | Sprint FAIL                 |
| Ignoring failed gates        | Sprint FAIL                 |

---

## Proof Requirements

Every sprint merge requires proof artifacts:

```
out/sprints/<SPRINT>/<DATE>/proofs/
\u251C\u2500\u2500 proof_typecheck.txt
\u251C\u2500\u2500 proof_build_api.txt
\u251C\u2500\u2500 proof_build_command_center.txt
\u251C\u2500\u2500 proof_build_smart_form.txt
\u251C\u2500\u2500 proof_required_tests.txt
\u251C\u2500\u2500 proof_git_status_clean.txt
\u2514\u2500\u2500 proof_verify_merge_script.txt
```

---

## Sprint Workflow Integration

This policy integrates with the standard sprint workflow:

1. **Phase 3 (Verify)**: Run `npm run verify:merge`
2. **Phase 4 (Proof)**: Capture proof artifacts
3. **Phase 5 (Commit+Tag)**: Commit with sprint reference
4. **Phase 6 (Closeout)**: Merge to main

See: `docs/claude/SPRINT_WORKFLOW_TEMPLATE.md`

---

## Governance

| Aspect      | Owner                               |
| ----------- | ----------------------------------- |
| Policy      | Engineering Team                    |
| Enforcement | CI Pipeline + `verify:merge` script |
| Exceptions  | Requires explicit approval          |

---

**Document Version**: 1.0.0 **Last Updated**: 2026-02-19 **Sprint**:
CI-MERGE-GUARD-ENFORCEMENT-055
