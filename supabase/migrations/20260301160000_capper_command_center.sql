-- ============================================================================
-- CAPPER COMMAND CENTER MIGRATION
-- Sprint: CAPPER-COMMAND-CENTER-MVP-001
-- Date: 2026-03-01
--
-- PURPOSE:
-- 1. Create capper_actions table for logging approve/reject/override actions
-- 2. Add indexes for audit queries
--
-- SPEC CONFORMANCE:
-- - CAPPER_COMMAND_CENTER_SPEC_v1.0.md Section 8: Logging and Accountability
--
-- ROLLBACK: See end of file
-- ============================================================================

-- ============================================================================
-- 1. CREATE CAPPER_ACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS capper_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Actor identification
  actor_id TEXT NOT NULL,  -- capper/admin user id
  actor_name TEXT,          -- optional display name

  -- Target identification
  leg_id UUID NOT NULL,     -- scored_legs.leg_id reference
  scored_leg_id UUID,       -- scored_legs.id for audit trail

  -- Action type
  action TEXT NOT NULL CHECK (action IN ('APPROVE', 'REJECT', 'OVERRIDE')),

  -- Override reason (required if action = OVERRIDE)
  override_reason TEXT,

  -- Snapshot of key primitives at decision time (immutable audit trail)
  p_final NUMERIC(6,5),
  p_market_devig NUMERIC(6,5),
  edge_final NUMERIC(7,5),
  uncertainty_final NUMERIC(6,5),
  clv_forecast NUMERIC(7,5),
  books_used INTEGER,
  tier TEXT,
  promotion_band TEXT,

  -- Ranking metadata
  ranking_version TEXT NOT NULL,
  rank_position INTEGER,

  -- Session metrics
  page_load_at TIMESTAMPTZ,         -- when CCC page was loaded
  first_action_latency_ms INTEGER,  -- time from page load to this action (first action only)

  -- Constraints
  CONSTRAINT capper_actions_override_reason_required
    CHECK (action != 'OVERRIDE' OR override_reason IS NOT NULL)
);

COMMENT ON TABLE capper_actions IS
  'Capper Command Center action log. Per CAPPER_COMMAND_CENTER_SPEC Section 8. Sprint: CAPPER-COMMAND-CENTER-MVP-001';

-- ============================================================================
-- 2. ADD INDEXES FOR AUDIT AND ANALYTICS
-- ============================================================================

-- Index for actor queries
CREATE INDEX IF NOT EXISTS idx_capper_actions_actor
  ON capper_actions(actor_id, created_at DESC);

-- Index for leg queries
CREATE INDEX IF NOT EXISTS idx_capper_actions_leg
  ON capper_actions(leg_id, created_at DESC);

-- Index for action type analysis
CREATE INDEX IF NOT EXISTS idx_capper_actions_type
  ON capper_actions(action, created_at DESC);

-- Index for override analysis (key diagnostic per spec)
CREATE INDEX IF NOT EXISTS idx_capper_actions_overrides
  ON capper_actions(created_at DESC)
  WHERE action = 'OVERRIDE';

-- Index for latency analysis
CREATE INDEX IF NOT EXISTS idx_capper_actions_latency
  ON capper_actions(created_at DESC)
  WHERE first_action_latency_ms IS NOT NULL;

-- ============================================================================
-- 3. VIEW: OVERRIDE RATE DIAGNOSTIC
-- ============================================================================

CREATE OR REPLACE VIEW view_capper_override_rate AS
SELECT
  DATE_TRUNC('day', created_at) AS day,
  COUNT(*) AS total_actions,
  COUNT(*) FILTER (WHERE action = 'APPROVE') AS approves,
  COUNT(*) FILTER (WHERE action = 'REJECT') AS rejects,
  COUNT(*) FILTER (WHERE action = 'OVERRIDE') AS overrides,
  ROUND(
    COUNT(*) FILTER (WHERE action = 'OVERRIDE')::NUMERIC /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) AS override_rate_pct,
  ROUND(AVG(first_action_latency_ms) FILTER (WHERE first_action_latency_ms IS NOT NULL), 0) AS avg_first_action_ms
FROM capper_actions
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;

COMMENT ON VIEW view_capper_override_rate IS
  'Daily override rate diagnostic. High overrides indicate blind spots. Sprint: CAPPER-COMMAND-CENTER-MVP-001';

-- ============================================================================
-- 4. VIEW: CCC SESSION METRICS
-- ============================================================================

CREATE OR REPLACE VIEW view_ccc_session_metrics AS
SELECT
  DATE_TRUNC('day', created_at) AS day,
  COUNT(DISTINCT actor_id) AS unique_actors,
  COUNT(*) AS total_actions,
  ROUND(AVG(first_action_latency_ms) FILTER (WHERE first_action_latency_ms IS NOT NULL) / 1000.0, 1) AS avg_first_action_sec,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY first_action_latency_ms)
    FILTER (WHERE first_action_latency_ms IS NOT NULL) AS median_first_action_ms
FROM capper_actions
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;

COMMENT ON VIEW view_ccc_session_metrics IS
  'CCC session metrics for compression validation. Target: median first action ≤ 3 min. Sprint: CAPPER-COMMAND-CENTER-MVP-001';

-- ============================================================================
-- END OF MIGRATION
-- Sprint: CAPPER-COMMAND-CENTER-MVP-001
--
-- TABLES CREATED:
-- - capper_actions
--
-- VIEWS CREATED:
-- - view_capper_override_rate
-- - view_ccc_session_metrics
--
-- INDEXES: 5 indexes for audit and analytics
--
-- ROLLBACK SQL:
-- DROP VIEW IF EXISTS view_ccc_session_metrics;
-- DROP VIEW IF EXISTS view_capper_override_rate;
-- DROP TABLE IF EXISTS capper_actions;
-- ============================================================================
