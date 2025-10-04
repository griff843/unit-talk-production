# Backfill Runbook - Unit Talk Platform Database Migration

## Overview

This runbook provides step-by-step instructions for backfilling data from the legacy `unified_picks` table to the new architecture (`raw_props`, `scored_props`, `promotion_queue`, `settled_outcomes`).

**Target Systems:**
- Supabase Cloud (Production)
- Local Docker PostgreSQL (Development)

**Estimated Duration:**
- Small (<10K rows): 5-10 minutes
- Medium (10K-100K rows): 30-60 minutes
- Large (>100K rows): 2-4 hours

---

## Pre-Requisites

### 1. Environment Verification

```bash
# Check PostgreSQL version (requires 14+)
docker-compose exec postgres psql -U postgres -c "SELECT version();"

# Verify disk space (need 2x current database size)
docker-compose exec postgres df -h /var/lib/postgresql/data

# Check current database size
docker-compose exec postgres psql -U postgres -c "\l+ unittalk"
```

**Requirements:**
- PostgreSQL 14+
- Free disk space: 2x database size minimum
- No active long-running transactions

### 2. Schema Verification

```bash
# Verify new tables exist
docker-compose exec postgres psql -U postgres -d unittalk -c "
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('raw_props', 'scored_props', 'promotion_queue', 'settled_outcomes')
ORDER BY table_name;
"
```

**Expected Output:**
- `raw_props`: ~20 columns
- `scored_props`: ~25 columns
- `promotion_queue`: ~15 columns
- `settled_outcomes`: ~12 columns

### 3. Backup Creation

```bash
# Create full database backup
docker-compose exec postgres pg_dump -U postgres unittalk > backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql

# Verify backup size
ls -lh backup_pre_migration_*.sql

# Create table-specific backup (unified_picks only)
docker-compose exec postgres pg_dump -U postgres -t unified_picks unittalk > backup_unified_picks_$(date +%Y%m%d_%H%M%S).sql
```

**Backup Checklist:**
- [ ] Full database backup created
- [ ] Backup file size matches expected size (within 10%)
- [ ] Backup stored in secure location
- [ ] Backup compressed if large (gzip)

---

## Migration Execution Order

### Phase 1: Core Schema (Tables & Indexes)

```bash
# 1. Create core tables
docker-compose exec postgres psql -U postgres -d unittalk -f /migrations/10_core_tables.sql

# Verify tables created
docker-compose exec postgres psql -U postgres -d unittalk -c "
SELECT table_name, (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_name IN ('raw_props', 'scored_props', 'promotion_queue', 'settled_outcomes');
"

# 2. Create indexes (disable during backfill for performance)
docker-compose exec postgres psql -U postgres -d unittalk -f /migrations/11_indexes.sql

# 3. Setup partitioning (if enabled)
docker-compose exec postgres psql -U postgres -d unittalk -f /migrations/12_partitions.sql

# 4. Apply RLS policies
docker-compose exec postgres psql -U postgres -d unittalk -f /migrations/13_rls_policies.sql
```

### Phase 2: Views & Functions

```bash
# 5. Create analytical views
docker-compose exec postgres psql -U postgres -d unittalk -f /migrations/20_views.sql

# 6. Create RPC functions
docker-compose exec postgres psql -U postgres -d unittalk -f /migrations/30_rpcs.sql
```

### Phase 3: Compatibility Layer

```bash
# 7. Create unified_picks compatibility view
# This renames unified_picks → unified_picks_legacy
docker-compose exec postgres psql -U postgres -d unittalk -f /migrations/40_unified_picks_view.sql

# Verify view created and legacy table preserved
docker-compose exec postgres psql -U postgres -d unittalk -c "
SELECT
  'unified_picks' as name,
  'view' as type,
  (SELECT COUNT(*) FROM unified_picks) as row_count
UNION ALL
SELECT
  'unified_picks_legacy' as name,
  'table' as type,
  (SELECT COUNT(*) FROM unified_picks_legacy) as row_count;
"
```

### Phase 4: Data Backfill

```bash
# 8. Backfill raw_props from unified_picks_legacy
docker-compose exec postgres psql -U postgres -d unittalk -f /migrations/50_backfill_raw_props.sql
```

**Expected Output:**
```
═══════════════════════════════════════════════════════════════
BACKFILL: unified_picks_legacy → raw_props
═══════════════════════════════════════════════════════════════
Records to migrate: 5693
Batch size: 1000
Estimated batches: 6
───────────────────────────────────────────────────────────────
  Batch 1/6 | Inserted: 1000 | Total: 1000 | Duration: 234 ms
  Batch 2/6 | Inserted: 1000 | Total: 2000 | Duration: 198 ms
  ...
═══════════════════════════════════════════════════════════════
✓ BACKFILL COMPLETE
═══════════════════════════════════════════════════════════════
Total records migrated: 5693
Total duration: 00:00:02.456
───────────────────────────────────────────────────────────────
```

---

