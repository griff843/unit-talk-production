# ACCESS CONTROL MATRIX

> **Purpose:** Quick reference for role-based access control across Unit Talk Platform database operations.

**Version:** 1.0.0
**Last Updated:** 2025-01-14
**Related:** [Supabase Governance](./SUPABASE_GOVERNANCE.md) | [Migration Flow](./MIGRATION_FLOW.md)

---

## QUICK REFERENCE

### Access by Role

| Operation | Developer | Tech Lead | CTO | Claude AI | CI/CD | Monitoring |
|-----------|-----------|-----------|-----|-----------|-------|------------|
| **Local Dev (Docker)** |
| Read/Write Local Postgres | ✅ Full | ✅ Full | ✅ Full | ✅ Read-Only | ❌ No | ✅ Read-Only |
| Modify Docker Compose | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Supabase Dev** |
| Read Queries | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Write Queries | ❌ No | ❌ No | ❌ No | ❌ No | ✅ CI Only | ❌ No |
| Apply Migrations | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Auto | ❌ No |
| Trigger CI/CD | ✅ Via PR | ✅ Yes | ✅ Yes | ❌ No | N/A | ❌ No |
| **Supabase Staging** |
| Read Queries | ❌ No | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |
| Write Queries | ❌ No | ❌ No | ❌ No | ❌ No | ✅ CI Only | ❌ No |
| Apply Migrations | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Manual | ❌ No |
| Trigger Deployment | ❌ No | ✅ Yes | ✅ Yes | ❌ No | N/A | ❌ No |
| **Supabase Production** |
| Read Queries | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Write Queries | ❌ No | ❌ No | ❌ No | ❌ No | ✅ CI Only | ❌ No |
| Apply Migrations | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Approved | ❌ No |
| Trigger Deployment | ❌ No | ✅ Yes | ✅ Yes | ❌ No | N/A | ❌ No |
| Approve Deployment | ❌ No | ✅ Yes (1 of 2) | ✅ Yes (1 of 2) | ❌ No | N/A | ❌ No |
| Emergency Access | ❌ No | ✅ Justified | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Repository** |
| Read Code | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Create Migration Files | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| Merge to Main | ❌ No | ✅ Approved | ✅ Approved | ❌ No | ❌ No | ❌ No |
| Override Branch Protection | ❌ No | ❌ No | ✅ Emergency | ❌ No | ❌ No | ❌ No |

---

## DETAILED ROLE DEFINITIONS

### 1. Developer Role

**Purpose:** Day-to-day development and feature implementation

**Allowed:**
- ✅ Full access to local Docker Postgres
- ✅ Create migration files (via PR)
- ✅ Read queries against Supabase Dev (via safe query runner)
- ✅ Create pull requests
- ✅ Review code
- ✅ Execute local tests
- ✅ Run local development servers

**Prohibited:**
- ❌ Direct write to any Supabase environment
- ❌ Apply migrations (CI/CD only)
- ❌ Access production credentials
- ❌ Merge to main branch
- ❌ Override branch protection
- ❌ Trigger production deployments
- ❌ Access service role keys

**Credentials:**
```bash
# Local Docker Postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/unit_talk_dev

# Supabase Dev Read-Only
SUPABASE_READONLY_DATABASE_URL_DEV=[provided by tech lead]
```

**Commands:**
```bash
# Start local development
./dev.sh start

# Query Supabase Dev safely
npx tsx scripts/ops/supabase-query.ts --env dev "SELECT * FROM picks LIMIT 10"

# Create migration
npx tsx scripts/ops/create-migration.ts "add_new_feature"

# Test migration locally
docker-compose exec postgres psql -U postgres -d unit_talk_dev -f supabase/migrations/[file].sql

# Create PR
git checkout -b migration/add-new-feature
git add supabase/migrations/
git commit -m "feat(db): add new feature"
git push origin migration/add-new-feature
gh pr create
```

### 2. Tech Lead Role

**Purpose:** Code review, deployment coordination, staging/prod oversight

**Allowed:**
- ✅ Everything Developer can do
- ✅ Approve pull requests
- ✅ Merge to main (after reviews)
- ✅ Read queries against all environments
- ✅ Trigger staging deployments
- ✅ Trigger production deployments (requires additional approval)
- ✅ Approve production deployments (1 of 2 required)
- ✅ Emergency access to production (justified, logged)
- ✅ Review audit logs

