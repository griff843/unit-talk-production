# Supabase Migrations Runbook

**Owner:** Platform Engineering
**Last Updated:** 2025-12-28
**Status:** PRODUCTION READY

---

## Overview

This runbook describes the automated Supabase migration process for Unit Talk production systems. All schema changes to Supabase Cloud are now applied via CI/CD, eliminating manual SQL Editor steps.

**Key Principles:**
- ✅ **Git-driven:** All schema changes via `supabase/migrations/`
- ✅ **Automated:** CI applies migrations on merge to main
- ✅ **Safe:** Dry-run, verification, and rollback capabilities
- ✅ **Auditable:** Full history in GitHub Actions logs
- ❌ **No manual SQL Editor steps** (deprecated)

---

## Quick Reference

| Task | Command |
|------|---------|
| Apply to dev (auto) | Merge PR to `main` with migration files |
| Apply to staging | Manual dispatch → select "staging" |
| Apply to prod | Manual dispatch → select "prod" + approvals |
| Dry run | Manual dispatch → check "dry run" box |
| Verify local | `npx tsx scripts/ops/verify-schema-post-migration.ts --env=dev` |
| Smoke test | `npx tsx scripts/ops/smoke-test-db.ts --env=dev` |

---

## Prerequisites

### Required GitHub Secrets

Configure these in **Settings → Secrets and variables → Actions**:

#### Authentication
```
SUPABASE_ACCESS_TOKEN         # Get from https://supabase.com/dashboard/account/tokens
```

#### Dev Environment
```
SUPABASE_PROJECT_REF_DEV      # e.g., abcdefghijklmnop
SUPABASE_URL_DEV              # https://abcdefghijklmnop.supabase.co
SUPABASE_SERVICE_ROLE_KEY_DEV # service_role key from project settings
```

#### Staging Environment
```
SUPABASE_PROJECT_REF_STAGING
SUPABASE_URL_STAGING
SUPABASE_SERVICE_ROLE_KEY_STAGING
```

#### Production Environment
```
SUPABASE_PROJECT_REF_PROD
SUPABASE_URL_PROD
SUPABASE_SERVICE_ROLE_KEY_PROD
DISCORD_RELEASE_WEBHOOK       # For production notifications
```

### Required GitHub Environment Protection

Configure these in **Settings → Environments**:

- **dev:** No protection (auto-deploy)
- **staging:** Require 1 reviewer
- **production:** Require 2 reviewers + branch protection

---

## Standard Workflow

### 1. Create Migration File

```bash
# Create a new migration file
# Format: YYYYMMDD_HHMMSS_description.sql
cd supabase/migrations
touch 20251228_143000_add_clv_tracking.sql
```

**Migration Template:**
```sql
-- Migration: Add CLV tracking columns
-- Date: 2025-12-28
-- Author: Platform Team
-- Ticket: UNIT-1234

BEGIN;

-- Idempotent: Check if column exists before adding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'picks' AND column_name = 'clv_bps'
  ) THEN
    ALTER TABLE picks ADD COLUMN clv_bps INTEGER;
  END IF;
END $$;

-- Create index (IF NOT EXISTS requires Postgres 9.5+)
CREATE INDEX IF NOT EXISTS idx_picks_clv_bps ON picks(clv_bps);

-- Reload PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
```

**Migration Rules:**
- ✅ Must be idempotent (safe to run multiple times)
- ✅ Use `IF NOT EXISTS` for CREATE statements
- ✅ Use `DO $$ BEGIN ... END $$` for conditional ALTER statements
- ✅ Include `SELECT pg_notify('pgrst', 'reload schema');` at end
- ✅ Wrap in transaction (BEGIN/COMMIT)
- ❌ Never drop tables/columns in production
- ❌ Never include DELETE/TRUNCATE without WHERE clause

### 2. Test Locally (Optional but Recommended)

```bash
# Link to dev project (first time only)
export SUPABASE_ACCESS_TOKEN=sbp_your_token_here
supabase link --project-ref abcdefghijklmnop

# Test migration locally
supabase db push --dry-run

# Apply to local (if using local Supabase)
supabase db push
```

### 3. Create Pull Request

```bash
git checkout -b feat/add-clv-tracking
git add supabase/migrations/20251228_143000_add_clv_tracking.sql
git commit -m "feat(db): add CLV tracking columns to picks table"
git push origin feat/add-clv-tracking
```

**PR Checklist:**
- [ ] Migration file follows naming convention
- [ ] Migration is idempotent
- [ ] Includes schema reload notification
- [ ] Tested locally or reviewed by DBA
- [ ] PR description explains what/why

### 4. Merge to Main (Auto-Deploy to Dev)

