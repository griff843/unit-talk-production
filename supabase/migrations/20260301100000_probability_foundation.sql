-- ============================================================================
-- PROBABILITY FOUNDATION MIGRATION
-- Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001
-- Date: 2026-03-01
--
-- PURPOSE:
-- 1. Add probability primitives to scored_legs (P_final, uncertainty, edge, CLV forecast)
-- 2. Add devig consensus fields (p_market_devig, devig_method, consensus_weights)
-- 3. Create model_calibration_metrics table for ECE/Brier tracking
-- 4. Add probability model versioning
--
-- SPEC CONFORMANCE:
-- - MODEL_ARCHITECTURE_SPEC_v1.md: Required outputs (P_final, uncertainty)
-- - DEVIG_NORMALIZATION_SPEC_v1.md: Consensus computation and storage
-- - TELEMETRY_TRUTH_AUDIT_SPEC_v1.md: Model reproducibility
--
-- ROLLBACK: See end of file
-- ============================================================================

-- ============================================================================
-- 1. ADD PROBABILITY PRIMITIVES TO SCORED_LEGS
-- ============================================================================

-- P_final: Calibrated model probability for the selection (0-1)
ALTER TABLE scored_legs
  ADD COLUMN IF NOT EXISTS p_final NUMERIC(6,5)
  CHECK (p_final IS NULL OR (p_final >= 0 AND p_final <= 1));

COMMENT ON COLUMN scored_legs.p_final IS
  'Calibrated model probability for selection (0-1). Required for Intelligence Superiority. Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001';

-- uncertainty_final: Model uncertainty estimate (0-1, higher = more uncertain)
ALTER TABLE scored_legs
  ADD COLUMN IF NOT EXISTS uncertainty_final NUMERIC(6,5)
  CHECK (uncertainty_final IS NULL OR (uncertainty_final >= 0 AND uncertainty_final <= 1));

COMMENT ON COLUMN scored_legs.uncertainty_final IS
  'Model uncertainty estimate (0-1). Used for risk throttling and Kelly sizing. Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001';

-- edge_final: True edge = P_final - P_market_devig (can be negative)
ALTER TABLE scored_legs
  ADD COLUMN IF NOT EXISTS edge_final NUMERIC(7,5)
  CHECK (edge_final IS NULL OR (edge_final >= -1 AND edge_final <= 1));

COMMENT ON COLUMN scored_legs.edge_final IS
  'True edge = P_final - P_market_devig. Per DEVIG_NORMALIZATION_SPEC. Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001';

-- clv_forecast: Predicted CLV direction and magnitude
ALTER TABLE scored_legs
  ADD COLUMN IF NOT EXISTS clv_forecast NUMERIC(7,5)
  CHECK (clv_forecast IS NULL OR (clv_forecast >= -1 AND clv_forecast <= 1));

COMMENT ON COLUMN scored_legs.clv_forecast IS
  'Predicted CLV (probability space). For FIRE_NOW vs WAIT execution logic. Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001';

-- p_market_devig: Devigged market consensus probability
ALTER TABLE scored_legs
  ADD COLUMN IF NOT EXISTS p_market_devig NUMERIC(6,5)
  CHECK (p_market_devig IS NULL OR (p_market_devig >= 0 AND p_market_devig <= 1));

COMMENT ON COLUMN scored_legs.p_market_devig IS
  'Devigged market consensus probability. Per DEVIG_NORMALIZATION_SPEC. Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001';

-- devig_method: Which devig method was used (proportional, shin, power, logit)
ALTER TABLE scored_legs
  ADD COLUMN IF NOT EXISTS devig_method TEXT
  CHECK (devig_method IS NULL OR devig_method IN ('proportional', 'shin', 'power', 'logit'));

COMMENT ON COLUMN scored_legs.devig_method IS
  'Devig method used for consensus computation. Per DEVIG_NORMALIZATION_SPEC. Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001';

-- consensus_weights_json: Book weights used for consensus (for audit trail)
ALTER TABLE scored_legs
  ADD COLUMN IF NOT EXISTS consensus_weights_json JSONB;

COMMENT ON COLUMN scored_legs.consensus_weights_json IS
  'Book weights used for consensus: {book: {liquidity, sharp, quality, final}}. Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001';

-- probability_model_version: Version string for probability layer (separate from scoring model)
ALTER TABLE scored_legs
  ADD COLUMN IF NOT EXISTS probability_model_version TEXT;

COMMENT ON COLUMN scored_legs.probability_model_version IS
  'Version of probability model used (e.g., prob_v1.0.0). Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001';

-- ============================================================================
-- 2. ADD INDEXES FOR PROBABILITY QUERIES
-- ============================================================================

-- Index for calibration queries (by model version and outcome)
CREATE INDEX IF NOT EXISTS idx_scored_legs_probability_model
  ON scored_legs(probability_model_version, p_final)
  WHERE p_final IS NOT NULL;

-- Index for edge analysis
CREATE INDEX IF NOT EXISTS idx_scored_legs_edge_final
  ON scored_legs(edge_final)
  WHERE edge_final IS NOT NULL;

