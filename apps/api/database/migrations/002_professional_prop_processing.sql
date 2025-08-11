-- Professional Prop Processing Database Migration
-- Adds columns needed for professional grading integration with unified_picks table

-- 1. Enhance raw_props table for professional processing
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS processed_by VARCHAR(100);
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS error_at TIMESTAMPTZ;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS opening_line DECIMAL(10,2);
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS opening_over_odds INTEGER;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS opening_under_odds INTEGER;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS book VARCHAR(100) DEFAULT 'aggregated';
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS market_open_time TIMESTAMPTZ DEFAULT NOW();

-- 2. Enhance unified_picks table with professional grading data
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS professional_score DECIMAL(8,4);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS devigged_edge DECIMAL(8,4);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS kelly_fraction DECIMAL(8,4);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS professional_insights JSONB;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS clv_tracking_id VARCHAR(255);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS feature_contributions JSONB;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS risk_assessment JSONB;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS processing_time INTEGER; -- milliseconds
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;

-- 3. Create processing_logs table for monitoring
CREATE TABLE IF NOT EXISTS processing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processor VARCHAR(100) NOT NULL,
    summary JSONB NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Performance tracking
    props_processed INTEGER DEFAULT 0,
    avg_processing_time INTEGER DEFAULT 0, -- milliseconds
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    
    -- Quality metrics
    auto_approval_rate DECIMAL(5,2) DEFAULT 0.00,
    avg_professional_score DECIMAL(8,4) DEFAULT 0,
    avg_confidence DECIMAL(8,4) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_raw_props_processing ON raw_props(processed_at, processed_by);
CREATE INDEX IF NOT EXISTS idx_raw_props_unprocessed ON raw_props(created_at) WHERE processed_at IS NULL AND error_message IS NULL;
CREATE INDEX IF NOT EXISTS idx_raw_props_errors ON raw_props(error_at) WHERE error_message IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_unified_picks_professional_score ON unified_picks(professional_score DESC);
CREATE INDEX IF NOT EXISTS idx_unified_picks_tier_score ON unified_picks(tier, professional_score DESC);
CREATE INDEX IF NOT EXISTS idx_unified_picks_auto_approved ON unified_picks(published, status);
CREATE INDEX IF NOT EXISTS idx_unified_picks_clv_tracking ON unified_picks(clv_tracking_id) WHERE clv_tracking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_picks_professional_data ON unified_picks(status, tier, professional_score) WHERE professional_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_processing_logs_processor ON processing_logs(processor, processed_at DESC);

-- 5. Add foreign key constraint for CLV tracking (soft reference)
-- Note: Using VARCHAR instead of UUID FK for flexibility with external systems
CREATE INDEX IF NOT EXISTS idx_unified_picks_clv_lookup ON unified_picks(clv_tracking_id) WHERE clv_tracking_id IS NOT NULL;

-- 6. Create view for admin dashboard with professional data
CREATE OR REPLACE VIEW admin_picks_review AS
SELECT 
    up.id,
    up.user_id,
    u.username,
    up.sport,
    up.prediction,
    up.status,
    up.tier,
    up.confidence,
    up.professional_score,
    up.devigged_edge,
    up.kelly_fraction,
    up.published,
    up.processing_time,
    up.professional_insights,
    up.risk_assessment,
    up.created_at,
    
    -- Raw prop details
    rp.player_name,
    rp.stat_type,
    rp.line,
    rp.over_odds,
    rp.under_odds,
    
    -- Professional insights summary
    (up.professional_insights->>'steamMoveDetected')::boolean as steam_move_detected,
    (up.professional_insights->>'predictedClosingLine')::decimal as predicted_closing_line,
    (up.professional_insights->>'bestAvailableLine')::decimal as best_available_line,
    (up.professional_insights->>'publicBettingPercentage')::decimal as public_betting_percentage,
    
    -- Risk summary
    (up.risk_assessment->>'max_exposure')::decimal as max_exposure,
    (up.risk_assessment->>'portfolio_impact')::decimal as portfolio_impact
    
FROM unified_picks up
LEFT JOIN users u ON up.user_id = u.id
LEFT JOIN raw_props rp ON up.raw_prop_id = rp.id
WHERE up.professional_score IS NOT NULL
ORDER BY up.professional_score DESC, up.created_at DESC;