When PR is merged to `main`:
1. CI detects migration files in `supabase/migrations/`
2. Runs migration plan (shows what will be applied)
3. Applies to **dev** environment automatically
4. Verifies schema (checks tables exist)
5. Runs smoke tests
6. Reports success/failure

**Monitor Progress:**
- Go to **Actions** tab in GitHub
- Find "Supabase Migrations CI/CD" workflow
- Click on the latest run

### 5. Deploy to Staging (Manual)

**Steps:**
1. Go to **Actions** → **Supabase Migrations CI/CD**
2. Click "Run workflow"
3. Select:
   - Branch: `main`
   - Environment: `staging`
   - Dry run: `false`
4. Click "Run workflow"
5. Wait for reviewer approval (if configured)
6. Monitor logs

### 6. Deploy to Production (Manual with Approvals)

**Prerequisites:**
- ✅ Migration tested in dev
- ✅ Migration tested in staging
- ✅ Two approvers available
- ✅ Scheduled during maintenance window (if needed)

**Steps:**
1. Go to **Actions** → **Supabase Migrations CI/CD**
2. Click "Run workflow"
3. Select:
   - Branch: `main`
   - Environment: `prod`
   - Dry run: `false`
4. Click "Run workflow"
5. **Wait for 2 approvals** (GitHub will block until approved)
6. Monitor logs
7. Verify Discord notification

---

## Advanced Operations

### Dry Run (Preview Changes)

Use dry run to preview what will be applied **without making changes**:

```bash
# Via GitHub Actions
Actions → Supabase Migrations CI/CD → Run workflow
  Environment: staging
  Dry run: ✅ true
```

**Output:** Shows migration plan and SQL content (no actual apply)

### Emergency Rollback

If a migration causes issues:

**Option 1: Rollback via New Migration (Preferred)**

Create a new migration that reverses changes:

```sql
-- Migration: Rollback CLV tracking columns
-- Date: 2025-12-28
-- Author: Platform Team

BEGIN;

-- Remove column if exists
ALTER TABLE picks DROP COLUMN IF EXISTS clv_bps;

-- Drop index if exists
DROP INDEX IF EXISTS idx_picks_clv_bps;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
```

**Option 2: Manual Rollback (Emergency Only)**

If new migration deployment would take too long:

1. Go to Supabase Dashboard → SQL Editor
2. Write and execute rollback SQL
3. Run schema reload: `SELECT pg_notify('pgrst', 'reload schema');`
4. **Immediately create reverse migration** to keep Git in sync

### Verify Migration Applied

```bash
# Check schema
npx tsx scripts/ops/verify-schema-post-migration.ts --env=prod

# Run smoke tests
npx tsx scripts/ops/smoke-test-db.ts --env=prod --comprehensive
```

### Manual Schema Reload

If PostgREST cache is stale:

```bash
# Via Supabase client
curl -X POST "https://abcdefghijklmnop.supabase.co/rest/v1/rpc/reload_schema" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"

# Or via psql
psql "$DATABASE_DIRECT_URL" -c "SELECT pg_notify('pgrst', 'reload schema');"
```

---

## Troubleshooting

### Migration Fails with "relation already exists"

**Cause:** Migration is not idempotent

**Fix:**
```sql
-- Wrong (fails on retry)
CREATE TABLE picks (...);

-- Correct (idempotent)
CREATE TABLE IF NOT EXISTS picks (...);
```

### Migration Fails with "permission denied"

**Cause:** Service role key doesn't have schema permissions

**Fix:**
1. Verify `SUPABASE_SERVICE_ROLE_KEY` secret is correct
2. Check Supabase project settings → Database → Connection pooling
3. Ensure service role has `CREATE` privilege on schema

### Schema Changes Not Visible in API

**Cause:** PostgREST schema cache not reloaded

**Fix:**
1. Verify migration includes `SELECT pg_notify('pgrst', 'reload schema');`
2. Wait 30 seconds for cache refresh
3. Manually reload if needed (see above)

### CI Workflow Not Triggering

**Cause:** No changes detected in `supabase/migrations/`

**Check:**
- Migration files are in correct directory: `supabase/migrations/`
- Files have `.sql` extension
- Committed and pushed to `main` branch

**Manual Trigger:**
Use workflow dispatch to force run

### Retries Exhausted

**Cause:** Network issues or Supabase API timeout

**Fix:**
1. Check Supabase status: https://status.supabase.com
2. Wait 5 minutes and re-run workflow
3. If persistent, check API rate limits

---

## Monitoring & Alerts

### Success Indicators

- ✅ GitHub Actions workflow shows green checkmark
- ✅ Schema verification passes
- ✅ Smoke tests pass
- ✅ Discord notification received (production only)

