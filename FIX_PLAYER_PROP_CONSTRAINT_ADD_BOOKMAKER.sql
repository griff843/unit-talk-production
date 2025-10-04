-- ============================================================================
-- FIX: Add bookmaker_key to player props unique constraint
-- ============================================================================
-- ISSUE: idx_unified_picks_player_props_dedup uses (external_game_id, external_prop_id)
--        but external_prop_id doesn't include bookmaker, so DraftKings and FanDuel
--        props for the same player have identical external_prop_id values
-- SOLUTION: Include bookmaker_key in the unique constraint
-- ============================================================================

BEGIN;

-- Drop the current player props constraint
DROP INDEX IF EXISTS idx_unified_picks_player_props_dedup;

-- Create new constraint that includes bookmaker_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_picks_player_props_dedup
ON unified_picks (external_game_id, external_prop_id, bookmaker_key)
WHERE external_prop_id IS NOT NULL;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify the new constraint includes bookmaker_key
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND indexname = 'idx_unified_picks_player_props_dedup';
-- Expected: shows (external_game_id, external_prop_id, bookmaker_key)

-- Test that we can now insert same prop from different bookmakers
EXPLAIN
INSERT INTO unified_picks (
  user_id,
  pick_type,
  selection,
  stake,
  potential_payout,
  source,
  external_game_id,
  external_prop_id,
  market,
  matchup,
  game_date,
  odds,
  posted_at,
  bookmaker_key,
  sport,
  metadata
) VALUES
  -- Same prop, different bookmaker - should work now
  (
    '7ce2ba1f-459f-47cf-ab06-dc3566a847c6',
    'single',
    'Test Player',
    1,
    2.0,
    'odds-api',
    'test-game',
    'test-game_player_pass_yds_Test Player',
    'player_pass_yds',
    'Test Matchup',
    '2025-10-03T00:00:00Z',
    -110,
    NOW(),
    'draftkings',
    'NFL',
    '{}'::jsonb
  ),
  (
    '7ce2ba1f-459f-47cf-ab06-dc3566a847c6',
    'single',
    'Test Player',
    1,
    2.0,
    'odds-api',
    'test-game',
    'test-game_player_pass_yds_Test Player',
    'player_pass_yds',
    'Test Matchup',
    '2025-10-03T00:00:00Z',
    -110,
    NOW(),
    'fanduel',  -- Different bookmaker
    'NFL',
    '{}'::jsonb
  );
-- This just shows the query plan, doesn't actually insert
