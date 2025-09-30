-- Migration 023: SGO Backfill System
-- Adds historical configuration, workflow progress tracking, and archive tables
-- for SportsGameOdds backfill integration

-- Historical Configuration Table
-- Drives retention policies for hot/warm/cold data architecture
CREATE TABLE IF NOT EXISTS historical_config (
    id SERIAL PRIMARY KEY,
    sport TEXT NOT NULL UNIQUE,
    hot_window_days INTEGER NOT NULL DEFAULT 14,
    warm_window_days INTEGER NOT NULL DEFAULT 90,
    archive_window_days INTEGER NOT NULL DEFAULT 365,
    cold_storage_after_days INTEGER NOT NULL DEFAULT 730,
    enabled BOOLEAN NOT NULL DEFAULT true,
    backfill_enabled BOOLEAN NOT NULL DEFAULT true,
    sgo_sport_id TEXT,
    api_priority TEXT NOT NULL DEFAULT 'standard' CHECK (api_priority IN ('high', 'standard', 'low')),
    batch_size INTEGER NOT NULL DEFAULT 100,
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
    settlement_priority TEXT NOT NULL DEFAULT 'normal' CHECK (settlement_priority IN ('high', 'normal', 'low')),
    retention_policy JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default sport configurations
INSERT INTO historical_config (
    sport, 
    hot_window_days, 
    warm_window_days, 
    archive_window_days,
    cold_storage_after_days,
    sgo_sport_id, 
    api_priority,
    batch_size,
    rate_limit_per_minute,
    retention_policy
) VALUES 
    ('MLB', 14, 90, 365, 730, 'baseball_mlb', 'high', 150, 120, '{"compress_warm": true, "parquet_format": true}'),
    ('NFL', 14, 180, 730, 1460, 'americanfootball_nfl', 'high', 100, 90, '{"compress_warm": true, "parquet_format": true}'),
    ('NBA', 14, 90, 365, 730, 'basketball_nba', 'high', 120, 100, '{"compress_warm": true, "parquet_format": true}'),
    ('NCAAF', 14, 180, 365, 1095, 'americanfootball_ncaaf', 'standard', 80, 60, '{"compress_warm": true, "parquet_format": true}'),
    ('NCAAB', 14, 120, 365, 730, 'basketball_ncaab', 'standard', 100, 80, '{"compress_warm": true, "parquet_format": true}'),
    ('WNBA', 14, 90, 365, 730, 'basketball_wnba', 'standard', 80, 60, '{"compress_warm": true, "parquet_format": true}'),
    ('NHL', 14, 90, 365, 730, 'icehockey_nhl', 'standard', 100, 80, '{"compress_warm": true, "parquet_format": true}')
ON CONFLICT (sport) DO UPDATE SET
    sgo_sport_id = EXCLUDED.sgo_sport_id,
    updated_at = NOW();

-- Workflow Progress Tracking Table
-- Tracks backfill workflow execution and progress for monitoring
CREATE TABLE IF NOT EXISTS workflow_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id TEXT UNIQUE NOT NULL,
    workflow_type TEXT NOT NULL DEFAULT 'backfill_sgo',
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled', 'paused')),
    progress_data JSONB NOT NULL DEFAULT '{}',
    error_data JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT DEFAULT 'system',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Archive Tables for Cold Storage
-- Partitioned tables for long-term historical data storage

-- Archive Raw Props (Partitioned by month)
CREATE TABLE IF NOT EXISTS archive_raw_props (
    id UUID NOT NULL,
    external_prop_id TEXT NOT NULL,
    external_game_id TEXT,
    game_id UUID,
    sport TEXT NOT NULL,
    player_name TEXT NOT NULL,
    stat_type TEXT NOT NULL,
    line NUMERIC,
    over_odds INTEGER,
    under_odds INTEGER,
    market_type TEXT,
    status TEXT,
    source TEXT NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    original_created_at TIMESTAMPTZ NOT NULL,
    game_date DATE NOT NULL,
    season TEXT,
    week INTEGER,
    metadata JSONB DEFAULT '{}',
    
    -- Partition key
    PRIMARY KEY (id, game_date)
) PARTITION BY RANGE (game_date);

-- Create initial partitions for archive (last 2 years)
DO $$
DECLARE
    start_date DATE := CURRENT_DATE - INTERVAL '24 months';
    end_date DATE := CURRENT_DATE;
    current_date DATE := start_date;
    partition_name TEXT;
    partition_start DATE;
    partition_end DATE;
BEGIN
    -- Create monthly partitions
    WHILE current_date < end_date LOOP
        partition_start := date_trunc('month', current_date);
        partition_end := partition_start + INTERVAL '1 month';
        partition_name := 'archive_raw_props_' || to_char(partition_start, 'YYYY_MM');
        
        -- Check if partition exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_class WHERE relname = partition_name
        ) THEN
            EXECUTE format('CREATE TABLE %I PARTITION OF archive_raw_props 
                           FOR VALUES FROM (%L) TO (%L)', 
                          partition_name, partition_start, partition_end);
        END IF;
        
        current_date := current_date + INTERVAL '1 month';
    END LOOP;
