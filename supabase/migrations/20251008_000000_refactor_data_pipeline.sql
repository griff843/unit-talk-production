-- Migration: Refactor data pipeline architecture
-- Date: 2025-10-08
-- Description: Establish clean data flow: raw_props → unified_picks → scored_props → views

-- ============================================================================
-- 1. SCORED_PROPS TABLE - Normalized scoring output
-- ============================================================================
CREATE TABLE IF NOT EXISTS scored_props (
  id BIGSERIAL PRIMARY KEY,
  prop_ref TEXT NOT NULL,  -- Reference to unified_picks or raw_props

  -- Core scoring fields
  edge NUMERIC(10,4),
  prob_win NUMERIC(10,6),
  professional_score NUMERIC(10,4),
  tier TEXT CHECK (tier IN ('S', 'A', 'B', 'C', 'D')),
  confidence NUMERIC(10,6),
  kelly_fraction NUMERIC(10,6),
  clv_pct NUMERIC(10,4),

  -- Model metadata
  model_version TEXT NOT NULL,
  model_config JSONB DEFAULT '{}'::jsonb,

  -- Factor breakdowns (45-factor system)
  market_score NUMERIC(10,4),
  player_score NUMERIC(10,4),
  matchup_score NUMERIC(10,4),
  price_score NUMERIC(10,4),
  meta_score NUMERIC(10,4),
  factor_scores JSONB DEFAULT '{}'::jsonb,

  -- Risk metrics
  risk_adjusted_score NUMERIC(10,4),
  expected_value NUMERIC(10,4),
  sharpe_ratio NUMERIC(10,4),
  max_drawdown NUMERIC(10,6),

  -- Timestamps
  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes
  CONSTRAINT scored_props_prop_ref_unique UNIQUE (prop_ref, model_version)
);

CREATE INDEX IF NOT EXISTS idx_scored_props_tier ON scored_props(tier);
CREATE INDEX IF NOT EXISTS idx_scored_props_scored_at ON scored_props(scored_at DESC);
CREATE INDEX IF NOT EXISTS idx_scored_props_professional_score ON scored_props(professional_score DESC);
CREATE INDEX IF NOT EXISTS idx_scored_props_prop_ref ON scored_props(prop_ref);

-- ============================================================================
-- 2. BET_SLIPS TABLE - Parlay and teaser management
-- ============================================================================
CREATE TABLE IF NOT EXISTS bet_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Slip metadata
  slip_type TEXT NOT NULL CHECK (slip_type IN ('single', 'parlay', 'teaser', 'round_robin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'won', 'lost', 'push', 'cancelled')),

  -- Wager details
  stake NUMERIC(12,2),
  potential_payout NUMERIC(12,2),
  actual_payout NUMERIC(12,2),
  combined_odds NUMERIC(10,2),

  -- Parlay/teaser specifics
  num_legs INTEGER DEFAULT 1,
  legs_won INTEGER DEFAULT 0,
  legs_lost INTEGER DEFAULT 0,
  legs_push INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  placed_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- RLS: user can only see their own slips
  CONSTRAINT bet_slips_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_bet_slips_user_id ON bet_slips(user_id);
CREATE INDEX IF NOT EXISTS idx_bet_slips_status ON bet_slips(status);
CREATE INDEX IF NOT EXISTS idx_bet_slips_created_at ON bet_slips(created_at DESC);

-- ============================================================================
-- 3. BET_LEGS TABLE - Individual legs of parlays
-- ============================================================================
CREATE TABLE IF NOT EXISTS bet_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slip_id UUID NOT NULL REFERENCES bet_slips(id) ON DELETE CASCADE,
  prop_ref TEXT NOT NULL,  -- Reference to unified_picks or scored_props

  -- Leg details
  leg_order INTEGER NOT NULL,
  selection TEXT NOT NULL,
  line NUMERIC(10,2),
  odds NUMERIC(10,2),

  -- Outcome
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'push', 'cancelled')),
  actual_result NUMERIC(10,2),
  result_source TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,

  CONSTRAINT bet_legs_slip_id_leg_order_unique UNIQUE (slip_id, leg_order)
);

CREATE INDEX IF NOT EXISTS idx_bet_legs_slip_id ON bet_legs(slip_id);
CREATE INDEX IF NOT EXISTS idx_bet_legs_prop_ref ON bet_legs(prop_ref);
CREATE INDEX IF NOT EXISTS idx_bet_legs_status ON bet_legs(status);

