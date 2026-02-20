-- ============================================================================
-- CANONICAL V3 SCORING STORAGE - Feature Snapshots + Scored Legs
-- Sprint: SPRINT-CANONICAL-V3-SCORING-074
-- Date: 2026-02-20
--
-- Wires Canonical V3 scoring storage and write surfaces:
-- 1. tickets + ticket_legs tables (bet tracking)
-- 2. feature_snapshots (scoring inputs)
-- 3. scored_legs (scoring outputs)
-- 4. score_ticket_legs_v3 RPC (single-writer)
-- 5. Contract views for latest scores and audit
--
-- Prerequisites:
-- - SPRINT-CANONICAL-V3-FEED-OFFERS-073 (provider_offers, canonical_events)
-- ============================================================================

-- ============================================================================
-- 1. TICKETS TABLE
-- User bet tickets. Container for ticket_legs.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,                     -- References users if exists
  ticket_type TEXT NOT NULL,                 -- 'single', 'parlay', 'round_robin', 'teaser'
  bet_slip_id TEXT UNIQUE,                   -- External reference / idempotency key
  total_stake NUMERIC NOT NULL DEFAULT 0,
  total_odds INTEGER,                        -- Combined odds (American)
  potential_payout NUMERIC,
  status TEXT DEFAULT 'pending',             -- 'pending', 'posted', 'settled', 'void'
  settlement_result TEXT,                    -- 'win', 'loss', 'push', 'partial'
  settlement_payout NUMERIC,
  workflow_stage TEXT DEFAULT 'submitted',
  posted_to_discord BOOLEAN DEFAULT FALSE,
  discord_message_id TEXT,
  promotion_band TEXT,                       -- 'HARD', 'SOFT', 'NO_POST'
  tier TEXT,                                 -- 'S', 'A', 'B', 'C', 'F'
  confidence NUMERIC,
  professional_score NUMERIC,
  source TEXT DEFAULT 'smart_form',          -- 'smart_form', 'api', 'manual', 'system'
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  promotion_posted_at TIMESTAMPTZ,

  CONSTRAINT tickets_type_check CHECK (ticket_type IN ('single', 'parlay', 'round_robin', 'teaser')),
  CONSTRAINT tickets_status_check CHECK (status IN ('pending', 'posted', 'settled', 'void', 'cancelled')),
  CONSTRAINT tickets_result_check CHECK (settlement_result IS NULL OR settlement_result IN ('win', 'loss', 'push', 'partial', 'void')),
  CONSTRAINT tickets_tier_check CHECK (tier IS NULL OR tier IN ('S', 'A', 'B', 'C', 'F')),
  CONSTRAINT tickets_promotion_band_check CHECK (promotion_band IS NULL OR promotion_band IN ('HARD', 'SOFT', 'NO_POST'))
);

-- Indexes for tickets
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_workflow ON tickets(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_tickets_posted ON tickets(posted_to_discord);
CREATE INDEX IF NOT EXISTS idx_tickets_settlement ON tickets(settlement_result) WHERE settlement_result IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_bet_slip ON tickets(bet_slip_id) WHERE bet_slip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_tier ON tickets(tier) WHERE tier IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_pending ON tickets(status, created_at) WHERE status = 'pending';

COMMENT ON TABLE tickets IS 'User bet tickets. Container for ticket_legs. Canonical V3.';

-- ============================================================================
-- 2. TICKET_LEGS TABLE
-- Individual legs of tickets. Scoring grain.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ticket_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  leg_index INTEGER NOT NULL,                -- 0, 1, 2 for parlay legs
  event_id UUID NOT NULL REFERENCES canonical_events(id),  -- Note: canonical_events
  market_type_id INTEGER REFERENCES market_types(id),
  participant_id UUID REFERENCES participants(id),
  segment_type_id INTEGER REFERENCES segment_types(id),
  selection TEXT NOT NULL,                   -- 'over', 'under', 'home', 'away', 'yes', 'no'

  -- Line/odds at bet time
  provider_line NUMERIC,                     -- Line from provider
  provider_odds INTEGER,                     -- Odds from provider (American)

  -- Source tracking
  offer_id UUID REFERENCES provider_offers(id),  -- Which snapshot was used
  provider TEXT NOT NULL,                    -- 'fanduel', 'draftkings', etc.

  -- Settlement
  leg_status TEXT DEFAULT 'pending',         -- 'pending', 'win', 'loss', 'push', 'void'
  actual_value NUMERIC,                      -- Actual stat value
  settlement_source TEXT,
  settled_at TIMESTAMPTZ,

  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT ticket_legs_unique UNIQUE (ticket_id, leg_index),
  CONSTRAINT ticket_legs_selection_check CHECK (selection IN ('over', 'under', 'home', 'away', 'yes', 'no', 'draw')),
  CONSTRAINT ticket_legs_status_check CHECK (leg_status IN ('pending', 'win', 'loss', 'push', 'void')),
  CONSTRAINT ticket_legs_index_positive CHECK (leg_index >= 0)
);

