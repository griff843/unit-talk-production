-- =====================================================
-- Phase 1 Schema Alignment: raw_props Column Completion
-- =====================================================
--
-- Purpose: Add missing columns to raw_props that are required by the production
-- ingestion pipeline (OddsApiClient, CanonicalMappingService, FeedAgent).
--
-- This migration consolidates columns from multiple previous migrations that
-- were not applied to Supabase:
--   - 20251127_phase15_raw_props_event_time_and_game_link.sql (event_time, home_team, away_team, etc.)
--   - Additional fields required by OddsApiClient conversion logic
--
-- Root Cause: Supabase schema was missing critical columns that the code
-- expects, causing "Could not find the 'away_team' column" errors during
-- Phase 1 ingestion.
--
-- Author: Engineering Team
-- Date: 2025-12-11
-- Context: Phase 1 Live-Fire Ingestion Unblocking
--
-- SAFETY: All operations use IF NOT EXISTS guards - safe to run multiple times.
--
-- =====================================================

BEGIN;

-- =====================================================
-- PART 1: GAME IDENTIFICATION COLUMNS
-- =====================================================

-- Step 1: Add home_team column (CRITICAL - causing current failure)
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

-- Step 2: Add away_team column (CRITICAL - paired with home_team)
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

-- Step 3: Add opponent column (derived field, used in some queries)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'opponent'
  ) THEN
    ALTER TABLE raw_props
    ADD COLUMN opponent TEXT;

    RAISE NOTICE 'Added opponent column to raw_props';
  ELSE
    RAISE NOTICE 'opponent column already exists on raw_props';
  END IF;
END $$;

-- =====================================================
-- PART 2: TIMING AND EVENT COLUMNS
-- =====================================================

-- Step 4: Add event_time column (for game start time in UTC)
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

-- Step 5: Add scraped_at column (ingestion timestamp)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'scraped_at'
  ) THEN
    ALTER TABLE raw_props
    ADD COLUMN scraped_at TIMESTAMPTZ DEFAULT NOW();

    RAISE NOTICE 'Added scraped_at column to raw_props';
  ELSE
    RAISE NOTICE 'scraped_at column already exists on raw_props';
  END IF;
END $$;

-- =====================================================
-- PART 3: LEAGUE AND SPORT IDENTIFIERS
-- =====================================================

-- Step 6: Add sport_key column (Odds API sport key)
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

-- Step 7: Add league column (human-readable league name)
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

-- Step 8: Add matchup column (formatted matchup string)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'matchup'
  ) THEN
    ALTER TABLE raw_props
    ADD COLUMN matchup TEXT;

    RAISE NOTICE 'Added matchup column to raw_props';
  ELSE
    RAISE NOTICE 'matchup column already exists on raw_props';
  END IF;
END $$;

-- =====================================================
-- PART 4: EXTERNAL IDENTIFIERS
-- =====================================================

-- Step 9: Add external_game_id column (Odds API game ID)
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

-- Step 10: Add external_id column (general external identifier)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'external_id'
  ) THEN
    ALTER TABLE raw_props
    ADD COLUMN external_id TEXT;

    RAISE NOTICE 'Added external_id column to raw_props';
  ELSE
    RAISE NOTICE 'external_id column already exists on raw_props';
  END IF;
END $$;

-- Step 11: Add unique_key column (composite deduplication key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'unique_key'
  ) THEN
    ALTER TABLE raw_props
    ADD COLUMN unique_key TEXT;

    RAISE NOTICE 'Added unique_key column to raw_props';
  ELSE
    RAISE NOTICE 'unique_key column already exists on raw_props';
  END IF;
END $$;

-- =====================================================
-- PART 5: MARKET AND BETTING COLUMNS
-- =====================================================

-- Step 12: Add market column (bookmaker/sportsbook name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'market'
  ) THEN
    ALTER TABLE raw_props
    ADD COLUMN market TEXT;

    RAISE NOTICE 'Added market column to raw_props';
  ELSE
    RAISE NOTICE 'market column already exists on raw_props';
  END IF;
END $$;

-- Step 13: Add bet_type column (moneyline, spread, total, etc.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'bet_type'
  ) THEN
    ALTER TABLE raw_props
    ADD COLUMN bet_type TEXT;

    RAISE NOTICE 'Added bet_type column to raw_props';
  ELSE
    RAISE NOTICE 'bet_type column already exists on raw_props';
  END IF;
END $$;

-- Step 14: Add selection column (outcome selection, e.g. "over", "under", team name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'selection'
  ) THEN
    ALTER TABLE raw_props
    ADD COLUMN selection TEXT;

    RAISE NOTICE 'Added selection column to raw_props';
  ELSE
    RAISE NOTICE 'selection column already exists on raw_props';
  END IF;
