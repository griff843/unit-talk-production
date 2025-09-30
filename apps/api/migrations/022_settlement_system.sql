-- Migration 022: Settlement System Enhancement
-- Adds settlement columns and indexes to unified_picks table

-- Add settlement columns to unified_picks if not already present
DO $$
BEGIN
    -- Check if settlement columns exist and add them if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'unified_picks' AND column_name = 'actual_stat') THEN
        ALTER TABLE unified_picks ADD COLUMN actual_stat NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'unified_picks' AND column_name = 'outcome') THEN
        ALTER TABLE unified_picks ADD COLUMN outcome TEXT CHECK (outcome IN ('win','loss','void','push'));
    ELSE
        -- Update existing outcome constraint to include settlement outcomes
        ALTER TABLE unified_picks DROP CONSTRAINT IF EXISTS unified_picks_outcome_check;
        ALTER TABLE unified_picks ADD CONSTRAINT unified_picks_outcome_check 
            CHECK (outcome IN ('win','loss','void','push','over','under','yes','no'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'unified_picks' AND column_name = 'settled_at') THEN
        ALTER TABLE unified_picks ADD COLUMN settled_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'unified_picks' AND column_name = 'settlement_source') THEN
        ALTER TABLE unified_picks ADD COLUMN settlement_source TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'unified_picks' AND column_name = 'settlement_version') THEN
        ALTER TABLE unified_picks ADD COLUMN settlement_version INTEGER DEFAULT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'unified_picks' AND column_name = 'settlement_notes') THEN
        ALTER TABLE unified_picks ADD COLUMN settlement_notes TEXT;
    END IF;

    -- Add external ID columns for settlement resolution
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'unified_picks' AND column_name = 'external_game_id') THEN
        ALTER TABLE unified_picks ADD COLUMN external_game_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'unified_picks' AND column_name = 'external_player_id') THEN
        ALTER TABLE unified_picks ADD COLUMN external_player_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'unified_picks' AND column_name = 'sport') THEN
        ALTER TABLE unified_picks ADD COLUMN sport TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'unified_picks' AND column_name = 'stat_type') THEN
        ALTER TABLE unified_picks ADD COLUMN stat_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'unified_picks' AND column_name = 'player_name') THEN
        ALTER TABLE unified_picks ADD COLUMN player_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'unified_picks' AND column_name = 'game_date') THEN
        ALTER TABLE unified_picks ADD COLUMN game_date DATE;
    END IF;
END
$$;

-- Create settlement performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_settled_at 
    ON unified_picks(settled_at) WHERE settled_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_unsettled 
    ON unified_picks(game_date, sport) WHERE settled_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_external_game_id 
    ON unified_picks(external_game_id) WHERE external_game_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_player_lookup 
    ON unified_picks(player_name, sport) WHERE player_name IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_settlement_source 
    ON unified_picks(settlement_source) WHERE settlement_source IS NOT NULL;

-- Create partial index for recent unsettled picks (performance optimization)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_recent_unsettled 
    ON unified_picks(game_date DESC) 
    WHERE settled_at IS NULL AND game_date >= CURRENT_DATE - INTERVAL '30 days';

-- Settlement job tracking table
CREATE TABLE IF NOT EXISTS settlement_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id TEXT UNIQUE NOT NULL,
    job_type TEXT NOT NULL CHECK (job_type IN ('backfill', 'ids', 'live')),
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    options JSONB NOT NULL,
    progress JSONB NOT NULL DEFAULT '{"scanned": 0, "settled": 0, "skipped": 0, "errors": 0, "failed": []}',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_by TEXT,
    
    -- Indexes
    INDEX idx_settlement_jobs_job_id(job_id),
    INDEX idx_settlement_jobs_status(status),
    INDEX idx_settlement_jobs_started_at(started_at DESC)
);

-- Settlement audit log table
CREATE TABLE IF NOT EXISTS settlement_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pick_id UUID NOT NULL REFERENCES unified_picks(id) ON DELETE CASCADE,
    job_id TEXT,
    action TEXT NOT NULL CHECK (action IN ('settled', 'voided', 'failed', 'skipped')),
    old_values JSONB,
    new_values JSONB,
    settlement_source TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_settlement_audit_pick_id(pick_id),
    INDEX idx_settlement_audit_job_id(job_id),
    INDEX idx_settlement_audit_created_at(created_at DESC)
);

