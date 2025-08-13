# E2E Gate Setup Instructions

## Branch Protection Configuration

To make the E2E staging full test a blocking gate for production deployments, configure the following branch protection rules on the `main` branch:

### Required Status Checks
Add the following required status check:
- `e2e-staging-gate / E2E Staging Full Test`

### GitHub Settings Navigation
1. Go to repository Settings
2. Navigate to Branches in the left sidebar
3. Find the rule for `main` branch (or create one)
4. Under "Require status checks to pass before merging", check:
   - "Require branches to be up to date before merging"
   - Add status check: `e2e-staging-gate`

### Workflow Integration
The E2E gate workflow (`.github/workflows/e2e-staging-full.yml`) will:

1. **Run automatically on**:
   - Pull requests to main
   - Pushes to main/hardening branches
   - Hourly schedule
   - Manual workflow dispatch

2. **Test environment**:
   - Uses shadow mode (`SHADOW_MODE=true`)
   - Disables Discord publishing (`PUBLISH_TO_DISCORD=false`)
   - Full PostgreSQL + Redis + Temporal stack

3. **Validation checks**:
   - API health verification
   - Database state validation (raw_props, scored_props, final_picks)
   - Shadow mode constraint verification
   - Temporal workflow completion

4. **Artifacts**:
   - Test logs
   - API health status
   - Temporal workflow status
   - Database state snapshots

## Local Testing

Run the E2E test locally:

```bash
cd apps/api
npm run e2e:staging-full
```

## Test Fixtures

The workflow attempts to load test fixtures from:
- `tests/fixtures/provider-samples/minimal.json`

Create this file with a minimal sample of provider data for consistent testing when live API access is unavailable in CI.