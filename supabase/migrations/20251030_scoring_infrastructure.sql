-- ===============================================================================
-- Scoring Infrastructure: Self-Score & Internal Scoring Pipeline
-- Date: 2025-10-30
-- Purpose: Add capper self-scoring and internal professional scoring tables
-- Version: 1.0.0
-- Charter Compliance: v3.0 - Canonical picks architecture
-- ===============================================================================

-- ===============================================================================
-- 1. ADD SELF_SCORE TO PICKS TABLE
-- ===============================================================================
DO $$
BEGIN
  -- Add self_score column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'picks'
    AND column_name = 'self_score'
  ) THEN
    ALTER TABLE picks ADD COLUMN self_score DECIMAL(5,2);
    COMMENT ON COLUMN picks.self_score IS 'Capper-provided score at submission time (1-10 scale)';
  END IF;

  -- Add self_score_notes column for capper commentary
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'picks'
    AND column_name = 'self_score_notes'
  ) THEN
    ALTER TABLE picks ADD COLUMN self_score_notes TEXT;
    COMMENT ON COLUMN picks.self_score_notes IS 'Optional notes from capper explaining their self-score';
  END IF;

  -- Add self_scored_at timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'picks'
    AND column_name = 'self_scored_at'
  ) THEN
    ALTER TABLE picks ADD COLUMN self_scored_at TIMESTAMPTZ;
    COMMENT ON COLUMN picks.self_scored_at IS 'When the capper provided their self-score';
  END IF;
END $$;

