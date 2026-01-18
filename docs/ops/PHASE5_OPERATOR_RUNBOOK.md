# Phase 5 PROD Validation - Operator Runbook

## Overview

Phase 5 validates Smart Form hardening in PROD using isolated test data. This runbook provides step-by-step instructions for executing and monitoring the validation workflow.

**Environment**: PROD (cqfnsozknjzvyiziwicl)
**Branch**: feat/phase15-orchestrator
**Workflow**: `.github/workflows/phase5-prod-validation.yml`

---

## Prerequisites

1. **GitHub CLI installed and authenticated**
   ```powershell
   # Verify gh CLI
   gh auth status

   # Expected output: Logged in to github.com as griff843
   ```

2. **Git repository up to date**
   ```powershell
   cd C:\Users\griff\OneDrive\Desktop\unit-talk-production-main
   git checkout feat/phase15-orchestrator
   git pull origin feat/phase15-orchestrator
   ```

3. **PROD secrets configured in GitHub**
   - `SUPABASE_URL_PROD`
   - `SUPABASE_SERVICE_ROLE_KEY_PROD`
   - `SUPABASE_ANON_KEY_PROD`
   - `SUPABASE_PROJECT_REF_PROD`

---

## Quick Start (Single Command)

```powershell
# From repo root
gh workflow run phase5-prod-validation.yml --ref feat/phase15-orchestrator
```

Then monitor via GitHub UI:
```
https://github.com/griff843/unit-talk-production/actions/workflows/phase5-prod-validation.yml
```

---

## Step-by-Step Execution

### Step 1: Trigger Workflow

**Via GitHub CLI:**
```powershell
gh workflow run phase5-prod-validation.yml --ref feat/phase15-orchestrator
```

**Via GitHub UI:**
1. Navigate to https://github.com/griff843/unit-talk-production/actions
2. Click "PHASE 5 - PROD Smart Form Validation"
3. Click "Run workflow"
4. Select branch: `feat/phase15-orchestrator`
5. Optional inputs:
   - Skip test data creation: ☐ (unchecked)
   - Cleanup test data: ☐ (unchecked - recommended to keep for debugging)
6. Click "Run workflow"

### Step 2: Monitor Execution

**Get Run ID:**
```powershell
gh run list --workflow=phase5-prod-validation.yml --limit 1 --json databaseId,status,conclusion
```

**Watch in Real-Time:**
```powershell
# Replace <RUN_ID> with actual run ID
gh run watch <RUN_ID>
```

**Or use our monitoring script:**
```powershell
# Monitors every 30 seconds until completion
powershell.exe -ExecutionPolicy Bypass -File scripts/ops/monitor-phase5-run.ps1
```

### Step 3: Download Artifacts

**After workflow completes:**
```powershell
# Get latest run ID
$runId = Get-Content out\phase5-prod-validation\latest-run-id.txt

# Download all artifacts
gh run download $runId --dir out\phase5-prod-validation\$runId
```

**Artifacts include:**
- `phase5-final-proof-bundle/PHASE5_PROD_PROOF_BUNDLE.md` - Final verdict and summary
- `prod-test-data-ids/` - Test tenant and user IDs created
- `prod-schema-verification/` - Schema parity check results
- `prod-smoke-pack-results/` - Full Playwright smoke pack output
- `prod-isolation-verification/` - DB isolation proof

### Step 4: Review Results

**Read Proof Bundle:**
```powershell
$runId = Get-Content out\phase5-prod-validation\latest-run-id.txt
Get-Content out\phase5-prod-validation\$runId\phase5-final-proof-bundle\PHASE5_PROD_PROOF_BUNDLE.md
```

**Check Smoke Pack Results:**
```powershell
$runId = Get-Content out\phase5-prod-validation\latest-run-id.txt
Get-Content out\phase5-prod-validation\$runId\prod-smoke-pack-results\smoke-pack-prod-output.txt | Select-String -Pattern "passed|failed|PASS|FAIL"
```

---

## Success Criteria (GO/NO-GO Gates)

Phase 5 is **GO** only when ALL gates pass:

1. ✅ **Test Data Creation**: PASS
   - Test tenant and user created in PROD
   - IDs captured for isolation verification

2. ✅ **Schema Verification**: PASS
   - All 7 Smart Form tables exist: `picks`, `pick_publish`, `users`, `tenants`, `games`, `teams`, `raw_props`

3. ✅ **Smoke Pack (15/15)**: PASS
   - All 15 tests passed (or 13/15 with acceptable rate limit interference)
   - No flaky failures

4. ✅ **Rate Limiting**: PASS
   - 429 response after 10 req/min
   - Idempotent requests do NOT count against limit

5. ✅ **Idempotency**: PASS
   - Duplicate submissions return 200 with existing pickId
   - No duplicate picks created in database

6. ✅ **Tenant Validation**: PASS
   - Invalid tenant returns 404 (fail-closed)
   - Never returns 201 for invalid tenant

