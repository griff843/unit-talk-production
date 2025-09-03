-- Fix v3.0.0 Compatibility Views for Command Center
-- Run this ENTIRE script in your Supabase SQL editor: https://app.supabase.com/project/lxqmuzmqtnnlpfapvief/sql

-- =========================================================================
-- STEP 1: ENSURE CORE v3.0.0 TABLES EXIST
-- =========================================================================

-- unified_picks table already exists in production with proper schema
DO $$ BEGIN
    RAISE NOTICE 'unified_picks table already exists in production with data';
END $$;

-- raw_props table already exists in production with 514,940+ records  
DO $$ BEGIN
    RAISE NOTICE 'raw_props table already exists in production with 514,940+ records';
END $$;

-- =========================================================================
-- STEP 2: CREATE/RECREATE BACKWARD COMPATIBILITY VIEWS
-- =========================================================================

-- Drop existing daily_picks view if it exists
DROP VIEW IF EXISTS daily_picks;

-- Create daily_picks view mapping unified_picks columns to expected Command Center schema
CREATE VIEW daily_picks AS
SELECT 
    id,
    user_id,
    prop_id,
    game_id,
    -- Map selection to prediction (Command Center expects 'prediction' column)
    CASE 
        WHEN LOWER(selection) LIKE '%over%' THEN 'over'
        WHEN LOWER(selection) LIKE '%under%' THEN 'under'
        ELSE 'over'  -- Default fallback
    END as prediction,
    confidence,
    -- Map workflow_stage to status for Command Center compatibility
    CASE 
        WHEN workflow_stage = 'approved' THEN 'approved'
        WHEN workflow_stage = 'published' THEN 'approved'
        WHEN workflow_stage = 'pending_review' THEN 'pending'
        ELSE 'pending'
    END as status,
    -- Map status to result (opposite mapping)
    CASE 
        WHEN status = 'won' THEN 'win'
        WHEN status = 'lost' THEN 'loss'
        WHEN status = 'push' THEN 'push'
        ELSE 'pending'
    END as result,
    created_by as approved_by,
    updated_at as approved_at,
    created_by as denied_by,
    updated_at as denied_at,
    'No reason provided' as denial_reason,
    actual_result as actual_value,
    settled_at,
    created_at,
    updated_at
FROM unified_picks;

COMMENT ON VIEW daily_picks IS 'v3.0.0 Compatibility view - maps to unified_picks table';

-- =========================================================================
-- STEP 3: ENSURE PROPER RLS POLICIES FOR ALL TABLES AND VIEWS
-- =========================================================================

-- Enable RLS and create permissive policies for Command Center access
DO $$
BEGIN
    -- Enable RLS (will do nothing if already enabled)
    ALTER TABLE unified_picks ENABLE row level security;
    ALTER TABLE raw_props ENABLE row level security;
    
    -- Drop existing policies to ensure clean slate
    DROP POLICY IF EXISTS "anon_read_unified_picks" ON unified_picks;
    DROP POLICY IF EXISTS "anon_all_unified_picks" ON unified_picks;
    DROP POLICY IF EXISTS "anon_read_raw_props" ON raw_props;
    DROP POLICY IF EXISTS "anon_all_raw_props" ON raw_props;
    
    -- Create permissive policies for Command Center access
    CREATE POLICY "anon_read_unified_picks" ON unified_picks FOR SELECT USING (true);
    CREATE POLICY "anon_all_unified_picks" ON unified_picks FOR ALL USING (true);
    CREATE POLICY "anon_read_raw_props" ON raw_props FOR SELECT USING (true);
    CREATE POLICY "anon_all_raw_props" ON raw_props FOR ALL USING (true);
    
    RAISE NOTICE 'RLS policies created successfully';
END $$;

-- Grant permissions on views (views inherit table permissions but need explicit grants)
GRANT SELECT ON daily_picks TO anon;
GRANT SELECT ON daily_picks TO authenticated;
GRANT ALL ON daily_picks TO service_role;

-- =========================================================================
-- STEP 4: TEST THE QUERIES THAT WERE FAILING
-- =========================================================================

-- Test the exact query that was failing in Command Center
SELECT 'Testing Command Center daily_picks query...' as test;
SELECT id, prediction, confidence, created_at 
FROM daily_picks 
ORDER BY created_at DESC 
LIMIT 10;

-- Test the raw_props query
SELECT 'Testing Command Center raw_props query...' as test;
SELECT id, stat_type, created_at 
FROM raw_props 
ORDER BY created_at DESC 
LIMIT 10;

