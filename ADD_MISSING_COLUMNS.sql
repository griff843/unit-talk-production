-- ============================================================================
-- ADD MISSING COLUMNS - selection and odds if they don't exist
-- ============================================================================

-- Add selection column (team/player name for the pick)
ALTER TABLE public.unified_picks
  ADD COLUMN IF NOT EXISTS selection TEXT;

-- Add odds column (American odds format)
ALTER TABLE public.unified_picks
  ADD COLUMN IF NOT EXISTS odds INTEGER;

-- Verify columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'unified_picks'
  AND column_name IN ('selection', 'odds', 'metadata')
ORDER BY column_name;
