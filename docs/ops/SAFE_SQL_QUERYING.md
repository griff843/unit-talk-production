# Safe SQL Querying Guide

**Owner:** Platform Engineering
**Last Updated:** 2025-12-28
**Status:** PRODUCTION READY

---

## Overview

This guide explains how to safely execute SQL queries against Supabase Cloud for debugging, operations, and agent-driven tasks. The query runner implements defense-in-depth security controls to prevent accidental or malicious destructive queries.

**Security Model:**
- ✅ **Read-only by default** (SELECT, EXPLAIN, SHOW only)
- ✅ **SQL statement allowlist** (blocks dangerous patterns)
- ✅ **Credential redaction** in all outputs
- ✅ **Write confirmation** for any non-SELECT query
- ✅ **Audit logging** (all queries logged)
- ✅ **Rate limiting** (max 10 queries per minute per user)

---

## Quick Start

### Basic Read Query

```bash
npx tsx scripts/ops/supabase-query.ts --env dev "SELECT * FROM picks LIMIT 10"
```

### Count Records

```bash
npx tsx scripts/ops/supabase-query.ts --env dev "SELECT COUNT(*) FROM picks WHERE status = 'pending'"
```

### JSON Output

```bash
npx tsx scripts/ops/supabase-query.ts --env dev --output json "SELECT id, status FROM picks LIMIT 5"
```

### CSV Export

```bash
npx tsx scripts/ops/supabase-query.ts --env dev --output csv "SELECT * FROM picks" > picks.csv
```

---

## Installation

### Prerequisites

```bash
# Install dependencies (if not already installed)
npm ci --workspace=apps/api

# Set up environment variables
cp .env.example .env
```

### Required Environment Variables

Add to `.env` or `.env.local`:

```bash
# Dev environment
SUPABASE_READONLY_DATABASE_URL_DEV=postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# Staging environment (optional)
SUPABASE_READONLY_DATABASE_URL_STAGING=postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# Production environment (optional, read-only recommended)
SUPABASE_READONLY_DATABASE_URL_PROD=postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Getting Connection Strings:**
1. Go to Supabase Dashboard → Project Settings → Database
2. Scroll to "Connection string" section
3. Select "URI" tab
4. Copy the connection pooler URL (port 6543)
5. Replace `[password]` with your database password

---

## Usage

### Command Syntax

```bash
npx tsx scripts/ops/supabase-query.ts [OPTIONS] "SQL QUERY"
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--env <env>` | Target environment (dev\|staging\|prod) | `dev` |
| `--output <format>` | Output format (table\|json\|csv) | `table` |
| `--write` | Allow write operations (requires confirmation) | `false` |
| `--timeout <sec>` | Query timeout in seconds | `30` |

### Examples

#### Read Operations (Allowed by Default)

```bash
# Select all columns
npx tsx scripts/ops/supabase-query.ts --env dev "SELECT * FROM picks LIMIT 5"

# Aggregate query
npx tsx scripts/ops/supabase-query.ts --env dev "SELECT status, COUNT(*) FROM picks GROUP BY status"

# Join tables
npx tsx scripts/ops/supabase-query.ts --env dev "
  SELECT p.id, p.status, u.username
  FROM picks p
  JOIN users u ON p.user_id = u.id
  LIMIT 10
"

# With CTE (Common Table Expression)
npx tsx scripts/ops/supabase-query.ts --env dev "
  WITH recent_picks AS (
    SELECT * FROM picks WHERE created_at > NOW() - INTERVAL '7 days'
  )
  SELECT status, COUNT(*) FROM recent_picks GROUP BY status
"

# Explain query plan
npx tsx scripts/ops/supabase-query.ts --env dev "EXPLAIN SELECT * FROM picks WHERE status = 'won'"

# Show database settings
npx tsx scripts/ops/supabase-query.ts --env dev "SHOW search_path"
```

#### Write Operations (Requires --write Flag)

```bash
# Update with WHERE clause (requires confirmation)
npx tsx scripts/ops/supabase-query.ts --env dev --write "
  UPDATE picks
  SET status = 'void'
  WHERE id = '123e4567-e89b-12d3-a456-426614174000'
"

# Insert test data (dev only, requires confirmation)
npx tsx scripts/ops/supabase-query.ts --env dev --write "
  INSERT INTO picks (id, tenant_id, user_id, status)
  VALUES (gen_random_uuid(), 'tenant-id', 'user-id', 'pending')
"

# Delete with WHERE clause (requires confirmation)
npx tsx scripts/ops/supabase-query.ts --env dev --write "
  DELETE FROM picks
  WHERE id = '123e4567-e89b-12d3-a456-426614174000'
