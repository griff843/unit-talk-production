# Supabase CI Migrations Audit Report

**Date:** 2025-12-28
**Auditor:** Claude Code (Staff+ Platform Engineer)
**Scope:** Determine if Supabase Cloud migrations are automated via CI/CD and if safe SQL query execution is possible

---

## Executive Summary

**Finding:** Supabase migrations are **PARTIALLY AUTOMATED** with **CRITICAL GAPS**

- ✅ **YES**: e2e-ci.yml applies migrations via `supabase db push`
- ⚠️ **PARTIAL**: Other workflows use psql directly (not via Supabase CLI)
- ❌ **NO**: Many operations still require manual SQL Editor copy/paste
- ❌ **NO**: No safe SQL query execution mechanism for ops/agents
- ❌ **NO**: Supabase CLI not configured for local development
- ⚠️ **INCONSISTENT**: Environment/secret naming varies across workflows

**Risk Level:** **HIGH** - Manual steps create deployment bottlenecks and human error risk

---

## 1. Supabase CLI Configuration

### Current State

**File:** `supabase/config.toml`
**Status:** ❌ **DOES NOT EXIST**

**Evidence:**
```bash
# Glob search result:
$ glob "**/supabase/config.toml"
No files found
```

**Impact:**
- Supabase CLI cannot be used locally without manual `supabase link`
- No project ref stored in version control
- Local migrations cannot be tested before CI
- Developers must configure CLI manually each time

### Migrations Folder

**Path:** `supabase/migrations/`
**Status:** ✅ **EXISTS** with **41 migration files**

**File List:**
```
supabase/migrations/20241227_phase4_autopilot_decisions.sql
supabase/migrations/20250125_phase15_analytics_monetization.sql
supabase/migrations/20250130_phase1_dead_letter_queue.sql
supabase/migrations/20251020_phase2_core.sql
supabase/migrations/20251024_phase12_ai_assist.sql
... (36 more files)
```

---

## 2. CI/CD Migration Automation

### 2.1 e2e-ci.yml (AUTOMATED ✅)

**File:** `.github/workflows/e2e-ci.yml`
**Status:** ✅ **FULLY AUTOMATED**

**Evidence:**
```yaml
# Lines 35-53
- name: Setup Supabase CLI
  uses: supabase/setup-cli@v1
  with:
    version: latest

- name: Supabase login & link
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
  run: |
    supabase link --project-ref "${{ secrets.SUPABASE_PROJECT_REF }}"
    n=0
    until [ $n -ge 3 ]; do
      supabase db push && break
      n=$((n+1)); echo "retry $n/3"; sleep 5
    done
```

**Strengths:**
- Uses official Supabase CLI action
- Implements retry logic (3 attempts)
- Masks secrets properly
- Includes schema verification steps

**Weaknesses:**
- Only runs on `push` to main/master or PR
- Single project ref (no staging/prod distinction)
- No migration plan/dry-run preview

### 2.2 canonical-convergence-ci.yml (HYBRID ⚠️)

**File:** `.github/workflows/canonical-convergence-ci.yml`
**Status:** ⚠️ **USES PSQL DIRECTLY** (not Supabase CLI)

**Evidence:**
```yaml
# Lines 66-72, 152-158, 221-228
- name: Gate 3 - Database Migration Dry-Run
  env:
    DATABASE_URL: ${{ secrets.DATABASE_DIRECT_URL }}
  run: |
    echo "🔍 Gate 3: Database Migration Dry-Run"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --dry-run -f scripts/migrations/2025-01-28_canonical_convergence.sql || true

- name: Run Canonical Migration
  env:
    DATABASE_URL: ${{ secrets.DATABASE_DIRECT_URL }}
  run: |
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2025-01-28_canonical_convergence.sql
    psql "$DATABASE_URL" -c "select pg_notify('pgrst','reload schema');"
```

**Issues:**
- Uses `DATABASE_DIRECT_URL` instead of Supabase CLI
- Bypasses Supabase migration tracking
- Migration file path is non-standard (`scripts/migrations/` vs `supabase/migrations/`)
- No version tracking in Supabase dashboard

### 2.3 Other Workflows

**Files Checked:**
- `.github/workflows/global-deploy.yml` - No migrations
- `.github/workflows/deploy.yml` - No migrations
- `.github/workflows/command-center-deploy.yml` - No migrations

---

## 3. Manual Migration Scripts (BLOCKING ISSUE ❌)

### 3.1 apply-migration-supabase.js

**File:** `scripts/ops/apply-migration-supabase.js`
**Status:** ❌ **LITERALLY REQUIRES MANUAL DASHBOARD STEPS**

