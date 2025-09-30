-- HOT/WARM/COLD Data Architecture Migration
-- Implements enterprise-grade data lifecycle management for 8K+ simultaneous props

-- =============================================
-- 1. HOT DATA TABLE (prop_ticks_hot)
-- =============================================
-- Store 7-14 days of high-frequency prop data in PostgreSQL
-- Optimized for sub-second query performance and real-time access

CREATE TABLE IF NOT EXISTS prop_ticks_hot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core prop identification
    prop_id VARCHAR(255) NOT NULL,
    external_prop_id VARCHAR(255),
    player_name VARCHAR(255) NOT NULL,
    sport VARCHAR(50) NOT NULL,
    stat_type VARCHAR(100) NOT NULL,
    
    -- Game context
    game_date DATE NOT NULL,
    game_time TIMESTAMPTZ NOT NULL,
    team VARCHAR(100),
    opponent VARCHAR(100),
    matchup VARCHAR(255),
    
    -- Market data (the actual "tick")
    line DECIMAL(10,2) NOT NULL,
    over_odds INTEGER,
    under_odds INTEGER,
    book VARCHAR(100) NOT NULL,
    
    -- Advanced market intelligence
    implied_probability DECIMAL(8,6),
    vig DECIMAL(8,4),
    true_odds DECIMAL(8,4),
    line_movement DECIMAL(10,2), -- Change from opening
    odds_movement INTEGER, -- Change from opening
    steam_detected BOOLEAN DEFAULT FALSE,
    sharp_money_indicator BOOLEAN DEFAULT FALSE,
    public_percentage DECIMAL(5,2),
    
    -- Timing and lifecycle
    tick_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    time_to_game INTEGER, -- Minutes to game start
    market_open_time TIMESTAMPTZ,
    market_close_time TIMESTAMPTZ,
    
    -- Data quality and source
    source VARCHAR(100) NOT NULL,
    provider VARCHAR(100),
    data_quality_score DECIMAL(4,2) DEFAULT 0.95,
    confidence_level DECIMAL(4,2) DEFAULT 0.80,
    
    -- Feature computation cache
    rolling_avg_7d DECIMAL(10,4),
    rolling_avg_30d DECIMAL(10,4),
    volatility_score DECIMAL(8,4),
    trend_direction INTEGER, -- -1, 0, 1
    market_efficiency_score DECIMAL(4,2),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days',
    archived_at TIMESTAMPTZ,
    
    -- Partitioning key
    partition_date DATE GENERATED ALWAYS AS (DATE(tick_timestamp)) STORED
) PARTITION BY RANGE (partition_date);

-- Create initial partitions for current month + next 3 months
-- This ensures smooth operation and prevents partition creation overhead
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
    end_date DATE;
    partition_name TEXT;
    i INTEGER;
BEGIN
    FOR i IN 0..3 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'prop_ticks_hot_' || TO_CHAR(start_date, 'YYYY_MM');
        
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF prop_ticks_hot 
                       FOR VALUES FROM (%L) TO (%L)',
                       partition_name, start_date, end_date);
        
        start_date := end_date;
    END LOOP;
END $$;

-- =============================================
-- 2. WARM DATA METADATA TABLE
-- =============================================
-- Track Parquet files in Supabase Storage

CREATE TABLE IF NOT EXISTS prop_ticks_warm_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- File identification
    file_path TEXT NOT NULL UNIQUE,
    bucket_name VARCHAR(100) NOT NULL DEFAULT 'prop-data-warm',
    file_size_bytes BIGINT NOT NULL,
    compression_ratio DECIMAL(4,2),
    
    -- Data range covered
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    record_count BIGINT NOT NULL,
    sports_covered TEXT[], -- Array of sports in this file
    
    -- Parquet metadata
    parquet_schema JSONB,
    column_stats JSONB, -- Min/max/null_count for each column
    file_metadata JSONB,
    
    -- Lifecycle
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ,
    access_count INTEGER DEFAULT 0,
    
    -- Quality assurance
    checksum VARCHAR(64), -- SHA-256 of file content
    validation_status VARCHAR(20) DEFAULT 'pending',
    validation_errors JSONB,
    
    -- Indexes for fast retrieval
    CONSTRAINT valid_date_range CHECK (date_to >= date_from)
);

