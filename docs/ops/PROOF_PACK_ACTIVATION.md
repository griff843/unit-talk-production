# Supabase Automation - Runtime Proof Pack

**Date:** 2025-12-28
**Status:** ⚠️ AWAITING EXECUTION - User must run commands to generate proof
**Purpose:** Demonstrate end-to-end CI/CD automation and safe SQL querying with real runtime evidence

---

## ⚠️ IMPORTANT: This is a Template

**You must execute these commands yourself** to generate runtime proof. I (Claude) cannot:
- Trigger GitHub Actions (no GitHub authentication)
- Execute queries against live Supabase (no credentials)
- Access your workflow run URLs

**Follow the steps below and fill in the placeholders with actual outputs.**

---

## Prerequisites Checklist

Before starting, verify:

- [ ] GitHub Secrets configured in **Settings → Secrets and variables → Actions**:
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_PROJECT_REF_DEV`
  - `SUPABASE_URL_DEV`
  - `SUPABASE_SERVICE_ROLE_KEY_DEV`

- [ ] Local environment variables in `.env`:
  - `SUPABASE_PROJECT_REF`
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_READONLY_DATABASE_URL_DEV`

- [ ] Supabase CLI installed:
  ```powershell
  supabase --version
  # Expected: supabase version 1.x.x
  ```

- [ ] Node.js and npm installed:
  ```powershell
  node --version  # Expected: v18.x.x or v20.x.x
  npm --version   # Expected: 8.x.x or higher
  ```

---

## PHASE 1: GitHub Actions Workflow - Dry Run

### Step 1.1: Trigger Workflow (Dry Run)

**Via GitHub Web UI:**

1. Navigate to: `https://github.com/[YOUR_ORG]/unit-talk-production/actions`
2. Click on workflow: **"Supabase Migrations CI/CD"**
3. Click **"Run workflow"** button (top right)
4. Configure inputs:
   - **Use workflow from:** `main`
   - **Target environment:** `dev`
   - **Dry run (plan only, no apply):** ✅ **true**
5. Click **"Run workflow"**

### Step 1.2: Capture Workflow Run URL

**Once workflow starts, copy the run URL:**

```
WORKFLOW RUN URL (DRY RUN): [PASTE URL HERE]
Example: https://github.com/[YOUR_ORG]/unit-talk-production/actions/runs/123456789
```

### Step 1.3: Wait for Completion and Capture Logs

**Navigate to the workflow run and expand each job. Capture these excerpts:**

#### Job: `migration-plan`

**Expected output to capture:**

```yaml
# ==============================================================================
# [PASTE LOG EXCERPT: migration-plan job]
# ==============================================================================

✅ Check for pending migrations
  Found X migration files
  has_migrations=true
  count=X

✅ Display migration plan
  ==================================
  MIGRATION PLAN
  ==================================

  Environment: dev
  Dry Run: true

  Migrations to apply:
  [LIST OF MIGRATION FILES]

  Total: X migrations

# ==============================================================================
```

#### Job: `dry-run`

**Expected output to capture:**

```yaml
# ==============================================================================
# [PASTE LOG EXCERPT: dry-run job]
# ==============================================================================

✅ Display dry run plan
  ==================================
  DRY RUN MODE - NO CHANGES APPLIED
  ==================================

  Target: dev

  Migrations that WOULD be applied:

  [MIGRATION FILE PREVIEWS]

  ==================================
  DRY RUN COMPLETE - NO CHANGES MADE
  ==================================

# ==============================================================================
```

### Step 1.4: Verification Checklist (Dry Run)

- [ ] Workflow completed successfully (green checkmark)
- [ ] Auth success (Supabase CLI logged in)
- [ ] Migration plan displayed (no errors)
- [ ] Dry run mode confirmed (no actual changes applied)
- [ ] No secrets exposed in logs

---

## PHASE 2: GitHub Actions Workflow - Real Run

### Step 2.1: Trigger Workflow (Real Apply)

