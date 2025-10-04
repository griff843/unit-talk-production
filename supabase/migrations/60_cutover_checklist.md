# Database Migration Cutover Checklist - Unit Talk Platform

## Overview

This comprehensive checklist covers the complete migration from legacy `unified_picks` table to the new architecture (`raw_props`, `scored_props`, `promotion_queue`, `settled_outcomes`).

**Migration Strategy:** Blue-Green with Dual-Write Fallback
**Rollback Window:** 7 days (legacy tables retained)
**Target Completion:** Single maintenance window (4-6 hours)

---

## Pre-Migration Phase

### Environment Preparation

#### Disk Space & Resources
- [ ] Verify disk space: 2x current database size available
- [ ] Check current database size: `\l+ unittalk`
- [ ] Monitor CPU/RAM: Baseline metrics captured in Grafana
- [ ] Network bandwidth: Adequate for data transfer (if cloud)

```bash
# Check disk space
docker-compose exec postgres df -h /var/lib/postgresql/data

# Check database size
docker-compose exec postgres psql -U postgres -c "\l+ unittalk"

# Check PostgreSQL version (require 14+)
docker-compose exec postgres psql -U postgres -c "SELECT version();"
```

#### Schema Introspection
- [ ] Run schema introspection script
- [ ] Document current unified_picks structure (68 columns confirmed)
- [ ] Verify row counts: `SELECT COUNT(*) FROM unified_picks;`
- [ ] Check for custom constraints/triggers

```sql
-- Comprehensive schema check
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'unified_picks'
ORDER BY ordinal_position;

-- Check constraints
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'unified_picks'::regclass;

-- Check indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks';
```

#### Backup Creation
- [ ] Full database backup created: `pg_dump -U postgres unittalk > backup_full_$(date +%Y%m%d).sql`
- [ ] Table-specific backup: `pg_dump -U postgres -t unified_picks unittalk > backup_unified_picks.sql`
- [ ] Backup verified (can be restored): Test restore to separate database
- [ ] Backup stored in secure location (S3/GCS/local archive)
- [ ] Backup compressed (gzip) if > 1GB

```bash
# Full backup with compression
docker-compose exec postgres pg_dump -U postgres unittalk | gzip > backup_full_$(date +%Y%m%d_%H%M%S).sql.gz

# Verify backup integrity
gunzip -c backup_full_*.sql.gz | head -n 20

# Test restore (optional, in separate DB)
docker-compose exec postgres createdb -U postgres unittalk_test
gunzip -c backup_full_*.sql.gz | docker-compose exec -T postgres psql -U postgres unittalk_test
```

#### Migration Window Scheduling
- [ ] Maintenance window scheduled (4-6 hours recommended)
- [ ] Stakeholders notified (48 hours advance notice)
- [ ] Status page updated (if applicable)
- [ ] On-call engineer assigned
- [ ] Rollback plan reviewed and approved

---

## Migration Execution Phase

### Step 1: Core Tables Creation

**Duration:** 5-10 minutes

- [ ] Run `10_core_tables.sql` migration
- [ ] Verify tables created successfully
- [ ] Check column counts match expectations

```bash
docker-compose exec postgres psql -U postgres -d unittalk -f /migrations/10_core_tables.sql
```

**Verification:**
```sql
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('raw_props', 'scored_props', 'promotion_queue', 'settled_outcomes', 'agent_health', 'agent_metrics')
ORDER BY table_name;
```

**Expected Results:**
- `raw_props`: ~20 columns
- `scored_props`: ~25 columns
- `promotion_queue`: ~15 columns
- `settled_outcomes`: ~12 columns
- `agent_health`: ~10 columns
- `agent_metrics`: ~12 columns

**Rollback:**
```sql
DROP TABLE IF EXISTS raw_props CASCADE;
DROP TABLE IF EXISTS scored_props CASCADE;
DROP TABLE IF EXISTS promotion_queue CASCADE;
DROP TABLE IF EXISTS settled_outcomes CASCADE;
DROP TABLE IF EXISTS agent_health CASCADE;
DROP TABLE IF EXISTS agent_metrics CASCADE;
```

---

### Step 2: Indexes Creation

**Duration:** 10-20 minutes (depends on data volume)

- [ ] Run `11_indexes.sql` migration
- [ ] Verify indexes created on all tables
- [ ] Check index sizes reasonable

```bash
docker-compose exec postgres psql -U postgres -d unittalk -f /migrations/11_indexes.sql
```

