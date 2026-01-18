-- =====================================================
-- Phase 1 Schema Alignment: raw_props Indexes (Part 2 of 3)
-- =====================================================
--
-- Purpose: Create performance indexes on raw_props
-- This is Part 2 - creates indexes (run AFTER Part 1)
--
-- Run Time: ~15-30 seconds (depends on table size)
-- Safe: Uses IF NOT EXISTS, non-blocking
--
-- =====================================================

BEGIN;

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

COMMIT;

-- =====================================================
-- PART 2 COMPLETE
-- =====================================================
-- Next step: Run Part 3 for column comments and schema reload
