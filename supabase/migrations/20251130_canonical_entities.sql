-- =====================================================
-- Phase 2 Step 1: Canonical Entity Resolution System
-- =====================================================
--
-- Purpose: Create centralized entity tables for games, players, and props
-- to enable multi-feed mapping and consistent entity resolution across
-- Odds API, Optimal API, and any future data sources.
--
-- Author: Engineering Team
-- Date: 2025-11-30
-- Phase: Phase 2 - Canonical Entity Resolution

-- =====================================================
-- Table: canonical_games
-- =====================================================
-- Stores standardized game information across all sports leagues
CREATE TABLE IF NOT EXISTS canonical_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Sport and league information
  sport TEXT NOT NULL CHECK (sport IN ('NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'WNBA', 'MLS', 'EPL')),
  league TEXT NOT NULL, -- For flexibility (e.g., "NBA", "NBA_PRESEASON", "NCAA_D1")
  season TEXT NOT NULL, -- e.g., "2024-25", "2024"

  -- Team information
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_team_alias TEXT, -- Short name/abbreviation (e.g., "LAL" for Lakers)
  away_team_alias TEXT,

  -- Game timing
  game_time TIMESTAMPTZ NOT NULL,
  venue TEXT,

  -- Game status
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'postponed', 'cancelled')),

  -- Score tracking (for completed games)
  home_score INTEGER,
  away_score INTEGER,

  -- Metadata
  external_ids JSONB DEFAULT '{}', -- Store original IDs from various sources
  metadata JSONB DEFAULT '{}',

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes for performance
  CONSTRAINT unique_game_identity UNIQUE (sport, league, home_team, away_team, game_time)
);

-- Indexes for canonical_games
CREATE INDEX IF NOT EXISTS idx_canonical_games_sport_league ON canonical_games(sport, league);
CREATE INDEX IF NOT EXISTS idx_canonical_games_game_time ON canonical_games(game_time);
CREATE INDEX IF NOT EXISTS idx_canonical_games_status ON canonical_games(status);
CREATE INDEX IF NOT EXISTS idx_canonical_games_teams ON canonical_games(home_team, away_team);
CREATE INDEX IF NOT EXISTS idx_canonical_games_external_ids ON canonical_games USING GIN(external_ids);

-- =====================================================
-- Table: canonical_players
-- =====================================================
-- Stores standardized player information across all sports
CREATE TABLE IF NOT EXISTS canonical_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Player identification
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,

  -- Sport and team information
  sport TEXT NOT NULL CHECK (sport IN ('NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'WNBA', 'MLS', 'EPL')),
  current_team TEXT,
  position TEXT, -- e.g., "QB", "PG", "SP", "C"
  jersey_number TEXT,

  -- Player status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'injured', 'suspended', 'retired')),

  -- Name variations for fuzzy matching
  name_variations TEXT[] DEFAULT '{}', -- Common spellings, nicknames, etc.

  -- External identifiers
  external_ids JSONB DEFAULT '{}', -- Store IDs from various sources

  -- Metadata
  metadata JSONB DEFAULT '{}', -- Height, weight, draft info, etc.

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes for performance
  CONSTRAINT unique_player_identity UNIQUE (sport, full_name, current_team)
);

-- Indexes for canonical_players
CREATE INDEX IF NOT EXISTS idx_canonical_players_sport ON canonical_players(sport);
CREATE INDEX IF NOT EXISTS idx_canonical_players_full_name ON canonical_players(full_name);
CREATE INDEX IF NOT EXISTS idx_canonical_players_team ON canonical_players(current_team);
CREATE INDEX IF NOT EXISTS idx_canonical_players_status ON canonical_players(status);
CREATE INDEX IF NOT EXISTS idx_canonical_players_external_ids ON canonical_players USING GIN(external_ids);
CREATE INDEX IF NOT EXISTS idx_canonical_players_name_variations ON canonical_players USING GIN(name_variations);

