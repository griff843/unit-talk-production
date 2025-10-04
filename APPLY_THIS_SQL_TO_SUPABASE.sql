-- ========================================
-- COPY THIS SQL AND RUN IT IN SUPABASE SQL EDITOR
-- ========================================
-- Go to: https://supabase.com/dashboard/project/lxqmuzmqtnnlpfapvief/sql
-- Paste this entire file and click "Run"
-- ========================================

-- Step 1: Drop the old constraint that blocks multiple bookmakers
DROP INDEX IF EXISTS public.idx_unified_picks_external_ids;

-- Step 2: Ensure metadata column exists (stores bookmaker info)
ALTER TABLE public.unified_picks
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Step 3: Create new unique constraint that includes bookmaker_key
-- This allows DraftKings, FanDuel, BetMGM, Caesars odds for the same prop
CREATE UNIQUE INDEX idx_unified_picks_unique_per_bookmaker
  ON public.unified_picks (
    external_game_id,
    external_prop_id,
    market,
    COALESCE((metadata->>'bookmaker_key')::text, 'unknown')
  );

-- Step 4: Create supporting indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_unified_picks_game_market
  ON public.unified_picks (external_game_id, market);

CREATE INDEX IF NOT EXISTS idx_unified_picks_bookmaker
  ON public.unified_picks ((metadata->>'bookmaker_key'));

-- Step 5: Add helpful comment
COMMENT ON INDEX idx_unified_picks_unique_per_bookmaker IS
  'Allows multiple bookmakers per prop - REQUIRED for devigging, line shopping, and professional betting features.';

-- ========================================
-- VERIFICATION QUERY (run after to confirm)
-- ========================================
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND schemaname = 'public'
ORDER BY indexname;

-- You should see idx_unified_picks_unique_per_bookmaker in the results