-- Indexes for ticket_legs
CREATE INDEX IF NOT EXISTS idx_ticket_legs_ticket ON ticket_legs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_legs_event ON ticket_legs(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_legs_market_type ON ticket_legs(market_type_id);
CREATE INDEX IF NOT EXISTS idx_ticket_legs_participant ON ticket_legs(participant_id) WHERE participant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ticket_legs_offer ON ticket_legs(offer_id) WHERE offer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ticket_legs_status ON ticket_legs(leg_status);
CREATE INDEX IF NOT EXISTS idx_ticket_legs_provider ON ticket_legs(provider);
CREATE INDEX IF NOT EXISTS idx_ticket_legs_event_market ON ticket_legs(event_id, market_type_id);

COMMENT ON TABLE ticket_legs IS 'Individual legs of tickets. Scoring grain. Canonical V3.';

-- ============================================================================
-- 3. FEATURE_SNAPSHOTS TABLE
-- Inputs to scoring model. Full feature tracking for model versioning.
-- ============================================================================

CREATE TABLE IF NOT EXISTS feature_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id UUID NOT NULL REFERENCES ticket_legs(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,                  -- 'edge_scorer_v3'
  model_version TEXT NOT NULL,               -- 'v3.2.1'
  feature_vector JSONB NOT NULL,             -- All 45+ features
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Denormalized key features for queries
  clv_at_bet NUMERIC,                        -- CLV at bet time
  clv_at_close NUMERIC,                      -- CLV at close
  weather_impact NUMERIC,
  injury_impact NUMERIC,
  rest_impact NUMERIC,
  home_away_impact NUMERIC,
  historical_edge NUMERIC,
  market_efficiency NUMERIC,

  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Idempotency: one snapshot per leg per model per timestamp
  CONSTRAINT feature_snapshots_idempotent UNIQUE (leg_id, model_name, model_version, computed_at)
);

-- Indexes for feature_snapshots
CREATE INDEX IF NOT EXISTS idx_feature_snapshots_leg ON feature_snapshots(leg_id);
CREATE INDEX IF NOT EXISTS idx_feature_snapshots_model ON feature_snapshots(model_name, model_version);
CREATE INDEX IF NOT EXISTS idx_feature_snapshots_computed ON feature_snapshots(computed_at);
CREATE INDEX IF NOT EXISTS idx_feature_snapshots_clv ON feature_snapshots(clv_at_bet) WHERE clv_at_bet IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feature_snapshots_leg_latest ON feature_snapshots(leg_id, computed_at DESC);

COMMENT ON TABLE feature_snapshots IS 'Feature inputs for scoring model. Idempotent by (leg, model, version, time). Canonical V3.';

-- ============================================================================
-- 4. SCORED_LEGS TABLE
-- Outputs from scoring model. Enables model comparison and backtesting.
-- ============================================================================

CREATE TABLE IF NOT EXISTS scored_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id UUID NOT NULL REFERENCES ticket_legs(id) ON DELETE CASCADE,
  feature_snapshot_id UUID REFERENCES feature_snapshots(id),
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,

  -- Scoring outputs
  edge_score NUMERIC,                        -- Raw edge score
  confidence_score NUMERIC,                  -- 0-1 confidence
  tier TEXT,                                 -- 'S', 'A', 'B', 'C', 'F'
  promotion_band TEXT,                       -- 'HARD', 'SOFT', 'NO_POST'
  kelly_fraction NUMERIC,                    -- Optimal bet sizing
  expected_value NUMERIC,                    -- EV in dollars

  -- Feature contributions (for explainability)
  feature_contributions JSONB,               -- Which features drove the score

  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_latest BOOLEAN DEFAULT TRUE,            -- Most recent scoring for this leg

  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Idempotency: one score per leg per model per timestamp
  CONSTRAINT scored_legs_idempotent UNIQUE (leg_id, model_name, model_version, computed_at),
  CONSTRAINT scored_legs_tier_check CHECK (tier IS NULL OR tier IN ('S', 'A', 'B', 'C', 'F')),
  CONSTRAINT scored_legs_band_check CHECK (promotion_band IS NULL OR promotion_band IN ('HARD', 'SOFT', 'NO_POST')),
  CONSTRAINT scored_legs_confidence_check CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1))
);

