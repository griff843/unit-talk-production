-- Complete Database Setup for Unit Talk Command Center
-- Run this entire file in your Supabase SQL editor: https://app.supabase.com/project/cqfnsozknjzvyiziwicl/sql

-- =========================================================================
-- CREATE TABLES
-- =========================================================================

-- Create agent_health table
CREATE TABLE IF NOT EXISTS agent_health (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'unknown',
  details JSONB DEFAULT '{}',
  last_run TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_operations INTEGER DEFAULT 0,
  response_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create agent_metrics table  
CREATE TABLE IF NOT EXISTS agent_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent VARCHAR(100) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_type VARCHAR(20) DEFAULT 'gauge',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Create security_events table
CREATE TABLE IF NOT EXISTS security_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'low',
  description TEXT NOT NULL,
  user_id VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_agent_health_agent ON agent_health(agent);
CREATE INDEX IF NOT EXISTS idx_agent_health_status ON agent_health(status);
CREATE INDEX IF NOT EXISTS idx_agent_health_created_at ON agent_health(created_at);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent ON agent_metrics(agent);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_timestamp ON agent_metrics(timestamp);

CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);

-- =========================================================================
-- CREATE UPDATE TRIGGER FOR agent_health
-- =========================================================================

CREATE OR REPLACE FUNCTION update_agent_health_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_health_update_timestamp
    BEFORE UPDATE ON agent_health
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_health_timestamp();

-- =========================================================================
-- INSERT SAMPLE DATA
-- =========================================================================

-- Insert agent health data (using ON CONFLICT to handle duplicates)
INSERT INTO agent_health (id, agent, status, details, last_run, total_operations, response_time_ms, created_at, updated_at) 
VALUES 
('550e8400-e29b-41d4-a716-446655440001', 'AlertAgent', 'healthy', '{"version":"1.0.0","uptime":86400}', NOW() - INTERVAL '2 minutes', 15420, 245, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440002', 'GradingAgent', 'healthy', '{"version":"1.0.0","uptime":85000}', NOW() - INTERVAL '4 minutes', 8934, 1200, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440003', 'RecapAgent', 'warning', '{"version":"1.0.0","uptime":82000,"warnings":["API timeout"]}', NOW() - INTERVAL '17 minutes', 2847, 3400, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440004', 'FeedAgent', 'healthy', '{"version":"1.0.0","uptime":86000}', NOW() - INTERVAL '3 minutes', 45782, 180, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440005', 'NotificationAgent', 'healthy', '{"version":"1.0.0","uptime":86100}', NOW() - INTERVAL '1 minute', 12045, 320, NOW(), NOW())
ON CONFLICT (agent) DO UPDATE SET
  status = EXCLUDED.status,
  details = EXCLUDED.details,
  last_run = EXCLUDED.last_run,
  total_operations = EXCLUDED.total_operations,
  response_time_ms = EXCLUDED.response_time_ms,
  updated_at = NOW();

-- Insert agent metrics data
INSERT INTO agent_metrics (agent, metric_name, metric_value, metric_type, timestamp) 
VALUES 
('AlertAgent', 'success_rate', 98.5, 'gauge', NOW()),
('AlertAgent', 'alerts_sent', 1542, 'counter', NOW()),
('GradingAgent', 'success_rate', 94.2, 'gauge', NOW()),
('GradingAgent', 'picks_graded', 8934, 'counter', NOW()),
('RecapAgent', 'success_rate', 89.1, 'gauge', NOW()),
('RecapAgent', 'recap_generated', 284, 'counter', NOW()),
('FeedAgent', 'success_rate', 99.8, 'gauge', NOW()),
('FeedAgent', 'props_ingested', 45782, 'counter', NOW()),
('NotificationAgent', 'success_rate', 97.3, 'gauge', NOW()),
('NotificationAgent', 'notifications_sent', 12045, 'counter', NOW());

-- Insert security events data
INSERT INTO security_events (type, severity, description, ip_address, created_at) 
VALUES 
('LOGIN_ATTEMPT', 'high', 'Multiple failed login attempts detected from IP 192.168.1.100 (5 attempts in 2 minutes)', '192.168.1.100', NOW() - INTERVAL '7 minutes'),
('RATE_LIMIT', 'medium', 'API rate limit exceeded for user ProCapper23 (150 requests in 1 minute, limit: 100)', '10.0.0.45', NOW() - INTERVAL '14 minutes'),
('SUSPICIOUS_ACTIVITY', 'medium', 'User BetMaster99 accessing from new geographic location (Nigeria)', '41.223.45.120', NOW() - INTERVAL '32 minutes'),
('API_ACCESS', 'low', 'Successful API access from new device for user SharpBettor', '192.168.1.25', NOW() - INTERVAL '47 minutes'),
('SYSTEM_ALERT', 'high', 'High CPU usage detected on production server (85% for 5 minutes)', NULL, NOW() - INTERVAL '1 hour'),
('DATA_SYNC', 'low', 'Daily data sync completed successfully', NULL, NOW() - INTERVAL '2 hours');

-- =========================================================================
-- ENABLE ROW LEVEL SECURITY (RLS) 
-- =========================================================================

ALTER TABLE agent_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies (adjust as needed for your security requirements)
CREATE POLICY "Allow all for authenticated users" ON agent_health FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON agent_metrics FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON security_events FOR ALL USING (auth.role() = 'authenticated');

-- Allow service role to access everything (for backend operations)
CREATE POLICY "Allow all for service role" ON agent_health FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow all for service role" ON agent_metrics FOR ALL USING (auth.role() = 'service_role');  
CREATE POLICY "Allow all for service role" ON security_events FOR ALL USING (auth.role() = 'service_role');

-- =========================================================================
-- VERIFICATION QUERIES
-- =========================================================================

-- Verify tables were created
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('agent_health', 'agent_metrics', 'security_events')
ORDER BY table_name;

-- Verify data was inserted
SELECT 'agent_health' as table_name, COUNT(*) as record_count FROM agent_health
UNION ALL
SELECT 'agent_metrics' as table_name, COUNT(*) as record_count FROM agent_metrics  
UNION ALL
SELECT 'security_events' as table_name, COUNT(*) as record_count FROM security_events;

-- Show sample data
SELECT 'Agent Health Sample:' as info;
SELECT agent, status, total_operations, last_run FROM agent_health LIMIT 5;

SELECT 'Agent Metrics Sample:' as info;
SELECT agent, metric_name, metric_value, metric_type FROM agent_metrics LIMIT 5;

SELECT 'Security Events Sample:' as info;
SELECT type, severity, description, created_at FROM security_events LIMIT 3;

-- =========================================================================
-- SUCCESS MESSAGE
-- =========================================================================

SELECT '🎉 DATABASE SETUP COMPLETE! 🎉' as message;
SELECT 'Tables created: agent_health, agent_metrics, security_events' as status;
SELECT 'Sample data inserted for all tables' as status;
SELECT 'Indexes created for optimal performance' as status;  
SELECT 'Row Level Security enabled' as status;
SELECT 'Ready for Command Center integration!' as status;