-- =============================================
-- 3. COLD DATA METADATA TABLE
-- =============================================
-- Track archived data with lifecycle rules

CREATE TABLE IF NOT EXISTS prop_ticks_cold_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Archive identification
    archive_path TEXT NOT NULL UNIQUE,
    storage_class VARCHAR(50) NOT NULL DEFAULT 'GLACIER',
    archive_size_bytes BIGINT NOT NULL,
    
    -- Data range and content
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    record_count BIGINT NOT NULL,
    original_warm_files TEXT[], -- References to warm files archived
    
    -- Lifecycle management
    archived_at TIMESTAMPTZ DEFAULT NOW(),
    retrieval_cost_estimate DECIMAL(10,2),
    estimated_retrieval_time_hours INTEGER DEFAULT 12,
    
    -- Compliance and retention
    retention_until DATE,
    legal_hold BOOLEAN DEFAULT FALSE,
    compliance_tags JSONB,
    
    -- Access tracking
    last_retrieval_request TIMESTAMPTZ,
    retrieval_count INTEGER DEFAULT 0,
    
    CONSTRAINT valid_cold_date_range CHECK (date_to >= date_from)
);

-- =============================================
-- 4. DATA LIFECYCLE CONFIGURATION
-- =============================================
-- Configuration for automated lifecycle management

CREATE TABLE IF NOT EXISTS data_lifecycle_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Lifecycle rules
    hot_retention_days INTEGER NOT NULL DEFAULT 14,
    warm_retention_years INTEGER NOT NULL DEFAULT 2,
    cold_retention_years INTEGER NOT NULL DEFAULT 7,
    
    -- Processing configuration
    archival_batch_size INTEGER NOT NULL DEFAULT 10000,
    compression_level INTEGER NOT NULL DEFAULT 6, -- For Parquet
    max_parallel_jobs INTEGER NOT NULL DEFAULT 3,
    
    -- Feature computation
    feature_computation_enabled BOOLEAN DEFAULT TRUE,
    feature_batch_size INTEGER NOT NULL DEFAULT 5000,
    feature_computation_interval_minutes INTEGER NOT NULL DEFAULT 60,
    
    -- Quality thresholds
    min_data_quality_score DECIMAL(4,2) DEFAULT 0.90,
    max_error_rate DECIMAL(4,2) DEFAULT 0.01,
    
    -- Active configuration
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure only one active config
    CONSTRAINT single_active_config EXCLUDE (is_active WITH =) WHERE (is_active = TRUE)
);

-- Insert default configuration
INSERT INTO data_lifecycle_config (
    hot_retention_days,
    warm_retention_years,
    cold_retention_years,
    is_active
) VALUES (14, 2, 7, TRUE)
ON CONFLICT ON CONSTRAINT single_active_config DO NOTHING;

-- =============================================
-- 5. PERFORMANCE INDEXES
-- =============================================