**Prohibited:**
- ❌ Direct write to Supabase environments (use CI/CD)
- ❌ Bypass CI/CD pipeline
- ❌ Override branch protection alone
- ❌ Access service role keys (stored in GitHub Secrets only)

**Credentials:**
```bash
# All Developer credentials plus:

# Supabase Staging Read-Only
SUPABASE_READONLY_DATABASE_URL_STAGING=[secure credential]

# Supabase Production Read-Only
SUPABASE_READONLY_DATABASE_URL_PROD=[secure credential]

# Direct Database URLs (emergency use only)
DATABASE_DIRECT_URL_DEV=[secure credential]
DATABASE_DIRECT_URL_STAGING=[secure credential]
DATABASE_DIRECT_URL_PROD=[secure credential, justified use only]
```

**Commands:**
```bash
# Query production safely
npx tsx scripts/ops/supabase-query.ts --env prod --output json "
    SELECT COUNT(*) FROM picks WHERE created_at > NOW() - INTERVAL '24 hours'
"

# Trigger staging deployment
gh workflow run supabase-migrate.yml --field environment=staging

# Trigger production deployment
gh workflow run supabase-migrate.yml --field environment=prod
# (Requires additional approval from CTO)

# Emergency production access (JUSTIFIED ONLY)
psql "$DATABASE_DIRECT_URL_PROD"
# ⚠️  All queries logged and audited
```

### 3. CTO Role

**Purpose:** Final authority, production oversight, emergency response

**Allowed:**
- ✅ Everything Tech Lead can do
- ✅ Approve production deployments (1 of 2 required)
- ✅ Emergency access to all environments
- ✅ Override branch protection (emergency only)
- ✅ Rotate credentials
- ✅ Modify CI/CD configuration
- ✅ Access GitHub Secrets (limited to authorized personnel)
- ✅ Review all audit logs
- ✅ Authorize emergency schema changes

**Prohibited:**
- ❌ Bypass governance without documentation
- ❌ Direct schema changes without migration files

**Credentials:**
```bash
# Full credential set including:

# GitHub Personal Access Token (for CLI operations)
GITHUB_TOKEN=[PAT with repo and workflow scopes]

# All read-only credentials
# All direct database URLs
# (Service role keys remain in GitHub Secrets only)
```

**Commands:**
```bash
# Approve production deployment (via GitHub UI or CLI)
gh run approve [run-id]

# Emergency override (emergency only, documented)
gh pr merge [pr-number] --admin --bypass

# Review audit logs
npx tsx scripts/ops/review-audit-logs.ts --env prod --since 24h

# Rotate credentials
npx tsx scripts/ops/rotate-credentials.ts --env prod --credential-type readonly
```

### 4. Claude AI Role

**Purpose:** Safe code generation, migration creation, query assistance

**Allowed:**
- ✅ Read queries against Dev environment
- ✅ Read queries against Production (for monitoring/debugging)
- ✅ Generate migration files (via PR)
- ✅ Schema exploration (information_schema queries)
- ✅ Suggest optimizations
- ✅ Create rollback plans
- ✅ Generate validation tests
- ✅ Detect schema drift

**Prohibited:**
- ❌ Execute write operations (INSERT/UPDATE/DELETE)
- ❌ Apply migrations (CI/CD only)
- ❌ Access service role keys
- ❌ Modify schema directly (CREATE/ALTER/DROP)
- ❌ Disable RLS policies
- ❌ Create database users
- ❌ Execute against staging without human approval
- ❌ Trigger CI/CD pipelines
- ❌ Merge pull requests

**Credentials:**
```bash
# Claude uses read-only credentials only
SUPABASE_READONLY_DATABASE_URL_DEV=[provided via environment]
SUPABASE_READONLY_DATABASE_URL_PROD=[provided via environment]

# NO ACCESS TO:
# - SUPABASE_SERVICE_ROLE_KEY
# - DATABASE_DIRECT_URL
# - SUPABASE_ACCESS_TOKEN
```

**Commands:**
```bash
# Safe query execution
npx tsx scripts/ops/supabase-query.ts --env dev "SELECT * FROM picks LIMIT 10"

# Schema exploration
npx tsx scripts/ops/supabase-query.ts --env dev "
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
"

# Generate migration (creates file for human review)
npx tsx scripts/ops/create-migration.ts "claude_suggested_optimization"

# Detect drift
npx tsx scripts/ops/detect-schema-drift.ts --env dev

# Production query (read-only monitoring)
npx tsx scripts/ops/supabase-query.ts --env prod --output json "
    SELECT
        status,
        COUNT(*) as count
    FROM picks
    WHERE created_at > NOW() - INTERVAL '1 hour'
    GROUP BY status
"
```

