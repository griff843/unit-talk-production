-- ============================================================================
-- ADD event_id TO view_scored_legs_latest
-- Sprint: EVENT-LINKED-COVERAGE-RAISE-006
-- Date: 2026-03-02
--
-- PURPOSE:
-- Expose ticket_legs.event_id in the scored legs view so downstream consumers
-- (CCC ranking engine) can distinguish event-linked legs from manual legs.
-- Manual legs (event_id IS NULL) are classified with NO_EVENT_LINK elimination
-- reason rather than the generic MISSING_PRIMITIVE.
--
-- ROLLBACK:
-- Recreate view without event_id column (revert to 20260301120000 definition)
-- ============================================================================

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
  -- EVENT-LINKED-COVERAGE-RAISE-006: expose event_id for manual leg classification
  tl.event_id,
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
  'Latest score per ticket_leg with probability primitives and event_id. Sprint: EVENT-LINKED-COVERAGE-RAISE-006.';

-- ============================================================================
-- ROLLBACK:
-- DROP VIEW IF EXISTS view_scored_legs_latest;
-- Then recreate from 20260301120000_probability_integration_rpc.sql definition
-- (without event_id column)
-- ============================================================================