-- Indexes for scored_legs
CREATE INDEX IF NOT EXISTS idx_scored_legs_leg ON scored_legs(leg_id);
CREATE INDEX IF NOT EXISTS idx_scored_legs_model ON scored_legs(model_name, model_version);
CREATE INDEX IF NOT EXISTS idx_scored_legs_tier ON scored_legs(tier) WHERE tier IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scored_legs_latest ON scored_legs(is_latest) WHERE is_latest = TRUE;
CREATE INDEX IF NOT EXISTS idx_scored_legs_feature ON scored_legs(feature_snapshot_id) WHERE feature_snapshot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scored_legs_computed ON scored_legs(computed_at);
CREATE INDEX IF NOT EXISTS idx_scored_legs_leg_latest ON scored_legs(leg_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_scored_legs_latest_per_leg ON scored_legs(leg_id, computed_at DESC) WHERE is_latest = TRUE;

COMMENT ON TABLE scored_legs IS 'Scoring outputs for ticket legs. Idempotent by (leg, model, version, time). Canonical V3.';

-- ============================================================================
-- 5. TRIGGER: Update is_latest on new scoring
-- When a new score is inserted, mark previous scores as not latest
-- ============================================================================

CREATE OR REPLACE FUNCTION update_scored_legs_is_latest()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark all other scores for this leg as not latest
  UPDATE scored_legs
  SET is_latest = FALSE
  WHERE leg_id = NEW.leg_id
    AND id != NEW.id
    AND is_latest = TRUE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_scored_legs_is_latest
  AFTER INSERT ON scored_legs
  FOR EACH ROW
  EXECUTE FUNCTION update_scored_legs_is_latest();

-- ============================================================================
-- 6. SCORING RPC: score_ticket_legs_v3
-- Single-writer surface for batch scoring with idempotency
-- ============================================================================

CREATE OR REPLACE FUNCTION score_ticket_legs_v3(
  p_leg_ids UUID[],
  p_model_name TEXT,
  p_model_version TEXT,
  p_feature_vectors JSONB[],
  p_scores JSONB[],
  p_computed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  out_leg_id UUID,
  out_feature_snapshot_id UUID,
  out_scored_leg_id UUID,
  out_status TEXT
) AS $$
DECLARE
  v_idx INTEGER;
  v_leg_id UUID;
  v_features JSONB;
  v_score JSONB;
  v_fs_id UUID;
  v_sl_id UUID;
  v_existing_fs UUID;
  v_existing_sl UUID;
  v_leg_exists BOOLEAN;
BEGIN
  -- Validate inputs
  IF array_length(p_leg_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'p_leg_ids cannot be empty';
  END IF;

  IF array_length(p_leg_ids, 1) != array_length(p_feature_vectors, 1) THEN
    RAISE EXCEPTION 'p_leg_ids and p_feature_vectors must have same length';
  END IF;

  IF array_length(p_leg_ids, 1) != array_length(p_scores, 1) THEN
    RAISE EXCEPTION 'p_leg_ids and p_scores must have same length';
  END IF;

  IF p_model_name IS NULL OR p_model_version IS NULL THEN
    RAISE EXCEPTION 'model_name and model_version are required';
  END IF;

  -- Process each leg
  FOR v_idx IN 1..array_length(p_leg_ids, 1) LOOP
    v_leg_id := p_leg_ids[v_idx];
    v_features := p_feature_vectors[v_idx];
    v_score := p_scores[v_idx];

    -- Verify leg exists (fail-closed)
    SELECT EXISTS(SELECT 1 FROM ticket_legs tl WHERE tl.id = v_leg_id) INTO v_leg_exists;
    IF NOT v_leg_exists THEN
      out_leg_id := v_leg_id;
      out_feature_snapshot_id := NULL;
      out_scored_leg_id := NULL;
      out_status := 'error_leg_not_found';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Check for existing feature_snapshot (idempotency)
    SELECT fs.id INTO v_existing_fs
    FROM feature_snapshots fs
    WHERE fs.leg_id = v_leg_id
      AND fs.model_name = p_model_name
      AND fs.model_version = p_model_version
      AND fs.computed_at = p_computed_at;

    IF v_existing_fs IS NOT NULL THEN
      -- Check for existing scored_leg
      SELECT sl.id INTO v_existing_sl
      FROM scored_legs sl
      WHERE sl.leg_id = v_leg_id
        AND sl.model_name = p_model_name
        AND sl.model_version = p_model_version
        AND sl.computed_at = p_computed_at;

      IF v_existing_sl IS NOT NULL THEN
        -- Both exist - idempotent return
        out_leg_id := v_leg_id;
        out_feature_snapshot_id := v_existing_fs;
        out_scored_leg_id := v_existing_sl;
        out_status := 'exists';
        RETURN NEXT;
        CONTINUE;
      END IF;

      -- Feature snapshot exists but not scored_leg - use existing snapshot
      v_fs_id := v_existing_fs;
    ELSE
      -- Insert feature_snapshot
      INSERT INTO feature_snapshots (
        leg_id,
        model_name,
        model_version,
        feature_vector,
        computed_at,
        clv_at_bet,
        clv_at_close,
        weather_impact,
        injury_impact,
        rest_impact,
        home_away_impact,
        historical_edge,
        market_efficiency
      ) VALUES (
        v_leg_id,
        p_model_name,
        p_model_version,
        v_features,
        p_computed_at,
        (v_features->>'clv_at_bet')::NUMERIC,
        (v_features->>'clv_at_close')::NUMERIC,
        (v_features->>'weather_impact')::NUMERIC,
        (v_features->>'injury_impact')::NUMERIC,
        (v_features->>'rest_impact')::NUMERIC,
        (v_features->>'home_away_impact')::NUMERIC,
        (v_features->>'historical_edge')::NUMERIC,
        (v_features->>'market_efficiency')::NUMERIC
      )
      RETURNING id INTO v_fs_id;
    END IF;

    -- Insert scored_leg
    INSERT INTO scored_legs (
      leg_id,
      feature_snapshot_id,
      model_name,
      model_version,
      edge_score,
      confidence_score,
      tier,
      promotion_band,
      kelly_fraction,
      expected_value,
      feature_contributions,
      computed_at,
      is_latest
    ) VALUES (
      v_leg_id,
      v_fs_id,
      p_model_name,
      p_model_version,
      (v_score->>'edge_score')::NUMERIC,
      (v_score->>'confidence_score')::NUMERIC,
      v_score->>'tier',
      v_score->>'promotion_band',
      (v_score->>'kelly_fraction')::NUMERIC,
      (v_score->>'expected_value')::NUMERIC,
      v_score->'feature_contributions',
      p_computed_at,
      TRUE
    )
    RETURNING id INTO v_sl_id;

    out_leg_id := v_leg_id;
    out_feature_snapshot_id := v_fs_id;
    out_scored_leg_id := v_sl_id;
    out_status := 'inserted';
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION score_ticket_legs_v3 IS
  'Single-writer batch scoring RPC. Idempotent by (leg, model, version, time). Canonical V3.';

-- ============================================================================
-- 7. CONTRACT VIEW: view_scored_legs_latest
-- Latest score per ticket_leg
-- ============================================================================

CREATE OR REPLACE VIEW view_scored_legs_latest AS
SELECT DISTINCT ON (sl.leg_id)
  sl.id AS scored_leg_id,
  sl.leg_id,
  sl.feature_snapshot_id,
  sl.model_name,
  sl.model_version,
  sl.edge_score,
  sl.confidence_score,
  sl.tier,
  sl.promotion_band,
  sl.kelly_fraction,
  sl.expected_value,
  sl.computed_at,
  -- Join ticket_leg info
  tl.ticket_id,
  tl.leg_index,
  tl.selection,
  tl.provider_line,
  tl.provider_odds,
  tl.provider,
  tl.leg_status,
  -- Join ticket info
  t.bet_slip_id,
  t.user_id,
  t.ticket_type,
  t.status AS ticket_status
FROM scored_legs sl
JOIN ticket_legs tl ON tl.id = sl.leg_id
JOIN tickets t ON t.id = tl.ticket_id
WHERE sl.is_latest = TRUE
ORDER BY sl.leg_id, sl.computed_at DESC;

COMMENT ON VIEW view_scored_legs_latest IS
  'Latest score per ticket_leg with ticket context. Canonical V3.';

-- ============================================================================
-- 8. CONTRACT VIEW: view_scoring_audit
-- Full audit trail: leg → features → scores
-- ============================================================================

CREATE OR REPLACE VIEW view_scoring_audit AS
SELECT
  tl.id AS leg_id,
  tl.ticket_id,
  tl.leg_index,
  tl.selection,
  tl.provider_line,
  tl.provider_odds,
  tl.provider,
  tl.leg_status,
  t.bet_slip_id,
  t.user_id,
  t.status AS ticket_status,
  -- Feature snapshot
  fs.id AS feature_snapshot_id,
  fs.model_name AS fs_model_name,
  fs.model_version AS fs_model_version,
  fs.feature_vector,
  fs.clv_at_bet,
  fs.clv_at_close,
  fs.computed_at AS features_computed_at,
  -- Scored leg
  sl.id AS scored_leg_id,
  sl.model_name AS sl_model_name,
  sl.model_version AS sl_model_version,
  sl.edge_score,
  sl.confidence_score,
  sl.tier,
  sl.promotion_band,
  sl.kelly_fraction,
  sl.expected_value,
  sl.feature_contributions,
  sl.computed_at AS scored_at,
  sl.is_latest
FROM ticket_legs tl
JOIN tickets t ON t.id = tl.ticket_id
LEFT JOIN feature_snapshots fs ON fs.leg_id = tl.id
LEFT JOIN scored_legs sl ON sl.leg_id = tl.id AND sl.feature_snapshot_id = fs.id
ORDER BY tl.id, sl.computed_at DESC;

COMMENT ON VIEW view_scoring_audit IS
  'Full audit trail: leg → features → scores. Canonical V3.';

-- ============================================================================
-- 9. UPDATED_AT TRIGGER FOR TICKETS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- END OF MIGRATION
-- Sprint: SPRINT-CANONICAL-V3-SCORING-074
--
-- TABLES CREATED:
-- - tickets (bet tickets container)
-- - ticket_legs (scoring grain)
-- - feature_snapshots (scoring inputs)
-- - scored_legs (scoring outputs)
--
-- FUNCTIONS CREATED:
-- - score_ticket_legs_v3 (single-writer batch scoring RPC)
-- - update_scored_legs_is_latest (trigger function)
--
-- VIEWS CREATED:
-- - view_scored_legs_latest (latest per leg)
-- - view_scoring_audit (full audit trail)
--
-- INDEXES: 25+ performance indexes
--
-- IDEMPOTENCY:
-- - feature_snapshots: UNIQUE (leg_id, model_name, model_version, computed_at)
-- - scored_legs: UNIQUE (leg_id, model_name, model_version, computed_at)
-- ============================================================================
