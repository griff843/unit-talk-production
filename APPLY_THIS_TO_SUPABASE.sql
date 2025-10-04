-- ============================================================================
-- FIX: NFL Props Error 23505 - Duplicate Key Violation
-- ============================================================================
-- PROBLEM: All 188 NFL props from 49ers vs Rams being rejected with error 23505
-- ROOT CAUSE: Unique index idx_unified_picks_external_ids doesn't handle NULL
--             values properly. All core markets (h2h, spreads, totals) have
--             external_prop_id=NULL, causing constraint violations.
--
-- SOLUTION: Drop the bad constraint and create proper partial indexes
-- ============================================================================

BEGIN;

-- Step 1: Drop the problematic unique constraint
DROP INDEX IF EXISTS idx_unified_picks_external_ids;

-- Step 2: Create partial unique index for player props only
-- This allows multiple NULL external_prop_id values for the same game
CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_picks_player_props_dedup
ON unified_picks (external_game_id, external_prop_id)
WHERE external_prop_id IS NOT NULL;

-- Step 3: Create composite unique index for core markets
-- Prevents duplicate entries for same market/selection/bookmaker/line
CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_picks_core_markets_dedup
ON unified_picks (
  source,
  market,
  selection,
  bookmaker_key,
  game_date,
  COALESCE(line, 0)
)
WHERE external_prop_id IS NULL;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this to confirm both indexes were created successfully
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND (indexname LIKE '%dedup%' OR indexname LIKE '%external%')
ORDER BY indexname;

-- Expected output:
-- idx_unified_picks_core_markets_dedup
-- idx_unified_picks_player_props_dedup
