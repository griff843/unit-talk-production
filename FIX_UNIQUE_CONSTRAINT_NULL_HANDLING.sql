-- ========================================
-- FIX: Handle NULL external_prop_id in unique constraint
-- ========================================
-- Problem: external_prop_id is NULL for market picks (h2h, spreads, totals)
-- PostgreSQL unique constraints treat NULL values specially
-- We need to ensure uniqueness for BOTH player props AND market picks
-- ========================================

-- Step 1: Drop the current constraint
DROP INDEX IF EXISTS public.idx_unified_picks_unique_per_bookmaker;

-- Step 2: Create TWO separate unique constraints

-- Constraint A: For player props (where external_prop_id IS NOT NULL)
CREATE UNIQUE INDEX idx_unified_picks_unique_player_props
  ON public.unified_picks (
    external_game_id,
    external_prop_id,
    market,
    COALESCE((metadata->>'bookmaker_key')::text, 'unknown')
  )
  WHERE external_prop_id IS NOT NULL;

-- Constraint B: For market picks (where external_prop_id IS NULL)
-- Use outcome and line for uniqueness instead
CREATE UNIQUE INDEX idx_unified_picks_unique_market_picks
  ON public.unified_picks (
    external_game_id,
    market,
    outcome,
    line,
    COALESCE((metadata->>'bookmaker_key')::text, 'unknown')
  )
  WHERE external_prop_id IS NULL;

-- Step 3: Add helpful comments
COMMENT ON INDEX idx_unified_picks_unique_player_props IS
  'Ensures one pick per bookmaker for player props (using external_prop_id)';

COMMENT ON INDEX idx_unified_picks_unique_market_picks IS
  'Ensures one pick per bookmaker for market picks like h2h, spreads, totals (using outcome + line)';

-- ========================================
-- VERIFICATION
-- ========================================
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND indexname LIKE '%unique%'
ORDER BY indexname;
