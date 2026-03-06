-- Migration: Create closing_snapshots + clv_results tables
-- Sprint: SPRINT-025-CLV-CLOSING-SNAPSHOT
-- Rollback:
--   DROP TABLE IF EXISTS clv_results;
--   DROP TABLE IF EXISTS closing_snapshots;

-- =============================================================================
-- closing_snapshots: consensus devig at market close
-- Writer: ClosingSnapshotAgent (single-writer discipline)
-- Idempotency: UNIQUE(market_key)
-- =============================================================================

CREATE TABLE closing_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  market_type_id INT NOT NULL,
  participant_id UUID,
  market_key TEXT NOT NULL,

  p_close_over NUMERIC NOT NULL,
  p_close_under NUMERIC NOT NULL,
  devig_method TEXT NOT NULL DEFAULT 'proportional',
  book_count INT NOT NULL,
  books_json JSONB NOT NULL,

  game_start_time TIMESTAMPTZ NOT NULL,
  close_window_start TIMESTAMPTZ NOT NULL,
  close_window_end TIMESTAMPTZ NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  model_version TEXT NOT NULL,

  UNIQUE(market_key)
);

CREATE INDEX idx_closing_snapshots_event ON closing_snapshots(event_id);
CREATE INDEX idx_closing_snapshots_captured ON closing_snapshots(captured_at);

-- =============================================================================
-- clv_results: per-pick CLV computation (production-grade, strong typing)
-- Writer: CLVAgent (single-writer discipline)
-- Idempotency: UNIQUE(pick_id, model_version, close_kind)
-- =============================================================================

CREATE TABLE clv_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID NOT NULL REFERENCES unified_picks(id) ON DELETE CASCADE,

  model_version TEXT NOT NULL,
  feature_set_version TEXT NOT NULL,
  close_kind TEXT NOT NULL,

  book_count INT NOT NULL CHECK (book_count >= 0),
  p_entry_market_devig NUMERIC,
  p_close_market_devig NUMERIC,
  clv_prob NUMERIC NOT NULL CHECK (clv_prob BETWEEN -1 AND 1),
  clv_price NUMERIC,
  clv_line NUMERIC,

  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason_code TEXT,
  meta JSONB,

  UNIQUE(pick_id, model_version, close_kind)
);

CREATE INDEX idx_clv_results_pick ON clv_results(pick_id);
CREATE INDEX idx_clv_results_model_computed ON clv_results(model_version, computed_at DESC);
CREATE INDEX idx_clv_results_computed ON clv_results(computed_at DESC);
