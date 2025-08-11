-- Complete RLS Policy Fix for Command Center
-- Run this ENTIRE script in your Supabase SQL editor: https://app.supabase.com/project/lxqmuzmqtnnlpfapvief/sql

-- =========================================================================
-- STEP 1: DROP ALL EXISTING POLICIES (Clean Slate)
-- =========================================================================

-- Drop ALL policies on agent_health
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'agent_health' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON agent_health', pol.policyname);
    END LOOP;
END $$;

-- Drop ALL policies on agent_metrics
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'agent_metrics' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON agent_metrics', pol.policyname);
    END LOOP;
END $$;

-- Drop ALL policies on security_events
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'security_events' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON security_events', pol.policyname);
    END LOOP;
END $$;

-- =========================================================================
-- STEP 2: CREATE NEW PERMISSIVE POLICIES
-- =========================================================================

-- AGENT_HEALTH POLICIES
CREATE POLICY "anon_read_agent_health" ON agent_health FOR SELECT USING (true);
CREATE POLICY "anon_insert_agent_health" ON agent_health FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_agent_health" ON agent_health FOR UPDATE USING (true);
CREATE POLICY "auth_all_agent_health" ON agent_health FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_all_agent_health" ON agent_health FOR ALL USING (auth.role() = 'service_role');

-- AGENT_METRICS POLICIES
CREATE POLICY "anon_read_agent_metrics" ON agent_metrics FOR SELECT USING (true);
CREATE POLICY "anon_insert_agent_metrics" ON agent_metrics FOR INSERT WITH CHECK (true);
CREATE POLICY "auth_all_agent_metrics" ON agent_metrics FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_all_agent_metrics" ON agent_metrics FOR ALL USING (auth.role() = 'service_role');

-- SECURITY_EVENTS POLICIES
CREATE POLICY "anon_read_security_events" ON security_events FOR SELECT USING (true);
CREATE POLICY "auth_all_security_events" ON security_events FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_all_security_events" ON security_events FOR ALL USING (auth.role() = 'service_role');

-- =========================================================================
-- STEP 3: VERIFY THE FIX
-- =========================================================================

-- Check if tables have data
SELECT 'Checking agent_health table...' as status;
SELECT COUNT(*) as agent_health_count FROM agent_health;

SELECT 'Checking agent_metrics table...' as status;
SELECT COUNT(*) as agent_metrics_count FROM agent_metrics;

SELECT 'Checking security_events table...' as status;
SELECT COUNT(*) as security_events_count FROM security_events;

-- Test anonymous access (this should return data now)
SELECT 'Testing anonymous access to agent_health...' as status;
SELECT agent, status, total_operations, last_run FROM agent_health LIMIT 5;

-- Show all current policies
SELECT 'Current RLS policies:' as status;
SELECT 
    tablename,
    policyname,
    permissive,
    cmd,
    roles
FROM pg_policies 
WHERE tablename IN ('agent_health', 'agent_metrics', 'security_events')
ORDER BY tablename, policyname;

-- =========================================================================
-- STEP 4: ENSURE TABLES HAVE DATA (Re-insert if needed)
-- =========================================================================

-- Only insert if tables are empty
DO $$
BEGIN
    -- Check and insert agent_health data if empty
    IF NOT EXISTS (SELECT 1 FROM agent_health LIMIT 1) THEN
        INSERT INTO agent_health (agent, status, details, last_run, total_operations, response_time_ms) 
        VALUES 
        ('AlertAgent', 'healthy', '{"version":"1.0.0","uptime":86400}', NOW() - INTERVAL '2 minutes', 15420, 245),
        ('GradingAgent', 'healthy', '{"version":"1.0.0","uptime":85000}', NOW() - INTERVAL '4 minutes', 8934, 1200),
        ('RecapAgent', 'warning', '{"version":"1.0.0","uptime":82000,"warnings":["API timeout"]}', NOW() - INTERVAL '17 minutes', 2847, 3400),
        ('FeedAgent', 'healthy', '{"version":"1.0.0","uptime":86000}', NOW() - INTERVAL '3 minutes', 45782, 180),
        ('NotificationAgent', 'healthy', '{"version":"1.0.0","uptime":86100}', NOW() - INTERVAL '1 minute', 12045, 320)
        ON CONFLICT (agent) DO UPDATE SET
          status = EXCLUDED.status,
          last_run = EXCLUDED.last_run,
          updated_at = NOW();
        
        RAISE NOTICE 'Inserted sample data into agent_health table';
    END IF;

    -- Check and insert agent_metrics data if empty
    IF NOT EXISTS (SELECT 1 FROM agent_metrics LIMIT 1) THEN
        INSERT INTO agent_metrics (agent, metric_name, metric_value, metric_type) 
        VALUES 
        ('AlertAgent', 'success_rate', 98.5, 'gauge'),
        ('AlertAgent', 'alerts_sent', 1542, 'counter'),
        ('GradingAgent', 'success_rate', 94.2, 'gauge'),
        ('GradingAgent', 'picks_graded', 8934, 'counter'),
        ('RecapAgent', 'success_rate', 89.1, 'gauge'),
        ('RecapAgent', 'recap_generated', 284, 'counter'),
        ('FeedAgent', 'success_rate', 99.8, 'gauge'),
        ('FeedAgent', 'props_ingested', 45782, 'counter'),
        ('NotificationAgent', 'success_rate', 97.3, 'gauge'),
        ('NotificationAgent', 'notifications_sent', 12045, 'counter');
        
        RAISE NOTICE 'Inserted sample data into agent_metrics table';
    END IF;

    -- Check and insert security_events data if empty
    IF NOT EXISTS (SELECT 1 FROM security_events LIMIT 1) THEN
        INSERT INTO security_events (type, severity, description, ip_address) 
        VALUES 
        ('LOGIN_ATTEMPT', 'high', 'Multiple failed login attempts detected', '192.168.1.100'),
        ('RATE_LIMIT', 'medium', 'API rate limit exceeded', '10.0.0.45'),
        ('SUSPICIOUS_ACTIVITY', 'medium', 'User accessing from new location', '41.223.45.120'),
        ('API_ACCESS', 'low', 'Successful API access', '192.168.1.25'),
        ('SYSTEM_ALERT', 'high', 'High CPU usage detected', NULL),
        ('DATA_SYNC', 'low', 'Daily sync completed', NULL);
        
        RAISE NOTICE 'Inserted sample data into security_events table';
    END IF;
END $$;

-- =========================================================================
-- FINAL VERIFICATION
-- =========================================================================

SELECT '✅ RLS POLICY FIX COMPLETE!' as status;
SELECT 'All policies have been recreated with anonymous access enabled' as message;

-- Show final counts
SELECT 
    'agent_health' as table_name, 
    COUNT(*) as record_count,
    CASE WHEN COUNT(*) > 0 THEN '✅ Has data' ELSE '❌ Empty' END as status
FROM agent_health
UNION ALL
SELECT 
    'agent_metrics' as table_name, 
    COUNT(*) as record_count,
    CASE WHEN COUNT(*) > 0 THEN '✅ Has data' ELSE '❌ Empty' END as status
FROM agent_metrics
UNION ALL
SELECT 
    'security_events' as table_name, 
    COUNT(*) as record_count,
    CASE WHEN COUNT(*) > 0 THEN '✅ Has data' ELSE '❌ Empty' END as status
FROM security_events;

-- Test final access
SELECT '🎯 Final Test - This should return agent data:' as test;
SELECT agent, status, total_operations FROM agent_health LIMIT 3;