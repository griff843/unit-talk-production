-- =============================================================================
-- SEARCH-CATALOG-CONTRACT-035: Search Catalog Foundations
-- Phase 2: pg_trgm Extension, Search Indexes, Materialized Views
-- =============================================================================
-- Contract: docs/contracts/SEARCH_CATALOG_CONTRACT_V1.md
-- Sprint: SEARCH-CATALOG-CONTRACT-035
-- Created: 2026-02-18
-- =============================================================================

-- =============================================================================
-- 1. ENABLE pg_trgm EXTENSION
-- =============================================================================
-- Provides trigram-based fuzzy text search for typo tolerance
-- Required for sportsbook-grade typeahead search

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Set similarity threshold for fuzzy matching
-- 0.3 = matches with 30%+ similarity (good for typos like "celitcs" -> "celtics")
-- This can be tuned per-query if needed

COMMENT ON EXTENSION pg_trgm IS 'SEARCH-CATALOG-CONTRACT-035: Trigram fuzzy search for Smart Form';

-- =============================================================================
-- 2. SEARCH INDEXES ON TEAMS TABLE
-- =============================================================================

-- Trigram GIN index for fuzzy name search
-- Supports queries like: WHERE name % 'celitcs' (typo-tolerant)
-- Or: WHERE name ILIKE '%bost%' (partial match)
CREATE INDEX IF NOT EXISTS idx_teams_name_trgm
ON teams USING gin (name gin_trgm_ops);

-- Composite index for sport-scoped queries
CREATE INDEX IF NOT EXISTS idx_teams_sport_id
ON teams (sport, id);

-- Index for abbreviation lookups
CREATE INDEX IF NOT EXISTS idx_teams_abbr_sport
ON teams (abbr, sport);

-- =============================================================================
-- 3. SEARCH INDEXES ON PLAYERS TABLE
-- =============================================================================

-- Trigram GIN index for fuzzy name search
CREATE INDEX IF NOT EXISTS idx_players_name_trgm
ON players USING gin (full_name gin_trgm_ops);

-- Composite index for sport + team filtering (cascading filters)
CREATE INDEX IF NOT EXISTS idx_players_sport_team
ON players (sport, team_id);

-- Index for team-only filtering
CREATE INDEX IF NOT EXISTS idx_players_team_id
ON players (team_id);

-- =============================================================================
-- 4. SEARCH INDEXES ON GAMES TABLE
-- =============================================================================

-- Composite index for sport + date queries (most common)
CREATE INDEX IF NOT EXISTS idx_games_sport_date
ON games (sport, game_date);

-- Composite index for sport + start_time (for sorting)
CREATE INDEX IF NOT EXISTS idx_games_sport_start_time
ON games (sport, start_time);

-- Index for league (often same as sport but normalized)
CREATE INDEX IF NOT EXISTS idx_games_league_date
ON games (league, game_date);

-- Index for status filtering (scheduled, in_progress, final)
CREATE INDEX IF NOT EXISTS idx_games_status
ON games (status) WHERE status IN ('scheduled', 'in_progress');

-- =============================================================================
-- 5. SEARCH INDEXES ON RAW_PROPS TABLE
-- =============================================================================

-- Composite index for player prop lookups
CREATE INDEX IF NOT EXISTS idx_raw_props_sport_player_stat
ON raw_props (sport, player_name, stat_type);

-- Composite index for team-based prop lookups
CREATE INDEX IF NOT EXISTS idx_raw_props_sport_team_stat
ON raw_props (sport, team, stat_type);

