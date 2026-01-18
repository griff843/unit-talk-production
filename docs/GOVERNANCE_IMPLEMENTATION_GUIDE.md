# SUPABASE GOVERNANCE IMPLEMENTATION GUIDE

> **Purpose:** Step-by-step implementation roadmap for locking down Supabase governance in the Unit Talk Platform.

**Version:** 1.0.0
**Date:** 2025-01-14
**Status:** READY FOR IMPLEMENTATION

---

## EXECUTIVE SUMMARY

This guide provides a complete implementation plan for establishing fail-closed database governance across the Unit Talk Platform. Following this plan will eliminate schema drift, prevent unauthorized mutations, and ensure Git remains the single source of truth for all Supabase schema changes.

**Estimated Implementation Time:** 3-4 weeks
**Risk Level:** MEDIUM (requires careful coordination)
**Prerequisites:** CTO and Tech Lead approval

---

## TABLE OF CONTENTS

1. [Pre-Implementation Checklist](#pre-implementation-checklist)
2. [Phase 1: Foundation (Week 1)](#phase-1-foundation-week-1)
3. [Phase 2: Automation (Week 2)](#phase-2-automation-week-2)
4. [Phase 3: Enforcement (Week 3)](#phase-3-enforcement-week-3)
5. [Phase 4: Validation (Week 4)](#phase-4-validation-week-4)
6. [Required Configuration Changes](#required-configuration-changes)
7. [Testing & Rollback Plan](#testing--rollback-plan)
8. [Post-Implementation Monitoring](#post-implementation-monitoring)

---

## PRE-IMPLEMENTATION CHECKLIST

### Prerequisites

- [ ] **CTO Approval:** Governance model approved
- [ ] **Tech Lead Approval:** Implementation plan reviewed
- [ ] **Team Notification:** All developers informed of upcoming changes
- [ ] **Backup Verification:** Current state backups exist for all environments
- [ ] **Documentation Review:** All team members have read governance documents
- [ ] **Access Audit:** Current access permissions documented
- [ ] **Rollback Plan:** Emergency rollback procedures defined

### Required Accounts & Access

- [ ] GitHub Organization admin access
- [ ] Supabase Project Owner access (all projects)
- [ ] 1Password/Vault admin access (for credential storage)
- [ ] Discord/Slack webhook URLs (for notifications)
- [ ] AWS access (if applicable for backups)

### Required Documents

- ✅ [SUPABASE_GOVERNANCE.md](./SUPABASE_GOVERNANCE.md) - Comprehensive governance model
- ✅ [MIGRATION_FLOW.md](./MIGRATION_FLOW.md) - Detailed migration workflows
- ✅ [ACCESS_CONTROL_MATRIX.md](./ACCESS_CONTROL_MATRIX.md) - Role-based access control
- ✅ [PRODUCTION_CHARTER.md](./PRODUCTION_CHARTER.md) - Platform-wide governance

---

## PHASE 1: FOUNDATION (WEEK 1)

### Day 1-2: Create Read-Only Database Users

**Objective:** Establish read-only users for safe query execution

**Steps:**

1. **Connect to each Supabase project:**

   ```bash
   # Dev environment
   psql "postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
   ```

2. **Create read-only user:**

   ```sql
   -- Create read-only user
   CREATE ROLE readonly_user WITH LOGIN PASSWORD '[GENERATE-SECURE-PASSWORD]';

   -- Grant read access
   GRANT CONNECT ON DATABASE postgres TO readonly_user;
   GRANT USAGE ON SCHEMA public TO readonly_user;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;

   -- Set default privileges for future tables
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
   GRANT SELECT ON TABLES TO readonly_user;

   -- Revoke all write permissions
   REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM readonly_user;
   REVOKE CREATE ON SCHEMA public FROM readonly_user;
   REVOKE ALL ON DATABASE postgres FROM readonly_user;
   GRANT CONNECT ON DATABASE postgres TO readonly_user;

   -- Verify permissions
   \du readonly_user
   ```

3. **Store credentials securely:**

   ```bash
   # Add to GitHub Secrets
   gh secret set SUPABASE_READONLY_KEY_DEV --body "[readonly-password]"
   gh secret set SUPABASE_READONLY_KEY_STAGING --body "[readonly-password]"
   gh secret set SUPABASE_READONLY_KEY_PROD --body "[readonly-password]"

   # Add to 1Password/Vault for human access
   # Title: "Unit Talk - Supabase Read-Only (Dev)"
   # Username: readonly_user
   # Password: [readonly-password]
   # URL: postgresql://readonly_user:[password]@[host]:6543/postgres
   ```

4. **Test read-only access:**

   ```bash
   # Test SELECT (should succeed)
   PGPASSWORD="[readonly-password]" psql \
     "postgresql://readonly_user@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" \
     -c "SELECT COUNT(*) FROM picks;"

   # Test INSERT (should fail)
   PGPASSWORD="[readonly-password]" psql \
     "postgresql://readonly_user@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" \
     -c "INSERT INTO picks (user_id) VALUES (gen_random_uuid());"
   # Expected: ERROR: permission denied for table picks
   ```

5. **Update .env.example:**

   ```bash
   cat >> .env.example << 'EOF'

   # =============================================================================
   # READ-ONLY DATABASE ACCESS (For Claude AI and monitoring)
   # =============================================================================
   SUPABASE_READONLY_DATABASE_URL_DEV=postgresql://readonly_user:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   SUPABASE_READONLY_DATABASE_URL_STAGING=postgresql://readonly_user:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   SUPABASE_READONLY_DATABASE_URL_PROD=postgresql://readonly_user:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   EOF
   ```

**Deliverables:**
- ✅ Read-only users created in all Supabase environments
- ✅ Credentials stored in GitHub Secrets
- ✅ Credentials stored in 1Password/Vault
- ✅ .env.example updated
- ✅ Access tested and verified

### Day 3-4: GitHub Branch Protection

**Objective:** Enforce code review and prevent unauthorized changes

**Steps:**

1. **Configure main branch protection:**

   Go to: https://github.com/[org]/unit-talk-production-main/settings/branches

   ```
   Branch: main

   ✅ Require a pull request before merging
       ✅ Require approvals: 2
       ✅ Dismiss stale pull request approvals when new commits are pushed
       ✅ Require review from Code Owners

   ✅ Require status checks to pass before merging
       ✅ Require branches to be up to date before merging
       Required checks:
           - TypeScript Compilation
           - Unit Tests
           - Migration Validation
           - Schema Drift Check

   ✅ Require conversation resolution before merging

   ✅ Require signed commits

   ✅ Require linear history

   ✅ Include administrators (enforce for admins)

   ❌ Allow force pushes (disabled)

   ❌ Allow deletions (disabled)
   ```

2. **Create CODEOWNERS file:**

   ```bash
   cat > .github/CODEOWNERS << 'EOF'
   # Unit Talk Platform Code Owners

   # Default owners (all files)
   * @tech-lead-github-username

   # Database migrations require additional review
   /supabase/migrations/** @tech-lead-github-username @cto-github-username

   # CI/CD workflows require CTO approval
   /.github/workflows/** @cto-github-username

   # Documentation
   /docs/** @tech-lead-github-username
   EOF

   git add .github/CODEOWNERS
   git commit -m "chore: add CODEOWNERS for governance enforcement"
   git push origin main
   ```

3. **Test branch protection:**

   ```bash
   # Try to push directly to main (should fail)
   git checkout main
   echo "test" > test.txt
   git add test.txt
   git commit -m "test: direct push"
   git push origin main
   # Expected: ERROR: Protected branch

   # Clean up
   git reset --hard HEAD~1
   ```

**Deliverables:**
- ✅ Branch protection enabled on main
- ✅ CODEOWNERS file created
- ✅ Protection tested and verified
- ✅ Team notified of new requirements

### Day 5: GitHub Environment Protection

**Objective:** Require approvals for staging and production deployments

**Steps:**

1. **Create GitHub Environments:**

   Go to: https://github.com/[org]/unit-talk-production-main/settings/environments

   **Dev Environment:**
   ```
   Environment name: dev

   ✅ No deployment protection rules (auto-deploy)

   Environment secrets:
   - SUPABASE_PROJECT_REF_DEV
   - SUPABASE_SERVICE_ROLE_KEY_DEV
   - SUPABASE_URL_DEV
   ```

   **Staging Environment:**
   ```
   Environment name: staging

   Deployment protection rules:
   ✅ Required reviewers: @tech-lead-github-username (1)

   Environment secrets:
   - SUPABASE_PROJECT_REF_STAGING
   - SUPABASE_SERVICE_ROLE_KEY_STAGING
   - SUPABASE_URL_STAGING
   ```

   **Production Environment:**
   ```
   Environment name: production

   Deployment protection rules:
   ✅ Required reviewers: @cto-github-username, @tech-lead-github-username (2)
   ✅ Wait timer: 5 minutes

   Environment secrets:
   - SUPABASE_PROJECT_REF_PROD
   - SUPABASE_SERVICE_ROLE_KEY_PROD
   - SUPABASE_URL_PROD
   ```

2. **Add environment secrets:**

   ```bash
   # Dev secrets
   gh secret set SUPABASE_PROJECT_REF_DEV --env dev --body "[dev-project-ref]"
   gh secret set SUPABASE_SERVICE_ROLE_KEY_DEV --env dev --body "[dev-service-role-key]"
   gh secret set SUPABASE_URL_DEV --env dev --body "https://[dev-project-ref].supabase.co"

   # Staging secrets
   gh secret set SUPABASE_PROJECT_REF_STAGING --env staging --body "[staging-project-ref]"
   gh secret set SUPABASE_SERVICE_ROLE_KEY_STAGING --env staging --body "[staging-service-role-key]"
   gh secret set SUPABASE_URL_STAGING --env staging --body "https://[staging-project-ref].supabase.co"

   # Production secrets
   gh secret set SUPABASE_PROJECT_REF_PROD --env production --body "[prod-project-ref]"
   gh secret set SUPABASE_SERVICE_ROLE_KEY_PROD --env production --body "[prod-service-role-key]"
   gh secret set SUPABASE_URL_PROD --env production --body "https://[prod-project-ref].supabase.co"

   # Shared secrets (organization level)
   gh secret set SUPABASE_ACCESS_TOKEN --body "[personal-access-token]"
   gh secret set DISCORD_RELEASE_WEBHOOK --body "[discord-webhook-url]"
   gh secret set SLACK_WEBHOOK_URL --body "[slack-webhook-url]"
   ```

3. **Test environment protection:**

   ```bash
   # Trigger staging deployment (should require approval)
   gh workflow run supabase-migrate.yml --field environment=staging

   # Check workflow status
   gh run list --workflow=supabase-migrate.yml

   # View pending approvals
   gh run view [run-id]
   ```

**Deliverables:**
- ✅ GitHub environments created (dev, staging, production)
- ✅ Approval rules configured
- ✅ Environment secrets stored
- ✅ Protection tested and verified

---

## PHASE 2: AUTOMATION (WEEK 2)

### Day 6-8: Drift Detection System

**Objective:** Automatically detect unauthorized schema changes

**Steps:**

1. **Create drift detection script:**

   ```bash
   # Create scripts/ops/detect-schema-drift.ts
   npx tsx scripts/ops/create-script.ts detect-schema-drift
   ```

   ```typescript
   #!/usr/bin/env tsx
   /**
    * Schema Drift Detection
    *
    * Compares actual Supabase schema against expected schema from migrations.
    * Alerts on any unauthorized changes.
    */

   import { createClient } from '@supabase/supabase-js';
   import { readFileSync } from 'fs';
   import { glob } from 'glob';

   interface DriftReport {
     timestamp: string;
     environment: string;
     driftDetected: boolean;
     differences: SchemaDifference[];
     severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
   }

   interface SchemaDifference {
     type: 'table' | 'column' | 'index' | 'constraint';
     object: string;
     difference: 'missing' | 'extra' | 'modified';
     expected?: any;
     actual?: any;
   }

   async function detectDrift(env: string): Promise<DriftReport> {
     console.log(`🔍 Detecting schema drift in ${env}...`);

     // 1. Build expected schema from migrations
     const expectedSchema = await buildSchemaFromMigrations();

     // 2. Query actual schema from Supabase
     const actualSchema = await querySupabaseSchema(env);

     // 3. Compare schemas
     const differences = compareSchemas(expectedSchema, actualSchema);

     // 4. Assess severity
     const severity = assessSeverity(differences);

     // 5. Generate report
     const report: DriftReport = {
       timestamp: new Date().toISOString(),
       environment: env,
       driftDetected: differences.length > 0,
       differences,
       severity,
     };

     return report;
   }

   async function buildSchemaFromMigrations(): Promise<any> {
     // Implementation: Parse migration files and build expected schema
     const migrationFiles = glob.sync('supabase/migrations/*.sql').sort();
     // ... parsing logic
     return {};
   }

   async function querySupabaseSchema(env: string): Promise<any> {
     const url = process.env[`SUPABASE_URL_${env.toUpperCase()}`];
     const key = process.env[`SUPABASE_READONLY_KEY_${env.toUpperCase()}`];

     const supabase = createClient(url!, key!);

     // Query information_schema
     const { data: tables } = await supabase.from('information_schema.tables')
       .select('*')
       .eq('table_schema', 'public');

     // ... additional queries for columns, indexes, etc.
     return { tables };
   }

   function compareSchemas(expected: any, actual: any): SchemaDifference[] {
     const differences: SchemaDifference[] = [];
     // ... comparison logic
     return differences;
   }

   function assessSeverity(differences: SchemaDifference[]): DriftReport['severity'] {
     if (differences.length === 0) return 'none';
     // ... severity assessment logic
     return 'low';
   }

   // Main execution
   async function main() {
     const env = process.argv[2] || 'dev';
     const report = await detectDrift(env);

     console.log(JSON.stringify(report, null, 2));

     if (report.driftDetected) {
       console.error(`🚨 DRIFT DETECTED in ${env}`);
       process.exit(1);
     } else {
       console.log(`✅ No drift detected in ${env}`);
       process.exit(0);
     }
   }

   main();
   ```

2. **Create drift detection workflow:**

   ```yaml
   # .github/workflows/schema-drift-check.yml
   name: Schema Drift Detection

   on:
     schedule:
       - cron: '0 */6 * * *'  # Every 6 hours
     workflow_dispatch:       # Manual trigger

   jobs:
     detect-drift:
       name: Detect Schema Drift
       runs-on: ubuntu-latest
       strategy:
         matrix:
           environment: [dev, staging, prod]
       steps:
         - name: Checkout
           uses: actions/checkout@v4

         - name: Setup Node.js
           uses: actions/setup-node@v4
           with:
             node-version: '20'

         - name: Install dependencies
           run: npm ci --workspace=apps/api

         - name: Run drift detection
           env:
             SUPABASE_URL_${{ matrix.environment }}: ${{ secrets[format('SUPABASE_URL_{0}', matrix.environment)] }}
             SUPABASE_READONLY_KEY_${{ matrix.environment }}: ${{ secrets[format('SUPABASE_READONLY_KEY_{0}', matrix.environment)] }}
           run: |
             npx tsx scripts/ops/detect-schema-drift.ts ${{ matrix.environment }} --report

         - name: Upload drift report
           if: always()
           uses: actions/upload-artifact@v4
           with:
             name: drift-report-${{ matrix.environment }}-${{ github.run_number }}
             path: reports/drift-report-*.json
             retention-days: 90

         - name: Alert on critical drift
           if: failure()
           run: |
             curl -X POST "${{ secrets.SLACK_WEBHOOK_URL }}" \
               -H "Content-Type: application/json" \
               -d "{
                 \"text\": \"🚨 CRITICAL SCHEMA DRIFT DETECTED\",
                 \"attachments\": [{
                   \"color\": \"danger\",
                   \"text\": \"Environment: ${{ matrix.environment }}\\nCheck artifacts for details.\",
                   \"fields\": [
                     {\"title\": \"Environment\", \"value\": \"${{ matrix.environment }}\", \"short\": true},
                     {\"title\": \"Run\", \"value\": \"${{ github.run_number }}\", \"short\": true}
                   ]
                 }]
               }"
   ```

3. **Test drift detection:**

   ```bash
   # Test locally
   npm run build:scripts
   npx tsx scripts/ops/detect-schema-drift.ts dev

   # Trigger workflow manually
   gh workflow run schema-drift-check.yml

   # View results
   gh run watch
   ```

**Deliverables:**
- ✅ Drift detection script created
- ✅ Drift detection workflow configured
- ✅ Alert integration tested
- ✅ Initial drift report generated

### Day 9-10: Migration Helper Scripts

**Objective:** Automate common migration tasks

**Steps:**

1. **Create migration generator:**

   ```typescript
   // scripts/ops/create-migration.ts
   #!/usr/bin/env tsx

   import { writeFileSync } from 'fs';

   const description = process.argv[2];
   const emergency = process.argv.includes('--emergency');

   if (!description) {
     console.error('Usage: npx tsx scripts/ops/create-migration.ts "description"');
     process.exit(1);
   }

   const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0].slice(0, 14);
   const filename = `${timestamp}_${description.replace(/\s+/g, '_')}.sql`;

   const migrationTemplate = `-- Migration: ${filename}
   -- Purpose: ${description}
   -- Author: [Your GitHub username]
   -- Date: ${new Date().toISOString().split('T')[0]}
   -- Risk Level: [LOW|MEDIUM|HIGH|CRITICAL]
   ${emergency ? '-- ⚠️  EMERGENCY MIGRATION ⚠️' : ''}

   BEGIN;

   -- ============================================================================
   -- IDEMPOTENT CHECKS
   -- ============================================================================

   DO $$
   BEGIN
       -- Add your idempotent checks here
       IF NOT EXISTS (SELECT 1 FROM ...) THEN
           -- Migration logic here
       END IF;
   END $$;

   -- ============================================================================
   -- POSTGREST SCHEMA RELOAD
   -- ============================================================================

   SELECT pg_notify('pgrst', 'reload schema');

   COMMIT;
   `;

   const rollbackTemplate = `-- Rollback: ${filename}
   -- Purpose: Revert ${description}
   -- Date: ${new Date().toISOString().split('T')[0]}

   BEGIN;

   -- Add rollback logic here

   SELECT pg_notify('pgrst', 'reload schema');

   COMMIT;
   `;

   writeFileSync(`supabase/migrations/${filename}`, migrationTemplate);
   writeFileSync(`supabase/rollback/${filename}`, rollbackTemplate);

   console.log(`✅ Created migration: supabase/migrations/${filename}`);
   console.log(`✅ Created rollback: supabase/rollback/${filename}`);
   ```

2. **Create migration validator:**

   ```typescript
   // scripts/ops/validate-migration.ts
   #!/usr/bin/env tsx

   import { readFileSync } from 'fs';

   const migrationFile = process.argv[2];

   if (!migrationFile) {
     console.error('Usage: npx tsx scripts/ops/validate-migration.ts [file]');
     process.exit(1);
   }

   const content = readFileSync(migrationFile, 'utf-8');

   const checks = [
     { name: 'Has BEGIN/COMMIT', test: /BEGIN;.*COMMIT;/s, required: true },
     { name: 'Has idempotent checks', test: /IF NOT EXISTS|IF EXISTS/i, required: true },
     { name: 'Has pg_notify', test: /pg_notify\('pgrst',\s*'reload schema'\)/, required: true },
     { name: 'No hardcoded secrets', test: /password|secret|key|token/i, required: false, shouldNotMatch: true },
     { name: 'Has risk level', test: /Risk Level:/i, required: true },
     { name: 'Has author', test: /Author:/i, required: true },
   ];

   let allPassed = true;

   checks.forEach(check => {
     const matches = check.test.test(content);
     const passed = check.shouldNotMatch ? !matches : matches;

     if (check.required && !passed) {
       console.error(`❌ ${check.name}: FAILED`);
       allPassed = false;
     } else if (passed) {
       console.log(`✅ ${check.name}: PASSED`);
     } else {
       console.warn(`⚠️  ${check.name}: WARNING`);
     }
   });

   if (allPassed) {
     console.log('\n✅ All validation checks passed');
     process.exit(0);
   } else {
     console.error('\n❌ Validation failed');
     process.exit(1);
   }
   ```

3. **Update package.json:**

   ```json
   {
     "scripts": {
       "migration:create": "tsx scripts/ops/create-migration.ts",
       "migration:validate": "tsx scripts/ops/validate-migration.ts",
       "drift:check": "tsx scripts/ops/detect-schema-drift.ts"
     }
   }
   ```

**Deliverables:**
- ✅ Migration generator script
- ✅ Migration validator script
- ✅ NPM scripts configured
- ✅ Scripts tested with sample migration

---

## PHASE 3: ENFORCEMENT (WEEK 3)

### Day 11-13: Pre-Commit Hooks

**Objective:** Prevent accidental direct schema changes

**Steps:**

1. **Install husky:**

   ```bash
   npm install --save-dev husky
   npx husky init
   ```

2. **Create pre-commit hook:**

   ```bash
   cat > .husky/pre-commit << 'EOF'
   #!/usr/bin/env sh
   . "$(dirname -- "$0")/_/husky.sh"

   # Check for migration files
   MIGRATION_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep "supabase/migrations/")

   if [ -n "$MIGRATION_FILES" ]; then
     echo "🔍 Validating migration files..."

     for file in $MIGRATION_FILES; do
       echo "Validating: $file"
       npx tsx scripts/ops/validate-migration.ts "$file"

       if [ $? -ne 0 ]; then
         echo "❌ Migration validation failed for: $file"
         echo "Please fix the issues before committing."
         exit 1
       fi
     done

     echo "✅ All migration files validated"
   fi

   # Check for direct SQL files outside migrations folder
   SQL_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep ".sql$" | grep -v "supabase/migrations/")

   if [ -n "$SQL_FILES" ]; then
     echo "⚠️  WARNING: SQL files detected outside migrations folder:"
     echo "$SQL_FILES"
     echo ""
     echo "SQL schema changes should be in supabase/migrations/ only."
     echo "Continue? (y/N): "
     read -r response

     if [ "$response" != "y" ]; then
       echo "❌ Commit aborted"
       exit 1
     fi
   fi

   # Run TypeScript type checking
   npm run type-check

   # Run linting
   npm run lint
   EOF

   chmod +x .husky/pre-commit
   ```

3. **Test pre-commit hook:**

   ```bash
   # Create valid migration
   npm run migration:create "test_migration"

   # Try to commit (should validate)
   git add supabase/migrations/
   git commit -m "test: migration validation"

   # Create invalid SQL file outside migrations
   echo "CREATE TABLE test (id int);" > test.sql
   git add test.sql
   git commit -m "test: invalid sql"
   # Should warn and require confirmation

   # Clean up
   git reset HEAD~1
   rm test.sql
   ```

**Deliverables:**
- ✅ Husky installed and configured
- ✅ Pre-commit hook created
- ✅ Migration validation on commit
- ✅ Hook tested with valid/invalid changes

### Day 14-15: CI/CD Status Checks

**Objective:** Add required status checks to branch protection

**Steps:**

1. **Add migration validation to CI:**

   ```yaml
   # .github/workflows/migration-validation.yml
   name: Migration Validation

   on:
     pull_request:
       paths:
         - 'supabase/migrations/**'

   jobs:
     validate-migrations:
       name: Validate Migrations
       runs-on: ubuntu-latest
       steps:
         - name: Checkout
           uses: actions/checkout@v4

         - name: Setup Node.js
           uses: actions/setup-node@v4
           with:
             node-version: '20'

         - name: Install dependencies
           run: npm ci

         - name: Validate all migrations
           run: |
             for file in supabase/migrations/*.sql; do
               echo "Validating: $file"
               npx tsx scripts/ops/validate-migration.ts "$file"
             done

         - name: Check for rollback files
           run: |
             for migration in supabase/migrations/*.sql; do
               filename=$(basename "$migration")
               rollback="supabase/rollback/$filename"

               if [ ! -f "$rollback" ]; then
                 echo "❌ Missing rollback file: $rollback"
                 exit 1
               fi
             done

         - name: Test idempotency
           run: |
             # Start local Postgres
             docker-compose up -d postgres

             # Wait for Postgres to be ready
             docker-compose exec postgres pg_isready -U postgres

             # Apply migrations twice (should be idempotent)
             for file in supabase/migrations/*.sql; do
               echo "Testing idempotency: $file"

               # First application
               docker-compose exec postgres psql -U postgres -d unit_talk_dev -f "$file"

               # Second application (should succeed)
               docker-compose exec postgres psql -U postgres -d unit_talk_dev -f "$file"

               if [ $? -ne 0 ]; then
                 echo "❌ Migration is not idempotent: $file"
                 exit 1
               fi
             done

             echo "✅ All migrations are idempotent"
   ```

2. **Update branch protection:**

   Add required status checks:
   - Migration Validation
   - TypeScript Compilation
   - Unit Tests
   - Schema Drift Check

**Deliverables:**
- ✅ Migration validation CI workflow
- ✅ Idempotency testing in CI
- ✅ Status checks added to branch protection
- ✅ Test PR created to verify checks

---

## PHASE 4: VALIDATION (WEEK 4)

### Day 16-18: End-to-End Testing

**Objective:** Validate complete migration workflow

**Steps:**

1. **Create test migration:**

   ```bash
   npm run migration:create "governance_test_table"
   ```

2. **Edit migration:**

   ```sql
   -- Migration: [timestamp]_governance_test_table
   -- Purpose: Test governance implementation
   -- Author: [username]
   -- Date: 2025-01-14
   -- Risk Level: LOW

   BEGIN;

   DO $$
   BEGIN
       IF NOT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'public'
           AND table_name = 'governance_test'
       ) THEN
           CREATE TABLE public.governance_test (
               id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
               test_data TEXT NOT NULL,
               created_at TIMESTAMPTZ NOT NULL DEFAULT now()
           );

           CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_governance_test_created_at
           ON public.governance_test(created_at);
       END IF;
   END $$;

   SELECT pg_notify('pgrst', 'reload schema');

   COMMIT;
   ```

3. **Create PR:**

   ```bash
   git checkout -b test/governance-implementation
   git add supabase/migrations/ supabase/rollback/
   git commit -m "test(db): validate governance implementation"
   git push origin test/governance-implementation
   gh pr create --title "Test: Governance Implementation" --body "Testing complete migration workflow"
   ```

4. **Verify workflow:**
   - [ ] Pre-commit hook validates migration
   - [ ] CI runs migration validation
   - [ ] CI tests idempotency
   - [ ] Status checks must pass before merge
   - [ ] Requires 2 approvals
   - [ ] Merge triggers dev deployment
   - [ ] Post-deployment verification runs
   - [ ] No schema drift detected

5. **Test Claude AI access:**

   ```bash
   # Claude should be able to query dev
   npx tsx scripts/ops/supabase-query.ts --env dev "SELECT * FROM governance_test LIMIT 1"

   # Claude should NOT be able to write
   npx tsx scripts/ops/supabase-query.ts --env dev "INSERT INTO governance_test (test_data) VALUES ('test')"
   # Should fail with validation error

   # Claude should be able to query prod
   npx tsx scripts/ops/supabase-query.ts --env prod "SELECT COUNT(*) FROM picks"
   ```

**Deliverables:**
- ✅ Complete migration workflow tested
- ✅ All governance controls verified
- ✅ Claude AI access tested
- ✅ Rollback procedure tested

### Day 19-21: Team Training

**Objective:** Ensure all team members understand new workflows

**Steps:**

1. **Create training materials:**
   - Video walkthrough of migration process
   - Quick reference cards
   - FAQ document
   - Troubleshooting guide

2. **Conduct training sessions:**
   - Developers: Migration creation and PR process
   - Tech Leads: Deployment approval workflow
   - CTO: Emergency procedures

3. **Hands-on practice:**
   - Each developer creates test migration
   - Practice PR review process
   - Simulate emergency scenario

**Deliverables:**
- ✅ Training materials created
- ✅ Training sessions completed
- ✅ All team members certified on new workflow

---

## REQUIRED CONFIGURATION CHANGES

### GitHub Secrets (Add via CLI or UI)

```bash
# Organization-level secrets
gh secret set SUPABASE_ACCESS_TOKEN --org [org-name]
gh secret set DISCORD_RELEASE_WEBHOOK --org [org-name]
gh secret set SLACK_WEBHOOK_URL --org [org-name]

# Environment-specific secrets (dev)
gh secret set SUPABASE_PROJECT_REF_DEV --env dev
gh secret set SUPABASE_SERVICE_ROLE_KEY_DEV --env dev
gh secret set SUPABASE_URL_DEV --env dev
gh secret set SUPABASE_READONLY_KEY_DEV --env dev

# Environment-specific secrets (staging)
gh secret set SUPABASE_PROJECT_REF_STAGING --env staging
gh secret set SUPABASE_SERVICE_ROLE_KEY_STAGING --env staging
gh secret set SUPABASE_URL_STAGING --env staging
gh secret set SUPABASE_READONLY_KEY_STAGING --env staging

# Environment-specific secrets (production)
gh secret set SUPABASE_PROJECT_REF_PROD --env production
gh secret set SUPABASE_SERVICE_ROLE_KEY_PROD --env production
gh secret set SUPABASE_URL_PROD --env production
gh secret set SUPABASE_READONLY_KEY_PROD --env production
```

### .env.example Updates

```bash
# Append to .env.example
cat >> .env.example << 'EOF'

# =============================================================================
# SUPABASE GOVERNANCE (Read-Only Access)
# =============================================================================
# These credentials provide safe query access for monitoring and Claude AI
SUPABASE_READONLY_DATABASE_URL_DEV=postgresql://readonly_user:[password]@[host]:6543/postgres
SUPABASE_READONLY_DATABASE_URL_STAGING=postgresql://readonly_user:[password]@[host]:6543/postgres
SUPABASE_READONLY_DATABASE_URL_PROD=postgresql://readonly_user:[password]@[host]:6543/postgres
EOF
```

### Docker Compose (No Changes Required)

Local Docker Compose continues to use local Postgres (isolated from Supabase).

### Production Charter Reference

Update [PRODUCTION_CHARTER.md](./PRODUCTION_CHARTER.md) to reference new governance:

```markdown
## 4) Data Model & Governance

**Governance:** All schema changes must follow [Supabase Governance](./SUPABASE_GOVERNANCE.md)

**Migration Flow:** See [Migration Flow](./MIGRATION_FLOW.md) for detailed workflows

**Access Control:** Role-based access defined in [Access Control Matrix](./ACCESS_CONTROL_MATRIX.md)
```

---

## TESTING & ROLLBACK PLAN

### Testing Checklist

**Before Go-Live:**

- [ ] Read-only users tested in all environments
- [ ] Branch protection prevents direct pushes
- [ ] PR approvals required and enforced
- [ ] Environment approvals required for deployments
- [ ] Drift detection running every 6 hours
- [ ] Pre-commit hooks validate migrations
- [ ] CI validates migrations on PR
- [ ] Idempotency tested
- [ ] Claude AI can query safely
- [ ] Claude AI cannot write
- [ ] Emergency procedures documented
- [ ] Team training completed

### Rollback Plan

**If issues arise during implementation:**

1. **Immediate Actions:**
   ```bash
   # Disable branch protection (emergency)
   gh api repos/:owner/:repo/branches/main/protection --method DELETE

   # Disable environment protection
   gh api repos/:owner/:repo/environments/[env]/protection_rules --method DELETE

   # Remove pre-commit hook
   rm .husky/pre-commit
   ```

2. **Restore Previous State:**
   - Revert governance commits
   - Remove read-only users
   - Restore previous CI/CD configuration
   - Notify team

3. **Root Cause Analysis:**
   - Document what went wrong
   - Identify necessary fixes
   - Update implementation plan
   - Schedule retry

---

## POST-IMPLEMENTATION MONITORING

### Daily Checks (First 2 Weeks)

- [ ] Check schema drift reports
- [ ] Review all migration PRs
- [ ] Monitor deployment success rate
- [ ] Check for access issues
- [ ] Review audit logs

### Weekly Checks

- [ ] Review governance compliance
- [ ] Check credential rotation schedule
- [ ] Verify all environments in sync
- [ ] Team feedback session
- [ ] Update documentation as needed

### Monthly Review

- [ ] Comprehensive access audit
- [ ] Review incident logs
- [ ] Update training materials
- [ ] Governance effectiveness assessment
- [ ] Plan improvements

---

## SUCCESS CRITERIA

**Implementation is successful when:**

- ✅ Zero schema drift across all environments for 30 days
- ✅ 100% of migrations applied via CI/CD
- ✅ No direct schema changes outside migrations
- ✅ All team members trained and certified
- ✅ Claude AI access working safely
- ✅ Emergency procedures tested
- ✅ Zero unauthorized access attempts
- ✅ Documentation complete and up-to-date

---

## CONTACTS & ESCALATION

**Primary Contacts:**
- **CTO:** [email/slack]
- **Tech Lead:** [email/slack]
- **DevOps:** [email/slack]

**Escalation Path:**
1. Technical issues → Tech Lead
2. Access issues → DevOps
3. Policy questions → CTO
4. Emergency → On-call + CTO

---

## APPENDIX

### Additional Resources

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
- [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments)

### Glossary

- **Drift:** Difference between expected and actual schema state
- **Service Role Key:** Full administrative Supabase access credential
- **Read-Only User:** Database user with SELECT-only permissions
- **Idempotent Migration:** Migration that can run multiple times safely

---

**Document Version:** 1.0.0
**Last Updated:** 2025-01-14
**Status:** READY FOR IMPLEMENTATION
