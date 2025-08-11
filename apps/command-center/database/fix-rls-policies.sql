-- Fix RLS Policies for Command Center Anonymous Access
-- Run this in your Supabase SQL editor: https://app.supabase.com/project/lxqmuzmqtnnlpfapvief/sql

-- =========================================================================
-- DROP EXISTING RESTRICTIVE POLICIES
-- =========================================================================

-- Drop the existing policies that only allow authenticated users
DROP POLICY IF EXISTS "Allow all for authenticated users" ON agent_health;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON agent_metrics;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON security_events;

-- Keep service role policies (these are needed for backend operations)
-- DROP POLICY IF EXISTS "Allow all for service role" ON agent_health;
-- DROP POLICY IF EXISTS "Allow all for service role" ON agent_metrics;
-- DROP POLICY IF EXISTS "Allow all for service role" ON security_events;

-- =========================================================================
-- CREATE PERMISSIVE POLICIES FOR COMMAND CENTER
-- =========================================================================

-- Allow anonymous access for Command Center dashboard (read-only)
CREATE POLICY "Allow anonymous read access" ON agent_health FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read access" ON agent_metrics FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read access" ON security_events FOR SELECT USING (true);

-- Allow authenticated users full access (for future user auth)
CREATE POLICY "Allow authenticated full access" ON agent_health FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access" ON agent_metrics FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access" ON security_events FOR ALL USING (auth.role() = 'authenticated');

-- Allow service role full access (for backend operations)
CREATE POLICY "Allow service role full access" ON agent_health FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON agent_metrics FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON security_events FOR ALL USING (auth.role() = 'service_role');

-- Allow anonymous users to insert/update agent_health (for agent status updates)
CREATE POLICY "Allow anonymous write to agent_health" ON agent_health FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update to agent_health" ON agent_health FOR UPDATE USING (true);

-- Allow anonymous users to insert agent_metrics (for metrics collection)
CREATE POLICY "Allow anonymous insert to agent_metrics" ON agent_metrics FOR INSERT WITH CHECK (true);

-- =========================================================================
-- VERIFICATION QUERIES
-- =========================================================================

-- Test anonymous access to agent_health
SELECT 'Testing agent_health access...' as test;
SELECT agent, status, total_operations FROM agent_health LIMIT 3;

-- Test anonymous access to agent_metrics  
SELECT 'Testing agent_metrics access...' as test;
SELECT agent, metric_name, metric_value FROM agent_metrics LIMIT 3;

-- Test anonymous access to security_events
SELECT 'Testing security_events access...' as test;
SELECT type, severity, description FROM security_events LIMIT 3;

-- Show current policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('agent_health', 'agent_metrics', 'security_events')
ORDER BY tablename, policyname;

-- =========================================================================
-- SUCCESS MESSAGE
-- =========================================================================

SELECT '🔓 RLS POLICIES FIXED! 🔓' as message;
SELECT 'Anonymous access enabled for Command Center' as status;
SELECT 'Tables: agent_health, agent_metrics, security_events' as status;
SELECT 'Command Center should now display real data!' as status;