-- Manual Table Setup for Data Lifecycle Management
-- Run this SQL directly in Supabase SQL Editor

-- Create raw_props_recent table (warm tier - last 30 days)
CREATE TABLE IF NOT EXISTS raw_props_recent (
    LIKE raw_props INCLUDING ALL
);

-- Create raw_props_historical table (cold tier - 30+ days)
CREATE TABLE IF NOT EXISTS raw_props_historical (
    LIKE raw_props INCLUDING ALL
);

-- Add table comments
COMMENT ON TABLE raw_props_recent IS 
'Warm tier storage for props 1-30 days old. Used for analytics and recent data queries.';

COMMENT ON TABLE raw_props_historical IS 
'Cold tier storage for props 30+ days old. Used for backtesting and historical analysis.';

-- Create performance indexes for raw_props_recent
CREATE INDEX IF NOT EXISTS idx_raw_props_recent_game_date 
ON raw_props_recent(game_date DESC);

CREATE INDEX IF NOT EXISTS idx_raw_props_recent_scraped_at 
ON raw_props_recent(scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_raw_props_recent_player_sport 
ON raw_props_recent(player_name, sport);

-- Create performance indexes for raw_props_historical
CREATE INDEX IF NOT EXISTS idx_raw_props_historical_game_date 
ON raw_props_historical(game_date DESC);

CREATE INDEX IF NOT EXISTS idx_raw_props_historical_player_name 
ON raw_props_historical(player_name);

CREATE INDEX IF NOT EXISTS idx_raw_props_historical_sport_date 
ON raw_props_historical(sport, game_date DESC);

-- Composite index for analytics queries
CREATE INDEX IF NOT EXISTS idx_raw_props_historical_analytics 
ON raw_props_historical(sport, stat_type, game_date DESC);

-- IMMEDIATE CLEANUP: Move old props to historical table
-- This will free up 512,537 records immediately!
INSERT INTO raw_props_historical (
    SELECT * FROM raw_props 
    WHERE game_date < CURRENT_DATE - INTERVAL '1 day'
);

-- Delete old props from hot tier after successful insert
DELETE FROM raw_props 
WHERE game_date < CURRENT_DATE - INTERVAL '1 day';

-- Verify the cleanup worked
SELECT 
    'raw_props' as table_name, COUNT(*) as record_count
FROM raw_props
UNION ALL
SELECT 
    'raw_props_historical' as table_name, COUNT(*) as record_count  
FROM raw_props_historical
ORDER BY table_name;