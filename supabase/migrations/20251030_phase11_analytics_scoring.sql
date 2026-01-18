-- ===============================================================================
-- Phase 11: Canonical Analytics + Model Ingestion (Charter v3.0)
-- Date: 2025-10-30
-- Purpose: Internal scoring infrastructure, analytics foundation, and predictive pipeline scaffolding
-- Reference: docs/PRODUCTION_CHARTER.md
-- ===============================================================================

-- ===============================================================================
-- 1. INTERNAL_SCORES TABLE - Detailed scoring breakdown for ML models
-- ===============================================================================
CREATE TABLE IF NOT EXISTS internal_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pick_id UUID NOT NULL REFERENCES picks(id) ON DELETE CASCADE,

  -- Core Score Components (from GradingAgent)
  professional_score DECIMAL(5,2) NOT NULL,

  -- Probability & Edge Calculations
  devigged_win_prob DECIMAL(5,4),
  devigged_edge DECIMAL(5,4),
  true_odds INTEGER,
  implied_prob DECIMAL(5,4),

  -- Advanced Metrics
  clv_pct DECIMAL(5,2),              -- Closing Line Value percentage
  kelly_fraction DECIMAL(5,4),        -- Kelly Criterion optimal bet size
  sharp_money_alignment DECIMAL(5,4), -- Alignment with sharp book movement
  steam_move_detected BOOLEAN DEFAULT false,

  -- Market Intelligence
  market_efficiency_score DECIMAL(5,4),
  reverse_line_movement BOOLEAN DEFAULT false,
  public_betting_pct DECIMAL(5,4),
  sharp_betting_pct DECIMAL(5,4),

  -- Model Features (8 advanced grading features)
  timing_score DECIMAL(5,4),          -- Optimal timing of pick submission
  line_shopping_score DECIMAL(5,4),   -- Best available line captured
  correlation_risk DECIMAL(5,4),      -- Correlation with other picks
  recency_bias_adj DECIMAL(5,4),      -- Adjustment for recency bias

  -- ML Model Predictions
  win_probability_model_v1 DECIMAL(5,4),
  win_probability_model_v2 DECIMAL(5,4),
  expected_value DECIMAL(8,4),
  variance DECIMAL(8,4),

  -- Historical Context
  player_form_score DECIMAL(5,4),
  matchup_score DECIMAL(5,4),
  venue_impact_score DECIMAL(5,4),
  weather_impact_score DECIMAL(5,4),

  -- Grading Metadata
  grading_engine_version TEXT NOT NULL,
  features_used TEXT[],
  model_confidence DECIMAL(5,4),
  processing_time_ms INTEGER,

  -- Data Quality
  data_completeness_score DECIMAL(5,4),
  feature_quality_flags JSONB DEFAULT '{}',

  -- Timestamps
  scored_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata for extensibility
  metadata JSONB DEFAULT '{}',

  -- Constraints
  CONSTRAINT internal_scores_pick_unique UNIQUE (pick_id),
  CONSTRAINT internal_scores_professional_score_range CHECK (professional_score BETWEEN 0 AND 100),
  CONSTRAINT internal_scores_probabilities_valid CHECK (
    devigged_win_prob IS NULL OR (devigged_win_prob >= 0 AND devigged_win_prob <= 1)
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_internal_scores_tenant_id ON internal_scores(tenant_id, scored_at DESC);
CREATE INDEX IF NOT EXISTS idx_internal_scores_pick_id ON internal_scores(pick_id);
CREATE INDEX IF NOT EXISTS idx_internal_scores_professional_score ON internal_scores(tenant_id, professional_score DESC);
CREATE INDEX IF NOT EXISTS idx_internal_scores_clv ON internal_scores(tenant_id, clv_pct DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_internal_scores_steam_moves ON internal_scores(tenant_id, steam_move_detected, scored_at DESC) WHERE steam_move_detected = true;
CREATE INDEX IF NOT EXISTS idx_internal_scores_sharp_alignment ON internal_scores(tenant_id, sharp_money_alignment DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_internal_scores_model_confidence ON internal_scores(tenant_id, model_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_internal_scores_metadata ON internal_scores USING GIN (metadata);

COMMENT ON TABLE internal_scores IS 'Detailed scoring breakdown for ML model ingestion and predictive analytics';
COMMENT ON COLUMN internal_scores.professional_score IS 'Overall professional score (0-100) from GradingAgent';
COMMENT ON COLUMN internal_scores.clv_pct IS 'Closing Line Value - percentage difference from closing line';
COMMENT ON COLUMN internal_scores.kelly_fraction IS 'Kelly Criterion optimal bet sizing fraction';
COMMENT ON COLUMN internal_scores.steam_move_detected IS 'Indicates if pick captured a steam move (sharp money influx)';
COMMENT ON COLUMN internal_scores.model_confidence IS 'ML model confidence score (0-1) for this prediction';

-- ===============================================================================
-- 2. WAREHOUSE_SYNC_LOG TABLE - Track data warehouse synchronization
-- ===============================================================================
CREATE TABLE IF NOT EXISTS warehouse_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Sync Job Details
  job_id TEXT NOT NULL UNIQUE,
  job_type TEXT NOT NULL CHECK (job_type IN ('full', 'incremental', 'backfill', 'validation')),

  -- Scope
  table_name TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),

  -- Metrics
  rows_processed INTEGER DEFAULT 0,
  rows_inserted INTEGER DEFAULT 0,
  rows_updated INTEGER DEFAULT 0,
  rows_deleted INTEGER DEFAULT 0,
  bytes_transferred BIGINT DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds DECIMAL(10,2),

  -- Error Handling
  error_message TEXT,
  error_details JSONB,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Watermarks for incremental sync
  last_synced_timestamp TIMESTAMPTZ,
  last_synced_id UUID,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_warehouse_sync_log_job_id ON warehouse_sync_log(job_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_sync_log_table_status ON warehouse_sync_log(table_name, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_sync_log_tenant ON warehouse_sync_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_sync_log_status ON warehouse_sync_log(status, created_at DESC);

COMMENT ON TABLE warehouse_sync_log IS 'Audit log for data warehouse synchronization jobs';

-- ===============================================================================
-- 3. PREDICTIVE_MODELS TABLE - Track ML model versions and performance
-- ===============================================================================
CREATE TABLE IF NOT EXISTS predictive_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Model Identity
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  model_type TEXT NOT NULL CHECK (model_type IN ('forecast', 'clv', 'steam_detector', 'churn', 'recommendation')),

  -- Model Status
  status TEXT NOT NULL DEFAULT 'training' CHECK (status IN ('training', 'validation', 'deployed', 'deprecated', 'failed')),

  -- Performance Metrics
  accuracy DECIMAL(5,4),
  precision_score DECIMAL(5,4),
  recall DECIMAL(5,4),
  f1_score DECIMAL(5,4),
  auc_roc DECIMAL(5,4),
  mean_absolute_error DECIMAL(10,4),

  -- Model Configuration
  hyperparameters JSONB DEFAULT '{}',
  feature_importance JSONB DEFAULT '{}',
  training_dataset_id TEXT,

  -- Deployment
  deployed_at TIMESTAMPTZ,
  deployment_environment TEXT CHECK (deployment_environment IN ('dev', 'staging', 'prod')),

  -- Resource Usage
  training_duration_minutes INTEGER,
  model_size_mb DECIMAL(10,2),
  inference_time_ms DECIMAL(8,2),

  -- Metadata
  description TEXT,
  author TEXT,
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT predictive_models_name_version_unique UNIQUE (model_name, model_version)
);

CREATE INDEX IF NOT EXISTS idx_predictive_models_type_status ON predictive_models(model_type, status);
CREATE INDEX IF NOT EXISTS idx_predictive_models_deployed ON predictive_models(status, deployed_at DESC) WHERE status = 'deployed';
CREATE INDEX IF NOT EXISTS idx_predictive_models_performance ON predictive_models(model_type, f1_score DESC NULLS LAST);

COMMENT ON TABLE predictive_models IS 'ML model registry with version tracking and performance metrics';

-- ===============================================================================
-- 4. FORECAST_PREDICTIONS TABLE - Store forecast model outputs
-- ===============================================================================
CREATE TABLE IF NOT EXISTS forecast_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Prediction Scope
  prop_id UUID REFERENCES props(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES predictive_models(id),

  -- Forecast Details
  forecast_type TEXT NOT NULL CHECK (forecast_type IN ('win_prob', 'player_performance', 'market_movement', 'volume')),
  forecast_horizon_minutes INTEGER NOT NULL, -- How far ahead (e.g., 60 for 1 hour)

  -- Predictions
  predicted_value DECIMAL(10,4),
  predicted_win_prob DECIMAL(5,4),
  confidence_interval_lower DECIMAL(10,4),
  confidence_interval_upper DECIMAL(10,4),
  confidence_level DECIMAL(5,4) DEFAULT 0.95,

  -- Actual Outcome (for backtesting)
  actual_value DECIMAL(10,4),
  prediction_error DECIMAL(10,4),

  -- Metadata
  features_used JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  predicted_at TIMESTAMPTZ DEFAULT NOW(),
  outcome_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forecast_predictions_tenant ON forecast_predictions(tenant_id, predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_forecast_predictions_prop ON forecast_predictions(prop_id, predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_forecast_predictions_model ON forecast_predictions(model_id, predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_forecast_predictions_type ON forecast_predictions(forecast_type, predicted_at DESC);

COMMENT ON TABLE forecast_predictions IS 'Forecast model predictions with backtesting capability';

-- ===============================================================================
-- 5. STEAM_MOVES TABLE - Track sharp money movements
-- ===============================================================================
CREATE TABLE IF NOT EXISTS steam_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Market Details
  prop_id UUID REFERENCES props(id) ON DELETE CASCADE,
  sport TEXT NOT NULL,
  market_type TEXT NOT NULL,

  -- Movement Detection
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  line_before DECIMAL(8,2),
  line_after DECIMAL(8,2),
  line_movement_pct DECIMAL(5,2),

  -- Odds Movement
  odds_before INTEGER,
  odds_after INTEGER,
  odds_movement_pct DECIMAL(5,2),

  -- Sharp Indicators
  volume_spike_detected BOOLEAN DEFAULT false,
  reverse_line_movement BOOLEAN DEFAULT false,
  multiple_books_movement INTEGER DEFAULT 0, -- How many books moved simultaneously

  -- Confidence Metrics
  steam_confidence_score DECIMAL(5,4), -- 0-1, how confident we are this is a steam move
  sharp_book_agreement_pct DECIMAL(5,4), -- % of sharp books showing same movement

  -- Related Picks
  affected_picks INTEGER DEFAULT 0, -- Number of picks affected by this steam move

  -- Model Detection
  model_id UUID REFERENCES predictive_models(id),
  detection_algorithm TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_steam_moves_tenant ON steam_moves(tenant_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_steam_moves_prop ON steam_moves(prop_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_steam_moves_confidence ON steam_moves(tenant_id, steam_confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_steam_moves_sport ON steam_moves(sport, detected_at DESC);

COMMENT ON TABLE steam_moves IS 'Sharp money movement detection for edge identification';

-- ===============================================================================
-- 6. CLV_TRACKING TABLE - Closing Line Value historical tracking
-- ===============================================================================
CREATE TABLE IF NOT EXISTS clv_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pick_id UUID NOT NULL REFERENCES picks(id) ON DELETE CASCADE,

  -- Pick Details at Submission
  submitted_at TIMESTAMPTZ NOT NULL,
  submitted_line DECIMAL(8,2),
  submitted_odds INTEGER,

  -- Closing Line
  closing_line DECIMAL(8,2),
  closing_odds INTEGER,
  closing_time TIMESTAMPTZ,

  -- CLV Calculation
  clv_cents DECIMAL(10,2),          -- CLV in cents (positive = beat closing line)
  clv_percentage DECIMAL(5,2),       -- CLV as percentage
  clv_standard_deviations DECIMAL(5,4), -- How many std devs from mean

  -- Market Context
  line_movement_total DECIMAL(8,2),  -- Total line movement from open to close
  time_to_close_minutes INTEGER,     -- Minutes between submission and game start

  -- Performance Classification
  clv_tier TEXT CHECK (clv_tier IN ('elite', 'strong', 'good', 'neutral', 'poor')),
  beat_closing_line BOOLEAN,

  -- Metadata
  bookmaker TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT clv_tracking_pick_unique UNIQUE (pick_id)
);

CREATE INDEX IF NOT EXISTS idx_clv_tracking_tenant ON clv_tracking(tenant_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_clv_tracking_pick ON clv_tracking(pick_id);
CREATE INDEX IF NOT EXISTS idx_clv_tracking_clv_pct ON clv_tracking(tenant_id, clv_percentage DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_clv_tracking_tier ON clv_tracking(clv_tier, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_clv_tracking_beat_closing ON clv_tracking(tenant_id, beat_closing_line, submitted_at DESC) WHERE beat_closing_line = true;

COMMENT ON TABLE clv_tracking IS 'Historical CLV tracking for predictive model training';

-- ===============================================================================
-- 7. ANALYTICS_JOBS TABLE - Scheduled analytics job tracking
-- ===============================================================================
CREATE TABLE IF NOT EXISTS analytics_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job Details
  job_type TEXT NOT NULL CHECK (job_type IN ('forecast_generation', 'clv_calculation', 'steam_detection', 'model_training', 'model_evaluation', 'warehouse_sync')),
  job_name TEXT NOT NULL,

  -- Schedule
  schedule_cron TEXT,
  next_run_at TIMESTAMPTZ,

  -- Execution Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'skipped')),

  -- Metrics
  records_processed INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds DECIMAL(10,2),

  -- Error Handling
  error_message TEXT,
  error_details JSONB,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Results
  output_summary JSONB DEFAULT '{}',

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_analytics_jobs_type_status ON analytics_jobs(job_type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_jobs_next_run ON analytics_jobs(next_run_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_analytics_jobs_status ON analytics_jobs(status, created_at DESC);

COMMENT ON TABLE analytics_jobs IS 'Scheduled analytics job tracking and execution logs';

-- ===============================================================================
-- 8. MATERIALIZED VIEWS - Pre-aggregated analytics for dbt models
-- ===============================================================================

-- Picks Performance Summary (Daily)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_picks_performance_daily AS
SELECT
  p.tenant_id,
  p.user_id,
  DATE(p.created_at) AS date,
  u.tier AS user_tier,
  COUNT(*) AS total_picks,
  COUNT(*) FILTER (WHERE p.status = 'won') AS won_picks,
  COUNT(*) FILTER (WHERE p.status = 'lost') AS lost_picks,
  COUNT(*) FILTER (WHERE p.status = 'push') AS push_picks,
  AVG(p.professional_score) AS avg_professional_score,
  AVG(CASE WHEN p.status IN ('won', 'lost') THEN p.professional_score END) AS avg_professional_score_settled,
  SUM(CASE WHEN p.status = 'won' THEN p.profit_loss ELSE 0 END) AS total_profit,
  SUM(CASE WHEN p.status = 'lost' THEN ABS(p.profit_loss) ELSE 0 END) AS total_loss,
  SUM(p.profit_loss) AS net_profit_loss,
  AVG(p.stake) AS avg_stake,
  ROUND(
    COUNT(*) FILTER (WHERE p.status = 'won')::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE p.status IN ('won', 'lost'))::NUMERIC, 0) * 100,
    2
  ) AS win_rate_pct
FROM picks p
JOIN users u ON p.user_id = u.id
WHERE p.workflow_stage = 'published'
GROUP BY p.tenant_id, p.user_id, DATE(p.created_at), u.tier;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_picks_performance_daily_unique
  ON mv_picks_performance_daily(tenant_id, user_id, date);
CREATE INDEX IF NOT EXISTS idx_mv_picks_performance_daily_date
  ON mv_picks_performance_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_mv_picks_performance_daily_tier
  ON mv_picks_performance_daily(user_tier, date DESC);

-- Internal Scores Summary (for ML model training)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_internal_scores_summary AS
SELECT
  i.tenant_id,
  DATE(i.scored_at) AS date,
  p.status AS pick_status,
  COUNT(*) AS total_scores,
  AVG(i.professional_score) AS avg_professional_score,
  AVG(i.clv_pct) AS avg_clv_pct,
  AVG(i.kelly_fraction) AS avg_kelly_fraction,
  AVG(i.sharp_money_alignment) AS avg_sharp_alignment,
  COUNT(*) FILTER (WHERE i.steam_move_detected = true) AS steam_moves_detected,
  AVG(i.model_confidence) AS avg_model_confidence,
  AVG(i.win_probability_model_v1) AS avg_win_prob_v1,
  AVG(i.expected_value) AS avg_expected_value,
  STDDEV(i.professional_score) AS stddev_professional_score,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY i.professional_score) AS median_professional_score,
  PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY i.professional_score) AS p90_professional_score
FROM internal_scores i
JOIN picks p ON i.pick_id = p.id
GROUP BY i.tenant_id, DATE(i.scored_at), p.status;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_internal_scores_summary_unique
  ON mv_internal_scores_summary(tenant_id, date, pick_status);
CREATE INDEX IF NOT EXISTS idx_mv_internal_scores_summary_date
  ON mv_internal_scores_summary(date DESC);

COMMENT ON MATERIALIZED VIEW mv_picks_performance_daily IS 'Daily picks performance metrics for analytics dashboards';
COMMENT ON MATERIALIZED VIEW mv_internal_scores_summary IS 'Internal scores aggregations for ML model feature engineering';

-- ===============================================================================
-- 9. FUNCTIONS - Analytics helper functions
-- ===============================================================================

-- Function to refresh analytics materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_picks_performance_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_internal_scores_summary;

  -- Also refresh Phase 15 views if they exist
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_usage_monthly;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_cost_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_api_metrics_hourly;
  EXCEPTION
    WHEN undefined_table THEN
      -- Views don't exist yet, skip
      NULL;
  END;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_analytics_views IS 'Refresh all analytics materialized views for dbt models';

-- Function to calculate CLV for a pick
CREATE OR REPLACE FUNCTION calculate_clv(
  p_pick_id UUID,
  p_closing_line DECIMAL(8,2),
  p_closing_odds INTEGER
)
RETURNS TABLE (
  clv_cents DECIMAL(10,2),
  clv_percentage DECIMAL(5,2),
  beat_closing_line BOOLEAN,
  clv_tier TEXT
) AS $$
DECLARE
  v_submitted_odds INTEGER;
  v_submitted_line DECIMAL(8,2);
  v_clv_cents DECIMAL(10,2);
  v_clv_pct DECIMAL(5,2);
  v_beat_closing BOOLEAN;
  v_clv_tier TEXT;
BEGIN
  -- Get submitted odds and line
  SELECT odds, metadata->>'line' INTO v_submitted_odds, v_submitted_line
  FROM picks WHERE id = p_pick_id;

  -- Calculate CLV in cents (simplified - assumes $100 bet)
  v_clv_cents := ((100.0 / ABS(v_submitted_odds)) - (100.0 / ABS(p_closing_odds))) * 100;

  -- Calculate CLV percentage
  v_clv_pct := (v_clv_cents / 100.0) * 100;

  -- Determine if beat closing line
  v_beat_closing := v_submitted_odds > p_closing_odds;

  -- Classify CLV tier
  v_clv_tier := CASE
    WHEN v_clv_pct >= 5.0 THEN 'elite'
    WHEN v_clv_pct >= 2.0 THEN 'strong'
    WHEN v_clv_pct >= 0.5 THEN 'good'
    WHEN v_clv_pct >= -0.5 THEN 'neutral'
    ELSE 'poor'
  END;

  RETURN QUERY SELECT v_clv_cents, v_clv_pct, v_beat_closing, v_clv_tier;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_clv IS 'Calculate Closing Line Value metrics for a pick';

-- ===============================================================================
-- 10. TRIGGERS - Auto-update timestamps
-- ===============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_internal_scores_updated_at BEFORE UPDATE ON internal_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_predictive_models_updated_at BEFORE UPDATE ON predictive_models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===============================================================================
-- 11. GRANTS - Service role access (RLS disabled for analytics tables)
-- ===============================================================================

-- Analytics tables are accessed by service role only, no RLS needed
ALTER TABLE internal_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictive_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE steam_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE clv_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_jobs ENABLE ROW LEVEL SECURITY;

-- Service role full access policies
CREATE POLICY "internal_scores_service_all" ON internal_scores FOR ALL USING (current_setting('role', true) = 'service_role');
CREATE POLICY "warehouse_sync_log_service_all" ON warehouse_sync_log FOR ALL USING (current_setting('role', true) = 'service_role');
CREATE POLICY "predictive_models_service_all" ON predictive_models FOR ALL USING (current_setting('role', true) = 'service_role');
CREATE POLICY "forecast_predictions_service_all" ON forecast_predictions FOR ALL USING (current_setting('role', true) = 'service_role');
CREATE POLICY "steam_moves_service_all" ON steam_moves FOR ALL USING (current_setting('role', true) = 'service_role');
CREATE POLICY "clv_tracking_service_all" ON clv_tracking FOR ALL USING (current_setting('role', true) = 'service_role');
CREATE POLICY "analytics_jobs_service_all" ON analytics_jobs FOR ALL USING (current_setting('role', true) = 'service_role');

-- ===============================================================================
-- 12. RELOAD POSTGREST SCHEMA CACHE
-- ===============================================================================

-- Notify PostgREST to reload schema cache (per Charter v3.0 requirement)
SELECT pg_notify('pgrst', 'reload schema');

-- ===============================================================================
-- END OF MIGRATION
-- ===============================================================================