**Safety Guardrails:**
- SQL validation (allowlist/blocklist)
- Automatic credential redaction
- Query timeout (30 seconds)
- Read-only user enforcement (database level)
- Audit logging

**Human-in-Loop Required For:**
- Applying generated migrations
- Executing suggested optimizations
- Triggering deployments
- Emergency operations

### 5. CI/CD (GitHub Actions) Role

**Purpose:** Automated deployment, migration application, verification

**Allowed:**
- ✅ Apply migrations to all environments
- ✅ Read/Write Supabase (via service role key)
- ✅ Execute verification scripts
- ✅ Run smoke tests
- ✅ Reload PostgREST schema
- ✅ Upload artifacts
- ✅ Send notifications
- ✅ Create deployment tags

**Prohibited:**
- ❌ Override approval requirements
- ❌ Skip verification steps
- ❌ Expose secrets in logs
- ❌ Modify repository directly

**Credentials:**
```bash
# Stored in GitHub Secrets (encrypted)
SUPABASE_ACCESS_TOKEN          # Supabase API access
SUPABASE_PROJECT_REF_DEV       # Dev project ID
SUPABASE_PROJECT_REF_STAGING   # Staging project ID
SUPABASE_PROJECT_REF_PROD      # Production project ID

SUPABASE_SERVICE_ROLE_KEY_DEV      # Dev admin access
SUPABASE_SERVICE_ROLE_KEY_STAGING  # Staging admin access
SUPABASE_SERVICE_ROLE_KEY_PROD     # Production admin access

SUPABASE_URL_DEV
SUPABASE_URL_STAGING
SUPABASE_URL_PROD

DISCORD_RELEASE_WEBHOOK        # Notifications
SLACK_WEBHOOK_URL              # Alerts
```

**Workflow Triggers:**
```yaml
# Auto-deploy to dev on main merge
on:
  push:
    branches:
      - main
    paths:
      - 'supabase/migrations/**'

# Manual deploy to staging/prod
on:
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options:
          - dev
          - staging
          - prod
```

### 6. Monitoring Systems Role

**Purpose:** Observability, alerting, performance tracking

**Allowed:**
- ✅ Read queries against all environments
- ✅ Access metrics endpoints
- ✅ Run performance queries
- ✅ Execute analytics queries
- ✅ Generate reports
- ✅ Check schema health

**Prohibited:**
- ❌ Write operations
- ❌ Schema modifications
- ❌ Trigger deployments
- ❌ Access sensitive data (must respect RLS)

**Credentials:**
```bash
# Read-only credentials for all environments
SUPABASE_READONLY_DATABASE_URL_DEV
SUPABASE_READONLY_DATABASE_URL_STAGING
SUPABASE_READONLY_DATABASE_URL_PROD

# Monitoring endpoints
PROMETHEUS_URL=http://prometheus:9090
GRAFANA_URL=http://grafana:3001
TEMPORAL_UI_URL=http://localhost:8088
```

**Common Queries:**
```bash
# Monitor pick ingestion rate
npx tsx scripts/ops/supabase-query.ts --env prod "
    SELECT
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as picks_created
    FROM picks
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY hour
    ORDER BY hour DESC
"

# Check system health
npx tsx scripts/ops/smoke-test-db.ts --env prod

# Detect schema drift
npx tsx scripts/ops/detect-schema-drift.ts --env prod
```

---

## CREDENTIAL TYPES

### Service Role Key (SUPABASE_SERVICE_ROLE_KEY)

**Access Level:** Full administrative access
**RLS Bypass:** Yes
**Purpose:** CI/CD migrations, administrative tasks

**Who Has Access:**
- ✅ CI/CD pipelines (GitHub Secrets)
- ❌ Developers
- ❌ Tech Leads
- ❌ CTO (available in 1Password for emergency)
- ❌ Claude AI
- ❌ Monitoring systems

**Storage:**
- GitHub Secrets (primary)
- 1Password/Vault (backup for emergency)

**Rotation:** Every 90 days

**Usage:**
```bash
# CI/CD only
supabase link --project-ref $SUPABASE_PROJECT_REF_PROD
# Uses SUPABASE_ACCESS_TOKEN and service role key from secrets
```