**Verification:**
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('raw_props', 'scored_props', 'promotion_queue', 'settled_outcomes')
ORDER BY tablename, indexname;
```

**Performance Check:**
```sql
-- Test index usage on common query patterns
EXPLAIN ANALYZE
SELECT * FROM raw_props
WHERE game_date >= CURRENT_DATE
  AND sport = 'nfl'
ORDER BY created_at DESC
LIMIT 100;
```

**Rollback:**
```sql
-- Drop all indexes on new tables
DROP INDEX IF EXISTS idx_raw_props_game_date;
DROP INDEX IF EXISTS idx_raw_props_sport_game_date;
-- ... (drop remaining indexes as needed)
```

---

### Step 3: Partitioning Setup (Optional)

**Duration:** 5-10 minutes

- [ ] Run `12_partitions.sql` migration (if using partitioning)
- [ ] Verify partitions created
- [ ] Check partition boundaries correct

```bash
docker-compose exec postgres psql -U postgres -d unittalk -f /migrations/12_partitions.sql
```

**Verification:**
```sql
SELECT
  parent.relname as parent_table,
  child.relname as partition_name,
  pg_get_expr(child.relpartbound, child.oid) as partition_boundary
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname IN ('raw_props', 'scored_props')
ORDER BY parent.relname, child.relname;
```

**Skip if:**
- Data volume < 1M rows
- Single-tenant deployment
- Partitioning not required by architecture

---

### Step 4: RLS Policies

**Duration:** 5 minutes

- [ ] Run `13_rls_policies.sql` migration
- [ ] Verify RLS enabled on all tables
- [ ] Test policies with different user roles

```bash
docker-compose exec postgres psql -U postgres -d unittalk -f /migrations/13_rls_policies.sql
```

**Verification:**
```sql
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('raw_props', 'scored_props', 'promotion_queue', 'settled_outcomes')
ORDER BY tablename, policyname;
```

**Security Test:**
```sql
-- Test as authenticated user (should see only their data)
SET ROLE authenticated;
SELECT COUNT(*) FROM raw_props;
RESET ROLE;

-- Test as service_role (should see all data)
SET ROLE service_role;
SELECT COUNT(*) FROM raw_props;
RESET ROLE;
```

---

### Step 5: Analytical Views

**Duration:** 5 minutes

- [ ] Run `20_views.sql` migration
- [ ] Verify views created successfully
- [ ] Test view queries return expected results

```bash
docker-compose exec postgres psql -U postgres -d unittalk -f /migrations/20_views.sql
```

**Verification:**
```sql
SELECT
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname LIKE '%_summary' OR viewname LIKE '%_analytics'
ORDER BY viewname;

-- Test each view
SELECT COUNT(*) FROM picks_by_sport_summary;
SELECT COUNT(*) FROM daily_performance_analytics;
-- ... (test other views)
```

---

### Step 6: RPC Functions

**Duration:** 5 minutes

- [ ] Run `30_rpcs.sql` migration
- [ ] Verify functions created successfully
- [ ] Test each RPC with sample data

```bash
docker-compose exec postgres psql -U postgres -d unittalk -f /migrations/30_rpcs.sql
```

**Verification:**
```sql
SELECT
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'rpc_%'
ORDER BY routine_name;

-- Test approval workflow RPC
SELECT rpc_approve_pick(
  p_prop_id := (SELECT id FROM raw_props LIMIT 1),
  p_approved_by := '00000000-0000-0000-0000-000000000000'::UUID,
  p_tier := 1
);
```

---

### Step 7: Unified Picks Compatibility View

**Duration:** 5 minutes

**CRITICAL:** This step renames `unified_picks` to `unified_picks_legacy`

- [ ] Run `40_unified_picks_view.sql` migration
- [ ] Verify `unified_picks_legacy` table exists
- [ ] Verify `unified_picks` view created successfully
- [ ] Compare row counts: view vs legacy table

```bash
docker-compose exec postgres psql -U postgres -d unittalk -f /migrations/40_unified_picks_view.sql
```

**Verification:**
```sql
-- Check both legacy table and new view exist
SELECT
  'unified_picks_legacy' as name,
  'table' as type,
  (SELECT COUNT(*) FROM unified_picks_legacy) as row_count
UNION ALL
SELECT
  'unified_picks' as name,
  'view' as type,
  (SELECT COUNT(*) FROM unified_picks) as row_count;

-- Verify view structure matches legacy table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'unified_picks'
ORDER BY ordinal_position;

