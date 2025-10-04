-- ============================================================================
-- FINAL FIX WITH SELECTION - Includes selection field for market picks
-- ============================================================================

-- Drop current constraint
DROP INDEX IF EXISTS public.idx_unified_picks_bookmaker_unique;

-- Create new unique index that includes selection for team picks
-- For h2h: selection="Boston Red Sox", bookmaker="draftkings"
-- For spreads: selection="Yankees", bookmaker="fanduel"
-- For player props: external_prop_id identifies the prop
CREATE UNIQUE INDEX idx_unified_picks_complete_unique
  ON public.unified_picks (
    external_game_id,
    COALESCE(external_prop_id, ''),
    market,
    COALESCE(selection, ''),
    COALESCE((metadata->>'bookmaker_key')::text, 'unknown')
  );

-- Verification
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks' AND indexname LIKE '%unique%';
