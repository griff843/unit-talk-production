# PHASE 5 Workflow Fix - 2026-01-18

## Summary

Fixed the Phase 5 PROD Smart Form Validation workflow to pass reliably with
idempotent test data creation and proper monorepo workspace handling.

## Issues Addressed

### 1. Tier Constraint Violation

**Problem**: User creation failed with
`chk_users_tier constraint violation - 'Premium' rejected`

**Cause**: PROD database has a specific tier constraint. The valid tiers are:

- `Free` (default)
- `VIP`
- `VIP+`
- `Black Label`

The workflow was incorrectly using `'Premium'` which is not a valid tier.

**Fix**: Added `discoverValidTier()` function that:

1. Defines the known valid tiers: `['Free', 'VIP', 'VIP+', 'Black Label']`
2. Queries existing users to confirm tier format
3. Falls back to `'Free'` as the safest default

### 2. npm ci Lock Mismatch

**Problem**: Running `npm ci` in `apps/smart-form` subdirectory caused EUSAGE
errors due to lockfile mismatch.

**Cause**: Monorepo uses a single root `package-lock.json`. Running `npm ci` in
subdirectories fails because they don't have their own lockfile.

**Fix**: Enforced workspace-only install strategy:

- ONE `npm ci` at root only per job
- All app commands via `npm run --workspace=apps/smart-form` or
  `npm exec --workspace=apps/smart-form`
- NO `cd` into subdirs for npm/npx commands

### 3. Playwright Execution

**Problem**: `cd apps/smart-form && npx playwright test` caused working
directory issues.

**Fix**: Use `npm exec --workspace=apps/smart-form -- playwright test ...` which
runs playwright from the workspace context while respecting root node_modules.

### 4. Missing Preflight Check

**Problem**: Workflow would fail deep in execution if PROD secrets were not
configured.

**Fix**: Added a `preflight` job that verifies all required secrets exist before
any work begins. Subsequent jobs depend on preflight passing.

### 5. Artifact Reliability

**Problem**: Smoke pack output file sometimes missing on failure.

**Fix**:

- Create output file before tests run (with timestamp)
- Use `if-no-files-found: warn` on artifact uploads
- Create directories explicitly before tests

## Workflow Structure

```
preflight              → Verify PROD secrets exist
    ↓
create-prod-test-data  → Create/reuse test tenant + user (idempotent)
    ↓
verify-schema-parity   → Verify 7 required tables exist
    ↓
run-prod-smoke-pack    → Build, start server, run Playwright tests
    ↓
verify-db-isolation    → Confirm only test data was touched
    ↓
generate-proof-bundle  → Create final status report
```

## Key Changes

| Before                                    | After                                         |
| ----------------------------------------- | --------------------------------------------- |
| `cd apps/smart-form && npm ci`            | `npm ci` (root only)                          |
| `cd apps/smart-form && npx playwright...` | `npm exec --workspace=apps/smart-form -- ...` |
| `tier: 'Premium'`                         | `tier: discoverValidTier()`                   |
| No preflight                              | Preflight checks secrets                      |
| Single query for existing user            | Query with `.maybeSingle()` + tenant_id       |

## Verification

Run workflow manually:

```bash
gh workflow run "PHASE 5 - PROD Smart Form Validation" --ref feat/phase15-orchestrator
gh run watch
```

Expected result: All 6 jobs pass, proof bundle shows "PROD READY".

---

**Author**: Claude Opus 4.5 **Date**: 2026-01-18