-- Index for CLV forecast analysis
CREATE INDEX IF NOT EXISTS idx_scored_legs_clv_forecast
  ON scored_legs(clv_forecast)
  WHERE clv_forecast IS NOT NULL;

-- Index for devig method analysis
CREATE INDEX IF NOT EXISTS idx_scored_legs_devig_method
  ON scored_legs(devig_method)
  WHERE devig_method IS NOT NULL;

-- ============================================================================
-- 3. CREATE MODEL_CALIBRATION_METRICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_calibration_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Model identification
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  probability_model_version TEXT NOT NULL,
  feature_set_version TEXT,

  -- Segmentation (nullable for overall metrics)
  sport TEXT,
  league TEXT,
  market_type TEXT,

  -- Time window
  window_start_utc TIMESTAMPTZ NOT NULL,
  window_end_utc TIMESTAMPTZ NOT NULL,

  -- Sample info
  sample_size INTEGER NOT NULL,
  win_count INTEGER NOT NULL,
  loss_count INTEGER NOT NULL,
  push_count INTEGER DEFAULT 0,

  -- Calibration metrics
  brier_score NUMERIC(8,6),
  ece NUMERIC(8,6),               -- Expected Calibration Error
  mce NUMERIC(8,6),               -- Maximum Calibration Error
  log_loss NUMERIC(10,6),

  -- Reliability buckets (JSON array)
  -- Each bucket: {bucket_lower, bucket_upper, count, avg_predicted, observed_rate, calibration_error}
  buckets_json JSONB NOT NULL,

  -- Metadata
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  computed_by TEXT,               -- 'calibration_job', 'manual', etc.

  -- Unique constraint: one metrics row per model/segment/window
  CONSTRAINT model_calibration_metrics_unique
    UNIQUE (model_name, model_version, probability_model_version, sport, league, market_type, window_start_utc, window_end_utc)
);

COMMENT ON TABLE model_calibration_metrics IS
  'Calibration metrics (ECE, Brier) per model version and segment. Per MODEL_ARCHITECTURE_SPEC. Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001';

-- Indexes for calibration metrics queries
CREATE INDEX IF NOT EXISTS idx_model_calibration_model
  ON model_calibration_metrics(model_name, model_version, probability_model_version);

CREATE INDEX IF NOT EXISTS idx_model_calibration_window
  ON model_calibration_metrics(window_end_utc DESC);

CREATE INDEX IF NOT EXISTS idx_model_calibration_sport
  ON model_calibration_metrics(sport, league)
  WHERE sport IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_model_calibration_brier
  ON model_calibration_metrics(brier_score)
  WHERE brier_score IS NOT NULL;

-- ============================================================================
-- 4. ADD PROBABILITY FIELDS TO UNIFIED_PICKS (FOR READ SURFACES)
-- ============================================================================

-- Mirror key probability fields for unified_picks read surface
ALTER TABLE unified_picks
  ADD COLUMN IF NOT EXISTS p_final NUMERIC(6,5)
  CHECK (p_final IS NULL OR (p_final >= 0 AND p_final <= 1));

ALTER TABLE unified_picks
  ADD COLUMN IF NOT EXISTS uncertainty_final NUMERIC(6,5)
  CHECK (uncertainty_final IS NULL OR (uncertainty_final >= 0 AND uncertainty_final <= 1));

ALTER TABLE unified_picks
  ADD COLUMN IF NOT EXISTS edge_final NUMERIC(7,5)
  CHECK (edge_final IS NULL OR (edge_final >= -1 AND edge_final <= 1));

ALTER TABLE unified_picks
  ADD COLUMN IF NOT EXISTS clv_forecast NUMERIC(7,5)
  CHECK (clv_forecast IS NULL OR (clv_forecast >= -1 AND clv_forecast <= 1));

COMMENT ON COLUMN unified_picks.p_final IS
  'Denormalized P_final from scored_legs. Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001';
COMMENT ON COLUMN unified_picks.uncertainty_final IS
  'Denormalized uncertainty from scored_legs. Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001';
COMMENT ON COLUMN unified_picks.edge_final IS
  'Denormalized edge from scored_legs. Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001';
COMMENT ON COLUMN unified_picks.clv_forecast IS
  'Denormalized CLV forecast from scored_legs. Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001';

-- Index for probability queries on unified_picks
CREATE INDEX IF NOT EXISTS idx_unified_picks_probability
  ON unified_picks(p_final, edge_final)
  WHERE p_final IS NOT NULL;

-- ============================================================================
-- 5. ADD PROVIDER REGISTRY COLUMNS FOR BOOK WEIGHTING
-- ============================================================================

-- Add book profile for sharp weighting (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provider_registry' AND column_name = 'book_profile'
  ) THEN
    ALTER TABLE provider_registry ADD COLUMN book_profile TEXT DEFAULT 'retail'
      CHECK (book_profile IN ('retail', 'market_maker', 'sharp'));
  END IF;
END $$;

