# SUPABASE MIGRATION FLOW

> **Purpose:** Step-by-step workflows for executing schema migrations in the Unit Talk Platform, ensuring fail-safe operations and zero-drift guarantees.

**Version:** 1.0.0
**Last Updated:** 2025-01-14
**Related:** [Supabase Governance](./SUPABASE_GOVERNANCE.md) | [Production Charter](./PRODUCTION_CHARTER.md)

---

## TABLE OF CONTENTS

1. [Quick Reference](#quick-reference)
2. [Developer Workflow](#developer-workflow)
3. [CI/CD Pipeline](#cicd-pipeline)
4. [Emergency Procedures](#emergency-procedures)
5. [Verification Commands](#verification-commands)
6. [Troubleshooting](#troubleshooting)

---

## QUICK REFERENCE

### Common Commands

```bash
# Create new migration
npx tsx scripts/ops/create-migration.ts "add_index_to_picks"

# Test migration locally
docker-compose exec postgres psql -U postgres -d unit_talk_dev -f supabase/migrations/[timestamp]_[name].sql

# Validate migration
npx tsx scripts/ops/validate-migration.ts supabase/migrations/[timestamp]_[name].sql

# Apply to dev (auto via CI after merge)
git push origin main

# Apply to staging (manual dispatch)
gh workflow run supabase-migrate.yml --field environment=staging

# Apply to prod (manual dispatch + approval)
gh workflow run supabase-migrate.yml --field environment=prod

# Rollback migration
gh workflow run rollback-migration.yml --field environment=[env] --field migration_timestamp=[timestamp]

# Check schema drift
npx tsx scripts/ops/detect-schema-drift.ts --env [dev|staging|prod]

# Safe query execution
npx tsx scripts/ops/supabase-query.ts --env dev "SELECT * FROM picks LIMIT 10"
```

---

## DEVELOPER WORKFLOW

### Step 1: Identify Schema Change Requirement

**Before creating a migration, ask:**
- [ ] Is this change necessary?
- [ ] Can it be done via application code instead?
- [ ] Will this break existing functionality?
- [ ] Does this require RLS policy updates?
- [ ] Is this a breaking change requiring coordination?

**Document the requirement:**
```markdown
## Schema Change Request

**Objective:** [What problem does this solve?]
**Affected Tables:** [List tables]
**Breaking Change:** [Yes/No]
**Risk Level:** [LOW|MEDIUM|HIGH|CRITICAL]
**Rollback Plan:** [How to reverse this change]
```

### Step 2: Create Migration File

**Use the migration creation script:**

```bash
# Generate migration template
npx tsx scripts/ops/create-migration.ts "add_user_preferences_table"
```

**This creates:**
```
supabase/migrations/20250114120000_add_user_preferences_table.sql
supabase/rollback/20250114120000_rollback.sql
```

**Migration template:**
```sql
-- Migration: 20250114120000_add_user_preferences_table
-- Purpose: Add user preferences storage
-- Author: [Your GitHub username]
-- Date: 2025-01-14
-- Risk Level: LOW
-- Breaking Change: No

-- Rollback file: supabase/rollback/20250114120000_rollback.sql

BEGIN;

-- ============================================================================
-- IDEMPOTENT CHECKS
-- ============================================================================

-- Only run if table doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_preferences'
    ) THEN

        -- ====================================================================
        -- TABLE CREATION
        -- ====================================================================

        CREATE TABLE public.user_preferences (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

            -- Constraints
            CONSTRAINT user_preferences_user_id_unique UNIQUE (user_id)
        );

        -- ====================================================================
        -- INDEXES
        -- ====================================================================

        -- User lookup index (created concurrently to avoid locking)
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_user_id
        ON public.user_preferences(user_id);

        -- JSONB GIN index for preference searches
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_jsonb
        ON public.user_preferences USING GIN (preferences);

        -- ====================================================================
        -- RLS POLICIES
        -- ====================================================================

        -- Enable RLS
        ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

        -- Users can read their own preferences
        CREATE POLICY user_preferences_select_own
        ON public.user_preferences
        FOR SELECT
        USING (auth.uid() = user_id);

        -- Users can update their own preferences
        CREATE POLICY user_preferences_update_own
        ON public.user_preferences
        FOR UPDATE
        USING (auth.uid() = user_id);

        -- ====================================================================
        -- TRIGGERS
        -- ====================================================================

        -- Update updated_at timestamp
        CREATE TRIGGER user_preferences_updated_at
        BEFORE UPDATE ON public.user_preferences
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at();

        -- ====================================================================
        -- GRANTS
        -- ====================================================================

        -- Grant access to authenticated users
        GRANT SELECT, INSERT, UPDATE ON public.user_preferences TO authenticated;

        -- Grant read access to readonly_user (for monitoring)
        GRANT SELECT ON public.user_preferences TO readonly_user;

    END IF;
END $$;

-- ============================================================================
-- POSTGREST SCHEMA RELOAD
-- ============================================================================

-- Notify PostgREST to reload schema cache
SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
```

**Rollback template:**
```sql
-- Rollback: 20250114120000_add_user_preferences_table
-- Purpose: Remove user_preferences table
-- Date: 2025-01-14

BEGIN;

-- Drop table (cascade to remove dependencies)
DROP TABLE IF EXISTS public.user_preferences CASCADE;

-- Notify PostgREST to reload schema
SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
```

### Step 3: Test Migration Locally

**Test in Docker environment:**

```bash
# Start Docker stack
./dev.sh start

# Wait for Postgres to be ready
docker-compose exec postgres pg_isready -U postgres

# Apply migration
docker-compose exec postgres psql -U postgres -d unit_talk_dev -f /docker-entrypoint-initdb.d/supabase/migrations/20250114120000_add_user_preferences_table.sql

# Verify table exists
docker-compose exec postgres psql -U postgres -d unit_talk_dev -c "\dt user_preferences"

# Test idempotency (run again)
docker-compose exec postgres psql -U postgres -d unit_talk_dev -f /docker-entrypoint-initdb.d/supabase/migrations/20250114120000_add_user_preferences_table.sql

# Should succeed without errors

# Test rollback
docker-compose exec postgres psql -U postgres -d unit_talk_dev -f /docker-entrypoint-initdb.d/supabase/rollback/20250114120000_rollback.sql

# Verify table is gone
docker-compose exec postgres psql -U postgres -d unit_talk_dev -c "\dt user_preferences"
```

**Test with sample data:**

```sql
-- Insert test data
INSERT INTO public.user_preferences (user_id, preferences)
VALUES (
    (SELECT id FROM public.users LIMIT 1),
    '{"theme": "dark", "notifications": true}'::jsonb
);

-- Query test data
SELECT * FROM public.user_preferences;

-- Test RLS (as non-admin user)
SET ROLE authenticated;
SELECT * FROM public.user_preferences;
RESET ROLE;

-- Clean up test data
DELETE FROM public.user_preferences;
```

### Step 4: Validate Migration

**Run validation script:**

```bash
npx tsx scripts/ops/validate-migration.ts \
    supabase/migrations/20250114120000_add_user_preferences_table.sql
```

**Validation checks:**
- ✅ SQL syntax is valid
- ✅ Migration is idempotent (has IF NOT EXISTS checks)
- ✅ Rollback file exists
- ✅ No hardcoded secrets
- ✅ Includes pg_notify for PostgREST reload
- ✅ No destructive operations without safety checks
- ✅ Follows naming conventions
- ✅ Has proper comments and documentation

### Step 5: Create Pull Request

**Branch naming:**
```bash
git checkout -b migration/add-user-preferences-table
```

**Commit message:**
```
feat(db): add user_preferences table for storing user settings

- Creates user_preferences table with RLS policies
- Adds indexes for user_id and JSONB searches
- Includes rollback migration
- Risk Level: LOW
- Breaking Change: No

Migration: supabase/migrations/20250114120000_add_user_preferences_table.sql
Rollback: supabase/rollback/20250114120000_rollback.sql

Closes #[issue-number]
```

**PR description template:**

```markdown
## Migration Summary

**Migration File:** `supabase/migrations/20250114120000_add_user_preferences_table.sql`
**Rollback File:** `supabase/rollback/20250114120000_rollback.sql`
**Risk Level:** LOW
**Breaking Change:** No

### Objective
Add user preferences storage to support personalized user settings.

### Changes
- Creates `user_preferences` table with RLS policies
- Adds indexes for efficient lookups
- Includes updated_at trigger
- Grants appropriate permissions

### Testing
- [x] Tested locally in Docker
- [x] Migration is idempotent (tested 2x execution)
- [x] Rollback tested successfully
- [x] RLS policies tested with sample data
- [x] Validation script passed

### Rollback Plan
Execute `supabase/rollback/20250114120000_rollback.sql` to drop the table.

### Checklist
- [x] Migration is idempotent
- [x] Rollback file created
- [x] No hardcoded secrets
- [x] PostgREST reload included
- [x] RLS policies defined
- [x] Indexes created concurrently
- [x] Comments and documentation complete
- [x] Local testing passed

### Deployment Plan
1. Auto-deploy to dev on merge
2. Monitor dev for 24 hours
3. Manual deploy to staging
4. Monitor staging for 48 hours
5. Manual deploy to prod with approval

cc @tech-lead @database-team
```

### Step 6: Code Review

**Reviewer checklist:**

- [ ] Migration follows naming convention
- [ ] SQL syntax is valid
- [ ] Migration is truly idempotent
- [ ] Rollback plan is clear and tested
- [ ] No hardcoded secrets or credentials
- [ ] Appropriate indexes created
- [ ] RLS policies defined (if applicable)
- [ ] PostgREST reload included
- [ ] Risk level is appropriate
- [ ] Breaking change flag is accurate
- [ ] Documentation is complete
- [ ] Local testing evidence provided

**Common review feedback:**

```sql
-- ❌ BAD: Not idempotent
CREATE TABLE user_preferences (...);

-- ✅ GOOD: Idempotent
CREATE TABLE IF NOT EXISTS user_preferences (...);

-- ❌ BAD: Blocking index creation
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- ✅ GOOD: Non-blocking index creation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_user_id
ON user_preferences(user_id);

-- ❌ BAD: No RLS policy
CREATE TABLE user_preferences (...);

-- ✅ GOOD: RLS enabled with policies
CREATE TABLE user_preferences (...);
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY ...

-- ❌ BAD: Missing PostgREST reload
COMMIT;

-- ✅ GOOD: PostgREST reload included
SELECT pg_notify('pgrst', 'reload schema');
COMMIT;
```

### Step 7: Merge to Main

**After approval:**

```bash
# Squash and merge via GitHub UI
# OR via CLI:
gh pr merge --squash --delete-branch
```

**What happens next:**
1. ✅ GitHub Actions triggers on main branch push
2. ✅ CI validates migration
3. ✅ CI automatically deploys to Supabase dev
4. ✅ Post-migration verification runs
5. ✅ Smoke tests execute
6. ✅ Schema drift detection runs
7. ✅ Slack notification sent

### Step 8: Monitor Dev Deployment

**Check CI/CD status:**

```bash
# Watch workflow status
gh run watch

# View logs
gh run view --log
```

**Verify deployment:**

```bash
# Check schema in dev
npx tsx scripts/ops/supabase-query.ts --env dev --output table "
    SELECT table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
"

# Check for drift
npx tsx scripts/ops/detect-schema-drift.ts --env dev
```

**Monitor for issues:**
- Check error logs in Supabase dashboard
- Monitor API response times
- Check for RLS policy violations
- Verify PostgREST schema updated

### Step 9: Promote to Staging

**After 24 hours in dev with no issues:**

```bash
# Manual workflow dispatch for staging
gh workflow run supabase-migrate.yml \
    --field environment=staging \
    --field dry_run=false
```

**What happens:**
1. ✅ Tech Lead approval required (automatic via GitHub environments)
2. ✅ Migration applied to staging Supabase
3. ✅ Verification tests run
4. ✅ Smoke tests execute
5. ✅ Slack notification sent

**Monitor staging for 48 hours:**
- Check application logs
- Monitor user feedback
- Run integration tests
- Verify performance metrics

### Step 10: Promote to Production

**After successful staging soak:**

```bash
# Manual workflow dispatch for production
gh workflow run supabase-migrate.yml \
    --field environment=prod \
    --field dry_run=false
```

**What happens:**
1. ⏸️ CTO + Tech Lead approval required (2+ reviewers)
2. ⏸️ 5-minute wait timer (cancellation window)
3. ✅ Automated backup verification
4. ✅ Migration applied to production Supabase
5. ✅ Comprehensive verification tests run
6. ✅ Smoke tests execute
7. ✅ Discord notification sent
8. ✅ 1-hour monitoring period begins

**Post-deployment checklist:**
- [ ] Verify schema in production
- [ ] Check for errors in logs
- [ ] Monitor API response times (should be <150ms p95)
- [ ] Check database query times (should be <50ms p95)
- [ ] Verify no schema drift
- [ ] Confirm user-facing features working
- [ ] Update status page (if applicable)

---

## CI/CD PIPELINE

### Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      DEVELOPER WORKFLOW                          │
│  Create Migration → Test Locally → PR → Review → Merge          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  MAIN BRANCH    │
                    │  (Protected)    │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼─────┐       ┌──────▼──────┐      ┌─────▼──────┐
   │ VALIDATE │       │ DRIFT CHECK │      │ LINT/TEST  │
   │ MIGRATION│       │             │      │            │
   └────┬─────┘       └──────┬──────┘      └─────┬──────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   DEV DEPLOY    │
                    │   (Automatic)   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  POST-MIGRATION │
                    │  VERIFICATION   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  SMOKE TESTS    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  SUCCESS        │
                    │  ✅ Dev Ready   │
                    └─────────────────┘
                             │
        ┌────────────────────┴─────────────────────┐
        │                                           │
   ┌────▼──────────┐                    ┌──────────▼─────┐
   │ STAGING       │                    │ PRODUCTION     │
   │ (Manual)      │                    │ (Manual +      │
   │               │                    │  Approval)     │
   │ 1. Dispatch   │                    │                │
   │ 2. Approve    │                    │ 1. Dispatch    │
   │ 3. Deploy     │                    │ 2. 2+ Approve  │
   │ 4. Verify     │                    │ 3. Wait 5min   │
   │               │                    │ 4. Backup Chk  │
   └───────────────┘                    │ 5. Deploy      │
                                        │ 6. Verify      │
                                        │ 7. Monitor 1h  │
                                        └────────────────┘
```

### GitHub Actions Workflow

**File:** `.github/workflows/supabase-migrate.yml`

**Trigger Conditions:**
- **Auto:** Push to main branch with changes in `supabase/migrations/**`
- **Manual:** Workflow dispatch with environment selection

**Jobs:**

#### 1. Migration Plan Job

```yaml
migration-plan:
  runs-on: ubuntu-latest
  steps:
    - name: Checkout
      uses: actions/checkout@v4
      with:
        fetch-depth: 0  # Need full history

    - name: Check for pending migrations
      run: |
        COUNT=$(find supabase/migrations -name "*.sql" -type f | wc -l)
        echo "Found $COUNT migration files"

    - name: Display migration plan
      run: |
        echo "Migrations to apply:"
        find supabase/migrations -name "*.sql" -type f -printf "%f\n" | sort
```

#### 2. Migrate Dev Job

```yaml
migrate-dev:
  needs: migration-plan
  if: github.ref == 'refs/heads/main'
  environment: dev
  runs-on: ubuntu-latest
  steps:
    - name: Setup Supabase CLI
      uses: supabase/setup-cli@v1

    - name: Link to dev project
      env:
        SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      run: |
        supabase link --project-ref "${{ secrets.SUPABASE_PROJECT_REF_DEV }}"

    - name: Apply migrations with retry
      run: |
        n=0
        max_attempts=3
        until [ $n -ge $max_attempts ]; do
          if supabase db push --include-all; then
            echo "✅ Migrations applied successfully"
            break
          fi
          n=$((n+1))
          echo "⚠️  Attempt $n failed, retrying..."
          sleep 10
        done

    - name: Verify schema
      run: |
        npx tsx scripts/ops/verify-schema-post-migration.ts --env dev

    - name: Reload PostgREST
      run: |
        curl -X POST "${{ secrets.SUPABASE_URL_DEV }}/rest/v1/rpc/reload_schema" \
          -H "apikey: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY_DEV }}" \
          -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY_DEV }}"

    - name: Run smoke tests
      run: |
        npx tsx scripts/ops/smoke-test-db.ts --env dev
```

#### 3. Migrate Staging Job

```yaml
migrate-staging:
  needs: migration-plan
  if: github.event.inputs.environment == 'staging'
  environment: staging  # Requires Tech Lead approval
  runs-on: ubuntu-latest
  steps:
    # Similar to dev but with staging credentials
    - name: Link to staging project
      env:
        SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      run: |
        supabase link --project-ref "${{ secrets.SUPABASE_PROJECT_REF_STAGING }}"

    - name: Apply migrations
      run: |
        supabase db push --include-all

    # ... verification steps
```

#### 4. Migrate Production Job

```yaml
migrate-prod:
  needs: migration-plan
  if: github.event.inputs.environment == 'prod'
  environment: production  # Requires CTO + Tech Lead approval
  runs-on: ubuntu-latest
  timeout-minutes: 20
  steps:
    - name: Wait for approval
      run: |
        echo "⏸️  Waiting for 2+ approvals..."
        echo "⏸️  5-minute cancellation window..."
        sleep 300

    - name: Verify backup exists
      run: |
        npx tsx scripts/ops/verify-backup-exists.ts --env prod --max-age 24h

    - name: Link to production project
      env:
        SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      run: |
        supabase link --project-ref "${{ secrets.SUPABASE_PROJECT_REF_PROD }}"

    - name: Apply migrations
      run: |
        echo "🚀 Applying to PRODUCTION..."
        supabase db push --include-all

    - name: Comprehensive verification
      run: |
        npx tsx scripts/ops/verify-schema-post-migration.ts --env prod --comprehensive

    - name: Notify Discord
      if: always()
      run: |
        curl -X POST "${{ secrets.DISCORD_RELEASE_WEBHOOK }}" \
          -H "Content-Type: application/json" \
          -d "{\"content\": \"🚀 Production migration: ${{ job.status }}\"}"
```

### Drift Detection Workflow

**File:** `.github/workflows/schema-drift-check.yml`

```yaml
name: Schema Drift Detection

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:

jobs:
  detect-drift:
    strategy:
      matrix:
        environment: [dev, staging, prod]
    runs-on: ubuntu-latest
    steps:
      - name: Run drift detection
        env:
          SUPABASE_READONLY_KEY: ${{ secrets[format('SUPABASE_READONLY_KEY_{0}', matrix.environment)] }}
        run: |
          npx tsx scripts/ops/detect-schema-drift.ts \
            --env ${{ matrix.environment }} \
            --alert-on-drift

      - name: Alert on critical drift
        if: failure()
        run: |
          curl -X POST "${{ secrets.SLACK_WEBHOOK_URL }}" \
            -d "{\"text\": \"🚨 CRITICAL DRIFT: ${{ matrix.environment }}\"}"
```

---

## EMERGENCY PROCEDURES

### Emergency Fast-Track Migration

**When:** Production is down and requires immediate schema fix

**Process:**

1. **Declare Emergency**
   ```bash
   # Create P0 incident
   gh issue create --title "P0: Production Outage - Schema Fix Required" \
                    --label "P0,emergency,database" \
                    --body "Description of issue..."
   ```

2. **Create Emergency Branch**
   ```bash
   git checkout -b emergency/fix-production-schema
   ```

3. **Create Emergency Migration**
   ```bash
   # Generate emergency migration
   npx tsx scripts/ops/create-migration.ts "emergency_fix_[issue]" --emergency

   # Edit migration file
   vim supabase/migrations/[timestamp]_emergency_fix_[issue].sql
   ```

4. **Emergency Review**
   - CTO or designated authority reviews SQL
   - 2+ engineers approve
   - Rollback plan documented

5. **Fast-Track Deployment**
   ```bash
   # Push emergency branch
   git add supabase/migrations/
   git commit -m "emergency: fix production schema [P0-incident-id]"
   git push origin emergency/fix-production-schema

   # Trigger emergency workflow
   gh workflow run supabase-migrate.yml \
       --ref emergency/fix-production-schema \
       --field environment=prod \
       --field emergency=true
   ```

6. **Monitor**
   ```bash
   # Watch deployment
   gh run watch

   # Verify fix
   npx tsx scripts/ops/smoke-test-db.ts --env prod --comprehensive

   # Check for drift
   npx tsx scripts/ops/detect-schema-drift.ts --env prod
   ```

7. **Post-Emergency**
   - Merge emergency branch to main
   - Complete incident post-mortem
   - Update runbooks
   - Review what went wrong

### Emergency Rollback

**When:** Migration causes production issues

**Process:**

1. **Trigger Rollback**
   ```bash
   # Immediate rollback via workflow
   gh workflow run rollback-migration.yml \
       --field environment=prod \
       --field migration_timestamp=[timestamp]
   ```

2. **Manual Rollback (if CI fails)**
   ```bash
   # Connect via psql
   psql "$DATABASE_DIRECT_URL_PROD"

   # Execute rollback SQL
   BEGIN;
   \i supabase/rollback/[timestamp]_rollback.sql
   COMMIT;

   # Reload PostgREST
   SELECT pg_notify('pgrst', 'reload schema');
   ```

3. **Verify Restoration**
   ```bash
   # Run verification
   npx tsx scripts/ops/verify-schema-post-migration.ts --env prod

   # Smoke tests
   npx tsx scripts/ops/smoke-test-db.ts --env prod
   ```

4. **Incident Response**
   - Document what happened
   - Identify root cause
   - Update migration with fix
   - Re-test in dev/staging

---

## VERIFICATION COMMANDS

### Schema Verification

```bash
# Compare expected vs actual schema
npx tsx scripts/ops/verify-schema-post-migration.ts --env [dev|staging|prod]

# Output:
# ✅ All tables present
# ✅ All columns match
# ✅ All indexes match
# ✅ All constraints match
# ✅ Schema is in sync
```

### Drift Detection

```bash
# Detect any schema drift
npx tsx scripts/ops/detect-schema-drift.ts --env [dev|staging|prod]

# Output:
# Drift Report:
# - Environment: prod
# - Drift Detected: No
# - Last Checked: 2025-01-14T12:00:00Z
# ✅ Schema is in perfect sync
```

### Smoke Tests

```bash
# Run basic connectivity and query tests
npx tsx scripts/ops/smoke-test-db.ts --env [dev|staging|prod]

# Output:
# ✅ Database connection successful
# ✅ Can read from picks table
# ✅ Can read from users table
# ✅ RLS policies active
# ✅ Indexes are present
# ✅ All smoke tests passed
```

### Query Execution

```bash
# Read-only query (safe)
npx tsx scripts/ops/supabase-query.ts --env dev "
    SELECT COUNT(*) as total_picks
    FROM picks
    WHERE created_at > NOW() - INTERVAL '7 days'
"

# Output:
# ========================================
# SAFE SUPABASE QUERY RUNNER
# ========================================
# Environment: DEV
# Mode: READ-ONLY
# Output: table
# ----------------------------------------
#
# ✅ SQL validation passed
# Executing query...
# ✅ Query successful
#
# ========================================
# RESULTS
# ========================================
#
# total_picks
# -----------
# 1,234
#
# (1 row)
# Duration: 45ms
```

---

## TROUBLESHOOTING

### Common Issues

#### Issue: Migration fails with "already exists" error

**Cause:** Migration is not idempotent

**Solution:**
```sql
-- ❌ BAD
CREATE TABLE users (...);

-- ✅ GOOD
CREATE TABLE IF NOT EXISTS users (...);
```

#### Issue: PostgREST not reflecting schema changes

**Cause:** Schema cache not reloaded

**Solution:**
```sql
-- Add to end of migration
SELECT pg_notify('pgrst', 'reload schema');
```

**Manual reload:**
```bash
curl -X POST "$SUPABASE_URL/rest/v1/rpc/reload_schema" \
     -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

#### Issue: RLS policy blocks legitimate access

**Cause:** RLS policy too restrictive

**Solution:**
```sql
-- Check existing policies
SELECT * FROM pg_policies WHERE tablename = 'your_table';

-- Test with specific user
SET ROLE authenticated;
SET request.jwt.claims.sub TO 'user-uuid';
SELECT * FROM your_table;
RESET ROLE;
```

#### Issue: Migration causes performance degradation

**Cause:** Index creation blocking or missing

**Solution:**
```sql
-- ❌ BAD: Blocking index
CREATE INDEX idx_name ON table(column);

-- ✅ GOOD: Non-blocking index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_name ON table(column);
```

#### Issue: Schema drift detected

**Cause:** Manual schema change or missed migration

**Solution:**
```bash
# Generate corrective migration
npx tsx scripts/ops/generate-corrective-migration.ts \
    --env [env] \
    --drift-report reports/drift-report-[timestamp].json

# Review and apply via CI/CD
```

---

## BEST PRACTICES

### Migration Guidelines

1. **Always Be Idempotent**
   - Use `IF NOT EXISTS` / `IF EXISTS`
   - Check before creating/dropping
   - Safe to run multiple times

2. **Index Creation**
   - Use `CONCURRENTLY` to avoid blocking
   - Create indexes during low-traffic periods
   - Monitor index creation progress

3. **RLS Policies**
   - Enable RLS for all user-facing tables
   - Test policies thoroughly
   - Document policy intentions

4. **Breaking Changes**
   - Coordinate with application team
   - Use feature flags if possible
   - Plan for backward compatibility

5. **Documentation**
   - Clear comments in migration
   - Purpose and rationale
   - Rollback instructions
   - Risk level assessment

6. **Testing**
   - Test locally first
   - Verify idempotency
   - Test rollback
   - Check performance impact

---

## REFERENCES

- [Supabase Governance](./SUPABASE_GOVERNANCE.md) - Comprehensive governance model
- [Production Charter](./PRODUCTION_CHARTER.md) - Platform-wide governance
- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli) - Official CLI docs
- [PostgreSQL Documentation](https://www.postgresql.org/docs/) - SQL reference

---

**Document Version:** 1.0.0
**Last Updated:** 2025-01-14
**Next Review:** 2025-04-14
