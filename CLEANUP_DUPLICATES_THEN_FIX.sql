-- ============================================================================
-- STEP 1: Clean up existing duplicates before creating unique constraints
-- ============================================================================
-- ERROR: Cannot create unique index because duplicates already exist
-- SOLUTION: Delete duplicates, keeping only the most recent record
-- ============================================================================

BEGIN;

-- Step 1: Delete duplicate player props, keeping only the most recent
WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY external_game_id, external_prop_id
      ORDER BY created_at DESC
    ) as rn
  FROM unified_picks
  WHERE external_prop_id IS NOT NULL
)
DELETE FROM unified_picks
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 2: Delete duplicate core markets, keeping only the most recent
WITH core_duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY source, market, selection, bookmaker_key, game_date, COALESCE(line, 0)
      ORDER BY created_at DESC
    ) as rn
  FROM unified_picks
  WHERE external_prop_id IS NULL
)
DELETE FROM unified_picks
WHERE id IN (
  SELECT id FROM core_duplicates WHERE rn > 1
);

-- Step 3: Drop the problematic unique constraint
DROP INDEX IF EXISTS idx_unified_picks_external_ids;

-- Step 4: Create partial unique index for player props only
CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_picks_player_props_dedup
ON unified_picks (external_game_id, external_prop_id)
WHERE external_prop_id IS NOT NULL;

-- Step 5: Create composite unique index for core markets
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

-- 1. Check for remaining duplicates in player props
SELECT
  external_game_id,
  external_prop_id,
  COUNT(*) as duplicate_count
FROM unified_picks
WHERE external_prop_id IS NOT NULL
GROUP BY external_game_id, external_prop_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- 2. Check for remaining duplicates in core markets
SELECT
  source,
  market,
  selection,
  bookmaker_key,
  game_date,
  COALESCE(line, 0) as line,
  COUNT(*) as duplicate_count
FROM unified_picks
WHERE external_prop_id IS NULL
GROUP BY source, market, selection, bookmaker_key, game_date, COALESCE(line, 0)
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- 3. Verify both indexes were created successfully
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

-- 4. Check total picks remaining after cleanup
SELECT
  COUNT(*) as total_picks,
  COUNT(CASE WHEN external_prop_id IS NOT NULL THEN 1 END) as player_props,
  COUNT(CASE WHEN external_prop_id IS NULL THEN 1 END) as core_markets
FROM unified_picks;