-- Sample data comparison
SELECT * FROM unified_picks_legacy LIMIT 5;
SELECT * FROM unified_picks LIMIT 5;
```

**Expected Results:**
- `unified_picks_legacy`: Original row count (e.g., 5,693)
- `unified_picks` (view): May be fewer rows (30-day rolling window)

**Rollback:**
```sql
DROP VIEW IF EXISTS unified_picks CASCADE;
ALTER TABLE unified_picks_legacy RENAME TO unified_picks;
```

---

### Step 8: Data Backfill

**Duration:** 10-60 minutes (depends on data volume)

**CRITICAL:** This is the longest-running step

- [ ] Run `50_backfill_raw_props.sql` migration
- [ ] Monitor progress in real-time (separate terminal)
- [ ] Verify row counts match expectations
- [ ] Check for errors in logs

```bash
# Terminal 1: Run backfill
docker-compose exec postgres psql -U postgres -d unittalk -f /migrations/50_backfill_raw_props.sql

# Terminal 2: Monitor progress
watch -n 5 "docker-compose exec postgres psql -U postgres -d unittalk -c \"
SELECT
  'raw_props' as table_name,
  COUNT(*) as current_count,
  (SELECT COUNT(*) FROM unified_picks_legacy) as target_count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM unified_picks_legacy), 2) as progress_pct
FROM raw_props
WHERE metadata->>'backfilled_from' = 'unified_picks_legacy';
\""
```

**Expected Progress:**
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
  Batch 3/6 | Inserted: 1000 | Total: 3000 | Duration: 212 ms
  Batch 4/6 | Inserted: 1000 | Total: 4000 | Duration: 189 ms
  Batch 5/6 | Inserted: 1000 | Total: 5000 | Duration: 201 ms
  Batch 6/6 | Inserted: 693 | Total: 5693 | Duration: 145 ms
  ✓ Checkpoint: 5693 rows migrated
═══════════════════════════════════════════════════════════════
✓ BACKFILL COMPLETE
═══════════════════════════════════════════════════════════════
Total records migrated: 5693
Total duration: 00:00:01.179
───────────────────────────────────────────────────────────────
```

**Validation:**
```sql
-- Row count comparison
SELECT
  (SELECT COUNT(*) FROM unified_picks_legacy) as legacy_count,
  (SELECT COUNT(*) FROM raw_props WHERE metadata->>'backfilled_from' = 'unified_picks_legacy') as backfilled_count,
  ROUND(100.0 * (SELECT COUNT(*) FROM raw_props WHERE metadata->>'backfilled_from' = 'unified_picks_legacy') /
        (SELECT COUNT(*) FROM unified_picks_legacy), 2) as coverage_pct;

-- Data integrity check
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE sport IS NULL) as null_sport,
  COUNT(*) FILTER (WHERE game_date IS NULL) as null_game_date,
  COUNT(*) FILTER (WHERE selection IS NULL) as null_selection
FROM raw_props;
```

**Rollback:**
```sql
DELETE FROM raw_props WHERE metadata->>'backfilled_from' = 'unified_picks_legacy';
```

---

## Writer Redirection Phase

**CRITICAL:** Update application code to write to new tables

### FeedAgent → raw_props

- [ ] Update `apps/api/src/agents/FeedAgent/index.ts`
- [ ] Change: `unifiedPicksRepo.insert()` → `rawPropsRepo.insert()`
- [ ] Test ingestion: `docker-compose exec api npx tsx scripts/e2e/runFeedAgent.ts`
- [ ] Verify new props in `raw_props` table

**Code Changes:**
```typescript
// OLD (legacy)
await this.unifiedPicksRepo.insert({
  sport, market, selection, line, odds, ...
});

// NEW (v3.0)
await this.rawPropsRepo.insert({
  sport, market, player_name, selection, line, odds, bookmaker_key, ...
});
```

**Verification:**
```sql
-- Check for new props created after migration
SELECT COUNT(*) FROM raw_props
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND metadata->>'backfilled_from' IS NULL;
```

---

### ScoringAgent → scored_props

- [ ] Update `apps/api/src/agents/ScoringAgent/index.ts`
- [ ] Change: Write scores to `scored_props` instead of `unified_picks`
- [ ] Test scoring: `docker-compose exec api npx tsx scripts/e2e/runScoringAgent.ts`
- [ ] Verify scores in `scored_props` table

