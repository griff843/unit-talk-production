-- =====================================================
-- ML FEATURE STORAGE TABLES - SUPABASE VERSION
-- Simplified version without RLS for immediate deployment
-- =====================================================

-- Player statistics table (historical performance)
CREATE TABLE IF NOT EXISTS player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  sport TEXT NOT NULL,
  team TEXT,
  game_date DATE NOT NULL,
  game_id TEXT,
  opponent TEXT,
  home_away TEXT CHECK (home_away IN ('home', 'away')),
  stats JSONB NOT NULL,
  season INTEGER NOT NULL,
  week INTEGER,
  game_number INTEGER,
  minutes_played NUMERIC(5,2),
  dnp_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_stats_unique
  ON player_stats(player_id, sport, game_date);

CREATE INDEX IF NOT EXISTS idx_player_stats_lookup
  ON player_stats(player_id, sport, game_date DESC);

CREATE INDEX IF NOT EXISTS idx_player_stats_season
  ON player_stats(sport, season, player_id);

CREATE INDEX IF NOT EXISTS idx_player_stats_team
  ON player_stats(team, game_date DESC);

-- League averages table (cached statistical baselines)
CREATE TABLE IF NOT EXISTS league_averages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL,
  season INTEGER NOT NULL,
  market_type TEXT NOT NULL,
  stat_name TEXT NOT NULL,
  average_value NUMERIC(8,4) NOT NULL,
  median_value NUMERIC(8,4),
  std_deviation NUMERIC(8,4),
  sample_size INTEGER NOT NULL,
  percentile_25 NUMERIC(8,4),
  percentile_50 NUMERIC(8,4),
  percentile_75 NUMERIC(8,4),
  percentile_90 NUMERIC(8,4),
  last_calculated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_league_averages_unique
  ON league_averages(sport, season, market_type, stat_name);

CREATE INDEX IF NOT EXISTS idx_league_averages_sport
  ON league_averages(sport, season);

-- Settled outcomes table (ground truth for model training)
CREATE TABLE IF NOT EXISTS settled_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prop_id TEXT,
  external_id TEXT,
  sport TEXT NOT NULL,
  player_name TEXT,
  player_id TEXT,
  team TEXT,
  opponent TEXT,
  market_type TEXT NOT NULL,
  market_selection TEXT,
  line NUMERIC(6,2) NOT NULL,
  odds INTEGER,
  game_date DATE NOT NULL,
  game_id TEXT,
  actual_value NUMERIC(8,4),
  outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss', 'push', 'void')),
  settled_at TIMESTAMPTZ NOT NULL,
  predicted_probability NUMERIC(5,4),
  bookmaker TEXT,
  source TEXT NOT NULL DEFAULT 'settlement_engine',
  settlement_method TEXT,
  confidence NUMERIC(5,4),
  season INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_settled_outcomes_prop_id
  ON settled_outcomes(prop_id) WHERE prop_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_settled_outcomes_player
  ON settled_outcomes(player_id, sport, game_date DESC);

CREATE INDEX IF NOT EXISTS idx_settled_outcomes_market
  ON settled_outcomes(sport, market_type, game_date DESC);

CREATE INDEX IF NOT EXISTS idx_settled_outcomes_outcome
  ON settled_outcomes(outcome, sport, settled_at DESC);

CREATE INDEX IF NOT EXISTS idx_settled_outcomes_source
  ON settled_outcomes(source, settled_at DESC);

-- Probability predictions log
CREATE TABLE IF NOT EXISTS probability_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prop_id TEXT,
  external_id TEXT,
  sport TEXT NOT NULL,
  player_id TEXT,
  market_type TEXT NOT NULL,
  line NUMERIC(6,2) NOT NULL,
  predicted_probability NUMERIC(5,4) NOT NULL,
  confidence NUMERIC(5,4),
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  feature_contributions JSONB,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  actual_outcome TEXT,
  was_correct BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_probability_predictions_prop
  ON probability_predictions(prop_id, calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_probability_predictions_player
  ON probability_predictions(player_id, sport, calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_probability_predictions_model
  ON probability_predictions(model_name, model_version, calculated_at DESC);

-- Line movement history table
CREATE TABLE IF NOT EXISTS line_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prop_id TEXT,
  event_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  bookmaker TEXT NOT NULL,
  market TEXT NOT NULL,
  selection TEXT,
  line NUMERIC(6,2),
  odds INTEGER,
  decimal_odds NUMERIC(6,3),
  probability NUMERIC(5,4),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  movement_from_open NUMERIC(6,2),
  velocity NUMERIC(6,2),
  is_steam BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_history_prop
  ON line_history(prop_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_line_history_event
  ON line_history(event_id, market, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_line_history_bookmaker
  ON line_history(bookmaker, sport, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_line_history_steam
  ON line_history(is_steam, timestamp DESC) WHERE is_steam = TRUE;

-- Feature values table
CREATE TABLE IF NOT EXISTS feature_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  feature_category TEXT,
  value JSONB NOT NULL,
  confidence NUMERIC(5,4),
  as_of TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_values_lookup
  ON feature_values(entity_type, entity_id, sport, feature_name);

CREATE INDEX IF NOT EXISTS idx_feature_values_asof
  ON feature_values(as_of DESC);

CREATE INDEX IF NOT EXISTS idx_feature_values_sport_category
  ON feature_values(sport, feature_category);

CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_values_unique
  ON feature_values(entity_type, entity_id, sport, feature_name, as_of);

-- Model performance tracking
CREATE TABLE IF NOT EXISTS model_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  sport TEXT NOT NULL,
  market_type TEXT,
  evaluation_period_start DATE NOT NULL,
  evaluation_period_end DATE NOT NULL,
  total_predictions INTEGER NOT NULL,
  correct_predictions INTEGER NOT NULL,
  accuracy NUMERIC(5,4) NOT NULL,
  log_loss NUMERIC(8,6),
  brier_score NUMERIC(8,6),
  roi NUMERIC(6,4),
  sharpe_ratio NUMERIC(6,4),
  max_drawdown NUMERIC(6,4),
  calibration_score NUMERIC(5,4),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_performance_model
  ON model_performance(model_name, model_version, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_model_performance_sport
  ON model_performance(sport, evaluation_period_end DESC);

-- Comments
COMMENT ON TABLE player_stats IS 'Historical player game-by-game statistics from external APIs';
COMMENT ON TABLE league_averages IS 'Cached league-wide statistical baselines for normalization';
COMMENT ON TABLE settled_outcomes IS 'Ground truth outcomes for model training and backtesting';
COMMENT ON TABLE probability_predictions IS 'Log of all probability predictions made by models';
COMMENT ON TABLE line_history IS 'Line movement tracking from bookmakers for CLV and sharp money detection';
COMMENT ON TABLE feature_values IS 'Stores computed feature values for ML models';
COMMENT ON TABLE model_performance IS 'Model accuracy and performance metrics over time';
opt