END $$;

-- =====================================================
-- PART 6: PERFORMANCE INDEXES
-- =====================================================

-- Index 1: event_time for date-based queries
CREATE INDEX IF NOT EXISTS idx_raw_props_event_time
  ON raw_props(event_time);

-- Index 2: league + event_time for reality checks
CREATE INDEX IF NOT EXISTS idx_raw_props_league_event_time
  ON raw_props(league, event_time);

-- Index 3: sport_key for filtering
CREATE INDEX IF NOT EXISTS idx_raw_props_sport_key
  ON raw_props(sport_key);

-- Index 4: external_game_id for game linkage
CREATE INDEX IF NOT EXISTS idx_raw_props_external_game_id
  ON raw_props(external_game_id);

-- Index 5: home_team + away_team for game matching
CREATE INDEX IF NOT EXISTS idx_raw_props_teams
  ON raw_props(home_team, away_team);

-- Index 6: unique_key for deduplication
CREATE INDEX IF NOT EXISTS idx_raw_props_unique_key
  ON raw_props(unique_key);

-- =====================================================
-- PART 7: COLUMN COMMENTS (DOCUMENTATION)
-- =====================================================

COMMENT ON COLUMN raw_props.home_team IS
  'Home team name. Used for canonical game mapping and game identification.';

COMMENT ON COLUMN raw_props.away_team IS
  'Away team name. Used for canonical game mapping and game identification.';

COMMENT ON COLUMN raw_props.opponent IS
  'Opponent team name (relative to player/team). Derived field for convenience queries.';

COMMENT ON COLUMN raw_props.event_time IS
  'Game start time from Odds API (UTC). Used for reality alignment validation and date filtering.';

COMMENT ON COLUMN raw_props.scraped_at IS
  'Timestamp when this prop was ingested from external source. Used for freshness tracking.';

COMMENT ON COLUMN raw_props.sport_key IS
  'Odds API sport key (e.g., americanfootball_nfl, basketball_nba). Maps to league via SUPPORTED_SPORTS.';

COMMENT ON COLUMN raw_props.league IS
  'Human-readable league name (e.g., NFL, NBA, MLB). Derived from sport_key via SUPPORTED_SPORTS mapping.';

COMMENT ON COLUMN raw_props.matchup IS
  'Formatted matchup string (e.g., "Patriots @ Chiefs"). Used for display and grouping.';

COMMENT ON COLUMN raw_props.external_game_id IS
  'Odds API game ID. Links to canonical_games via game_mappings table.';

COMMENT ON COLUMN raw_props.external_id IS
  'General external identifier from data provider. Used for deduplication.';

COMMENT ON COLUMN raw_props.unique_key IS
  'Composite deduplication key (game_id + market + outcome + bookmaker). Prevents duplicate ingestion.';

COMMENT ON COLUMN raw_props.market IS
  'Bookmaker/sportsbook name (e.g., "DraftKings", "FanDuel"). Used for line shopping.';

COMMENT ON COLUMN raw_props.bet_type IS
  'Type of bet (e.g., "moneyline", "spread", "total", "player_prop"). Used for bet classification.';

COMMENT ON COLUMN raw_props.selection IS
  'Outcome selection (e.g., "over", "under", team name, player name). Represents the betted outcome.';

-- =====================================================
-- PART 8: NOTIFY POSTGREST TO RELOAD SCHEMA
-- =====================================================

-- Critical: PostgREST must reload its schema cache to see new columns
NOTIFY pgrst, 'reload schema';

COMMIT;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
--
-- Verification queries:
--
-- 1. Check all new columns exist:
--    SELECT column_name, data_type, is_nullable
--    FROM information_schema.columns
--    WHERE table_name = 'raw_props'
--      AND column_name IN ('home_team', 'away_team', 'event_time', 'sport_key', 'league', 'matchup', 'external_game_id', 'opponent', 'scraped_at', 'external_id', 'unique_key', 'market', 'bet_type', 'selection')
--    ORDER BY column_name;
--
-- 2. Check indexes exist:
--    SELECT indexname
--    FROM pg_indexes
--    WHERE tablename = 'raw_props'
--      AND indexname LIKE 'idx_raw_props_%'
--    ORDER BY indexname;
--
-- 3. Test insert (run after schema verification):
--    INSERT INTO raw_props (id, home_team, away_team, event_time, sport_key, league, matchup)
--    VALUES (gen_random_uuid(), 'Test Home', 'Test Away', NOW(), 'basketball_nba', 'NBA', 'Test Away @ Test Home')
--    RETURNING id;
--
-- =====================================================
