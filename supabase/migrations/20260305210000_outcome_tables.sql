-- Migration: Create outcome tracking tables
-- Sprint: SPRINT-029-OUTCOME-FOUNDATION
-- Rollback:
--   DROP TABLE IF EXISTS prop_outcomes;
--   DROP TABLE IF EXISTS player_game_stats;

-- ============================================================================
-- player_game_stats: Box score data per player per game
-- ============================================================================
CREATE TABLE player_game_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES canonical_events(id),
  participant_id UUID NOT NULL REFERENCES participants(id),
  game_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'sgo',
  stats JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, participant_id)
);

CREATE INDEX idx_player_game_stats_event ON player_game_stats(event_id);
CREATE INDEX idx_player_game_stats_participant ON player_game_stats(participant_id);

-- ============================================================================
-- prop_outcomes: Market-level WIN/LOSS/PUSH outcomes
-- ============================================================================
CREATE TABLE prop_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_key TEXT NOT NULL UNIQUE,
  event_id UUID NOT NULL,
  market_type_id INT NOT NULL,
  participant_id UUID,
  line NUMERIC NOT NULL,
  actual_value NUMERIC NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('WIN', 'LOSS', 'PUSH')),
  side TEXT NOT NULL DEFAULT 'over',
  source TEXT NOT NULL DEFAULT 'sgo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prop_outcomes_event ON prop_outcomes(event_id);
CREATE INDEX idx_prop_outcomes_market_type ON prop_outcomes(market_type_id);