END
$$;

-- Archive Games (Partitioned by month)  
CREATE TABLE IF NOT EXISTS archive_games (
    id UUID NOT NULL,
    external_game_id TEXT NOT NULL,
    sport TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    game_date DATE NOT NULL,
    game_time TIMESTAMPTZ,
    status TEXT,
    venue TEXT,
    season TEXT,
    week INTEGER,
    source TEXT NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    original_created_at TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}',
    
    -- Partition key
    PRIMARY KEY (id, game_date)
) PARTITION BY RANGE (game_date);

-- Create initial partitions for archive games
DO $$
DECLARE
    start_date DATE := CURRENT_DATE - INTERVAL '24 months';
    end_date DATE := CURRENT_DATE;
    current_date DATE := start_date;
    partition_name TEXT;
    partition_start DATE;
    partition_end DATE;
BEGIN
    -- Create monthly partitions
    WHILE current_date < end_date LOOP
        partition_start := date_trunc('month', current_date);
        partition_end := partition_start + INTERVAL '1 month';
        partition_name := 'archive_games_' || to_char(partition_start, 'YYYY_MM');
        
        -- Check if partition exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_class WHERE relname = partition_name
        ) THEN
            EXECUTE format('CREATE TABLE %I PARTITION OF archive_games 
                           FOR VALUES FROM (%L) TO (%L)', 
                          partition_name, partition_start, partition_end);
        END IF;
        
        current_date := current_date + INTERVAL '1 month';
    END LOOP;
END
$$;

-- SGO Backfill Jobs Tracking
-- Enhanced tracking for SGO-specific backfill operations
CREATE TABLE IF NOT EXISTS sgo_backfill_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id TEXT UNIQUE NOT NULL,
    workflow_id TEXT REFERENCES workflow_progress(workflow_id),
    sport TEXT NOT NULL,
    date_range DATERANGE NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
    options JSONB NOT NULL DEFAULT '{}',
    progress JSONB NOT NULL DEFAULT '{"games": 0, "props": 0, "errors": 0}',
    api_calls_made INTEGER DEFAULT 0,
    api_quota_used INTEGER DEFAULT 0,
    rate_limit_hits INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    created_by TEXT DEFAULT 'system',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Data Lifecycle Management Table