**Code Changes:**
```typescript
// OLD (legacy)
await this.unifiedPicksRepo.update(pickId, {
  professional_score, prob_win, tier, ...
});

// NEW (v3.0)
await this.scoredPropsRepo.insert({
  prop_ref: rawPropId,
  professional_score,
  prob_win,
  edge,
  tier,
  market_factors,
  player_factors,
  matchup_factors,
  price_factors,
  meta_factors,
  ...
});
```

**Verification:**
```sql
-- Check for scored props
SELECT
  COUNT(*) as total_scored,
  AVG(professional_score) as avg_score,
  AVG(prob_win) as avg_prob_win
FROM scored_props
WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

### Command Center → promotion_queue RPCs

- [ ] Update `apps/command-center/src/components/PickApproval.tsx`
- [ ] Change: Direct DB writes → Use `rpc_approve_pick()` function
- [ ] Test approval workflow in Command Center UI
- [ ] Verify approved picks in `promotion_queue`

**Code Changes:**
```typescript
// OLD (legacy)
await supabase.from('unified_picks').update({
  status: 'approved',
  approved_by: userId,
  approved_at: new Date().toISOString()
}).eq('id', pickId);

// NEW (v3.0)
await supabase.rpc('rpc_approve_pick', {
  p_prop_id: propId,
  p_approved_by: userId,
  p_tier: tier
});
```

**Verification:**
```sql
-- Check promotion queue
SELECT
  status,
  COUNT(*) as count
FROM promotion_queue
GROUP BY status;
```

---

### SettlementEngine → settled_outcomes

- [ ] Update `apps/api/src/agents/SettlementAgent/index.ts`
- [ ] Change: Write settlements to `settled_outcomes` instead of `unified_picks`
- [ ] Test settlement: `docker-compose exec api npx tsx scripts/settle-picks.ts`
- [ ] Verify settlements in `settled_outcomes`

**Code Changes:**
```typescript
// OLD (legacy)
await this.unifiedPicksRepo.update(pickId, {
  status: 'settled',
  actual_result: result,
  profit_loss: pl,
  settled_at: new Date()
});

// NEW (v3.0)
await this.settledOutcomesRepo.insert({
  prop_id: rawPropId,
  decision: 'win' | 'loss' | 'push',
  actual_result: result,
  settled_at: new Date(),
  metadata: { ... }
});
```

**Verification:**
```sql
-- Check settled outcomes
SELECT
  decision,
  COUNT(*) as count,
  AVG(actual_result) as avg_result
FROM settled_outcomes
WHERE settled_at > NOW() - INTERVAL '1 hour'
GROUP BY decision;
```

---

## Dual-Write Period (24-48 hours)

**Purpose:** Validate new architecture while maintaining legacy fallback

### Enable Dual-Write Mode

- [ ] Set environment variable: `ENABLE_DUAL_WRITE=true`
- [ ] Restart services: `./dev.sh restart`
- [ ] Monitor error rates in Grafana
- [ ] Compare row counts: legacy vs new tables

**Configuration:**
```bash
# In .env
ENABLE_DUAL_WRITE=true
DUAL_WRITE_FAIL_ON_ERROR=false  # Allow legacy writes to fail silently
```

**Code Pattern:**
```typescript
async function writePickData(data: PickData) {
  // Write to new architecture (primary)
  await rawPropsRepo.insert(data);

  // Dual-write to legacy (fallback)
  if (process.env.ENABLE_DUAL_WRITE === 'true') {
    try {
      await unifiedPicksRepo.insert(data);
    } catch (error) {
      logger.warn('Legacy write failed (dual-write mode)', error);
      // Don't throw - new architecture is source of truth
    }
  }
}
```

### Monitoring During Dual-Write

- [ ] Monitor row count deltas every hour
- [ ] Check for write errors in logs
- [ ] Compare data consistency between legacy and new tables
- [ ] Measure query performance (should improve)

**Monitoring Queries:**
```sql
-- Row count comparison (hourly check)
SELECT
  'unified_picks_legacy' as table_name,
  COUNT(*) as count,
  MAX(created_at) as latest_record
FROM unified_picks_legacy
UNION ALL
SELECT
  'raw_props' as table_name,
  COUNT(*) as count,
  MAX(created_at) as latest_record
FROM raw_props;

-- Error rate check (from application logs)
SELECT
  timestamp,
  level,
  message
FROM logs
WHERE message LIKE '%dual-write%'
  AND level IN ('error', 'warn')
  AND timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;
