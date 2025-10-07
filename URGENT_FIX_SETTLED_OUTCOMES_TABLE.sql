-- URGENT FIX: Create missing settled_outcomes and player_stats tables
-- Issue: 2.3M outcomes have actual_value = null because tables don't exist in local PostgreSQL
-- Root Cause: Migration never applied to local database
-- Solution: Create tables NOW
--
-- Run this with:
-- docker-compose exec -T postgres psql -U postgres -d postgres -f URGENT_FIX_SETTLED_OUTCOMES_TABLE.sql

-- ============================================================================
-- SETTLED OUTCOMES TABLE (CRITICAL FOR TIER 1 VALIDATION)
-- ============================================================================

CREATE TABLE IF NOT EXISTS settled_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Prop Identification
  prop_id TEXT,
  external_id TEXT,

  -- Sport & Player Details
  sport TEXT NOT NULL,
  player_name TEXT,
  player_id TEXT,
  team TEXT,
  opponent TEXT,

  -- Market Details
  market_type TEXT NOT NULL,
  market_selection TEXT,
  line NUMERIC(6,2) NOT NULL,
  odds INTEGER,

  -- Game Information
  game_date DATE NOT NULL,
  game_id TEXT,

  -- CRITICAL: Settlement Data
  actual_value NUMERIC(8,4),  -- ⚠️ THIS IS THE FIELD THAT'S NULL - FIX THIS!
  outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss', 'push', 'void')),
  settled_at TIMESTAMPTZ NOT NULL,

  -- Prediction & Confidence
  predicted_probability NUMERIC(5,4),
  confidence NUMERIC(5,4),

  -- Source & Method
  bookmaker TEXT,
  source TEXT NOT NULL DEFAULT 'settlement_engine',
  settlement_method TEXT,

  -- Additional Metadata
  season INTEGER,
  metadata JSONB,

  -- Audit Trail
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
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

CREATE INDEX IF NOT EXISTS idx_settled_outcomes_game_date
  ON settled_outcomes(game_date DESC);

-- Index specifically for settlement rate queries
CREATE INDEX IF NOT EXISTS idx_settled_outcomes_actual_value_not_null
  ON settled_outcomes(actual_value) WHERE actual_value IS NOT NULL;

COMMENT ON TABLE settled_outcomes IS 'Historical settlement data from SGO and other sources - CRITICAL for Tier 1 validation (requires >95% settlement rate)';
COMMENT ON COLUMN settled_outcomes.actual_value IS 'The actual stat value achieved by the player (e.g., player got 3 hits, 250 yards, etc.) - MUST NOT BE NULL for settled outcomes';