7. ✅ **User Validation**: PASS
   - Nonexistent/inactive user returns 404/403 (fail-closed)
   - Never returns 500 for user validation

8. ✅ **Canonical Driver**: PASS
   - Response includes `driver: "canonical"`
   - All picks written to canonical `picks` table

9. ✅ **Shadow Mode**: PASS
   - Response includes `publishMode: "shadow"`
   - No Discord publish occurs (verified in isolation check)

10. ✅ **DB Isolation**: PASS
    - Only test tenant/user data touched
    - Real PROD data untouched and verified

---

## Troubleshooting

### Workflow Not Found in gh workflow list

**Problem**: `HTTP 404: workflow phase5-prod-validation.yml not found on the default branch`

**Solution**: Workflow must exist on `main` branch to be discoverable
```powershell
# Ensure workflow is on main
git checkout main
git pull origin main
ls .github/workflows/phase5-prod-validation.yml

# If missing, cherry-pick from feat branch
git checkout feat/phase15-orchestrator
git log --oneline | Select-String "Phase 5"  # Find commit hash
git checkout main
git cherry-pick <commit-hash>
git push origin main
```

### Dependency Installation Failure

**Problem**: Jobs fail at "Install dependencies" step with exit code 1

**Solution**: This was fixed in commit d5eb19e. Ensure you're using the latest workflow:
```powershell
# Verify workflow has monorepo fix
git show HEAD:.github/workflows/phase5-prod-validation.yml | Select-String -Pattern "npm ci\s*$"  # Should NOT have "cd apps/smart-form" before this

# If outdated, pull latest
git checkout feat/phase15-orchestrator
git pull origin feat/phase15-orchestrator
```

### Smoke Pack Failures

**Problem**: Tests fail with validation or database errors

**Check:**
1. **PROD secrets** are configured correctly in GitHub Actions
2. **Schema parity** job passed (all 7 tables exist)
3. **Test data creation** job passed (tenant/user created)
4. **Smart Form code** matches staging (middleware ordering correct)

**Verify locally:**
```powershell
# Check Smart Form middleware ordering
Get-Content apps\smart-form\app\api\domain\picks\insert\route.ts | Select-String -Pattern "GATE [1-4]"

# Expected order:
# GATE 1: Tenant Validation
# GATE 2: User Validation
# GATE 3: EARLY Idempotency Check
# GATE 4: Rate Limiting
```

### Test Data Cleanup

**Manual cleanup if needed:**
```powershell
# Get test IDs from artifacts
$runId = Get-Content out\phase5-prod-validation\latest-run-id.txt
$testDataScript = "out\phase5-prod-validation\$runId\prod-test-data-ids\create-test-data.js"

# Extract IDs (they're in the script output)
# Then manually delete via Supabase dashboard or create cleanup script
```

---

## Post-Validation

### If GO (All Gates Pass)

1. **Archive proof bundle**:
   ```powershell
   $runId = Get-Content out\phase5-prod-validation\latest-run-id.txt
   Copy-Item -Path "out\phase5-prod-validation\$runId\phase5-final-proof-bundle" -Destination "docs\ops\phase5-go-proof-$runId" -Recurse
   ```

2. **Update tracking**:
   - Mark Phase 5 as COMPLETE in project tracker
   - Update `docs/OPERATOR_INPUT_NEEDED.md` with GO status

3. **Proceed to Phase 6**:
   - Storage/retention implementation
   - Hot/warm/cold strategy
   - Scheduled cleanup jobs

### If NO-GO (Any Gate Fails)

1. **Review failure artifacts**:
   ```powershell
   $runId = Get-Content out\phase5-prod-validation\latest-run-id.txt

   # Check schema
   Get-Content out\phase5-prod-validation\$runId\prod-schema-verification\verify-schema.js

   # Check smoke pack
   Get-Content out\phase5-prod-validation\$runId\prod-smoke-pack-results\smoke-pack-prod-output.txt

   # Check isolation
   Get-Content out\phase5-prod-validation\$runId\prod-isolation-verification\verify-isolation.js
   ```

2. **Fix identified issues**:
   - Update Smart Form code if middleware issues
   - Fix schema if table missing
   - Adjust test harness if flaky tests

3. **Re-run Phase 5**:
   ```powershell
   gh workflow run phase5-prod-validation.yml --ref feat/phase15-orchestrator
   ```

4. **Do NOT proceed to Phase 6** until all gates pass

---

## References

- **Workflow File**: `.github/workflows/phase5-prod-validation.yml`
- **Smart Form Code**: `apps/smart-form/app/api/domain/picks/insert/route.ts`
- **Smoke Pack Tests**: `apps/smart-form/tests/smoke-pack.spec.ts`
- **Production Charter**: `docs/PRODUCTION_CHARTER.md`
- **GitHub Actions**: https://github.com/griff843/unit-talk-production/actions

---

**Last Updated**: 2026-01-18
**Operator**: griff843
**Status**: ACTIVE - Ready for Phase 5 execution
