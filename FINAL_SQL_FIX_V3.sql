-- ==================================================================
-- FINAL FIX V3: Simple approach - just fix the constraint
-- ==================================================================
-- Don't guess columns - use only columns we KNOW exist from migration
-- ==================================================================

-- Step 1: Make external_prop_id nullable (market picks don't have it)
ALTER TABLE public.unified_picks
  ALTER COLUMN external_prop_id DROP NOT NULL;

-- Step 2: Drop the current bookmaker constraint
DROP INDEX IF EXISTS public.idx_unified_picks_unique_per_bookmaker;

-- Step 3: Create simple unique index for ALL picks
-- Include bookmaker_key to allow multiple bookmakers
-- For player props: external_prop_id uniquely identifies the prop
-- For market picks: external_prop_id will be NULL, so use market + matchup + line
CREATE UNIQUE INDEX idx_unified_picks_unique_per_bookmaker_v2
  ON public.unified_picks (
    external_game_id,
    market,
    COALESCE(external_prop_id, ''),
    COALESCE(player_name, ''),
    COALESCE(team, ''),
    COALESCE(line, 0),
    COALESCE((metadata->>'bookmaker_key')::text, 'unknown')
  );

-- Step 4: Keep supporting indexes
CREATE INDEX IF NOT EXISTS idx_unified_picks_game_market
  ON public.unified_picks (external_game_id, market);

CREATE INDEX IF NOT EXISTS idx_unified_picks_bookmaker
  ON public.unified_picks ((metadata->>'bookmaker_key'));

-- ==================================================================
-- VERIFICATION
-- ==================================================================
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND (indexname LIKE '%unique%' OR indexname LIKE '%bookmaker%')
ORDER BY indexname;