**⚠️ WARNING: This will apply migrations to DEV Supabase project**

**Via GitHub Web UI:**

1. Navigate to: `https://github.com/[YOUR_ORG]/unit-talk-production/actions`
2. Click on workflow: **"Supabase Migrations CI/CD"**
3. Click **"Run workflow"** button
4. Configure inputs:
   - **Use workflow from:** `main`
   - **Target environment:** `dev`
   - **Dry run (plan only, no apply):** ❌ **false**
5. Click **"Run workflow"**

### Step 2.2: Capture Workflow Run URL

```
WORKFLOW RUN URL (REAL RUN): [PASTE URL HERE]
Example: https://github.com/[YOUR_ORG]/unit-talk-production/actions/runs/123456790
```

### Step 2.3: Wait for Completion and Capture Logs

#### Job: `migrate-dev`

**Expected output to capture:**

```yaml
# ==============================================================================
# [PASTE LOG EXCERPT: migrate-dev job - Setup Supabase CLI]
# ==============================================================================

✅ Setup Supabase CLI
  supabase --version
  supabase version 1.142.2

✅ Link to dev project
  Linking to dev project...
  supabase link --project-ref abcd****
  Link successful

# ==============================================================================
```

```yaml
# ==============================================================================
# [PASTE LOG EXCERPT: migrate-dev job - Apply Migrations]
# ==============================================================================

✅ Apply migrations with retry
  Applying migrations to dev...
  Attempt 1/3...
  supabase db push --include-all

  [SUPABASE CLI OUTPUT]

  ✅ Migrations applied successfully

# ==============================================================================
```

```yaml
# ==============================================================================
# [PASTE LOG EXCERPT: migrate-dev job - Verify Schema]
# ==============================================================================

✅ Verify schema
  npm ci --workspace=apps/api
  npx tsx scripts/ops/verify-schema-post-migration.ts --env dev

  ========================================
  SCHEMA VERIFICATION - DEV
  ========================================

  Checking canonical tables...

  ✅ picks (X rows)
  ✅ pick_publish (X rows)
  ✅ users (X rows)
  ✅ tenants (X rows)
  ✅ props (X rows)
  ✅ games (X rows)
  ✅ teams (X rows)
  ✅ players (X rows)

  Checking views...

  ✅ vw_recent_picks (X rows)

  ========================================
  VERIFICATION SUMMARY
  ========================================

  Total checks: 9
  Passed: 9
  Failed: 0
  Required tables: 8/8

  ✅ SCHEMA VERIFICATION PASSED

# ==============================================================================
```

```yaml
# ==============================================================================
# [PASTE LOG EXCERPT: migrate-dev job - PostgREST Reload]
# ==============================================================================

✅ Reload PostgREST schema
  Reloading PostgREST schema cache...

  curl -X POST "$SUPABASE_URL/rest/v1/rpc/reload_schema" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

  [RESPONSE]

  Schema reload complete

# ==============================================================================
```

```yaml
# ==============================================================================
# [PASTE LOG EXCERPT: migrate-dev job - Smoke Tests]
# ==============================================================================

✅ Run smoke tests
  npx tsx scripts/ops/smoke-test-db.ts --env dev

  ========================================
  SMOKE TESTS - DEV
  ========================================

  Database connectivity... ✅ (123ms)
  Count picks table... ✅ (234ms)
  Count pick_publish table... ✅ (156ms)
  Query users table... ✅ (189ms)

  ========================================
  SMOKE TEST SUMMARY
  ========================================

  Total tests: 4
  Passed: 4
  Failed: 0
  Average duration: 175.50ms

  ✅ ALL SMOKE TESTS PASSED

# ==============================================================================
```

### Step 2.4: Verification Checklist (Real Run)

- [ ] Workflow completed successfully (green checkmark)
- [ ] Supabase CLI linked to project
- [ ] Migrations applied successfully
- [ ] Schema verification passed (all 8 tables exist)
- [ ] PostgREST schema reloaded
- [ ] Smoke tests passed
- [ ] No errors in logs

