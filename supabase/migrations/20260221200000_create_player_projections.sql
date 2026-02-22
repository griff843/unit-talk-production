-- ============================================================================
-- PLAYER PROJECTIONS TABLE
-- Sprint: SPRINT-PROJECTIONS-FOUNDATION-099A
-- Date: 2026-02-21
--
-- Creates projection storage for NBA/MLB stat-type projections.
-- Supports deterministic baseline compute with model versioning.
--
-- NO app behavior changes. DDL only.
-- ============================================================================

-- ============================================================================
-- PLAYER_PROJECTIONS TABLE
-- Stores computed projections with versioning and audit trail.
-- ============================================================================
CREATE TABLE IF NOT EXISTS player_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  sport TEXT NOT NULL,                          -- 'NBA', 'MLB', 'NFL', 'NHL'
  player_name TEXT NOT NULL,                    -- Canonical player name
  participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,  -- Optional FK to participants
  stat_type TEXT NOT NULL,                      -- 'points', 'rebounds', 'strikeouts', 'hits', etc.
  game_date DATE NOT NULL,                      -- Date of the game

  -- Projection
  projected_value NUMERIC(10, 2) NOT NULL,      -- The projected stat value
  confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),

  -- Versioning & Audit
  model_version TEXT NOT NULL,                  -- e.g., 'v1.0.0-nba-baseline', 'v1.0.0-mlb-baseline'
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Context & Source Data
  opponent TEXT,                                -- Opponent team
  venue TEXT,                                   -- 'home' or 'away'
  source_data JSONB DEFAULT '{}',               -- Input features used for computation

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one projection per (sport, player, stat, date, model_version)
  CONSTRAINT player_projections_unique_key
    UNIQUE (sport, player_name, stat_type, game_date, model_version),

  -- Sport validation
  CONSTRAINT player_projections_sport_check
    CHECK (sport IN ('NBA', 'MLB', 'NFL', 'NHL', 'SOCCER', 'TENNIS', 'GOLF', 'MMA'))
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary lookup index: player + sport + stat_type + game_date
CREATE INDEX IF NOT EXISTS idx_projections_lookup
  ON player_projections(sport, player_name, stat_type, game_date);

-- Model version + computed_at for auditing and replay
CREATE INDEX IF NOT EXISTS idx_projections_model_audit
  ON player_projections(model_version, computed_at DESC);

-- Game date for daily batch queries
CREATE INDEX IF NOT EXISTS idx_projections_game_date
  ON player_projections(game_date);

-- Participant FK lookup (when linked to participants table)
CREATE INDEX IF NOT EXISTS idx_projections_participant
  ON player_projections(participant_id) WHERE participant_id IS NOT NULL;

-- Sport + game_date for coverage queries
CREATE INDEX IF NOT EXISTS idx_projections_sport_date
  ON player_projections(sport, game_date);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE player_projections IS 'Projection storage for player stat-type projections. Supports NBA/MLB baseline models with versioning.';
COMMENT ON COLUMN player_projections.model_version IS 'Model version identifier, e.g., v1.0.0-nba-baseline';
COMMENT ON COLUMN player_projections.confidence IS 'Model confidence 0-1. Lower if inputs missing or uncertain.';
COMMENT ON COLUMN player_projections.source_data IS 'JSONB of input features used for projection computation';

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_player_projections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_player_projections_updated_at
  BEFORE UPDATE ON player_projections
  FOR EACH ROW
  EXECUTE FUNCTION update_player_projections_updated_at();

-- ============================================================================
-- RLS (Row Level Security) - Disabled for now, enable if needed
-- ============================================================================
-- ALTER TABLE player_projections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- DROP TRIGGER IF EXISTS trigger_player_projections_updated_at ON player_projections;
-- DROP FUNCTION IF EXISTS update_player_projections_updated_at();
-- DROP TABLE IF EXISTS player_projections;