-- ===============================================================================
-- 2. CREATE INTERNAL_SCORES TABLE (Professional Scoring Pipeline)
-- ===============================================================================
CREATE TABLE IF NOT EXISTS internal_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pick_id UUID NOT NULL REFERENCES picks(id) ON DELETE CASCADE,

  -- Internal Score Components
  internal_score DECIMAL(5,2) NOT NULL,
  scoring_model_version TEXT NOT NULL,

  -- Advanced Metrics
  devigged_win_prob DECIMAL(5,4),
  devigged_edge DECIMAL(5,4),
  clv_pct DECIMAL(5,2),
  kelly_fraction DECIMAL(5,4),
  steam_detected BOOLEAN DEFAULT false,
  market_timing_score DECIMAL(5,2),

  -- ML Features
  feature_set JSONB DEFAULT '{}',
  confidence_interval JSONB,  -- { "lower": 0.55, "upper": 0.75 }

  -- Grading Details
  grading_engine TEXT NOT NULL DEFAULT 'GradingAgent',
  grading_duration_ms INTEGER,
  features_used TEXT[],

  -- Comparison
  variance_from_self_score DECIMAL(5,2),  -- internal_score - self_score

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT internal_scores_pick_unique UNIQUE (pick_id),
  CONSTRAINT internal_score_range CHECK (internal_score BETWEEN 0 AND 10)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_internal_scores_tenant_id ON internal_scores(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_internal_scores_pick_id ON internal_scores(pick_id);
CREATE INDEX IF NOT EXISTS idx_internal_scores_score ON internal_scores(tenant_id, internal_score DESC);
CREATE INDEX IF NOT EXISTS idx_internal_scores_variance ON internal_scores(variance_from_self_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_internal_scores_feature_set ON internal_scores USING GIN (feature_set);

COMMENT ON TABLE internal_scores IS 'Professional grading results from internal scoring pipeline';
COMMENT ON COLUMN internal_scores.internal_score IS 'System-calculated score (1-10) from professional grading engine';
COMMENT ON COLUMN internal_scores.variance_from_self_score IS 'Difference between internal score and capper self-score for calibration analysis';

-- ===============================================================================
-- 3. CREATE SCORE_AUDIT_LOG TABLE (Track All Scoring Events)
-- ===============================================================================
CREATE TABLE IF NOT EXISTS score_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pick_id UUID NOT NULL REFERENCES picks(id) ON DELETE CASCADE,

  -- Event Details
  event_type TEXT NOT NULL CHECK (event_type IN (
    'self_score_submitted',
    'self_score_updated',
    'internal_score_generated',
    'internal_score_updated',
    'variance_alert',
    'calibration_adjustment'
  )),

  -- Scores
  old_value DECIMAL(5,2),
  new_value DECIMAL(5,2),

  -- Actor
  actor_id UUID REFERENCES users(id),
  actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'admin')),

  -- Context
  reason TEXT,
  correlation_id TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_score_audit_log_tenant_id ON score_audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_score_audit_log_pick_id ON score_audit_log(pick_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_score_audit_log_event_type ON score_audit_log(event_type, created_at DESC);

COMMENT ON TABLE score_audit_log IS 'Audit trail for all scoring events (self-scores and internal scores)';

-- ===============================================================================
-- 4. CREATE CAPPER_CALIBRATION TABLE (Self-Score vs Internal Score Analysis)
-- ===============================================================================
CREATE TABLE IF NOT EXISTS capper_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Calibration Metrics
  total_picks INTEGER DEFAULT 0,
  avg_self_score DECIMAL(5,2),
  avg_internal_score DECIMAL(5,2),
  avg_variance DECIMAL(5,2),  -- Positive = over-confident, Negative = under-confident

  -- Accuracy
  calibration_accuracy DECIMAL(5,4),  -- How well self-scores predict outcomes
  brier_score DECIMAL(5,4),  -- Probabilistic calibration metric

  -- Trends
  variance_trend TEXT CHECK (variance_trend IN ('improving', 'stable', 'declining')),
  last_30_picks_variance DECIMAL(5,2),

  -- Metadata
  metadata JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT capper_calibration_user_unique UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_capper_calibration_tenant_id ON capper_calibration(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_capper_calibration_user_id ON capper_calibration(user_id);
CREATE INDEX IF NOT EXISTS idx_capper_calibration_variance ON capper_calibration(avg_variance DESC);

COMMENT ON TABLE capper_calibration IS 'Tracks how well cappers calibrate their self-scores vs internal scores';

-- ===============================================================================
-- 5. CREATE HELPER FUNCTION: Record Self-Score
-- ===============================================================================
CREATE OR REPLACE FUNCTION record_self_score(
  p_pick_id UUID,
  p_self_score DECIMAL,
  p_notes TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_old_score DECIMAL;
BEGIN
  -- Get tenant_id and old score
  SELECT tenant_id, self_score INTO v_tenant_id, v_old_score
  FROM picks
  WHERE id = p_pick_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pick not found: %', p_pick_id;
  END IF;

  -- Update pick with self-score
  UPDATE picks
  SET
    self_score = p_self_score,
    self_score_notes = p_notes,
    self_scored_at = NOW(),
    updated_at = NOW()
  WHERE id = p_pick_id;

  -- Record audit event
  INSERT INTO score_audit_log (
    tenant_id,
    pick_id,
    event_type,
    old_value,
    new_value,
    actor_id,
    actor_type,
    reason,
    metadata
  ) VALUES (
    v_tenant_id,
    p_pick_id,
    CASE WHEN v_old_score IS NULL THEN 'self_score_submitted' ELSE 'self_score_updated' END,
    v_old_score,
    p_self_score,
    p_user_id,
    'user',
    p_notes,
    jsonb_build_object('submitted_at', NOW())
  );
END;
$$;

COMMENT ON FUNCTION record_self_score IS 'Records capper self-score with audit trail';

-- ===============================================================================
-- 6. CREATE HELPER FUNCTION: Record Internal Score
-- ===============================================================================
CREATE OR REPLACE FUNCTION record_internal_score(
  p_pick_id UUID,
  p_internal_score DECIMAL,
  p_scoring_data JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_self_score DECIMAL;
  v_variance DECIMAL;
  v_internal_score_id UUID;
BEGIN
  -- Get tenant_id and self_score
  SELECT tenant_id, self_score INTO v_tenant_id, v_self_score
  FROM picks
  WHERE id = p_pick_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pick not found: %', p_pick_id;
  END IF;

  -- Calculate variance
  IF v_self_score IS NOT NULL THEN
    v_variance := p_internal_score - v_self_score;
  END IF;

  -- Insert internal score
  INSERT INTO internal_scores (
    tenant_id,
    pick_id,
    internal_score,
    scoring_model_version,
    devigged_win_prob,
    devigged_edge,
    clv_pct,
    kelly_fraction,
    steam_detected,
    market_timing_score,
    feature_set,
    confidence_interval,
    grading_engine,
    grading_duration_ms,
    features_used,
    variance_from_self_score,
    metadata
  ) VALUES (
    v_tenant_id,
    p_pick_id,
    p_internal_score,
    p_scoring_data->>'scoring_model_version',
    (p_scoring_data->>'devigged_win_prob')::DECIMAL,
    (p_scoring_data->>'devigged_edge')::DECIMAL,
    (p_scoring_data->>'clv_pct')::DECIMAL,
    (p_scoring_data->>'kelly_fraction')::DECIMAL,
    (p_scoring_data->>'steam_detected')::BOOLEAN,
    (p_scoring_data->>'market_timing_score')::DECIMAL,
    p_scoring_data->'feature_set',
    p_scoring_data->'confidence_interval',
    COALESCE(p_scoring_data->>'grading_engine', 'GradingAgent'),
    (p_scoring_data->>'grading_duration_ms')::INTEGER,
    ARRAY(SELECT jsonb_array_elements_text(p_scoring_data->'features_used')),
    v_variance,
    p_scoring_data->'metadata'
  )
  RETURNING id INTO v_internal_score_id;

  -- Update pick with internal score
  UPDATE picks
  SET
    professional_score = p_internal_score,
    grading_status = 'completed',
    graded_at = NOW(),
    updated_at = NOW()
  WHERE id = p_pick_id;

  -- Record audit event
  INSERT INTO score_audit_log (
    tenant_id,
    pick_id,
    event_type,
    new_value,
    actor_type,
    reason,
    metadata
  ) VALUES (
    v_tenant_id,
    p_pick_id,
    'internal_score_generated',
    p_internal_score,
    'system',
    'Professional grading pipeline',
    jsonb_build_object(
      'internal_score_id', v_internal_score_id,
      'variance', v_variance,
      'grading_engine', p_scoring_data->>'grading_engine'
    )
  );

  -- Alert if high variance
  IF v_variance IS NOT NULL AND ABS(v_variance) > 3.0 THEN
    INSERT INTO score_audit_log (
      tenant_id,
      pick_id,
      event_type,
      actor_type,
      reason,
      metadata
    ) VALUES (
      v_tenant_id,
      p_pick_id,
      'variance_alert',
      'system',
      'High variance between self-score and internal score',
      jsonb_build_object(
        'variance', v_variance,
        'self_score', v_self_score,
        'internal_score', p_internal_score
      )
    );
  END IF;

  RETURN v_internal_score_id;
END;
$$;

COMMENT ON FUNCTION record_internal_score IS 'Records professional grading score with variance analysis and alerts';

-- ===============================================================================
-- 7. ENABLE RLS ON NEW TABLES
-- ===============================================================================
ALTER TABLE internal_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE capper_calibration ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY "internal_scores: Tenant isolation"
  ON internal_scores FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY "internal_scores: Service role full access"
  ON internal_scores FOR ALL
  USING (current_setting('role', true) = 'service_role');

CREATE POLICY "score_audit_log: Tenant isolation"
  ON score_audit_log FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY "score_audit_log: Service role full access"
  ON score_audit_log FOR ALL
  USING (current_setting('role', true) = 'service_role');

CREATE POLICY "capper_calibration: Users view own calibration"
  ON capper_calibration FOR SELECT
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::UUID
    AND user_id = current_setting('app.current_user_id', true)::UUID
  );

CREATE POLICY "capper_calibration: Service role full access"
  ON capper_calibration FOR ALL
  USING (current_setting('role', true) = 'service_role');

-- ===============================================================================
-- 8. TRIGGER POSTGREST RELOAD
-- ===============================================================================
SELECT pg_notify('pgrst', 'reload schema');

-- Log reload via RPC (if available)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'pgrst_reload'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    PERFORM pgrst_reload('scoring-infrastructure-migration', 'Post scoring infrastructure schema reload');
  END IF;
END $$;

-- ===============================================================================
-- END OF MIGRATION
-- ===============================================================================
