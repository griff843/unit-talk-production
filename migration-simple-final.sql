-- =============================================================================
-- SIMPLE ENHANCED SCORING MIGRATION (All-in-One Safe Version)
-- =============================================================================

-- Add core enhanced scoring metrics to raw_props (skip if already exists)
ALTER TABLE raw_props
ADD COLUMN IF NOT EXISTS expected_value NUMERIC,
ADD COLUMN IF NOT EXISTS sharp_money NUMERIC,
ADD COLUMN IF NOT EXISTS line_movement NUMERIC,
ADD COLUMN IF NOT EXISTS player_form NUMERIC,
ADD COLUMN IF NOT EXISTS injury_impact NUMERIC,
ADD COLUMN IF NOT EXISTS steam_detected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS best_available_line NUMERIC,
ADD COLUMN IF NOT EXISTS best_book TEXT,
ADD COLUMN IF NOT EXISTS public_betting_percentage NUMERIC,
ADD COLUMN IF NOT EXISTS sharp_betting_percentage NUMERIC,
ADD COLUMN IF NOT EXISTS volatility NUMERIC DEFAULT 5,
ADD COLUMN IF NOT EXISTS correlation_risk NUMERIC,
ADD COLUMN IF NOT EXISTS bid_ask_spread NUMERIC DEFAULT 0.02,
ADD COLUMN IF NOT EXISTS weather_impact NUMERIC,
ADD COLUMN IF NOT EXISTS market_intelligence NUMERIC,
ADD COLUMN IF NOT EXISTS volume_profile NUMERIC,
ADD COLUMN IF NOT EXISTS closing_line_value NUMERIC,
ADD COLUMN IF NOT EXISTS matchup_quality NUMERIC,
ADD COLUMN IF NOT EXISTS predicted_closing_line NUMERIC,
ADD COLUMN IF NOT EXISTS optimal_betting_time TEXT,
ADD COLUMN IF NOT EXISTS contrarian_opportunity BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS injury_timing_advantage NUMERIC,
ADD COLUMN IF NOT EXISTS cross_market_arbitrage NUMERIC,
ADD COLUMN IF NOT EXISTS player_fatigue NUMERIC,
ADD COLUMN IF NOT EXISTS venue_advantage NUMERIC,
ADD COLUMN IF NOT EXISTS referee_impact NUMERIC,
ADD COLUMN IF NOT EXISTS pace_impact NUMERIC,
ADD COLUMN IF NOT EXISTS motivational_factors NUMERIC,
ADD COLUMN IF NOT EXISTS data_completeness NUMERIC DEFAULT 0.95,
ADD COLUMN IF NOT EXISTS outlier_score NUMERIC DEFAULT 0.95,
ADD COLUMN IF NOT EXISTS consistency_score NUMERIC DEFAULT 0.95,
ADD COLUMN IF NOT EXISTS data_validation_score NUMERIC DEFAULT 0.95,
ADD COLUMN IF NOT EXISTS portfolio_impact NUMERIC,
ADD COLUMN IF NOT EXISTS player_name TEXT,
ADD COLUMN IF NOT EXISTS team TEXT,
ADD COLUMN IF NOT EXISTS opponent TEXT,
ADD COLUMN IF NOT EXISTS market TEXT,
ADD COLUMN IF NOT EXISTS market_type TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'optimal',
ADD COLUMN IF NOT EXISTS league TEXT,
ADD COLUMN IF NOT EXISTS game_date DATE,
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS over NUMERIC,
ADD COLUMN IF NOT EXISTS under NUMERIC;

-- Copy existing odds data
UPDATE raw_props SET over = over_odds WHERE over IS NULL AND over_odds IS NOT NULL;
UPDATE raw_props SET under = under_odds WHERE under IS NULL AND under_odds IS NOT NULL;

-- Create essential indexes for performance
CREATE INDEX idx_raw_props_expected_value ON raw_props(expected_value);
CREATE INDEX idx_raw_props_sharp_money ON raw_props(sharp_money);
CREATE INDEX idx_raw_props_outcome ON raw_props(outcome);
CREATE INDEX idx_raw_props_promoted_to_picks ON raw_props(promoted_to_picks);

-- Final validation
SELECT 
  'Enhanced scoring migration completed!' as status,
  COUNT(*) as total_props,
  COUNT(CASE WHEN expected_value IS NOT NULL THEN 1 END) as props_with_expected_value,
  COUNT(CASE WHEN sharp_money IS NOT NULL THEN 1 END) as props_with_sharp_money,
  COUNT(CASE WHEN over IS NOT NULL THEN 1 END) as props_with_over_odds,
  NOW() as completed_at
FROM raw_props;
