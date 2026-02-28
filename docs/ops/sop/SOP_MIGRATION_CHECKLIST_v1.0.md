# SOP: MIGRATION CHECKLIST v1.0

**Status**: PLACEHOLDER **Created**: 2026-02-27 **Sprint**:
BLUEPRINT-FOUNDATION-AUDIT-001

---

## Purpose

This Standard Operating Procedure defines the checklist for executing database
migrations in the Unit Talk platform.

---

## Sections (To Be Completed)

1. **Pre-Migration Checklist**
   - [ ] Migration file created with timestamp
   - [ ] Rollback documented in comments
   - [ ] Migration tested locally
   - [ ] No destructive operations
   - [ ] Schema changes reviewed

2. **Migration Execution**
   - [ ] Notify team of pending migration
   - [ ] Create backup of affected tables
   - [ ] Execute migration in staging
   - [ ] Verify staging functionality
   - [ ] Schedule production window

3. **Post-Migration Verification**
   - [ ] Application health checks pass
   - [ ] Data integrity verified
   - [ ] No error rate increase
   - [ ] Performance metrics stable

4. **Rollback Procedure**
   - Conditions for rollback
   - Rollback execution steps
   - Post-rollback verification

---

## Related Documents

- `.claude/rules/02-db-migrations.md`
- `docs/migrations/CANONICAL_SCHEMA_MIGRATION_PLAN.md`
- `supabase/migrations/` (migration files)

---

**Document Owner**: Engineering Team **Placeholder Created**: 2026-02-27
