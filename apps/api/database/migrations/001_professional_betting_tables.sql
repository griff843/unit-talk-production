-- Professional Betting System Tables
-- Implements CLV tracking, devigging, feedback loops, and performance monitoring

-- 1. CLV Tracking Table
CREATE TABLE IF NOT EXISTS clv_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core identifiers
    prop_id VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id),
    sport VARCHAR(50) NOT NULL,
    market VARCHAR(100) NOT NULL,
    book VARCHAR(100) NOT NULL,
    
    -- Line data
    opening_line DECIMAL(10,2),
    opening_odds INTEGER,
    bet_line DECIMAL(10,2) NOT NULL,
    bet_odds INTEGER NOT NULL,
    closing_line DECIMAL(10,2),
    closing_odds INTEGER,
    
    -- Timing
    opening_time TIMESTAMPTZ,
    bet_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closing_time TIMESTAMPTZ,
    game_time TIMESTAMPTZ NOT NULL,
    
    -- CLV metrics
    clv DECIMAL(8,4), -- Raw CLV
    clv_percentage DECIMAL(8,4), -- CLV as percentage
    beats_closing BOOLEAN,
    
    -- Additional context
    model_edge DECIMAL(8,4), -- Our model's edge at bet time
    actual_result BOOLEAN, -- Did the bet win?
    profit DECIMAL(10,2), -- Actual profit/loss in units
    
    -- Devigged metrics
    devigged_opening_prob DECIMAL(8,6),
    devigged_closing_prob DECIMAL(8,6),
    devigged_clv DECIMAL(8,4),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for CLV tracking
CREATE INDEX IF NOT EXISTS idx_clv_tracking_prop_id ON clv_tracking(prop_id);
CREATE INDEX IF NOT EXISTS idx_clv_tracking_user_sport ON clv_tracking(user_id, sport);
CREATE INDEX IF NOT EXISTS idx_clv_tracking_bet_time ON clv_tracking(bet_time);
CREATE INDEX IF NOT EXISTS idx_clv_tracking_book_market ON clv_tracking(book, market);
CREATE INDEX IF NOT EXISTS idx_clv_tracking_clv_percentage ON clv_tracking(clv_percentage);

-- 2. Sportsbook Weights Table
CREATE TABLE IF NOT EXISTS sportsbook_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book VARCHAR(100) NOT NULL UNIQUE,
    weight DECIMAL(4,2) NOT NULL DEFAULT 1.00,
    reliability DECIMAL(4,2) NOT NULL DEFAULT 0.50, -- 0-1 reliability professional_score
    avg_clv DECIMAL(8,4), -- Average CLV for this book
    bet_count INTEGER DEFAULT 0,
    roi DECIMAL(8,4), -- Return on investment
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default sportsbook weights
INSERT INTO sportsbook_weights (book, weight, reliability) VALUES
('DraftKings', 1.00, 0.75),
('FanDuel', 1.00, 0.75),
('BetMGM', 1.00, 0.70),
('Caesars', 1.00, 0.70),
('PointsBet', 1.00, 0.65),
('Barstool', 1.00, 0.65),
('WynnBET', 1.00, 0.60),
('BetRivers', 1.00, 0.60)
ON CONFLICT (book) DO NOTHING;

-- 3. Market Confidence Table
CREATE TABLE IF NOT EXISTS market_confidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sport VARCHAR(50) NOT NULL,
    market VARCHAR(100) NOT NULL,
    confidence DECIMAL(4,2) NOT NULL DEFAULT 0.50, -- 0-1 confidence professional_score
    edge_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,
    avg_clv DECIMAL(8,4),
    bet_count INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(sport, market)
);

-- Insert default market confidence
INSERT INTO market_confidence (sport, market, confidence, edge_multiplier) VALUES
-- MLB
('MLB', 'player_props', 0.75, 1.05),
('MLB', 'totals', 0.80, 1.10),
('MLB', 'spreads', 0.70, 1.00),
('MLB', 'moneyline', 0.65, 0.95),
-- NBA
('NBA', 'player_props', 0.80, 1.10),
('NBA', 'totals', 0.75, 1.05),
('NBA', 'spreads', 0.70, 1.00),
('NBA', 'moneyline', 0.65, 0.95),
-- NFL
('NFL', 'player_props', 0.85, 1.15),
('NFL', 'totals', 0.80, 1.10),
('NFL', 'spreads', 0.75, 1.05),
('NFL', 'moneyline', 0.70, 1.00),
-- NHL
('NHL', 'player_props', 0.70, 1.00),
('NHL', 'totals', 0.75, 1.05),
('NHL', 'spreads', 0.70, 1.00),
('NHL', 'moneyline', 0.65, 0.95)
ON CONFLICT (sport, market) DO NOTHING;