-- Settlement statistics view
CREATE OR REPLACE VIEW settlement_stats_view AS
SELECT 
    COUNT(*) as total_picks,
    COUNT(settled_at) as settled_picks,
    COUNT(*) - COUNT(settled_at) as unsettled_picks,
    ROUND(
        (COUNT(settled_at)::NUMERIC / COUNT(*)) * 100, 2
    ) as settlement_percentage,
    
    -- By outcome
    COUNT(*) FILTER (WHERE outcome = 'win') as wins,
    COUNT(*) FILTER (WHERE outcome = 'loss') as losses,
    COUNT(*) FILTER (WHERE outcome = 'push') as pushes,
    COUNT(*) FILTER (WHERE outcome = 'void') as voids,
    
    -- By sport
    COUNT(*) FILTER (WHERE sport = 'MLB') as mlb_picks,
    COUNT(*) FILTER (WHERE sport = 'NFL') as nfl_picks,
    COUNT(*) FILTER (WHERE sport = 'NBA') as nba_picks,
    COUNT(*) FILTER (WHERE sport = 'NCAAF') as ncaaf_picks,
    COUNT(*) FILTER (WHERE sport = 'WNBA') as wnba_picks,
    
    -- Settlement sources
    COUNT(*) FILTER (WHERE settlement_source = 'MLB StatsAPI') as mlb_api_settlements,
    COUNT(*) FILTER (WHERE settlement_source = 'ESPN NFL') as espn_nfl_settlements,
    COUNT(*) FILTER (WHERE settlement_source = 'NBA Stats API') as nba_api_settlements,
    COUNT(*) FILTER (WHERE settlement_source = 'ESPN NCAA') as ncaa_api_settlements,
    COUNT(*) FILTER (WHERE settlement_source = 'ESPN WNBA') as wnba_api_settlements,
    
    -- Date ranges
    MIN(game_date) as earliest_pick_date,
    MAX(game_date) as latest_pick_date,
    MIN(settled_at) as earliest_settlement_date,
    MAX(settled_at) as latest_settlement_date
FROM unified_picks;

-- Update existing status values to align with settlement outcomes
UPDATE unified_picks SET status = 'won' WHERE status = 'win';
UPDATE unified_picks SET status = 'lost' WHERE status = 'loss';

-- Settlement workflow trigger function
CREATE OR REPLACE FUNCTION trigger_settlement_audit()
RETURNS TRIGGER AS $$
BEGIN
    -- Log settlement changes to audit table
    IF (TG_OP = 'UPDATE') AND (OLD.settled_at IS NULL AND NEW.settled_at IS NOT NULL) THEN
        INSERT INTO settlement_audit_log (
            pick_id,
            action,
            old_values,
            new_values,
            settlement_source,
            notes
        ) VALUES (
            NEW.id,
            'settled',
            row_to_json(OLD),
            row_to_json(NEW),
            NEW.settlement_source,
            NEW.settlement_notes
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for settlement audit
DROP TRIGGER IF EXISTS settlement_audit_trigger ON unified_picks;
CREATE TRIGGER settlement_audit_trigger
    AFTER UPDATE ON unified_picks
    FOR EACH ROW
    EXECUTE FUNCTION trigger_settlement_audit();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON settlement_jobs TO PUBLIC;
GRANT SELECT, INSERT ON settlement_audit_log TO PUBLIC;
GRANT SELECT ON settlement_stats_view TO PUBLIC;

-- Create settlement system health check function
CREATE OR REPLACE FUNCTION settlement_system_health()
RETURNS TABLE (
    component TEXT,
    status TEXT,
    details TEXT,
    last_updated TIMESTAMPTZ
) AS $$
BEGIN
    -- Check recent settlement activity
    RETURN QUERY SELECT 
        'recent_settlements'::TEXT,
        CASE 
            WHEN COUNT(*) > 0 THEN 'healthy'::TEXT
            ELSE 'warning'::TEXT
        END,
        CONCAT(COUNT(*), ' settlements in last 24 hours')::TEXT,
        NOW()
    FROM unified_picks 
    WHERE settled_at >= NOW() - INTERVAL '24 hours';
    
    -- Check unsettled picks older than 7 days
    RETURN QUERY SELECT 
        'old_unsettled_picks'::TEXT,
        CASE 
            WHEN COUNT(*) = 0 THEN 'healthy'::TEXT
            WHEN COUNT(*) < 100 THEN 'warning'::TEXT
            ELSE 'error'::TEXT
        END,
        CONCAT(COUNT(*), ' picks unsettled for >7 days')::TEXT,
        NOW()
    FROM unified_picks 
    WHERE settled_at IS NULL 
      AND game_date < CURRENT_DATE - INTERVAL '7 days';
    
    -- Check for failed settlement jobs
    RETURN QUERY SELECT 
        'settlement_jobs'::TEXT,
        CASE 
            WHEN COUNT(*) = 0 THEN 'healthy'::TEXT
            ELSE 'warning'::TEXT
        END,
        CONCAT(COUNT(*), ' failed jobs in last 24 hours')::TEXT,
        NOW()
    FROM settlement_jobs 
    WHERE status = 'failed' 
      AND started_at >= NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE settlement_jobs IS 'Tracks settlement job execution and progress';
COMMENT ON TABLE settlement_audit_log IS 'Audit trail for all settlement changes';
COMMENT ON VIEW settlement_stats_view IS 'Real-time settlement statistics and metrics';
COMMENT ON FUNCTION settlement_system_health() IS 'Health check for settlement system components';

-- Insert initial metadata
INSERT INTO settlement_jobs (job_id, job_type, status, options, progress, completed_at)
VALUES (
    'migration-022-init',
    'backfill',
    'completed',
    '{"description": "Initial settlement system setup"}',
    '{"scanned": 0, "settled": 0, "skipped": 0, "errors": 0, "failed": []}',
    NOW()
) ON CONFLICT (job_id) DO NOTHING;