### Failure Indicators

- ❌ GitHub Actions workflow fails
- ❌ Schema verification reports missing tables
- ❌ Smoke tests fail
- ❌ PostgREST returns 404 for new tables

### Where to Check

1. **GitHub Actions Logs**
   - Actions → Supabase Migrations CI/CD → Latest run
   - Download artifacts for detailed logs

2. **Supabase Dashboard**
   - Logs → Database logs
   - Check for migration errors

3. **Discord Notifications**
   - Production deployments post to release channel
   - Check for failure alerts

---

## Best Practices

### Migration Design

1. **Keep migrations small and focused**
   - One migration = one logical change
   - Easier to review and rollback

2. **Test in dev first**
   - Always apply to dev before staging/prod
   - Catch issues early

3. **Use transactions**
   - Wrap DDL in BEGIN/COMMIT
   - Atomic rollback on error

4. **Add comments**
   - Explain what and why
   - Include ticket/issue number

### Deployment Strategy

1. **Dev → Staging → Production**
   - Never skip environments
   - Staging should mirror production

2. **Schedule production deploys**
   - Off-peak hours if possible
   - Coordinate with ops team

3. **Monitor after deploy**
   - Check logs for 15 minutes post-deploy
   - Run smoke tests
   - Verify API responses

### Rollback Planning

1. **Write rollback migration upfront**
   - Keep in draft, ready to apply
   - Test rollback in dev

2. **Document breaking changes**
   - If migration breaks API compatibility
   - Coordinate with frontend team

3. **Have ops team on standby**
   - For production deploys
   - Ready to execute rollback

---

## Migration Examples

### Add Column (Non-Breaking)

```sql
-- Migration: Add clv_percentage to picks
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'picks' AND column_name = 'clv_percentage'
  ) THEN
    ALTER TABLE picks ADD COLUMN clv_percentage DECIMAL(10, 4);
    COMMENT ON COLUMN picks.clv_percentage IS 'CLV as percentage (e.g., 2.5 = 2.5%)';
  END IF;
END $$;

SELECT pg_notify('pgrst', 'reload schema');
COMMIT;
```

### Add Index for Performance

```sql
-- Migration: Add index for picks by user and status
BEGIN;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_picks_user_status
ON picks(user_id, status)
WHERE status IN ('pending', 'won', 'lost');

SELECT pg_notify('pgrst', 'reload schema');
COMMIT;
```

### Add Table with Foreign Keys

```sql
-- Migration: Add pick_analytics table
BEGIN;

CREATE TABLE IF NOT EXISTS pick_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID NOT NULL REFERENCES picks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  clv_bps INTEGER,
  steam_move_bps INTEGER,
  sharp_percentage DECIMAL(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pick_analytics_pick_id ON pick_analytics(pick_id);
CREATE INDEX IF NOT EXISTS idx_pick_analytics_tenant_id ON pick_analytics(tenant_id);

SELECT pg_notify('pgrst', 'reload schema');
COMMIT;
```

### Rename Column (Breaking Change)

```sql
-- Migration: Rename picks.prop_type to picks.stat_type
-- WARNING: Breaking change - coordinate with API deployment

BEGIN;

-- Check if old column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'picks' AND column_name = 'prop_type'
  ) THEN
    -- Rename column
    ALTER TABLE picks RENAME COLUMN prop_type TO stat_type;
  END IF;
END $$;

SELECT pg_notify('pgrst', 'reload schema');
COMMIT;
```

---

## Emergency Contacts

| Role | Contact | When to Escalate |
|------|---------|------------------|
| Platform Lead | @platform-lead | Migration fails in production |
| DBA | @dba-team | Schema corruption or data loss |
| DevOps | @devops | CI/CD pipeline issues |
| On-Call | PagerDuty | Production outage due to migration |

---

## Appendix

### Useful SQL Queries

**List all tables:**
```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Check table structure:**
```sql
\d+ picks
```

**Find recent migrations:**
```sql
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 10;
```

**Count rows in all tables:**
```sql
SELECT
  schemaname,
  tablename,
  n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
```

### CI/CD Workflow File

**Location:** `.github/workflows/supabase-migrate.yml`

**Triggers:**
- Push to `main` with changes in `supabase/migrations/`
- Manual workflow dispatch

**Environments:**
- `dev` (auto)
- `staging` (manual)
- `production` (manual + approvals)

### Related Documentation

- [Supabase CI Migrations Audit](./SUPABASE_CI_MIGRATIONS_AUDIT.md)
- [Production Charter](../PRODUCTION_CHARTER.md)
- [Safe SQL Querying Guide](./SAFE_SQL_QUERYING.md)
