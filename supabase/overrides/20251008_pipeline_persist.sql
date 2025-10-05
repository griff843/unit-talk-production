-- ============================================================================
-- Pipeline Persistence Migration: Normalize & Score
-- Date: October 8, 2025
-- Purpose: Enable raw_props → unified_picks → scored_props persistence
-- ============================================================================

-- ============================================================================
-- 1. UNIQUE INDEXES FOR IDEMPOTENT UPSERTS
-- ============================================================================

-- unified_picks: deterministic dedupe key
-- Allows safe re-normalization without duplicates
CREATE UNIQUE INDEX IF NOT EXISTS ux_unified_picks_dedupe
  ON public.unified_picks (
    sport,
    market,
    COALESCE(player_name, ''),
    game_date::date,
    COALESCE(bookmaker_key, ''),
    COALESCE(line::text, ''),
    COALESCE(selection, '')
  );

COMMENT ON INDEX ux_unified_picks_dedupe IS 'Deterministic dedupe key for normalizer upserts';

-- scored_props: one score per pick
-- Ensures we can update scores without creating duplicates
CREATE UNIQUE INDEX IF NOT EXISTS ux_scored_props_prop_ref
  ON public.scored_props (prop_ref);

COMMENT ON INDEX ux_scored_props_prop_ref IS 'One score per unified pick';

-- ============================================================================
-- 2. PERFORMANCE INDEXES FOR BATCH QUERIES
-- ============================================================================

-- Index for finding un-normalized props
CREATE INDEX IF NOT EXISTS idx_raw_props_unnormalized
  ON public.raw_props (game_date DESC, created_at DESC)
  WHERE promoted_to_picks = FALSE AND is_valid = TRUE;

COMMENT ON INDEX idx_raw_props_unnormalized IS 'Fast lookup for props needing normalization';

-- Index for finding unscored picks
CREATE INDEX IF NOT EXISTS idx_unified_picks_unscored
  ON public.unified_picks (game_date DESC, created_at DESC)
  WHERE scored_at IS NULL;

COMMENT ON INDEX idx_unified_picks_unscored IS 'Fast lookup for picks needing scoring';

-- Index for stale scores (need re-scoring)
CREATE INDEX IF NOT EXISTS idx_scored_props_stale
  ON public.scored_props (updated_at ASC)
  WHERE updated_at < NOW() - INTERVAL '15 minutes';

COMMENT ON INDEX idx_scored_props_stale IS 'Fast lookup for stale scores needing refresh';

-- ============================================================================
-- 3. HELPER FUNCTION: Generate Dedupe Key
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_dedupe_key(
  p_external_prop_id TEXT,
  p_sport TEXT,
  p_market TEXT,
  p_player_name TEXT,
  p_game_date DATE,
  p_bookmaker_key TEXT,
  p_line NUMERIC,
  p_selection TEXT
)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT COALESCE(
    p_external_prop_id,
    CONCAT_WS(':',
      p_sport,
      p_market,
      COALESCE(p_player_name, ''),
      p_game_date::TEXT,
      COALESCE(p_bookmaker_key, ''),
      COALESCE(p_line::TEXT, ''),
      COALESCE(p_selection, '')
    )
  );
$$;

COMMENT ON FUNCTION public.generate_dedupe_key IS 'Deterministic key for raw_props → unified_picks deduplication';

-- ============================================================================
-- 4. REFRESH POSTGREST SCHEMA CACHE
-- ============================================================================

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT 'Pipeline persistence migration complete' AS status,
       '20251008_pipeline_persist.sql' AS migration,
       NOW() AS applied_at;