"
```

**Note:** Write operations require typing "YES" to confirm.

#### Output Formats

```bash
# Table format (human-readable)
npx tsx scripts/ops/supabase-query.ts --env dev "SELECT * FROM picks LIMIT 3"
# Output:
# id                                   | status  | created_at
# -------------------------------------|---------|-------------------------
# 123e4567-e89b-12d3-a456-426614174000 | won     | 2025-12-28 10:30:00+00
# 223e4567-e89b-12d3-a456-426614174001 | lost    | 2025-12-28 10:35:00+00

# JSON format (machine-readable)
npx tsx scripts/ops/supabase-query.ts --env dev --output json "SELECT id, status FROM picks LIMIT 2"
# Output:
# [
#   { "id": "123e4567-e89b-12d3-a456-426614174000", "status": "won" },
#   { "id": "223e4567-e89b-12d3-a456-426614174001", "status": "lost" }
# ]

# CSV format (export to file)
npx tsx scripts/ops/supabase-query.ts --env dev --output csv "SELECT * FROM picks" > picks.csv
```

---

## Security Controls

### Read-Only Mode (Default)

**Allowed statements:**
- `SELECT` - Query data
- `EXPLAIN` - Show query plan
- `SHOW` - Show database settings
- `DESCRIBE` - Describe table structure
- `WITH` - Common Table Expressions (CTEs)

**Blocked statements:**
- `INSERT` - Requires `--write`
- `UPDATE` - Requires `--write`
- `DELETE` - Requires `--write`
- `CREATE` - Requires `--write`
- `ALTER` - Requires `--write`
- `DROP` - **ALWAYS BLOCKED**
- `TRUNCATE` - **ALWAYS BLOCKED**
- `GRANT` - **ALWAYS BLOCKED**
- `REVOKE` - **ALWAYS BLOCKED**

### Write Mode Protections

Even with `--write` flag, the following are **ALWAYS BLOCKED**:

```sql
-- Destructive operations
DROP TABLE picks;                       -- ❌ BLOCKED
DROP DATABASE unit_talk;                -- ❌ BLOCKED
TRUNCATE TABLE picks;                   -- ❌ BLOCKED

-- Mass updates/deletes without WHERE
DELETE FROM picks;                      -- ❌ BLOCKED (no WHERE clause)
UPDATE picks SET status = 'won';        -- ❌ BLOCKED (no WHERE clause)

-- Permission changes
GRANT ALL ON picks TO user;             -- ❌ BLOCKED
REVOKE SELECT ON picks FROM user;       -- ❌ BLOCKED
ALTER USER postgres PASSWORD 'new';     -- ❌ BLOCKED
CREATE USER hacker;                     -- ❌ BLOCKED

-- Dangerous functions
SELECT pg_read_file('/etc/passwd');     -- ❌ BLOCKED
SELECT pg_ls_dir('/');                  -- ❌ BLOCKED
SELECT pg_sleep(999999);                -- ❌ BLOCKED
SELECT lo_import('/tmp/malware');       -- ❌ BLOCKED

-- Procedural SQL
DO $$ BEGIN ... END $$;                 -- ❌ BLOCKED

-- File operations
COPY picks FROM '/tmp/file.csv';        -- ❌ BLOCKED
```

### Credential Redaction

All output is automatically sanitized:

```bash
# Input
echo "Token: sbp_abc123def456, URL: postgresql://user:password@host/db"

# Output
echo "Token: sbp_****, URL: postgresql://****:****@host/db"
```

**Redacted patterns:**
- Supabase access tokens: `sbp_****`
- Service role keys: `service_role_****`
- PostgreSQL passwords: `****:****@`
- API keys: `apikey=****`
- Password fields: `password=****`

---

## Use Cases

### 1. Debugging Production Issues

```bash
# Check recent failed picks
npx tsx scripts/ops/supabase-query.ts --env prod "
  SELECT id, status, grading_status, last_error
  FROM picks
  WHERE status = 'failed'
    AND created_at > NOW() - INTERVAL '1 hour'
  ORDER BY created_at DESC
  LIMIT 20
"

# Find picks stuck in processing
npx tsx scripts/ops/supabase-query.ts --env prod "
  SELECT id, workflow_stage, grading_status, updated_at
  FROM picks
  WHERE grading_status = 'processing'
    AND updated_at < NOW() - INTERVAL '30 minutes'
"
```

### 2. Performance Analysis

```bash
# Explain slow query
npx tsx scripts/ops/supabase-query.ts --env prod "
  EXPLAIN ANALYZE
  SELECT p.*, u.username
  FROM picks p
  JOIN users u ON p.user_id = u.id
  WHERE p.created_at > NOW() - INTERVAL '7 days'
"

# Find missing indexes
npx tsx scripts/ops/supabase-query.ts --env prod "
  SELECT schemaname, tablename, indexname
  FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY tablename, indexname
"
```

### 3. Data Validation

```bash
# Check for orphaned foreign keys
npx tsx scripts/ops/supabase-query.ts --env dev "
  SELECT p.id, p.user_id
  FROM picks p
  LEFT JOIN users u ON p.user_id = u.id
  WHERE u.id IS NULL
  LIMIT 10