-- ============================================================================
-- 4. ML_FEATURES TABLE - Feature store for ML models
-- ============================================================================
CREATE TABLE IF NOT EXISTS ml_features (
  id BIGSERIAL PRIMARY KEY,
  prop_ref TEXT NOT NULL,
  feature_set_version TEXT NOT NULL DEFAULT 'v1',

  -- Feature vectors (JSONB for flexibility)
  market_features JSONB NOT NULL DEFAULT '{}'::jsonb,
  player_features JSONB NOT NULL DEFAULT '{}'::jsonb,
  matchup_features JSONB NOT NULL DEFAULT '{}'::jsonb,
  price_features JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta_features JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Aggregated feature vector
  feature_vector NUMERIC[] DEFAULT ARRAY[]::NUMERIC[],

  -- Timestamps
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ml_features_prop_ref_version_unique UNIQUE (prop_ref, feature_set_version)
);

CREATE INDEX IF NOT EXISTS idx_ml_features_prop_ref ON ml_features(prop_ref);
CREATE INDEX IF NOT EXISTS idx_ml_features_extracted_at ON ml_features(extracted_at DESC);

-- ============================================================================
-- 5. ML_LABELS TABLE - Ground truth labels for training
-- ============================================================================
CREATE TABLE IF NOT EXISTS ml_labels (
  id BIGSERIAL PRIMARY KEY,
  prop_ref TEXT NOT NULL UNIQUE,

  -- Ground truth outcome
  hit BOOLEAN,
  actual_value NUMERIC(10,2),
  margin NUMERIC(10,2),

  -- Model predictions (for calibration)
  predicted_prob NUMERIC(10,6),
  predicted_value NUMERIC(10,2),
  prediction_error NUMERIC(10,4),

  -- Timestamps
  game_date TIMESTAMPTZ NOT NULL,
  labeled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_labels_prop_ref ON ml_labels(prop_ref);
CREATE INDEX IF NOT EXISTS idx_ml_labels_game_date ON ml_labels(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_ml_labels_hit ON ml_labels(hit);

-- ============================================================================
-- 6. MODEL_VERSIONS TABLE - Track model deployments
-- ============================================================================
CREATE TABLE IF NOT EXISTS model_versions (
  id BIGSERIAL PRIMARY KEY,
  model_name TEXT NOT NULL,
  version TEXT NOT NULL,

  -- Model metadata
  description TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  metrics JSONB DEFAULT '{}'::jsonb,  -- accuracy, calibration, etc.

  -- Deployment
  is_active BOOLEAN DEFAULT FALSE,
  deployed_at TIMESTAMPTZ,
  deprecated_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT model_versions_model_name_version_unique UNIQUE (model_name, version)
);

CREATE INDEX IF NOT EXISTS idx_model_versions_model_name ON model_versions(model_name);
CREATE INDEX IF NOT EXISTS idx_model_versions_is_active ON model_versions(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 7. VIEWS - Read models for Command Center
-- ============================================================================

-- v_prop_read_model: Normalized view of all props ready for scoring
CREATE OR REPLACE VIEW v_prop_read_model AS
SELECT
  up.id,
  up.external_prop_id AS prop_ref,
  up.sport,
  up.market,
  up.selection AS outcome,
  up.line,
  up.odds,
  up.player_name,
  up.team,
  up.opponent,
  up.game_date,
  up.bookmaker_key,
  up.metadata,
  up.created_at,
  -- Join scored_props if available
  sp.professional_score,
  sp.tier,
  sp.confidence,
  sp.edge,
  sp.prob_win,
  sp.kelly_fraction,
  sp.scored_at
FROM unified_picks up
LEFT JOIN scored_props sp ON sp.prop_ref = up.external_prop_id
WHERE up.game_date >= CURRENT_DATE - INTERVAL '1 day'  -- Today and forward
ORDER BY up.game_date, sp.professional_score DESC NULLS LAST;

-- v_daily_board: Command Center board view
CREATE OR REPLACE VIEW v_daily_board AS
SELECT
  prm.*,
  pq.status AS queue_status,
  pq.approved_by,
  pq.approved_at,
  pq.publish_at,
  pq.published_at
FROM v_prop_read_model prm
LEFT JOIN promotion_queue pq ON pq.pick_id = prm.id::TEXT
WHERE prm.game_date >= CURRENT_DATE
  AND (prm.tier IN ('S', 'A', 'B') OR prm.professional_score >= 70)
ORDER BY prm.game_date, prm.professional_score DESC NULLS LAST;

-- ============================================================================
-- 8. HELPER FUNCTIONS
-- ============================================================================

-- Function: Promote pick to queue (for approval)
CREATE OR REPLACE FUNCTION promote_pick(
  p_pick_id TEXT,
  p_user_id TEXT DEFAULT 'system'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  INSERT INTO promotion_queue (pick_id, status, created_by, created_at)
  VALUES (p_pick_id, 'pending', p_user_id, NOW())
  ON CONFLICT (pick_id) DO NOTHING
  RETURNING jsonb_build_object(
    'success', TRUE,
    'pick_id', pick_id,
    'status', status
  ) INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object('success', FALSE, 'reason', 'Already in queue'));
END;
$$;

-- Function: Approve pick for publishing
CREATE OR REPLACE FUNCTION approve_pick(
  p_pick_id TEXT,
  p_approved_by TEXT,
  p_publish_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  UPDATE promotion_queue
  SET
    status = 'approved',
    approved_by = p_approved_by,
    approved_at = NOW(),
    publish_at = COALESCE(p_publish_at, NOW() + INTERVAL '5 minutes')
  WHERE pick_id = p_pick_id
  RETURNING jsonb_build_object(
    'success', TRUE,
    'pick_id', pick_id,
    'status', status,
    'publish_at', publish_at
  ) INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object('success', FALSE, 'reason', 'Pick not found in queue'));
END;
$$;

-- Function: Update bet slip status when legs settle
CREATE OR REPLACE FUNCTION update_slip_from_legs()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_legs INTEGER;
  v_won INTEGER;
  v_lost INTEGER;
  v_push INTEGER;
  v_pending INTEGER;
  v_slip_status TEXT;
BEGIN
  -- Count leg statuses for this slip
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'won'),
    COUNT(*) FILTER (WHERE status = 'lost'),
    COUNT(*) FILTER (WHERE status = 'push'),
    COUNT(*) FILTER (WHERE status = 'pending')
  INTO v_total_legs, v_won, v_lost, v_push, v_pending
  FROM bet_legs
  WHERE slip_id = NEW.slip_id;

  -- Determine slip status
  IF v_pending > 0 THEN
    v_slip_status := 'active';
  ELSIF v_lost > 0 THEN
    v_slip_status := 'lost';
  ELSIF v_won = v_total_legs THEN
    v_slip_status := 'won';
  ELSIF v_push > 0 AND (v_won + v_push) = v_total_legs THEN
    v_slip_status := 'push';
  ELSE
    v_slip_status := 'active';
  END IF;

  -- Update slip
  UPDATE bet_slips
  SET
    legs_won = v_won,
    legs_lost = v_lost,
    legs_push = v_push,
    status = v_slip_status,
    settled_at = CASE WHEN v_pending = 0 THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = NEW.slip_id;

  RETURN NEW;
END;
$$;

-- Trigger: Auto-update slip when legs change
DROP TRIGGER IF EXISTS trg_bet_legs_update_slip ON bet_legs;
CREATE TRIGGER trg_bet_legs_update_slip
  AFTER INSERT OR UPDATE OF status ON bet_legs
  FOR EACH ROW
  EXECUTE FUNCTION update_slip_from_legs();

-- ============================================================================
-- 9. RLS POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE bet_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scored_props ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_labels ENABLE ROW LEVEL SECURITY;

-- Policies for bet_slips: users can only access their own slips
CREATE POLICY bet_slips_user_access ON bet_slips
  FOR ALL
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Policies for bet_legs: access through slip ownership
CREATE POLICY bet_legs_user_access ON bet_legs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bet_slips
      WHERE bet_slips.id = bet_legs.slip_id
        AND bet_slips.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- Policies for scored_props: public read, system write
CREATE POLICY scored_props_public_read ON scored_props
  FOR SELECT
  USING (TRUE);

CREATE POLICY scored_props_system_write ON scored_props
  FOR INSERT
  WITH CHECK (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- ============================================================================
-- 10. GRANTS
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT ON v_prop_read_model TO authenticated;
GRANT SELECT ON v_daily_board TO authenticated;
GRANT ALL ON bet_slips TO authenticated;
GRANT ALL ON bet_legs TO authenticated;
GRANT SELECT ON scored_props TO authenticated;
GRANT SELECT ON model_versions TO authenticated;

-- Grant service role full access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