---

## PHASE 3: Safe SQL Query Runner - Runtime Proof

### Step 3.1: Verify Environment Variables

**Run in PowerShell:**

```powershell
# Check environment variable is set
$env:SUPABASE_READONLY_DATABASE_URL_DEV
# Expected: postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**If not set, load from .env:**

```powershell
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}
```

### Step 3.2: Verify autopilot_decisions Table Exists

**Run this command and capture output:**

```powershell
npx tsx scripts\ops\supabase-query.ts --env dev "SELECT to_regclass('public.autopilot_decisions') as table_exists"
```

**Expected output to paste:**

```
# ==============================================================================
# [PASTE OUTPUT: autopilot_decisions existence check]
# ==============================================================================

========================================
SAFE SUPABASE QUERY RUNNER
========================================
Environment: DEV
Mode: READ-ONLY
Output: table
----------------------------------------

✅ SQL validation passed

Executing query...

✅ Query successful

========================================
RESULTS
========================================

table_exists
-----------------
autopilot_decisions

(1 rows)

Duration: XXXms

# ==============================================================================
```

### Step 3.3: Count Rows in autopilot_decisions

**Run this command and capture output:**

```powershell
npx tsx scripts\ops\supabase-query.ts --env dev "SELECT COUNT(*) as row_count FROM public.autopilot_decisions"
```

**Expected output to paste:**

```
# ==============================================================================
# [PASTE OUTPUT: autopilot_decisions row count]
# ==============================================================================

========================================
SAFE SUPABASE QUERY RUNNER
========================================
Environment: DEV
Mode: READ-ONLY
Output: table
----------------------------------------

✅ SQL validation passed

Executing query...

✅ Query successful

========================================
RESULTS
========================================

row_count
---------
0

(1 rows)

Duration: XXXms

# ==============================================================================
# NOTE: 0 rows is expected for fresh deployment - no autopilot decisions logged yet
```

### Step 3.4: Verify alert_events Table (If Phase 3 Uses It)

**Run this command and capture output:**

```powershell
npx tsx scripts\ops\supabase-query.ts --env dev "SELECT to_regclass('public.alert_events') as table_exists"
```

**Expected output to paste:**

```
# ==============================================================================
# [PASTE OUTPUT: alert_events existence check]
# ==============================================================================

========================================
SAFE SUPABASE QUERY RUNNER
========================================
Environment: DEV
Mode: READ-ONLY
Output: table
----------------------------------------

✅ SQL validation passed

Executing query...

✅ Query successful

========================================
RESULTS
========================================

table_exists
------------
alert_events

(1 rows)

Duration: XXXms

# ==============================================================================
```

### Step 3.5: Verify Table Structure

**Run this command and capture output:**

```powershell
npx tsx scripts\ops\supabase-query.ts --env dev @"
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'autopilot_decisions'
ORDER BY ordinal_position
LIMIT 10
"@
```

**Expected output to paste:**

```
# ==============================================================================
# [PASTE OUTPUT: autopilot_decisions table structure]
# ==============================================================================

========================================
SAFE SUPABASE QUERY RUNNER
========================================
Environment: DEV
Mode: READ-ONLY
Output: table
----------------------------------------

✅ SQL validation passed

Executing query...

✅ Query successful

========================================
RESULTS
========================================

column_name        | data_type         | is_nullable
-------------------|-------------------|------------
id                 | uuid              | NO
mode               | text              | NO
evaluation_run_id  | uuid              | NO
evaluated_at       | timestamp         | YES
pick_id            | uuid              | YES
pick_data          | jsonb             | NO
decision           | text              | NO
decision_reason    | text              | NO
risk_score         | numeric           | YES
risk_factors       | jsonb             | YES

(10 rows)

Duration: XXXms

# ==============================================================================
```

### Step 3.6: Test Helper Functions

**Run this command and capture output:**

```powershell
npx tsx scripts\ops\supabase-query.ts --env dev "SELECT * FROM get_daily_autopilot_report()"
```

**Expected output to paste:**

```
# ==============================================================================
# [PASTE OUTPUT: get_daily_autopilot_report() function test]
# ==============================================================================

