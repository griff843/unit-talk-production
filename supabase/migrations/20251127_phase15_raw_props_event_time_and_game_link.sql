-- Phase 15: Add event_time and improve game linkage for raw_props
-- Migration: 20251127_phase15_raw_props_event_time_and_game_link.sql
-- Purpose: Enable date-based filtering and reality alignment validation
-- Reality Check: Ensure props can be verified against real-world sports calendar

BEGIN;

-- Step 1: Add event_time column to raw_props if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'event_time'
  ) THEN
    ALTER TABLE raw_props
    ADD COLUMN event_time TIMESTAMPTZ;

    RAISE NOTICE 'Added event_time column to raw_props';
  ELSE
    RAISE NOTICE 'event_time column already exists on raw_props';
  END IF;
END $$;

-- Step 2: Add sport_key column if it doesn't exist (for league identification)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'sport_key'
  ) THEN
    ALTER TABLE raw_props
    ADD COLUMN sport_key TEXT;

    RAISE NOTICE 'Added sport_key column to raw_props';
  ELSE
    RAISE NOTICE 'sport_key column already exists on raw_props';
  END IF;
END $$;

-- Step 3: Add league column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'league'
  ) THEN
    ALTER TABLE raw_props
    ADD COLUMN league TEXT;

    RAISE NOTICE 'Added league column to raw_props';
  ELSE
    RAISE NOTICE 'league column already exists on raw_props';
  END IF;
END $$;

-- Step 4: Add external_game_id for tracking Odds API game IDs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'external_game_id'
  ) THEN
    ALTER TABLE raw_props
    ADD COLUMN external_game_id TEXT;

    RAISE NOTICE 'Added external_game_id column to raw_props';
  ELSE
    RAISE NOTICE 'external_game_id column already exists on raw_props';
  END IF;
END $$;

-- Step 5: Add home_team and away_team for game identification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'home_team'
  ) THEN
    ALTER TABLE raw_props
    ADD COLUMN home_team TEXT;

    RAISE NOTICE 'Added home_team column to raw_props';
  ELSE
    RAISE NOTICE 'home_team column already exists on raw_props';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'away_team'
  ) THEN
    ALTER TABLE raw_props
    ADD COLUMN away_team TEXT;

    RAISE NOTICE 'Added away_team column to raw_props';
  ELSE
    RAISE NOTICE 'away_team column already exists on raw_props';
  END IF;
END $$;

-- Step 6: Create index on event_time for date-based queries
CREATE INDEX IF NOT EXISTS idx_raw_props_event_time
  ON raw_props(event_time);

-- Step 7: Create composite index on league + event_time for reality checks
CREATE INDEX IF NOT EXISTS idx_raw_props_league_event_time
  ON raw_props(league, event_time);

-- Step 8: Create index on sport_key for filtering
CREATE INDEX IF NOT EXISTS idx_raw_props_sport_key
  ON raw_props(sport_key);

-- Step 9: Create index on external_game_id for game linkage
CREATE INDEX IF NOT EXISTS idx_raw_props_external_game_id
  ON raw_props(external_game_id);

-- Step 10: Add comment explaining the reality alignment purpose
COMMENT ON COLUMN raw_props.event_time IS
  'Game start time from Odds API (UTC). Used for reality alignment validation (e.g., ensure NFL>0 and MLB=0 on Thanksgiving).';

COMMENT ON COLUMN raw_props.sport_key IS
  'Odds API sport key (e.g., americanfootball_nfl, baseball_mlb). Maps to league via SUPPORTED_SPORTS.';

COMMENT ON COLUMN raw_props.league IS
  'Human-readable league name (e.g., NFL, MLB, NBA). Derived from sport_key via SUPPORTED_SPORTS mapping.';

COMMENT ON COLUMN raw_props.external_game_id IS
  'Odds API game ID. Links to games table or used for game identification.';

-- Step 11: Notify PostgREST to reload schema (if applicable)
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Verification queries (run manually after migration)
-- 1. Check new columns exist:
--    SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'raw_props' AND column_name IN ('event_time', 'sport_key', 'league', 'external_game_id', 'home_team', 'away_team');
--
-- 2. Check indexes exist:
--    SELECT indexname FROM pg_indexes WHERE tablename = 'raw_props' AND indexname LIKE 'idx_raw_props_%';
--
-- 3. Reality alignment test (after ingestion):
--    SELECT league, DATE(event_time) AS game_date, COUNT(*) AS props_count
--    FROM raw_props
--    WHERE event_time IS NOT NULL
--    GROUP BY league, DATE(event_time)
--    ORDER BY league, game_date;
