-- =====================================================
-- Phase 1 Schema Alignment: Team ID Columns (Part 4 URGENT FIX)
-- =====================================================
--
-- Purpose: Add missing home_team_id and away_team_id columns
-- These are nullable INT columns set to NULL by the ingestion code
--
-- Run Time: ~5 seconds
-- Safe: Nullable columns, idempotent
--
-- =====================================================

BEGIN;

-- Add home_team_id column (nullable INT, set to null by code)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'home_team_id'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN home_team_id INT;
    RAISE NOTICE 'Added home_team_id column';
  ELSE
    RAISE NOTICE 'home_team_id already exists';
  END IF;
END $$;

-- Add away_team_id column (nullable INT, set to null by code)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'away_team_id'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN away_team_id INT;
    RAISE NOTICE 'Added away_team_id column';
  ELSE
    RAISE NOTICE 'away_team_id already exists';
  END IF;
END $$;

-- Add column comments for documentation
COMMENT ON COLUMN raw_props.home_team_id IS
  'Nullable foreign key to teams table (future). Currently always NULL.';

COMMENT ON COLUMN raw_props.away_team_id IS
  'Nullable foreign key to teams table (future). Currently always NULL.';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

-- =====================================================
-- PART 4 COMPLETE - ALL SCHEMA ISSUES RESOLVED
-- =====================================================
--
-- Now run: npx tsx apps/api/scripts/live-fire-phase1-ingestion-simple.ts
--
-- =====================================================