-- Full-text search index for player names
CREATE INDEX IF NOT EXISTS idx_canonical_players_name_fts ON canonical_players
  USING GIN(to_tsvector('english', full_name || ' ' || COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')));

-- =====================================================
-- Table: game_mappings
-- =====================================================
-- Maps external game identifiers to canonical games
CREATE TABLE IF NOT EXISTS game_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Canonical reference
  canonical_game_id UUID NOT NULL REFERENCES canonical_games(id) ON DELETE CASCADE,

  -- External source information
  source TEXT NOT NULL CHECK (source IN ('odds_api', 'optimal_api', 'manual', 'espn', 'sportsdata')),
  external_game_id TEXT NOT NULL, -- The ID used by the external source

  -- Mapping quality
  confidence_score DECIMAL(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  mapping_method TEXT NOT NULL DEFAULT 'exact' CHECK (mapping_method IN ('exact', 'fuzzy', 'manual', 'heuristic')),

  -- Conflict detection
  is_primary BOOLEAN NOT NULL DEFAULT true, -- False if this is an alternative/conflicting mapping
  conflict_count INTEGER NOT NULL DEFAULT 0, -- Number of times this mapping conflicted

  -- Additional context
  metadata JSONB DEFAULT '{}',

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ,

  CONSTRAINT unique_game_mapping UNIQUE (source, external_game_id)
);

-- Indexes for game_mappings
CREATE INDEX IF NOT EXISTS idx_game_mappings_canonical_id ON game_mappings(canonical_game_id);
CREATE INDEX IF NOT EXISTS idx_game_mappings_source ON game_mappings(source);
CREATE INDEX IF NOT EXISTS idx_game_mappings_external_id ON game_mappings(external_game_id);
CREATE INDEX IF NOT EXISTS idx_game_mappings_confidence ON game_mappings(confidence_score);
CREATE INDEX IF NOT EXISTS idx_game_mappings_conflicts ON game_mappings(conflict_count) WHERE conflict_count > 0;

-- =====================================================
-- Table: player_mappings
-- =====================================================
-- Maps external player identifiers/names to canonical players
CREATE TABLE IF NOT EXISTS player_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Canonical reference
  canonical_player_id UUID NOT NULL REFERENCES canonical_players(id) ON DELETE CASCADE,

  -- External source information
  source TEXT NOT NULL CHECK (source IN ('odds_api', 'optimal_api', 'manual', 'espn', 'sportsdata')),
  external_player_id TEXT, -- May be null if source only provides names
  external_player_name TEXT NOT NULL, -- The name as it appears in the external source

  -- Mapping quality
  confidence_score DECIMAL(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  mapping_method TEXT NOT NULL DEFAULT 'exact' CHECK (mapping_method IN ('exact', 'fuzzy', 'manual', 'heuristic', 'ml')),
  similarity_score DECIMAL(3,2), -- For fuzzy name matching (0-1)

  -- Conflict detection
  is_primary BOOLEAN NOT NULL DEFAULT true,
  conflict_count INTEGER NOT NULL DEFAULT 0,

  -- Additional context
  metadata JSONB DEFAULT '{}',

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ,

  CONSTRAINT unique_player_mapping UNIQUE (source, external_player_name)
);

-- Indexes for player_mappings
CREATE INDEX IF NOT EXISTS idx_player_mappings_canonical_id ON player_mappings(canonical_player_id);
CREATE INDEX IF NOT EXISTS idx_player_mappings_source ON player_mappings(source);
CREATE INDEX IF NOT EXISTS idx_player_mappings_external_id ON player_mappings(external_player_id) WHERE external_player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_player_mappings_external_name ON player_mappings(external_player_name);
CREATE INDEX IF NOT EXISTS idx_player_mappings_confidence ON player_mappings(confidence_score);
CREATE INDEX IF NOT EXISTS idx_player_mappings_conflicts ON player_mappings(conflict_count) WHERE conflict_count > 0;

-- =====================================================
-- Table: prop_mappings
-- =====================================================
-- Maps external prop/market identifiers to canonical prop definitions
CREATE TABLE IF NOT EXISTS prop_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  canonical_game_id UUID REFERENCES canonical_games(id) ON DELETE CASCADE,
  canonical_player_id UUID REFERENCES canonical_players(id) ON DELETE CASCADE,

  -- Prop definition
  stat_type TEXT NOT NULL, -- e.g., "points", "rebounds", "strikeouts"
  line DECIMAL(10,2) NOT NULL,

  -- External source information
  source TEXT NOT NULL CHECK (source IN ('odds_api', 'optimal_api', 'manual')),
  external_prop_id TEXT NOT NULL,

  -- Odds information (captured at mapping time)
  over_odds INTEGER,
  under_odds INTEGER,

  -- Mapping quality
  confidence_score DECIMAL(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence_score >= 0 AND confidence_score <= 1),

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_prop_mapping UNIQUE (source, external_prop_id),
  -- Either game or player must be present
  CONSTRAINT check_prop_has_game_or_player CHECK (canonical_game_id IS NOT NULL OR canonical_player_id IS NOT NULL)
);

-- Indexes for prop_mappings
CREATE INDEX IF NOT EXISTS idx_prop_mappings_canonical_game ON prop_mappings(canonical_game_id);
CREATE INDEX IF NOT EXISTS idx_prop_mappings_canonical_player ON prop_mappings(canonical_player_id);
CREATE INDEX IF NOT EXISTS idx_prop_mappings_source ON prop_mappings(source);
CREATE INDEX IF NOT EXISTS idx_prop_mappings_stat_type ON prop_mappings(stat_type);
CREATE INDEX IF NOT EXISTS idx_prop_mappings_external_id ON prop_mappings(external_prop_id);

-- =====================================================
-- Triggers for updated_at timestamps
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all canonical tables
CREATE TRIGGER update_canonical_games_updated_at
  BEFORE UPDATE ON canonical_games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_canonical_players_updated_at
  BEFORE UPDATE ON canonical_players
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_mappings_updated_at
  BEFORE UPDATE ON game_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_mappings_updated_at
  BEFORE UPDATE ON player_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prop_mappings_updated_at
  BEFORE UPDATE ON prop_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function: Find or create canonical game
CREATE OR REPLACE FUNCTION find_or_create_canonical_game(
  p_sport TEXT,
  p_league TEXT,
  p_home_team TEXT,
  p_away_team TEXT,
  p_game_time TIMESTAMPTZ,
  p_external_ids JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_game_id UUID;
BEGIN
  -- Try to find existing game
  SELECT id INTO v_game_id
  FROM canonical_games
  WHERE sport = p_sport
    AND league = p_league
    AND home_team = p_home_team
    AND away_team = p_away_team
    AND game_time = p_game_time;

  -- Create if not found
  IF v_game_id IS NULL THEN
    INSERT INTO canonical_games (sport, league, home_team, away_team, game_time, external_ids)
    VALUES (p_sport, p_league, p_home_team, p_away_team, p_game_time, p_external_ids)
    RETURNING id INTO v_game_id;
  END IF;

  RETURN v_game_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Find or create canonical player
CREATE OR REPLACE FUNCTION find_or_create_canonical_player(
  p_full_name TEXT,
  p_sport TEXT,
  p_current_team TEXT DEFAULT NULL,
  p_external_ids JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_player_id UUID;
BEGIN
  -- Try to find existing player
  SELECT id INTO v_player_id
  FROM canonical_players
  WHERE sport = p_sport
    AND full_name = p_full_name
    AND (current_team = p_current_team OR p_current_team IS NULL);

  -- Create if not found
  IF v_player_id IS NULL THEN
    INSERT INTO canonical_players (full_name, sport, current_team, external_ids)
    VALUES (p_full_name, p_sport, p_current_team, p_external_ids)
    RETURNING id INTO v_player_id;
  END IF;

  RETURN v_player_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Get mapping conflicts for review
CREATE OR REPLACE FUNCTION get_mapping_conflicts(p_source TEXT DEFAULT NULL)
RETURNS TABLE (
  mapping_type TEXT,
  source TEXT,
  external_id TEXT,
  canonical_id UUID,
  conflict_count INTEGER,
  confidence_score DECIMAL
) AS $$
BEGIN
  -- Game mapping conflicts
  RETURN QUERY
  SELECT
    'game'::TEXT as mapping_type,
    gm.source,
    gm.external_game_id as external_id,
    gm.canonical_game_id as canonical_id,
    gm.conflict_count,
    gm.confidence_score
  FROM game_mappings gm
  WHERE (p_source IS NULL OR gm.source = p_source)
    AND (gm.conflict_count > 0 OR gm.confidence_score < 0.9)

  UNION ALL

  -- Player mapping conflicts
  SELECT
    'player'::TEXT as mapping_type,
    pm.source,
    pm.external_player_name as external_id,
    pm.canonical_player_id as canonical_id,
    pm.conflict_count,
    pm.confidence_score
  FROM player_mappings pm
  WHERE (p_source IS NULL OR pm.source = p_source)
    AND (pm.conflict_count > 0 OR pm.confidence_score < 0.9)

  ORDER BY conflict_count DESC, confidence_score ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE canonical_games IS 'Centralized game entity table for multi-feed mapping';
COMMENT ON TABLE canonical_players IS 'Centralized player entity table for multi-feed mapping';
COMMENT ON TABLE game_mappings IS 'Maps external game IDs to canonical games with confidence scoring';
COMMENT ON TABLE player_mappings IS 'Maps external player names/IDs to canonical players with fuzzy matching';
COMMENT ON TABLE prop_mappings IS 'Maps external prop/market IDs to canonical prop definitions';

COMMENT ON FUNCTION find_or_create_canonical_game IS 'Helper function to find existing or create new canonical game';
COMMENT ON FUNCTION find_or_create_canonical_player IS 'Helper function to find existing or create new canonical player';
COMMENT ON FUNCTION get_mapping_conflicts IS 'Returns all mapping conflicts for operator review';

-- =====================================================
-- RLS Policies (if needed)
-- =====================================================
-- Note: RLS can be added later if needed for multi-tenancy
-- For now, these tables are system-level and don't require RLS

-- =====================================================
-- Migration Complete
-- =====================================================

-- ============================================================================
-- FORCE POSTGREST SCHEMA RELOAD (Charter-mandated)
-- ============================================================================
-- Trigger PostgREST to reload its schema cache
-- This ensures canonical tables are immediately visible via REST API
SELECT pg_notify('pgrst', 'reload schema');
