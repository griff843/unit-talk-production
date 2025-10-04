-- ============================================================================
-- Drop idx_unified_picks_final_unique - it conflicts with our partial indexes
-- ============================================================================
-- ISSUE: idx_unified_picks_final_unique is blocking inserts
-- REASON: It uses metadata->>'bookmaker_key' which might not match bookmaker_key column
--         AND it doesn't distinguish between player props and core markets
-- SOLUTION: Drop it - we already have proper dedup via:
--           - idx_unified_picks_player_props_dedup (for player props)
--           - idx_unified_picks_core_markets_dedup (for core markets)
-- ============================================================================

BEGIN;

-- Drop the conflicting constraint
DROP INDEX IF EXISTS idx_unified_picks_final_unique;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Confirm it's gone
SELECT indexname
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND indexname = 'idx_unified_picks_final_unique';
-- Expected: 0 rows

-- Verify our good constraints are still there
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND indexname IN (
    'idx_unified_picks_player_props_dedup',
    'idx_unified_picks_core_markets_dedup'
  )
ORDER BY indexname;
-- Expected: 2 rows
