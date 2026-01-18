-- =====================================================
-- Phase 1 Schema Alignment: raw_props Columns (Part 1 of 3)
-- =====================================================
--
-- Purpose: Add missing columns to raw_props (COLUMNS ONLY)
-- This is Part 1 - adds columns without indexes or comments
--
-- Run Time: ~10-15 seconds
-- Safe: Idempotent, transaction-wrapped
--
-- =====================================================

BEGIN;

-- =====================================================
-- GAME IDENTIFICATION COLUMNS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'home_team'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN home_team TEXT;
    RAISE NOTICE 'Added home_team column';
  ELSE
    RAISE NOTICE 'home_team already exists';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'away_team'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN away_team TEXT;
    RAISE NOTICE 'Added away_team column';
  ELSE
    RAISE NOTICE 'away_team already exists';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'opponent'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN opponent TEXT;
    RAISE NOTICE 'Added opponent column';
  ELSE
    RAISE NOTICE 'opponent already exists';
  END IF;
END $$;

-- =====================================================
-- TIMING COLUMNS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'event_time'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN event_time TIMESTAMPTZ;
    RAISE NOTICE 'Added event_time column';
  ELSE
    RAISE NOTICE 'event_time already exists';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'scraped_at'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN scraped_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Added scraped_at column';
  ELSE
    RAISE NOTICE 'scraped_at already exists';
  END IF;
END $$;

-- =====================================================
-- SPORT/LEAGUE COLUMNS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'sport_key'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN sport_key TEXT;
    RAISE NOTICE 'Added sport_key column';
  ELSE
    RAISE NOTICE 'sport_key already exists';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'league'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN league TEXT;
    RAISE NOTICE 'Added league column';
  ELSE
    RAISE NOTICE 'league already exists';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'matchup'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN matchup TEXT;
    RAISE NOTICE 'Added matchup column';
  ELSE
    RAISE NOTICE 'matchup already exists';
  END IF;
END $$;

-- =====================================================
-- EXTERNAL ID COLUMNS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'external_game_id'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN external_game_id TEXT;
    RAISE NOTICE 'Added external_game_id column';
  ELSE
    RAISE NOTICE 'external_game_id already exists';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'external_id'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN external_id TEXT;
    RAISE NOTICE 'Added external_id column';
  ELSE
    RAISE NOTICE 'external_id already exists';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'unique_key'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN unique_key TEXT;
    RAISE NOTICE 'Added unique_key column';
  ELSE
    RAISE NOTICE 'unique_key already exists';
  END IF;
END $$;

-- =====================================================
-- MARKET COLUMNS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'market'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN market TEXT;
    RAISE NOTICE 'Added market column';
  ELSE
    RAISE NOTICE 'market already exists';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'bet_type'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN bet_type TEXT;
    RAISE NOTICE 'Added bet_type column';
  ELSE
    RAISE NOTICE 'bet_type already exists';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'selection'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN selection TEXT;
    RAISE NOTICE 'Added selection column';
  ELSE
    RAISE NOTICE 'selection already exists';
  END IF;
END $$;

COMMIT;

-- =====================================================
-- PART 1 COMPLETE
-- =====================================================
-- Next step: Run Part 2 to create indexes
