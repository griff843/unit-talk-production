-- =====================================================
-- Shadow Mode Tables Migration
-- =====================================================
-- Enables full grading → promotion → monitoring flow without public posting
-- All shadow data is tracked separately for testing and analysis

-- Drop existing shadow tables if they exist (idempotent)
DROP TABLE IF EXISTS shadow_metrics_snapshots CASCADE;
DROP TABLE IF EXISTS shadow_promoted_picks CASCADE;

-- =====================================================
-- Table: shadow_promoted_picks
-- =====================================================
-- Tracks all picks that would have been promoted in shadow mode
CREATE TABLE IF NOT EXISTS shadow_promoted_picks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference IDs
    raw_prop_id UUID,
    unified_pick_id UUID,
    
    -- Core pick data
    sport TEXT NOT NULL,
    market TEXT NOT NULL,
    player TEXT NOT NULL,
    team TEXT,
    book TEXT,
    odds_open INTEGER,
    odds_now INTEGER,
    line NUMERIC(10,2),
    event_time TIMESTAMPTZ,
    
    -- Grading and scoring
    tier TEXT,
    confidence INTEGER,
    professional_score NUMERIC(5,2),
    
    -- Analytics metrics
    devigged_win_prob NUMERIC(5,4),
    devigged_edge NUMERIC(5,4),
    clv_pct NUMERIC(6,2),
    kelly_fraction NUMERIC(5,4),
    risk NUMERIC(5,4),
    
    -- Promotion flags
    chaos_muted BOOLEAN DEFAULT false,
    steam_muted BOOLEAN DEFAULT false,
    is_instant BOOLEAN DEFAULT false,
    
    -- Grouping and routing
    group_key TEXT,
    decided_action TEXT, -- 'instant', 'queued-10am', 'rejected-gate', 'rejected-recheck'
    reasons JSONB, -- Array of rejection/routing reasons
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for shadow_promoted_picks
CREATE INDEX idx_shadow_promoted_picks_created_at ON shadow_promoted_picks(created_at DESC);
CREATE INDEX idx_shadow_promoted_picks_sport_event ON shadow_promoted_picks(sport, event_time);
CREATE INDEX idx_shadow_promoted_picks_group_key ON shadow_promoted_picks(group_key, event_time);
CREATE INDEX idx_shadow_promoted_picks_action ON shadow_promoted_picks(decided_action);
CREATE INDEX idx_shadow_promoted_picks_raw_prop ON shadow_promoted_picks(raw_prop_id);
CREATE INDEX idx_shadow_promoted_picks_unified ON shadow_promoted_picks(unified_pick_id);

-- =====================================================
-- Table: shadow_metrics_snapshots
-- =====================================================
-- Stores periodic metrics snapshots in shadow mode
CREATE TABLE IF NOT EXISTS shadow_metrics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Window and scope
    window TEXT NOT NULL, -- '7d', '30d', 'lifetime'
    sport TEXT, -- NULL for overall metrics
    
    -- Core performance metrics
    posted_ev NUMERIC(6,4),
    positive_clv_rate NUMERIC(5,2), -- Percentage
    avg_clv NUMERIC(6,2), -- In BPS
    hit_rate NUMERIC(5,2), -- Percentage
    roi NUMERIC(6,2), -- Percentage
    
    -- Risk and efficiency metrics
    sharpe NUMERIC(6,3),
    kelly_efficiency NUMERIC(5,2), -- Percentage
    max_drawdown NUMERIC(5,2), -- Percentage
    
    -- Volume metrics
    picks_count INTEGER,
    completed_picks INTEGER,
    
    -- Additional analytics
    win_rate NUMERIC(5,2),
    avg_odds INTEGER,
    profit_factor NUMERIC(6,3),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for shadow_metrics_snapshots
CREATE INDEX idx_shadow_metrics_window ON shadow_metrics_snapshots(window, created_at DESC);
CREATE INDEX idx_shadow_metrics_sport ON shadow_metrics_snapshots(sport, created_at DESC);
CREATE INDEX idx_shadow_metrics_created ON shadow_metrics_snapshots(created_at DESC);

