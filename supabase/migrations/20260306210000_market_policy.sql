-- Migration: Create market_policy table for pick engine gating
-- Sprint: SPRINT-030-EDGE-POLICY-SEPARATION
-- Rollback: DROP TABLE IF EXISTS market_policy;

CREATE TABLE market_policy (
  id SERIAL PRIMARY KEY,
  sport TEXT NOT NULL,
  market_type TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'C',
  enabled BOOLEAN NOT NULL DEFAULT true,
  min_edge NUMERIC NOT NULL DEFAULT 0.025,
  min_confidence NUMERIC NOT NULL DEFAULT 0,
  stake_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sport, market_type)
);

CREATE INDEX idx_market_policy_sport_enabled ON market_policy(sport, enabled);

-- ============================================================================
-- SEED: NBA market policies based on Sprint 029 outcome analysis
-- ============================================================================

INSERT INTO market_policy (sport, market_type, tier, enabled, min_edge, min_confidence, stake_multiplier)
VALUES
  ('NBA', 'player_points_ou',    'A', true,  0.025, 0, 1.2),
  ('NBA', 'player_assists_ou',   'B', true,  0.025, 0, 1.0),
  ('NBA', 'player_rebounds_ou',  'C', true,  0.035, 0, 0.6),
  ('NBA', 'player_3pm_ou',       'F', false, 0, 0, 0),
  ('NBA', 'player_pra_ou',       'F', false, 0, 0, 0),
  ('NBA', 'player_blocks_ou',    'F', false, 0, 0, 0),
  ('NBA', 'player_steals_ou',    'F', false, 0, 0, 0),
  ('NBA', 'player_pts_rebs_ou',  'F', false, 0, 0, 0),
  ('NBA', 'player_pts_asts_ou',  'F', false, 0, 0, 0),
  ('NBA', 'player_rebs_asts_ou', 'F', false, 0, 0, 0),
  ('NBA', 'player_turnovers_ou', 'F', false, 0, 0, 0)
ON CONFLICT (sport, market_type) DO NOTHING;
