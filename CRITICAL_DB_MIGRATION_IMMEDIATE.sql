-- ============================================================================= 
-- CRITICAL DATABASE MIGRATION - IMMEDIATE DEPLOYMENT REQUIRED
-- File: CRITICAL_DB_MIGRATION_IMMEDIATE.sql
-- Date: September 5, 2025
-- Purpose: Add missing professional grading columns to restore system functionality
-- Impact: Fixes professional grading system blocking issues
-- =============================================================================

-- CRITICAL: This migration MUST be applied immediately to restore professional grading
-- Currently the system is failing with: "column unified_picks.kelly_fraction does not exist"

BEGIN;

-- =============================================================================
-- PHASE 1: ADD MISSING PROFESSIONAL GRADING COLUMNS TO unified_picks
-- =============================================================================

-- Add professional grading columns that are expected by the system but missing
ALTER TABLE unified_picks 
ADD COLUMN IF NOT EXISTS kelly_fraction NUMERIC(6,4) CHECK (kelly_fraction >= 0 AND kelly_fraction <= 1),
ADD COLUMN IF NOT EXISTS professional_score NUMERIC(5,2) CHECK (professional_score >= 0 AND professional_score <= 100),
ADD COLUMN IF NOT EXISTS devigged_edge NUMERIC(6,2),
ADD COLUMN IF NOT EXISTS clv_tracking_id TEXT,
ADD COLUMN IF NOT EXISTS feature_contributions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS processing_time INTEGER CHECK (processing_time >= 0),
ADD COLUMN IF NOT EXISTS rule_compliance_score INTEGER CHECK (rule_compliance_score >= 0 AND rule_compliance_score <= 100),
ADD COLUMN IF NOT EXISTS sharp_grading_version TEXT DEFAULT 'v2025.09.05';

-- Add comment for documentation
COMMENT ON COLUMN unified_picks.kelly_fraction IS 'Kelly criterion position sizing (0.0 to 1.0)';
COMMENT ON COLUMN unified_picks.professional_score IS 'Professional grading score based on 45+ factors';
COMMENT ON COLUMN unified_picks.devigged_edge IS 'True edge percentage after vig removal';
COMMENT ON COLUMN unified_picks.clv_tracking_id IS 'Closing line value tracking identifier';
COMMENT ON COLUMN unified_picks.feature_contributions IS 'ML feature contribution breakdown';
COMMENT ON COLUMN unified_picks.processing_time IS 'Professional grading processing time in milliseconds';
COMMENT ON COLUMN unified_picks.rule_compliance_score IS 'Sharp Grading Rules compliance score (0-100)';

-- =============================================================================
-- PHASE 2: ADD CRITICAL PERFORMANCE INDEXES
-- =============================================================================

-- Professional grading lookup index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_professional_grading 
ON unified_picks (professional_score DESC, kelly_fraction DESC, devigged_edge DESC)
WHERE professional_score IS NOT NULL;

-- CLV tracking index  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_clv_tracking 
ON unified_picks (clv_tracking_id) 
WHERE clv_tracking_id IS NOT NULL;

-- User performance index for Command Center
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_user_performance 
ON unified_picks (user_id, status, tier_when_placed, placed_at DESC);

-- Recent picks index for Discord integration
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_recent 
ON unified_picks (placed_at DESC, published) 
WHERE placed_at > NOW() - INTERVAL '7 days';

-- =============================================================================
-- PHASE 3: ENSURE AGENT CONFIGURATION TABLE IS POPULATED
-- =============================================================================

-- Insert missing agent configurations (currently empty table)
INSERT INTO agents (name, type, version, status, config) VALUES
('FeedAgent', 'ingestion', '1.0.0', 'active', '{"schedule": "*/60 * * * * *", "sources": ["optimal-api", "odds-api"]}'),
('ScoringAgent', 'processing', '1.0.0', 'active', '{"batchSize": 100, "timeout": 30000, "features": 45}'),
('AlertAgent', 'notification', '1.0.0', 'active', '{"channels": ["discord"], "realtime": true}'),
('RecapAgent', 'analytics', '1.0.0', 'active', '{"schedule": "0 0 * * *", "includeStats": true}'),
('NotificationAgent', 'communication', '1.0.0', 'active', '{"multiChannel": true, "batchSize": 50}')
ON CONFLICT (name) DO UPDATE SET 
    status = EXCLUDED.status,
    config = EXCLUDED.config,
    updated_at = NOW();