```

**Success Criteria:**
- [ ] New tables receiving all writes correctly
- [ ] Query performance equal or better than legacy
- [ ] Zero data loss or corruption
- [ ] Error rate < 0.1%

---

## Cutover Completion Phase

### Disable Dual-Write

- [ ] Set environment variable: `ENABLE_DUAL_WRITE=false`
- [ ] Restart services: `./dev.sh restart`
- [ ] Verify no more writes to legacy table
- [ ] Monitor for any errors or regressions

```bash
# In .env
ENABLE_DUAL_WRITE=false
```

**Verification:**
```sql
-- Confirm no new writes to legacy table
SELECT MAX(created_at) as last_write
FROM unified_picks_legacy;

-- Should be timestamp from before dual-write disabled
```

---

### Drop Legacy Tables (After 7-Day Retention)

**CRITICAL:** Only after confirming stable operation for 7 days

- [ ] Verify 7 days have passed since cutover
- [ ] Confirm zero rollback requests or issues
- [ ] Create final backup of legacy table
- [ ] Drop legacy table and related objects

```bash
# Final backup before dropping legacy
docker-compose exec postgres pg_dump -U postgres -t unified_picks_legacy unittalk | gzip > backup_legacy_final_$(date +%Y%m%d).sql.gz
```

```sql
-- Drop legacy table (IRREVERSIBLE after this point)
DROP TABLE IF EXISTS unified_picks_legacy CASCADE;

-- Verify dropped
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'unified_picks_legacy';
-- Should return 0 rows
```

---

## Post-Migration Validation

### Row Count Verification

- [ ] Run comprehensive row count check
- [ ] Verify referential integrity
- [ ] Check for data loss

```sql
-- Comprehensive row count check
SELECT
  'raw_props' as table_name,
  COUNT(*) as total_rows,
  MIN(created_at) as earliest_record,
  MAX(created_at) as latest_record
FROM raw_props
UNION ALL
SELECT
  'scored_props' as table_name,
  COUNT(*) as total_rows,
  MIN(created_at) as earliest_record,
  MAX(created_at) as latest_record
FROM scored_props
UNION ALL
SELECT
  'promotion_queue' as table_name,
  COUNT(*) as total_rows,
  MIN(created_at) as earliest_record,
  MAX(created_at) as latest_record
FROM promotion_queue
UNION ALL
SELECT
  'settled_outcomes' as table_name,
  COUNT(*) as total_rows,
  MIN(created_at) as earliest_record,
  MAX(created_at) as latest_record
FROM settled_outcomes;
```

### View Row Count Check

- [ ] Test unified_picks view returns correct data
- [ ] Verify view row count reasonable (30-day window)
- [ ] Test JOIN performance

```sql
-- unified_picks view check
SELECT COUNT(*) FROM unified_picks;

-- Should return rows for games within 30 days
-- Verify matches: raw_props (30-day filter) joined with scored_props + promotion_queue
```

### RPC Function Testing

- [ ] Test approval workflow RPC
- [ ] Test rejection workflow RPC
- [ ] Test bulk operations (if implemented)

```sql
-- Test approval workflow
SELECT rpc_approve_pick(
  p_prop_id := (SELECT id FROM raw_props ORDER BY created_at DESC LIMIT 1),
  p_approved_by := '00000000-0000-0000-0000-000000000000'::UUID,
  p_tier := 1
);

-- Verify promotion_queue entry created
SELECT * FROM promotion_queue ORDER BY created_at DESC LIMIT 1;
```

### Command Center UI Testing

- [ ] Access Command Center: http://localhost:3004
- [ ] View pending picks (should load from unified_picks view)
- [ ] Approve a pick (should call rpc_approve_pick)
- [ ] Verify approval reflected in database
- [ ] Test filtering and sorting

**Manual Test Checklist:**
- [ ] Pending picks page loads without errors
- [ ] Pick details modal displays correctly
- [ ] Approve button triggers RPC successfully
- [ ] Approved pick moves to "Approved" tab
- [ ] Filters work correctly (sport, tier, date range)
- [ ] Pagination works correctly

### Smart Form Testing

- [ ] Access Smart Form: http://localhost:3002
- [ ] Submit a manual pick
- [ ] Verify pick appears in `raw_props`
- [ ] Verify scoring agent processes it (creates `scored_props` entry)
- [ ] Check Command Center shows new pick

### End-to-End Smoke Test

- [ ] Run complete E2E test suite
- [ ] FeedAgent ingests new props
- [ ] ScoringAgent scores props
- [ ] Command Center displays picks
- [ ] Approval workflow completes
- [ ] Settlement engine processes results

```bash
# Full E2E test
docker-compose exec api npx tsx scripts/e2e/everything.ts
```

**Expected Output:**
```
✓ FeedAgent: Ingested 150 props
✓ ScoringAgent: Scored 150 props (avg score: 67.8)
✓ Command Center: Displays 150 pending picks
✓ Approval: 10 picks approved successfully
✓ Settlement: 5 picks settled correctly
```

---

## Rollback Procedures

### Emergency Rollback (Critical Issues)

**Symptoms:** Data loss, critical bugs, performance degradation

```sql
-- 1. Stop all writes
-- Set ENABLE_WRITES=false in application