-- Index for game_date filtering (for today's props)
CREATE INDEX IF NOT EXISTS idx_raw_props_game_date
ON raw_props (game_date);

-- Trigram index on player_name for fuzzy prop search
-- NOTE: Commented out due to large table size - create manually with CONCURRENTLY:
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_player_name_trgm
-- ON raw_props USING gin (player_name gin_trgm_ops);

-- =============================================================================
-- 6. MATERIALIZED VIEW: mv_search_teams
-- =============================================================================
-- Optimized view for team search with pre-computed search text

DROP MATERIALIZED VIEW IF EXISTS mv_search_teams CASCADE;

CREATE MATERIALIZED VIEW mv_search_teams AS
SELECT
  t.id,
  t.name,
  t.abbr,
  t.sport,
  t.team_uuid,
  t.logo_url,
  t.created_at,
  t.updated_at,
  -- Extract aliases from meta JSONB
  COALESCE(t.meta->'aliases', '[]'::jsonb) AS aliases,
  -- Pre-compute search text for trigram matching
  LOWER(t.name) || ' ' ||
    COALESCE(LOWER(t.abbr), '') || ' ' ||
    COALESCE(LOWER(t.meta->>'aliases'), '') AS search_text,
  -- Deprecated flag for filtering
  COALESCE((t.meta->>'deprecated')::boolean, false) AS deprecated
FROM teams t
WHERE NOT COALESCE((t.meta->>'deprecated')::boolean, false);

-- Indexes on materialized view
CREATE UNIQUE INDEX idx_mv_search_teams_id ON mv_search_teams (id);
CREATE INDEX idx_mv_search_teams_sport ON mv_search_teams (sport);
CREATE INDEX idx_mv_search_teams_search_trgm ON mv_search_teams USING gin (search_text gin_trgm_ops);
CREATE INDEX idx_mv_search_teams_name_trgm ON mv_search_teams USING gin (name gin_trgm_ops);

-- Grant access
GRANT SELECT ON mv_search_teams TO authenticated, anon, service_role;

COMMENT ON MATERIALIZED VIEW mv_search_teams IS
'SEARCH-CATALOG-CONTRACT-035: Optimized team search with trigram support. Refresh on team changes.';

-- =============================================================================
-- 7. MATERIALIZED VIEW: mv_search_players
-- =============================================================================
-- Optimized view for player search with team info joined

DROP MATERIALIZED VIEW IF EXISTS mv_search_players CASCADE;

CREATE MATERIALIZED VIEW mv_search_players AS
SELECT
  p.id,
  p.full_name AS name,
  p.sport,
  p.team_id,
  t.name AS team_name,
  t.abbr AS team_abbr,
  p.position,
  p.headshot_url,
  p.created_at,
  p.updated_at,
  -- Extract aliases from meta JSONB
  COALESCE(p.meta->'aliases', '[]'::jsonb) AS aliases,
  -- Pre-compute search text for trigram matching
  LOWER(p.full_name) || ' ' ||
    COALESCE(LOWER(t.name), '') || ' ' ||
    COALESCE(LOWER(t.abbr), '') || ' ' ||
    COALESCE(LOWER(p.meta->>'aliases'), '') AS search_text
FROM players p
LEFT JOIN teams t ON p.team_id = t.id;

-- Indexes on materialized view
CREATE UNIQUE INDEX idx_mv_search_players_id ON mv_search_players (id);
CREATE INDEX idx_mv_search_players_sport ON mv_search_players (sport);
CREATE INDEX idx_mv_search_players_team ON mv_search_players (team_id);
CREATE INDEX idx_mv_search_players_sport_team ON mv_search_players (sport, team_id);
CREATE INDEX idx_mv_search_players_search_trgm ON mv_search_players USING gin (search_text gin_trgm_ops);
CREATE INDEX idx_mv_search_players_name_trgm ON mv_search_players USING gin (name gin_trgm_ops);

-- Grant access
GRANT SELECT ON mv_search_players TO authenticated, anon, service_role;

COMMENT ON MATERIALIZED VIEW mv_search_players IS
'SEARCH-CATALOG-CONTRACT-035: Optimized player search with team info. Refresh on player/team changes.';

-- =============================================================================
-- 8. MATERIALIZED VIEW: mv_search_games
-- =============================================================================
-- Optimized view for game selection in Smart Form

DROP MATERIALIZED VIEW IF EXISTS mv_search_games CASCADE;

CREATE MATERIALIZED VIEW mv_search_games AS
SELECT
  g.id,
  g.sport,
  g.league,
  g.game_date,
  g.start_time,
  g.status,
  g.home_team,
  g.away_team,
  g.external_game_id,
  g.meta,
  g.created_at,
  g.updated_at,
  -- Pre-compute display label
  g.away_team || ' @ ' || g.home_team AS display_label,
  -- Extract team meta for display
  g.meta->'home_team_meta' AS home_team_meta,
  g.meta->'away_team_meta' AS away_team_meta,
  -- Extract odds for quick access
  (g.meta->>'spread')::numeric AS spread,
  (g.meta->>'total')::numeric AS total,
  (g.meta->>'moneyline_home')::integer AS moneyline_home,
  (g.meta->>'moneyline_away')::integer AS moneyline_away
FROM games g
WHERE g.game_date >= CURRENT_DATE - INTERVAL '1 day'
  AND g.game_date <= CURRENT_DATE + INTERVAL '7 days';

-- Indexes on materialized view
CREATE UNIQUE INDEX idx_mv_search_games_id ON mv_search_games (id);
CREATE INDEX idx_mv_search_games_sport_date ON mv_search_games (sport, game_date);
CREATE INDEX idx_mv_search_games_sport_start ON mv_search_games (sport, start_time);
CREATE INDEX idx_mv_search_games_status ON mv_search_games (status);

-- Grant access
GRANT SELECT ON mv_search_games TO authenticated, anon, service_role;

COMMENT ON MATERIALIZED VIEW mv_search_games IS
'SEARCH-CATALOG-CONTRACT-035: Optimized game selection for Smart Form. Refresh every 15 minutes.';

-- =============================================================================
-- 9. MATERIALIZED VIEW: mv_props_for_form
-- =============================================================================
-- Optimized view for prop selection and filtering

DROP MATERIALIZED VIEW IF EXISTS mv_props_for_form CASCADE;

CREATE MATERIALIZED VIEW mv_props_for_form AS
SELECT
  rp.id,
  rp.sport,
  rp.player_name,
  rp.team,
  rp.stat_type,
  rp.line,
  rp.over_odds,
  rp.under_odds,
  rp.game_id,
  rp.game_date,
  rp.source,
  rp.created_at,
  -- Join to get game info
  g.home_team,
  g.away_team,
  g.start_time AS game_start_time,
  -- Computed fields
  rp.player_name || ' ' || rp.stat_type || ' ' || rp.line::text AS display_label
FROM raw_props rp
LEFT JOIN games g ON rp.game_id = g.id
WHERE rp.game_date >= CURRENT_DATE
  AND rp.game_date <= CURRENT_DATE + INTERVAL '3 days'
  AND rp.line IS NOT NULL;

-- Indexes on materialized view
CREATE INDEX idx_mv_props_sport_player ON mv_props_for_form (sport, player_name);
CREATE INDEX idx_mv_props_sport_team ON mv_props_for_form (sport, team);
CREATE INDEX idx_mv_props_sport_stat ON mv_props_for_form (sport, stat_type);
CREATE INDEX idx_mv_props_game_date ON mv_props_for_form (game_date);
CREATE INDEX idx_mv_props_player_name_trgm ON mv_props_for_form USING gin (player_name gin_trgm_ops);

-- Grant access
GRANT SELECT ON mv_props_for_form TO authenticated, anon, service_role;

COMMENT ON MATERIALIZED VIEW mv_props_for_form IS
'SEARCH-CATALOG-CONTRACT-035: Optimized props view for Smart Form filtering. Refresh every 2 minutes.';

-- =============================================================================
-- 10. MV REFRESH TRACKING
-- =============================================================================
-- Add new MVs to the allowed refresh list

DO $$
BEGIN
  -- Update the refresh function to include new MVs
  -- This is a safe no-op if the infrastructure doesn't exist yet
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'refresh_mv_safe') THEN
    RAISE NOTICE 'MV refresh infrastructure exists, update allowed views manually';
  END IF;
