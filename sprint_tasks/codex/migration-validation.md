# Codex Task: Migration Validation

**Mode**: read-only **Sprint**: <FILL IN: SPRINT-ID> **Agent**:
migration-validator

## Objective

Validate that SQL migration files are correct, safe, and consistent with the
application code that depends on the schema they define.

## Scope

**IN scope:**

- <FILL IN: specific migration files to validate, e.g.
  supabase/migrations/20260318\*.sql>
- Application code that references tables/columns affected by the migration
- Existing migration files for ordering/conflict checks

**OUT of scope:**

- Modifying any files (this is a read-only validation)
- Reviewing migrations not listed above
- Running migrations against a live database
- Performance benchmarking of migration operations

## Constraints

- Read-only — do not modify any files
- Check each migration against the rules in `.claude/rules/02-db-migrations.md`
- Verify rollback instructions are documented in comments
- Check for conflicts with existing migrations in `supabase/migrations/`
- Verify application code compatibility (column names, types, constraints)

## Required Output

```markdown
## Task Summary

- Task class: migration-validation
- Mode: read-only
- Sprint: <SPRINT-ID>
- Files examined: <count>
- Files modified: 0

## Migration Review

| Migration File | Tables Affected | Operation           | Reversible? | Safe?       |
| -------------- | --------------- | ------------------- | ----------- | ----------- |
| <filename>     | <tables>        | <ALTER/CREATE/DROP> | YES/NO      | YES/NO/RISK |

## Schema Compatibility

| Column/Table | Migration Says    | Application Code Expects | Match? |
| ------------ | ----------------- | ------------------------ | ------ |
| <name>       | <type/constraint> | <usage in code>          | YES/NO |

## Risk Assessment

- Destructive operations: <list or "none">
- Lock contention risk: <assessment>
- Data loss risk: <assessment>
- Ordering conflicts: <list or "none">

## Verdict

- Status: PASS | FAIL | PARTIAL
- Confidence: HIGH | MEDIUM | LOW
- Blocking issues: <count>
- Advisory issues: <count>

## Acceptance Criteria Check

- [ ] All migrations have rollback documentation
- [ ] No destructive operations without explicit justification
- [ ] Application code is compatible with schema changes
- [ ] No ordering conflicts with existing migrations
- [ ] No files modified (read-only task)
```

## Acceptance Criteria

- [ ] Every migration file has rollback instructions in comments
- [ ] No `DROP TABLE` without backup/archive strategy documented
- [ ] Column types match application code expectations
- [ ] No migration timestamp conflicts
- [ ] No files modified (read-only task)