========================================
SAFE SUPABASE QUERY RUNNER
========================================
Environment: DEV
Mode: READ-ONLY
Output: table
----------------------------------------

✅ SQL validation passed

Executing query...

✅ Query successful

========================================
RESULTS
========================================

total_evaluated | approved_count | rejected_count | unknown_count | would_publish_count | avg_risk_score | stale_count | rejection_reasons | avg_execution_time_ms
----------------|----------------|----------------|---------------|---------------------|----------------|-------------|-------------------|----------------------
0               | 0              | 0              | 0             | 0                   | NULL           | 0           | NULL              | NULL

(1 rows)

Duration: XXXms

# ==============================================================================
# NOTE: All zeros is expected for fresh deployment - no decisions logged yet
```

---

## PHASE 4: Security Test - Verify Blocked Queries

### Step 4.1: Test DROP TABLE (Should Be Blocked)

**Run this command and capture output:**

```powershell
npx tsx scripts\ops\supabase-query.ts --env dev "DROP TABLE picks"
```

**Expected output to paste:**

```
# ==============================================================================
# [PASTE OUTPUT: DROP TABLE blocked test]
# ==============================================================================

========================================
SAFE SUPABASE QUERY RUNNER
========================================
Environment: DEV
Mode: READ-ONLY
Output: table
----------------------------------------

❌ SQL Validation Failed: Blocked pattern detected: /DROP\s+(TABLE|DATABASE|SCHEMA|INDEX|VIEW|FUNCTION|TRIGGER)/i

# ==============================================================================
# ✅ PASS: Query correctly blocked
```

### Step 4.2: Test DELETE Without WHERE (Should Be Blocked)

**Run this command and capture output:**

```powershell
npx tsx scripts\ops\supabase-query.ts --env dev "DELETE FROM picks"
```

**Expected output to paste:**

```
# ==============================================================================
# [PASTE OUTPUT: DELETE without WHERE blocked test]
# ==============================================================================

========================================
SAFE SUPABASE QUERY RUNNER
========================================
Environment: DEV
Mode: READ-ONLY
Output: table
----------------------------------------

❌ SQL Validation Failed: Blocked pattern detected: /DELETE.*(?!WHERE)/i

# ==============================================================================
# ✅ PASS: Query correctly blocked
```

### Step 4.3: Test pg_read_file (Should Be Blocked)

**Run this command and capture output:**

```powershell
npx tsx scripts\ops\supabase-query.ts --env dev "SELECT pg_read_file('/etc/passwd')"
```

**Expected output to paste:**

```
# ==============================================================================
# [PASTE OUTPUT: pg_read_file blocked test]
# ==============================================================================

========================================
SAFE SUPABASE QUERY RUNNER
========================================
Environment: DEV
Mode: READ-ONLY
Output: table
----------------------------------------

❌ SQL Validation Failed: Dangerous function blocked: pg_read_file

# ==============================================================================
# ✅ PASS: Dangerous function correctly blocked
```

---

## PHASE 5: Credential Redaction Test

### Step 5.1: Test Token Redaction

**Run this command and capture output:**

```powershell
npx tsx scripts\ops\supabase-query.ts --env dev "SELECT 'sbp_abc123def456' as token, 'postgresql://user:password@host/db' as url"
```

**Expected output to paste:**

```
# ==============================================================================
# [PASTE OUTPUT: credential redaction test]
# ==============================================================================

========================================
SAFE SUPABASE QUERY RUNNER
========================================
Environment: DEV
Mode: READ-ONLY
Output: table
----------------------------------------

✅ SQL validation passed

Executing query...

✅ Query successful

========================================
RESULTS
========================================

token      | url
-----------|---------------------------
sbp_****   | postgresql://****:****@host/db

(1 rows)

Duration: XXXms