-- 7. Create view for processing statistics
CREATE OR REPLACE VIEW processing_statistics AS
SELECT 
    DATE(processed_at) as processing_date,
    processor,
    COUNT(*) as total_runs,
    AVG((summary->>'total_processed')::integer) as avg_props_per_run,
    AVG((summary->>'avg_processing_time')::decimal) as avg_processing_time_ms,
    AVG((summary->>'avg_professional_score')::decimal) as avg_professional_score,
    AVG((summary->>'auto_approved')::integer::decimal / NULLIF((summary->>'total_processed')::integer, 0)) as avg_auto_approval_rate
FROM processing_logs
WHERE processed_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(processed_at), processor
ORDER BY processing_date DESC, processor;

-- 8. Update existing picks to have default professional values (optional)
-- This ensures existing picks don't break the system
UPDATE unified_picks 
SET 
    professional_score = COALESCE(confidence * 3, 2.0),
    devigged_edge = 0,
    kelly_fraction = 0.02,
    published = (status = 'approved'),
    processing_time = 1000
WHERE professional_score IS NULL;

-- 9. Add comments for documentation
COMMENT ON COLUMN raw_props.processed_at IS 'When this prop was processed by professional system';
COMMENT ON COLUMN raw_props.processed_by IS 'Which system processed this prop (e.g., professional_system)';
COMMENT ON COLUMN raw_props.error_message IS 'Error message if processing failed';
COMMENT ON COLUMN raw_props.opening_line IS 'Opening line for CLV tracking';

COMMENT ON COLUMN unified_picks.professional_score IS 'Comprehensive professional grading professional_score (0-5)';
COMMENT ON COLUMN unified_picks.devigged_edge IS 'Edge calculated using devigged true probabilities';
COMMENT ON COLUMN unified_picks.kelly_fraction IS 'Recommended Kelly bet sizing (0-1)';
COMMENT ON COLUMN unified_picks.professional_insights IS 'JSON containing steam moves, line predictions, etc.';
COMMENT ON COLUMN unified_picks.clv_tracking_id IS 'Link to CLV tracking system';
COMMENT ON COLUMN unified_picks.feature_contributions IS 'JSON showing which features contributed to score';
COMMENT ON COLUMN unified_picks.risk_assessment IS 'JSON containing risk metrics and portfolio impact';
COMMENT ON COLUMN unified_picks.published IS 'Whether pick was auto-approved by professional system';

COMMENT ON TABLE processing_logs IS 'Logs from professional prop processing for monitoring';
COMMENT ON VIEW admin_picks_review IS 'Enhanced admin view with professional grading data';
COMMENT ON VIEW processing_statistics IS 'Daily processing statistics for monitoring';

-- 10. Grant permissions
GRANT SELECT, INSERT, UPDATE ON processing_logs TO authenticated;
GRANT SELECT ON admin_picks_review TO authenticated;
GRANT SELECT ON processing_statistics TO authenticated;

-- 11. Create function to get unprocessed props count
CREATE OR REPLACE FUNCTION get_unprocessed_props_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM raw_props 
        WHERE processed_at IS NULL 
        AND error_message IS NULL
    );
END;
$$ LANGUAGE plpgsql;

-- 12. Create function to get professional processing summary
CREATE OR REPLACE FUNCTION get_professional_processing_summary(days INTEGER DEFAULT 7)
RETURNS TABLE(
    total_processed BIGINT,
    avg_score DECIMAL,
    auto_approval_rate DECIMAL,
    tier_s_count BIGINT,
    tier_a_count BIGINT,
    avg_processing_time DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_processed,
        AVG(up.professional_score) as avg_score,
        AVG(CASE WHEN up.published THEN 1.0 ELSE 0.0 END) as auto_approval_rate,
        COUNT(*) FILTER (WHERE up.tier = 'S') as tier_s_count,
        COUNT(*) FILTER (WHERE up.tier = 'A') as tier_a_count,
        AVG(up.processing_time) as avg_processing_time
    FROM unified_picks up
    WHERE up.professional_score IS NOT NULL
    AND up.created_at >= NOW() - (days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- 13. Performance optimization: Update table statistics
ANALYZE raw_props;
ANALYZE unified_picks;
ANALYZE processing_logs;