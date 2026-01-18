-- ===============================================================================
-- Phase 23: Route Optimizer & Ensemble Convergence Tracking
-- Date: 2025-11-14
-- Purpose: Idempotent creation of routing optimization and model convergence tables
-- Charter: v3.0
-- ===============================================================================
--
-- This migration is IDEMPOTENT and safe to re-run multiple times.
-- All statements use IF NOT EXISTS or OR REPLACE patterns.
--
-- Tables Created:
--   • routing_decisions - Model routing strategy decisions with agreement tracking
--   • ensemble_correlation_history - Model correlation tracking over time
--   • convergence_snapshots - Weight convergence monitoring
--
-- Indexes: 18 total (optimized for time-series queries and analytics)
-- Constraints: FK integrity, CHECK constraints for score ranges
-- RLS Policies: Service role full access, authenticated read-only
-- ===============================================================================

-- ===============================================================================
-- 1. ROUTING_DECISIONS TABLE - Model routing strategy tracking
-- ===============================================================================
CREATE TABLE IF NOT EXISTS routing_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Prediction Context
  prediction_id UUID NOT NULL,
  prop_id UUID REFERENCES props(id) ON DELETE CASCADE,

  -- Model Selection
  selected_models JSONB NOT NULL DEFAULT '[]', -- Array of selected model IDs
  model_weights JSONB NOT NULL DEFAULT '{}', -- Map of model_id -> weight

  -- Routing Strategy
  routing_method TEXT NOT NULL CHECK (routing_method IN ('balanced', 'weighted', 'selective', 'dynamic')),
  load_distribution JSONB DEFAULT '{}',

  -- Agreement Metrics (Phase 23)
  agreement_score DECIMAL(5,4) CHECK (agreement_score IS NULL OR (agreement_score >= 0 AND agreement_score <= 1)),
  convergence_score DECIMAL(5,4) CHECK (convergence_score IS NULL OR (convergence_score >= 0 AND convergence_score <= 1)),
  model_disagreement_flag BOOLEAN DEFAULT FALSE,

  -- Performance
  routing_latency_ms INTEGER,
  cache_hit BOOLEAN DEFAULT FALSE,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT routing_decisions_prediction_unique UNIQUE (prediction_id)
);