**Evidence:**
```javascript
// Lines 48-71
console.log('MANUAL MIGRATION STEPS');
console.log('Due to RLS restrictions, please apply the migration manually:');
console.log('');
console.log('Option 1: Supabase SQL Editor (RECOMMENDED)');
console.log(`  1. Open: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
console.log(`  2. Copy SQL from: ${migrationPath}`);
console.log('  3. Paste into SQL Editor and click "Run"');
```

**Impact:**
- Confirms the problem statement: "apply migration manually in Supabase SQL editor"
- Creates deployment bottlenecks
- Introduces human error risk
- Violates GitOps/IaC principles

### 3.2 Other Manual Scripts

**Files Found (29 total):**
```
scripts/ops/apply-canonical-migration.ps1
scripts/ops/apply-canonical-migration-supabase.ps1
scripts/ops/apply-canonical-migration.js
scripts/ops/apply-migration-direct.js
scripts/ops/apply-phase13-migration.js
... (24 more)
```

---

## 4. Environment & Secrets Configuration

### 4.1 GitHub Secrets (Used in CI)

**From e2e-ci.yml:**
- `SUPABASE_ACCESS_TOKEN` (CLI auth)
- `SUPABASE_PROJECT_REF` (dev project)
- `SUPABASE_URL_new` (API URL)
- `SUPABASE_SERVICE_ROLE_KEY_2` (service key)

**From canonical-convergence-ci.yml:**
- `DATABASE_DIRECT_URL` (psql connection string)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `KUBECONFIG` (k8s deployment)

**Issues:**
- Inconsistent naming (`SUPABASE_SERVICE_ROLE_KEY` vs `_KEY_2`)
- No clear dev/staging/prod distinction
- `DATABASE_DIRECT_URL` not documented in .env.example

### 4.2 Local Environment Files

**File:** `.env.example`
**Supabase Variables:**
```bash
# Lines 14-16
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Missing:**
- `DATABASE_DIRECT_URL` (required by Production Charter, line 36)
- `SUPABASE_PROJECT_REF` (required for CLI link)
- `SUPABASE_ACCESS_TOKEN` (required for CLI auth)

### 4.3 Production Charter Requirements

**File:** `docs/PRODUCTION_CHARTER.md`
**Required Keys (lines 36-39):**
```markdown
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_DIRECT_URL`
```

**Gap:** `DATABASE_DIRECT_URL` is used in CI but not documented in .env.example

---

## 5. Safe SQL Query Execution for Ops/Agents

### Current State

**Status:** ❌ **NO MECHANISM EXISTS**

**Evidence:**
- No query runner script in `scripts/ops/`
- No API endpoint for safe SQL execution
- No read-only connection string environment variable
- No SQL statement allowlist/parser

**Impact:**
- Claude/agents cannot run SELECT queries safely
- Operators must use Supabase SQL Editor for debugging
- No audit trail for ad-hoc queries
- Risk of destructive queries if manual access granted

---

## 6. Recommended Approach

### Phase 1: Implement Automated CI Migrations

**Create:** `.github/workflows/supabase-migrate.yml`

**Features:**
- Use Supabase CLI (`supabase db push`) as primary method
- Support dev/staging/prod environments via project refs
- Migration plan step (dry-run preview)
- Schema verification after apply
- Manual dispatch option for emergency migrations
- Proper secret masking

**Triggers:**
- On merge to `main` → apply to **dev**
- On tag/release → apply to **staging** (manual approval)
- Manual dispatch for **prod** (require 2 approvals)

### Phase 2: Implement Safe SQL Query Runner

**Create:** `scripts/ops/supabase-query.ts`

**Features:**
- **Read-only by default** (SELECT, EXPLAIN, SHOW only)
- **Write mode** requires explicit `--write` flag + confirmation
- SQL statement allowlist/parser
- Parameterized queries (no string concatenation)
- Environment selector (`--env dev|staging|prod`)
- JSON and table output formats
- Credential redaction in all outputs
- Audit logging

**Environment Variables:**
```bash
# Add to .env.example
SUPABASE_READONLY_DATABASE_URL=postgresql://postgres.xxxxx:6543/postgres?sslmode=require
SUPABASE_READWRITE_DATABASE_URL=postgresql://postgres.xxxxx:6543/postgres?sslmode=require  # optional, gated
```

### Phase 3: Configure Supabase CLI Locally

**Create:** `supabase/config.toml`

```toml
# Supabase CLI Configuration
# DO NOT commit project_id - use environment variable SUPABASE_PROJECT_REF

[api]
enabled = true
port = 54321

[db]
port = 54322
shadow_port = 54320
```

**Add to .env.example:**
```bash
# Supabase CLI Configuration
SUPABASE_ACCESS_TOKEN=sbp_xxxxx  # Get from https://supabase.com/dashboard/account/tokens
SUPABASE_PROJECT_REF=xxxxx       # Get from project settings
DATABASE_DIRECT_URL=postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

---

## 7. Risks & Guardrails

### Current Risks