-- 4. CLV Alerts Table
CREATE TABLE IF NOT EXISTS clv_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level VARCHAR(20) NOT NULL CHECK (level IN ('critical', 'warning', 'investigate')),
    message TEXT NOT NULL,
    details JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    
    -- Prevent spam alerts
    UNIQUE(level, message, DATE(created_at))
);

-- Index for active alerts
CREATE INDEX IF NOT EXISTS idx_clv_alerts_active ON clv_alerts(acknowledged, level, created_at);

-- 5. Feedback Loop History Table
CREATE TABLE IF NOT EXISTS feedback_loop_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    weight_adjustments JSONB,
    book_adjustments JSONB,
    market_adjustments JSONB,
    pruned_features JSONB,
    summary JSONB,
    clv_before DECIMAL(8,4),
    clv_after DECIMAL(8,4),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for optimization history
CREATE INDEX IF NOT EXISTS idx_feedback_history_timestamp ON feedback_loop_history(timestamp);

-- 6. Devigging Cache Table (for performance)
CREATE TABLE IF NOT EXISTS devigging_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_key VARCHAR(255) NOT NULL, -- Unique identifier for odds combination
    odds_1 INTEGER NOT NULL,
    odds_2 INTEGER,
    odds_3 INTEGER,
    method VARCHAR(20) NOT NULL DEFAULT 'multiplicative',
    
    -- Results
    true_prob_1 DECIMAL(8,6) NOT NULL,
    true_prob_2 DECIMAL(8,6),
    true_prob_3 DECIMAL(8,6),
    total_vig DECIMAL(8,4) NOT NULL,
    
    -- Cache metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
    hit_count INTEGER DEFAULT 0,
    
    UNIQUE(market_key, method)
);

-- Index for devigging cache lookups
CREATE INDEX IF NOT EXISTS idx_devigging_cache_key ON devigging_cache(market_key, method);
CREATE INDEX IF NOT EXISTS idx_devigging_cache_expires ON devigging_cache(expires_at);

-- 7. Feature Performance Tracking
CREATE TABLE IF NOT EXISTS feature_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name VARCHAR(100) NOT NULL,
    sport VARCHAR(50),
    market VARCHAR(100),
    
    -- Performance metrics
    clv_correlation DECIMAL(8,6), -- Correlation with CLV
    importance_score DECIMAL(8,6), -- Feature importance
    weight DECIMAL(8,6) NOT NULL,
    sample_size INTEGER DEFAULT 0,
    
    -- Evaluation period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(feature_name, sport, market, period_start)
);

-- Index for feature performance tracking
CREATE INDEX IF NOT EXISTS idx_feature_performance_name ON feature_performance(feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_performance_period ON feature_performance(period_start, period_end);

-- 8. Model Performance Tracking
CREATE TABLE IF NOT EXISTS model_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_version VARCHAR(50) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Key metrics
    total_bets INTEGER DEFAULT 0,
    avg_clv DECIMAL(8,4),
    clv_positive_rate DECIMAL(4,2), -- % of bets with positive CLV
    roi DECIMAL(8,4),
    win_rate DECIMAL(4,2),
    
    -- By sport/market
    performance_by_sport JSONB,
    performance_by_market JSONB,
    performance_by_book JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for model performance tracking
CREATE INDEX IF NOT EXISTS idx_model_performance_version ON model_performance(model_version);
CREATE INDEX IF NOT EXISTS idx_model_performance_period ON model_performance(period_start, period_end);

-- 9. Dynamic Pricing Table (for line shopping)
CREATE TABLE IF NOT EXISTS dynamic_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prop_id VARCHAR(255) NOT NULL,
    book VARCHAR(100) NOT NULL,
    line DECIMAL(10,2),
    odds INTEGER NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    
    -- Line movement tracking
    line_movement DECIMAL(10,2), -- Change from opening
    odds_movement INTEGER, -- Change from opening
    volume_indicator INTEGER, -- 1-10 scale if available
    
    -- Market context
    time_to_game INTEGER, -- Minutes to game start
    is_steam_move BOOLEAN DEFAULT FALSE,
    
    UNIQUE(prop_id, book, timestamp)
);

