# CI Failure Resolver Guide

**Version**: 1.1.0
**Phase**: A (Classification + Safe Autofix) + C (Auto-Revert, feature-flagged)
**Status**: Active

## Overview

The CI Failure Resolver is an automated system that detects, classifies, and
responds to CI failures. It operates under strict safety constraints defined in
the [AUTO_RESOLUTION_POLICY.md](./AUTO_RESOLUTION_POLICY.md).

### Key Principles

1. **Never auto-merge** - All fixes require human approval
2. **Never modify protected branches** - All changes via PR
3. **Safe autofix only** - Only lint/format errors are auto-fixed
4. **Evidence-first** - All actions are logged with artifacts

---

## How It Works

```
CI Workflow Fails
      │
      ▼
┌─────────────────────────────┐
│ CI Failure Resolver Triggers│
│ (workflow_run.completed)    │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 1. Collect Context          │
│    - Workflow name          │
│    - Run URL                │
│    - Failed jobs/steps      │
│    - Commit SHA             │
│    - PR number (if exists)  │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 2. Download & Analyze Logs  │
│    - Extract error context  │
│    - Apply regex heuristics │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 3. Classify Failure         │
│    - FLAKE, REGRESSION,     │
│      CONFIG, MIGRATION,     │
│      SECURITY, POLICY,      │
│      LINT, TYPESCRIPT,      │
│      TEST, BUILD, DEPENDENCY│
└─────────────┬───────────────┘
              │
      ┌───────┴───────┐
      │               │
      ▼               ▼
┌───────────┐  ┌────────────────┐
│ LINT      │  │ Other Classes  │
│ (Safe)    │  │ (Needs Human)  │
└─────┬─────┘  └───────┬────────┘
      │                │
      ▼                ▼
┌───────────┐  ┌────────────────┐
│ Create    │  │ Create Issue   │
│ Autofix   │  │ or PR Comment  │
│ PR        │  │ with summary   │
└───────────┘  └────────────────┘
```

---

## Failure Classifications

| Class        | Description                  | Severity | Auto-Fix |
| ------------ | ---------------------------- | -------- | -------- |
| `FLAKE`      | Transient (network, timeout) | P3       | No       |
| `REGRESSION` | Code regression              | P1       | No       |
| `CONFIG`     | Environment/config error     | P2       | No       |
| `MIGRATION`  | Schema/migration issue       | P0       | No       |
| `SECURITY`   | Vulnerability detected       | P0       | No       |
| `POLICY`     | Charter/gate violation       | P1       | No       |
| `LINT`       | Linting/format error         | P3       | **Yes**  |
| `TYPESCRIPT` | Type errors                  | P2       | No       |
| `TEST`       | Test failure                 | P1       | No       |
| `BUILD`      | Build failure                | P1       | No       |
| `DEPENDENCY` | Dependency issue             | P2       | No       |

See [CI_FAILURE_CLASSIFICATION.md](./CI_FAILURE_CLASSIFICATION.md) for details.

---

## Setup

### 1. Bootstrap Labels

Run once to create required GitHub labels:

```bash
npx tsx scripts/ops/bootstrap-github-labels.ts
```

This creates labels like:

- `ci-failed`, `auto-fix`, `needs-human`
- `ci:LINT`, `ci:TYPESCRIPT`, `ci:MIGRATION`, etc.
- `severity:P0`, `severity:P1`, `severity:P2`, `severity:P3`

### 2. Verify Workflow

The resolver triggers on these workflow failures:

- CI Pipeline
- Compile Green Gate
- Charter Guards
- Schema Drift Check
- E2E CI
- Playwright Proof Pack

To add more workflows, edit `.github/workflows/ci-failure-resolver.yml`:

```yaml
on:
  workflow_run:
    workflows:
      - 'CI Pipeline'
      - 'Your New Workflow' # Add here
```

### 3. Check Feature Flags

Feature flags in `runtime_config/ci_automation.json`:

