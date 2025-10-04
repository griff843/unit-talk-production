-- ============================================================================
-- FIX: Drop the CORRECT constraint name and create proper partial indexes
-- ============================================================================
-- ISSUE: Previous script tried to drop "idx_unified_picks_external_ids"
--        but the actual constraint is named "ux_unified_picks_dedup"
-- ============================================================================

BEGIN;

-- Step 1: Drop the ACTUAL problematic constraint (correct name)
DROP INDEX IF EXISTS ux_unified_picks_dedup;

-- Step 2: Also drop if the old name exists
DROP INDEX IF EXISTS idx_unified_picks_external_ids;

-- Step 3: Create partial unique index for player props only
-- This allows multiple NULL external_prop_id values for the same game
CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_picks_player_props_dedup
ON unified_picks (external_game_id, external_prop_id)
WHERE external_prop_id IS NOT NULL;

-- Step 4: Create composite unique index for core markets
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
-- VERIFICATION QUERIES
-- ============================================================================

-- 1. Verify the old constraint is gone
SELECT indexname
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND indexname = 'ux_unified_picks_dedup';
-- Expected: 0 rows

-- 2. Verify both new indexes exist
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND (indexname LIKE '%dedup%')
ORDER BY indexname;
-- Expected output:
-- idx_unified_picks_core_markets_dedup
-- idx_unified_picks_player_props_dedup

-- 3. Test insert capability (won't actually insert, just check)
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
  line,
  odds,
  posted_at,
  bookmaker_key,
  sport,
  metadata
) VALUES (
  '7ce2ba1f-459f-47cf-ab06-dc3566a847c6',
  'single',
  'Test Team',
  1,
  2.0,
  'odds-api',
  'test-game-id',
  NULL,
  'h2h',
  'Test Matchup',
  '2025-10-03T00:00:00Z',
  NULL,
  -110,
  NOW(),
  'draftkings',
  'NFL',
  '{}'::jsonb
);
-- This just shows the query plan, doesn't actually insert
