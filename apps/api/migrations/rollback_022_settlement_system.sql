-- Rollback Migration 022: Settlement System
-- Removes settlement columns and related structures

-- Drop triggers first
DROP TRIGGER IF EXISTS settlement_audit_trigger ON unified_picks;

-- Drop functions
DROP FUNCTION IF EXISTS trigger_settlement_audit();
DROP FUNCTION IF EXISTS settlement_system_health();

-- Drop views
DROP VIEW IF EXISTS settlement_stats_view;

-- Drop tables
DROP TABLE IF EXISTS settlement_audit_log;
DROP TABLE IF EXISTS settlement_jobs;

-- Drop indexes (if they exist)
DROP INDEX CONCURRENTLY IF EXISTS idx_unified_picks_settled_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_unified_picks_unsettled;
DROP INDEX CONCURRENTLY IF EXISTS idx_unified_picks_external_game_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_unified_picks_player_lookup;
DROP INDEX CONCURRENTLY IF EXISTS idx_unified_picks_settlement_source;
DROP INDEX CONCURRENTLY IF EXISTS idx_unified_picks_recent_unsettled;

-- Remove settlement columns from unified_picks
DO $$
BEGIN
    -- Remove settlement-specific columns
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'unified_picks' AND column_name = 'actual_stat') THEN
        ALTER TABLE unified_picks DROP COLUMN actual_stat;
    END IF;

    -- Keep outcome column but restore original constraint
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'unified_picks' AND column_name = 'outcome') THEN
        ALTER TABLE unified_picks DROP CONSTRAINT IF EXISTS unified_picks_outcome_check;
        ALTER TABLE unified_picks ADD CONSTRAINT unified_picks_outcome_check 
            CHECK (outcome IN ('over','under','yes','no'));
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'unified_picks' AND column_name = 'settled_at') THEN
        ALTER TABLE unified_picks DROP COLUMN settled_at;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'unified_picks' AND column_name = 'settlement_source') THEN
        ALTER TABLE unified_picks DROP COLUMN settlement_source;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'unified_picks' AND column_name = 'settlement_version') THEN
        ALTER TABLE unified_picks DROP COLUMN settlement_version;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'unified_picks' AND column_name = 'settlement_notes') THEN
        ALTER TABLE unified_picks DROP COLUMN settlement_notes;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'unified_picks' AND column_name = 'external_game_id') THEN
        ALTER TABLE unified_picks DROP COLUMN external_game_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'unified_picks' AND column_name = 'external_player_id') THEN
        ALTER TABLE unified_picks DROP COLUMN external_player_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'unified_picks' AND column_name = 'sport') THEN
        ALTER TABLE unified_picks DROP COLUMN sport;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'unified_picks' AND column_name = 'stat_type') THEN
        ALTER TABLE unified_picks DROP COLUMN stat_type;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'unified_picks' AND column_name = 'player_name') THEN
        ALTER TABLE unified_picks DROP COLUMN player_name;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'unified_picks' AND column_name = 'game_date') THEN
        ALTER TABLE unified_picks DROP COLUMN game_date;
    END IF;
END
$$;

-- Restore original status values
UPDATE unified_picks SET status = 'win' WHERE status = 'won';
UPDATE unified_picks SET status = 'loss' WHERE status = 'lost';

-- Note: This rollback removes all settlement functionality
-- Any settled picks will lose their settlement data
-- Ensure you have backups before running this rollback