-- Migration: Shadow scoring tables for historical backfill analysis
-- Sprint: SPRINT-027A-SGO-HISTORICAL-BACKFILL
-- Rollback:
--   DROP TABLE IF EXISTS shadow_clv_results;
--   DROP TABLE IF EXISTS shadow_scores;
--   DROP TABLE IF EXISTS shadow_scoring_runs;

-- ============================================================================
-- 1. shadow_scoring_runs: Run metadata and tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS shadow_scoring_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  params JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shadow_scoring_runs_status
  ON shadow_scoring_runs(status, started_at DESC);

COMMENT ON TABLE shadow_scoring_runs IS
  'Run metadata for shadow scoring pipelines. Completely isolated from production. SPRINT-027A.';

-- ============================================================================
-- 2. shadow_scores: Scoring outputs from historical provider_offers
-- ============================================================================

CREATE TABLE IF NOT EXISTS shadow_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES shadow_scoring_runs(id),
  market_key TEXT NOT NULL,
  event_id UUID NOT NULL,
  market_type_id INTEGER NOT NULL,
  participant_id UUID,
  snapshot_at TIMESTAMPTZ NOT NULL,

  -- Multi-book consensus inputs
  book_count INTEGER NOT NULL CHECK (book_count >= 0),
  providers TEXT[] NOT NULL,

  -- Probability layer outputs
  p_market_devig DOUBLE PRECISION,
  p_final DOUBLE PRECISION,
  edge_final DOUBLE PRECISION,
  uncertainty_final DOUBLE PRECISION,
  clv_forecast DOUBLE PRECISION,

  -- Scoring outputs
  tier TEXT,
  score DOUBLE PRECISION,
  model_version TEXT NOT NULL,
  devig_mode TEXT NOT NULL,
  explain_v3 JSONB,

  scored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (market_key, model_version, snapshot_at)
);

CREATE INDEX IF NOT EXISTS idx_shadow_scores_event
  ON shadow_scores(event_id, market_type_id);
CREATE INDEX IF NOT EXISTS idx_shadow_scores_tier
  ON shadow_scores(tier);
CREATE INDEX IF NOT EXISTS idx_shadow_scores_scored
  ON shadow_scores(scored_at DESC);
CREATE INDEX IF NOT EXISTS idx_shadow_scores_model
  ON shadow_scores(model_version);
CREATE INDEX IF NOT EXISTS idx_shadow_scores_run
  ON shadow_scores(run_id);

COMMENT ON TABLE shadow_scores IS
  'Shadow scoring results from historical provider_offers. Completely isolated from production. SPRINT-027A.';

-- ============================================================================
-- 3. shadow_clv_results: CLV computed from open vs close odds
-- ============================================================================

CREATE TABLE IF NOT EXISTS shadow_clv_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES shadow_scoring_runs(id),
  market_key TEXT NOT NULL,
  event_id UUID NOT NULL,
  market_type_id INTEGER NOT NULL,
  participant_id UUID,
  model_version TEXT NOT NULL,

  -- CLV computation inputs
  book_count_open INTEGER,
  book_count_close INTEGER,
  p_open_devig DOUBLE PRECISION,
  p_close_devig DOUBLE PRECISION,

  -- CLV result
  clv_prob DOUBLE PRECISION NOT NULL CHECK (clv_prob BETWEEN -1 AND 1),

  -- Diagnostics
  reason_code TEXT,
  meta JSONB,

  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (market_key, model_version)
);

CREATE INDEX IF NOT EXISTS idx_shadow_clv_event
  ON shadow_clv_results(event_id);
CREATE INDEX IF NOT EXISTS idx_shadow_clv_model
  ON shadow_clv_results(model_version);
CREATE INDEX IF NOT EXISTS idx_shadow_clv_computed
  ON shadow_clv_results(computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_shadow_clv_run
  ON shadow_clv_results(run_id);

COMMENT ON TABLE shadow_clv_results IS
  'CLV results from historical open vs close odds. Completely isolated from production. SPRINT-027A.';

-- ============================================================================
-- END OF MIGRATION
-- SPRINT-027A-SGO-HISTORICAL-BACKFILL
--
-- NEW TABLES:
-- - shadow_scoring_runs (run metadata)
-- - shadow_scores (scoring outputs, UNIQUE on market_key+model_version+snapshot_at)
-- - shadow_clv_results (CLV outputs, UNIQUE on market_key+model_version)
--
-- SAFETY: No FK to unified_picks, no publish_outbox, no Discord.
-- ============================================================================