### Anon Key (SUPABASE_ANON_KEY)

**Access Level:** Public access
**RLS Bypass:** No (subject to RLS policies)
**Purpose:** Frontend applications, public API

**Who Has Access:**
- ✅ Frontend applications (Next.js)
- ✅ Public clients
- ✅ Mobile apps

**Storage:**
- Environment variables
- Client-side code (safe to expose)

**Rotation:** Every 180 days

**Usage:**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

### Read-Only User (readonly_user)

**Access Level:** SELECT only
**RLS Bypass:** No (subject to RLS policies)
**Purpose:** Safe query execution, monitoring, Claude AI

**Who Has Access:**
- ✅ Developers (for dev environment)
- ✅ Tech Lead (all environments)
- ✅ CTO (all environments)
- ✅ Claude AI (dev, prod)
- ✅ Monitoring systems

**Storage:**
- Environment variables (protected)
- 1Password/Vault

**Rotation:** Every 90 days

**Database Setup:**
```sql
-- Create read-only user
CREATE ROLE readonly_user WITH LOGIN PASSWORD '[secure-password]';

-- Grant read access
GRANT CONNECT ON DATABASE postgres TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly_user;

-- Revoke write permissions
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM readonly_user;
REVOKE CREATE ON SCHEMA public FROM readonly_user;
```

**Usage:**
```bash
# Via safe query runner
npx tsx scripts/ops/supabase-query.ts --env prod "SELECT * FROM picks LIMIT 10"

# Direct connection (if needed)
psql "$SUPABASE_READONLY_DATABASE_URL_PROD"
# Only SELECT queries allowed
```

### Direct Database URL

**Access Level:** Full PostgreSQL access
**RLS Bypass:** Yes (depends on user)
**Purpose:** Emergency operations, psql access

**Who Has Access:**
- ❌ Developers
- ✅ Tech Lead (emergency, justified)
- ✅ CTO (emergency)
- ❌ Claude AI
- ❌ CI/CD
- ❌ Monitoring systems

**Storage:**
- 1Password/Vault (secured)

**Rotation:** Every 60 days

**Usage:**
```bash
# Emergency access only (all queries logged)
psql "$DATABASE_DIRECT_URL_PROD"

# Execute emergency SQL
BEGIN;
-- Emergency changes here
COMMIT;

# Immediately create migration to capture change
cat > supabase/migrations/[timestamp]_emergency_fix.sql
```

---

## APPROVAL WORKFLOWS

### Pull Request Approval

**Required Reviewers:** 2+ (for main branch)

**Approval Matrix:**

| Change Type | Developer | Tech Lead | CTO | Required Approvals |
|-------------|-----------|-----------|-----|-------------------|
| Code change | ✅ | ✅ | ✅ | 2 |
| Migration (LOW risk) | ✅ | ✅ | ✅ | 2 |
| Migration (MEDIUM risk) | ❌ | ✅ | ✅ | 1 Tech Lead + 1 other |
| Migration (HIGH risk) | ❌ | ✅ | ✅ | 1 Tech Lead + 1 CTO |
| Migration (CRITICAL risk) | ❌ | ✅ Required | ✅ Required | CTO + Tech Lead |
| Emergency change | ❌ | ✅ | ✅ | CTO |

### Deployment Approval

**Dev Environment:**
- Auto-deploy on main merge
- No approval required

**Staging Environment:**
- Manual workflow dispatch
- Tech Lead approval (1)

**Production Environment:**
- Manual workflow dispatch
- 2+ approvals required:
  - CTO (required)
  - Tech Lead (required)
- 5-minute wait timer (cancellation window)
- Automated backup verification

---

## EMERGENCY PROCEDURES

### When to Declare Emergency

**P0 Incidents:**
- Production database down
- Critical data corruption
- Security breach
- Schema issue blocking all operations

**Who Can Declare:**
- Tech Lead
- CTO
- On-call engineer

### Emergency Access Process

1. **Declare Emergency**
   ```bash
   gh issue create --title "P0: [description]" --label "P0,emergency"
   ```

2. **Get Approval**
   - Tech Lead notifies CTO
   - CTO reviews and approves
   - Emergency documented in issue

