# Unit Talk CI/CD Automation Runbook

**Last Updated:** 2025-12-28
**Owner:** Platform Engineering
**Status:** ✅ Production Ready

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Required Secrets](#required-secrets)
3. [Local Diagnostic Tool](#local-diagnostic-tool)
4. [CI Operations Workflows](#ci-operations-workflows)
5. [Common Operations](#common-operations)
6. [Troubleshooting](#troubleshooting)
7. [Emergency Procedures](#emergency-procedures)

---

## Overview

This runbook provides step-by-step instructions for using the Unit Talk automated CI/CD infrastructure. All operations are automated through GitHub Actions workflows, eliminating manual Supabase SQL Editor steps.

**Key Principles:**
- ✅ **CI is the single execution plane** - All ops run through GitHub Actions
- ✅ **No manual SQL Editor steps** - Migrations applied automatically via CLI
- ✅ **Safe by default** - Read-only queries, dry-run previews, approval gates
- ✅ **Fail closed** - Non-zero exit codes on any issue, strong secret masking

**Infrastructure Components:**
- `.github/workflows/ops-run.yml` - Unified ops dispatch workflow
- `.github/workflows/supabase-migrate.yml` - Automatic migrations on main merge
- `.github/workflows/playwright-proof-pack.yml` - E2E testing with proof artifacts
- `scripts/doctor.ps1` - Local health check diagnostic tool
- `scripts/ops/supabase-query.ts` - Safe SQL query runner

---

## Required Secrets

### GitHub Repository Secrets

Navigate to: `Settings` → `Secrets and variables` → `Actions` → `New repository secret`

#### All Environments

| Secret Name | Description | Where to Get | Example Format |
|-------------|-------------|--------------|----------------|
| `SUPABASE_ACCESS_TOKEN` | CLI authentication token | [Supabase Account Tokens](https://supabase.com/dashboard/account/tokens) | `sbp_abc123...` |

#### Dev Environment

| Secret Name | Description | Example Format |
|-------------|-------------|----------------|
| `SUPABASE_PROJECT_REF_DEV` | Dev project reference ID | `abcdefghijklmnop` |
| `SUPABASE_URL_DEV` | Dev project URL | `https://abcdefghijklmnop.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY_DEV` | Dev service role key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `DATABASE_DIRECT_URL_DEV` | Direct Postgres connection (optional) | `postgresql://postgres.[ref]:[password]@...` |

#### Staging Environment

| Secret Name | Description |
|-------------|-------------|
| `SUPABASE_PROJECT_REF_STAGING` | Staging project reference ID |
| `SUPABASE_URL_STAGING` | Staging project URL |
| `SUPABASE_SERVICE_ROLE_KEY_STAGING` | Staging service role key |
| `DATABASE_DIRECT_URL_STAGING` | Direct Postgres connection (optional) |
| `COMMAND_CENTER_URL_STAGING` | Command Center URL for staging |

#### Production Environment

| Secret Name | Description |
|-------------|-------------|
| `SUPABASE_PROJECT_REF_PROD` | Production project reference ID |
| `SUPABASE_URL_PROD` | Production project URL |
| `SUPABASE_SERVICE_ROLE_KEY_PROD` | Production service role key |
| `DATABASE_DIRECT_URL_PROD` | Direct Postgres connection (optional) |
| `COMMAND_CENTER_URL_PROD` | Command Center URL for production |

#### Optional (Notifications)

| Secret Name | Description | Where to Get |
|-------------|-------------|--------------|
| `DISCORD_RELEASE_WEBHOOK` | Discord webhook for notifications | Discord Server Settings → Integrations → Webhooks |

### How to Get Supabase Secrets

1. **Access Token:**
   - Go to [Supabase Account Tokens](https://supabase.com/dashboard/account/tokens)
   - Click "Generate new token"
   - Name it "GitHub Actions CI"
   - Copy the `sbp_...` token

2. **Project Reference:**
   - Open your Supabase project
   - Go to Settings → General
   - Copy "Reference ID"

3. **Service Role Key:**
   - Go to Settings → API
   - Copy "service_role" key (under "Project API keys")
   - ⚠️ **WARNING:** This is a secret key with full database access

4. **Direct Database URL:**
   - Go to Settings → Database
   - Copy "Connection string" → "URI" format
   - Replace `[YOUR-PASSWORD]` with your database password

---

## Local Diagnostic Tool

### doctor.ps1 - Unified Health Check

**Purpose:** Verify all infrastructure components are healthy before/after changes

**Location:** `scripts/doctor.ps1`

#### Usage

```powershell
# Basic health check (dev environment)
.\scripts\doctor.ps1

# Check staging environment
.\scripts\doctor.ps1 -Environment staging

# Check with verbose output
.\scripts\doctor.ps1 -Verbose

# Generate JSON report
.\scripts\doctor.ps1 -OutputFormat json > health-report.json
```

#### What It Checks

1. **Local PostgreSQL Connectivity**
   - Docker status
   - PostgreSQL container running
   - Database connection test
   - Port 5432 accessibility

2. **Supabase Connectivity**
   - Environment variables set
   - Supabase API accessible
   - Read-only database connection
   - Core tables exist (picks, pick_publish, users, raw_props, agent_health, events)

3. **Command Center API Health**
   - `/api/health` endpoint responds
   - `/api/slo/status` shows no violations
   - `/api/autopilot/report` returns data

4. **Autopilot Infrastructure**
   - `autopilot_decisions` table exists (via `to_regclass`)
   - Table has records

5. **Node.js and Dependencies**
   - Node.js version
   - npm version
   - node_modules installed
   - Supabase CLI available

6. **Critical Files**
   - `.env` file exists
   - `supabase/config.toml` exists
   - Safe query runner exists
   - CI workflows exist

#### Output Example

```
========================================
UNIT TALK PRODUCTION HEALTH CHECK
========================================
Environment: dev
Date: 2025-12-28 14:30:00
========================================

1. Local PostgreSQL Connectivity
================================================================================
✅ Docker Status - Docker is running
✅ PostgreSQL Container - Container 'postgres' is running
✅ PostgreSQL Connection - Successfully connected to local database
✅ PostgreSQL Port - Port 5432 is accessible

2. Supabase Connectivity (dev)
================================================================================
✅ SUPABASE_URL_DEV - Environment variable set
✅ SUPABASE_SERVICE_ROLE_KEY_DEV - Environment variable set
✅ Supabase API - API is accessible
✅ Read-Only DB Connection - Successfully executed test query
✅ Core Tables - All 6 core tables exist

3. Command Center API Health
================================================================================
✅ Command Center URL - URL configured
✅ /api/health - Command Center is healthy
✅ /api/slo/status - No SLO violations
✅ /api/autopilot/report - Autopilot report available

4. Autopilot Infrastructure
================================================================================
✅ autopilot_decisions table - Table exists
✅ autopilot_decisions records - Table has 42 record(s)

5. Node.js and Dependencies
================================================================================
✅ Node.js - Version v20.10.0 installed
✅ npm - Version 10.2.3 installed
✅ node_modules - Dependencies installed
✅ Supabase CLI - Version 1.127.0 installed

6. Critical Files
================================================================================
✅ .env file - File exists
✅ Supabase config - File exists
✅ Safe query runner - File exists
✅ Schema verifier - File exists
✅ Migration CI workflow - File exists
✅ Ops runner workflow - File exists
✅ Playwright config - File exists

========================================
SUMMARY
========================================
Total Checks: 28
Passed: 28
Warnings: 0
Failed: 0
========================================

✅ SYSTEM HEALTH: PASS (100% checks passed)
```

#### Exit Codes

- `0` - All checks passed (or only warnings)
- `1` - One or more critical failures

---

## CI Operations Workflows

### 1. ops-run.yml - Unified Operations Dispatch

**Purpose:** Single workflow for all operational tasks (migrations, queries, autopilot, proof packs)

**Location:** `.github/workflows/ops-run.yml`

**Trigger:** Manual dispatch only

#### How to Dispatch

1. Go to: `Actions` → `Ops Runner - Unified Operations Dispatch` → `Run workflow`
2. Select:
   - **Environment:** `dev`, `staging`, or `prod`
   - **Action:** `migrate`, `verify_schema`, `safe_query`, `autopilot_run`, or `proof_pack`
   - **Dry run:** `true` for preview, `false` for execution
   - **SQL:** (only for `safe_query` action)

#### Actions

##### Action: `migrate`

Applies database migrations from `supabase/migrations/` folder.

**Example: Dev Dry Run**
```
Environment: dev
Action: migrate
Dry run: true
SQL: (leave empty)
```

**Example: Apply to Staging**
```
Environment: staging
Action: migrate
Dry run: false
SQL: (leave empty)
```

**What It Does:**
1. Links to Supabase project via CLI
2. Shows migration plan (which .sql files will be applied)
3. Applies migrations (if not dry run)
4. Verifies schema post-migration
5. Uploads artifacts

**Approvals:**
- **Dev:** No approval required
- **Staging:** Requires approval in GitHub environment settings
- **Prod:** Requires approval in GitHub environment settings

##### Action: `verify_schema`

Verifies database schema without making changes.

**Example:**
```
Environment: dev
Action: verify_schema
Dry run: false
SQL: (leave empty)
```

**What It Does:**
1. Runs `scripts/ops/verify-schema-post-migration.ts`
2. Checks `autopilot_decisions` table exists
3. Fails if schema is invalid

##### Action: `safe_query`

Executes read-only SQL queries.

**Example: Count Picks**
```
Environment: dev
Action: safe_query
Dry run: false
SQL: SELECT COUNT(*) FROM picks
```

**Example: Recent Autopilot Decisions**
```
Environment: dev
Action: safe_query
Dry run: false
SQL: SELECT * FROM autopilot_decisions ORDER BY created_at DESC LIMIT 10
```

**Safety Features:**
- ✅ Must start with `SELECT`, `EXPLAIN`, `SHOW`, `WITH`, or `DESCRIBE`
- ❌ Blocks `DROP`, `TRUNCATE`, `DELETE`, `UPDATE`, `INSERT`, etc.
- ✅ Results uploaded as artifacts

**Example Queries:**

```sql
-- Count picks by status
SELECT workflow_stage, COUNT(*) as count
FROM picks
GROUP BY workflow_stage
ORDER BY count DESC

-- Recent autopilot decisions
SELECT evaluation_run_id, decision, risk_score, created_at
FROM autopilot_decisions
ORDER BY created_at DESC
LIMIT 20

-- Agent health summary
SELECT agent_name, status, COUNT(*) as count
FROM agent_health
GROUP BY agent_name, status
```

##### Action: `autopilot_run`

Runs autopilot evaluation against Command Center API.

**Example: Log-Only Mode (Dry Run)**
```
Environment: dev
Action: autopilot_run
Dry run: true
SQL: (leave empty)
```

**Example: Enabled Mode (Actually Publish)**
```
Environment: dev
Action: autopilot_run
Dry run: false
SQL: (leave empty)
```

**What It Does:**
1. Checks Command Center availability
2. Calls `/api/autopilot/run` with mode (`log_only` or `enabled`)
3. Uploads results JSON as artifact

##### Action: `proof_pack`

Runs Playwright E2E tests and generates proof pack with screenshots.

**Example:**
```
Environment: dev
Action: proof_pack
Dry run: false
SQL: (leave empty)
```

**What It Does:**
1. Starts Command Center dev server
2. Runs Playwright tests
3. Uploads screenshots
4. Uploads HTML report
5. Generates summary

**Artifacts:**
- `playwright-screenshots-<run-number>/` - All screenshots
- `playwright-report-<run-number>/` - HTML test report
- `proof-pack-summary-<run-number>/` - Markdown summary

---

### 2. supabase-migrate.yml - Automatic Migrations

**Purpose:** Automatically apply migrations when merged to main

**Location:** `.github/workflows/supabase-migrate.yml`

**Trigger:**
- **Automatic:** Push to `main` branch with changes to `supabase/migrations/**`
- **Manual:** Workflow dispatch

#### How It Works

1. **Developer creates migration:**
   ```bash
   # Create new migration file
   supabase migration new add_autopilot_fields

   # Edit the generated .sql file
   # supabase/migrations/20251228_add_autopilot_fields.sql
   ```

2. **Developer commits and pushes:**
   ```bash
   git add supabase/migrations/
   git commit -m "feat: add autopilot fields to picks table"
   git push origin feature-branch
   ```

3. **PR is created and merged to main**

4. **CI automatically applies migration to dev:**
   - Detects change in `supabase/migrations/**`
   - Runs migration plan job (shows what will be applied)
   - Applies migrations to dev environment
   - Verifies schema post-migration
   - Reloads PostgREST schema cache
   - Runs smoke tests

5. **For staging/prod:**
   - Use manual dispatch with environment selection
   - Requires approval in GitHub environment settings

#### Workflow Dispatch

Navigate to: `Actions` → `Supabase Migrations CI/CD` → `Run workflow`

Select:
- **Environment:** `dev`, `staging`, or `prod`
- **Dry run:** `true` to preview, `false` to apply

---

### 3. playwright-proof-pack.yml - E2E Testing

**Purpose:** Run Playwright tests and upload proof artifacts

**Location:** `.github/workflows/playwright-proof-pack.yml`

**Triggers:**
- **Automatic:** PR to main with changes to `apps/command-center/**`, `apps/smart-form/**`, or `apps/dashboard/**`
- **Manual:** Workflow dispatch
- **Scheduled:** Daily at 2 AM UTC

#### How to Dispatch

Navigate to: `Actions` → `Playwright Proof Pack` → `Run workflow`

Select:
- **Environment:** `dev`, `staging`, or `prod`
- **Test pattern:** (optional) e.g., `phase4-autopilot-smoke`

#### What It Tests

1. **Command Center E2E:**
   - Dashboard loads
   - Autopilot report functional
   - API health checks
   - SLO metrics display

2. **Smart Form E2E:**
   - Form submission
   - Validation
   - Integration with backend

#### Artifacts Generated

- **Screenshots:** PNG files of test execution
- **HTML Report:** Detailed Playwright report
- **Test Results:** JUnit XML format
- **Proof Pack Summary:** Markdown + JSON metadata

#### Accessing Artifacts

1. Go to the workflow run
2. Scroll to "Artifacts" section at bottom
3. Download:
   - `command-center-screenshots-<run-number>`
   - `command-center-report-<run-number>`
   - `smart-form-screenshots-<run-number>`
   - `smart-form-report-<run-number>`
   - `proof-pack-summary-<run-number>`

---

## Common Operations

### Scenario 1: Apply a New Migration to Dev

**Goal:** Apply pending migration to dev environment automatically

**Steps:**
1. Create migration file:
   ```bash
   cd unit-talk-production
   supabase migration new add_new_feature
   ```

2. Edit the generated SQL file in `supabase/migrations/`

3. Commit and push to feature branch:
   ```bash
   git add supabase/migrations/
   git commit -m "feat: add new feature migration"
   git push origin feature-branch
   ```

4. Create PR and merge to main

5. **CI automatically applies migration to dev** ✅

**Expected Result:**
- Migration applied to dev
- Schema verified
- Artifacts uploaded

---

### Scenario 2: Apply Migration to Staging/Production

**Goal:** Apply approved migration to staging or production

**Prerequisites:**
- ✅ Migration already tested in dev
- ✅ PR approved and merged to main
- ✅ GitHub environment approvals configured

**Steps:**
1. Navigate to: `Actions` → `Supabase Migrations CI/CD` → `Run workflow`

2. Select:
   - **Environment:** `staging` or `prod`
   - **Dry run:** `true`

3. Review the migration plan in logs

4. If plan looks good, run again with:
   - **Environment:** `staging` or `prod`
   - **Dry run:** `false`

5. **Approve the deployment** (if environment protection is enabled)

**Expected Result:**
- Migration applied to target environment
- Schema verified
- Notification sent to Discord (if configured)

---

### Scenario 3: Run a Safe SQL Query

**Goal:** Execute a read-only SQL query against dev/staging/prod

**Steps:**
1. Navigate to: `Actions` → `Ops Runner - Unified Operations Dispatch` → `Run workflow`

2. Select:
   - **Environment:** `dev` (or `staging`/`prod`)
   - **Action:** `safe_query`
   - **Dry run:** `false`
   - **SQL:** `SELECT COUNT(*) FROM picks WHERE workflow_stage = 'approved'`

3. Click "Run workflow"

4. Download query results from artifacts:
   - `query-results-dev-<run-number>`

**Valid Queries:**
```sql
-- Count picks by workflow stage
SELECT workflow_stage, COUNT(*) as count
FROM picks
GROUP BY workflow_stage

-- Recent autopilot decisions
SELECT * FROM autopilot_decisions
ORDER BY created_at DESC LIMIT 10

-- Agent health summary
SELECT agent_name, status, last_heartbeat
FROM agent_health
ORDER BY last_heartbeat DESC
```

**Blocked Queries:**
```sql
-- ❌ DROP TABLE picks
-- ❌ TRUNCATE picks
-- ❌ DELETE FROM picks  (without WHERE)
-- ❌ UPDATE picks SET status = 'approved'  (without WHERE)
```

---

### Scenario 4: Run Autopilot Evaluation

**Goal:** Trigger autopilot pick evaluation

**Steps:**
1. Navigate to: `Actions` → `Ops Runner - Unified Operations Dispatch` → `Run workflow`

2. For **log-only** mode (no actual publishing):
   - **Environment:** `dev`
   - **Action:** `autopilot_run`
   - **Dry run:** `true`

3. For **enabled** mode (actually publish approved picks):
   - **Environment:** `dev`
   - **Action:** `autopilot_run`
   - **Dry run:** `false`

4. Download results from artifacts:
   - `autopilot-results-dev-<run-number>`

**Example Result:**
```json
{
  "success": true,
  "mode": "log_only",
  "evaluation_run_id": "550e8400-e29b-41d4-a716-446655440000",
  "summary": {
    "total_evaluated": 42,
    "approved": 28,
    "rejected": 10,
    "unknown": 4,
    "would_publish": 28
  },
  "execution_time_ms": 1234
}
```

---

### Scenario 5: Generate Proof Pack

**Goal:** Run E2E tests and generate screenshots/reports

**Steps:**
1. Navigate to: `Actions` → `Ops Runner - Unified Operations Dispatch` → `Run workflow`

2. Select:
   - **Environment:** `dev`
   - **Action:** `proof_pack`
   - **Dry run:** `false`

3. Wait for workflow to complete (~10-15 minutes)

4. Download artifacts:
   - `playwright-screenshots-dev-<run-number>/`
   - `playwright-report-dev-<run-number>/`
   - `proof-pack-summary-dev-<run-number>/`

5. Open `index.html` in the report folder for detailed test results

---

### Scenario 6: Verify System Health

**Goal:** Check all infrastructure components are healthy

**Local Check:**
```powershell
# Run diagnostic tool
.\scripts\doctor.ps1

# Generate JSON report
.\scripts\doctor.ps1 -OutputFormat json > health-report.json

# Check staging
.\scripts\doctor.ps1 -Environment staging
```

**CI Check:**
```bash
# Use ops-run.yml workflow
Actions → Ops Runner → Run workflow
  Environment: dev
  Action: verify_schema
  Dry run: false
```

---

## Troubleshooting

### Issue: "Migration failed: relation already exists"

**Cause:** Migration was partially applied

**Solution:**
1. Check what was applied:
   ```bash
   # Use safe_query action
   SQL: SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10
   ```

2. If needed, create a rollback migration or fix manually

---

### Issue: "Table 'autopilot_decisions' does not exist"

**Cause:** Migration not applied

**Solution:**
1. Run the migration:
   ```bash
   Actions → Supabase Migrations CI/CD → Run workflow
     Environment: dev
     Dry run: false
   ```

2. Verify with doctor.ps1:
   ```powershell
   .\scripts\doctor.ps1
   ```

---

### Issue: "SUPABASE_SERVICE_ROLE_KEY not set"

**Cause:** GitHub secret missing

**Solution:**
1. Go to: `Settings` → `Secrets and variables` → `Actions`
2. Add secret: `SUPABASE_SERVICE_ROLE_KEY_DEV`
3. Get key from: Supabase Dashboard → Settings → API → service_role key

---

### Issue: "Query blocked: contains UPDATE keyword"

**Cause:** Trying to run write query with safe_query action

**Solution:**
- Use Supabase SQL Editor for write queries (or request new CI action)
- Verify query is read-only
- Check for accidental UPDATE/DELETE in query

---

### Issue: "Command Center not accessible"

**Cause:** Server not running or wrong URL

**Solution:**
1. Check server is running:
   ```bash
   curl http://localhost:3015/api/health
   ```

2. For CI, verify secret `COMMAND_CENTER_URL_STAGING` or `COMMAND_CENTER_URL_PROD` is set

3. Run doctor.ps1 to diagnose:
   ```powershell
   .\scripts\doctor.ps1 -Verbose
   ```

---

## Emergency Procedures

### Emergency: Rollback Migration

**If a migration breaks production:**

1. **Immediate action:**
   - Stop all deployments
   - Assess impact

2. **Create rollback migration:**
   ```bash
   supabase migration new rollback_breaking_change
   ```

3. **Apply rollback:**
   ```bash
   Actions → Supabase Migrations CI/CD → Run workflow
     Environment: prod
     Dry run: false
   ```

4. **Verify:**
   ```bash
   Actions → Ops Runner → Run workflow
     Environment: prod
     Action: verify_schema
   ```

---

### Emergency: Database Connection Issues

**If Supabase is unreachable:**

1. **Check Supabase status:**
   - https://status.supabase.com/

2. **Verify secrets are correct:**
   ```powershell
   # Test connectivity
   .\scripts\doctor.ps1 -Environment prod
   ```

3. **Check for IP blocks:**
   - Supabase Dashboard → Settings → Database → Connection pooling

4. **Fallback:**
   - Use Supabase SQL Editor directly (last resort)

---

## File References

All file paths mentioned in this runbook:

| File | Purpose | Location |
|------|---------|----------|
| Ops runner workflow | Unified dispatch | `.github/workflows/ops-run.yml` |
| Migration workflow | Auto migrations | `.github/workflows/supabase-migrate.yml` |
| Playwright workflow | E2E testing | `.github/workflows/playwright-proof-pack.yml` |
| Doctor script | Health check | `scripts/doctor.ps1` |
| Safe query runner | SQL queries | `scripts/ops/supabase-query.ts` |
| Schema verifier | Schema validation | `scripts/ops/verify-schema-post-migration.ts` |
| Supabase config | CLI config | `supabase/config.toml` |
| Migrations folder | SQL migrations | `supabase/migrations/` |
| PASS/FAIL matrix | Audit report | `docs/ops/AUTOMATION_AUDIT_PASS_FAIL_MATRIX.md` |

---

## Next Steps

1. **Configure GitHub Secrets** (see [Required Secrets](#required-secrets))
2. **Run local health check:** `.\scripts\doctor.ps1`
3. **Test ops-run.yml workflow** with a dev dry-run migration
4. **Set up environment approvals** for staging/prod in GitHub settings

---

**Questions or Issues?**
- Check [Troubleshooting](#troubleshooting)
- Review [AUTOMATION_AUDIT_PASS_FAIL_MATRIX.md](./AUTOMATION_AUDIT_PASS_FAIL_MATRIX.md)
- Contact Platform Engineering team
