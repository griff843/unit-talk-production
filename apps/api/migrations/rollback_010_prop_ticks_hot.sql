-- =============================================================================
-- ROLLBACK: PROP_TICKS_HOT High-Volume Tick Data Table
-- Purpose: Safe rollback procedures for prop_ticks_hot table and related objects
-- =============================================================================

-- 1) Drop all triggers first to prevent cascading issues
DROP TRIGGER IF EXISTS trg_cleanup_prop_ticks ON prop_ticks_hot;

-- 2) Drop functions (in reverse dependency order)
DROP FUNCTION IF EXISTS cleanup_old_prop_ticks();
DROP FUNCTION IF EXISTS update_prop_ticks_stats();
DROP FUNCTION IF EXISTS manage_prop_ticks_partitions();
DROP FUNCTION IF EXISTS bulk_insert_prop_ticks(JSONB);

-- 3) Drop views
DROP VIEW IF EXISTS prop_ticks_performance;

-- 4) Revoke permissions
REVOKE ALL ON prop_ticks_hot FROM api_service;
REVOKE USAGE ON SEQUENCE prop_ticks_hot_tick_id_seq FROM api_service;
REVOKE ALL ON prop_ticks_performance FROM monitoring_service;

-- 5) Drop all indexes (CASCADE will handle partition indexes)
DROP INDEX IF EXISTS idx_prop_ticks_hot_timestamp_brin CASCADE;
DROP INDEX IF EXISTS idx_prop_ticks_hot_prop_brin CASCADE;
DROP INDEX IF EXISTS idx_prop_ticks_hot_book_hash CASCADE;
DROP INDEX IF EXISTS idx_prop_ticks_hot_source_hash CASCADE;
DROP INDEX IF EXISTS idx_prop_ticks_hot_prop_recent CASCADE;
DROP INDEX IF EXISTS idx_prop_ticks_hot_market_type CASCADE;

-- 6) Drop all partitions first (must be done before main table)
DO $$
DECLARE
  partition_name TEXT;
BEGIN
  FOR partition_name IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE tablename LIKE 'prop_ticks_hot_%'
    AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', partition_name);
  END LOOP;
END
$$;

-- 7) Drop main table (this will cascade to any remaining objects)
DROP TABLE IF EXISTS prop_ticks_hot CASCADE;

-- 8) Drop extensions if not used by other objects (optional - commented for safety)
-- DROP EXTENSION IF EXISTS pg_partman;
-- DROP EXTENSION IF EXISTS btree_gist;

-- 9) Remove any scheduled jobs (if pg_cron was used)
-- DELETE FROM cron.job WHERE jobname = 'manage-prop-ticks-partitions';

-- 10) Clean up any remaining sequences
DROP SEQUENCE IF EXISTS prop_ticks_hot_tick_id_seq CASCADE;

-- =============================================================================
-- ROLLBACK VERIFICATION QUERIES
-- =============================================================================
-- Run these queries to verify complete rollback:

-- Verify table is dropped
-- SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'prop_ticks_hot';

-- Verify partitions are dropped  
-- SELECT COUNT(*) FROM pg_tables WHERE tablename LIKE 'prop_ticks_hot_%';

-- Verify functions are dropped
-- SELECT COUNT(*) FROM pg_proc WHERE proname LIKE '%prop_ticks%';

-- Verify indexes are dropped
-- SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE '%prop_ticks%';

-- =============================================================================
-- ROLLBACK COMPLETE
-- =============================================================================