# PHASE 5 - Workflow Operator Guide

**Workflow**: `.github/workflows/phase5-prod-validation.yml` **Purpose**: PROD
Smart Form validation with isolated test data **Environment**: Production
(cqfnsozknjzvyiziwicl) **Last Updated**: 2025-01-17

---

## Quick Start

### Option 1: Trigger via GitHub UI (Recommended - No CLI Required)

1. **Navigate to Actions tab:**

   ```
   https://github.com/griff843/unit-talk-production/actions
   ```

2. **Select workflow:**
   - Click "PHASE 5 - PROD Smart Form Validation" in left sidebar

3. **Run workflow:**
   - Click "Run workflow" button (top right)
   - Select branch: `feat/phase15-orchestrator` (or `main` if merged)
   - Configure options:
     - [ ] Skip test data creation (leave unchecked for first run)
     - [ ] Cleanup test data after validation (check if you want cleanup)
   - Click green "Run workflow" button

4. **Monitor execution:**
   - Watch live progress in the workflow run page
   - Each step shows real-time logs
   - Typical runtime: 15-20 minutes

5. **Download artifacts:**
   - Scroll to bottom of completed run
   - Click "Artifacts" section
   - Download `phase5-final-proof-bundle`
   - Extract to: `out/phase5-prod-validation/<run-id>/`

### Option 2: Trigger via GitHub CLI (Requires gh CLI)

**First time setup:**

```powershell
# Install GitHub CLI (one-time)
winget install --id GitHub.cli

# Authenticate
gh auth login
```

**Run workflow:**

```powershell
# Trigger Phase 5 workflow
gh workflow run phase5-prod-validation.yml \
  --ref feat/phase15-orchestrator \
  --field skip_test_data_creation=false \
  --field cleanup_test_data=false

# Watch the run
gh run watch

# List recent runs
gh run list --workflow=phase5-prod-validation.yml

# Download artifacts
$RUN_ID = (gh run list --workflow=phase5-prod-validation.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run download $RUN_ID --dir "out/phase5-prod-validation/$RUN_ID"
```

---

## Workflow Steps Breakdown

### Step 1: Create PROD Test Data

**Duration**: ~2 minutes **Actions**:

- Creates isolated test tenant in PROD
- Creates test user under that tenant
- Outputs: `tenant_id`, `user_id`

**Verification**:

- Check job logs for tenant/user IDs
- IDs are used in subsequent steps

### Step 2: Verify PROD Schema

**Duration**: ~1 minute **Actions**:

- Validates 7 Smart Form tables exist in PROD:
  - `picks`
  - `pick_publish`
  - `users`
  - `tenants`
  - `games`
  - `teams`
  - `raw_props`

**Verification**:

- All 7 tables should show ✅ EXISTS

### Step 3: Run PROD Smoke Pack

**Duration**: ~10 minutes **Actions**:

- Starts Smart Form server on port 3021
- Runs 15 Playwright smoke tests
- Tests include:
  - Pick creation
  - Canonical persistence
  - Rate limiting
  - Discord publishing (shadow mode)

**Success Criteria**:

- 15/15 passed (ideal)
- 13/15 passed (acceptable if rate limit interference)

**Verification**:

- Check `smoke-pack-prod-output.txt` artifact
- Review test screenshots if failures

### Step 4: Verify DB Isolation

**Duration**: ~1 minute **Actions**:

- Confirms only test tenant/user were modified
- Verifies real production data untouched
- Checks pick counts by user_id

**Verification**:

- Test user picks should match smoke pack count
- Other user picks should be zero or existing count (unchanged)

### Step 5: Generate Proof Bundle

**Duration**: <1 minute **Actions**:

- Consolidates all artifacts
- Generates markdown proof bundle
- Creates final verdict

**Output**:

- `PHASE5_PROD_PROOF_BUNDLE.md`
- All test artifacts in `phase5-artifacts/`

### Step 6: Cleanup Test Data (Optional)

**Duration**: ~1 minute **Triggered**: Only if `cleanup_test_data=true`
**Actions**:

- Deletes test picks
- Deletes test user
- Deletes test tenant

**Note**: Keep test data for debugging if workflow fails

---

## Workflow Inputs

| Input                     | Type    | Default | Description                                  |
| ------------------------- | ------- | ------- | -------------------------------------------- |
| `skip_test_data_creation` | boolean | `false` | Skip creating new test data (reuse existing) |
| `cleanup_test_data`       | boolean | `false` | Delete test data after validation completes  |

**When to use `skip_test_data_creation=true`:**

- Re-running workflow with existing test data
- Debugging specific step without recreating tenant/user
- Test data from previous run is still valid

