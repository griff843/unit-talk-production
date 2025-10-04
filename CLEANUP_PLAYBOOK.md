# Database Cleanup Playbook

Safe, step-by-step guide for reviewing and executing database cleanup plans.

---

## Overview

This playbook guides you through the safe cleanup of legacy database objects after migrating to the new read-model architecture.

**Key Principle**: Archive first, drop later. Always reversible.

---

## Prerequisites

- [ ] Full database backup completed
- [ ] Staging environment available for testing
- [ ] DBA approval obtained
- [ ] Cleanup plan generated (`generate-cleanup-plan.ts`)
- [ ] Read-model migration verified (`verifyCommandCenter.ts`)

---

## Phase 1: Generate Inventory

### Step 1: Generate Cleanup Plan

```bash
cd apps/api
npx tsx src/scripts/generate-cleanup-plan.ts
```

**Output Location**: `apps/api/out/ops/cleanup/<timestamp>/`

**Files Generated**:
- `01_inventory_tables.csv` - Complete object list
- `02_dependencies.csv` - Dependency graph
- `03_keep_vs_drop.json` - Classification
- `05_drop_plan.sql` - DROP statements (ALL COMMENTED)
- `06_archive_plan.sql` - Archive operations (ALL COMMENTED)
- `CLEANUP_README.md` - Review checklist

### Step 2: Review Inventory

```bash
# Open in spreadsheet app
open apps/api/out/ops/cleanup/<timestamp>/01_inventory_tables.csv
```

**Review Criteria**:
| Classification | Action | Risk |
|---------------|--------|------|
| KEEP | Do NOT drop | N/A |
| REVIEW | Investigate usage | Medium |
| DROP_CANDIDATE | Safe to archive/drop | Low |

---

## Phase 2: Dependency Analysis

### Step 1: Review Dependencies

```bash
cat apps/api/out/ops/cleanup/<timestamp>/02_dependencies.csv
```

**Red Flags**:
- KEEP object depends on DROP_CANDIDATE → **DO NOT DROP**
- Circular dependencies → **REVIEW MANUALLY**
- Unknown dependencies → **INVESTIGATE**

### Step 2: Check Foreign Keys

```sql
-- Find all FKs pointing to a table you want to drop
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'TABLE_TO_DROP';
```

If results found → **DO NOT DROP** without removing FKs first.

---

## Phase 3: Staging Rehearsal

### Step 1: Clone Production to Staging

```bash
# Dump production
pg_dump -h prod-host -U user -d unittalk -F c -f prod_backup.dump

# Restore to staging
pg_restore -h staging-host -U user -d unittalk -c prod_backup.dump
```

### Step 2: Test Archive Plan on Staging

```bash
# Edit 06_archive_plan.sql - UNCOMMENT specific operations
# Example: Uncomment approval_queue archive

psql -h staging-host -U user -d unittalk -f apps/api/out/ops/cleanup/<timestamp>/06_archive_plan.sql
```

### Step 3: Verify Application on Staging

```bash
# Run full E2E suite
npm run test:e2e

# Run Command Center verification
npx tsx apps/api/src/scripts/verify/verifyCommandCenter.ts

# Manual smoke test
# - Submit a pick
# - Approve it
# - Verify it appears in v_daily_board
```

**If ANY test fails** → STOP. Restore staging from backup and investigate.

### Step 4: Test Drop Plan on Staging (If Archive Successful)

```bash
# Edit 05_drop_plan.sql - UNCOMMENT specific DROP statements
# Start with zero-dependency objects only

psql -h staging-host -U user -d unittalk -f apps/api/out/ops/cleanup/<timestamp>/05_drop_plan.sql
```

### Step 5: Re-verify Application

```bash
npm run test:e2e
npx tsx apps/api/src/scripts/verify/verifyCommandCenter.ts
```

**If successful on staging** → Proceed to production.

---

## Phase 4: Production Execution

### Step 1: Create Production Backup

```bash
# Full backup with timestamp
pg_dump -h prod-host -U user -d unittalk -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# Verify backup size
ls -lh backup_*.dump

# Test restore to temp DB (optional but recommended)
createdb unittalk_test
pg_restore -h localhost -U user -d unittalk_test backup_*.dump
```

### Step 2: Maintenance Window Notification

**Before executing**:
- [ ] Notify users of maintenance window
- [ ] Put application in read-only mode (if possible)
- [ ] Pause all background jobs/schedulers

```bash
# Pause schedulers
pm2 stop schedulers

# Set read-only mode (if supported)
echo "MAINTENANCE_MODE=true" >> .env
pm2 restart all
```

### Step 3: Execute Archive Plan

```bash
# Copy EXACT SQL from staging that worked
# Run in transaction for safety
psql -h prod-host -U user -d unittalk <<EOF
BEGIN;

-- Example: Archive approval_queue
ALTER TABLE IF EXISTS public.approval_queue SET SCHEMA archive;

-- Verify
SELECT schemaname, tablename FROM pg_tables WHERE tablename = 'approval_queue';

COMMIT;
EOF
```

