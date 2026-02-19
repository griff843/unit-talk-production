# Database Migration Workflow

> **Sprint**: DB-MIGRATION-MODE-LOCK
> **Last Updated**: 2026-02-18

## Overview

This document defines the canonical workflow for applying database migrations to
the Unit Talk production Supabase database. All migrations **MUST** use the
linked-project mode via Supabase CLI.

## Golden Rule

```
NO db-url flags. NO raw psql. NO DATABASE_URL connections.
ONLY: npx supabase db push --include-all --yes
```

## Production Database

| Property     | Value                                                                       |
| ------------ | --------------------------------------------------------------------------- |
| Project Ref  | `cqfnsozknjzvyiziwicl`                                                      |
| Project Name | Unit Talk DB v3                                                             |
| Region       | East US (Ohio) / aws-1-us-east-2                                            |
| Pooler URL   | postgresql://postgres.cqfnsozknjzvyiziwicl@aws-1-us-east-2.pooler.supabase.com:5432/postgres |

## Pre-Migration Checklist

### 1. Run Preflight Check

```bash
cd apps/api
npm run ops:db:preflight
```

The preflight script validates:
- Project is linked to `cqfnsozknjzvyiziwicl`
- Migration history is in sync
- No raw SQL execution patterns
- CLI version is compatible

**Do not proceed if preflight fails.**

### 2. Verify Link Status

```bash
npx supabase projects list
```

Confirm the bullet `●` is next to `Unit Talk DB v3`.

### 3. Check Migration Status

```bash
npx supabase migration list
```

All migrations should show `applied` status.

## Migration Workflow

### Standard Push (All Migrations)

```bash
npx supabase db push --include-all --yes
```

- `--include-all`: Include migrations that may be out of order
- `--yes`: Non-interactive mode (required for automation)

### Verify After Push

```bash
# Check migration list
npx supabase migration list

# Dump schema to verify objects
npx supabase db dump --schema public | grep "your_object_name"
```

## Troubleshooting

### Migration History Mismatch

**Symptom**: `migration not found` or `reverted` status

**Solution**:
```bash
# Mark missing remote migration as applied
npx supabase migration repair --status applied <version>

# Mark problematic local migration as reverted
npx supabase migration repair --status reverted <version>
```

### Tenant Not Found Error

**Symptom**: `failed to connect to tenant db`

**Cause**: Wrong pooler region or credentials

**Solution**:
```bash
# Re-link to correct project
npx supabase link --project-ref cqfnsozknjzvyiziwicl
```

### CREATE INDEX CONCURRENTLY Fails

**Symptom**: `CREATE INDEX CONCURRENTLY cannot run inside a transaction block`

**Cause**: Supabase applies migrations in a transaction

**Solution**: Remove `CONCURRENTLY` keyword, or apply index manually after
migration via Supabase Dashboard SQL Editor.

### Schema Conflicts / Column Not Found

**Symptom**: `column "X" does not exist`

**Cause**: Local migration references schema that doesn't match remote

**Solutions**:
1. Archive conflicting migration: `mv migration.sql _archived_conflicts/`
2. Fix the migration to match actual schema
3. Pull fresh schema: `npx supabase db pull`

### Local Migration File Encoding Issues

**Symptom**: `db diff` fails with syntax errors, character corruption visible

**Cause**: Files have wrong encoding (not UTF-8) or CRLF line endings

**Solution**:
```bash
# Check file type
file supabase/migrations/your_migration.sql

# Convert to UTF-8 with LF (Unix)
iconv -f ISO-8859-1 -t UTF-8 old.sql > new.sql
sed -i 's/\r$//' new.sql
```

## Prohibited Actions

| Action | Why Prohibited |
|--------|----------------|
| `psql -h db.xxx.supabase.co` | Bypasses migration tracking |
| `--db-url` flag | Bypasses linked-project mode |
| `DATABASE_URL` connections | Not reproducible |
| Manual SQL in production | No audit trail |
| `git commit --amend` on migrations | Breaks history |

## Verification Commands

```bash
# Check if object exists
npx supabase db dump --schema public | grep "object_name"

# Full schema dump (large output)
npx supabase db dump --schema public > schema_dump.sql

# Check specific table
npx supabase db dump --schema public | grep -A 20 "CREATE TABLE.*table_name"

# Check indexes
npx supabase db dump --schema public | grep "CREATE INDEX"

# Check materialized views
npx supabase db dump --schema public | grep "CREATE MATERIALIZED VIEW"
```

## Recovery Procedures

### Rollback a Migration

Supabase doesn't support automatic rollback. Manual steps:

1. Create a new migration that reverses changes
2. Apply via `db push`
3. Mark old migration as reverted if needed

### Sync Local to Remote

If local migrations are corrupted:

```bash
# Pull fresh migrations from remote
npx supabase db pull

# Or reset and re-link
rm -rf supabase/.temp
npx supabase link --project-ref cqfnsozknjzvyiziwicl
```

## Sprint Artifacts

Proof files for this workflow are in:
- `out/sprints/DB-MIGRATION-MODE-LOCK/PROOF_SUPABASE_VERSION.txt`
- `out/sprints/DB-MIGRATION-MODE-LOCK/PROOF_SUPABASE_LINK.txt`
- `out/sprints/DB-MIGRATION-MODE-LOCK/PROOF_DB_PUSH.txt`
- `out/sprints/DB-MIGRATION-MODE-LOCK/PROOF_DB_DIFF.txt`
- `out/sprints/DB-MIGRATION-MODE-LOCK/PROOF_OBJECT_EXISTENCE.txt`

## Quick Reference

```bash
# Preflight
npm run ops:db:preflight

# Apply migrations
npx supabase db push --include-all --yes

# Verify
npx supabase migration list
npx supabase db dump --schema public | grep "your_object"

# Repair history
npx supabase migration repair --status applied <version>
npx supabase migration repair --status reverted <version>

# Re-link
npx supabase link --project-ref cqfnsozknjzvyiziwicl
```
