-- ============================================================================
-- COMPLETE FIX - Includes odds to handle price changes
-- ============================================================================

-- Drop current constraint
DROP INDEX IF EXISTS public.idx_unified_picks_complete_unique;

-- Create final unique index including odds
-- This handles cases where same pick has different odds (price movements)
CREATE UNIQUE INDEX idx_unified_picks_final_unique
  ON public.unified_picks (
    external_game_id,
    COALESCE(external_prop_id, ''),
    market,
    COALESCE(selection, ''),
    COALESCE(odds, 0),
    COALESCE((metadata->>'bookmaker_key')::text, 'unknown')
  );

-- Verification
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks' AND indexname LIKE '%unique%';