-- Indexes for dynamic pricing
CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_prop ON dynamic_pricing(prop_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_book ON dynamic_pricing(book, timestamp);
CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_steam ON dynamic_pricing(is_steam_move, timestamp);

-- 10. Functions for automatic CLV calculation
CREATE OR REPLACE FUNCTION calculate_clv()
RETURNS TRIGGER AS $$
BEGIN
    -- Only calculate if we have closing data
    IF NEW.closing_odds IS NOT NULL AND NEW.bet_odds IS NOT NULL THEN
        -- Simple CLV calculation (will be enhanced by service)
        NEW.clv = (
            CASE 
                WHEN NEW.bet_odds > 0 THEN 100.0 / (NEW.bet_odds + 100)
                ELSE ABS(NEW.bet_odds) / (ABS(NEW.bet_odds) + 100)
            END
        ) - (
            CASE 
                WHEN NEW.closing_odds > 0 THEN 100.0 / (NEW.closing_odds + 100)
                ELSE ABS(NEW.closing_odds) / (ABS(NEW.closing_odds) + 100)
            END
        );
        
        NEW.clv_percentage = NEW.clv * 100;
        NEW.beats_closing = NEW.clv > 0;
    END IF;
    
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic CLV calculation
CREATE TRIGGER trigger_calculate_clv
    BEFORE UPDATE ON clv_tracking
    FOR EACH ROW
    EXECUTE FUNCTION calculate_clv();

-- 11. RLS Policies for security
ALTER TABLE clv_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE clv_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_loop_history ENABLE ROW LEVEL SECURITY;

-- Admin-only access to CLV alerts and feedback history
CREATE POLICY "Admins can access CLV alerts" ON clv_alerts
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can access feedback history" ON feedback_loop_history
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Users can see their own CLV tracking
CREATE POLICY "Users can see own CLV data" ON clv_tracking
    FOR SELECT USING (user_id = auth.uid());

-- Admins can see all CLV data
CREATE POLICY "Admins can access all CLV data" ON clv_tracking
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Create indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clv_tracking_composite 
    ON clv_tracking(user_id, sport, bet_time DESC, beats_closing);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sportsbook_weights_performance 
    ON sportsbook_weights(weight DESC, reliability DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_confidence_performance 
    ON market_confidence(sport, confidence DESC, edge_multiplier DESC);

-- Comments for documentation
COMMENT ON TABLE clv_tracking IS 'Tracks Closing Line Value - the North Star metric for betting success';
COMMENT ON TABLE sportsbook_weights IS 'Dynamic weights for each sportsbook based on CLV performance';
COMMENT ON TABLE market_confidence IS 'Market-specific confidence scores and edge multipliers';
COMMENT ON TABLE clv_alerts IS 'Private admin alerts for CLV performance monitoring';
COMMENT ON TABLE feedback_loop_history IS 'History of automated model optimizations';
COMMENT ON TABLE devigging_cache IS 'Cache for devigged odds calculations';
COMMENT ON TABLE feature_performance IS 'Tracks individual feature performance vs CLV';
COMMENT ON TABLE model_performance IS 'Overall model performance tracking';
COMMENT ON TABLE dynamic_pricing IS 'Real-time line movement and steam tracking';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON clv_tracking TO authenticated;
GRANT SELECT ON sportsbook_weights TO authenticated;
GRANT SELECT ON market_confidence TO authenticated;
GRANT SELECT, UPDATE ON clv_alerts TO authenticated;
GRANT SELECT ON feedback_loop_history TO authenticated;
GRANT SELECT ON devigging_cache TO authenticated;
GRANT SELECT ON feature_performance TO authenticated;
GRANT SELECT ON model_performance TO authenticated;
GRANT SELECT ON dynamic_pricing TO authenticated;