-- Rollback Migration 023: SGO Backfill System
-- Removes SGO backfill system tables and functions

-- Drop functions first
DROP FUNCTION IF EXISTS sgo_backfill_system_health();
DROP FUNCTION IF EXISTS archive_to_cold_storage(TEXT, DATE);
DROP FUNCTION IF EXISTS move_to_warm_storage(TEXT, DATE);

-- Drop views
DROP VIEW IF EXISTS data_lifecycle_summary;
DROP VIEW IF EXISTS sgo_backfill_summary;
DROP VIEW IF EXISTS historical_config_summary;

-- Drop triggers
DROP TRIGGER IF EXISTS update_sgo_backfill_jobs_updated_at ON sgo_backfill_jobs;
DROP TRIGGER IF EXISTS update_workflow_progress_updated_at ON workflow_progress;
DROP TRIGGER IF EXISTS update_historical_config_updated_at ON historical_config;

-- Drop partitioned tables and their partitions
-- Get all partition names and drop them
DO $$
DECLARE
    partition_record RECORD;
BEGIN
    -- Drop archive_raw_props partitions
    FOR partition_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE 'archive_raw_props_%'
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(partition_record.tablename) || ' CASCADE';
    END LOOP;
    
    -- Drop archive_games partitions  
    FOR partition_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE 'archive_games_%'
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(partition_record.tablename) || ' CASCADE';
    END LOOP;
END
$$;

-- Drop main partitioned tables
DROP TABLE IF EXISTS archive_raw_props CASCADE;
DROP TABLE IF EXISTS archive_games CASCADE;

-- Drop regular tables
DROP TABLE IF EXISTS data_lifecycle_log CASCADE;
DROP TABLE IF EXISTS sgo_backfill_jobs CASCADE;
DROP TABLE IF EXISTS workflow_progress CASCADE;
DROP TABLE IF EXISTS historical_config CASCADE;

-- Remove settlement job record
DELETE FROM settlement_jobs WHERE job_id = 'migration-023-sgo-backfill-init';