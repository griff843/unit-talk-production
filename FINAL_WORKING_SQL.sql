-- ============================================================================
-- FINAL WORKING SQL - Uses only columns that exist in actual database
-- ============================================================================

-- Step 1: Make external_prop_id nullable
ALTER TABLE public.unified_picks
  ALTER COLUMN external_prop_id DROP NOT NULL;

-- Step 2: Drop old bookmaker constraint
DROP INDEX IF EXISTS public.idx_unified_picks_unique_per_bookmaker;

-- Step 3: Create new unique index using only core fields
-- This is the minimal set that ensures uniqueness while allowing multiple bookmakers
CREATE UNIQUE INDEX idx_unified_picks_unique_per_bookmaker_final
  ON public.unified_picks (
    external_game_id,
    market,
    COALESCE(external_prop_id, ''),
    COALESCE(matchup, ''),
    COALESCE(line, 0),
    COALESCE((meta->>'bookmaker_key')::text,
             COALESCE((metadata->>'bookmaker_key')::text, 'unknown'))
  );

-- Step 4: Supporting indexes
CREATE INDEX IF NOT EXISTS idx_unified_picks_game_market
  ON public.unified_picks (external_game_id, market);

CREATE INDEX IF NOT EXISTS idx_unified_picks_bookmaker_meta
  ON public.unified_picks ((meta->>'bookmaker_key'));

CREATE INDEX IF NOT EXISTS idx_unified_picks_bookmaker_metadata
  ON public.unified_picks ((metadata->>'bookmaker_key'));

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND indexname LIKE '%bookmaker%'
ORDER BY indexname;
