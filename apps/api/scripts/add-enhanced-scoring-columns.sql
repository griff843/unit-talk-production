-- =============================================================================
-- Enhanced Scoring Columns Migration
-- Adds missing enhanced scoring columns to raw_props table
-- =============================================================================

-- Add enhanced scoring metrics (fixes NULL scoring issue)
ALTER TABLE raw_props 
ADD COLUMN IF NOT EXISTS trend_confidence NUMERIC,
ADD COLUMN IF NOT EXISTS edge_score NUMERIC,
ADD COLUMN IF NOT EXISTS matchup_quality NUMERIC,
ADD COLUMN IF NOT EXISTS expected_value NUMERIC,
ADD COLUMN IF NOT EXISTS sharp_money NUMERIC,
ADD COLUMN IF NOT EXISTS line_movement NUMERIC,
ADD COLUMN IF NOT EXISTS player_form NUMERIC,
ADD COLUMN IF NOT EXISTS injury_impact NUMERIC,
ADD COLUMN IF NOT EXISTS weather_impact NUMERIC,
ADD COLUMN IF NOT EXISTS market_intelligence NUMERIC,
ADD COLUMN IF NOT EXISTS volume_profile NUMERIC,
ADD COLUMN IF NOT EXISTS closing_line_value NUMERIC;

-- Add professional capper features
ALTER TABLE raw_props 
ADD COLUMN IF NOT EXISTS steam_detected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS predicted_closing_line NUMERIC,
ADD COLUMN IF NOT EXISTS optimal_betting_time TEXT,
ADD COLUMN IF NOT EXISTS best_available_line NUMERIC,
ADD COLUMN IF NOT EXISTS best_book TEXT,
ADD COLUMN IF NOT EXISTS public_betting_percentage NUMERIC,
ADD COLUMN IF NOT EXISTS sharp_betting_percentage NUMERIC,
ADD COLUMN IF NOT EXISTS contrarian_opportunity BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS injury_timing_advantage NUMERIC,
ADD COLUMN IF NOT EXISTS cross_market_arbitrage NUMERIC;

-- Add additional scoring factors for risk management
ALTER TABLE raw_props 
ADD COLUMN IF NOT EXISTS player_fatigue NUMERIC,
ADD COLUMN IF NOT EXISTS venue_advantage NUMERIC,
ADD COLUMN IF NOT EXISTS referee_impact NUMERIC,
ADD COLUMN IF NOT EXISTS pace_impact NUMERIC,
ADD COLUMN IF NOT EXISTS motivational_factors NUMERIC,
ADD COLUMN IF NOT EXISTS correlation_risk NUMERIC,
ADD COLUMN IF NOT EXISTS volatility NUMERIC DEFAULT 5,
ADD COLUMN IF NOT EXISTS portfolio_impact NUMERIC,
ADD COLUMN IF NOT EXISTS bid_ask_spread NUMERIC DEFAULT 0.02;

-- Add data quality tracking
ALTER TABLE raw_props 
ADD COLUMN IF NOT EXISTS data_completeness NUMERIC DEFAULT 0.95,
ADD COLUMN IF NOT EXISTS outlier_score NUMERIC DEFAULT 0.95,
ADD COLUMN IF NOT EXISTS consistency_score NUMERIC DEFAULT 0.95,
ADD COLUMN IF NOT EXISTS data_validation_score NUMERIC DEFAULT 0.95;

-- Add missing basic prop information
ALTER TABLE raw_props 
ADD COLUMN IF NOT EXISTS player_name TEXT,
ADD COLUMN IF NOT EXISTS team TEXT,
ADD COLUMN IF NOT EXISTS opponent TEXT,
ADD COLUMN IF NOT EXISTS market TEXT,
ADD COLUMN IF NOT EXISTS market_type TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'optimal',
ADD COLUMN IF NOT EXISTS league TEXT,
ADD COLUMN IF NOT EXISTS game_date DATE,
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add odds columns for consistency
ALTER TABLE raw_props 
ADD COLUMN IF NOT EXISTS over NUMERIC,
ADD COLUMN IF NOT EXISTS under NUMERIC;

-- Copy data from existing columns if they exist
UPDATE raw_props SET over = over_odds WHERE over IS NULL AND over_odds IS NOT NULL;
UPDATE raw_props SET under = under_odds WHERE under IS NULL AND under_odds IS NOT NULL;

