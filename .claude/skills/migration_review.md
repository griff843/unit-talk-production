# Skill: Migration Review

> Model tier: **Opus** — safety analysis, rollback assessment

## Purpose

Review database migrations for safety, reversibility, and compliance before
application.

## Invocation

```
/migration-review <filename>
```

## Procedure

### Step 1: Locate Migration

```bash
ls supabase/migrations/ | grep "<pattern>"
```

### Step 2: Read Migration

```bash
cat supabase/migrations/<filename>.sql
```

### Step 3: Safety Checklist

#### Naming Convention

- [ ] Filename: `YYYYMMDDHHMMSS_<description>.sql`
- [ ] Timestamp is valid
- [ ] Description is clear

#### Rollback Documentation

- [ ] Migration has rollback comment
- [ ] Rollback SQL is valid
- [ ] Rollback is reversible

Example expected format:

```sql
-- Migration: Add lifecycle_stage column
-- Rollback: ALTER TABLE unified_picks DROP COLUMN lifecycle_stage;

ALTER TABLE unified_picks ADD COLUMN lifecycle_stage TEXT;
```

#### Destructive Operations Check

| Operation         | Found | Approved |
| ----------------- | ----- | -------- |
| DROP TABLE        | ❌    | N/A      |
| DROP COLUMN       | ❌    | N/A      |
| DELETE FROM       | ❌    | N/A      |
| TRUNCATE          | ❌    | N/A      |
| ALTER COLUMN TYPE | ❌    | N/A      |

#### Immutability Check

- [ ] Does NOT modify `guard_closing_line_immutability()`
- [ ] Does NOT modify `guard_settlement_immutability()`
- [ ] Does NOT remove immutability triggers

#### Performance Check

- [ ] Large table operations have indexes considered
- [ ] No full table scans on large tables
- [ ] Appropriate use of CONCURRENTLY for index creation

### Step 4: Test Locally

```bash
# Reset local database with migration
supabase db reset

# Check migration status
supabase db status
```

### Step 5: Generate Report

````markdown
# Migration Review Report

**File**: <filename> **Reviewed**: <date>

## Summary

<One line description of what migration does>

## Safety Checks

| Check               | Status |
| ------------------- | ------ |
| Naming Convention   | ✅/❌  |
| Rollback Documented | ✅/❌  |
| No Destructive Ops  | ✅/❌  |
| Immutability Safe   | ✅/❌  |
| Performance OK      | ✅/❌  |
| Tested Locally      | ✅/❌  |

## Rollback Procedure

```sql
<rollback SQL>
```
````

## Affected Tables

| Table   | Operation        |
| ------- | ---------------- |
| <table> | ADD COLUMN / etc |

## Approval Status

✅ APPROVED / ❌ BLOCKED

**Reason** (if blocked): <reason>

```

## Escalation Triggers

Escalate to user if:

1. **Affects unified_picks schema** - Requires explicit approval
2. **Affects settlement columns** - Requires explicit approval
3. **Removes immutability triggers** - Requires explicit approval
4. **Destructive operations** - Requires explicit approval
5. **Affects closing_snapshots** - Requires explicit approval

## Blocked Migrations

Never approve without explicit user consent:

- DROP TABLE (any table)
- DROP COLUMN on canonical tables
- DELETE FROM without WHERE
- ALTER COLUMN TYPE on large tables
- Removal of immutability triggers
```