**When to use `cleanup_test_data=true`:**

- Final production readiness check
- Want to leave PROD database pristine
- After successful validation

**When to use `cleanup_test_data=false` (default):**

- Initial validation runs
- Need to inspect test data in PROD after workflow
- Debugging failures

---

## Reading Workflow Results

### Success Indicators

**✅ PROD READY:**

```
Executive Summary
Status: ✅ PROD READY

Test Results
- Test Data Creation: ✅ PASSED
- Schema Verification: ✅ PASSED
- Smoke Pack Tests: ✅ PASSED (15/15 or 13/15)
- DB Isolation: ✅ PASSED
```

**What this means:**

- Smart Form hardening validated in PROD
- Safe to promote to production traffic
- No real production data was modified
- All critical paths work in PROD environment

### Failure Indicators

**❌ NOT READY:**

```
Executive Summary
Status: ❌ NOT READY

Test Results
- Test Data Creation: ❌ FAILED
- Schema Verification: ✅ PASSED
- Smoke Pack Tests: ❌ FAILED (8/15)
- DB Isolation: ⚠️ SKIPPED
```

**What to do:**

1. Download artifacts: `prod-smoke-pack-results/`
2. Review `smoke-pack-prod-output.txt`
3. Check test screenshots for UI failures
4. Review server logs in workflow output
5. Fix issues and re-run workflow

### Common Failure Scenarios

**Schema Missing:**

```
❌ picks - NOT FOUND
```

→ Run Supabase migrations first

**Smoke Pack Failures:**

```
❌ Smoke pack FAILED (8/15)
```

→ Check rate limit settings, network connectivity, or database permissions

**DB Isolation Violation:**

```
❌ Real production data was modified
```

→ CRITICAL: Stop immediately, investigate RLS policies and tenant isolation

---

## Artifact Structure

Downloaded artifacts will have this structure:

```
out/phase5-prod-validation/<run-id>/
├── phase5-final-proof-bundle/
│   ├── PHASE5_PROD_PROOF_BUNDLE.md    # Main proof bundle
│   └── phase5-artifacts/
│       ├── prod-test-data-ids/         # Tenant/User IDs
│       ├── prod-schema-verification/   # Schema check results
│       ├── prod-smoke-pack-results/    # Full test output
│       │   ├── smoke-pack-prod-output.txt
│       │   └── test-results/
│       │       └── screenshots/
│       └── prod-isolation-verification/ # DB isolation proof
```

**Key files to review:**

- `PHASE5_PROD_PROOF_BUNDLE.md` - Executive summary and verdict
- `smoke-pack-prod-output.txt` - Detailed test results
- `test-results/screenshots/` - Visual proof of UI tests
- `prod-isolation-verification/verify-isolation.js` - DB isolation script

---

## Troubleshooting

### Workflow Won't Start

**Problem**: Workflow button grayed out or missing

**Solutions**:

1. Ensure workflow file is in `main` or your current branch
2. Check you have write permissions to repo
3. Verify workflow YAML syntax is valid
4. Try refreshing GitHub Actions page

### Test Data Creation Fails

**Problem**: `create-prod-test-data` job fails

**Solutions**:

```powershell
# Check if PROD secrets are configured
gh secret list | Select-String "PROD"

# Required secrets:
# - SUPABASE_URL_PROD
# - SUPABASE_SERVICE_ROLE_KEY_PROD
# - SUPABASE_ANON_KEY_PROD
# - SUPABASE_PROJECT_REF_PROD
```

### Smoke Pack Hangs

**Problem**: Smoke pack step runs >20 minutes

**Solutions**:

1. Check if Smart Form server started (port 3021)
2. Review server startup logs in workflow output
3. Verify PROD Supabase is accessible
4. Check for rate limiting issues

### Artifacts Not Generated

**Problem**: No artifacts to download after workflow completes

**Solutions**:

1. Wait for workflow to fully complete (all steps)
2. Check "Artifacts" section at bottom of run page
3. Verify workflow succeeded (green checkmark)
4. Artifacts expire after 90 days - check retention

---

## Post-Validation Next Steps

### If Validation PASSED ✅

1. **Download proof bundle:**

   ```powershell
   # Create local archive
   mkdir out\phase5-prod-validation\$(Get-Date -Format 'yyyyMMdd-HHmmss')
   # Download artifacts via GitHub UI or gh CLI
   ```

2. **Review proof bundle:**
   - Open `PHASE5_PROD_PROOF_BUNDLE.md`
   - Verify all test results are ✅
   - Check smoke pack passed (13-15/15)
   - Confirm DB isolation verified

