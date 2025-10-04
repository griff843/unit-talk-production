-- ============================================================================
-- ABSOLUTE MINIMAL FIX - Only uses columns guaranteed to exist
-- ============================================================================

-- Step 1: Make external_prop_id nullable
ALTER TABLE public.unified_picks
  ALTER COLUMN external_prop_id DROP NOT NULL;

-- Step 2: Drop old constraint
DROP INDEX IF EXISTS public.idx_unified_picks_unique_per_bookmaker;

-- Step 3: Simple unique index using ONLY external IDs + bookmaker
-- This is the absolute minimum to allow multiple bookmakers
CREATE UNIQUE INDEX idx_unified_picks_bookmaker_unique
  ON public.unified_picks (
    external_game_id,
    COALESCE(external_prop_id, ''),
    market,
    COALESCE((metadata->>'bookmaker_key')::text,
             COALESCE((meta->>'bookmaker_key')::text, 'unknown'))
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks' AND indexname LIKE '%bookmaker%';