-- =============================================================================
-- PHASE 4: ADD MISSING CONSTRAINTS AND TRIGGERS
-- =============================================================================

-- Ensure CLV tracking IDs are unique when present
CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_picks_clv_unique 
ON unified_picks (clv_tracking_id) 
WHERE clv_tracking_id IS NOT NULL;

-- Add trigger to automatically set processing timestamps
CREATE OR REPLACE FUNCTION set_professional_grading_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- Set processing timestamp when professional scoring is applied
    IF NEW.professional_score IS NOT NULL AND OLD.professional_score IS NULL THEN
        NEW.processing_time = COALESCE(NEW.processing_time, EXTRACT(EPOCH FROM (NOW() - NEW.placed_at)) * 1000);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_professional_grading_timestamp'
    ) THEN
        CREATE TRIGGER trg_professional_grading_timestamp
        BEFORE UPDATE ON unified_picks
        FOR EACH ROW EXECUTE FUNCTION set_professional_grading_timestamp();
    END IF;
END $$;

-- =============================================================================
-- PHASE 5: VALIDATION QUERIES
-- =============================================================================

-- Verify all columns were added successfully
DO $$
DECLARE
    missing_columns TEXT[] := ARRAY[]::TEXT[];
    col TEXT;
BEGIN
    -- Check for each required column
    FOR col IN SELECT unnest(ARRAY['kelly_fraction', 'professional_score', 'devigged_edge', 
                                   'clv_tracking_id', 'feature_contributions', 'processing_time',
                                   'rule_compliance_score', 'sharp_grading_version']) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'unified_picks' AND column_name = col
        ) THEN
            missing_columns := array_append(missing_columns, col);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE EXCEPTION 'Migration failed: Missing columns: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE 'SUCCESS: All professional grading columns added successfully';
    END IF;
END $$;

-- Verify agent configurations
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM agents) = 0 THEN
        RAISE EXCEPTION 'Migration failed: No agent configurations found';
    ELSE
        RAISE NOTICE 'SUCCESS: Agent configurations populated (% agents)', (SELECT COUNT(*) FROM agents);
    END IF;
END $$;

-- =============================================================================
-- PHASE 6: PERFORMANCE VALIDATION
-- =============================================================================

-- Analyze table for updated statistics
ANALYZE unified_picks;
ANALYZE agents;

-- Display migration summary
SELECT 
    'Migration Complete' as status,
    (SELECT COUNT(*) FROM unified_picks) as total_picks,
    (SELECT COUNT(*) FROM unified_picks WHERE professional_score IS NOT NULL) as professionally_graded_picks,
    (SELECT COUNT(*) FROM agents WHERE status = 'active') as active_agents,
    NOW() as completed_at;

COMMIT;

-- =============================================================================
-- POST-MIGRATION VALIDATION COMMANDS
-- =============================================================================

-- Test that professional grading can now write to the table
-- INSERT INTO unified_picks (user_id, outcome, odds, stake, kelly_fraction, professional_score, devigged_edge)
-- VALUES (
--     (SELECT id FROM users LIMIT 1),
--     'Over 2.5',
--     -110,
--     1.0,
--     0.05,    -- kelly_fraction
--     85.5,    -- professional_score  
--     4.2      -- devigged_edge
-- );

-- Verify indexes were created
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'unified_picks' 
AND indexname LIKE '%professional%';

-- Check agent health integration
SELECT 
    ah.agent as agent_name,
    ah.status as health_status,
    a.status as config_status,
    ah.last_run,
    ah.total_operations
FROM agent_health ah
LEFT JOIN agents a ON ah.agent = a.name
ORDER BY ah.agent;

RAISE NOTICE 'CRITICAL MIGRATION COMPLETED - Professional grading system should now be operational';