-- HOT data indexes for sub-second queries
CREATE INDEX IF NOT EXISTS idx_prop_ticks_hot_prop_id ON prop_ticks_hot(prop_id, tick_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_prop_ticks_hot_player_sport ON prop_ticks_hot(player_name, sport, tick_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_prop_ticks_hot_game_date ON prop_ticks_hot(game_date, sport);
CREATE INDEX IF NOT EXISTS idx_prop_ticks_hot_book_time ON prop_ticks_hot(book, tick_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_prop_ticks_hot_steam ON prop_ticks_hot(steam_detected, tick_timestamp DESC) WHERE steam_detected = TRUE;
CREATE INDEX IF NOT EXISTS idx_prop_ticks_hot_expires ON prop_ticks_hot(expires_at) WHERE archived_at IS NULL;

-- Partial indexes for common queries
CREATE INDEX IF NOT EXISTS idx_prop_ticks_hot_recent_active 
    ON prop_ticks_hot(tick_timestamp DESC, sport, stat_type) 
    WHERE tick_timestamp >= NOW() - INTERVAL '24 hours';

CREATE INDEX IF NOT EXISTS idx_prop_ticks_hot_line_movement 
    ON prop_ticks_hot(line_movement, tick_timestamp DESC) 
    WHERE ABS(line_movement) > 0.5;

-- WARM metadata indexes
CREATE INDEX IF NOT EXISTS idx_warm_metadata_date_range ON prop_ticks_warm_metadata(date_from, date_to);
CREATE INDEX IF NOT EXISTS idx_warm_metadata_sports ON prop_ticks_warm_metadata USING GIN(sports_covered);
CREATE INDEX IF NOT EXISTS idx_warm_metadata_access ON prop_ticks_warm_metadata(last_accessed_at DESC);

-- COLD metadata indexes
CREATE INDEX IF NOT EXISTS idx_cold_metadata_date_range ON prop_ticks_cold_metadata(date_from, date_to);
CREATE INDEX IF NOT EXISTS idx_cold_metadata_retention ON prop_ticks_cold_metadata(retention_until) WHERE legal_hold = FALSE;

-- =============================================
-- 6. AUTOMATED CLEANUP FUNCTIONS
-- =============================================

-- Function to clean up expired HOT data
CREATE OR REPLACE FUNCTION cleanup_expired_hot_data()
RETURNS TABLE(
    cleaned_records BIGINT,
    freed_space_mb NUMERIC,
    partitions_dropped INTEGER
) AS $$
DECLARE
    config_row data_lifecycle_config%ROWTYPE;
    cleanup_before TIMESTAMPTZ;
    total_cleaned BIGINT := 0;
    space_estimate NUMERIC := 0;
    partitions_count INTEGER := 0;
BEGIN
    -- Get active configuration
    SELECT * INTO config_row FROM data_lifecycle_config WHERE is_active = TRUE LIMIT 1;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active data lifecycle configuration found';
    END IF;
    
    cleanup_before := NOW() - (config_row.hot_retention_days || ' days')::INTERVAL;
    
    -- Mark records as archived (don't delete immediately for safety)
    UPDATE prop_ticks_hot 
    SET archived_at = NOW() 
    WHERE tick_timestamp < cleanup_before 
      AND archived_at IS NULL;
    
    GET DIAGNOSTICS total_cleaned = ROW_COUNT;
    
    -- Estimate freed space (rough calculation)
    space_estimate := total_cleaned * 0.001; -- ~1KB per record estimate
    
    RETURN QUERY SELECT total_cleaned, space_estimate, partitions_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 7. MONITORING AND ALERTS
-- =============================================

-- Function to get data lifecycle health metrics
CREATE OR REPLACE FUNCTION get_data_lifecycle_metrics()
RETURNS JSONB AS $$
DECLARE
    result JSONB := '{}';
    hot_count BIGINT;
    hot_size_mb NUMERIC;
    warm_count BIGINT;
    warm_size_gb NUMERIC;
    cold_count BIGINT;
    cold_size_gb NUMERIC;
    oldest_hot_data TIMESTAMPTZ;
    newest_hot_data TIMESTAMPTZ;
BEGIN
    -- HOT data metrics
    SELECT COUNT(*), 
           pg_size_pretty(pg_total_relation_size('prop_ticks_hot'))::TEXT
    INTO hot_count, hot_size_mb
    FROM prop_ticks_hot 
    WHERE archived_at IS NULL;
    
    SELECT MIN(tick_timestamp), MAX(tick_timestamp)
    INTO oldest_hot_data, newest_hot_data
    FROM prop_ticks_hot
    WHERE archived_at IS NULL;
    
    -- WARM data metrics
    SELECT COUNT(*), COALESCE(SUM(file_size_bytes / 1024.0 / 1024.0 / 1024.0), 0)
    INTO warm_count, warm_size_gb
    FROM prop_ticks_warm_metadata;
    
    -- COLD data metrics
    SELECT COUNT(*), COALESCE(SUM(archive_size_bytes / 1024.0 / 1024.0 / 1024.0), 0)
    INTO cold_count, cold_size_gb
    FROM prop_ticks_cold_metadata;
    
    result := jsonb_build_object(
        'hot', jsonb_build_object(
            'record_count', hot_count,
            'size_mb', hot_size_mb,
            'oldest_data', oldest_hot_data,
            'newest_data', newest_hot_data,
            'data_span_hours', EXTRACT(EPOCH FROM (newest_hot_data - oldest_hot_data))/3600
        ),
        'warm', jsonb_build_object(
            'file_count', warm_count,
            'size_gb', warm_size_gb
        ),
        'cold', jsonb_build_object(
            'archive_count', cold_count,
            'size_gb', cold_size_gb
        ),
        'generated_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 8. ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on all tables
ALTER TABLE prop_ticks_hot ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_ticks_warm_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_ticks_cold_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_lifecycle_config ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Users can read hot prop ticks" ON prop_ticks_hot
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage hot prop ticks" ON prop_ticks_hot
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can read warm metadata" ON prop_ticks_warm_metadata
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage warm metadata" ON prop_ticks_warm_metadata
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can access cold metadata" ON prop_ticks_cold_metadata
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can manage lifecycle config" ON data_lifecycle_config
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- =============================================
-- 9. GRANTS AND PERMISSIONS
-- =============================================

-- Grant appropriate permissions
GRANT SELECT ON prop_ticks_hot TO authenticated;
GRANT INSERT ON prop_ticks_hot TO authenticated;
GRANT SELECT ON prop_ticks_warm_metadata TO authenticated;
GRANT SELECT ON prop_ticks_cold_metadata TO authenticated;
GRANT SELECT ON data_lifecycle_config TO authenticated;

-- Grant admin permissions for lifecycle management
GRANT ALL ON prop_ticks_hot TO service_role;
GRANT ALL ON prop_ticks_warm_metadata TO service_role;
GRANT ALL ON prop_ticks_cold_metadata TO service_role;
GRANT ALL ON data_lifecycle_config TO service_role;

-- =============================================
-- 10. COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON TABLE prop_ticks_hot IS 'HOT data storage: 7-14 days of high-frequency prop ticks for real-time analysis';
COMMENT ON TABLE prop_ticks_warm_metadata IS 'WARM data metadata: Tracking Parquet files in Supabase Storage (2-year retention)';
COMMENT ON TABLE prop_ticks_cold_metadata IS 'COLD data metadata: Long-term archive tracking (7+ year regulatory compliance)';
COMMENT ON TABLE data_lifecycle_config IS 'Configuration for automated data lifecycle management';

COMMENT ON COLUMN prop_ticks_hot.steam_detected IS 'Indicates sharp money/steam move detected';
COMMENT ON COLUMN prop_ticks_hot.time_to_game IS 'Minutes remaining until game start - critical for timing analysis';
COMMENT ON COLUMN prop_ticks_hot.market_efficiency_score IS 'How efficiently this market reflects true probability (0-1)';
COMMENT ON COLUMN prop_ticks_hot.expires_at IS 'When this record should be archived to warm storage';

-- Performance optimization hints
COMMENT ON INDEX idx_prop_ticks_hot_recent_active IS 'Optimized for real-time dashboard queries on recent data';
COMMENT ON INDEX idx_prop_ticks_hot_steam IS 'Fast lookup for steam move alerts and notifications';

-- Analysis hints
COMMENT ON FUNCTION cleanup_expired_hot_data() IS 'Automated cleanup function - called by ArchiverWorkflow';
COMMENT ON FUNCTION get_data_lifecycle_metrics() IS 'Health metrics for monitoring dashboard integration';

-- Final optimization
ANALYZE prop_ticks_hot;
ANALYZE prop_ticks_warm_metadata;
ANALYZE prop_ticks_cold_metadata;
ANALYZE data_lifecycle_config;