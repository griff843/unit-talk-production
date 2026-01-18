-- =====================================================
-- Phase 1 Schema Alignment: Finalize (Part 3 of 3)
-- =====================================================
--
-- Purpose: Add column documentation and reload PostgREST
-- This is Part 3 - finalization (run AFTER Part 1 and Part 2)
--
-- Run Time: ~5 seconds
-- Safe: Documentation only, non-destructive
--
-- =====================================================

BEGIN;

-- =====================================================
-- COLUMN DOCUMENTATION
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

COMMIT;

-- =====================================================
-- RELOAD POSTGREST SCHEMA CACHE
-- =====================================================

-- Critical: PostgREST must reload its schema cache to see new columns
NOTIFY pgrst, 'reload schema';

-- =====================================================
-- ALL PARTS COMPLETE ✅
-- =====================================================
--
-- Verification query:
--
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'raw_props'
--   AND column_name IN ('home_team', 'away_team', 'event_time', 'sport_key', 'league')
-- ORDER BY column_name;
--
-- Expected: 5 rows showing all new columns
--
-- =====================================================
