# SUPABASE GOVERNANCE MODEL

> **Purpose:** Establish fail-closed database governance for Unit Talk Platform to eliminate schema drift, prevent unauthorized mutations, and ensure Git is the single source of truth for all Supabase schema changes.

**Version:** 1.0.0
**Last Updated:** 2025-01-14
**Status:** PRODUCTION BINDING

---

## TABLE OF CONTENTS

1. [Governance Principles](#governance-principles)
2. [Audit Findings](#audit-findings)
3. [Schema Authority Model](#schema-authority-model)
4. [Environment Architecture](#environment-architecture)
5. [Access Control Matrix](#access-control-matrix)
6. [Migration Enforcement](#migration-enforcement)
7. [Claude Automation Model](#claude-automation-model)
8. [Drift Detection](#drift-detection)
9. [Emergency Procedures](#emergency-procedures)
10. [Compliance Validation](#compliance-validation)

---

## GOVERNANCE PRINCIPLES

### Core Tenets

1. **Fail-Closed by Default**
   - No operation is permitted unless explicitly allowed
   - All write operations require CI pipeline approval
   - Manual schema changes are blocked at the Supabase level

2. **Git as Single Source of Truth**
   - Repository: `unit-talk-production-main`
   - Branch: `main` (protected, requires PR approval)
   - Schema path: `supabase/migrations/**/*.sql`
   - No schema changes outside version control

3. **Zero-Trust Architecture**
   - Every actor must authenticate (human, bot, CI)
   - Least privilege access enforcement
   - All credentials rotate on 90-day schedule

4. **Observable Everything**
   - All schema changes logged to audit table
   - Drift detection runs every 6 hours
   - Alert on unauthorized changes within 5 minutes

5. **Idempotent Operations**
   - All migrations must be idempotent
   - Failed migrations must not corrupt state
   - Rollback procedures always available

---

## AUDIT FINDINGS

### Current State (Pre-Governance)

✅ **Strengths Identified:**
- Existing CI/CD pipeline (`.github/workflows/supabase-migrate.yml`)
- Safe query runner with SQL validation (`scripts/ops/supabase-query.ts`)
- Environment separation (dev/staging/prod)
- Production Charter established
- Retry logic with exponential backoff
- PostgREST schema reload automation

🚨 **Critical Gaps Identified:**

| Gap ID | Severity | Description | Impact |
|--------|----------|-------------|--------|
| GAP-001 | CRITICAL | No schema drift detection between local Postgres and Supabase | Schema divergence risk |
| GAP-002 | CRITICAL | Multiple conflicting database connection variables | Configuration confusion |
| GAP-003 | HIGH | No pre-commit hooks to prevent accidental schema changes | Human error risk |
| GAP-004 | HIGH | No automated schema comparison after migrations | Silent migration failures |
| GAP-005 | HIGH | No Claude-specific read-only credentials | Over-privileged AI access |
| GAP-006 | HIGH | RLS policies exist but enforcement unclear | Security bypass risk |
| GAP-007 | MEDIUM | No automated rollback mechanism for failed migrations | Manual recovery required |
| GAP-008 | MEDIUM | Unclear separation between local Postgres and Supabase | Developer confusion |
| GAP-009 | MEDIUM | No automated backup verification before production | Data loss risk |
| GAP-010 | LOW | No migration approval workflow (only environment) | Process ambiguity |

### Risk Assessment

- **P0 (Critical)**: GAP-001, GAP-002, GAP-005
- **P1 (High)**: GAP-003, GAP-004, GAP-006
- **P2 (Medium)**: GAP-007, GAP-008, GAP-009
- **P3 (Low)**: GAP-010

---

## SCHEMA AUTHORITY MODEL

### Single Source of Truth

```
Git Repository (main branch)
    ↓
supabase/migrations/**/*.sql
    ↓
GitHub Actions CI/CD
    ↓
Supabase CLI (supabase db push)
    ↓
Remote Supabase Projects (dev → staging → prod)
```

### Repository Structure

```
unit-talk-production-main/
├── supabase/
│   ├── config.toml                    # Supabase CLI configuration
│   ├── migrations/                    # AUTHORITATIVE schema definitions
│   │   ├── 20251020_phase2_core.sql
│   │   ├── 20251101_core_picks.sql
│   │   ├── ...
│   │   └── [timestamp]_[description].sql
│   └── seed.sql                       # Optional test data (dev only)
├── .github/
│   └── workflows/
│       ├── supabase-migrate.yml       # CI/CD for migrations
│       └── schema-drift-check.yml     # Drift detection (NEW)
├── scripts/
│   └── ops/
│       ├── supabase-query.ts          # Read-only query runner
│       ├── verify-schema-post-migration.ts
│       ├── detect-schema-drift.ts     # (NEW)
│       └── rollback-migration.ts      # (NEW)
└── docs/
    ├── SUPABASE_GOVERNANCE.md         # This document
    └── MIGRATION_FLOW.md              # Detailed workflow
```

### Migration File Standards

**Naming Convention:**
```
[YYYYMMDD]_[phase]_[description].sql
```

**Required Elements:**
```sql
-- Migration: [YYYYMMDD]_[description]
-- Purpose: [Brief description of changes]
-- Author: [GitHub username or CI/CD]
-- Date: [YYYY-MM-DD]
-- Risk Level: [LOW|MEDIUM|HIGH|CRITICAL]

BEGIN;

-- Idempotent check
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM ...) THEN
        -- Migration logic here
    END IF;
END $$;

-- Notify PostgREST to reload schema
SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
```

**Validation Checklist:**
- [ ] Idempotent (can run multiple times safely)
- [ ] Includes rollback instructions in comments
- [ ] Creates indexes concurrently where applicable
- [ ] Includes `pg_notify` for PostgREST reload
- [ ] Tested in local Supabase environment
- [ ] No hardcoded secrets or credentials
- [ ] No destructive operations without backup
- [ ] RLS policies included where applicable

---

## ENVIRONMENT ARCHITECTURE

### Environment Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                     Git Repository (main)                    │
│                  Single Source of Truth                      │
└──────────────────┬────────────────────────────────────────┬──┘
                   │                                        │
         ┌─────────▼─────────┐                   ┌─────────▼─────────┐
         │   LOCAL DEV       │                   │     CI/CD          │
         │   (Docker)        │                   │  (GitHub Actions)  │
         │                   │                   │                    │
         │  Postgres:5432    │                   │  Supabase CLI      │
         │  (Isolated)       │                   │                    │
         └───────────────────┘                   └─────────┬──────────┘
                                                           │
                              ┌────────────────────────────┼────────────────────────┐
                              │                            │                        │
                    ┌─────────▼─────────┐      ┌──────────▼──────────┐  ┌─────────▼─────────┐
                    │   SUPABASE DEV    │      │  SUPABASE STAGING   │  │  SUPABASE PROD    │
                    │                   │      │                     │  │                   │
                    │  Auto-Deploy      │      │  Manual Dispatch    │  │  Manual + Approval│
                    │  (on main merge)  │      │  (Requires ENV)     │  │  (Requires ENV)   │
                    └───────────────────┘      └─────────────────────┘  └───────────────────┘
```

### Environment Configuration

#### Local Development (Docker)

**Purpose:** Isolated development without affecting Supabase
**Database:** Local PostgreSQL in Docker (`postgres:15-alpine`)
**Port:** `5432`
**Credentials:** `postgres:postgres`
**Schema Source:** Docker entrypoint migrations (mirror of supabase/migrations)

**Environment Variables:**
```bash
# Local Postgres (Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/unit_talk_dev
POSTGRES_PASSWORD=postgres
POSTGRES_DB=unit_talk_dev
POSTGRES_USER=postgres

# DO NOT SET SUPABASE_* IN LOCAL DEV
# Local development uses Docker Postgres only
```

**Access:**
- **Who:** All developers
- **How:** `./dev.sh start` (Docker Compose)
- **Restrictions:** Completely isolated from Supabase

#### Supabase Dev Environment

**Purpose:** Integration testing with Supabase features (Realtime, Auth, Storage)
**Project Ref:** (stored in GitHub Secrets: `SUPABASE_PROJECT_REF_DEV`)
**Deployment:** Automatic on `main` branch merge
**Schema Source:** CI/CD applies `supabase/migrations/`

**Environment Variables:**
```bash
# Supabase Dev (CI/CD auto-applies)
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]        # Full access (CI only)
SUPABASE_ANON_KEY=[anon-key]                         # Public access
DATABASE_DIRECT_URL=postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# Read-Only URL (for Claude/monitoring)
SUPABASE_READONLY_DATABASE_URL_DEV=postgresql://readonly_user:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Access:**
- **Who:** CI/CD (auto), Developers (read-only)
- **How:** GitHub Actions, `supabase-query.ts --env dev`
- **Restrictions:** No manual schema changes

#### Supabase Staging Environment

**Purpose:** Pre-production validation
**Project Ref:** (stored in GitHub Secrets: `SUPABASE_PROJECT_REF_STAGING`)
**Deployment:** Manual workflow dispatch
**Schema Source:** CI/CD applies `supabase/migrations/`

**Environment Variables:**
```bash
# Supabase Staging (Manual dispatch)
SUPABASE_URL_STAGING=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY_STAGING=[service-role-key]
DATABASE_DIRECT_URL_STAGING=postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# Read-Only URL (for Claude/monitoring)
SUPABASE_READONLY_DATABASE_URL_STAGING=postgresql://readonly_user:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Access:**
- **Who:** CI/CD (manual trigger), Tech Lead (read-only)
- **How:** GitHub Actions workflow dispatch
- **Restrictions:** Requires manual approval

#### Supabase Production Environment

**Purpose:** Live production system
**Project Ref:** (stored in GitHub Secrets: `SUPABASE_PROJECT_REF_PROD`)
**Deployment:** Manual workflow dispatch + GitHub Environment approval
**Schema Source:** CI/CD applies `supabase/migrations/`

**Environment Variables:**
```bash
# Supabase Production (Manual + Approval)
SUPABASE_URL_PROD=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY_PROD=[service-role-key]
DATABASE_DIRECT_URL_PROD=postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# Read-Only URL (for Claude/monitoring)
SUPABASE_READONLY_DATABASE_URL_PROD=postgresql://readonly_user:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Access:**
- **Who:** CI/CD (manual trigger + approval), CTO (read-only)
- **How:** GitHub Actions workflow dispatch with production environment approval
- **Restrictions:** Requires 2+ approvers, automated backup verification

---

## ACCESS CONTROL MATRIX

### Role-Based Access Control (RBAC)

| Role | Local Dev | Supabase Dev | Supabase Staging | Supabase Prod | CI/CD System |
|------|-----------|--------------|------------------|---------------|--------------|
| **Developer** | Full (Docker) | Read-Only | No Access | No Access | No Access |
| **Tech Lead** | Full (Docker) | Read-Only | Read-Only | Read-Only | Trigger Dev/Staging |
| **CTO** | Full (Docker) | Read-Only | Read-Only | Read-Only | Trigger All + Approve Prod |
| **Claude AI** | Read-Only (Docker) | Read-Only | No Access | Read-Only (Query) | No Access |
| **CI/CD (GitHub Actions)** | No Access | Write (Auto) | Write (Manual) | Write (Approval) | Full Control |
| **Monitoring Systems** | Read-Only (Docker) | Read-Only | Read-Only | Read-Only | No Access |

### Credential Types by Role

#### 1. Service Role Key (Full Access)

**Purpose:** Administrative operations, schema changes, RLS bypass
**Who Has Access:** CI/CD pipelines ONLY
**Storage:** GitHub Secrets (encrypted)
**Rotation:** Every 90 days
**Usage:** Migration application, PostgREST reload

**Environment Variables:**
```bash
SUPABASE_SERVICE_ROLE_KEY_DEV     # CI/CD only
SUPABASE_SERVICE_ROLE_KEY_STAGING # CI/CD only
SUPABASE_SERVICE_ROLE_KEY_PROD    # CI/CD only
```

**Restrictions:**
- ❌ Never in local `.env` files
- ❌ Never in application code
- ❌ Never in client-side code
- ❌ Never logged or printed
- ✅ CI/CD workflows only
- ✅ Masked in all outputs

#### 2. Anon Key (Public Access)

**Purpose:** Frontend applications, public API
**Who Has Access:** Frontend apps, public clients
**Storage:** Environment variables, safe to expose
**Rotation:** Every 180 days
**Usage:** Supabase client initialization (frontend)

**Environment Variables:**
```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Safe for client-side
```

**Restrictions:**
- ✅ Can be exposed in client-side code
- ✅ Subject to RLS policies
- ❌ Cannot bypass RLS
- ❌ Cannot modify schema

#### 3. Read-Only User (Query Access)

**Purpose:** Monitoring, analytics, Claude AI queries
**Who Has Access:** Claude AI, monitoring systems, developers
**Storage:** Environment variables (protected)
**Rotation:** Every 90 days
**Usage:** Safe query execution without mutation risk

**Database Setup:**
```sql
-- Create read-only user
CREATE ROLE readonly_user WITH LOGIN PASSWORD '[secure-password]';

-- Grant SELECT on all tables
GRANT CONNECT ON DATABASE postgres TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly_user;

-- Revoke all write permissions
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM readonly_user;
REVOKE CREATE ON SCHEMA public FROM readonly_user;
REVOKE ALL ON DATABASE postgres FROM readonly_user;
GRANT CONNECT ON DATABASE postgres TO readonly_user;
```

**Environment Variables:**
```bash
# Read-only credentials for safe query access
SUPABASE_READONLY_DATABASE_URL_DEV=postgresql://readonly_user:[password]@...
SUPABASE_READONLY_DATABASE_URL_STAGING=postgresql://readonly_user:[password]@...
SUPABASE_READONLY_DATABASE_URL_PROD=postgresql://readonly_user:[password]@...
```

**Restrictions:**
- ✅ SELECT queries only
- ✅ Safe for AI/automation
- ❌ No INSERT/UPDATE/DELETE
- ❌ No schema modifications
- ❌ No function execution (except safe read-only functions)

#### 4. Direct Database URL (Admin Access)

**Purpose:** psql access, database administration
**Who Has Access:** Tech Lead, CTO
**Storage:** Personal secure vaults (1Password, etc.)
**Rotation:** Every 60 days
**Usage:** Emergency operations, manual verification

**Environment Variables:**
```bash
# Direct Postgres access (admin use only)
DATABASE_DIRECT_URL_DEV=postgresql://postgres.[project-ref]:[password]@...
DATABASE_DIRECT_URL_STAGING=postgresql://postgres.[project-ref]:[password]@...
DATABASE_DIRECT_URL_PROD=postgresql://postgres.[project-ref]:[password]@...
```

**Restrictions:**
- ❌ Never in CI/CD
- ❌ Never in application code
- ❌ Emergency use only
- ✅ Requires justification log entry
- ✅ All queries audited

### Access Control Enforcement

#### GitHub Branch Protection

**main branch protection rules:**
- [ ] Require pull request before merging
- [ ] Require 2 approving reviews
- [ ] Require status checks to pass:
  - [ ] TypeScript compilation
  - [ ] Unit tests
  - [ ] Migration dry-run
  - [ ] Schema validation
- [ ] Require branches to be up to date
- [ ] Require signed commits
- [ ] Include administrators in restrictions
- [ ] Allow force pushes: NO
- [ ] Allow deletions: NO

#### GitHub Environment Protection

**dev environment:**
- Auto-deploy on main merge
- No approval required
- Secrets: SUPABASE_PROJECT_REF_DEV, SUPABASE_SERVICE_ROLE_KEY_DEV

**staging environment:**
- Manual dispatch only
- Approval: 1 Tech Lead
- Secrets: SUPABASE_PROJECT_REF_STAGING, SUPABASE_SERVICE_ROLE_KEY_STAGING

**production environment:**
- Manual dispatch only
- Approval: 2+ (CTO + Tech Lead)
- Wait timer: 5 minutes (cancellation window)
- Secrets: SUPABASE_PROJECT_REF_PROD, SUPABASE_SERVICE_ROLE_KEY_PROD

---

## MIGRATION ENFORCEMENT

### Pre-Migration Validation

**Automated Checks (CI/CD):**

1. **Syntax Validation**
   ```bash
   # Check SQL syntax
   supabase db lint
   ```

2. **Idempotency Check**
   ```bash
   # Run migration twice in test environment
   supabase db reset
   supabase db push
   supabase db push  # Should succeed without errors
   ```

3. **Performance Impact**
   ```bash
   # Analyze query plans
   EXPLAIN ANALYZE [migration SQL]
   ```

4. **Breaking Change Detection**
   ```bash
   # Compare schemas
   scripts/ops/detect-breaking-changes.ts
   ```

5. **Rollback Plan Verification**
   ```bash
   # Ensure rollback SQL exists
   test -f supabase/rollback/[timestamp]_rollback.sql
   ```

### Migration Execution Flow

**Standard Path (Non-Breaking Changes):**

```
Developer → PR → Review → Merge to main → Auto-deploy to dev → Manual staging → Manual prod
```

**High-Risk Path (Breaking Changes):**

```
Developer → PR + Migration Plan Doc → Senior Review → Merge to main
    → Dev deploy + verify
    → Staging deploy + 24h soak
    → Prod deploy + approval + backup verification
    → Monitor 1h post-deploy
```

### Post-Migration Validation

**Automated Checks (CI/CD):**

1. **Schema Comparison**
   ```bash
   # Verify schema matches expected state
   npx tsx scripts/ops/verify-schema-post-migration.ts --env [dev|staging|prod]
   ```

2. **Smoke Tests**
   ```bash
   # Basic connectivity and query tests
   npx tsx scripts/ops/smoke-test-db.ts --env [dev|staging|prod]
   ```

3. **PostgREST Reload**
   ```bash
   # Ensure API schema is updated
   curl -X POST "$SUPABASE_URL/rest/v1/rpc/reload_schema" \
        -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
   ```

4. **Drift Detection**
   ```bash
   # Ensure no unexpected changes
   npx tsx scripts/ops/detect-schema-drift.ts --env [dev|staging|prod]
   ```

### Rollback Procedures

**Automatic Rollback Triggers:**
- Migration execution timeout (>5 minutes)
- Schema verification failure
- Smoke test failure
- Performance degradation (>2x baseline)

**Manual Rollback Process:**

1. **Identify rollback migration:**
   ```bash
   # Find corresponding rollback file
   ls supabase/rollback/[timestamp]_rollback.sql
   ```

2. **Execute rollback:**
   ```bash
   # Apply via CI/CD or emergency script
   npx tsx scripts/ops/rollback-migration.ts --env [env] --migration [timestamp]
   ```

3. **Verify restoration:**
   ```bash
   # Run full validation suite
   npx tsx scripts/ops/verify-schema-post-migration.ts --env [env]
   ```

4. **Incident report:**
   - Create GitHub issue with post-mortem
   - Update migration documentation
   - Add to blocked patterns list

---

## CLAUDE AUTOMATION MODEL

### Safe Interaction Patterns

Claude Code can interact with the Unit Talk database safely using these guardrails:

#### 1. Read-Only Query Execution

**Allowed Operations:**
- SELECT queries (with LIMIT enforcement)
- EXPLAIN ANALYZE (query planning)
- Schema introspection (information_schema queries)
- Metric queries (COUNT, SUM, AVG)

**Execution Method:**
```bash
# Use safe query runner
npx tsx scripts/ops/supabase-query.ts --env dev --output table "
  SELECT id, user_id, status
  FROM picks
  WHERE created_at > NOW() - INTERVAL '7 days'
  LIMIT 100
"
```

**Built-in Safeguards:**
- SQL validation (allowlist/blocklist patterns)
- Automatic credential redaction
- Query timeout (30 seconds default)
- Read-only user credentials
- Audit logging

#### 2. Migration Generation

**Allowed Operations:**
- Generate migration SQL files
- Suggest schema improvements
- Create rollback plans
- Write validation tests

**Execution Method:**
```bash
# Claude generates migration file
cat > supabase/migrations/$(date +%Y%m%d)_add_index_picks_user_id.sql << 'EOF'
-- Migration: Add index on picks.user_id
-- Purpose: Improve query performance for user pick lookups
-- Author: claude-code
-- Date: 2025-01-14
-- Risk Level: LOW

BEGIN;

-- Idempotent index creation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_picks_user_id
ON picks(user_id)
WHERE workflow_stage = 'published';

-- Notify PostgREST
SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
EOF
```

**Restrictions:**
- ❌ Cannot execute migrations (CI/CD only)
- ❌ Cannot modify supabase.config.toml
- ❌ Cannot access service role keys
- ✅ Must create PR for review
- ✅ Must include rollback plan
- ✅ Must follow naming conventions

#### 3. Schema Exploration

**Allowed Operations:**
- List tables and columns
- Show indexes and constraints
- Analyze table statistics
- Generate ER diagrams

**Execution Method:**
```bash
# Explore schema safely
npx tsx scripts/ops/supabase-query.ts --env dev --output json "
  SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position
"
```

#### 4. Drift Detection

**Allowed Operations:**
- Compare local vs remote schemas
- Identify missing migrations
- Detect unauthorized changes
- Generate alignment reports

**Execution Method:**
```bash
# Detect schema drift
npx tsx scripts/ops/detect-schema-drift.ts --env dev --report
```

### Prohibited Operations

Claude Code must **NEVER**:

- ❌ Execute write operations (INSERT/UPDATE/DELETE) directly
- ❌ Modify schema without migrations (ALTER/DROP/CREATE)
- ❌ Access service role keys or admin credentials
- ❌ Bypass CI/CD pipeline for schema changes
- ❌ Execute SQL against production without approval
- ❌ Disable RLS policies
- ❌ Create database users or roles
- ❌ Modify security settings
- ❌ Export sensitive data
- ❌ Use database links or file operations

### Emergency Access (Human-in-Loop Required)

If Claude identifies a critical issue requiring immediate action:

1. **Alert human operator:**
   ```
   🚨 CRITICAL ISSUE DETECTED
   Description: [issue description]
   Impact: [production/staging/dev]
   Recommended Action: [action required]

   This requires human approval. Type 'APPROVE' to proceed.
   ```

2. **Wait for human approval**

3. **Execute with human oversight:**
   - Human reviews Claude's proposed SQL
   - Human executes via approved channels
   - Claude provides verification commands

---

## DRIFT DETECTION

### Automated Drift Monitoring

**Schedule:** Every 6 hours (cron: `0 */6 * * *`)

**Detection Script:**
```typescript
// scripts/ops/detect-schema-drift.ts

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
  type: 'table' | 'column' | 'index' | 'constraint' | 'function';
  object: string;
  difference: 'missing' | 'extra' | 'modified';
  expected?: any;
  actual?: any;
}

async function detectDrift(env: string): Promise<DriftReport> {
  // 1. Load expected schema from migrations
  const expectedSchema = await buildSchemaFromMigrations();

  // 2. Query actual schema from Supabase
  const actualSchema = await querySupabaseSchema(env);

  // 3. Compare schemas
  const differences = compareSchemas(expectedSchema, actualSchema);

  // 4. Assess severity
  const severity = assessSeverity(differences);

  // 5. Generate report
  return {
    timestamp: new Date().toISOString(),
    environment: env,
    driftDetected: differences.length > 0,
    differences,
    severity,
  };
}

async function buildSchemaFromMigrations(): Promise<Schema> {
  // Parse all migration files in order
  const migrationFiles = glob.sync('supabase/migrations/*.sql').sort();

  // Build expected schema by applying migrations sequentially
  // (Implementation details...)
}

async function querySupabaseSchema(env: string): Promise<Schema> {
  const supabase = createClient(/* readonly credentials */);

  // Query information_schema for actual state
  // (Implementation details...)
}

function compareSchemas(expected: Schema, actual: Schema): SchemaDifference[] {
  // Deep comparison logic
  // (Implementation details...)
}

function assessSeverity(differences: SchemaDifference[]): 'none' | 'low' | 'medium' | 'high' | 'critical' {
  if (differences.length === 0) return 'none';

  const hasCritical = differences.some(d =>
    d.type === 'table' && d.difference === 'missing'
  );
  if (hasCritical) return 'critical';

  // (Additional severity logic...)
}
```

**GitHub Action:**
```yaml
# .github/workflows/schema-drift-check.yml
name: Schema Drift Detection

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:        # Manual trigger

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
          SUPABASE_URL: ${{ secrets[format('SUPABASE_URL_{0}', matrix.environment)] }}
          SUPABASE_READONLY_KEY: ${{ secrets[format('SUPABASE_READONLY_KEY_{0}', matrix.environment)] }}
        run: |
          npx tsx scripts/ops/detect-schema-drift.ts \
            --env ${{ matrix.environment }} \
            --report \
            --alert-on-drift

      - name: Upload drift report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: drift-report-${{ matrix.environment }}-${{ github.run_number }}
          path: reports/drift-report-*.json

      - name: Alert on critical drift
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: custom
          custom_payload: |
            {
              text: "🚨 CRITICAL SCHEMA DRIFT DETECTED",
              attachments: [{
                color: 'danger',
                text: 'Environment: ${{ matrix.environment }}\nCheck artifacts for details.'
              }]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Drift Resolution Process

**When drift is detected:**

1. **Immediate Alert**
   - Slack/Discord notification
   - Email to on-call engineer
   - GitHub issue created automatically

2. **Investigation**
   - Review drift report
   - Check audit logs
   - Identify root cause

3. **Resolution Paths**

   **Path A: Unauthorized Change (Revert)**
   ```bash
   # Generate corrective migration to restore expected state
   npx tsx scripts/ops/generate-corrective-migration.ts \
     --env [env] \
     --drift-report reports/drift-report-[timestamp].json

   # Apply via CI/CD
   # (Follow standard migration process)
   ```

   **Path B: Legitimate Change (Update Migrations)**
   ```bash
   # Generate migration to capture current state
   npx tsx scripts/ops/capture-current-schema.ts \
     --env [env] \
     --output supabase/migrations/[timestamp]_capture_drift.sql

   # Review, test, and commit
   git add supabase/migrations/[timestamp]_capture_drift.sql
   git commit -m "fix: capture legitimate schema changes from [env]"
   ```

4. **Post-Resolution**
   - Re-run drift detection
   - Confirm no drift remains
   - Update incident log
   - Review access controls

---

## EMERGENCY PROCEDURES

### Emergency Access Protocol

**When immediate schema change is required (production outage):**

1. **Declare Emergency**
   - Create P0 incident in tracking system
   - Notify on-call team
   - Document justification

2. **Emergency Review**
   - CTO or designated authority approves
   - Emergency SQL reviewed by 2+ engineers
   - Rollback plan prepared

3. **Execution Options**

   **Option A: Fast-Track CI/CD (Preferred)**
   ```bash
   # Create emergency branch
   git checkout -b emergency/[incident-id]

   # Add emergency migration
   cat > supabase/migrations/[timestamp]_emergency_[incident].sql

   # Push and trigger emergency workflow
   git push origin emergency/[incident-id]
   gh workflow run supabase-migrate.yml \
     --ref emergency/[incident-id] \
     --field environment=prod \
     --field emergency=true
   ```

   **Option B: Direct Execution (Last Resort)**
   ```bash
   # Connect via psql with direct URL
   psql "$DATABASE_DIRECT_URL_PROD"

   # Execute emergency SQL
   BEGIN;
   [EMERGENCY SQL]
   COMMIT;

   # Immediately create migration to capture change
   cat > supabase/migrations/[timestamp]_emergency_[incident].sql
   git add supabase/migrations/[timestamp]_emergency_[incident].sql
   git commit -m "emergency: [description]"
   git push
   ```

4. **Post-Emergency Actions**
   - Create migration to capture emergency change
   - Run full drift detection
   - Complete incident post-mortem
   - Update runbooks with lessons learned

### Emergency Rollback

**If migration causes production issues:**

1. **Immediate Actions**
   ```bash
   # Trigger automated rollback
   gh workflow run rollback-migration.yml \
     --field environment=prod \
     --field migration_timestamp=[timestamp]
   ```

2. **Verification**
   ```bash
   # Verify rollback successful
   npx tsx scripts/ops/verify-schema-post-migration.ts --env prod

   # Run smoke tests
   npx tsx scripts/ops/smoke-test-db.ts --env prod --comprehensive
   ```

3. **Investigation**
   - Analyze what went wrong
   - Update migration with fix
   - Test in dev/staging before retry

---

## COMPLIANCE VALIDATION

### Daily Compliance Checks

**Automated Validation (CI/CD):**

```bash
# Run daily compliance validation
npx tsx scripts/ops/validate-governance-compliance.ts --daily
```

**Validation Checklist:**

- [ ] All migrations have corresponding rollback plans
- [ ] No service role keys in repository
- [ ] No hardcoded credentials in code
- [ ] All production migrations approved
- [ ] Schema drift = 0 across all environments
- [ ] Read-only users can only SELECT
- [ ] RLS policies active where required
- [ ] Backup verification successful (last 24h)
- [ ] All secrets rotated within policy (90 days)
- [ ] Audit logs complete (no gaps)

### Monthly Governance Review

**Review Agenda:**

1. **Access Audit**
   - Review who has what access
   - Remove stale credentials
   - Validate role assignments

2. **Migration Audit**
   - Review all migrations from past month
   - Identify any non-standard patterns
   - Update best practices

3. **Incident Review**
   - Review all schema-related incidents
   - Identify root causes
   - Update runbooks

4. **Metrics Review**
   - Migration success rate
   - Rollback frequency
   - Drift detection rate
   - Time to resolve issues

### Quarterly Security Audit

**External Review:**
- Penetration testing
- Credential rotation verification
- Access control effectiveness
- Compliance with industry standards (SOC2, etc.)

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Immediate Actions (Week 1)

- [ ] Create read-only database users in all Supabase environments
- [ ] Update CI/CD with read-only credentials for monitoring
- [ ] Implement pre-commit hook for migration validation
- [ ] Enable GitHub branch protection on main
- [ ] Configure GitHub environment protection (dev/staging/prod)

### Phase 2: Automation (Week 2-3)

- [ ] Implement schema drift detection script
- [ ] Create drift detection GitHub Action (6-hour schedule)
- [ ] Implement automated rollback mechanism
- [ ] Create emergency access procedures
- [ ] Set up alerting (Slack/Discord webhooks)

### Phase 3: Documentation & Training (Week 4)

- [ ] Create MIGRATION_FLOW.md with detailed workflows
- [ ] Update developer onboarding docs
- [ ] Create video walkthrough of migration process
- [ ] Conduct team training session
- [ ] Create quick reference cards

### Phase 4: Validation & Monitoring (Week 5-6)

- [ ] Run full compliance validation
- [ ] Verify all environments adhere to governance
- [ ] Test emergency procedures
- [ ] Monitor for 2 weeks with daily reviews
- [ ] Create monthly review schedule

---

## REFERENCES

- [Production Charter](./PRODUCTION_CHARTER.md) - Overall platform governance
- [Migration Flow](./MIGRATION_FLOW.md) - Detailed migration workflows
- [Supabase CLI Docs](https://supabase.com/docs/guides/cli) - Official CLI documentation
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets) - Secure credential storage

---

**Document Control:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-01-14 | Claude Code (Senior DB Architect) | Initial governance model |

**Approval:**

- [ ] CTO Approval
- [ ] Tech Lead Approval
- [ ] Security Review
- [ ] Legal Review (if required)

**Next Review Date:** 2025-04-14 (90 days)
