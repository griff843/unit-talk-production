# Rule 02: Database Migrations

> Reference: `CLAUDE_EXECUTION_CONTRACT.md` Section II

## Migration Standards

### Location

```
supabase/migrations/YYYYMMDDHHMMSS_<description>.sql
```

### Naming Convention

```
20260218150000_add_lifecycle_fields.sql
20260218160000_create_closing_snapshots.sql
```

### Reversibility Requirement

**All migrations SHOULD be reversible.**

Include rollback comments:
```sql
-- Migration: Add lifecycle_stage column
ALTER TABLE unified_picks ADD COLUMN lifecycle_stage TEXT;

-- Rollback:
-- ALTER TABLE unified_picks DROP COLUMN lifecycle_stage;
```

## Pre-Migration Checklist

- [ ] Migration file created with timestamp
- [ ] Rollback documented in comments
- [ ] No destructive operations on existing data
- [ ] Tested locally first
- [ ] No conflicts with existing migrations

## Migration Workflow

### 1. Create Migration

```bash
# Generate migration file
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_<description>.sql
```

### 2. Write SQL

```sql
-- Description: <what this migration does>
-- Rollback: <how to reverse it>

<migration SQL here>
```

### 3. Test Locally

```bash
# Apply migration
supabase db reset  # or specific migration command

# Verify
supabase db status
```

### 4. Verify Schema

```bash
# Check schema matches expectations
npm run db:status
```

## Forbidden Operations

| Operation | Reason | Alternative |
|-----------|--------|-------------|
| DROP TABLE without backup | Data loss | Archive first |
| ALTER COLUMN TYPE on large table | Lock contention | Add new column, migrate, drop |
| DELETE FROM without WHERE | Data loss | Always include condition |
| Direct production writes | Bypass application | Use application layer |

## Supabase-Specific Rules

1. **Use Supabase CLI** for migrations
2. **Never edit** applied migrations
3. **Test in local** before staging/prod
4. **Coordinate** multi-app migrations

## Immutability Triggers

Some columns have database-level immutability:

```sql
-- Example: closing_line immutability
CREATE TRIGGER guard_closing_line_immutability
BEFORE UPDATE ON closing_snapshots
FOR EACH ROW
WHEN (OLD.closing_line IS NOT NULL AND NEW.closing_line <> OLD.closing_line)
EXECUTE FUNCTION raise_immutability_violation();
```

**Never remove** immutability triggers without explicit approval.

## Migration Review Checklist

Before approving:
- [ ] SQL syntax valid
- [ ] Rollback documented
- [ ] No data loss risk
- [ ] Performance considered (indexes, locks)
- [ ] Application code ready for schema change
- [ ] Tested in development
