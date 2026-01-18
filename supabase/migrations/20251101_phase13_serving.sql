-- ===============================================================================
-- PHASE 13: MODEL SERVING & ENSEMBLE INFRASTRUCTURE
-- ===============================================================================
-- Date: 2025-11-01
-- Charter: v3.0 → v4.0 upgrade
-- Purpose: Deploy model-serving infrastructure with canary rollout, continuous
--          evaluation, and governance integration
-- SLO Targets:
--   - p95 inference latency < 150ms
--   - Drift score < 0.05
--   - Accuracy ≥ baseline - 2%
-- ===============================================================================

-- ===============================================================================
-- 1. MODEL_PREDICTIONS_LIVE - Real-time model inference tracking
-- ===============================================================================
CREATE TABLE IF NOT EXISTS model_predictions_live (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Prediction Context
  pick_id UUID REFERENCES picks(id) ON DELETE CASCADE,
  prop_id UUID REFERENCES props(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES predictive_models(id),
  
  -- Ensemble Configuration
  ensemble_method TEXT NOT NULL CHECK (ensemble_method IN ('weighted_average', 'stacking', 'voting', 'bayesian')),
  ensemble_models JSONB NOT NULL DEFAULT '[]', -- Array of {model_id, weight, contribution}
  
  -- Prediction Output
  predicted_value DECIMAL(10,4),
  predicted_win_prob DECIMAL(5,4) NOT NULL,
  confidence_score DECIMAL(5,4) NOT NULL, -- 0-1, ensemble confidence
  
  -- Confidence Intervals
  confidence_interval_lower DECIMAL(10,4),
  confidence_interval_upper DECIMAL(10,4),
  confidence_level DECIMAL(5,4) DEFAULT 0.95,
  
  -- Model Agreement Metrics
  model_agreement_score DECIMAL(5,4), -- 0-1, how much models agree
  prediction_variance DECIMAL(10,6), -- Variance across ensemble
  
  -- Performance Tracking
  inference_latency_ms INTEGER NOT NULL, -- SLO: p95 < 150ms
  feature_extraction_ms INTEGER,
  model_execution_ms INTEGER,
  
  -- Drift Detection
  drift_score DECIMAL(5,4), -- 0-1, feature drift from training distribution
  drift_features JSONB DEFAULT '{}', -- Per-feature drift scores
  
  -- Actual Outcome (for continuous evaluation)
  actual_value DECIMAL(10,4),
  actual_outcome TEXT CHECK (actual_outcome IN ('win', 'loss', 'push', 'void')),
  prediction_error DECIMAL(10,4),
  prediction_correct BOOLEAN,
  
  -- Calibration Metrics
  calibration_bin INTEGER, -- Which probability bin (0-9 for 0-10%, 10-20%, etc.)
  calibration_error DECIMAL(5,4), -- Difference between predicted and actual
  
  -- Feature Snapshot
  features_used JSONB NOT NULL DEFAULT '{}', -- Features at inference time
  feature_importance JSONB DEFAULT '{}', -- Per-feature importance scores
  
  -- Deployment Context
  deployment_environment TEXT NOT NULL CHECK (deployment_environment IN ('dev', 'staging', 'prod')),
  deployment_mode TEXT NOT NULL CHECK (deployment_mode IN ('replace', 'shadow', 'ab_test', 'canary')),
  traffic_split DECIMAL(3,2), -- For A/B testing (0.0-1.0)
  canary_stage TEXT CHECK (canary_stage IN ('5pct', '25pct', '50pct', '100pct')),
  
  -- Metadata
  model_version TEXT NOT NULL,
  inference_id TEXT UNIQUE NOT NULL, -- Idempotency key
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcome_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT model_predictions_live_inference_unique UNIQUE (inference_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_model_predictions_live_tenant ON model_predictions_live(tenant_id, predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_predictions_live_pick ON model_predictions_live(pick_id) WHERE pick_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_model_predictions_live_model ON model_predictions_live(model_id, predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_predictions_live_latency ON model_predictions_live(inference_latency_ms) WHERE deployment_environment = 'prod';
CREATE INDEX IF NOT EXISTS idx_model_predictions_live_drift ON model_predictions_live(drift_score DESC NULLS LAST) WHERE drift_score > 0.05;
CREATE INDEX IF NOT EXISTS idx_model_predictions_live_canary ON model_predictions_live(deployment_mode, canary_stage, predicted_at DESC) WHERE deployment_mode = 'canary';
CREATE INDEX IF NOT EXISTS idx_model_predictions_live_evaluation ON model_predictions_live(predicted_at DESC) WHERE actual_outcome IS NULL AND predicted_at < NOW() - INTERVAL '1 hour';

COMMENT ON TABLE model_predictions_live IS 'Real-time model inference tracking with SLO monitoring (p95 < 150ms, drift < 0.05)';
COMMENT ON COLUMN model_predictions_live.inference_latency_ms IS 'SLO: p95 < 150ms for production inference';
COMMENT ON COLUMN model_predictions_live.drift_score IS 'SLO: drift_score < 0.05 triggers retraining';
COMMENT ON COLUMN model_predictions_live.confidence_score IS 'Ensemble confidence (0-1), higher = more agreement';

-- ===============================================================================
-- 2. MODEL_PERFORMANCE_HISTORY - Time-series performance tracking
-- ===============================================================================
CREATE TABLE IF NOT EXISTS model_performance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Model Identity
  model_id UUID NOT NULL REFERENCES predictive_models(id),
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  
  -- Time Window
  period_type TEXT NOT NULL CHECK (period_type IN ('hourly', 'daily', 'weekly', 'monthly')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Volume Metrics
  total_predictions INTEGER NOT NULL DEFAULT 0,
  predictions_with_outcome INTEGER DEFAULT 0,
  
  -- Accuracy Metrics
  accuracy DECIMAL(5,4), -- Overall accuracy
  precision_score DECIMAL(5,4),
  recall DECIMAL(5,4),
  f1_score DECIMAL(5,4),
  auc_roc DECIMAL(5,4),
  
  -- Regression Metrics (for continuous predictions)
  mean_absolute_error DECIMAL(10,4),
  mean_squared_error DECIMAL(10,4),
  root_mean_squared_error DECIMAL(10,4),
  r_squared DECIMAL(5,4),
  
  -- Calibration Metrics
  calibration_error DECIMAL(5,4), -- Expected Calibration Error (ECE)
  brier_score DECIMAL(5,4), -- Probability calibration
  
  -- Latency Metrics (SLO: p95 < 150ms)
  avg_latency_ms INTEGER,
  p50_latency_ms INTEGER,
  p95_latency_ms INTEGER, -- SLO target
  p99_latency_ms INTEGER,
  max_latency_ms INTEGER,
  
  -- Drift Metrics (SLO: drift < 0.05)
  avg_drift_score DECIMAL(5,4),
  max_drift_score DECIMAL(5,4),
  drift_violations INTEGER DEFAULT 0, -- Count of drift_score > 0.05
  
  -- Confidence Metrics
  avg_confidence DECIMAL(5,4),
  avg_model_agreement DECIMAL(5,4),
  low_confidence_predictions INTEGER DEFAULT 0, -- confidence < 0.5
  
  -- Error Analysis
  error_rate DECIMAL(5,4),
  total_errors INTEGER DEFAULT 0,
  error_types JSONB DEFAULT '{}', -- Breakdown by error type
  
  -- Deployment Context
  deployment_environment TEXT NOT NULL CHECK (deployment_environment IN ('dev', 'staging', 'prod')),
  deployment_mode TEXT CHECK (deployment_mode IN ('replace', 'shadow', 'ab_test', 'canary')),
  
  -- Baseline Comparison (SLO: accuracy ≥ baseline - 2%)
  baseline_accuracy DECIMAL(5,4),
  accuracy_delta DECIMAL(5,4), -- Current - baseline
  baseline_breach BOOLEAN GENERATED ALWAYS AS (accuracy_delta < -0.02) STORED,
  
  -- Prediction Distribution
  prediction_distribution JSONB DEFAULT '{}', -- Histogram of predictions
  outcome_distribution JSONB DEFAULT '{}', -- Histogram of actual outcomes
  
  -- Feature Importance (aggregated)
  avg_feature_importance JSONB DEFAULT '{}',
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT model_performance_history_unique UNIQUE (model_id, period_type, period_start)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_model_performance_history_tenant ON model_performance_history(tenant_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_model_performance_history_model ON model_performance_history(model_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_model_performance_history_period ON model_performance_history(period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_model_performance_history_slo_latency ON model_performance_history(p95_latency_ms) WHERE deployment_environment = 'prod' AND p95_latency_ms > 150;
CREATE INDEX IF NOT EXISTS idx_model_performance_history_slo_drift ON model_performance_history(max_drift_score) WHERE deployment_environment = 'prod' AND max_drift_score > 0.05;
CREATE INDEX IF NOT EXISTS idx_model_performance_history_slo_accuracy ON model_performance_history(baseline_breach) WHERE baseline_breach = true;
CREATE INDEX IF NOT EXISTS idx_model_performance_history_recent ON model_performance_history(period_start DESC) WHERE period_type = 'hourly' AND period_start > NOW() - INTERVAL '24 hours';

COMMENT ON TABLE model_performance_history IS 'Time-series model performance tracking with SLO breach detection';
COMMENT ON COLUMN model_performance_history.p95_latency_ms IS 'SLO: Must be < 150ms for production';
COMMENT ON COLUMN model_performance_history.max_drift_score IS 'SLO: Must be < 0.05, triggers retraining if exceeded';
COMMENT ON COLUMN model_performance_history.baseline_breach IS 'SLO: True if accuracy drops > 2% below baseline';

-- ===============================================================================
-- 3. FUNCTIONS - Automated SLO monitoring
-- ===============================================================================

-- Function to calculate current SLO compliance
CREATE OR REPLACE FUNCTION check_model_slo_compliance(
  p_model_id UUID,
  p_hours_back INTEGER DEFAULT 1
)
RETURNS TABLE (
  slo_name TEXT,
  current_value DECIMAL,
  threshold DECIMAL,
  compliant BOOLEAN,
  severity TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH recent_predictions AS (
    SELECT *
    FROM model_predictions_live
    WHERE model_id = p_model_id
      AND predicted_at > NOW() - (p_hours_back || ' hours')::INTERVAL
      AND deployment_environment = 'prod'
  )
  SELECT 
    'p95_latency'::TEXT,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY inference_latency_ms)::DECIMAL,
    150::DECIMAL,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY inference_latency_ms) < 150,
    CASE 
      WHEN PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY inference_latency_ms) > 200 THEN 'critical'
      WHEN PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY inference_latency_ms) > 150 THEN 'warning'
      ELSE 'ok'
    END::TEXT
  FROM recent_predictions
  
  UNION ALL
  
  SELECT 
    'max_drift_score'::TEXT,
    MAX(drift_score)::DECIMAL,
    0.05::DECIMAL,
    MAX(drift_score) < 0.05,
    CASE 
      WHEN MAX(drift_score) > 0.1 THEN 'critical'
      WHEN MAX(drift_score) > 0.05 THEN 'warning'
      ELSE 'ok'
    END::TEXT
  FROM recent_predictions
  WHERE drift_score IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_model_slo_compliance IS 'Real-time SLO compliance check for model serving (latency, drift)';

-- ===============================================================================
-- 4. TRIGGERS - Auto-update timestamps
-- ===============================================================================

CREATE OR REPLACE FUNCTION update_model_predictions_live_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_model_predictions_live_updated_at
  BEFORE UPDATE ON model_predictions_live
  FOR EACH ROW
  EXECUTE FUNCTION update_model_predictions_live_updated_at();

CREATE TRIGGER trigger_model_performance_history_updated_at
  BEFORE UPDATE ON model_performance_history
  FOR EACH ROW
  EXECUTE FUNCTION update_model_predictions_live_updated_at();

-- ===============================================================================
-- 5. POSTGREST SCHEMA RELOAD (Charter v3.0 Compliance)
-- ===============================================================================
SELECT pg_notify('pgrst', 'reload schema');

