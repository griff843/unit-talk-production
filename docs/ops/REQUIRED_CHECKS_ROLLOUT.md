# Required Checks Rollout Plan

**Version**: 1.0.0
**Phase**: B (Gradual Enforcement)
**Status**: Planning

## Purpose

This document defines the phased rollout plan for enabling GitHub required
status checks on the `main` branch. The goal is to enforce quality gates
progressively without disrupting current development velocity.

---

## Current State Analysis

### CI Status on Main (As of 2026-01-18)

| Workflow              | Status  | Issue                              |
| --------------------- | ------- | ---------------------------------- |
| CI Pipeline           | FAILING | Lint errors, Unit test failures    |
| E2E CI Pipeline       | FAILING | Admin RPC execution errors         |
| Deploy to Production  | FAILING | Docker build failures              |
| Documentation Validation | FAILING | Scheduled run failures          |

**Recommendation**: Fix existing failures BEFORE enabling required checks.
See [Pre-Rollout Fixes](#pre-rollout-fixes-required) section.

---

## Candidate Required Checks

### Tier 1: Build & Compile (High Confidence, Low Flake Risk)

| Check Name                  | Workflow              | Job Name                          | Flake Risk | Rationale                           |
| --------------------------- | --------------------- | --------------------------------- | ---------- | ----------------------------------- |
| `compile-green-api`         | compile-green.yml     | TypeScript Compile Check (apps/api) | Very Low | TypeScript errors are deterministic |
| `code-quality / Type check` | ci.yml                | Code Quality                      | Very Low   | Same as above                       |
| `lint-and-validate`         | foundation-cicd.yml   | Lint & Validate                   | Low        | ESLint, Prettier, type-check        |

**Why Start Here**: Build/compile checks are deterministic - they either pass
or fail based on code alone. No external dependencies means near-zero flakiness.

### Tier 2: Unit Tests (Medium Confidence)

| Check Name          | Workflow            | Job Name          | Flake Risk | Rationale                             |
| ------------------- | ------------------- | ----------------- | ---------- | ------------------------------------- |
| `test`              | ci.yml              | Test Suite        | Low-Medium | Uses local Postgres/Redis services    |
| `test`              | foundation-cicd.yml | Unit & Integration Tests | Low-Medium | Same - containerized services   |
| `Gate 2 - Unit Tests` | canonical-convergence-ci.yml | Pre-Deploy Gates | Low | Part of pre-deploy validation   |

**Why Tier 2**: Unit tests can occasionally flake due to timing issues or
service container startup delays. Retry policy recommended.

### Tier 3: Integration Tests (Medium Flake Risk)

| Check Name                  | Workflow            | Job Name               | Flake Risk | Rationale                          |
| --------------------------- | ------------------- | ---------------------- | ---------- | ---------------------------------- |
| `integration-test-staging`  | foundation-cicd.yml | E2E Tests on Staging   | Medium     | Depends on staging environment     |
| `e2e-validation`            | canonical-convergence-ci.yml | E2E Validation | Medium | Requires running services          |

**Why Tier 3**: Integration tests depend on external services and environments.
Higher flake potential requires robust retry policies.

### Tier 4: Security Scanning (Low Flake Risk, High Importance)

| Check Name          | Workflow          | Job Name       | Flake Risk | Rationale                         |
| ------------------- | ----------------- | -------------- | ---------- | --------------------------------- |
| `security-scan`     | charter-guards.yml | Security Scan | Very Low   | npm audit is deterministic        |
| `security`          | ci.yml            | Security Scan  | Low        | Trivy scan, occasional API issues |
| `Gate 4 - Security Scan` | canonical-convergence-ci.yml | Pre-Deploy Gates | Very Low | npm audit |

**Why Tier 4**: Security should be required but not first - gives time to fix
known vulnerabilities without blocking initial rollout.

### Tier 5: Migrations & Schema Verification (Context-Dependent)

| Check Name              | Workflow            | Job Name             | Flake Risk | Rationale                        |
| ----------------------- | ------------------- | -------------------- | ---------- | -------------------------------- |
| `charter-compliance`    | charter-guards.yml  | Charter Compliance   | Low-Medium | Depends on Supabase availability |
| `verify-e2e`            | e2e-ci.yml          | Supabase migrate...  | Medium     | External DB dependency           |
| `pre-deploy-gates`      | canonical-convergence-ci.yml | Pre-Deploy Gates | Medium | DB dry-run validation          |

**Why Tier 5**: Migration checks depend on external databases. Should only be
required after confirming stable connectivity.

---

## Recommended Activation Order

### Phase B-1: Compile Green (Week 1)

**Checks to Enable**:
- `compile-green-api` (compile-green.yml)

**Prerequisites**:
1. All TypeScript errors in apps/api resolved
2. Build passes locally: `npm run type-check`

**Rollback Signal**: 3+ blocked PRs due to false positives

---

### Phase B-2: Code Quality (Week 2)

**Checks to Enable**:
- `lint-and-validate` (foundation-cicd.yml)

**Includes**:
- ESLint
- Prettier format check
- TypeScript type check
- Terraform/K8s manifest validation

**Prerequisites**:
1. `npm run lint` passes on main
2. `npm run format:check` passes on main

**Rollback Signal**: >10% of PRs require lint-only fix commits

---

### Phase B-3: Unit Tests (Week 3-4)

**Checks to Enable**:
- `test` (ci.yml or foundation-cicd.yml)

**Prerequisites**:
1. Unit test pass rate >95% on main (last 10 runs)
2. Retry policy configured (see below)
3. Test flakiness dashboard in place

**Rollback Signal**: >5% flake rate after retry policy

---

### Phase B-4: Security Scanning (Week 5)

**Checks to Enable**:
- `security-scan` (charter-guards.yml)

**Prerequisites**:
1. All HIGH/CRITICAL npm audit issues resolved
2. Known false positives documented and suppressed

**Rollback Signal**: False positive blocking legitimate PRs

---

### Phase B-5: Charter Compliance (Week 6+)

**Checks to Enable**:
- `charter-compliance` (charter-guards.yml)

**Prerequisites**:
1. Supabase secrets configured for all environments
2. Migration reload validation passing
3. PostgREST visibility check passing

**Rollback Signal**: Supabase API instability causing failures

---

## Handling Temporary Flakiness

### Retry Policy

All required checks should have a retry policy before being enforced:

```yaml
# Example: Add retry to test job in ci.yml
test:
  name: Test Suite
  runs-on: ubuntu-latest
  # Add retry strategy
  strategy:
    fail-fast: false
    max-parallel: 1
  steps:
    # ... existing steps ...
    - name: Run unit tests
      uses: nick-fields/retry@v2
      with:
        timeout_minutes: 10
        max_attempts: 2
        retry_wait_seconds: 30
        command: npm run test:unit
```

### Retry Configuration by Check Type

| Check Type         | Max Retries | Wait Between | Timeout     |
| ------------------ | ----------- | ------------ | ----------- |
| Compile/Lint       | 1           | N/A          | 10 minutes  |
| Unit Tests         | 2           | 30 seconds   | 15 minutes  |
| Integration Tests  | 2           | 60 seconds   | 20 minutes  |
| Security Scan      | 2           | 30 seconds   | 10 minutes  |
| E2E Tests          | 3           | 120 seconds  | 30 minutes  |

### Flake Detection

Add flake detection to identify consistently flaky tests:

```bash
# Run after each CI failure
# scripts/ops/detect-flake.sh

#!/bin/bash
TEST_NAME=$1
RUN_ID=$2

# Check if this test failed in last 5 runs
RECENT_FAILURES=$(gh run list --workflow=ci.yml --limit 10 \
  | grep -c "failure")

if [ $RECENT_FAILURES -ge 3 ]; then
  echo "::warning::Potential flake detected in $TEST_NAME"
  # Create issue if not already exists
  gh issue create --title "Flaky Test: $TEST_NAME" \
    --label "flaky-test" \
    --body "Test $TEST_NAME has failed $RECENT_FAILURES/10 recent runs"
fi
```

---

## Measuring Impact

### Key Metrics

| Metric                     | Definition                                    | Target    | Alert Threshold |
| -------------------------- | --------------------------------------------- | --------- | --------------- |
| Main Green %               | % of runs where main branch passes all checks | >95%      | <90%            |
| Mean Time to Fix (MTTF)    | Average time from failure to green            | <2 hours  | >4 hours        |
| PR Merge Block Rate        | % of PRs blocked by required checks           | <10%      | >20%            |
| False Positive Rate        | Failures not caused by actual code issues     | <2%       | >5%             |
| Developer Satisfaction     | Survey score on CI experience                 | >4.0/5.0  | <3.5/5.0        |

### Measurement Scripts

**Main Green Percentage**:
```bash
#!/bin/bash
# scripts/ops/measure-main-green.sh

# Get last 20 workflow runs on main
TOTAL=$(gh run list --branch main --limit 20 | wc -l)
PASSED=$(gh run list --branch main --limit 20 | grep -c "completed.*success")

PERCENTAGE=$((PASSED * 100 / TOTAL))
echo "Main Green %: $PERCENTAGE% ($PASSED/$TOTAL)"

if [ $PERCENTAGE -lt 90 ]; then
  echo "::warning::Main green percentage below threshold: $PERCENTAGE%"
fi
```

**Mean Time to Fix**:
```bash
#!/bin/bash
# scripts/ops/measure-mttf.sh

# Query last 10 failure-to-success transitions
gh api graphql -f query='
{
  repository(owner: "griff843", name: "unit-talk-production") {
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 50) {
            nodes {
              committedDate
              statusCheckRollup {
                state
              }
            }
          }
        }
      }
    }
  }
}' | jq '.data.repository.defaultBranchRef.target.history.nodes'
# Parse and calculate MTTF
```

### Dashboard Requirements

Create a Grafana dashboard or GitHub Actions summary with:

1. **Main Branch Health**
   - Current status (green/red)
   - Last 24h pass rate
   - Last 7d trend

2. **Check Performance**
   - Individual check pass rates
   - Average execution time
   - Flake rate by check

3. **Developer Impact**
   - PRs blocked by checks
   - Average wait time for CI
   - Retry rate

---

## GitHub Branch Protection Configuration

### Step-by-Step Instructions (Do Not Apply Automatically)

**WARNING**: These are documentation steps only. Apply manually after
all prerequisites are met.

#### Step 1: Navigate to Branch Protection

1. Go to: `https://github.com/griff843/unit-talk-production/settings/branches`
2. Click "Add branch protection rule" or edit existing rule for `main`

#### Step 2: Configure Required Status Checks

1. Check "Require status checks to pass before merging"
2. Check "Require branches to be up to date before merging"
3. In the search box, add checks ONE AT A TIME per phase:

**Phase B-1** (Compile):
```
compile-green-api
```

**Phase B-2** (Add after B-1 stable):
```
lint-and-validate
```

**Phase B-3** (Add after B-2 stable):
```
test
```

**Phase B-4** (Add after B-3 stable):
```
security-scan
```

**Phase B-5** (Add after B-4 stable):
```
charter-compliance
```

#### Step 3: Additional Protections (Optional)

- [ ] Require pull request reviews before merging
- [ ] Require review from Code Owners
- [ ] Dismiss stale pull request approvals when new commits are pushed
- [ ] Require linear history
- [ ] Include administrators (apply rules to admins too)

#### Step 4: Save and Verify

1. Click "Save changes"
2. Create a test PR to verify checks run
3. Attempt to merge without passing checks (should be blocked)

### Rollback Procedure

If a required check causes issues:

1. **Immediate**: Navigate to branch protection settings
2. **Remove the problematic check** from required list
3. **Create incident issue** documenting the problem
4. **Investigate** root cause before re-enabling

```bash
# Emergency rollback via gh CLI (requires admin permissions)
# NOT RECOMMENDED - use web UI for audit trail
gh api repos/{owner}/{repo}/branches/main/protection \
  -X PUT \
  -f required_status_checks='{"strict":true,"contexts":[]}'
```

---

## Pre-Rollout Fixes Required

Before enabling ANY required checks, these issues must be resolved:

### Issue 1: Lint Failures on Main

**Current Status**: CI Pipeline "Lint code" step failing
**Root Cause**: ESLint errors in codebase
**Fix Required**:
```bash
npm run lint:fix
# Commit fix as separate PR
```

### Issue 2: Unit Test Failures on Main

**Current Status**: CI Pipeline "Run unit tests" step failing
**Root Cause**: Test failures or missing fixtures
**Fix Required**:
```bash
npm run test:unit
# Fix failing tests
# Commit as separate PR
```

### Issue 3: E2E RPC Failures

**Current Status**: E2E CI Pipeline "Run admin RPCs" failing
**Root Cause**: Missing or misconfigured RPC endpoints
**Fix Required**:
- Review `apps/api/src/scripts/ci-run-admin-rpcs.ts`
- Ensure all RPC functions exist in Supabase
- Update CI secrets if needed

### Issue 4: Docker Build Failures

**Current Status**: Deploy workflow "Build and push Docker image" failing
**Root Cause**: Build errors in command-center
**Fix Required**:
- Review `apps/command-center/Dockerfile`
- Fix build errors locally
- Commit as separate PR

---

## Rollout Timeline

| Week | Phase | Checks Enabled | Prerequisites                   | Go/No-Go Criteria           |
| ---- | ----- | -------------- | ------------------------------- | --------------------------- |
| 0    | Prep  | None           | Fix all current main failures   | Main green for 5+ runs      |
| 1    | B-1   | compile-green  | TypeScript errors resolved      | 0 false positives in week 1 |
| 2    | B-2   | lint-validate  | Lint passes on main             | <5% retry rate              |
| 3-4  | B-3   | test           | Tests pass >95%, retry policy   | <5% flake rate              |
| 5    | B-4   | security-scan  | No HIGH/CRITICAL vulnerabilities | 0 false positives           |
| 6+   | B-5   | charter-compliance | DB connectivity stable      | <2% flake rate              |

---

## Related Documents

- [AUTO_RESOLUTION_POLICY.md](./AUTO_RESOLUTION_POLICY.md) - Automated resolution
- [CI_FAILURE_CLASSIFICATION.md](./CI_FAILURE_CLASSIFICATION.md) - Failure types
- [CI_FAILURE_RESOLVER_GUIDE.md](./CI_FAILURE_RESOLVER_GUIDE.md) - Resolver usage
- [AUTOPILOT_FREEZE_MATRIX.md](./AUTOPILOT_FREEZE_MATRIX.md) - Freeze conditions

---

**Owner**: Platform Engineering
**Review Cycle**: Weekly during rollout
**Last Updated**: 2026-01-18
