-- =============================================================================
-- BATCH 4: New Tables (Run this after Batch 3)
-- =============================================================================

-- Create grading results table
CREATE TABLE IF NOT EXISTS grading_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prop_id UUID REFERENCES raw_props(id) ON DELETE CASCADE,
  final_score NUMERIC NOT NULL,
  confidence NUMERIC NOT NULL,
  tier TEXT CHECK (tier IN ('S', 'A', 'B', 'C', 'D')) NOT NULL,
  edge_score NUMERIC,
  kelly_fraction NUMERIC,
  position_size NUMERIC,
  risk_score NUMERIC,
  feature_contributions JSONB,
  model_contributions JSONB,
  scenario_analysis JSONB,
  professional_insights JSONB,
  enhanced_capper_analysis JSONB,
  data_quality NUMERIC DEFAULT 0.95,
  model_agreement NUMERIC,
  historical_accuracy NUMERIC,
  model_version TEXT,
  config_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create capper profiles table
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

-- Create ML features table
CREATE TABLE IF NOT EXISTS ml_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prop_id UUID REFERENCES raw_props(id) ON DELETE CASCADE,
  neural_network_score NUMERIC,
  gradient_boosting_score NUMERIC,
  random_forest_score NUMERIC,
  ensemble_score NUMERIC,
  model_agreement NUMERIC,
  feature_weights JSONB,
  similar_props_performance JSONB,
  player_historical_performance JSONB,
  model_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create settlement tracking table
CREATE TABLE IF NOT EXISTS settlement_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID REFERENCES final_picks(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id),
  settlement_source TEXT NOT NULL,
  original_line NUMERIC NOT NULL,
  actual_result NUMERIC,
  settlement_status TEXT CHECK (settlement_status IN ('pending', 'settled', 'void', 'disputed')) DEFAULT 'pending',
  game_completed_at TIMESTAMPTZ,
  settlement_attempted_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  settlement_errors JSONB,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create backward compatibility view (handle existing table/view conflicts)
DO $$
BEGIN
    -- Drop existing view or table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'cappers') THEN
        DROP VIEW cappers;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cappers' AND table_type = 'BASE TABLE') THEN
        DROP TABLE cappers CASCADE;
    END IF;
END $$;

-- Create the view
CREATE VIEW cappers AS SELECT * FROM capper_profiles;

-- Validation query
SELECT 
  'Batch 4 completed - New tables created!' as status,
  (SELECT COUNT(*) FROM grading_results) as grading_results_count,
  (SELECT COUNT(*) FROM capper_profiles) as capper_profiles_count,
  (SELECT COUNT(*) FROM ml_features) as ml_features_count,
  (SELECT COUNT(*) FROM settlement_tracking) as settlement_tracking_count,
  NOW() as completed_at;