-- =====================================================
-- Table: shadow_recheck_results (optional)
-- =====================================================
-- Tracks recheck results in shadow mode
CREATE TABLE IF NOT EXISTS shadow_recheck_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shadow_pick_id UUID REFERENCES shadow_promoted_picks(id),
    
    -- Recheck timing
    recheck_type TEXT, -- 'pre_game_15', 'pre_game_10', 'pre_game_5', 'post_game'
    scheduled_time TIMESTAMPTZ,
    actual_time TIMESTAMPTZ,
    
    -- Validation results
    validation_status TEXT, -- 'valid', 'warning', 'invalid', 'cancelled'
    ev_at_recheck NUMERIC(6,4),
    clv_at_recheck NUMERIC(6,2),
    odds_movement NUMERIC(6,2),
    
    -- Action taken
    action TEXT, -- 'maintain', 'adjust_size', 'tier_change', 'cancel', 'republish'
    action_reason TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shadow_recheck_pick ON shadow_recheck_results(shadow_pick_id);
CREATE INDEX idx_shadow_recheck_time ON shadow_recheck_results(scheduled_time);

-- =====================================================
-- Table: shadow_alerts (optional)
-- =====================================================
-- Tracks alerts that would have been generated in shadow mode
CREATE TABLE IF NOT EXISTS shadow_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shadow_pick_id UUID REFERENCES shadow_promoted_picks(id),
    
    -- Alert details
    alert_type TEXT, -- 'odds_movement', 'volume_spike', 'steam_alert', 'clv_change'
    severity TEXT, -- 'low', 'medium', 'high', 'critical'
    message TEXT,
    data JSONB,
    
    -- Would-be actions
    would_suspend BOOLEAN DEFAULT false,
    would_notify BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shadow_alerts_pick ON shadow_alerts(shadow_pick_id);
CREATE INDEX idx_shadow_alerts_type ON shadow_alerts(alert_type, created_at DESC);

-- =====================================================
-- Functions
-- =====================================================

-- Function to clean up old shadow data
CREATE OR REPLACE FUNCTION cleanup_old_shadow_data(max_days INTEGER DEFAULT 7)
RETURNS TABLE(
    deleted_picks INTEGER,
    deleted_metrics INTEGER,
    deleted_rechecks INTEGER,
    deleted_alerts INTEGER
) AS $$
DECLARE
    cutoff_date TIMESTAMPTZ;
    picks_deleted INTEGER;
    metrics_deleted INTEGER;
    rechecks_deleted INTEGER;
    alerts_deleted INTEGER;
BEGIN
    cutoff_date := NOW() - (max_days || ' days')::INTERVAL;
    
    -- Delete old shadow picks
    DELETE FROM shadow_promoted_picks 
    WHERE created_at < cutoff_date;
    GET DIAGNOSTICS picks_deleted = ROW_COUNT;
    
    -- Delete old metrics snapshots
    DELETE FROM shadow_metrics_snapshots 
    WHERE created_at < cutoff_date;
    GET DIAGNOSTICS metrics_deleted = ROW_COUNT;
    
    -- Delete old recheck results
    DELETE FROM shadow_recheck_results 
    WHERE created_at < cutoff_date;
    GET DIAGNOSTICS rechecks_deleted = ROW_COUNT;
    
    -- Delete old alerts
    DELETE FROM shadow_alerts 
    WHERE created_at < cutoff_date;
    GET DIAGNOSTICS alerts_deleted = ROW_COUNT;
    
    RETURN QUERY SELECT 
        picks_deleted,
        metrics_deleted,
        rechecks_deleted,
        alerts_deleted;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE shadow_promoted_picks IS 'Tracks all picks that would have been promoted in shadow mode for testing and analysis';
COMMENT ON TABLE shadow_metrics_snapshots IS 'Stores periodic performance metrics snapshots during shadow mode operation';
COMMENT ON TABLE shadow_recheck_results IS 'Tracks validation recheck results for shadow mode picks';
COMMENT ON TABLE shadow_alerts IS 'Stores alerts that would have been generated in shadow mode';

COMMENT ON COLUMN shadow_promoted_picks.decided_action IS 'Final routing decision: is_instant, queued-10am, rejected-gate, rejected-recheck';
COMMENT ON COLUMN shadow_promoted_picks.reasons IS 'JSON array of reasons for the routing decision';
COMMENT ON COLUMN shadow_metrics_snapshots.window IS 'Time window for metrics: 7d, 30d, or lifetime';
COMMENT ON COLUMN shadow_metrics_snapshots.sport IS 'Sport filter for metrics, NULL for overall';