END $$;

-- =============================================================================
-- 11. CREATE REFRESH FUNCTIONS
-- =============================================================================

-- Function to refresh search MVs
CREATE OR REPLACE FUNCTION refresh_search_mvs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_search_teams;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_search_players;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_search_games;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_props_for_form;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION refresh_search_mvs() TO service_role;

COMMENT ON FUNCTION refresh_search_mvs() IS
'SEARCH-CATALOG-CONTRACT-035: Refresh all search materialized views. Call from cron or manually.';

-- Function to refresh individual MV
CREATE OR REPLACE FUNCTION refresh_search_mv(view_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CASE view_name
    WHEN 'mv_search_teams' THEN
      REFRESH MATERIALIZED VIEW CONCURRENTLY mv_search_teams;
    WHEN 'mv_search_players' THEN
      REFRESH MATERIALIZED VIEW CONCURRENTLY mv_search_players;
    WHEN 'mv_search_games' THEN
      REFRESH MATERIALIZED VIEW CONCURRENTLY mv_search_games;
    WHEN 'mv_props_for_form' THEN
      REFRESH MATERIALIZED VIEW CONCURRENTLY mv_props_for_form;
    ELSE
      RAISE EXCEPTION 'Unknown search MV: %', view_name;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_search_mv(text) TO service_role;

-- =============================================================================
-- 12. VERIFICATION
-- =============================================================================

DO $$
DECLARE
  trgm_enabled boolean;
  mv_count integer;
  idx_count integer;
BEGIN
  -- Check pg_trgm is enabled
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
  ) INTO trgm_enabled;

  IF NOT trgm_enabled THEN
    RAISE EXCEPTION 'pg_trgm extension not enabled';
  END IF;

  -- Count materialized views
  SELECT COUNT(*) INTO mv_count
  FROM pg_matviews
  WHERE matviewname IN (
    'mv_search_teams', 'mv_search_players',
    'mv_search_games', 'mv_props_for_form'
  );

  IF mv_count < 4 THEN
    RAISE EXCEPTION 'Expected 4 search MVs, found %', mv_count;
  END IF;

  -- Count trigram indexes
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE indexdef LIKE '%gin_trgm_ops%';

  IF idx_count < 6 THEN
    RAISE WARNING 'Expected at least 6 trigram indexes, found %', idx_count;
  END IF;

  RAISE NOTICE 'SEARCH-CATALOG-CONTRACT-035: Migration verified successfully';
  RAISE NOTICE '  pg_trgm: ENABLED';
  RAISE NOTICE '  Search MVs: %', mv_count;
  RAISE NOTICE '  Trigram indexes: %', idx_count;
END $$;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

SELECT
  'SEARCH-CATALOG-CONTRACT-035: Search foundations migration complete' as status,
  NOW() as completed_at;