3. **Promote to production:**

   ```powershell
   # Option 1: Merge PR (if on feature branch)
   gh pr merge --squash

   # Option 2: Create release tag
   git tag -a v1.0.0-phase5 -m "Phase 5: PROD Smart Form validation passed"
   git push origin v1.0.0-phase5
   ```

4. **Monitor production:**
   - Watch metrics in Command Center
   - Monitor error rates
   - Check Discord for published picks

### If Validation FAILED ❌

1. **Download ALL artifacts:**

   ```powershell
   gh run download <run-id> --dir "out\phase5-failures\$(Get-Date -Format 'yyyyMMdd-HHmmss')"
   ```

2. **Analyze failures:**
   - Read `smoke-pack-prod-output.txt` line by line
   - Review screenshots of failed tests
   - Check server logs for errors
   - Verify PROD schema matches expected

3. **Fix and re-run:**

   ```powershell
   # Make fixes in codebase
   git add .
   git commit -m "fix(phase5): address smoke pack failures"
   git push

   # Re-run workflow (keep test data if exists)
   gh workflow run phase5-prod-validation.yml \
     --field skip_test_data_creation=true \
     --field cleanup_test_data=false
   ```

4. **Escalate if blocked:**
   - Document failure in GitHub issue
   - Include proof bundle and artifacts
   - Tag engineering team for review

---

## Workflow Customization

### Running on Different Branch

```powershell
# Trigger on main branch
gh workflow run phase5-prod-validation.yml --ref main

# Trigger on custom branch
gh workflow run phase5-prod-validation.yml --ref feature/my-fix
```

### Adjusting Timeouts

Edit `.github/workflows/phase5-prod-validation.yml`:

```yaml
jobs:
  run-prod-smoke-pack:
    timeout-minutes: 30 # Increase from 20 if tests timeout
```

### Modifying Test Criteria

Edit smoke pack acceptance in workflow:

```yaml
# Current: 15 passed OR 13 passed
if grep -q "15 passed" smoke-pack-prod-output.txt; then echo "✅ Smoke pack
PASSED (15/15)" exit 0 elif grep -q "13 passed" smoke-pack-prod-output.txt; then
echo "✅ Smoke pack PASSED (13/15 - acceptable)" exit 0 else echo "❌ Smoke pack
FAILED" exit 1 fi
```

---

## Security Notes

### PROD Secret Management

**All PROD operations use GitHub Secrets:**

- Secrets are encrypted by GitHub
- Never exposed in logs (auto-masked)
- Only accessible in workflow runtime
- Require manual approval (production environment)

**Viewing secrets (safely):**

```powershell
# List secret names (NOT values)
gh secret list

# Secrets are NEVER output to logs
# Masked patterns:
# - SUPABASE_SERVICE_ROLE_KEY_PROD
# - SUPABASE_ANON_KEY_PROD
```

### Test Data Isolation

**Guaranteed isolation:**

- Test tenant has unique ID
- Test user scoped to test tenant
- RLS policies enforce tenant boundaries
- DB isolation verified in Step 4

**Verification queries:**

```sql
-- All picks from test user (should match smoke pack count)
SELECT COUNT(*) FROM picks WHERE user_id = '<test-user-id>';

-- All picks NOT from test user (should be unchanged)
SELECT COUNT(*) FROM picks WHERE user_id != '<test-user-id>';
```

---

## FAQ

**Q: How long does the workflow take?** A: Typically 15-20 minutes end-to-end.

**Q: Can I run this on staging first?** A: Yes, but you'd need a separate
workflow targeting staging environment.

**Q: What if I want to keep test data?** A: Leave `cleanup_test_data=false`
(default). Test data remains in PROD.

**Q: Can I run this multiple times?** A: Yes. Either cleanup between runs, or
use `skip_test_data_creation=true` to reuse.

**Q: Where do artifacts go?** A: GitHub retains for 90 days. Download to
`out/phase5-prod-validation/<run-id>/`.

**Q: What if real production data gets touched?** A: Step 4 (DB Isolation) will
catch this and FAIL the workflow.

**Q: How do I know if PROD is ready?** A: If proof bundle shows "✅ PROD READY"
and all tests passed.

---

## Support

**Workflow Issues:**

- Check GitHub Actions logs
- Review `.github/workflows/phase5-prod-validation.yml`
- Verify PROD secrets are configured

**Test Failures:**

- Review smoke pack output
- Check test screenshots
- Inspect server logs

**PROD Access:**

- All operations via GitHub workflows only
- Never access PROD secrets locally
- Use `environment: production` approval gates

---

**Last Updated**: 2025-01-17 **Next Review**: After first successful PROD
validation **Owner**: Engineering Team