-- Add liquidity tier for liquidity weighting (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provider_registry' AND column_name = 'liquidity_tier'
  ) THEN
    ALTER TABLE provider_registry ADD COLUMN liquidity_tier TEXT DEFAULT 'medium'
      CHECK (liquidity_tier IN ('low', 'medium', 'high'));
  END IF;
END $$;

-- Add data quality default (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provider_registry' AND column_name = 'data_quality_default'
  ) THEN
    ALTER TABLE provider_registry ADD COLUMN data_quality_default TEXT DEFAULT 'good'
      CHECK (data_quality_default IN ('good', 'partial', 'suspect'));
  END IF;
END $$;

COMMENT ON COLUMN provider_registry.book_profile IS
  'Book sharpness profile for consensus weighting. Per DEVIG_NORMALIZATION_SPEC. Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001';
COMMENT ON COLUMN provider_registry.liquidity_tier IS
  'Liquidity tier for consensus weighting. Per DEVIG_NORMALIZATION_SPEC. Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001';
COMMENT ON COLUMN provider_registry.data_quality_default IS
  'Default data quality for consensus weighting. Per DEVIG_NORMALIZATION_SPEC. Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001';

-- ============================================================================
-- 6. VIEW: Latest Calibration Metrics per Model
-- ============================================================================

CREATE OR REPLACE VIEW view_calibration_latest AS
SELECT DISTINCT ON (model_name, model_version, probability_model_version, sport, league, market_type)
  id,
  model_name,
  model_version,
  probability_model_version,
  sport,
  league,
  market_type,
  window_start_utc,
  window_end_utc,
  sample_size,
  brier_score,
  ece,
  mce,
  log_loss,
  created_at_utc
FROM model_calibration_metrics
ORDER BY
  model_name,
  model_version,
  probability_model_version,
  sport,
  league,
  market_type,
  window_end_utc DESC;

COMMENT ON VIEW view_calibration_latest IS
  'Latest calibration metrics per model/segment combination. Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001';

-- ============================================================================
-- 7. FUNCTION: Compute probability bucket for calibration
-- ============================================================================

CREATE OR REPLACE FUNCTION get_probability_bucket(p NUMERIC, bucket_width NUMERIC DEFAULT 0.05)
RETURNS TABLE (
  bucket_lower NUMERIC,
  bucket_upper NUMERIC
) AS $$
BEGIN
  bucket_lower := FLOOR(p / bucket_width) * bucket_width;
  bucket_upper := bucket_lower + bucket_width;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_probability_bucket IS
  'Returns probability bucket bounds for calibration analysis. Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001';

-- ============================================================================
-- END OF MIGRATION
-- Sprint: INTELLIGENCE-PROBABILITY-FOUNDATION-001
--
-- TABLES MODIFIED:
-- - scored_legs: +8 columns (p_final, uncertainty_final, edge_final, clv_forecast,
--                            p_market_devig, devig_method, consensus_weights_json,
--                            probability_model_version)
-- - unified_picks: +4 columns (p_final, uncertainty_final, edge_final, clv_forecast)
-- - provider_registry: +3 columns (book_profile, liquidity_tier, data_quality_default)
--
-- TABLES CREATED:
-- - model_calibration_metrics
--
-- VIEWS CREATED:
-- - view_calibration_latest
--
-- FUNCTIONS CREATED:
-- - get_probability_bucket
--
-- INDEXES: 10+ new performance indexes
--
-- ROLLBACK SQL:
-- DROP VIEW IF EXISTS view_calibration_latest;
-- DROP FUNCTION IF EXISTS get_probability_bucket;
-- DROP TABLE IF EXISTS model_calibration_metrics;
-- ALTER TABLE scored_legs DROP COLUMN IF EXISTS p_final;
-- ALTER TABLE scored_legs DROP COLUMN IF EXISTS uncertainty_final;
-- ALTER TABLE scored_legs DROP COLUMN IF EXISTS edge_final;
-- ALTER TABLE scored_legs DROP COLUMN IF EXISTS clv_forecast;
-- ALTER TABLE scored_legs DROP COLUMN IF EXISTS p_market_devig;
-- ALTER TABLE scored_legs DROP COLUMN IF EXISTS devig_method;
-- ALTER TABLE scored_legs DROP COLUMN IF EXISTS consensus_weights_json;
-- ALTER TABLE scored_legs DROP COLUMN IF EXISTS probability_model_version;
-- ALTER TABLE unified_picks DROP COLUMN IF EXISTS p_final;
-- ALTER TABLE unified_picks DROP COLUMN IF EXISTS uncertainty_final;
-- ALTER TABLE unified_picks DROP COLUMN IF EXISTS edge_final;
-- ALTER TABLE unified_picks DROP COLUMN IF EXISTS clv_forecast;
-- ALTER TABLE provider_registry DROP COLUMN IF EXISTS book_profile;
-- ALTER TABLE provider_registry DROP COLUMN IF EXISTS liquidity_tier;
-- ALTER TABLE provider_registry DROP COLUMN IF EXISTS data_quality_default;
-- ============================================================================