# ==============================================================================
# ✅ PASS: Credentials correctly redacted in output
```

---

## PHASE 6: PowerShell Helper Scripts Verification

### Step 6.1: Test-SupabaseMigrations.ps1 Dry Run

**Run this command and capture output:**

```powershell
.\scripts\ops\Test-SupabaseMigrations.ps1 -DryRun
```

**Expected output to paste:**

```
# ==============================================================================
# [PASTE OUTPUT: Test-SupabaseMigrations.ps1 -DryRun]
# ==============================================================================

========================================
SUPABASE MIGRATION TEST
========================================
Environment: dev
Dry Run: True

✅ Supabase CLI installed: supabase version 1.142.2
Project Ref: abcd****
Access Token: sbp_****

Linking to Supabase project...
✅ Linked successfully

Found 41 migration files

Migration files:
  - 20241227_phase4_autopilot_decisions.sql
  [... more files ...]

========================================
DRY RUN MODE - NO CHANGES WILL BE APPLIED
========================================

To apply migrations, run without -DryRun flag

# ==============================================================================
```

### Step 6.2: Verify-SupabaseSchema.ps1

**Run this command and capture output:**

```powershell
.\scripts\ops\Verify-SupabaseSchema.ps1 -Environment dev
```

**Expected output to paste:**

```
# ==============================================================================
# [PASTE OUTPUT: Verify-SupabaseSchema.ps1]
# ==============================================================================

========================================
SUPABASE SCHEMA VERIFICATION
========================================
Environment: dev

✅ Node.js installed: v20.11.0
✅ TypeScript execution ready

Running schema verification script...

Checking canonical tables...

✅ picks (X rows)
✅ pick_publish (X rows)
✅ users (X rows)
✅ tenants (X rows)
✅ props (X rows)
✅ games (X rows)
✅ teams (X rows)
✅ players (X rows)

Checking views...

✅ vw_recent_picks (X rows)

========================================
VERIFICATION SUMMARY
========================================

Total checks: 9
Passed: 9
Failed: 0
Required tables: 8/8

✅ SCHEMA VERIFICATION PASSED

========================================
VERIFICATION COMPLETE
========================================

# ==============================================================================
```

### Step 6.3: Verify-AutopilotDecisions.ps1

**Run this command and capture output:**

```powershell
.\scripts\ops\Verify-AutopilotDecisions.ps1 -Environment dev
```

**Expected output to paste:**

```
# ==============================================================================
# [PASTE OUTPUT: Verify-AutopilotDecisions.ps1]
# ==============================================================================

========================================
AUTOPILOT_DECISIONS TABLE VERIFICATION
========================================
Environment: dev

[1/5] Checking if table exists...
✅ Table exists

[2/5] Checking table structure...
[TABLE STRUCTURE OUTPUT]
✅ Table structure verified

[3/5] Checking indexes...
[INDEXES OUTPUT]
✅ Indexes verified

[4/5] Checking RLS policies...
[RLS POLICIES OUTPUT]
✅ RLS policies verified

[5/5] Checking helper functions...
[HELPER FUNCTIONS OUTPUT]
✅ Helper functions verified

========================================
VERIFICATION COMPLETE
========================================

✅ autopilot_decisions table is fully functional

Test the helper functions:
  SELECT * FROM get_daily_autopilot_report();
  SELECT * FROM get_autopilot_timeline(24);

# ==============================================================================
```

---

## Exact Commands to Run (Windows PowerShell)

### Setup (One-Time)

```powershell
# 1. Clone repo (if not already done)
cd C:\Users\griff\OneDrive\Desktop
git clone https://github.com/[YOUR_ORG]/unit-talk-production.git
cd unit-talk-production

# 2. Install Supabase CLI
npm install -g supabase

# 3. Configure environment
Copy-Item .env.example .env
# Edit .env with your actual values

# 4. Load environment variables
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}

