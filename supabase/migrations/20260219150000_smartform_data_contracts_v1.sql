-- =============================================================================
-- SPRINT-SMARTFORM-DATA-CONTRACTS-INVENTORY-SURFACE-059
-- Versioned Contract Surfaces for Smart Form
-- =============================================================================
-- Contract: docs/contracts/SMARTFORM_DATA_CONTRACT_V1.md
-- Created: 2026-02-19
-- Version: 1.0.0
-- =============================================================================
--
-- PRINCIPLE: Smart Form API routes MUST NOT query canonical tables directly.
--            They query ONLY these versioned contract views.
--
-- SURFACES:
--   1. catalog_players_v1     - Player search contract
--   2. catalog_teams_v1       - Team search contract
--   3. inventory_props_for_form_v1 - Props inventory contract
--   4. market_taxonomy_v1     - Market/stat type taxonomy
--
-- =============================================================================

-- =============================================================================
-- 0. PRE-FLIGHT: Ensure dependencies exist
-- =============================================================================

DO $$
BEGIN
  -- Check pg_trgm is available
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    RAISE EXCEPTION 'DEPENDENCY: pg_trgm extension required';
  END IF;

  -- Check required tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'players') THEN
    RAISE EXCEPTION 'DEPENDENCY: players table required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
    RAISE EXCEPTION 'DEPENDENCY: teams table required';
  END IF;

  RAISE NOTICE 'SPRINT-059: Pre-flight checks passed';
END $$;

-- =============================================================================
-- 1. market_taxonomy_v1 - Allowed markets/stat types by sport
-- =============================================================================
-- This is a TABLE (not view) because it's reference data that rarely changes
-- and serves as the authoritative source for valid market codes.

CREATE TABLE IF NOT EXISTS market_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL,
  market_key TEXT NOT NULL,           -- PTS, AST, REB, PASS_YDS, etc.
  display_name TEXT NOT NULL,         -- Points, Assists, Rebounds
  category TEXT NOT NULL DEFAULT 'other',  -- scoring, passing, defense
  bet_type TEXT NOT NULL DEFAULT 'player_prop', -- player_prop, team_prop, game
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  description TEXT,                   -- Optional tooltip/description
  aliases TEXT[],                     -- Alternative names for fuzzy matching
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sport, market_key)
);

-- Create index for sport lookups
CREATE INDEX IF NOT EXISTS idx_market_taxonomy_sport_active
  ON market_taxonomy (sport, active, sort_order)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_market_taxonomy_bet_type
  ON market_taxonomy (sport, bet_type, active)
  WHERE active = true;