```json
{
  "features": {
    "FAILURE_CLASSIFICATION_ENABLED": true,
    "AUTO_FIX_PR_ENABLED": true,
    "AUTO_REVERT_ENABLED": false,
    "AUTOPILOT_FREEZE_ENABLED": false
  }
}
```

---

## Usage

### Automatic Behavior

When a monitored workflow fails:

1. **For LINT failures on branches**:
   - Creates fix branch: `autofix/{branch}-{run-id}`
   - Runs `npm run lint:fix` and `npm run format`
   - Opens PR targeting the original branch
   - Labels: `auto-fix`, `ci-failed`, `ci:LINT`

2. **For PR failures (non-autofix)**:
   - Comments on the PR with failure summary
   - Labels PR: `needs-human`, `ci-failed`, `ci:{CLASS}`, `severity:{LEVEL}`

3. **For main branch failures**:
   - Creates a GitHub Issue
   - Labels: `needs-human`, `ci-failed`, `ci:{CLASS}`, `severity:{LEVEL}`

4. **For FLAKE failures**:
   - Logs informational notice
   - Comments on PR (if exists) suggesting re-run

5. **For protected branch failures** (main, release/*):
   - If `AUTO_REVERT_ENABLED=true`: Creates revert PR
   - If `AUTO_REVERT_ENABLED=false`: Creates issue recommending revert
   - Labels: `auto-revert`, `ci-restore-green`, `ci-failed`
   - Never auto-merges the revert PR

### Manual Intervention

The resolver **never** auto-merges. You must:

1. Review the auto-fix PR or issue
2. Verify the fix is correct
3. Approve and merge manually

---

## Test Plan

### Simulating Failures

#### 1. Lint Failure (Auto-Fixable)

```bash
# Create test branch
git checkout -b test/lint-failure

# Introduce lint error
echo "const x = 1" >> apps/api/src/test-lint.ts  # Missing semicolon

# Commit and push
git add -A
git commit -m "test: introduce lint error"
git push origin test/lint-failure

# Create PR
gh pr create --title "test: lint failure" --body "Testing CI resolver"

# Wait for CI to fail and resolver to create autofix PR
```

**Expected**: Resolver creates `autofix/test/lint-failure-{run-id}` branch with
fix.

#### 2. TypeScript Failure (Needs Human)

```bash
# Create test branch
git checkout -b test/ts-failure

# Introduce type error
echo "const x: number = 'string'" >> apps/api/src/test-ts.ts

# Commit, push, create PR
git add -A && git commit -m "test: type error" && git push origin test/ts-failure
gh pr create --title "test: typescript failure" --body "Testing CI resolver"

# Wait for CI to fail
```

**Expected**: Resolver comments on PR with classification `ci:TYPESCRIPT`.

#### 3. Main Branch Failure (Issue Creation)

```bash
# This requires a failure on main - use workflow_dispatch for testing
gh workflow run ci.yml --ref main

# If it fails, resolver creates an issue
```

**Expected**: GitHub Issue created with `needs-human` label.

### Verifying Evidence Artifacts

After resolver runs:

1. Go to the resolver workflow run
2. Check "Artifacts" section
3. Download `ci-failure-evidence-{run-id}`
4. Verify `failure-report-{run-id}.md` contains:
   - Workflow name
   - Classification
   - Error context
   - Evidence links

---

## Monitoring

### Workflow Runs

View resolver activity:

```bash
gh run list --workflow=ci-failure-resolver.yml
```

### Labels Dashboard

Check label distribution:

```bash
gh issue list --label "ci-failed" --state all
gh pr list --label "auto-fix" --state all
```

### Artifacts

List recent evidence:

```bash
gh run list --workflow=ci-failure-resolver.yml --json databaseId,conclusion \
  | jq -r '.[].databaseId' \
  | head -5 \
  | xargs -I {} gh run view {} --json artifacts
```

---

## Troubleshooting

### Resolver Not Triggering

1. Check workflow is in the trigger list
2. Verify workflow actually failed (not cancelled)
3. Check autopilot freeze state:
   ```bash
   cat runtime_config/autopilot_state.json
   ```

### Autofix PR Not Created

1. Check if branch is protected (main/develop)
2. Verify failure class is `LINT`
3. Check logs for actual lint changes detected

### Labels Not Applied

1. Run label bootstrap:
   ```bash
   npx tsx scripts/ops/bootstrap-github-labels.ts
   ```
2. Verify gh CLI has label permissions

### Wrong Classification

Classifications use regex heuristics. To improve:

1. Check `ci-failure-resolver.yml` classification rules
2. Add more specific patterns if needed
3. Order matters - first match wins

---

## Phase Roadmap

| Phase           | Features                                    | Status                      |
| --------------- | ------------------------------------------- | --------------------------- |
| **A** (Current) | Classification + LINT autofix + Issues      | Active                      |
| B               | Staging autofix expansion                   | Planned                     |
| **C**           | Auto-revert PR generation (feature-flagged) | Implemented (flag OFF)      |
| D               | Freeze enforcement                          | Planned                     |

---

## Auto-Revert Feature (Phase C)

### Overview

When a CI failure occurs on a protected branch (`main` or `release/*`) and it's
not classified as a FLAKE, the resolver can automatically create a revert PR.

### Feature Flag

The auto-revert feature is controlled by `AUTO_REVERT_ENABLED` in
`runtime_config/ci_automation.json`:

```json
{
  "features": {
    "AUTO_REVERT_ENABLED": false
  }
}
```

**Default**: `false` (disabled)

### Enabling Auto-Revert

To enable auto-revert PR creation:

1. Edit `runtime_config/ci_automation.json`:
   ```json
   {
     "features": {
       "AUTO_REVERT_ENABLED": true
     }
   }
   ```

2. Commit and push the change to `main`

3. Future protected branch failures will trigger revert PR creation

### Behavior When Enabled

1. **Failure detected** on `main` or `release/*`
2. **Classification** determines it's NOT a FLAKE
3. **Revert branch created**: `revert/{branch}-{commit-short}-{run-id}`
4. **Git revert executed**: `git revert --no-edit {commit}`
5. **Push to revert branch** (never force push)
6. **Revert PR created** with:
   - Title: `revert: {original commit message}`
   - Labels: `auto-revert`, `ci-restore-green`, `ci-failed`
   - Body: Reason, evidence, fix-forward reminder

### Behavior When Disabled

1. **Failure detected** on `main` or `release/*`
2. **Classification** determines it's NOT a FLAKE
3. **Issue created** with:
   - Title: `CI Failure on {branch}: Revert Recommended`
   - Labels: `needs-human`, `ci-restore-green`, `ci-failed`
   - Body: Revert command, manual steps, explanation

### Conflict Handling

If the revert encounters merge conflicts:
- Revert is aborted (no partial reverts)
- Issue created requesting manual revert
- Labels: `needs-human`, `ci-restore-green`

### Safety Guarantees

- **Never force pushes** - All pushes are regular pushes
- **Never auto-merges** - Revert PR requires human approval
- **Respects freeze state** - No action if autopilot is frozen
- **Clean rollback** - Conflicts trigger abort, not partial commit

---

## Related Documents

- [AUTO_RESOLUTION_POLICY.md](./AUTO_RESOLUTION_POLICY.md) - Policy framework
- [CI_FAILURE_CLASSIFICATION.md](./CI_FAILURE_CLASSIFICATION.md) -
  Classification rules
- [FORBIDDEN_ACTIONS.md](./FORBIDDEN_ACTIONS.md) - Safety guardrails
- [AUTOPILOT_FREEZE_MATRIX.md](./AUTOPILOT_FREEZE_MATRIX.md) - Freeze conditions

---

**Owner**: Platform Engineering **Last Updated**: 2026-01-18