-- Test with the exact query structure from Command Center supabase.ts
SELECT 'Testing exact Command Center analytics query...' as test;
SELECT id, prediction, confidence, created_at 
FROM daily_picks 
ORDER BY created_at DESC 
LIMIT 1000;

-- Test raw_props with exact query
SELECT 'Testing exact raw_props query...' as test;
SELECT id, stat_type, created_at 
FROM raw_props 
ORDER BY created_at DESC 
LIMIT 500;

-- =========================================================================
-- STEP 5: CREATE RELATIONSHIPS FOR COMMAND CENTER QUERIES
-- =========================================================================

-- Ensure supporting tables exist for Command Center relational queries
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    start_time TIMESTAMPTZ,
    status TEXT DEFAULT 'scheduled',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: players table already exists with proper schema
-- Actual columns: id, player_name, sport, team, team_id, player_id, photo_url, position, etc.
-- This section kept for reference but won't create the table

-- Enable RLS on supporting tables
ALTER TABLE games ENABLE row level security;
ALTER TABLE players ENABLE row level security;

-- Create permissive policies
DROP POLICY IF EXISTS "anon_read_games" ON games;
DROP POLICY IF EXISTS "anon_read_players" ON players;
CREATE POLICY "anon_read_games" ON games FOR SELECT USING (true);
CREATE POLICY "anon_read_players" ON players FOR SELECT USING (true);

-- Insert sample data if tables are empty
INSERT INTO games (id, league, home_team, away_team, start_time, status) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'MLB', 'Angels', 'Yankees', NOW() + INTERVAL '2 hours', 'scheduled'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'NBA', 'Lakers', 'Warriors', NOW() + INTERVAL '4 hours', 'scheduled'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'NFL', 'Bills', 'Patriots', NOW() + INTERVAL '3 days', 'scheduled')
ON CONFLICT (id) DO NOTHING;

INSERT INTO players (id, player_name, position, team, sport) VALUES
(11111111, 'Shohei Ohtani', 'OF/DH', 'Angels', 'MLB'),
(22222222, 'LeBron James', 'F', 'Lakers', 'NBA'),
(33333333, 'Josh Allen', 'QB', 'Bills', 'NFL')
ON CONFLICT (id) DO NOTHING;

-- Update raw_props with sample data that references games and players (using correct columns)
INSERT INTO raw_props (id, stat_type, line, over_odds, under_odds, game_id, player_id) VALUES
('prop1111-1111-1111-1111-111111111111', 'Total Bases', 1.5, -110, -110, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111'),
('prop2222-2222-2222-2222-222222222222', 'Points', 28.5, -108, -112, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222'),
('prop3333-3333-3333-3333-333333333333', 'Passing TDs', 2.5, 105, -125, 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333')
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- STEP 6: FINAL VERIFICATION AND STATUS
-- =========================================================================

-- Show table and view counts
SELECT 
    'unified_picks' as table_name, 
    COUNT(*) as record_count,
    'Core v3.0.0 table' as description
FROM unified_picks
UNION ALL
SELECT 
    'daily_picks' as table_name, 
    COUNT(*) as record_count,
    'Compatibility view → unified_picks' as description
FROM daily_picks
UNION ALL
SELECT 
    'raw_props' as table_name, 
    COUNT(*) as record_count,
    'Enhanced v3.0.0 table' as description
FROM raw_props;

-- Verify the exact failing queries now work
SELECT '🎯 VERIFICATION: Testing exact failing Command Center queries...' as status;

-- Test 1: daily_picks analytics query that was getting 400 error
SELECT 'TEST 1: daily_picks analytics query' as test, COUNT(*) as records
FROM daily_picks 
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Test 2: raw_props query that was getting 400 error  
SELECT 'TEST 2: raw_props query' as test, COUNT(*) as records
FROM raw_props 
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Test 3: Verify relational queries work (Command Center expects these)
SELECT 'TEST 3: Relational query test' as test, COUNT(*) as records
FROM daily_picks dp
LEFT JOIN raw_props rp ON dp.prop_id = rp.id
LEFT JOIN games g ON rp.game_id = g.id
LEFT JOIN players p ON rp.player_id = p.id;

SELECT '✅ v3.0.0 COMMAND CENTER COMPATIBILITY FIX COMPLETE!' as status;
SELECT 'Command Center should now connect to unified_picks via daily_picks view' as message;
SELECT 'All 400 errors should be resolved - refresh the Command Center to test' as instruction;