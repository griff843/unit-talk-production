-- =============================================================================
-- BATCH 2: Advanced Features (Run this after Batch 1)
-- =============================================================================

-- Add advanced market intelligence
ALTER TABLE raw_props 
ADD COLUMN IF NOT EXISTS weather_impact NUMERIC,
ADD COLUMN IF NOT EXISTS market_intelligence NUMERIC,
ADD COLUMN IF NOT EXISTS volume_profile NUMERIC,
ADD COLUMN IF NOT EXISTS closing_line_value NUMERIC,
ADD COLUMN IF NOT EXISTS matchup_quality NUMERIC;

-- Add professional timing features
ALTER TABLE raw_props 
ADD COLUMN IF NOT EXISTS predicted_closing_line NUMERIC,
ADD COLUMN IF NOT EXISTS optimal_betting_time TEXT,
ADD COLUMN IF NOT EXISTS contrarian_opportunity BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS injury_timing_advantage NUMERIC,
ADD COLUMN IF NOT EXISTS cross_market_arbitrage NUMERIC;

-- Add venue and referee factors
ALTER TABLE raw_props 
ADD COLUMN IF NOT EXISTS player_fatigue NUMERIC,
ADD COLUMN IF NOT EXISTS venue_advantage NUMERIC,
ADD COLUMN IF NOT EXISTS referee_impact NUMERIC,
ADD COLUMN IF NOT EXISTS pace_impact NUMERIC,
ADD COLUMN IF NOT EXISTS motivational_factors NUMERIC;

-- Validation query
SELECT 
  'Batch 2 completed - Advanced features added!' as status,
  COUNT(*) as total_props,
  NOW() as completed_at
FROM raw_props;
