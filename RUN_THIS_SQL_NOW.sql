-- ============================================================================
-- COPY THIS ENTIRE FILE AND RUN IN SUPABASE SQL EDITOR
-- URL: https://supabase.com/dashboard/project/lxqmuzmqtnnlpfapvief/sql
-- ============================================================================

-- Step 1: Make external_prop_id nullable
-- (Market picks like h2h, spreads, totals don't have prop IDs)
ALTER TABLE public.unified_picks
  ALTER COLUMN external_prop_id DROP NOT NULL;

-- Step 2: Drop old bookmaker constraint
DROP INDEX IF EXISTS public.idx_unified_picks_unique_per_bookmaker;

-- Step 3: Create new unique index that allows multiple bookmakers
-- This allows DraftKings, FanDuel, BetMGM, Caesars for the same prop
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

-- Step 4: Supporting indexes for query performance
CREATE INDEX IF NOT EXISTS idx_unified_picks_game_market
  ON public.unified_picks (external_game_id, market);

CREATE INDEX IF NOT EXISTS idx_unified_picks_bookmaker
  ON public.unified_picks ((metadata->>'bookmaker_key'));

-- ============================================================================
-- VERIFICATION: Run this to confirm it worked
-- ============================================================================
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND (indexname LIKE '%unique%' OR indexname LIKE '%bookmaker%')
ORDER BY indexname;

-- You should see:
-- - idx_unified_picks_unique_per_bookmaker_v2
-- - idx_unified_picks_bookmaker
-- - idx_unified_picks_game_market
