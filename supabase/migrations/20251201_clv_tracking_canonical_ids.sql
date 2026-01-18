-- Add canonical entity references to clv_tracking table
-- Migration: 20251201_clv_tracking_canonical_ids.sql
-- Purpose: Link CLV tracking to canonical entities for multi-feed analysis

-- This migration adds canonical_game_id and canonical_player_id to clv_tracking
-- to enable cross-source CLV analysis and better closing line accuracy

BEGIN;

-- Step 1: Add canonical_game_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clv_tracking' AND column_name = 'canonical_game_id'
  ) THEN
    ALTER TABLE clv_tracking
    ADD COLUMN canonical_game_id UUID REFERENCES canonical_games(id) ON DELETE SET NULL;

    RAISE NOTICE 'Added canonical_game_id column to clv_tracking';
  ELSE
    RAISE NOTICE 'canonical_game_id column already exists on clv_tracking';
  END IF;
END $$;

-- Step 2: Add canonical_player_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clv_tracking' AND column_name = 'canonical_player_id'
  ) THEN
    ALTER TABLE clv_tracking
    ADD COLUMN canonical_player_id UUID REFERENCES canonical_players(id) ON DELETE SET NULL;

    RAISE NOTICE 'Added canonical_player_id column to clv_tracking';
  ELSE
    RAISE NOTICE 'canonical_player_id column already exists on clv_tracking';
  END IF;
END $$;

-- Step 3: Create index on canonical_game_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_clv_tracking_canonical_game_id
  ON clv_tracking(canonical_game_id);

-- Step 4: Create index on canonical_player_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_clv_tracking_canonical_player_id
  ON clv_tracking(canonical_player_id);

-- Step 5: Create composite index for canonical entity queries
CREATE INDEX IF NOT EXISTS idx_clv_tracking_canonical_entities
  ON clv_tracking(canonical_game_id, canonical_player_id, submitted_at DESC);

-- Step 6: Create composite index for canonical player CLV analysis
CREATE INDEX IF NOT EXISTS idx_clv_tracking_player_clv
  ON clv_tracking(canonical_player_id, clv_percentage DESC NULLS LAST)
  WHERE beat_closing_line = true;

-- Step 7: Create composite index for canonical game CLV analysis
CREATE INDEX IF NOT EXISTS idx_clv_tracking_game_clv
  ON clv_tracking(canonical_game_id, clv_percentage DESC NULLS LAST)
  WHERE beat_closing_line = true;

-- Step 8: Add helpful comments
COMMENT ON COLUMN clv_tracking.canonical_game_id IS
  'References canonical_games(id). Enables multi-source CLV analysis for the same game across different data feeds.';

COMMENT ON COLUMN clv_tracking.canonical_player_id IS
  'References canonical_players(id). Enables multi-source CLV analysis for the same player across different data feeds and name variations.';

-- Step 9: Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Verification queries (run manually after migration):
--
-- 1. Check new columns exist:
--    SELECT column_name, data_type
--    FROM information_schema.columns
--    WHERE table_name = 'clv_tracking'
--      AND column_name IN ('canonical_game_id', 'canonical_player_id');
--
-- 2. Check indexes exist:
--    SELECT indexname
--    FROM pg_indexes
--    WHERE tablename = 'clv_tracking'
--      AND indexname LIKE '%canonical%';
--
-- 3. Check foreign key constraints:
--    SELECT conname, contype
--    FROM pg_constraint
--    WHERE conrelid = 'clv_tracking'::regclass
--      AND conname LIKE '%canonical%';
--
-- 4. Sample query: CLV by canonical player across all sources
--    SELECT
--      cp.full_name,
--      COUNT(*) AS total_picks,
--      COUNT(CASE WHEN clv.beat_closing_line THEN 1 END) AS beat_count,
--      AVG(clv.clv_percentage) AS avg_clv_pct
--    FROM clv_tracking clv
--    JOIN canonical_players cp ON cp.id = clv.canonical_player_id
--    WHERE clv.canonical_player_id IS NOT NULL
--    GROUP BY cp.id, cp.full_name
--    ORDER BY avg_clv_pct DESC NULLS LAST
--    LIMIT 20;

-- ============================================================================
-- FORCE POSTGREST SCHEMA RELOAD (Charter-mandated)
-- ============================================================================
-- Trigger PostgREST to reload its schema cache
-- This ensures canonical tables are immediately visible via REST API
SELECT pg_notify('pgrst', 'reload schema');
