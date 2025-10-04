-- ============================================================================
-- Find which constraint is blocking the inserts
-- ============================================================================

-- Test the exact insert that's failing
-- Using the sample row from the error logs

-- First, check if there's already a matching record
SELECT
  id,
  external_game_id,
  external_prop_id,
  market,
  selection,
  odds,
  metadata->>'bookmaker_key' as bookmaker_from_metadata,
  bookmaker_key as bookmaker_from_column,
  created_at
FROM unified_picks
WHERE external_game_id = 'c4b72eabb3d557e73022ec730d8e3944'
  AND market = 'h2h'
  AND selection = 'Los Angeles Rams';

-- Check the idx_unified_picks_final_unique constraint
-- This constraint uses: (external_game_id, COALESCE(external_prop_id, ''), market, COALESCE(selection, ''), COALESCE(odds, 0), COALESCE(metadata->>'bookmaker_key', 'unknown'))

SELECT
  external_game_id,
  COALESCE(external_prop_id, '') as prop_id_coalesced,
  market,
  COALESCE(selection, '') as selection_coalesced,
  COALESCE(odds, 0) as odds_coalesced,
  COALESCE(metadata->>'bookmaker_key', 'unknown') as bookmaker_coalesced,
  COUNT(*) as count
FROM unified_picks
GROUP BY
  external_game_id,
  COALESCE(external_prop_id, ''),
  market,
  COALESCE(selection, ''),
  COALESCE(odds, 0),
  COALESCE(metadata->>'bookmaker_key', 'unknown')
HAVING COUNT(*) > 1;

-- Show all unique constraints on unified_picks
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND indexdef LIKE '%UNIQUE%'
ORDER BY indexname;
