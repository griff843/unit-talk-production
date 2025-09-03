-- =============================================================================
-- CLEANUP: Remove Compatibility Views and Use Unified v3.0.0 Structure
-- This removes any compatibility views and lets Command Center use unified tables directly
-- =============================================================================

-- Remove any compatibility views that were created as workarounds
DROP VIEW IF EXISTS daily_picks;

-- Remove any non-existent table references that might cause errors
-- (No need to create cappers, props, events tables - they don't exist in v3.0.0)

-- Ensure RLS policies exist for the actual v3.0.0 tables
DO $$
BEGIN
    -- Enable RLS on v3.0.0 tables (safe if already enabled)
    ALTER TABLE unified_picks ENABLE row level security;
    ALTER TABLE users ENABLE row level security;
    ALTER TABLE raw_props ENABLE row level security;
    ALTER TABLE games ENABLE row level security;
    ALTER TABLE players ENABLE row level security;
    
    -- Drop any old policies
    DROP POLICY IF EXISTS "anon_read_unified_picks" ON unified_picks;
    DROP POLICY IF EXISTS "anon_all_unified_picks" ON unified_picks;
    DROP POLICY IF EXISTS "anon_read_users" ON users;
    DROP POLICY IF EXISTS "anon_read_raw_props" ON raw_props;
    DROP POLICY IF EXISTS "anon_read_games" ON games;
    DROP POLICY IF EXISTS "anon_read_players" ON players;
    
    -- Create proper RLS policies for Command Center access to v3.0.0 tables
    CREATE POLICY "anon_read_unified_picks" ON unified_picks FOR SELECT USING (true);
    CREATE POLICY "anon_all_unified_picks" ON unified_picks FOR ALL USING (true);
    CREATE POLICY "anon_read_users" ON users FOR SELECT USING (true);
    CREATE POLICY "anon_read_raw_props" ON raw_props FOR SELECT USING (true);  
    CREATE POLICY "anon_read_games" ON games FOR SELECT USING (true);
    CREATE POLICY "anon_read_players" ON players FOR SELECT USING (true);
    
    RAISE NOTICE 'RLS policies created for v3.0.0 unified tables';
END $$;

-- Verify the actual v3.0.0 table structure
SELECT 'Verifying v3.0.0 unified table structure:' as status;

-- Show real data counts from unified structure
SELECT 
    'unified_picks' as table_name, 
    COUNT(*) as record_count,
    'Primary picks table in v3.0.0' as description
FROM unified_picks
UNION ALL
SELECT 
    'users' as table_name, 
    COUNT(*) as record_count,
    'Real capper profiles' as description
FROM users
UNION ALL
SELECT 
    'raw_props' as table_name, 
    COUNT(*) as record_count,
    'Prop data with player names' as description
FROM raw_props
UNION ALL
SELECT 
    'games' as table_name, 
    COUNT(*) as record_count,
    'Game schedules' as description
FROM games
UNION ALL
SELECT 
    'players' as table_name, 
    COUNT(*) as record_count,
    'Player database' as description
FROM players;

-- Test the Command Center's expected query pattern
SELECT 'Testing Command Center unified_picks query:' as test;
SELECT 
    up.id,
    u.username as capper,
    up.selection,
    up.confidence,
    up.workflow_stage,
    up.created_at
FROM unified_picks up
LEFT JOIN users u ON up.user_id = u.id
ORDER BY up.created_at DESC
LIMIT 5;

SELECT '✅ CLEANUP COMPLETE - Command Center now uses unified v3.0.0 structure directly!' as status;
SELECT 'No compatibility views or workarounds - pure v3.0.0 integration!' as message;