3. **Execute Fix**
   ```bash
   # Emergency branch
   git checkout -b emergency/[issue-id]

   # Create emergency migration
   npx tsx scripts/ops/create-migration.ts "emergency_fix_[issue]" --emergency

   # Fast-track CI/CD
   gh workflow run supabase-migrate.yml \
       --ref emergency/[issue-id] \
       --field environment=prod \
       --field emergency=true
   ```

4. **Post-Emergency**
   - Complete incident post-mortem
   - Update runbooks
   - Review access logs
   - Identify root cause

---

## AUDIT LOGGING

### What Gets Logged

**Automatically Logged:**
- All migrations applied (timestamp, user, environment)
- All production queries (via safe query runner)
- All direct database connections (psql)
- All deployment triggers
- All approval actions
- All emergency access

**Audit Log Location:**
```
logs/audit/
├── migrations/
│   ├── 2025-01-14-migration-prod-123.log
│   └── ...
├── queries/
│   ├── 2025-01-14-queries-prod-456.log
│   └── ...
└── access/
    ├── 2025-01-14-emergency-access-789.log
    └── ...
```

### Review Schedule

**Daily:** Automated anomaly detection
**Weekly:** Tech Lead reviews all production access
**Monthly:** CTO reviews comprehensive audit report
**Quarterly:** External security audit

---

## COMPLIANCE CHECKLIST

### Daily Checks

- [ ] Schema drift = 0 across all environments
- [ ] All migrations have rollback plans
- [ ] No service role keys in repository
- [ ] CI/CD pipelines executing successfully
- [ ] Monitoring systems operational

### Weekly Checks

- [ ] Review all production queries (via audit logs)
- [ ] Verify no unauthorized access attempts
- [ ] Check credential rotation schedule
- [ ] Review emergency access logs
- [ ] Validate RLS policies active

### Monthly Checks

- [ ] Rotate credentials approaching expiration
- [ ] Review access control matrix
- [ ] Update documentation
- [ ] Conduct team governance training
- [ ] Generate compliance report

### Quarterly Checks

- [ ] External security audit
- [ ] Penetration testing
- [ ] Review and update policies
- [ ] Validate disaster recovery procedures
- [ ] Update incident response runbooks

---

## QUICK COMMANDS BY ROLE

### Developer

```bash
# Start local dev
./dev.sh start

# Query dev safely
npx tsx scripts/ops/supabase-query.ts --env dev "SELECT * FROM picks LIMIT 10"

# Create migration
npx tsx scripts/ops/create-migration.ts "feature_name"

# Test locally
docker-compose exec postgres psql -U postgres -d unit_talk_dev -f supabase/migrations/[file].sql

# Create PR
gh pr create --title "feat(db): description" --body "..."
```

### Tech Lead

```bash
# Query staging
npx tsx scripts/ops/supabase-query.ts --env staging "SELECT COUNT(*) FROM picks"

# Query production
npx tsx scripts/ops/supabase-query.ts --env prod "SELECT COUNT(*) FROM picks"

# Trigger staging deployment
gh workflow run supabase-migrate.yml --field environment=staging

# Trigger production deployment
gh workflow run supabase-migrate.yml --field environment=prod

# Review audit logs
npx tsx scripts/ops/review-audit-logs.ts --env prod --since 24h
```

### CTO

```bash
# All Tech Lead commands plus:

# Approve production deployment
gh run approve [run-id]

# Emergency override (documented)
gh pr merge [pr-number] --admin --bypass

# Rotate credentials
npx tsx scripts/ops/rotate-credentials.ts --env prod
```

### Claude AI

```bash
# Query dev
npx tsx scripts/ops/supabase-query.ts --env dev "SELECT * FROM picks LIMIT 10"

# Explore schema
npx tsx scripts/ops/supabase-query.ts --env dev "
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
"

# Generate migration (for human review)
npx tsx scripts/ops/create-migration.ts "optimization_suggestion"

# Detect drift
npx tsx scripts/ops/detect-schema-drift.ts --env dev

# Query production (monitoring only)
npx tsx scripts/ops/supabase-query.ts --env prod --output json "
    SELECT status, COUNT(*) FROM picks WHERE created_at > NOW() - INTERVAL '1 hour' GROUP BY status
"
```

---

## REFERENCES

- [Supabase Governance](./SUPABASE_GOVERNANCE.md)
- [Migration Flow](./MIGRATION_FLOW.md)
- [Production Charter](./PRODUCTION_CHARTER.md)

---

**Document Version:** 1.0.0
**Last Updated:** 2025-01-14
**Next Review:** 2025-04-14