-- Indexes for routing_decisions
CREATE INDEX IF NOT EXISTS idx_routing_decisions_tenant
  ON routing_decisions(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_routing_decisions_prediction
  ON routing_decisions(prediction_id);

CREATE INDEX IF NOT EXISTS idx_routing_decisions_prop
  ON routing_decisions(prop_id) WHERE prop_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_routing_decisions_method
  ON routing_decisions(routing_method, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_routing_decisions_agreement
  ON routing_decisions(agreement_score DESC NULLS LAST)
  WHERE agreement_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_routing_decisions_convergence
  ON routing_decisions(convergence_score DESC NULLS LAST)
  WHERE convergence_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_routing_decisions_disagreement
  ON routing_decisions(created_at DESC)
  WHERE model_disagreement_flag = true;

CREATE INDEX IF NOT EXISTS idx_routing_decisions_recent
  ON routing_decisions(created_at DESC)
  WHERE created_at > NOW() - INTERVAL '7 days';

CREATE INDEX IF NOT EXISTS idx_routing_decisions_metadata
  ON routing_decisions USING GIN (metadata);

COMMENT ON TABLE routing_decisions IS 'Model routing strategy decisions with agreement and convergence tracking';
COMMENT ON COLUMN routing_decisions.agreement_score IS 'Model agreement score (0-1), higher = more consensus';
COMMENT ON COLUMN routing_decisions.convergence_score IS 'Weight convergence score (0-1), higher = more stable';
COMMENT ON COLUMN routing_decisions.model_disagreement_flag IS 'True if models significantly disagree (triggers alerts)';

-- ===============================================================================
-- 2. ENSEMBLE_CORRELATION_HISTORY TABLE - Model correlation tracking
-- ===============================================================================
CREATE TABLE IF NOT EXISTS ensemble_correlation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Model Pair
  model_a_id UUID NOT NULL,
  model_b_id UUID NOT NULL,

  -- Correlation Metrics
  correlation_coefficient DECIMAL(5,4) NOT NULL CHECK (correlation_coefficient >= -1 AND correlation_coefficient <= 1),
  window_days INTEGER NOT NULL,
  analysis_date TIMESTAMPTZ NOT NULL,
  trend_direction TEXT CHECK (trend_direction IN ('increasing', 'decreasing', 'stable', 'volatile')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign Keys (references predictive_models from phase11 migration)
  CONSTRAINT fk_model_a FOREIGN KEY (model_a_id) REFERENCES predictive_models(id) ON DELETE CASCADE,
  CONSTRAINT fk_model_b FOREIGN KEY (model_b_id) REFERENCES predictive_models(id) ON DELETE CASCADE
);

-- Indexes for ensemble_correlation_history
CREATE INDEX IF NOT EXISTS idx_ensemble_correlation_tenant
  ON ensemble_correlation_history(tenant_id, analysis_date DESC);

CREATE INDEX IF NOT EXISTS idx_ensemble_correlation_models
  ON ensemble_correlation_history(model_a_id, model_b_id, analysis_date DESC);

CREATE INDEX IF NOT EXISTS idx_ensemble_correlation_date
  ON ensemble_correlation_history(analysis_date DESC);

CREATE INDEX IF NOT EXISTS idx_ensemble_correlation_window
  ON ensemble_correlation_history(window_days);

CREATE INDEX IF NOT EXISTS idx_ensemble_correlation_recent
  ON ensemble_correlation_history(analysis_date DESC)
  WHERE analysis_date > NOW() - INTERVAL '30 days';

CREATE INDEX IF NOT EXISTS idx_ensemble_correlation_model_a
  ON ensemble_correlation_history(model_a_id);

CREATE INDEX IF NOT EXISTS idx_ensemble_correlation_model_b
  ON ensemble_correlation_history(model_b_id);

COMMENT ON TABLE ensemble_correlation_history IS 'Time-series tracking of correlation between model pairs';
COMMENT ON COLUMN ensemble_correlation_history.correlation_coefficient IS 'Pearson correlation (-1 to 1) between model predictions';
COMMENT ON COLUMN ensemble_correlation_history.window_days IS 'Rolling window size in days for correlation calculation';
COMMENT ON COLUMN ensemble_correlation_history.trend_direction IS 'Trend of correlation over time (increasing/decreasing/stable/volatile)';

-- ===============================================================================
-- 3. CONVERGENCE_SNAPSHOTS TABLE - Weight convergence monitoring
-- ===============================================================================
CREATE TABLE IF NOT EXISTS convergence_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Model Identity
  model_id UUID NOT NULL,

  -- Convergence Metrics
  weight_value DECIMAL(5,4) NOT NULL CHECK (weight_value >= 0 AND weight_value <= 1),
  convergence_score DECIMAL(5,4) NOT NULL CHECK (convergence_score >= 0 AND convergence_score <= 1),
  stability_indicator DECIMAL(5,4) NOT NULL CHECK (stability_indicator >= 0 AND stability_indicator <= 1),
  snapshot_date TIMESTAMPTZ NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign Key (references predictive_models from phase11 migration)
  CONSTRAINT fk_model FOREIGN KEY (model_id) REFERENCES predictive_models(id) ON DELETE CASCADE
);

-- Indexes for convergence_snapshots
CREATE INDEX IF NOT EXISTS idx_convergence_tenant
  ON convergence_snapshots(tenant_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_convergence_model
  ON convergence_snapshots(model_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_convergence_date
  ON convergence_snapshots(snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_convergence_low_score
  ON convergence_snapshots(convergence_score ASC)
  WHERE convergence_score < 0.7;

CREATE INDEX IF NOT EXISTS idx_convergence_recent
  ON convergence_snapshots(snapshot_date DESC)
  WHERE snapshot_date > NOW() - INTERVAL '7 days';

CREATE INDEX IF NOT EXISTS idx_convergence_model_fk
  ON convergence_snapshots(model_id);

COMMENT ON TABLE convergence_snapshots IS 'Time-series snapshots of model weight convergence during training/optimization';
COMMENT ON COLUMN convergence_snapshots.weight_value IS 'Ensemble weight assigned to this model (0-1)';
COMMENT ON COLUMN convergence_snapshots.convergence_score IS 'Convergence score (0-1), higher = weights are stable';
COMMENT ON COLUMN convergence_snapshots.stability_indicator IS 'Stability indicator (0-1), higher = weights change slowly';

-- ===============================================================================
-- 4. RLS POLICIES - Security and access control
-- ===============================================================================

-- Enable RLS on all tables
ALTER TABLE routing_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ensemble_correlation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE convergence_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for routing_decisions
CREATE POLICY "routing_decisions_service_role"
  ON routing_decisions FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "routing_decisions_tenant_read"
  ON routing_decisions FOR SELECT
  TO authenticated
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::UUID);

-- RLS Policies for ensemble_correlation_history
CREATE POLICY "ensemble_correlation_service_role"
  ON ensemble_correlation_history FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "ensemble_correlation_tenant_read"
  ON ensemble_correlation_history FOR SELECT
  TO authenticated
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::UUID);

-- RLS Policies for convergence_snapshots
CREATE POLICY "convergence_snapshots_service_role"
  ON convergence_snapshots FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "convergence_snapshots_tenant_read"
  ON convergence_snapshots FOR SELECT
  TO authenticated
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::UUID);

-- ===============================================================================
-- 5. GRANTS - Permission management
-- ===============================================================================

-- Grant appropriate permissions
GRANT SELECT ON routing_decisions TO authenticated;
GRANT ALL ON routing_decisions TO service_role;

GRANT SELECT ON ensemble_correlation_history TO authenticated;
GRANT ALL ON ensemble_correlation_history TO service_role;

GRANT SELECT ON convergence_snapshots TO authenticated;
GRANT ALL ON convergence_snapshots TO service_role;

-- ===============================================================================
-- 6. TRIGGERS - Auto-update timestamps
-- ===============================================================================

CREATE OR REPLACE FUNCTION update_routing_decisions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_routing_decisions_updated_at
  BEFORE UPDATE ON routing_decisions
  FOR EACH ROW
  EXECUTE FUNCTION update_routing_decisions_updated_at();

-- ===============================================================================
-- 7. POSTGREST SCHEMA RELOAD (Charter v3.0 Compliance - MANDATORY)
-- ===============================================================================
SELECT pg_notify('pgrst', 'reload schema');