# 5. Install dependencies
npm ci
```

### Phase 1: GitHub Actions Dry Run

```powershell
# Trigger via GitHub UI (no PowerShell command)
# Go to: https://github.com/[YOUR_ORG]/unit-talk-production/actions
# Click: "Supabase Migrations CI/CD" → "Run workflow"
# Select: environment=dev, dry_run=true

# After workflow completes, copy the run URL and paste it in this document
```

### Phase 2: GitHub Actions Real Run

```powershell
# Trigger via GitHub UI (no PowerShell command)
# Go to: https://github.com/[YOUR_ORG]/unit-talk-production/actions
# Click: "Supabase Migrations CI/CD" → "Run workflow"
# Select: environment=dev, dry_run=false

# After workflow completes, copy the run URL and paste it in this document
```

### Phase 3: Safe SQL Queries

```powershell
# Verify autopilot_decisions exists
npx tsx scripts\ops\supabase-query.ts --env dev "SELECT to_regclass('public.autopilot_decisions') as table_exists"

# Count rows
npx tsx scripts\ops\supabase-query.ts --env dev "SELECT COUNT(*) as row_count FROM public.autopilot_decisions"

# Verify alert_events exists
npx tsx scripts\ops\supabase-query.ts --env dev "SELECT to_regclass('public.alert_events') as table_exists"

# Check table structure
npx tsx scripts\ops\supabase-query.ts --env dev "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'autopilot_decisions' ORDER BY ordinal_position LIMIT 10"

# Test helper function
npx tsx scripts\ops\supabase-query.ts --env dev "SELECT * FROM get_daily_autopilot_report()"
```

### Phase 4: Security Tests

```powershell
# Test blocked queries
npx tsx scripts\ops\supabase-query.ts --env dev "DROP TABLE picks"
npx tsx scripts\ops\supabase-query.ts --env dev "DELETE FROM picks"
npx tsx scripts\ops\supabase-query.ts --env dev "SELECT pg_read_file('/etc/passwd')"
```

### Phase 5: Credential Redaction

```powershell
# Test redaction
npx tsx scripts\ops\supabase-query.ts --env dev "SELECT 'sbp_abc123def456' as token, 'postgresql://user:password@host/db' as url"
```

### Phase 6: PowerShell Scripts

```powershell
# Test migration script
.\scripts\ops\Test-SupabaseMigrations.ps1 -DryRun

# Verify schema
.\scripts\ops\Verify-SupabaseSchema.ps1 -Environment dev

# Verify autopilot_decisions
.\scripts\ops\Verify-AutopilotDecisions.ps1 -Environment dev

# Test safe query
.\scripts\ops\Test-SafeQuery.ps1 -Query "SELECT COUNT(*) FROM picks"
```

---

## Summary Checklist

**After completing all phases, verify:**

- [ ] GitHub Actions workflow executed successfully (both dry run and real run)
- [ ] Workflow run URLs captured and pasted above
- [ ] All log excerpts captured and pasted above
- [ ] autopilot_decisions table exists in Supabase DEV
- [ ] Helper functions work (`get_daily_autopilot_report()`, `get_autopilot_timeline()`)
- [ ] Safe query runner blocks dangerous queries (DROP, DELETE without WHERE, pg_read_file)
- [ ] Credential redaction works (sbp_****, postgresql://****:****@)
- [ ] PowerShell scripts execute successfully
- [ ] All outputs redacted (no exposed secrets)

**Status:** [INCOMPLETE - AWAITING USER EXECUTION]

---

## Next Steps

1. **Execute all commands** in the order listed above
2. **Capture actual outputs** and paste them in the designated sections
3. **Save workflow run URLs** from GitHub Actions
4. **Review captured outputs** to ensure no secrets are exposed
5. **Mark checklist items** as complete
6. **Update status** at top of document to "COMPLETE"

**Once complete, this document will serve as definitive proof that:**
- ✅ CI/CD migrations are fully automated
- ✅ Safe SQL querying is operational with security controls
- ✅ autopilot_decisions table is deployed and functional
- ✅ No manual Supabase SQL Editor steps required