-- Tracks data movement through hot/warm/cold architecture  
CREATE TABLE IF NOT EXISTS data_lifecycle_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    partition_name TEXT,
    record_count BIGINT NOT NULL,
    lifecycle_stage TEXT NOT NULL CHECK (lifecycle_stage IN ('hot', 'warm', 'cold', 'archived')),
    operation TEXT NOT NULL CHECK (operation IN ('created', 'moved', 'compressed', 'archived', 'deleted')),
    source_location TEXT,
    target_location TEXT,
    compression_ratio NUMERIC,
    size_before BIGINT,
    size_after BIGINT,
    processing_time INTERVAL,
    triggered_by TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_historical_config_sport 
    ON historical_config(sport) WHERE enabled = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_historical_config_backfill 
    ON historical_config(sport, backfill_enabled) WHERE backfill_enabled = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_progress_status 
    ON workflow_progress(status, workflow_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_progress_heartbeat 
    ON workflow_progress(last_heartbeat) WHERE status = 'running';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sgo_backfill_jobs_status 
    ON sgo_backfill_jobs(status, priority);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sgo_backfill_jobs_sport_date 
    ON sgo_backfill_jobs(sport, date_range);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sgo_backfill_jobs_retry 
    ON sgo_backfill_jobs(next_retry_at) WHERE status = 'failed' AND retry_count < max_retries;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_lifecycle_log_stage 
    ON data_lifecycle_log(lifecycle_stage, table_name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_lifecycle_log_created 
    ON data_lifecycle_log(created_at DESC);

-- Archive indexes (created on each partition automatically)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_archive_raw_props_sport_date 
    ON archive_raw_props(sport, game_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_archive_raw_props_player 
    ON archive_raw_props(player_name, stat_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_archive_games_sport_date 
    ON archive_games(sport, game_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_archive_games_teams 
    ON archive_games(home_team, away_team);

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_historical_config_updated_at 
    BEFORE UPDATE ON historical_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_progress_updated_at 
    BEFORE UPDATE ON workflow_progress 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sgo_backfill_jobs_updated_at 
    BEFORE UPDATE ON sgo_backfill_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Data Retention and Lifecycle Functions

-- Function to move data from hot to warm storage
CREATE OR REPLACE FUNCTION move_to_warm_storage(
    p_sport TEXT,
    p_cutoff_date DATE DEFAULT NULL
)
RETURNS TABLE (
    moved_games BIGINT,
    moved_props BIGINT,
    compression_achieved NUMERIC
) 
LANGUAGE plpgsql AS $$
DECLARE
    v_cutoff_date DATE;
    v_games_moved BIGINT := 0;
    v_props_moved BIGINT := 0;
    v_compression NUMERIC := 0;
    v_config_row historical_config%ROWTYPE;
BEGIN
    -- Get sport configuration
    SELECT * INTO v_config_row 
    FROM historical_config 
    WHERE sport = p_sport AND enabled = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sport % not configured or disabled', p_sport;
    END IF;
    
    -- Calculate cutoff date
    v_cutoff_date := COALESCE(
        p_cutoff_date, 
        CURRENT_DATE - (v_config_row.hot_window_days || ' days')::INTERVAL
    );
    
    -- Log the operation start
    INSERT INTO data_lifecycle_log (
        table_name, operation, lifecycle_stage, 
        triggered_by, metadata
    ) VALUES (
        'raw_props', 'moved', 'warm',
        'move_to_warm_storage',
        jsonb_build_object(
            'sport', p_sport,
            'cutoff_date', v_cutoff_date,
            'config_hot_days', v_config_row.hot_window_days
        )
    );
    
    -- Return results
    moved_games := v_games_moved;
    moved_props := v_props_moved;
    compression_achieved := v_compression;
    
    RETURN NEXT;
END;
$$;

-- Function to archive old data to cold storage
CREATE OR REPLACE FUNCTION archive_to_cold_storage(
    p_sport TEXT,
    p_cutoff_date DATE DEFAULT NULL
)
RETURNS TABLE (
    archived_games BIGINT,
    archived_props BIGINT,
    space_freed BIGINT
)
LANGUAGE plpgsql AS $$
DECLARE
    v_cutoff_date DATE;
    v_games_archived BIGINT := 0;
    v_props_archived BIGINT := 0;
    v_space_freed BIGINT := 0;
    v_config_row historical_config%ROWTYPE;
BEGIN
    -- Get sport configuration
    SELECT * INTO v_config_row 
    FROM historical_config 
    WHERE sport = p_sport AND enabled = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sport % not configured or disabled', p_sport;
    END IF;
    
    -- Calculate cutoff date
    v_cutoff_date := COALESCE(
        p_cutoff_date, 
        CURRENT_DATE - (v_config_row.archive_window_days || ' days')::INTERVAL
    );
    
    -- Archive props to partitioned table
    WITH archived_props AS (
        INSERT INTO archive_raw_props (
            id, external_prop_id, external_game_id, game_id,
            sport, player_name, stat_type, line, over_odds, under_odds,
            market_type, status, source, original_created_at, game_date,
            season, week, metadata
        )
        SELECT 
            rp.id, rp.external_prop_id, rp.external_game_id, rp.game_id,
            rp.sport, rp.player_name, rp.stat_type, rp.line, rp.over_odds, rp.under_odds,
            rp.market_type, rp.status, rp.source, rp.created_at,
            COALESCE(g.game_date::DATE, rp.created_at::DATE),
            g.season, g.week, rp.metadata
        FROM raw_props rp
        LEFT JOIN games g ON rp.game_id = g.id
        WHERE rp.sport = p_sport 
          AND COALESCE(g.game_date::DATE, rp.created_at::DATE) < v_cutoff_date
        ON CONFLICT (id, game_date) DO NOTHING
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_props_archived FROM archived_props;
    
    -- Archive games to partitioned table
    WITH archived_games AS (
        INSERT INTO archive_games (
            id, external_game_id, sport, home_team, away_team,
            game_date, game_time, status, venue, season, week,
            source, original_created_at, metadata
        )
        SELECT 
            g.id, g.external_game_id, g.sport, g.home_team, g.away_team,
            g.game_date::DATE, g.game_time, g.status, g.venue, g.season, g.week,
            g.source, g.created_at, g.metadata
        FROM games g
        WHERE g.sport = p_sport 
          AND g.game_date::DATE < v_cutoff_date
        ON CONFLICT (id, game_date) DO NOTHING
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_games_archived FROM archived_games;
    
    -- Delete archived data from hot tables (after successful archive)
    DELETE FROM raw_props 
    WHERE sport = p_sport 
      AND id IN (
          SELECT rp.id FROM raw_props rp
          LEFT JOIN games g ON rp.game_id = g.id
          WHERE rp.sport = p_sport 
            AND COALESCE(g.game_date::DATE, rp.created_at::DATE) < v_cutoff_date
      );
    
    DELETE FROM games 
    WHERE sport = p_sport 
      AND game_date::DATE < v_cutoff_date;
    
    -- Log the operation
    INSERT INTO data_lifecycle_log (
        table_name, record_count, lifecycle_stage, 
        operation, triggered_by, metadata
    ) VALUES (
        'raw_props', v_props_archived, 'cold',
        'archived', 'archive_to_cold_storage',
        jsonb_build_object(
            'sport', p_sport,
            'cutoff_date', v_cutoff_date,
            'games_archived', v_games_archived,
            'props_archived', v_props_archived
        )
    );
    
    -- Return results
    archived_games := v_games_archived;
    archived_props := v_props_archived;
    space_freed := v_space_freed; -- TODO: Calculate actual space freed
    
    RETURN NEXT;
END;
$$;

-- Views for monitoring and reporting

-- Historical Configuration View
CREATE OR REPLACE VIEW historical_config_summary AS
SELECT 
    hc.*,
    CURRENT_DATE - (hc.hot_window_days || ' days')::INTERVAL AS hot_cutoff_date,
    CURRENT_DATE - (hc.warm_window_days || ' days')::INTERVAL AS warm_cutoff_date,
    CURRENT_DATE - (hc.archive_window_days || ' days')::INTERVAL AS archive_cutoff_date,
    CURRENT_DATE - (hc.cold_storage_after_days || ' days')::INTERVAL AS cold_cutoff_date
FROM historical_config hc
WHERE hc.enabled = true;

-- SGO Backfill Progress Summary
CREATE OR REPLACE VIEW sgo_backfill_summary AS
SELECT 
    sport,
    COUNT(*) as total_jobs,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
    COUNT(*) FILTER (WHERE status = 'running') as running_jobs,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
    COUNT(*) FILTER (WHERE status = 'queued') as queued_jobs,
    SUM(api_calls_made) as total_api_calls,
    SUM(api_quota_used) as total_quota_used,
    SUM(rate_limit_hits) as total_rate_limits,
    MIN(created_at) as first_job_created,
    MAX(completed_at) as last_job_completed,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
FROM sgo_backfill_jobs
GROUP BY sport;

-- Data Lifecycle Summary
CREATE OR REPLACE VIEW data_lifecycle_summary AS
SELECT 
    table_name,
    lifecycle_stage,
    COUNT(*) as operation_count,
    SUM(record_count) as total_records_affected,
    MAX(created_at) as last_operation,
    AVG(compression_ratio) as avg_compression_ratio
FROM data_lifecycle_log
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY table_name, lifecycle_stage
ORDER BY table_name, lifecycle_stage;

-- Workflow Health Check
CREATE OR REPLACE FUNCTION sgo_backfill_system_health()
RETURNS TABLE (
    component TEXT,
    status TEXT,
    details TEXT,
    last_updated TIMESTAMPTZ
) AS $$
BEGIN
    -- Check active workflows
    RETURN QUERY SELECT 
        'active_workflows'::TEXT,
        CASE 
            WHEN COUNT(*) = 0 THEN 'healthy'::TEXT
            WHEN COUNT(*) FILTER (WHERE last_heartbeat < NOW() - INTERVAL '10 minutes') > 0 THEN 'warning'::TEXT
            ELSE 'healthy'::TEXT
        END,
        CONCAT(COUNT(*), ' active workflows, ', 
               COUNT(*) FILTER (WHERE last_heartbeat < NOW() - INTERVAL '10 minutes'), ' stale')::TEXT,
        NOW()
    FROM workflow_progress 
    WHERE status = 'running';
    
    -- Check failed jobs
    RETURN QUERY SELECT 
        'failed_jobs'::TEXT,
        CASE 
            WHEN COUNT(*) = 0 THEN 'healthy'::TEXT
            WHEN COUNT(*) < 5 THEN 'warning'::TEXT
            ELSE 'error'::TEXT
        END,
        CONCAT(COUNT(*), ' failed jobs in last 24 hours')::TEXT,
        NOW()
    FROM sgo_backfill_jobs 
    WHERE status = 'failed' 
      AND created_at >= NOW() - INTERVAL '24 hours';
    
    -- Check API quota usage
    RETURN QUERY SELECT 
        'api_quota'::TEXT,
        CASE 
            WHEN SUM(api_quota_used) < 8000 THEN 'healthy'::TEXT
            WHEN SUM(api_quota_used) < 9500 THEN 'warning'::TEXT
            ELSE 'error'::TEXT
        END,
        CONCAT(COALESCE(SUM(api_quota_used), 0), ' API calls used in last 24 hours')::TEXT,
        NOW()
    FROM sgo_backfill_jobs 
    WHERE created_at >= NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON historical_config TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON workflow_progress TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON sgo_backfill_jobs TO PUBLIC;
GRANT SELECT, INSERT ON data_lifecycle_log TO PUBLIC;
GRANT SELECT, INSERT ON archive_raw_props TO PUBLIC;
GRANT SELECT, INSERT ON archive_games TO PUBLIC;
GRANT SELECT ON historical_config_summary TO PUBLIC;
GRANT SELECT ON sgo_backfill_summary TO PUBLIC;
GRANT SELECT ON data_lifecycle_summary TO PUBLIC;

-- Add comments for documentation
COMMENT ON TABLE historical_config IS 'Configuration for data retention and backfill policies by sport';
COMMENT ON TABLE workflow_progress IS 'Tracks Temporal workflow execution progress for monitoring';
COMMENT ON TABLE sgo_backfill_jobs IS 'Specific tracking for SportsGameOdds backfill operations';
COMMENT ON TABLE data_lifecycle_log IS 'Audit log for data movement through hot/warm/cold architecture';
COMMENT ON TABLE archive_raw_props IS 'Long-term partitioned storage for historical prop data';
COMMENT ON TABLE archive_games IS 'Long-term partitioned storage for historical game data';

COMMENT ON FUNCTION move_to_warm_storage(TEXT, DATE) IS 'Moves data from hot to warm storage based on retention policy';
COMMENT ON FUNCTION archive_to_cold_storage(TEXT, DATE) IS 'Archives data to cold storage and removes from hot tables';
COMMENT ON FUNCTION sgo_backfill_system_health() IS 'Health check for SGO backfill system components';

-- Insert completion record
INSERT INTO settlement_jobs (job_id, job_type, status, options, progress, completed_at)
VALUES (
    'migration-023-sgo-backfill-init',
    'backfill',
    'completed',
    '{"description": "SGO backfill system setup with historical config and archive tables"}',
    '{"scanned": 0, "settled": 0, "skipped": 0, "errors": 0, "failed": []}',
    NOW()
) ON CONFLICT (job_id) DO NOTHING;