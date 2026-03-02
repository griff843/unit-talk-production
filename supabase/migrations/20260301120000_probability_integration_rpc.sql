-- ============================================================================
-- PROBABILITY INTEGRATION RPC UPDATE
-- Sprint: INTELLIGENCE-PROBABILITY-INTEGRATION-002
-- Date: 2026-03-01
--
-- PURPOSE:
-- Update score_ticket_legs_v3 RPC to write probability fields to scored_legs.
-- The probability fields were added in 20260301100000_probability_foundation.sql.
--
-- CHANGES:
-- - Updated score_ticket_legs_v3 to extract probability fields from p_scores JSONB
-- - Writes: p_final, uncertainty_final, edge_final, clv_forecast, p_market_devig,
--           devig_method, consensus_weights_json, probability_model_version
--
-- ROLLBACK: See end of file
-- ============================================================================

-- ============================================================================
-- 1. REPLACE score_ticket_legs_v3 FUNCTION
-- Now includes probability primitives in scored_legs writes
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

    -- Insert scored_leg with probability primitives
    -- INTELLIGENCE-PROBABILITY-INTEGRATION-002: Added probability fields
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
      is_latest,
      -- Probability primitives (from p_scores JSONB)
      p_final,
      uncertainty_final,
      edge_final,
      clv_forecast,
      p_market_devig,
      devig_method,
      consensus_weights_json,
      probability_model_version
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
      TRUE,
      -- Probability primitives
      (v_score->>'p_final')::NUMERIC,
      (v_score->>'uncertainty_final')::NUMERIC,
      (v_score->>'edge_final')::NUMERIC,
      (v_score->>'clv_forecast')::NUMERIC,
      (v_score->>'p_market_devig')::NUMERIC,
      v_score->>'devig_method',
      v_score->'consensus_weights_json',
      v_score->>'probability_model_version'
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
  'Single-writer batch scoring RPC with probability primitives. Sprint: INTELLIGENCE-PROBABILITY-INTEGRATION-002.';

-- ============================================================================
-- 2. UPDATE view_scored_legs_latest TO INCLUDE PROBABILITY FIELDS
-- ============================================================================

-- Must DROP and recreate to change column order
DROP VIEW IF EXISTS view_scored_legs_latest;

CREATE VIEW view_scored_legs_latest AS
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
  -- Probability primitives (INTELLIGENCE-PROBABILITY-INTEGRATION-002)
  sl.p_final,
  sl.uncertainty_final,
  sl.edge_final,
  sl.clv_forecast,
  sl.p_market_devig,
  sl.devig_method,
  sl.consensus_weights_json,
  sl.probability_model_version,
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
  'Latest score per ticket_leg with probability primitives. Sprint: INTELLIGENCE-PROBABILITY-INTEGRATION-002.';

-- ============================================================================
-- 3. UPDATE view_scoring_audit TO INCLUDE PROBABILITY FIELDS
-- ============================================================================

-- Must DROP and recreate to change column order
DROP VIEW IF EXISTS view_scoring_audit;

CREATE VIEW view_scoring_audit AS
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
  sl.is_latest,
  -- Probability primitives (INTELLIGENCE-PROBABILITY-INTEGRATION-002)
  sl.p_final,
  sl.uncertainty_final,
  sl.edge_final,
  sl.clv_forecast,
  sl.p_market_devig,
  sl.devig_method,
  sl.consensus_weights_json,
  sl.probability_model_version
FROM ticket_legs tl
JOIN tickets t ON t.id = tl.ticket_id
LEFT JOIN feature_snapshots fs ON fs.leg_id = tl.id
LEFT JOIN scored_legs sl ON sl.leg_id = tl.id AND sl.feature_snapshot_id = fs.id
ORDER BY tl.id, sl.computed_at DESC;

COMMENT ON VIEW view_scoring_audit IS
  'Full audit trail with probability primitives. Sprint: INTELLIGENCE-PROBABILITY-INTEGRATION-002.';

-- ============================================================================
-- END OF MIGRATION
-- Sprint: INTELLIGENCE-PROBABILITY-INTEGRATION-002
--
-- FUNCTION REPLACED:
-- - score_ticket_legs_v3 (now writes probability primitives)
--
-- VIEWS REPLACED:
-- - view_scored_legs_latest (includes probability fields)
-- - view_scoring_audit (includes probability fields)
--
-- ROLLBACK:
-- -- Revert to original score_ticket_legs_v3 from 20260220130000_canonical_v3_scoring_storage.sql
-- -- Revert views to original definitions
-- ============================================================================
