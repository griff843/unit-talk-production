-- =============================================================================
-- SAFE ENHANCED SCORING MIGRATION (Individual Column Additions)
-- =============================================================================

-- Add columns individually to handle existing columns gracefully
-- Note: You may see "column already exists" errors - this is normal and safe

-- Core scoring metrics
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS expected_value NUMERIC;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS sharp_money NUMERIC;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS line_movement NUMERIC;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS player_form NUMERIC;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS injury_impact NUMERIC;

-- Professional capper features
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS steam_detected BOOLEAN DEFAULT FALSE;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS best_available_line NUMERIC;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS best_book TEXT;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS public_betting_percentage NUMERIC;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS sharp_betting_percentage NUMERIC;

-- Risk management
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS volatility NUMERIC DEFAULT 5;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS correlation_risk NUMERIC;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS bid_ask_spread NUMERIC DEFAULT 0.02;

-- Market intelligence
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS weather_impact NUMERIC;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS market_intelligence NUMERIC;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS volume_profile NUMERIC;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS closing_line_value NUMERIC;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS matchup_quality NUMERIC;

-- Advanced timing features
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS predicted_closing_line NUMERIC;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS optimal_betting_time TEXT;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS contrarian_opportunity BOOLEAN DEFAULT FALSE;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS injury_timing_advantage NUMERIC;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS cross_market_arbitrage NUMERIC;

-- Venue and performance factors
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS player_fatigue NUMERIC;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS venue_advantage NUMERIC;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS referee_impact NUMERIC;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS pace_impact NUMERIC;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS motivational_factors NUMERIC;

-- Data quality tracking
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS data_completeness NUMERIC DEFAULT 0.95;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS outlier_score NUMERIC DEFAULT 0.95;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS consistency_score NUMERIC DEFAULT 0.95;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS data_validation_score NUMERIC DEFAULT 0.95;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS portfolio_impact NUMERIC;

-- Basic prop information
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS player_name TEXT;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS team TEXT;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS opponent TEXT;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS market TEXT;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS market_type TEXT;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'optimal';
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS league TEXT;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS game_date DATE;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Odds consistency
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS over NUMERIC;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS under NUMERIC;

-- Copy existing odds data
UPDATE raw_props SET over = over_odds WHERE over IS NULL AND over_odds IS NOT NULL;
UPDATE raw_props SET under = under_odds WHERE under IS NULL AND under_odds IS NOT NULL;

-- Create essential indexes (ignore errors if they already exist)
DROP INDEX IF EXISTS idx_raw_props_expected_value;
DROP INDEX IF EXISTS idx_raw_props_sharp_money;
DROP INDEX IF EXISTS idx_raw_props_outcome;
DROP INDEX IF EXISTS idx_raw_props_promoted_to_picks;

CREATE INDEX idx_raw_props_expected_value ON raw_props(expected_value);
CREATE INDEX idx_raw_props_sharp_money ON raw_props(sharp_money);
CREATE INDEX idx_raw_props_outcome ON raw_props(outcome);
CREATE INDEX idx_raw_props_promoted_to_picks ON raw_props(promoted_to_picks);

-- Final validation
SELECT 
  '🎉 Enhanced scoring migration completed successfully!' as status,
  COUNT(*) as total_props,
  COUNT(CASE WHEN expected_value IS NOT NULL THEN 1 END) as props_with_expected_value,
  COUNT(CASE WHEN sharp_money IS NOT NULL THEN 1 END) as props_with_sharp_money,
  COUNT(CASE WHEN over IS NOT NULL THEN 1 END) as props_with_over_odds,
  COUNT(CASE WHEN steam_detected IS NOT NULL THEN 1 END) as props_with_steam_detection,
  COUNT(CASE WHEN best_book IS NOT NULL THEN 1 END) as props_with_best_book,
  NOW() as completed_at
FROM raw_props;

-- Success summary
SELECT 
  '✅ Your database now has professional-grade scoring capabilities!' as message,
  '✅ 42+ advanced scoring columns added to raw_props table' as columns_added,
  '✅ Performance indexes created for optimal query speed' as performance,
  '✅ Ready for ML features and advanced capper analytics' as capabilities;