-- Seed NBA markets
INSERT INTO market_taxonomy (sport, market_key, display_name, category, bet_type, sort_order, aliases) VALUES
('NBA', 'PTS', 'Points', 'scoring', 'player_prop', 1, ARRAY['points', 'pts', 'scoring']),
('NBA', 'REB', 'Rebounds', 'rebounds', 'player_prop', 2, ARRAY['rebounds', 'reb', 'boards']),
('NBA', 'AST', 'Assists', 'passing', 'player_prop', 3, ARRAY['assists', 'ast', 'dimes']),
('NBA', 'PRA', 'Pts+Reb+Ast', 'combo', 'player_prop', 4, ARRAY['pra', 'points rebounds assists']),
('NBA', '3PM', '3-Pointers Made', 'scoring', 'player_prop', 5, ARRAY['3pm', 'threes', 'three pointers']),
('NBA', 'STL', 'Steals', 'defense', 'player_prop', 6, ARRAY['steals', 'stl']),
('NBA', 'BLK', 'Blocks', 'defense', 'player_prop', 7, ARRAY['blocks', 'blk']),
('NBA', 'TO', 'Turnovers', 'other', 'player_prop', 8, ARRAY['turnovers', 'to']),
('NBA', 'DD', 'Double-Double', 'combo', 'player_prop', 9, ARRAY['double double', 'dd']),
('NBA', 'TD', 'Triple-Double', 'combo', 'player_prop', 10, ARRAY['triple double', 'td']),
('NBA', 'FGM', 'Field Goals Made', 'scoring', 'player_prop', 11, ARRAY['fgm', 'field goals']),
('NBA', 'FTM', 'Free Throws Made', 'scoring', 'player_prop', 12, ARRAY['ftm', 'free throws'])
ON CONFLICT (sport, market_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  aliases = EXCLUDED.aliases,
  updated_at = NOW();

-- Seed NFL markets
INSERT INTO market_taxonomy (sport, market_key, display_name, category, bet_type, sort_order, aliases) VALUES
('NFL', 'PASS_YDS', 'Passing Yards', 'passing', 'player_prop', 1, ARRAY['passing yards', 'pass yds']),
('NFL', 'PASS_TD', 'Passing TDs', 'passing', 'player_prop', 2, ARRAY['passing touchdowns', 'pass td']),
('NFL', 'PASS_ATT', 'Pass Attempts', 'passing', 'player_prop', 3, ARRAY['pass attempts']),
('NFL', 'PASS_COMP', 'Completions', 'passing', 'player_prop', 4, ARRAY['completions']),
('NFL', 'INT', 'Interceptions Thrown', 'passing', 'player_prop', 5, ARRAY['interceptions', 'int']),
('NFL', 'RUSH_YDS', 'Rushing Yards', 'rushing', 'player_prop', 6, ARRAY['rushing yards', 'rush yds']),
('NFL', 'RUSH_ATT', 'Rush Attempts', 'rushing', 'player_prop', 7, ARRAY['rush attempts', 'carries']),
('NFL', 'RUSH_TD', 'Rushing TDs', 'rushing', 'player_prop', 8, ARRAY['rushing touchdowns']),
('NFL', 'REC', 'Receptions', 'receiving', 'player_prop', 9, ARRAY['receptions', 'catches']),
('NFL', 'REC_YDS', 'Receiving Yards', 'receiving', 'player_prop', 10, ARRAY['receiving yards', 'rec yds']),
('NFL', 'REC_TD', 'Receiving TDs', 'receiving', 'player_prop', 11, ARRAY['receiving touchdowns']),
('NFL', 'TARGETS', 'Targets', 'receiving', 'player_prop', 12, ARRAY['targets']),
('NFL', 'LONGEST_REC', 'Longest Reception', 'receiving', 'player_prop', 13, ARRAY['longest reception']),
('NFL', 'LONGEST_RUSH', 'Longest Rush', 'rushing', 'player_prop', 14, ARRAY['longest rush'])
ON CONFLICT (sport, market_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  aliases = EXCLUDED.aliases,
  updated_at = NOW();

-- Seed MLB markets
INSERT INTO market_taxonomy (sport, market_key, display_name, category, bet_type, sort_order, aliases) VALUES
('MLB', 'H', 'Hits', 'batting', 'player_prop', 1, ARRAY['hits']),
('MLB', 'HR', 'Home Runs', 'batting', 'player_prop', 2, ARRAY['home runs', 'homers']),
('MLB', 'RBI', 'RBIs', 'batting', 'player_prop', 3, ARRAY['rbis', 'runs batted in']),
('MLB', 'R', 'Runs', 'batting', 'player_prop', 4, ARRAY['runs', 'runs scored']),
('MLB', 'TB', 'Total Bases', 'batting', 'player_prop', 5, ARRAY['total bases']),
('MLB', 'SB', 'Stolen Bases', 'batting', 'player_prop', 6, ARRAY['stolen bases', 'steals']),
('MLB', 'BB', 'Walks', 'batting', 'player_prop', 7, ARRAY['walks', 'bases on balls']),
('MLB', 'K_BATTER', 'Strikeouts (Batter)', 'batting', 'player_prop', 8, ARRAY['strikeouts batter']),
('MLB', 'K', 'Strikeouts (Pitcher)', 'pitching', 'player_prop', 9, ARRAY['strikeouts', 'ks']),
('MLB', 'ER', 'Earned Runs Allowed', 'pitching', 'player_prop', 10, ARRAY['earned runs']),
('MLB', 'OUTS', 'Outs Recorded', 'pitching', 'player_prop', 11, ARRAY['outs', 'innings']),
('MLB', 'HITS_ALLOWED', 'Hits Allowed', 'pitching', 'player_prop', 12, ARRAY['hits allowed'])
ON CONFLICT (sport, market_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  aliases = EXCLUDED.aliases,
  updated_at = NOW();

-- Seed NHL markets
INSERT INTO market_taxonomy (sport, market_key, display_name, category, bet_type, sort_order, aliases) VALUES
('NHL', 'G', 'Goals', 'scoring', 'player_prop', 1, ARRAY['goals']),
('NHL', 'A', 'Assists', 'scoring', 'player_prop', 2, ARRAY['assists']),
('NHL', 'PTS', 'Points (G+A)', 'scoring', 'player_prop', 3, ARRAY['points']),
('NHL', 'SOG', 'Shots on Goal', 'shooting', 'player_prop', 4, ARRAY['shots on goal', 'shots']),
('NHL', 'SAVES', 'Saves (Goalie)', 'goaltending', 'player_prop', 5, ARRAY['saves']),
('NHL', 'GAA', 'Goals Against', 'goaltending', 'player_prop', 6, ARRAY['goals against']),
('NHL', 'BLOCKED', 'Blocked Shots', 'defense', 'player_prop', 7, ARRAY['blocked shots']),
('NHL', 'HITS', 'Hits', 'physicality', 'player_prop', 8, ARRAY['hits'])
ON CONFLICT (sport, market_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  aliases = EXCLUDED.aliases,
  updated_at = NOW();

-- Create the versioned view for the contract surface
CREATE OR REPLACE VIEW market_taxonomy_v1 AS
SELECT
  id,
  sport,
  market_key,
  display_name,
  category,
  bet_type,
  sort_order,
  aliases,
  -- Contract metadata
  '1.0.0'::TEXT AS contract_version,
  updated_at AS last_updated
FROM market_taxonomy
WHERE active = true
ORDER BY sport, sort_order;

GRANT SELECT ON market_taxonomy TO authenticated, anon, service_role;
GRANT SELECT ON market_taxonomy_v1 TO authenticated, anon, service_role;

COMMENT ON TABLE market_taxonomy IS
'SPRINT-059: Authoritative market/stat type reference. Smart Form MUST use market_taxonomy_v1 view.';
COMMENT ON VIEW market_taxonomy_v1 IS
'CONTRACT-V1: Smart Form market taxonomy surface. Version 1.0.0.';

-- =============================================================================
-- 2. catalog_teams_v1 - Team catalog contract surface
-- =============================================================================

CREATE OR REPLACE VIEW catalog_teams_v1 AS
SELECT
  t.id AS team_id,
  t.name AS team_name,
  t.abbr AS team_abbr,
  t.sport,
  t.team_uuid AS external_team_id,
  t.logo_url,
  COALESCE(t.meta->>'aliases', '[]')::jsonb AS aliases,
  -- Search optimization
  LOWER(t.name) || ' ' || COALESCE(LOWER(t.abbr), '') AS search_text,
  -- Contract metadata
  '1.0.0'::TEXT AS contract_version,
  t.updated_at AS last_updated
FROM teams t
WHERE NOT COALESCE((t.meta->>'deprecated')::boolean, false);

-- Create index for search if not exists (on source table)
CREATE INDEX IF NOT EXISTS idx_teams_search_contract
  ON teams (sport, name)
  WHERE NOT COALESCE((meta->>'deprecated')::boolean, false);

GRANT SELECT ON catalog_teams_v1 TO authenticated, anon, service_role;

COMMENT ON VIEW catalog_teams_v1 IS
'CONTRACT-V1: Smart Form team catalog surface. Columns are stable and versioned.';

-- =============================================================================
-- 3. catalog_players_v1 - Player catalog contract surface
-- =============================================================================
-- CRITICAL: Derives player_name from full_name. No direct table access allowed.

CREATE OR REPLACE VIEW catalog_players_v1 AS
SELECT
  p.id AS player_id,
  p.full_name AS player_name,        -- STABLE: Always exposed as player_name
  p.sport,
  p.team_id,
  t.name AS team_name,
  t.abbr AS team_abbr,
  p.position,
  p.headshot_url,
  COALESCE(p.meta->>'aliases', '[]')::jsonb AS aliases,
  COALESCE((p.meta->>'external_player_id')::text, p.id::text) AS external_player_id,
  -- Search optimization
  LOWER(p.full_name) || ' ' ||
    COALESCE(LOWER(t.name), '') || ' ' ||
    COALESCE(LOWER(t.abbr), '') || ' ' ||
    COALESCE(LOWER(p.meta->>'aliases'), '') AS search_text,
  -- Contract metadata
  '1.0.0'::TEXT AS contract_version,
  p.updated_at AS last_updated
FROM players p
LEFT JOIN teams t ON p.team_id = t.id
WHERE COALESCE(p.active, true) = true;

-- Ensure index on full_name for search
CREATE INDEX IF NOT EXISTS idx_players_full_name_trgm_contract
  ON players USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_players_sport_team_contract
  ON players (sport, team_id)
  WHERE COALESCE(active, true) = true;

GRANT SELECT ON catalog_players_v1 TO authenticated, anon, service_role;

COMMENT ON VIEW catalog_players_v1 IS
'CONTRACT-V1: Smart Form player catalog surface. player_name derived from full_name. Stable columns.';

-- =============================================================================
-- 4. inventory_props_for_form_v1 - Props inventory contract surface
-- =============================================================================
-- Wraps raw_props with stable, versioned columns for Smart Form consumption.
-- This is the ONLY way Smart Form should access prop data.

CREATE OR REPLACE VIEW inventory_props_for_form_v1 AS
SELECT
  rp.id AS prop_id,
  rp.sport,
  -- Game context
  rp.game_id,
  g.start_time,
  g.game_date,
  COALESCE(g.away_team || ' @ ' || g.home_team, 'TBD') AS matchup,
  g.home_team,
  g.away_team,
  -- Player context
  rp.player_name,
  rp.team AS team_abbr,
  -- Market details
  rp.stat_type AS market_key,         -- Normalized to market_key for contract
  rp.line,
  rp.over_odds,
  rp.under_odds,
  COALESCE(rp.source, 'unknown') AS book,
  -- Unique key for deduplication
  rp.sport || ':' || COALESCE(rp.player_name, '') || ':' || COALESCE(rp.stat_type, '') || ':' || COALESCE(rp.line::text, '') AS prop_key,
  -- Display helpers
  rp.player_name || ' ' || rp.stat_type || ' ' || COALESCE(rp.line::text, '') AS display_label,
  -- Contract metadata
  '1.0.0'::TEXT AS contract_version,
  rp.created_at AS last_updated
FROM raw_props rp
LEFT JOIN games g ON rp.game_id = g.id
WHERE rp.game_date >= CURRENT_DATE
  AND rp.game_date <= CURRENT_DATE + INTERVAL '7 days'
  AND rp.line IS NOT NULL
  -- Filter out bet types that are not player props
  AND LOWER(COALESCE(rp.stat_type, '')) NOT IN ('moneyline', 'spread', 'total', 'over', 'under', 'ml', 'pk');

-- Indexes for efficient filtering
-- Note: Cannot use CURRENT_DATE in partial index (not immutable)
-- Use simple partial index on line IS NOT NULL instead
CREATE INDEX IF NOT EXISTS idx_raw_props_contract_sport_player
  ON raw_props (sport, player_name, stat_type, game_date)
  WHERE line IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_raw_props_contract_sport_date
  ON raw_props (sport, game_date)
  WHERE line IS NOT NULL;

GRANT SELECT ON inventory_props_for_form_v1 TO authenticated, anon, service_role;

COMMENT ON VIEW inventory_props_for_form_v1 IS
'CONTRACT-V1: Smart Form props inventory surface. Stable columns: prop_id, sport, game_id, start_time, matchup, player_name, team_abbr, market_key, line, odds, book, last_updated, prop_key.';

-- =============================================================================
-- 5. CONTRACT VERIFICATION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION verify_smartform_contracts()
RETURNS TABLE (
  surface_name TEXT,
  status TEXT,
  row_count BIGINT,
  required_columns TEXT[],
  missing_columns TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_missing TEXT[];
BEGIN
  -- Check catalog_players_v1
  SELECT ARRAY(
    SELECT unnest(ARRAY['player_id', 'player_name', 'sport', 'team_id', 'team_name', 'team_abbr', 'search_text', 'contract_version'])
    EXCEPT
    SELECT column_name FROM information_schema.columns WHERE table_name = 'catalog_players_v1'
  ) INTO v_missing;

  RETURN QUERY SELECT
    'catalog_players_v1'::TEXT,
    CASE WHEN array_length(v_missing, 1) IS NULL THEN 'PASS' ELSE 'FAIL' END,
    (SELECT COUNT(*) FROM catalog_players_v1),
    ARRAY['player_id', 'player_name', 'sport', 'team_id', 'team_name', 'team_abbr', 'search_text', 'contract_version'],
    COALESCE(v_missing, ARRAY[]::TEXT[]);

  -- Check catalog_teams_v1
  SELECT ARRAY(
    SELECT unnest(ARRAY['team_id', 'team_name', 'team_abbr', 'sport', 'search_text', 'contract_version'])
    EXCEPT
    SELECT column_name FROM information_schema.columns WHERE table_name = 'catalog_teams_v1'
  ) INTO v_missing;

  RETURN QUERY SELECT
    'catalog_teams_v1'::TEXT,
    CASE WHEN array_length(v_missing, 1) IS NULL THEN 'PASS' ELSE 'FAIL' END,
    (SELECT COUNT(*) FROM catalog_teams_v1),
    ARRAY['team_id', 'team_name', 'team_abbr', 'sport', 'search_text', 'contract_version'],
    COALESCE(v_missing, ARRAY[]::TEXT[]);

  -- Check inventory_props_for_form_v1
  SELECT ARRAY(
    SELECT unnest(ARRAY['prop_id', 'sport', 'game_id', 'start_time', 'matchup', 'player_name', 'team_abbr', 'market_key', 'line', 'over_odds', 'under_odds', 'book', 'prop_key', 'contract_version'])
    EXCEPT
    SELECT column_name FROM information_schema.columns WHERE table_name = 'inventory_props_for_form_v1'
  ) INTO v_missing;

  RETURN QUERY SELECT
    'inventory_props_for_form_v1'::TEXT,
    CASE WHEN array_length(v_missing, 1) IS NULL THEN 'PASS' ELSE 'FAIL' END,
    (SELECT COUNT(*) FROM inventory_props_for_form_v1),
    ARRAY['prop_id', 'sport', 'game_id', 'start_time', 'matchup', 'player_name', 'team_abbr', 'market_key', 'line', 'over_odds', 'under_odds', 'book', 'prop_key', 'contract_version'],
    COALESCE(v_missing, ARRAY[]::TEXT[]);

  -- Check market_taxonomy_v1
  SELECT ARRAY(
    SELECT unnest(ARRAY['sport', 'market_key', 'display_name', 'category', 'bet_type', 'sort_order', 'contract_version'])
    EXCEPT
    SELECT column_name FROM information_schema.columns WHERE table_name = 'market_taxonomy_v1'
  ) INTO v_missing;

  RETURN QUERY SELECT
    'market_taxonomy_v1'::TEXT,
    CASE WHEN array_length(v_missing, 1) IS NULL THEN 'PASS' ELSE 'FAIL' END,
    (SELECT COUNT(*) FROM market_taxonomy_v1),
    ARRAY['sport', 'market_key', 'display_name', 'category', 'bet_type', 'sort_order', 'contract_version'],
    COALESCE(v_missing, ARRAY[]::TEXT[]);
END;
$$;

GRANT EXECUTE ON FUNCTION verify_smartform_contracts() TO service_role;

COMMENT ON FUNCTION verify_smartform_contracts() IS
'SPRINT-059: Verifies all Smart Form contract surfaces exist with required columns.';

-- =============================================================================
-- 6. VERIFICATION
-- =============================================================================

DO $$
DECLARE
  v_result RECORD;
  v_all_pass BOOLEAN := true;
BEGIN
  RAISE NOTICE 'SPRINT-059: Verifying contract surfaces...';

  FOR v_result IN SELECT * FROM verify_smartform_contracts() LOOP
    IF v_result.status = 'FAIL' THEN
      v_all_pass := false;
      RAISE WARNING 'FAIL: % missing columns: %', v_result.surface_name, v_result.missing_columns;
    ELSE
      RAISE NOTICE 'PASS: % (% rows)', v_result.surface_name, v_result.row_count;
    END IF;
  END LOOP;

  IF NOT v_all_pass THEN
    RAISE EXCEPTION 'SPRINT-059: Contract verification FAILED';
  END IF;

  RAISE NOTICE 'SPRINT-059: All contract surfaces verified successfully';
END $$;

-- Count market taxonomy entries
DO $$
DECLARE
  nba_count INTEGER;
  nfl_count INTEGER;
  mlb_count INTEGER;
  nhl_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO nba_count FROM market_taxonomy_v1 WHERE sport = 'NBA';
  SELECT COUNT(*) INTO nfl_count FROM market_taxonomy_v1 WHERE sport = 'NFL';
  SELECT COUNT(*) INTO mlb_count FROM market_taxonomy_v1 WHERE sport = 'MLB';
  SELECT COUNT(*) INTO nhl_count FROM market_taxonomy_v1 WHERE sport = 'NHL';

  RAISE NOTICE 'Market taxonomy counts: NBA=%, NFL=%, MLB=%, NHL=%', nba_count, nfl_count, mlb_count, nhl_count;

  IF nba_count < 10 THEN
    RAISE EXCEPTION 'Expected 10+ NBA markets, found %', nba_count;
  END IF;
END $$;

-- Reload PostgREST schema
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

SELECT
  'SPRINT-SMARTFORM-DATA-CONTRACTS-INVENTORY-SURFACE-059: Migration complete' as status,
  NOW() as completed_at,
  '1.0.0' as contract_version;
