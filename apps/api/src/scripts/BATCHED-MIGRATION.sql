-- ========================================
-- BATCHED DATA LIFECYCLE MIGRATION
-- Safe migration for 512,537 records in small batches
-- ========================================
-- 
-- STRATEGY: Create tables first, then migrate data in batches
-- This prevents timeouts and allows monitoring progress
-- 
-- PART 1: Run this first (fast, no data movement)
-- ========================================

-- Step 1: Create tables and indexes only (fast operation)
CREATE TABLE IF NOT EXISTS raw_props_recent (
    LIKE raw_props INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS raw_props_historical (
    LIKE raw_props INCLUDING ALL
);

-- Step 2: Add table documentation
COMMENT ON TABLE raw_props_recent IS 
'Warm tier storage for props 1-30 days old. Used for analytics and recent data queries.';

COMMENT ON TABLE raw_props_historical IS 
'Cold tier storage for props 30+ days old. Used for backtesting and historical analysis.';

-- Step 3: Create performance indexes
CREATE INDEX IF NOT EXISTS idx_raw_props_recent_game_date ON raw_props_recent(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_raw_props_recent_scraped_at ON raw_props_recent(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_props_recent_player_sport ON raw_props_recent(player_name, sport);

CREATE INDEX IF NOT EXISTS idx_raw_props_historical_game_date ON raw_props_historical(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_raw_props_historical_player_name ON raw_props_historical(player_name);
CREATE INDEX IF NOT EXISTS idx_raw_props_historical_sport_date ON raw_props_historical(sport, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_raw_props_historical_analytics ON raw_props_historical(sport, stat_type, game_date DESC);

-- Step 4: Verify table creation
SELECT 
    'TABLES CREATED SUCCESSFULLY' as status,
    '=============================' as separator;

SELECT 
    schemaname,
    tablename,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE tablename IN ('raw_props', 'raw_props_recent', 'raw_props_historical')
ORDER BY tablename;

-- Show current data counts
SELECT 
    'CURRENT DATA STATE' as status,
    '==================' as separator;

SELECT 
    COUNT(*) as total_props_before_migration,
    COUNT(*) FILTER (WHERE game_date < CURRENT_DATE - INTERVAL '1 day') as old_props_to_migrate,
    COUNT(*) FILTER (WHERE game_date >= CURRENT_DATE - INTERVAL '1 day') as current_props_to_keep
FROM raw_props;

SELECT 
    '✅ PART 1 COMPLETE - TABLES READY' as status,
    'Now run PART 2 scripts in batches' as next_step;