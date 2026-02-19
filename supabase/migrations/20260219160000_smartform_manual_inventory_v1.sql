-- =============================================================================
-- SPRINT-SMARTFORM-DATA-CONTRACTS-MANUAL-INVENTORY-059
-- Manual Inventory Contract Surface for Smart Form
-- =============================================================================
-- Contract: docs/contracts/SMARTFORM_DATA_CONTRACT_V1.md
-- Created: 2026-02-19
-- Version: 1.0.1
-- =============================================================================
--
-- PRINCIPLE: Smart Form must work WITHOUT dependency on live prop feeds.
--            The manual_inventory_for_form_v1 view derives suggestions from
--            internal manual submissions (unified_picks).
--
-- NEW SURFACES:
--   1. manual_inventory_for_form_v1 - Props suggestions from manual submissions
--
-- UPDATES:
--   1. market_taxonomy - Add missing NBA combo markets (PR, PA, RA)
--
-- =============================================================================

-- =============================================================================
-- 1. Add missing NBA combo markets to market_taxonomy
-- =============================================================================
-- User requested: PTS, REB, AST, 3PM, PRA, PR, PA, RA, BLK, STL, TO

INSERT INTO market_taxonomy (sport, market_key, display_name, category, bet_type, sort_order, aliases) VALUES
('NBA', 'PR', 'Pts+Reb', 'combo', 'player_prop', 13, ARRAY['pr', 'points rebounds', 'pts+reb']),
('NBA', 'PA', 'Pts+Ast', 'combo', 'player_prop', 14, ARRAY['pa', 'points assists', 'pts+ast']),
('NBA', 'RA', 'Reb+Ast', 'combo', 'player_prop', 15, ARRAY['ra', 'rebounds assists', 'reb+ast'])
ON CONFLICT (sport, market_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  aliases = EXCLUDED.aliases,
  updated_at = NOW();

-- =============================================================================
-- 2. manual_inventory_for_form_v1 - Suggestions from manual submissions
-- =============================================================================
-- This view aggregates historical manual submissions from unified_picks to
-- provide "suggestion" data for the Smart Form. This allows the form to work
-- without dependency on live prop feeds.
--
-- Columns:
--   sport, player_id, player_name, team_abbr, market_key,
--   avg_line, min_line, max_line, avg_odds,
--   count_recent, last_seen_at, contract_version

CREATE OR REPLACE VIEW manual_inventory_for_form_v1 AS
WITH recent_picks AS (
  -- Get picks from the last 30 days for relevant suggestions
  SELECT
    up.sport,
    up.player_id,
    -- Use player_name from unified_picks or fall back to players table
    COALESCE(up.player_name, p.full_name) AS player_name,
    COALESCE(t.abbr, '') AS team_abbr,
    UPPER(COALESCE(up.stat_type, '')) AS market_key,
    up.line,
    up.odds,
    up.created_at
  FROM unified_picks up
  LEFT JOIN players p ON up.player_id::uuid = p.id
  LEFT JOIN teams t ON p.team_id = t.id
  WHERE up.created_at >= NOW() - INTERVAL '30 days'
    AND up.stat_type IS NOT NULL
    AND up.stat_type != ''
    -- Filter to player props (stat_type should be a market key like PTS, REB, AST)
    AND UPPER(up.stat_type) NOT IN ('MONEYLINE', 'SPREAD', 'TOTAL', 'OVER', 'UNDER', 'ML', 'PK')
)
SELECT
  rp.sport,
  rp.player_id,
  rp.player_name,
  rp.team_abbr,
  rp.market_key,
  -- Line statistics
  ROUND(AVG(rp.line)::numeric, 1) AS avg_line,
  MIN(rp.line) AS min_line,
  MAX(rp.line) AS max_line,
  -- Odds statistics
  ROUND(AVG(rp.odds)::numeric, 0)::integer AS avg_odds,
  -- Usage metrics
  COUNT(*)::integer AS count_recent,
  MAX(rp.created_at) AS last_seen_at,
  -- Contract metadata
  '1.0.1'::TEXT AS contract_version
FROM recent_picks rp
WHERE rp.player_name IS NOT NULL
GROUP BY
  rp.sport,
  rp.player_id,
  rp.player_name,
  rp.team_abbr,
  rp.market_key
ORDER BY
  rp.sport,
  COUNT(*) DESC,
  MAX(rp.created_at) DESC;

-- Create indexes on unified_picks for efficient aggregation
CREATE INDEX IF NOT EXISTS idx_unified_picks_manual_inventory
  ON unified_picks (sport, player_id, stat_type, created_at DESC)
  WHERE stat_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_unified_picks_recent_30d
  ON unified_picks (created_at)
  WHERE created_at >= NOW() - INTERVAL '30 days';

GRANT SELECT ON manual_inventory_for_form_v1 TO authenticated, anon, service_role;

COMMENT ON VIEW manual_inventory_for_form_v1 IS
'CONTRACT-V1.0.1: Smart Form manual inventory surface. Derives prop suggestions from unified_picks submissions. Stable columns: sport, player_id, player_name, team_abbr, market_key, avg_line, min_line, max_line, avg_odds, count_recent, last_seen_at, contract_version.';

-- =============================================================================
-- 3. market_usage_stats_v1 - Track market usage for sorting stat types
-- =============================================================================
-- This view aggregates market usage from manual submissions to help sort
-- the stat types dropdown by popularity.

CREATE OR REPLACE VIEW market_usage_stats_v1 AS
SELECT
  sport,
  UPPER(stat_type) AS market_key,
  COUNT(*)::integer AS usage_count,
  COUNT(DISTINCT player_id)::integer AS unique_players,
  MAX(created_at) AS last_used_at,
  '1.0.1'::TEXT AS contract_version
FROM unified_picks
WHERE stat_type IS NOT NULL
  AND stat_type != ''
  AND created_at >= NOW() - INTERVAL '90 days'
  AND UPPER(stat_type) NOT IN ('MONEYLINE', 'SPREAD', 'TOTAL', 'OVER', 'UNDER', 'ML', 'PK')
GROUP BY sport, UPPER(stat_type)
ORDER BY sport, COUNT(*) DESC;

CREATE INDEX IF NOT EXISTS idx_unified_picks_market_usage
  ON unified_picks (sport, stat_type)
  WHERE stat_type IS NOT NULL;

GRANT SELECT ON market_usage_stats_v1 TO authenticated, anon, service_role;

COMMENT ON VIEW market_usage_stats_v1 IS
'CONTRACT-V1.0.1: Market usage statistics for sorting stat types by popularity.';

-- =============================================================================
-- 4. UPDATE CONTRACT VERIFICATION FUNCTION
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

  -- Check manual_inventory_for_form_v1
  SELECT ARRAY(
    SELECT unnest(ARRAY['sport', 'player_id', 'player_name', 'team_abbr', 'market_key', 'avg_line', 'count_recent', 'last_seen_at', 'contract_version'])
    EXCEPT
    SELECT column_name FROM information_schema.columns WHERE table_name = 'manual_inventory_for_form_v1'
  ) INTO v_missing;

  RETURN QUERY SELECT
    'manual_inventory_for_form_v1'::TEXT,
    CASE WHEN array_length(v_missing, 1) IS NULL THEN 'PASS' ELSE 'FAIL' END,
    (SELECT COUNT(*) FROM manual_inventory_for_form_v1),
    ARRAY['sport', 'player_id', 'player_name', 'team_abbr', 'market_key', 'avg_line', 'count_recent', 'last_seen_at', 'contract_version'],
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

  -- Check market_usage_stats_v1
  SELECT ARRAY(
    SELECT unnest(ARRAY['sport', 'market_key', 'usage_count', 'unique_players', 'last_used_at', 'contract_version'])
    EXCEPT
    SELECT column_name FROM information_schema.columns WHERE table_name = 'market_usage_stats_v1'
  ) INTO v_missing;

  RETURN QUERY SELECT
    'market_usage_stats_v1'::TEXT,
    CASE WHEN array_length(v_missing, 1) IS NULL THEN 'PASS' ELSE 'FAIL' END,
    (SELECT COUNT(*) FROM market_usage_stats_v1),
    ARRAY['sport', 'market_key', 'usage_count', 'unique_players', 'last_used_at', 'contract_version'],
    COALESCE(v_missing, ARRAY[]::TEXT[]);

END;
$$;

-- =============================================================================
-- 5. VERIFICATION
-- =============================================================================

DO $$
DECLARE
  nba_market_count INTEGER;
BEGIN
  -- Verify NBA markets include required set
  SELECT COUNT(*) INTO nba_market_count
  FROM market_taxonomy
  WHERE sport = 'NBA'
    AND market_key IN ('PTS', 'REB', 'AST', '3PM', 'PRA', 'PR', 'PA', 'RA', 'BLK', 'STL', 'TO');

  IF nba_market_count < 11 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected 11 NBA markets, found %', nba_market_count;
  END IF;

  RAISE NOTICE 'SPRINT-059-MANUAL: All verifications passed. NBA markets: %', nba_market_count;
END $$;