### Step 4: Monitor for 48 Hours

**Monitoring Checklist**:
- [ ] Application logs - no errors related to missing tables
- [ ] Command Center health checks - all passing
- [ ] User reports - no issues submitted
- [ ] Performance metrics - no degradation

```bash
# Continuous health monitoring
watch -n 60 'npx tsx apps/api/src/scripts/verify/verifyCommandCenter.ts'

# Check logs
tail -f /var/log/unittalk/api.log | grep -i error
```

**If issues found** → Restore from archive:
```sql
ALTER TABLE archive.approval_queue SET SCHEMA public;
```

### Step 5: Execute Drop Plan (After 48h Success)

```bash
# Only if archive phase was 100% successful
# Execute in small batches (max 5 objects at a time)

psql -h prod-host -U user -d unittalk <<EOF
BEGIN;

-- Batch 1: Zero-dependency objects only
-- DROP TABLE IF EXISTS public.old_table_1 CASCADE;
-- DROP TABLE IF EXISTS public.test_table_2 CASCADE;

-- Verify KEEP objects still exist
SELECT count(*) FROM public.unified_picks;
SELECT count(*) FROM public.scored_props;

COMMIT;
EOF
```

### Step 6: Final Verification

```bash
# Full E2E verification
npm run test:e2e

# Command Center health
npx tsx apps/api/src/scripts/verify/verifyCommandCenter.ts

# Schedulers smoke test
npm run start:schedulers &
sleep 120  # Wait 2 minutes
pkill -f liveLoops  # Stop schedulers
# Check artifacts in apps/api/out/ops/schedulers/
```

---

## Phase 5: Post-Cleanup

### Step 1: Update Inventory

```bash
# Re-run inventory to confirm deletions
npx tsx apps/api/src/scripts/generate-cleanup-plan.ts
```

### Step 2: Vacuum Database

```sql
-- Reclaim space from deleted objects
VACUUM FULL ANALYZE;
```

### Step 3: Update Documentation

- [ ] Update schema documentation
- [ ] Update ERD diagrams
- [ ] Update developer onboarding docs

### Step 4: Resume Normal Operations

```bash
# Remove maintenance mode
sed -i '/MAINTENANCE_MODE/d' .env

# Restart services
pm2 restart all

# Resume schedulers
pm2 start schedulers
```

---

## Rollback Procedures

### Rollback from Archive

```sql
-- Restore table from archive schema
ALTER TABLE archive.table_name SET SCHEMA public;

-- Verify
SELECT * FROM public.table_name LIMIT 1;
```

### Rollback from Backup

```bash
# Stop application
pm2 stop all

# Restore database
pg_restore -h prod-host -U user -d unittalk -c backup_YYYYMMDD_HHMMSS.dump

# Restart application
pm2 start all
```

### Rollback from Point-in-Time

```bash
# If using WAL archiving
pg_restore -h prod-host -U user -d unittalk --target-time='2025-10-04 10:00:00'
```

---

## Safety Guardrails

### Never Drop Without

1. ✅ Full database backup
2. ✅ Successful staging rehearsal
3. ✅ DBA approval
4. ✅ Verification that object not in KEEP list
5. ✅ Dependency check showing zero dependents
6. ✅ Archive phase completed (48h+ success)

### Always

1. ✅ Execute in transactions (BEGIN/COMMIT)
2. ✅ Use IF EXISTS clauses
3. ✅ Monitor immediately after changes
4. ✅ Keep backups for 30+ days
5. ✅ Document every change

### Never

1. ❌ Drop objects in KEEP list
2. ❌ Skip staging rehearsal
3. ❌ Execute uncommented drop plan directly
4. ❌ Drop more than 5 objects at once
5. ❌ Proceed if ANY verification fails

---

## Approval Template

```
DATABASE CLEANUP APPROVAL REQUEST

Timestamp: <RUNID>
DBA: _________________________
System Owner: ________________

Objects to Archive:
- [ ] approval_queue (replaced by promotion_queue)

Objects to Drop:
- [ ] (None at this stage - archive first)

Staging Test Results:
- [ ] E2E tests: PASS
- [ ] Command Center verification: PASS
- [ ] Manual smoke test: PASS

Production Backup:
- [ ] Backup file: backup_YYYYMMDD_HHMMSS.dump
- [ ] Backup verified: YES

Approvals:
DBA Signature: _________________ Date: _______
Owner Signature: _______________ Date: _______
```

---

## Emergency Contacts

| Role | Contact | Purpose |
|------|---------|---------|
| DBA | (contact info) | Database issues |
| Platform Lead | (contact info) | Application issues |
| DevOps | (contact info) | Infrastructure issues |

---

**Last Updated**: 2025-10-04
**Owner**: Platform Engineering