## Chunk Size Recommendations

### By Table Volume

| Rows | Chunk Size | Batches | Est. Duration |
|------|-----------|---------|---------------|
| < 1K | 500 | 2-3 | 1-2 min |
| 1K - 10K | 1,000 | 10-15 | 5-10 min |
| 10K - 100K | 2,000 | 50-75 | 30-60 min |
| 100K - 1M | 5,000 | 200-300 | 2-4 hours |
| > 1M | 10,000 | 100+ per million | 4+ hours |

### Tuning Chunk Size

Edit `50_backfill_raw_props.sql` line 44:

```sql
v_batch_size INT := 1000;  -- Adjust based on table above
```

**Factors to Consider:**
- Available RAM: Larger chunks need more memory
- Disk I/O: Faster disks support larger chunks
- Checkpoint frequency: Trade-off between commit overhead and rollback risk

---

## Monitoring Queries

### Progress Tracking

```sql
-- Real-time progress monitor (run in separate session)
SELECT
  'raw_props' as table_name,
  COUNT(*) as current_count,
  (SELECT COUNT(*) FROM unified_picks_legacy) as target_count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM unified_picks_legacy), 2) as progress_pct
FROM raw_props
WHERE metadata->>'backfilled_from' = 'unified_picks_legacy';
```

### Active Queries

```sql
-- Monitor long-running queries
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  state,
  LEFT(query, 100) as query_preview
FROM pg_stat_activity
WHERE state != 'idle'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;
```

### Lock Monitoring

```sql
-- Check for blocking locks
SELECT
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

### Table Size Growth

```sql
-- Monitor table size during backfill
SELECT
  table_name,
  pg_size_pretty(pg_total_relation_size(table_name::regclass)) as total_size,
  pg_size_pretty(pg_relation_size(table_name::regclass)) as table_size,
  pg_size_pretty(pg_indexes_size(table_name::regclass)) as indexes_size
FROM (VALUES ('raw_props'), ('scored_props'), ('promotion_queue'), ('settled_outcomes')) AS t(table_name);
```

---

## Rollback Procedures

### Scenario 1: Backfill Failed Mid-Migration

```sql
-- 1. Stop any active backfill (terminate query)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE query LIKE '%backfill%' AND state = 'active';

-- 2. Truncate partially filled tables
TRUNCATE TABLE raw_props CASCADE;
TRUNCATE TABLE scored_props CASCADE;
TRUNCATE TABLE promotion_queue CASCADE;
TRUNCATE TABLE settled_outcomes CASCADE;

-- 3. Drop view and restore original table
DROP VIEW IF EXISTS unified_picks CASCADE;
ALTER TABLE unified_picks_legacy RENAME TO unified_picks;

-- 4. Verify restoration
SELECT COUNT(*) FROM unified_picks;
```

### Scenario 2: Complete Migration Rollback

```bash
# 1. Drop all new tables
docker-compose exec postgres psql -U postgres -d unittalk -c "
DROP VIEW IF EXISTS unified_picks CASCADE;
DROP TABLE IF EXISTS raw_props CASCADE;
DROP TABLE IF EXISTS scored_props CASCADE;
DROP TABLE IF EXISTS promotion_queue CASCADE;
DROP TABLE IF EXISTS settled_outcomes CASCADE;
DROP TABLE IF EXISTS agent_health CASCADE;
DROP TABLE IF EXISTS agent_metrics CASCADE;
"

# 2. Restore original unified_picks table
docker-compose exec postgres psql -U postgres -d unittalk -c "
ALTER TABLE IF EXISTS unified_picks_legacy RENAME TO unified_picks;
"

# 3. Restore from backup (if needed)
docker-compose exec postgres psql -U postgres -d unittalk < backup_pre_migration_YYYYMMDD_HHMMSS.sql
```

### Scenario 3: Partial Rollback (Keep New Tables, Restore Legacy)

```sql
-- Restore legacy table alongside new tables for dual-write testing
ALTER TABLE unified_picks RENAME TO unified_picks_view_backup;
ALTER TABLE unified_picks_legacy RENAME TO unified_picks;
```

---

## Validation Queries

### Row Count Verification

```sql
-- Compare row counts across all tables
SELECT
  'unified_picks_legacy' as table_name,
  COUNT(*) as row_count,
  MIN(created_at) as earliest_record,
  MAX(created_at) as latest_record
FROM unified_picks_legacy
UNION ALL
SELECT
  'raw_props' as table_name,
  COUNT(*) as row_count,
  MIN(created_at) as earliest_record,
  MAX(created_at) as latest_record
FROM raw_props
UNION ALL
SELECT
  'unified_picks (view)' as table_name,
  COUNT(*) as row_count,
  MIN(created_at) as earliest_record,
  MAX(created_at) as latest_record
