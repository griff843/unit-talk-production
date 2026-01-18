# Migration Runbook - Fail-Closed CI/CD

**Owner:** Platform Engineering
**Last Updated:** 2026-01-14
**Status:** PRODUCTION READY
**Fail-Closed:** ✅ ENFORCED

---

## Table of Contents

1. [Overview](#overview)
2. [Fail-Closed Enforcement](#fail-closed-enforcement)
3. [Quick Reference](#quick-reference)
4. [Standard Migration Workflow](#standard-migration-workflow)
5. [Rollback Procedures](#rollback-procedures)
6. [Emergency Procedures](#emergency-procedures)
7. [Troubleshooting](#troubleshooting)
8. [Audit Trail](#audit-trail)

---

## Overview

This runbook describes the **fail-closed** Supabase migration system for Unit Talk. All schema changes are Git-driven, automatically enforced, and auditable.

### Key Principles

- ✅ **Git-driven:** All schema changes via `supabase/migrations/`
- ✅ **Fail-closed:** Migration failures **BLOCK** deployments
- ✅ **Automated:** CI applies migrations with retry + verification
- ✅ **Auditable:** Full history in GitHub Actions + `schema_versions` table
- ✅ **Safe:** Automated rollback script generation
- ❌ **No manual SQL Editor** (deprecated for security)

### Fail-Closed Guarantees

When migrations fail, the system **blocks deployment** and **prevents** downstream damage:

| Failure Point | System Behavior | Recovery |
|---------------|-----------------|----------|
| Migration syntax error | ❌ **BLOCKS** - Deploy stops | Fix SQL, re-run |
| Schema verification fails | ❌ **BLOCKS** - Deploy stops | Check migrations, verify tables |
| Smoke tests fail | ❌ **BLOCKS** - Deploy stops | Investigate DB state, rollback if needed |
| Rollback unavailable | ⚠️  **WARNS** - Manual rollback required | Follow manual procedures |

---

## Fail-Closed Enforcement

### Enforcement Mechanisms

The system enforces fail-closed at multiple levels:

#### 1. CI/CD Level (GitHub Actions)

```yaml
# Exit 1 on any failure - blocks workflow
migration_success=false
if supabase db push --include-all; then
  migration_success=true
fi

if [ "$migration_success" != true ]; then
  echo "❌ CRITICAL: Migration FAILED - Deployment BLOCKED"
  exit 1  # Fail-closed: Block deployment
fi
```

#### 2. Schema Verification Level

```bash
# Schema verification MUST pass
if ! npx tsx scripts/ops/verify-schema-post-migration.ts --env dev; then
  echo "❌ CRITICAL: Schema verification FAILED"
  exit 1  # Fail-closed: Block deployment
fi
```

#### 3. Smoke Tests Level

```bash
# Smoke tests MUST pass
if ! npx tsx scripts/ops/smoke-test-db.ts --env dev; then
  echo "❌ CRITICAL: Smoke tests FAILED"
  exit 1  # Fail-closed: Block deployment
fi
```

#### 4. Doctor Script Level

```powershell
# Check migration status in health checks
.\scripts\doctor.ps1 -Environment dev

# Exit code 1 if any FAIL status
if ($script:FailedChecks -gt 0) {
  exit 1  # Fail-closed: Block operations
}
```

### Audit Trail

Every migration is tracked in the `schema_versions` table:

```sql
CREATE TABLE schema_versions (
  id SERIAL PRIMARY KEY,
  version VARCHAR(50) NOT NULL,      -- Git commit SHA (first 8 chars)
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  applied_by VARCHAR(255),           -- GitHub actor
  migrations TEXT,                   -- Comma-separated migration list
  git_commit VARCHAR(50),            -- Full commit SHA
  environment VARCHAR(20)            -- dev/staging/prod
);
```

Query audit trail:
```sql
-- Recent migrations
SELECT version, applied_at, applied_by, environment
FROM schema_versions
ORDER BY applied_at DESC
LIMIT 10;

-- Check current version
SELECT version, applied_at
FROM schema_versions
WHERE environment = 'prod'
ORDER BY applied_at DESC
LIMIT 1;
```

---

## Quick Reference

### Common Operations

| Task | Command/Action |
|------|----------------|
| Apply to dev (auto) | Merge PR to `main` with migration files |
| Apply to staging | Manual dispatch workflow → select "staging" |
| Apply to prod | Manual dispatch workflow → select "prod" + approvals |
| Dry run | Manual dispatch workflow → check "dry run" |
| Check migration status | `.\scripts\doctor.ps1 -Environment dev` |
| Verify schema | `npx tsx scripts/ops/verify-schema-post-migration.ts --env=dev` |
| Run smoke tests | `npx tsx scripts/ops/smoke-test-db.ts --env=dev` |
| Emergency rollback | See [Rollback Procedures](#rollback-procedures) |

### Workflow Files

- **Enhanced CI:** `.github/workflows/supabase-migrate-enhanced.yml`
- **Original CI:** `.github/workflows/supabase-migrate.yml`
- **Ops Runner:** `.github/workflows/ops-run.yml`

---

## Standard Migration Workflow

### 1. Create Migration File

```bash
# Naming convention: YYYYMMDD_description.sql
cd supabase/migrations
touch $(date +%Y%m%d)_add_feature_xyz.sql
```

**Migration Template (Idempotent):**

```sql
-- Migration: Add feature XYZ
-- Date: 2026-01-14
-- Author: Platform Team
-- Ticket: UNIT-1234
-- Rollback: See rollback_20260114_add_feature_xyz.sql

BEGIN;

-- Idempotent column addition
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'picks' AND column_name = 'feature_xyz'
  ) THEN
    ALTER TABLE picks ADD COLUMN feature_xyz TEXT;
    COMMENT ON COLUMN picks.feature_xyz IS 'Feature XYZ data';
  END IF;
END $$;

-- Idempotent index creation
CREATE INDEX IF NOT EXISTS idx_picks_feature_xyz ON picks(feature_xyz);

-- Reload PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
```

**Migration Rules:**

- ✅ **Must be idempotent** (safe to run multiple times)
- ✅ Use `IF NOT EXISTS` for CREATE statements
- ✅ Use `DO $$ BEGIN ... END $$` for conditional ALTER
- ✅ Include `SELECT pg_notify('pgrst', 'reload schema');`
- ✅ Wrap in transaction (BEGIN/COMMIT)
- ✅ Add rollback reference in header
- ❌ Never DROP tables/columns in production
- ❌ Never DELETE/TRUNCATE without WHERE clause
- ❌ Never use reserved words as identifiers

### 2. Create Rollback Migration (Parallel)

```bash
# Create rollback migration immediately
touch supabase/migrations/rollback_$(date +%Y%m%d)_add_feature_xyz.sql
```

**Rollback Template:**

```sql
-- ROLLBACK Migration: Add feature XYZ
-- Date: 2026-01-14
-- Original: 20260114_add_feature_xyz.sql
-- WARNING: This removes data - BACKUP FIRST

BEGIN;

-- Drop index
DROP INDEX IF EXISTS idx_picks_feature_xyz;

-- Remove column (WARNING: Data loss!)
-- ALTER TABLE picks DROP COLUMN IF EXISTS feature_xyz;
-- Uncomment above only after backing up data

-- Reload PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
```

### 3. Test Locally (Recommended)

```bash
# Link to dev project (first time)
export SUPABASE_ACCESS_TOKEN=sbp_your_token_here
supabase link --project-ref your-project-ref

# Dry run
supabase db push --dry-run

# Apply to local dev
supabase db push
```

### 4. Run Pre-Commit Checks

```bash
# Validate SQL syntax
cat supabase/migrations/20260114_add_feature_xyz.sql | grep -i "BEGIN\|COMMIT"

# Check for breaking changes
cat supabase/migrations/20260114_add_feature_xyz.sql | grep -iE "DROP|TRUNCATE|DELETE"

# Verify naming convention
ls supabase/migrations/*.sql | tail -1
```

### 5. Create Pull Request

```bash
git checkout -b feat/add-feature-xyz
git add supabase/migrations/20260114_add_feature_xyz.sql
git add supabase/migrations/rollback_20260114_add_feature_xyz.sql
git commit -m "feat(db): add feature XYZ to picks table

- Add feature_xyz column to picks
- Add index for performance
- Include rollback migration
- Idempotent and safe to rerun

UNIT-1234"
git push origin feat/add-feature-xyz
```

**PR Checklist:**

- [ ] Migration follows naming convention: `YYYYMMDD_description.sql`
- [ ] Migration is idempotent (safe to run multiple times)
- [ ] Rollback migration created: `rollback_YYYYMMDD_description.sql`
- [ ] No breaking changes (DROP, TRUNCATE) in production migrations
- [ ] Tested locally with `supabase db push --dry-run`
- [ ] Includes `SELECT pg_notify('pgrst', 'reload schema');`
- [ ] Wrapped in transaction (BEGIN/COMMIT)
- [ ] Comment explains purpose and rollback reference

### 6. CI/CD Execution (Automatic)

**Dev Environment (Auto):**
1. Merge PR to `main`
2. CI detects migration files
3. Runs pre-flight checks (naming, conflicts, dependencies)
4. Applies migrations with retry (3 attempts)
5. Verifies schema integrity
6. Records schema version in `schema_versions`
7. Runs smoke tests
8. Generates rollback script
9. Uploads artifacts

**Staging/Prod (Manual Dispatch):**
1. Go to Actions → "Supabase Migrations CI/CD (Enhanced)"
2. Click "Run workflow"
3. Select environment (staging/prod)
4. Optional: Check "dry run" for preview
5. Click "Run workflow"
6. **Requires manual approval** for staging/prod
7. Same steps as dev, plus Discord notifications

### 7. Verify Migration Success

```bash
# Run doctor script
.\scripts\doctor.ps1 -Environment dev

# Check schema version
npx tsx scripts/ops/supabase-query.ts --env dev \
  "SELECT version, applied_at, applied_by FROM schema_versions ORDER BY applied_at DESC LIMIT 1"

# Verify schema
npx tsx scripts/ops/verify-schema-post-migration.ts --env dev

# Run smoke tests
npx tsx scripts/ops/smoke-test-db.ts --env dev
```

---

## Rollback Procedures

### When to Rollback

Rollback when:
- ✅ Migration causes data corruption
- ✅ Migration breaks critical functionality
- ✅ Migration causes severe performance degradation
- ✅ Migration applied to wrong environment
- ❌ Minor bugs (fix forward instead)
- ❌ Non-critical issues (fix forward instead)

### Rollback Options

#### Option 1: Automated Rollback (Recommended)

**Prerequisites:**
- Rollback migration exists: `rollback_YYYYMMDD_description.sql`
- Database backup verified

**Steps:**

```bash
# 1. Download rollback script from CI artifacts
# Go to Actions → Failed workflow → Artifacts → Download rollback script

# 2. Review rollback script
cat rollback-<version>.sh

# 3. Create PR with rollback migration
git checkout -b hotfix/rollback-feature-xyz
cp supabase/migrations/rollback_20260114_add_feature_xyz.sql \
   supabase/migrations/20260114_rollback_feature_xyz.sql
git add supabase/migrations/20260114_rollback_feature_xyz.sql
git commit -m "hotfix(db): rollback feature XYZ migration"
git push origin hotfix/rollback-feature-xyz

# 4. Merge to main (auto-applies to dev)
# 5. Manually dispatch to staging/prod if needed
```

#### Option 2: Manual Rollback (Emergency)

**WARNING:** Only use in emergencies when automated rollback is not available.

```bash
# 1. Create database backup FIRST
npx tsx scripts/ops/supabase-query.ts --env prod \
  "SELECT pg_dump('backup_before_rollback_$(date +%Y%m%d)')"

# 2. Connect to Supabase
export SUPABASE_ACCESS_TOKEN=sbp_your_token
supabase link --project-ref your-project-ref-prod

# 3. Review rollback SQL
cat supabase/migrations/rollback_20260114_add_feature_xyz.sql

# 4. Apply rollback manually
psql "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres" \
  < supabase/migrations/rollback_20260114_add_feature_xyz.sql

# 5. Verify rollback
npx tsx scripts/ops/verify-schema-post-migration.ts --env prod
npx tsx scripts/ops/smoke-test-db.ts --env prod

# 6. Record rollback in schema_versions
npx tsx scripts/ops/supabase-query.ts --env prod <<SQL
INSERT INTO schema_versions (version, applied_by, migrations, git_commit, environment)
VALUES (
  'rollback-$(date +%Y%m%d)',
  'manual-$(whoami)',
  'rollback_20260114_add_feature_xyz.sql',
  'manual',
  'prod'
);
SQL
```

#### Option 3: Point-in-Time Recovery (Last Resort)

**WARNING:** Use only when rollback migrations fail and data corruption is severe.

```bash
# 1. Contact Supabase support immediately
# 2. Request point-in-time recovery to timestamp BEFORE migration
# 3. Verify data integrity after restore
# 4. Update schema_versions table manually
```

### Post-Rollback Steps

1. **Verify System Health:**
   ```bash
   .\scripts\doctor.ps1 -Environment prod
   npx tsx scripts/ops/smoke-test-db.ts --env prod --comprehensive
   ```

2. **Document Incident:**
   - Create incident report in `docs/incidents/`
   - Document root cause
   - Document rollback steps taken
   - Document prevention measures

3. **Update Schema Version:**
   ```sql
   -- Mark schema version as rolled back
   UPDATE schema_versions
   SET migrations = migrations || ' (ROLLED BACK)'
   WHERE version = '<rolled-back-version>'
   AND environment = 'prod';
   ```

4. **Notify Stakeholders:**
   - Post in Discord #releases channel
   - Update status page if customer-facing
   - Create post-mortem document

---

## Emergency Procedures

### Migration Stuck/Hanging

**Symptoms:** Migration running >15 minutes

**Steps:**

```bash
# 1. Check active queries
npx tsx scripts/ops/supabase-query.ts --env prod \
  "SELECT pid, now() - query_start as duration, query
   FROM pg_stat_activity
   WHERE state = 'active'
   ORDER BY duration DESC"

# 2. Identify stuck migration query
# Look for queries with long duration

# 3. Cancel query (if safe)
npx tsx scripts/ops/supabase-query.ts --env prod \
  "SELECT pg_cancel_backend(<pid>)"

# 4. If cancellation fails, terminate (DANGER)
# npx tsx scripts/ops/supabase-query.ts --env prod \
#   "SELECT pg_terminate_backend(<pid>)"

# 5. Investigate root cause
# - Locking issues?
# - Large table scan?
# - Missing index?
```

### Migration Applied to Wrong Environment

**Symptoms:** Production migration applied to dev, or vice versa

**Steps:**

```bash
# 1. STOP - Do not panic deploy to "fix"
# 2. Assess damage
.\scripts\doctor.ps1 -Environment <wrong-env>

# 3. If wrong env is dev:
#    - No immediate action needed
#    - Fix will come naturally on next dev deploy

# 4. If wrong env is prod:
#    - Immediate rollback required
#    - Follow "Manual Rollback" procedures
#    - Create incident report

# 5. Verify correct environment before re-applying
echo $SUPABASE_PROJECT_REF_PROD
# Should match intended environment
```

### Schema Verification Fails After Migration

**Symptoms:** Migration succeeds but schema verification fails

**Steps:**

```bash
# 1. Run verbose verification
npx tsx scripts/ops/verify-schema-post-migration.ts --env prod

# 2. Check for missing tables
npx tsx scripts/ops/supabase-query.ts --env prod \
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"

# 3. Check for missing columns
npx tsx scripts/ops/supabase-query.ts --env prod \
  "SELECT table_name, column_name FROM information_schema.columns
   WHERE table_schema = 'public'
   ORDER BY table_name, ordinal_position"

# 4. If critical tables missing:
#    - Immediate rollback required
#    - Follow rollback procedures

# 5. If non-critical mismatches:
#    - Document in incident report
#    - Plan fix-forward migration
```

### PostgREST Schema Cache Not Updating

**Symptoms:** API returns old schema, new columns not visible

**Steps:**

```bash
# 1. Manual schema reload
curl -X POST "$SUPABASE_URL/rest/v1/rpc/reload_schema" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# 2. If reload_schema RPC doesn't exist, create it:
npx tsx scripts/ops/supabase-query.ts --env prod <<SQL
CREATE OR REPLACE FUNCTION reload_schema()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pg_notify('pgrst', 'reload schema');
$$;
SQL

# 3. Retry reload
curl -X POST "$SUPABASE_URL/rest/v1/rpc/reload_schema" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# 4. If still failing, restart PostgREST (contact Supabase support)
```

---

## Troubleshooting

### Common Issues

#### Issue: "Migration file not following naming convention"

**Error:**
```
❌ Invalid migration filename: add_feature.sql
   Expected format: YYYYMMDD_description.sql
```

**Solution:**
```bash
# Rename file to follow convention
mv supabase/migrations/add_feature.sql \
   supabase/migrations/$(date +%Y%m%d)_add_feature.sql
```

#### Issue: "Duplicate migration timestamps"

**Error:**
```
❌ Found duplicate migration timestamps:
   20260114
```

**Solution:**
```bash
# One migration per day, or use HHMMSS suffix
mv supabase/migrations/20260114_feature_b.sql \
   supabase/migrations/20260114_120000_feature_b.sql
```

#### Issue: "Migration syntax error"

**Error:**
```
ERROR:  syntax error at or near "ALTR"
LINE 5:   ALTR TABLE picks ADD COLUMN feature_xyz TEXT;
```

**Solution:**
```bash
# Fix typo in migration file
sed -i 's/ALTR/ALTER/g' supabase/migrations/20260114_add_feature.sql

# Test locally first
supabase db push --dry-run
```

#### Issue: "schema_versions table not found"

**Warning:**
```
⚠️  Version tracking not enabled
```

**Solution:**
```bash
# Create schema_versions table
npx tsx scripts/ops/supabase-query.ts --env dev <<SQL
CREATE TABLE IF NOT EXISTS schema_versions (
  id SERIAL PRIMARY KEY,
  version VARCHAR(50) NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  applied_by VARCHAR(255),
  migrations TEXT,
  git_commit VARCHAR(50),
  environment VARCHAR(20)
);

CREATE INDEX IF NOT EXISTS idx_schema_versions_env_applied
  ON schema_versions(environment, applied_at DESC);
SQL
```

#### Issue: "Local and remote migrations out of sync"

**Warning:**
```
⚠️  Local and remote migrations may be out of sync
```

**Solution:**
```bash
# Pull latest from main
git checkout main
git pull origin main

# Verify local migrations match remote
.\scripts\doctor.ps1 -Environment dev

# If still out of sync, check schema_versions
npx tsx scripts/ops/supabase-query.ts --env dev \
  "SELECT migrations FROM schema_versions WHERE environment = 'dev' ORDER BY applied_at DESC LIMIT 1"
```

### Debug Commands

```bash
# Check migration status
.\scripts\doctor.ps1 -Environment dev -Verbose

# List all migrations
ls -la supabase/migrations/*.sql

# Check schema version
npx tsx scripts/ops/supabase-query.ts --env dev \
  "SELECT * FROM schema_versions ORDER BY applied_at DESC LIMIT 5"

# Verify all tables exist
npx tsx scripts/ops/verify-schema-post-migration.ts --env dev

# Run comprehensive smoke tests
npx tsx scripts/ops/smoke-test-db.ts --env dev --comprehensive

# Check for pending migrations
git diff main..HEAD -- supabase/migrations/

# Validate migration SQL
cat supabase/migrations/20260114_add_feature.sql | grep -E "BEGIN|COMMIT|IF NOT EXISTS"
```

---

## Audit Trail

### Querying Migration History

```sql
-- All migrations in last 30 days
SELECT version, applied_at, applied_by, environment, migrations
FROM schema_versions
WHERE applied_at > NOW() - INTERVAL '30 days'
ORDER BY applied_at DESC;

-- Migrations by environment
SELECT environment, COUNT(*) as migration_count, MAX(applied_at) as last_migration
FROM schema_versions
GROUP BY environment;

-- Migrations by actor
SELECT applied_by, COUNT(*) as migrations_applied
FROM schema_versions
GROUP BY applied_by
ORDER BY migrations_applied DESC;

-- Find specific migration
SELECT *
FROM schema_versions
WHERE migrations LIKE '%20260114_add_feature%';

-- Check rollbacks
SELECT *
FROM schema_versions
WHERE migrations LIKE '%ROLLED BACK%'
OR migrations LIKE '%rollback%';
```

### GitHub Actions Audit

```bash
# View recent workflow runs
gh run list --workflow=supabase-migrate-enhanced.yml --limit 20

# View specific run details
gh run view <run-id>

# Download artifacts from specific run
gh run download <run-id> --name migration-dev-<version>

# View logs for failed run
gh run view <run-id> --log-failed
```

### Doctor Script Audit

```powershell
# Run doctor with JSON output for logging
.\scripts\doctor.ps1 -Environment prod -OutputFormat json > doctor-audit-$(Get-Date -Format 'yyyyMMdd-HHmmss').json

# Schedule daily audits
# Windows: Create scheduled task to run doctor.ps1 daily
# Linux: Add to crontab
```

---

## Best Practices

### Migration Development

1. **Always create rollback migrations** alongside forward migrations
2. **Test locally first** using `supabase db push --dry-run`
3. **Use transactions** (BEGIN/COMMIT) for atomic operations
4. **Make migrations idempotent** - safe to run multiple times
5. **Avoid breaking changes** - use additive migrations when possible
6. **Document purpose** in migration file header
7. **Reference ticket numbers** for traceability

### Production Deployment

1. **Always deploy to dev first** - verify before staging/prod
2. **Use dry run** for high-risk migrations
3. **Schedule migrations** during low-traffic periods
4. **Monitor closely** during and after migration
5. **Have rollback ready** before deploying
6. **Communicate** with team before production migrations
7. **Test rollback** in staging before production

### Rollback Strategy

1. **Create rollback migrations immediately** when creating forward migrations
2. **Test rollback locally** before production
3. **Document data loss** in rollback migration comments
4. **Backup production** before risky migrations
5. **Prefer fix-forward** for minor issues vs. rollback
6. **Practice rollbacks** in staging regularly

---

## Support

### Escalation Path

1. **Check this runbook** for common issues
2. **Run doctor script:** `.\scripts\doctor.ps1 -Environment prod -Verbose`
3. **Check GitHub Actions logs** for CI/CD failures
4. **Contact Platform Engineering** in #platform-eng Slack
5. **Escalate to Supabase Support** for infrastructure issues

### Key Contacts

- **Platform Engineering Lead:** See #platform-eng channel
- **Database Admin:** See #database-ops channel
- **Supabase Support:** support@supabase.com or dashboard
- **Emergency:** Follow incident response playbook

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-14 | 1.0.0 | Initial fail-closed migration runbook | Platform Engineering |

---

**Remember:** Migrations are permanent. When in doubt, ask for review before merging.
