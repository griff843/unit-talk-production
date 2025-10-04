-- Migration: Corrected Pipeline Refactor (Matches Production Schema)
-- Date: 2025-10-08
-- Description: Schema-aligned version matching actual unit_talk_dev database

-- ============================================================================
-- 1. SCORED_PROPS TABLE - Scoring output (CORRECTED)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scored_props (
  id BIGSERIAL PRIMARY KEY,
  pick_id UUID REFERENCES unified_picks(id) ON DELETE CASCADE,
  prop_ref TEXT,  -- For external reference

  -- Core scoring fields
  edge NUMERIC(10,4),
  prob_win NUMERIC(10,6),
  professional_score NUMERIC(10,4),
  tier TEXT CHECK (tier IN ('S', 'A', 'B', 'C', 'D')),
  confidence NUMERIC(10,6),
  kelly_fraction NUMERIC(10,6),
  clv_pct NUMERIC(10,4),

  -- Model metadata
  model_version TEXT NOT NULL DEFAULT 'enhanced-45-factor-v1',
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

  -- Timestamps (matching convention)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint
  CONSTRAINT scored_props_pick_id_model_unique UNIQUE (pick_id, model_version)
);

CREATE INDEX IF NOT EXISTS idx_scored_props_tier ON scored_props(tier);
CREATE INDEX IF NOT EXISTS idx_scored_props_created_at ON scored_props(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scored_props_professional_score ON scored_props(professional_score DESC);
CREATE INDEX IF NOT EXISTS idx_scored_props_pick_id ON scored_props(pick_id);

COMMENT ON TABLE scored_props IS 'Normalized scoring output from Enhanced45Factor engine';

-- ============================================================================
-- 2. BET_SLIPS TABLE - Parlay/teaser management (CORRECTED)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bet_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,  -- Changed to UUID to match users.id type

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

  -- Foreign key (now matches UUID type)
  CONSTRAINT bet_slips_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bet_slips_user_id ON bet_slips(user_id);
CREATE INDEX IF NOT EXISTS idx_bet_slips_status ON bet_slips(status);
CREATE INDEX IF NOT EXISTS idx_bet_slips_created_at ON bet_slips(created_at DESC);

COMMENT ON TABLE bet_slips IS 'Multi-leg betting slips (parlays, teasers, round robins)';

-- ============================================================================
-- 3. BET_LEGS TABLE - Individual parlay legs (CORRECTED)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bet_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slip_id UUID NOT NULL REFERENCES bet_slips(id) ON DELETE CASCADE,
  pick_id UUID REFERENCES unified_picks(id),  -- Link to actual pick
  prop_ref TEXT,  -- External reference

  -- Leg details
  leg_order INTEGER NOT NULL,
  selection TEXT NOT NULL,  -- 'over', 'under', etc.
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
CREATE INDEX IF NOT EXISTS idx_bet_legs_pick_id ON bet_legs(pick_id);
CREATE INDEX IF NOT EXISTS idx_bet_legs_status ON bet_legs(status);

COMMENT ON TABLE bet_legs IS 'Individual legs of multi-leg betting slips';

-- ============================================================================
-- 4. ML_LABELS TABLE - Ground truth for training (ml_features already exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ml_labels (
  id BIGSERIAL PRIMARY KEY,
  prop_ref TEXT NOT NULL UNIQUE,
  pick_id UUID REFERENCES unified_picks(id),

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
CREATE INDEX IF NOT EXISTS idx_ml_labels_pick_id ON ml_labels(pick_id);

COMMENT ON TABLE ml_labels IS 'Ground truth labels for ML model training and calibration';

-- ============================================================================
-- 5. MODEL_VERSIONS TABLE - Track model deployments
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

COMMENT ON TABLE model_versions IS 'Track model versions and deployments';

-- ============================================================================
-- 6. UPDATE EXISTING VIEWS (Match actual schema)
-- ============================================================================

-- Update v_prop_read_model to include scored_props
DROP VIEW IF EXISTS v_prop_read_model CASCADE;
CREATE OR REPLACE VIEW v_prop_read_model AS
SELECT
  up.id AS pick_id,
  up.raw_prop_id,
  rp.id AS raw_id,
  up.sport,
  rp.league,
  rp.market,
  rp.market_type AS submarket,
  rp.player_name,
  rp.external_id AS player_id,
  up.prediction AS selection,  -- CORRECTED: use 'prediction' not 'selection'
  rp.line,
  rp.over_odds AS odds,
  rp.over_odds AS price,
  NULL::numeric AS implied_prob,
  CONCAT(rp.team, ' vs ', rp.opponent) AS matchup,
  rp.team,
  rp.game_date::timestamptz AS game_date,
  rp.game_id AS external_game_id,
  rp.team AS home_team,
  rp.opponent AS away_team,
  rp.start_time,
  rp.status AS game_status,

  -- Scoring data from unified_picks
  up.professional_score,
  up.devigged_edge,
  up.edge_score,
  up.tier,
  up.confidence,
  NULL::numeric AS prob_win,
  up.kelly_fraction,
  up.clv_pct,
  up.clv_tracking_id,
  up.professional_insights,
  NULL::jsonb AS edge_breakdown,
  up.feature_contributions,
  up.risk_assessment,
  up.risk,

  -- Professional features (placeholders)
  false AS steam_detected,
  NULL::numeric AS closing_line_value,
  NULL::numeric AS sharp_money,
  NULL::numeric AS line_movement,
  NULL::numeric AS expected_value,

  rp.metadata AS raw_metadata,
  up.published,
  CASE WHEN up.promoted_at IS NOT NULL THEN true ELSE false END AS promoted,
  up.grading_status,
  up.stage,

  -- Join scored_props if available
  sp.professional_score AS scored_professional_score,
  sp.tier AS scored_tier,
  sp.confidence AS scored_confidence,
  sp.edge AS scored_edge,
  sp.prob_win AS scored_prob_win,
  sp.created_at AS scored_at

FROM unified_picks up
LEFT JOIN raw_props rp ON rp.id = up.raw_prop_id
LEFT JOIN scored_props sp ON sp.pick_id = up.id
WHERE up.created_at >= CURRENT_DATE - INTERVAL '7 days';

COMMENT ON VIEW v_prop_read_model IS 'Unified view of props ready for scoring (matches actual schema)';

-- Update v_daily_board to use approval_queue
DROP VIEW IF EXISTS v_daily_board CASCADE;
CREATE OR REPLACE VIEW v_daily_board AS
SELECT
  prm.*,
  aq.status AS approval_status,
  aq.approved_by,
  aq.approved_at,
  aq.denied_by,
  aq.denied_at,
  aq.created_at AS queued_at
FROM v_prop_read_model prm
LEFT JOIN approval_queue aq ON aq.unified_id = prm.pick_id  -- CORRECTED: use approval_queue
WHERE prm.game_date >= CURRENT_DATE
  AND (prm.tier IN ('S', 'A', 'B') OR prm.professional_score >= 70 OR prm.scored_tier IN ('S', 'A', 'B'))
ORDER BY prm.game_date, COALESCE(prm.scored_professional_score, prm.professional_score) DESC NULLS LAST;

COMMENT ON VIEW v_daily_board IS 'Command Center board view (uses approval_queue)';

-- ============================================================================
-- 7. HELPER FUNCTIONS (Adapted to actual schema)
-- ============================================================================

-- Function: Promote pick to approval queue
CREATE OR REPLACE FUNCTION promote_pick(
  p_pick_id UUID,
  p_user_id TEXT DEFAULT 'system'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  INSERT INTO approval_queue (unified_id, status, actor_id, created_at)
  VALUES (p_pick_id, 'pending', p_user_id, NOW())
  ON CONFLICT (unified_id) DO NOTHING
  RETURNING jsonb_build_object(
    'success', TRUE,
    'pick_id', unified_id,
    'status', status
  ) INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object('success', FALSE, 'reason', 'Already in queue'));
END;
$$;

-- Function: Approve pick
CREATE OR REPLACE FUNCTION approve_pick(
  p_pick_id UUID,
  p_approved_by TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  UPDATE approval_queue
  SET
    status = 'approved',
    approved_by = p_approved_by,
    approved_at = NOW()
  WHERE unified_id = p_pick_id
  RETURNING jsonb_build_object(
    'success', TRUE,
    'pick_id', unified_id,
    'status', status,
    'approved_at', approved_at
  ) INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object('success', FALSE, 'reason', 'Pick not found in queue'));
END;
$$;

-- Function: Deny pick
CREATE OR REPLACE FUNCTION deny_pick(
  p_pick_id UUID,
  p_denied_by TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  UPDATE approval_queue
  SET
    status = 'denied',
    denied_by = p_denied_by,
    denied_at = NOW(),
    reason = p_reason
  WHERE unified_id = p_pick_id
  RETURNING jsonb_build_object(
    'success', TRUE,
    'pick_id', unified_id,
    'status', status,
    'denied_at', denied_at
  ) INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object('success', FALSE, 'reason', 'Pick not found in queue'));
END;
$$;

-- ============================================================================
-- 8. TRIGGERS - Auto-update slip status
-- ============================================================================

-- Function: Update bet slip when legs change
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

-- Create trigger
DROP TRIGGER IF EXISTS trg_bet_legs_update_slip ON bet_legs;
CREATE TRIGGER trg_bet_legs_update_slip
  AFTER INSERT OR UPDATE OF status ON bet_legs
  FOR EACH ROW
  EXECUTE FUNCTION update_slip_from_legs();

-- ============================================================================
-- 9. GRANTS (Skip Supabase-specific roles, use postgres)
-- ============================================================================

-- Grant access to existing roles
GRANT SELECT ON v_prop_read_model TO PUBLIC;
GRANT SELECT ON v_daily_board TO PUBLIC;
GRANT ALL ON bet_slips TO PUBLIC;
GRANT ALL ON bet_legs TO PUBLIC;
GRANT SELECT ON scored_props TO PUBLIC;
GRANT SELECT ON model_versions TO PUBLIC;
GRANT SELECT ON ml_labels TO PUBLIC;

-- Grant sequence access
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;

-- ============================================================================
-- 10. VERIFICATION QUERIES
-- ============================================================================

-- Verify tables created
DO $$
BEGIN
  RAISE NOTICE 'Migration Complete - Verifying tables:';
  RAISE NOTICE 'scored_props: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'scored_props');
  RAISE NOTICE 'bet_slips: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'bet_slips');
  RAISE NOTICE 'bet_legs: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'bet_legs');
  RAISE NOTICE 'ml_labels: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'ml_labels');
  RAISE NOTICE 'model_versions: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'model_versions');
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
