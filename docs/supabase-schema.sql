-- Scoring System Configuration Schema

-- Main configuration table
CREATE TABLE scoring_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version VARCHAR(50) NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    config JSONB NOT NULL,
    metadata JSONB
);

-- Tier thresholds
CREATE TABLE tier_thresholds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID REFERENCES scoring_config(id),
    tier VARCHAR(1) NOT NULL,
    min_composite DECIMAL NOT NULL,
    min_confidence DECIMAL NOT NULL,
    min_ev DECIMAL NOT NULL,
    min_trend DECIMAL NOT NULL,
    min_role_stability DECIMAL NOT NULL,
    required_factors JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sport-specific configurations
CREATE TABLE sport_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID REFERENCES scoring_config(id),
    sport VARCHAR(50) NOT NULL,
    odds_min DECIMAL NOT NULL,
    odds_max DECIMAL NOT NULL,
    movement_threshold DECIMAL NOT NULL,
    weights JSONB NOT NULL,
    special_rules JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance tracking
CREATE TABLE scoring_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_version VARCHAR(50) NOT NULL,
    tier VARCHAR(1) NOT NULL,
    win_rate DECIMAL,
    roi DECIMAL,
    volume INTEGER,
    average_odds DECIMAL,
    feature_correlation JSONB,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature importance tracking
CREATE TABLE feature_importance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_version VARCHAR(50) NOT NULL,
    feature_name VARCHAR(100) NOT NULL,
    importance_score DECIMAL NOT NULL,
    correlation_win_rate DECIMAL,
    correlation_roi DECIMAL,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Realtime subscriptions
CREATE PUBLICATION scoring_config_changes FOR TABLE scoring_config;

-- Indexes
CREATE INDEX idx_scoring_config_active ON scoring_config(active);
CREATE INDEX idx_tier_thresholds_config ON tier_thresholds(config_id);
CREATE INDEX idx_sport_config_sport ON sport_config(sport);
CREATE INDEX idx_performance_config_tier ON scoring_performance(config_version, tier);
CREATE INDEX idx_feature_importance_feature ON feature_importance(feature_name);

-- Functions
CREATE OR REPLACE FUNCTION update_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_scoring_config_timestamp
    BEFORE UPDATE ON scoring_config
    FOR EACH ROW
    EXECUTE FUNCTION update_config_timestamp();

CREATE TRIGGER update_tier_thresholds_timestamp
    BEFORE UPDATE ON tier_thresholds
    FOR EACH ROW
    EXECUTE FUNCTION update_config_timestamp();

CREATE TRIGGER update_sport_config_timestamp
    BEFORE UPDATE ON sport_config
    FOR EACH ROW
    EXECUTE FUNCTION update_config_timestamp();

-- Sample data
INSERT INTO scoring_config (version, config) VALUES
('2.0.0', '{
    "edge": {
        "sharp_money_threshold": 0.60,
        "liquidity_threshold": 0.70,
        "steam_move_limit": 2
    },
    "weights": {
        "edge": 0.40,
        "context": 0.25,
        "role": 0.20,
        "market": 0.15
    }
}'::jsonb);

-- Sample tier thresholds
INSERT INTO tier_thresholds (
    config_id,
    tier,
    min_composite,
    min_confidence,
    min_ev,
    min_trend,
    min_role_stability,
    required_factors
) VALUES
((SELECT id FROM scoring_config WHERE version = '2.0.0'), 'S', 8.5, 0.85, 0.12, 0.80, 0.85, '["dvp_score", "market_sentiment", "role_stability"]'::jsonb),
((SELECT id FROM scoring_config WHERE version = '2.0.0'), 'A', 7.5, 0.75, 0.08, 0.70, 0.75, '["dvp_score", "role_stability"]'::jsonb),
((SELECT id FROM scoring_config WHERE version = '2.0.0'), 'B', 6.5, 0.65, 0.05, 0.60, 0.65, '["dvp_score"]'::jsonb),
((SELECT id FROM scoring_config WHERE version = '2.0.0'), 'C', 5.0, 0.55, 0.03, 0.50, 0.50, '[]'::jsonb);

-- Sample sport configurations
INSERT INTO sport_config (
    config_id,
    sport,
    odds_min,
    odds_max,
    movement_threshold,
    weights
) VALUES
((SELECT id FROM scoring_config WHERE version = '2.0.0'), 'NBA', -125, 115, 8, '{
    "dvp": 0.35,
    "matchup": 0.25,
    "venue": 0.15,
    "rest": 0.15,
    "injury": 0.10
}'::jsonb),
((SELECT id FROM scoring_config WHERE version = '2.0.0'), 'MLB', -130, 120, 10, '{
    "dvp": 0.30,
    "matchup": 0.20,
    "venue": 0.20,
    "weather": 0.15,
    "rest": 0.10,
    "injury": 0.05
}'::jsonb); 