-- ============================================================================
-- PLAYER STATS TABLE (REQUIRED FOR ML PROBABILITY CALCULATIONS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Player & Sport
  sport TEXT NOT NULL,
  player_name TEXT NOT NULL,
  player_id TEXT,

  -- Game Context
  game_date DATE NOT NULL,
  game_id TEXT,
  team TEXT,
  opponent TEXT,

  -- Stats Data (JSONB for flexibility)
  stats JSONB NOT NULL,  -- e.g., {"hits": 3, "homeRuns": 1, "rbi": 2}

  -- Source & Quality
  source TEXT NOT NULL DEFAULT 'sgo',
  data_quality NUMERIC(5,4) DEFAULT 1.0,

  -- Metadata
  metadata JSONB,
  season INTEGER,

  -- Audit Trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_player_stats_lookup
  ON player_stats(player_name, game_date, sport);

CREATE INDEX IF NOT EXISTS idx_player_stats_player_id
  ON player_stats(player_id, game_date DESC) WHERE player_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_player_stats_sport
  ON player_stats(sport, game_date DESC);

CREATE INDEX IF NOT EXISTS idx_player_stats_game
  ON player_stats(game_id) WHERE game_id IS NOT NULL;

-- Unique constraint to prevent duplicate stats
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_stats_unique
  ON player_stats(player_name, game_date, sport, source);

COMMENT ON TABLE player_stats IS 'Player statistics by game - used for ML probability calculations and settlement matching';
COMMENT ON COLUMN player_stats.stats IS 'JSONB object containing all player stats for the game (e.g., {"hits": 3, "passingYards": 250})';

-- ============================================================================
-- PROBABILITY PREDICTIONS TABLE (FOR ML MODEL TRACKING)
-- ============================================================================

CREATE TABLE IF NOT EXISTS probability_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links to Props
  prop_id TEXT,
  external_id TEXT,

  -- Sport & Player
  sport TEXT NOT NULL,
  player_id TEXT,
  player_name TEXT,

  -- Market Details
  market_type TEXT NOT NULL,
  line NUMERIC(6,2) NOT NULL,

  -- Predictions
  predicted_probability NUMERIC(5,4) NOT NULL,  -- Model's predicted probability
  model_version TEXT NOT NULL,
  model_features JSONB,

  -- Calibration Data
  calibrated_probability NUMERIC(5,4),
  confidence_interval JSONB,  -- {"lower": 0.45, "upper": 0.65}

  -- Game Context
  game_date DATE NOT NULL,
  game_id TEXT,

  -- Actual Outcome (for validation)
  actual_outcome TEXT CHECK (actual_outcome IN ('win', 'loss', 'push', 'void')),
  actual_value NUMERIC(8,4),

  -- Model Performance Metrics
  brier_score NUMERIC(8,6),
  log_loss NUMERIC(8,6),

  -- Source & Timing
  source TEXT NOT NULL DEFAULT 'ml_engine',
  predicted_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_probability_predictions_prop
  ON probability_predictions(prop_id) WHERE prop_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_probability_predictions_player
  ON probability_predictions(player_id, game_date DESC) WHERE player_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_probability_predictions_model
  ON probability_predictions(model_version, predicted_at DESC);

CREATE INDEX IF NOT EXISTS idx_probability_predictions_sport
  ON probability_predictions(sport, game_date DESC);

COMMENT ON TABLE probability_predictions IS 'ML model probability predictions with actual outcomes for model validation and calibration';
COMMENT ON COLUMN probability_predictions.brier_score IS 'Brier score for this prediction (lower is better, target <0.20 for Tier 1)';

-- ============================================================================
-- VALIDATION QUERIES
-- ============================================================================

-- Query to check settlement rate (should be >95% for Tier 1)
CREATE OR REPLACE VIEW settlement_rate_summary AS
SELECT
  COUNT(*) as total_outcomes,
  COUNT(actual_value) as outcomes_with_actual_value,
  COUNT(*) - COUNT(actual_value) as outcomes_missing_actual_value,
  ROUND(COUNT(actual_value) * 100.0 / NULLIF(COUNT(*), 0), 2) as settlement_rate_pct,
  CASE
    WHEN COUNT(actual_value) * 100.0 / NULLIF(COUNT(*), 0) >= 95 THEN '✅ TIER 1 READY'
    WHEN COUNT(actual_value) * 100.0 / NULLIF(COUNT(*), 0) >= 80 THEN '⚠️  CLOSE TO TIER 1'
    ELSE '❌ NEEDS IMPROVEMENT'
  END as tier_1_status
FROM settled_outcomes;

-- Query to check settlement rate by sport
CREATE OR REPLACE VIEW settlement_rate_by_sport AS
SELECT
  sport,
  COUNT(*) as total_outcomes,
  COUNT(actual_value) as with_actual_value,
  ROUND(COUNT(actual_value) * 100.0 / NULLIF(COUNT(*), 0), 2) as settlement_rate_pct,
  MIN(game_date) as earliest_game,
  MAX(game_date) as latest_game
FROM settled_outcomes
GROUP BY sport
ORDER BY settlement_rate_pct DESC;

-- Query to identify problematic outcomes (missing actual_value)
CREATE OR REPLACE VIEW problematic_outcomes AS
SELECT
  sport,
  market_type,
  COUNT(*) as count_missing_actual_value,
  array_agg(DISTINCT source) as sources,
  MIN(game_date) as earliest_game,
  MAX(game_date) as latest_game
FROM settled_outcomes
WHERE actual_value IS NULL
GROUP BY sport, market_type
ORDER BY count_missing_actual_value DESC
LIMIT 20;

COMMENT ON VIEW settlement_rate_summary IS 'Overall settlement rate summary - MUST BE >95% for Tier 1 validation';
COMMENT ON VIEW settlement_rate_by_sport IS 'Settlement rate breakdown by sport to identify data gaps';
COMMENT ON VIEW problematic_outcomes IS 'Outcomes missing actual_value to help debug settlement issues';

-- ============================================================================
-- SUCCESS VERIFICATION
-- ============================================================================

-- Print success message and current status
DO $$
DECLARE
  settled_count INTEGER;
  player_stats_count INTEGER;
  predictions_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO settled_count FROM settled_outcomes;
  SELECT COUNT(*) INTO player_stats_count FROM player_stats;
  SELECT COUNT(*) INTO predictions_count FROM probability_predictions;

  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '✅ URGENT FIX APPLIED SUCCESSFULLY';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables Created:';
  RAISE NOTICE '  ✅ settled_outcomes (% rows)', settled_count;
  RAISE NOTICE '  ✅ player_stats (% rows)', player_stats_count;
  RAISE NOTICE '  ✅ probability_predictions (% rows)', predictions_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Views Created:';
  RAISE NOTICE '  ✅ settlement_rate_summary';
  RAISE NOTICE '  ✅ settlement_rate_by_sport';
  RAISE NOTICE '  ✅ problematic_outcomes';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Run SGO ingestion to populate settled_outcomes';
  RAISE NOTICE '  2. Check settlement rate: SELECT * FROM settlement_rate_summary;';
  RAISE NOTICE '  3. Verify data quality: SELECT * FROM settlement_rate_by_sport;';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
END $$;
