-- =============================================================================
-- SIMPLE Command Center Compatibility Fix for v3.0.0
-- Minimal script to avoid trigger conflicts
-- =============================================================================

-- Drop and recreate the daily_picks view only
DROP VIEW IF EXISTS daily_picks;

-- Create daily_picks view mapping unified_picks columns to expected Command Center schema
CREATE VIEW daily_picks AS
SELECT 
    up.id,
    up.user_id,
    up.prop_id,
    up.game_id,
    -- Command Center expects capper info
    COALESCE(u.username, 'Expert Capper ' || SUBSTRING(up.user_id::text, 1, 8)) as capper,
    up.user_id as capper_discord_id,
    -- Map selection to prediction (Command Center expects 'prediction' column)
    CASE 
        WHEN LOWER(up.selection) LIKE '%over%' THEN 'over'
        WHEN LOWER(up.selection) LIKE '%under%' THEN 'under'
        ELSE 'over'  -- Default fallback
    END as prediction,
    up.selection,
    -- Get sport from raw_props if available
    COALESCE(rp.sport, 'Unknown') as sport,
    -- Get player info from raw_props
    rp.player_name,
    CONCAT(rp.stat_type, ' ', rp.line) as line,
    rp.over_odds as odds,
    up.confidence,
    -- Map workflow_stage to status for Command Center compatibility
    CASE 
        WHEN up.workflow_stage = 'approved' THEN 'approved'
        WHEN up.workflow_stage = 'published' THEN 'approved'
        WHEN up.workflow_stage = 'pending_review' THEN 'pending'
        ELSE 'pending'
    END as status,
    -- Map status to result (opposite mapping)
    CASE 
        WHEN up.status = 'won' THEN 'win'
        WHEN up.status = 'lost' THEN 'loss'
        WHEN up.status = 'push' THEN 'push'
        ELSE 'pending'
    END as result,
    -- Additional fields Command Center expects
    'A' as tier,
    up.confidence * 0.1 as ev_score,  -- Convert to EV professional_score format
    NULL as roi,
    'player_prop' as market_type,
    up.created_at as submitted_at,
    up.created_by as approved_by,
    up.updated_at as approved_at,
    up.created_by as denied_by,
    up.updated_at as denied_at,
    'No reason provided' as denial_reason,
    up.actual_result as actual_value,
    up.settled_at,
    up.created_at,
    up.updated_at
FROM unified_picks up
LEFT JOIN users u ON up.user_id = u.id
LEFT JOIN raw_props rp ON up.prop_id = rp.id;

-- Grant permissions on the view
GRANT SELECT ON daily_picks TO anon;
GRANT SELECT ON daily_picks TO authenticated;
GRANT ALL ON daily_picks TO service_role;

-- Create RLS policies for existing tables (without triggering table creation)
DO $$
BEGIN
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

-- Test the view works
SELECT 'Testing daily_picks view...' as test;
SELECT COUNT(*) as record_count FROM daily_picks;
SELECT 'daily_picks view created successfully!' as status;