-- 2. Drop view and restore legacy table
DROP VIEW IF EXISTS unified_picks CASCADE;
ALTER TABLE unified_picks_legacy RENAME TO unified_picks;

-- 3. Verify restoration
SELECT COUNT(*) FROM unified_picks;

-- 4. Restart services
-- ./dev.sh restart
```

### Partial Rollback (Keep New Tables)

**Symptoms:** Issues with specific feature, want to keep new architecture

```sql
-- Rename view and restore legacy table alongside
ALTER VIEW unified_picks RENAME TO unified_picks_view_new;
ALTER TABLE unified_picks_legacy RENAME TO unified_picks;

-- Application can now query both old and new
```

### Complete Rollback (Nuclear Option)

**Symptoms:** Total migration failure, data corruption

```bash
# 1. Stop all services
./dev.sh stop

# 2. Restore from pre-migration backup
gunzip -c backup_full_YYYYMMDD.sql.gz | docker-compose exec -T postgres psql -U postgres unittalk

# 3. Verify restoration
docker-compose exec postgres psql -U postgres -d unittalk -c "SELECT COUNT(*) FROM unified_picks;"

# 4. Restart services
./dev.sh start
```

---

## Success Criteria

### Technical Criteria
- [ ] All new tables populated with correct data
- [ ] Zero broken foreign key references
- [ ] Indexes created and functioning
- [ ] RLS policies enforced correctly
- [ ] Views return expected results
- [ ] RPC functions execute without errors

### Functional Criteria
- [ ] FeedAgent ingests to raw_props successfully
- [ ] ScoringAgent writes to scored_props successfully
- [ ] Command Center approval workflow functional
- [ ] Settlement engine writes to settled_outcomes
- [ ] Smart Form submissions work end-to-end
- [ ] Discord bot integration unaffected

### Performance Criteria
- [ ] Query response times equal or better than legacy
- [ ] Write throughput equal or better than legacy
- [ ] No significant increase in CPU/RAM usage
- [ ] Database size within expected range (±10%)

### Business Criteria
- [ ] Zero data loss
- [ ] Zero downtime (beyond scheduled maintenance)
- [ ] All stakeholders satisfied with migration
- [ ] No customer-facing errors or issues

---

## Post-Cutover Monitoring

### Week 1 (Daily Checks)
- [ ] Monitor error logs for migration-related issues
- [ ] Check row counts daily
- [ ] Verify data consistency between tables
- [ ] Monitor query performance metrics
- [ ] Review user feedback and support tickets

### Week 2-4 (Weekly Checks)
- [ ] Run weekly performance benchmarks
- [ ] Compare metrics to pre-migration baseline
- [ ] Review and optimize slow queries
- [ ] Plan for legacy table removal (Day 7)

### Month 1-3 (Monthly Reviews)
- [ ] Comprehensive performance review
- [ ] Cost analysis (database size, compute resources)
- [ ] Plan for future optimizations (partitioning, archival)

---

## Lessons Learned & Documentation

- [ ] Document migration duration and any issues encountered
- [ ] Update architecture documentation with new schema
- [ ] Create knowledge base article for future migrations
- [ ] Share lessons learned with team
- [ ] Archive migration scripts and backups

---

## Final Sign-Off

- [ ] Database Engineer: Migration completed successfully
- [ ] Backend Lead: Application code updated and tested
- [ ] QA Lead: All tests pass, no regressions
- [ ] Product Owner: Business requirements met
- [ ] Operations Lead: Monitoring configured, stable operation confirmed

**Migration Completed:** [DATE/TIME]
**Signed Off By:** [NAME/ROLE]

---

**Document Version:** 1.0
**Last Updated:** 2025-10-03
**Owner:** Database Engineering Team