FROM unified_picks;
```

**Expected Result:**
- `raw_props` count >= `unified_picks_legacy` count (may have additional records)
- Date ranges should overlap significantly

### Data Integrity Checks

```sql
-- Check for missing required fields
SELECT
  'raw_props' as table_name,
  COUNT(*) FILTER (WHERE sport IS NULL) as null_sport,
  COUNT(*) FILTER (WHERE game_date IS NULL) as null_game_date,
  COUNT(*) FILTER (WHERE selection IS NULL) as null_selection,
  COUNT(*) FILTER (WHERE odds IS NULL) as null_odds
FROM raw_props;

-- Should return 0 for all null_* columns
```

### Foreign Key Validation

```sql
-- Check referential integrity
SELECT
  'scored_props → raw_props' as relationship,
  COUNT(*) as total_refs,
  COUNT(*) FILTER (WHERE rp.id IS NULL) as broken_refs
FROM scored_props sp
LEFT JOIN raw_props rp ON rp.id = sp.prop_ref

UNION ALL

SELECT
  'promotion_queue → raw_props' as relationship,
  COUNT(*) as total_refs,
  COUNT(*) FILTER (WHERE rp.id IS NULL) as broken_refs
FROM promotion_queue pq
LEFT JOIN raw_props rp ON rp.id = pq.prop_ref;

-- broken_refs should be 0 for both
```

---

## Performance Optimization

### During Backfill

```sql
-- 1. Disable indexes temporarily (recreate after)
DROP INDEX IF EXISTS idx_raw_props_game_date;
DROP INDEX IF EXISTS idx_raw_props_sport_game_date;
-- ... (drop other indexes)

-- 2. Disable triggers (if any exist)
ALTER TABLE raw_props DISABLE TRIGGER ALL;

-- 3. Increase maintenance_work_mem for session
SET maintenance_work_mem = '1GB';

-- 4. Run backfill script

-- 5. Re-enable triggers
ALTER TABLE raw_props ENABLE TRIGGER ALL;

-- 6. Rebuild indexes
CREATE INDEX CONCURRENTLY idx_raw_props_game_date ON raw_props(game_date);
-- ... (recreate other indexes)

-- 7. Analyze tables
ANALYZE raw_props;
ANALYZE scored_props;
ANALYZE promotion_queue;
```

### Vacuum & Analyze

```bash
# After backfill completes
docker-compose exec postgres psql -U postgres -d unittalk -c "
VACUUM ANALYZE raw_props;
VACUUM ANALYZE scored_props;
VACUUM ANALYZE promotion_queue;
VACUUM ANALYZE settled_outcomes;
"
```

---

## Performance Tips

1. **Run During Off-Peak Hours**: Minimize user impact
2. **Monitor Disk I/O**: Use `iostat` or `pg_stat_io`
3. **Disable Auto-Vacuum**: Re-enable after completion
4. **Use COPY Instead of INSERT**: For very large datasets
5. **Partition Target Tables**: For >1M rows
6. **Connection Pooling**: Limit concurrent connections

---

## Troubleshooting

### Issue: Out of Memory Error

**Symptoms:**
```
ERROR: out of memory
DETAIL: Failed on request of size X.
```

**Solution:**
```sql
-- Reduce batch size
-- Edit 50_backfill_raw_props.sql line 44:
v_batch_size INT := 500;  -- Reduced from 1000
```

### Issue: Deadlock Detected

**Symptoms:**
```
ERROR: deadlock detected
DETAIL: Process X waits for ShareLock on transaction Y...
```

**Solution:**
```sql
-- Ensure no other processes are writing to target tables
-- Check and terminate conflicting queries
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'unittalk'
  AND state = 'active'
  AND query NOT LIKE '%pg_stat_activity%';
```

### Issue: Constraint Violation

**Symptoms:**
```
ERROR: duplicate key value violates unique constraint "raw_props_pkey"
```

**Solution:**
```sql
-- Identify duplicates in source data
SELECT external_prop_id, COUNT(*)
FROM unified_picks_legacy
WHERE external_prop_id IS NOT NULL
GROUP BY external_prop_id
HAVING COUNT(*) > 1;

-- De-duplicate before backfill or use ON CONFLICT DO NOTHING
```

---

## Post-Backfill Checklist

- [ ] All tables populated with expected row counts
- [ ] No broken foreign key references
- [ ] Indexes rebuilt and analyzed
- [ ] Vacuum completed on all tables
- [ ] Validation queries pass (0 errors)
- [ ] unified_picks view returns correct data
- [ ] Application queries tested against new view
- [ ] Performance benchmarks meet SLAs
- [ ] Backup of completed migration created
- [ ] Legacy table preserved (7-day retention)

---

## Next Steps

After successful backfill:
1. Review `60_cutover_checklist.md` for application code updates
2. Configure dual-write mode for new data ingestion
3. Test end-to-end workflows (FeedAgent → ScoringAgent → Command Center)
4. Monitor for 24-48 hours before final cutover
5. Drop legacy tables after 7-day retention period

---

**Document Version:** 1.0
**Last Updated:** 2025-10-03
**Owner:** Database Engineering Team