-- Create new tables if they don't exist
-- =============================================================================
-- GRADING RESULTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS grading_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prop_id UUID REFERENCES raw_props(id) ON DELETE CASCADE,
  final_score NUMERIC NOT NULL,
  confidence NUMERIC NOT NULL,
  tier TEXT CHECK (tier IN ('S', 'A', 'B', 'C', 'D')) NOT NULL,
  edge_score NUMERIC,
  kelly_fraction NUMERIC,
  kelly_fraction NUMERIC,
  risk_score NUMERIC,
  
  -- Feature attribution (JSONB for flexibility)
  feature_contributions JSONB,
  model_contributions JSONB,
  scenario_analysis JSONB,
  professional_insights JSONB,
  enhanced_capper_analysis JSONB,
  
  -- Quality metrics
  data_quality NUMERIC DEFAULT 0.95,
  model_agreement NUMERIC,
  historical_accuracy NUMERIC,
  
  -- Metadata
  model_version TEXT,
  config_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- CAPPER PROFILES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS capper_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  tier TEXT CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'vip', 'vip_plus')) DEFAULT 'bronze',
  total_picks INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  pushes INTEGER DEFAULT 0,
  win_rate NUMERIC GENERATED ALWAYS AS (
    CASE WHEN (wins + losses) > 0 
    THEN ROUND(wins::NUMERIC / (wins + losses), 4)
    ELSE 0 END
  ) STORED,
  roi NUMERIC DEFAULT 0,
  units_won NUMERIC DEFAULT 0,
  streak_current INTEGER DEFAULT 0,
  streak_type TEXT CHECK (streak_type IN ('win', 'loss', 'none')) DEFAULT 'none',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create alias view for backward compatibility
DROP VIEW IF EXISTS cappers;
CREATE OR REPLACE VIEW cappers AS SELECT * FROM capper_profiles;

-- =============================================================================
-- ML FEATURES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ml_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prop_id UUID REFERENCES raw_props(id) ON DELETE CASCADE,
  
  -- Core ML features
  neural_network_score NUMERIC,
  gradient_boosting_score NUMERIC,
  random_forest_score NUMERIC,
  ensemble_score NUMERIC,
  model_agreement NUMERIC,
  
  -- Feature importance weights
  feature_weights JSONB,
  
  -- Historical performance context
  similar_props_performance JSONB,
  player_historical_performance JSONB,
  
  model_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SETTLEMENT TRACKING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS settlement_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID REFERENCES unified_picks(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id),
  
  -- Settlement details
  settlement_source TEXT NOT NULL, -- 'odds_api', 'manual', 'espn'
  original_line NUMERIC NOT NULL,
  actual_result NUMERIC,
  settlement_status TEXT CHECK (settlement_status IN ('pending', 'settled', 'void', 'disputed')) DEFAULT 'pending',
  
  -- Timing
  game_completed_at TIMESTAMPTZ,
  settlement_attempted_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  
  -- Error tracking
  settlement_errors JSONB,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================

-- Critical indexes for grading agent performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_outcome_promoted 
ON raw_props(outcome, promoted_to_picks) 
WHERE outcome IS NULL AND promoted_to_picks IS FALSE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_expected_value 
ON raw_props(expected_value) 
WHERE expected_value > 5;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_sharp_money 
ON raw_props(sharp_money) 
WHERE sharp_money > 70;

-- Final picks performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_tier_status 
ON unified_picks(tier, play_status);

-- Grading results performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grading_results_tier_confidence 
ON grading_results(tier, confidence);

-- =============================================================================
-- VALIDATION QUERY
-- =============================================================================

-- Test the grading agent query
SELECT 
  COUNT(*) as total_props,
  COUNT(CASE WHEN outcome IS NULL AND promoted_to_picks = FALSE THEN 1 END) as ungraded_props,
  COUNT(CASE WHEN expected_value IS NOT NULL THEN 1 END) as props_with_expected_value,
  COUNT(CASE WHEN edge_score IS NOT NULL THEN 1 END) as props_with_edge_score
FROM raw_props;

-- Success message
SELECT 
  'Enhanced scoring columns migration completed successfully!' as status,
  NOW() as completed_at;