1. **Manual Migration Steps** (CRITICAL)
   - Human error in copy/paste
   - No version control for applied migrations
   - Deployment bottlenecks

2. **Inconsistent Migration Methods**
   - Some workflows use CLI, others use psql
   - Migration history fragmented

3. **No Safe Query Mechanism** (HIGH)
   - Cannot debug production issues without SQL Editor access
   - No audit trail for ad-hoc queries

4. **Missing Environment Documentation**
   - `DATABASE_DIRECT_URL` used but not documented
   - Secret naming inconsistent

### Proposed Guardrails

1. **CI Migration Automation**
   - ✅ Require migration plan review before apply
   - ✅ Automatic rollback on schema verification failure
   - ✅ Require 2 approvals for production migrations

2. **SQL Query Runner**
   - ✅ Read-only by default (allowlist: SELECT, EXPLAIN, SHOW)
   - ✅ Write mode requires `--write` flag + Y/N confirmation
   - ✅ Block dangerous statements (DROP, TRUNCATE, DELETE without WHERE, etc)
   - ✅ Audit logging to `audit_logs` table
   - ✅ Rate limiting (max 10 queries per minute)

3. **Secret Management**
   - ✅ All secrets masked in CI logs
   - ✅ Read-only database URL separate from read-write
   - ✅ Document all required secrets in .env.example

---

## 8. Implementation Plan

### Phase 1: CI Migrations (1-2 days)

1. Create `.github/workflows/supabase-migrate.yml`
2. Add required GitHub Secrets (SUPABASE_PROJECT_REF_DEV, _STAGING, _PROD)
3. Create migration plan script (`scripts/ops/migration-plan.ts`)
4. Create schema verification script (`scripts/ops/verify-schema.ts`)
5. Update SUPABASE_MIGRATIONS_RUNBOOK.md

### Phase 2: Safe Query Runner (1 day)

1. Create `scripts/ops/supabase-query.ts`
2. Implement SQL parser/allowlist
3. Add tests for statement filtering
4. Create `docs/ops/SAFE_SQL_QUERYING.md`
5. Add `SUPABASE_READONLY_DATABASE_URL` to .env.example

### Phase 3: Local CLI Setup (0.5 days)

1. Create `supabase/config.toml`
2. Update .env.example with CLI variables
3. Add setup instructions to CLAUDE.md

### Phase 4: Cleanup (0.5 days)

1. Deprecate manual migration scripts
2. Update existing workflows to use new process
3. Create migration from legacy to new approach

---

## 9. Required GitHub Secrets

**For CI Migrations:**
```
SUPABASE_ACCESS_TOKEN          # CLI auth token (all envs)
SUPABASE_PROJECT_REF_DEV       # Dev project ID
SUPABASE_PROJECT_REF_STAGING   # Staging project ID
SUPABASE_PROJECT_REF_PROD      # Prod project ID
SUPABASE_DB_PASSWORD_DEV       # Optional: direct psql fallback
SUPABASE_DB_PASSWORD_STAGING
SUPABASE_DB_PASSWORD_PROD
```

**For Query Runner:**
```
SUPABASE_READONLY_DATABASE_URL_DEV      # Read-only connection
SUPABASE_READONLY_DATABASE_URL_STAGING
SUPABASE_READONLY_DATABASE_URL_PROD
```

---

## 10. Exit Criteria

**Phase 1 Complete When:**
- [x] Audit document created
- [ ] CI workflow applies migrations automatically on merge to main
- [ ] Manual dispatch works for staging/prod
- [ ] Migration plan shows diff before apply
- [ ] Schema verification prevents broken deploys
- [ ] Zero manual SQL Editor steps required

**Phase 2 Complete When:**
- [ ] `supabase-query` script runs SELECT queries safely
- [ ] Write mode properly gated with confirmation
- [ ] SQL parser blocks all dangerous statements
- [ ] All outputs redact credentials
- [ ] Tests verify allowlist enforcement

**Phase 3 Complete When:**
- [ ] Command Center reads real Supabase data (not mocks)
- [ ] Playwright tests prove UI functionality
- [ ] Screenshots saved in proof pack

---

## Appendix: File References

### Workflows Analyzed
- `.github/workflows/e2e-ci.yml` (line 35-53: Supabase CLI setup)
- `.github/workflows/canonical-convergence-ci.yml` (line 152-158: psql migration)
- `.github/workflows/global-deploy.yml` (no migrations)

### Migration Scripts
- `scripts/ops/apply-migration-supabase.js` (manual steps)
- `scripts/ops/apply-canonical-migration.js`
- `scripts/ops/apply-phase13-migration.js`

### Documentation
- `docs/PRODUCTION_CHARTER.md` (line 36: required env vars)
- `.env.example` (line 15-16: Supabase config)

### Migration Files
- `supabase/migrations/` (41 files, dated 2024-12-27 to 2025-01-30)
