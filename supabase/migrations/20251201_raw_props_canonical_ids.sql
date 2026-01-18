-- Add canonical entity references to raw_props table
-- Migration: 20251201_raw_props_canonical_ids.sql
-- Purpose: Link raw_props to canonical entities for multi-feed mapping

-- This migration adds canonical_game_id and canonical_player_id to raw_props
-- to enable multi-source entity resolution and tracking

BEGIN;

-- Step 1: Add canonical_game_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'canonical_game_id'
  ) THEN
    ALTER TABLE raw_props
    ADD COLUMN canonical_game_id UUID REFERENCES canonical_games(id) ON DELETE SET NULL;

    RAISE NOTICE 'Added canonical_game_id column to raw_props';
  ELSE
    RAISE NOTICE 'canonical_game_id column already exists on raw_props';
  END IF;
END $$;

-- Step 2: Add canonical_player_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'canonical_player_id'
  ) THEN
    ALTER TABLE raw_props
    ADD COLUMN canonical_player_id UUID REFERENCES canonical_players(id) ON DELETE SET NULL;

    RAISE NOTICE 'Added canonical_player_id column to raw_props';
  ELSE
    RAISE NOTICE 'canonical_player_id column already exists on raw_props';
  END IF;
END $$;

-- Step 3: Create index on canonical_game_id for lookups
CREATE INDEX IF NOT EXISTS idx_raw_props_canonical_game_id
  ON raw_props(canonical_game_id);

-- Step 4: Create index on canonical_player_id for lookups
CREATE INDEX IF NOT EXISTS idx_raw_props_canonical_player_id
  ON raw_props(canonical_player_id);

-- Step 5: Create composite index for game + player canonical queries
CREATE INDEX IF NOT EXISTS idx_raw_props_canonical_entities
  ON raw_props(canonical_game_id, canonical_player_id);

-- Step 6: Add helpful comments
COMMENT ON COLUMN raw_props.canonical_game_id IS
  'References canonical_games(id). Links this prop to the canonical game entity for multi-feed tracking.';

COMMENT ON COLUMN raw_props.canonical_player_id IS
  'References canonical_players(id). Links this prop to the canonical player entity for name normalization and multi-feed tracking.';

-- Step 7: Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Verification queries (run manually after migration):
--
-- 1. Check new columns exist:
--    SELECT column_name, data_type
--    FROM information_schema.columns
--    WHERE table_name = 'raw_props'
--      AND column_name IN ('canonical_game_id', 'canonical_player_id');
--
-- 2. Check indexes exist:
--    SELECT indexname
--    FROM pg_indexes
--    WHERE tablename = 'raw_props'
--      AND indexname LIKE 'idx_raw_props_canonical%';
--
-- 3. Check foreign key constraints:
--    SELECT conname, contype
--    FROM pg_constraint
--    WHERE conrelid = 'raw_props'::regclass
--      AND conname LIKE '%canonical%';

-- ============================================================================
-- FORCE POSTGREST SCHEMA RELOAD (Charter-mandated)
-- ============================================================================
-- Trigger PostgREST to reload its schema cache
-- This ensures canonical tables are immediately visible via REST API
SELECT pg_notify('pgrst', 'reload schema');