"

# Verify data integrity
npx tsx scripts/ops/supabase-query.ts --env dev "
  SELECT
    COUNT(*) FILTER (WHERE user_id IS NULL) as null_users,
    COUNT(*) FILTER (WHERE tenant_id IS NULL) as null_tenants,
    COUNT(*) as total
  FROM picks
"
```

### 4. Agent-Driven Queries (Claude/AI)

```bash
# Claude can safely run this to gather context
npx tsx scripts/ops/supabase-query.ts --env dev "
  SELECT
    status,
    COUNT(*) as count,
    AVG(professional_score) as avg_score
  FROM picks
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY status
"
```

### 5. Export for Analysis

```bash
# Export last 1000 picks to CSV
npx tsx scripts/ops/supabase-query.ts --env dev --output csv "
  SELECT
    id,
    status,
    professional_score,
    grading_status,
    created_at
  FROM picks
  ORDER BY created_at DESC
  LIMIT 1000
" > picks_export_$(date +%Y%m%d).csv
```

---

## Testing

### Run Test Suite

```bash
# Run all tests
npm test scripts/ops/supabase-query.test.ts

# Run with coverage
npm test -- --coverage scripts/ops/supabase-query.test.ts
```

### Test Coverage

The test suite validates:
- ✅ Read-only mode enforcement
- ✅ Blocked pattern detection
- ✅ Dangerous function blocking
- ✅ Credential redaction
- ✅ SQL injection prevention
- ✅ Attack vector prevention

---

## Troubleshooting

### Query Rejected: "Not read-only"

**Error:**
```
❌ SQL Validation Failed: Query is not read-only. Use --write flag for write operations.
```

**Cause:** Attempting INSERT/UPDATE/DELETE without `--write` flag

**Fix:** Add `--write` flag if write operation is intentional:
```bash
npx tsx scripts/ops/supabase-query.ts --env dev --write "UPDATE picks SET ..."
```

### Blocked Pattern Detected

**Error:**
```
❌ SQL Validation Failed: Blocked pattern detected: /DROP\s+(TABLE|DATABASE)/i
```

**Cause:** Query contains dangerous operation

**Fix:** Remove blocked operation or use migration instead

### Missing Connection String

**Error:**
```
❌ Missing connection string for environment: dev
```

**Cause:** Environment variable not set

**Fix:** Add to `.env` file:
```bash
SUPABASE_READONLY_DATABASE_URL_DEV=postgresql://...
```

### Query Timeout

**Error:**
```
❌ Query failed: Query timeout
```

**Cause:** Query took longer than 30 seconds

**Fix:** Increase timeout or optimize query:
```bash
npx tsx scripts/ops/supabase-query.ts --env dev --timeout 60 "SLOW QUERY HERE"
```

---

## Best Practices

### For Operators

1. **Always use dev first**
   - Test queries in dev before running in prod
   - Verify results match expectations

2. **Use read-only connection strings**
   - Set `SUPABASE_READONLY_DATABASE_URL_*` instead of read-write
   - Minimize blast radius

3. **Limit result sets**
   - Always use `LIMIT` clause for large tables
   - Export to CSV for offline analysis

4. **Document complex queries**
   - Save useful queries in runbooks
   - Add comments explaining purpose

### For Claude/AI Agents

1. **Gather context safely**
   - Use `SELECT COUNT(*)` instead of `SELECT *`
   - Aggregate before fetching details

2. **Never assume schema**
   - Query `information_schema` to verify tables exist
   - Check column names before using

3. **Handle errors gracefully**
   - Expect queries may fail
   - Parse error messages for debugging

4. **Request human approval for writes**
   - Never use `--write` without explicit user request
   - Explain impact before executing

---

## Environment-Specific Notes

### Dev
- ✅ Write operations allowed (with confirmation)
- ✅ Test data creation/deletion OK
- ✅ Schema introspection allowed

### Staging
- ⚠️ Write operations allowed (with caution)
- ⚠️ Avoid test data pollution
- ✅ Use for testing queries before prod

### Production
- ❌ Write operations discouraged
- ✅ Use read-only connection string
- ✅ Require ops team approval for writes
- ⚠️ All queries logged and audited

---

## Related Documentation

- [Supabase Migrations Runbook](./SUPABASE_MIGRATIONS_RUNBOOK.md)
- [Supabase CI Migrations Audit](./SUPABASE_CI_MIGRATIONS_AUDIT.md)
- [Production Charter](../PRODUCTION_CHARTER.md)

---

## Support

For issues or questions:
- **Slack:** #platform-engineering
- **PagerDuty:** @platform-oncall
- **GitHub Issues:** [unit-talk-production/issues](https://github.com/griff843/unit-talk-production/issues)
