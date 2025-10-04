-- ==================================================================
-- FINAL FIX V2: Allow multiple bookmakers + handle NULL external_prop_id
-- ==================================================================
-- Based on actual schema: uses 'selection' and 'outcome' columns
-- ==================================================================

-- Step 1: Make external_prop_id nullable (market picks don't have prop IDs)
ALTER TABLE public.unified_picks
  ALTER COLUMN external_prop_id DROP NOT NULL;

-- Step 2: Drop the current bookmaker constraint
DROP INDEX IF EXISTS public.idx_unified_picks_unique_per_bookmaker;

-- Step 3: Create TWO partial unique indexes

-- Index A: For player props (external_prop_id IS NOT NULL)
CREATE UNIQUE INDEX idx_unified_picks_unique_player_props
  ON public.unified_picks (
    external_game_id,
    external_prop_id,
    market,
    COALESCE((metadata->>'bookmaker_key')::text, 'unknown')
  )
  WHERE external_prop_id IS NOT NULL;

-- Index B: For market picks (external_prop_id IS NULL)
-- Use selection (team name) + line for uniqueness
-- For h2h: selection="Boston Red Sox", line=null
-- For spreads: selection="Yankees", line=-1.5
-- For totals: outcome="Over", line=8.5
CREATE UNIQUE INDEX idx_unified_picks_unique_market_picks
  ON public.unified_picks (
    external_game_id,
    market,
    COALESCE(selection, ''),
    COALESCE(outcome, ''),
    COALESCE(line, 0),
    COALESCE((metadata->>'bookmaker_key')::text, 'unknown')
  )
  WHERE external_prop_id IS NULL;

-- Step 4: Add comments
COMMENT ON INDEX idx_unified_picks_unique_player_props IS
  'Player props: One pick per bookmaker using external_prop_id';

COMMENT ON INDEX idx_unified_picks_unique_market_picks IS
  'Market picks (h2h/spreads/totals): One pick per bookmaker using selection+outcome+line';

-- Step 5: Keep supporting indexes
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
