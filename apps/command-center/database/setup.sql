-- Command Center Database Setup
-- Run this SQL in your Supabase SQL Editor

-- Create agents table
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'inactive',
  last_run TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_health_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_operations INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0.0,
  avg_response_time INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agents_status ON public.agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_type ON public.agents(type);
CREATE INDEX IF NOT EXISTS idx_agents_name ON public.agents(name);

-- Create security_events table
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type VARCHAR(100) NOT NULL,
  severity VARCHAR(50) DEFAULT 'medium',
  description TEXT NOT NULL,
  user_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for security_events
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Create policies for agents table
DROP POLICY IF EXISTS "Allow authenticated users to read agents" ON public.agents;
CREATE POLICY "Allow authenticated users to read agents" ON public.agents
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow service role to manage agents" ON public.agents;
CREATE POLICY "Allow service role to manage agents" ON public.agents
  FOR ALL USING (true);

-- Create policies for security_events table
DROP POLICY IF EXISTS "Allow authenticated users to read security events" ON public.security_events;
CREATE POLICY "Allow authenticated users to read security events" ON public.security_events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow service role to manage security events" ON public.security_events;
CREATE POLICY "Allow service role to manage security events" ON public.security_events
  FOR ALL USING (true);

-- Insert sample agents data
INSERT INTO public.agents (name, type, status, total_operations, success_rate, avg_response_time, metadata) VALUES
  ('AlertAgent', 'notification', 'healthy', 1247, 98.5, 150, '{"endpoint": "/api/alerts", "version": "1.0.0"}'),
  ('GradingAgent', 'analysis', 'healthy', 3421, 96.2, 230, '{"endpoint": "/api/grading", "version": "2.1.0"}'),
  ('RecapAgent', 'content', 'warning', 892, 94.1, 180, '{"endpoint": "/api/recap", "version": "1.5.2"}'),
  ('FeedAgent', 'ingestion', 'healthy', 5673, 99.1, 95, '{"endpoint": "/api/feed", "version": "3.0.1"}'),
  ('NotificationAgent', 'notification', 'error', 2156, 87.3, 320, '{"endpoint": "/api/notifications", "version": "1.2.0"}'),
  ('AnalyticsAgent', 'analysis', 'healthy', 1892, 97.8, 195, '{"endpoint": "/api/analytics", "version": "1.3.0"}')
ON CONFLICT (name) DO UPDATE SET
  type = EXCLUDED.type,
  status = EXCLUDED.status,
  total_operations = EXCLUDED.total_operations,
  success_rate = EXCLUDED.success_rate,
  avg_response_time = EXCLUDED.avg_response_time,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- Insert sample security events
INSERT INTO public.security_events (type, severity, description, ip_address, user_agent, metadata) VALUES
  ('failed_login', 'medium', 'Multiple failed login attempts detected', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', '{"attempts": 5, "blocked": true}'),
  ('unauthorized_api_access', 'high', 'Attempt to access restricted API endpoint', '10.0.0.45', 'curl/7.68.0', '{"endpoint": "/api/admin", "method": "DELETE"}'),
  ('suspicious_activity', 'critical', 'Unusual data access pattern detected', '203.0.113.42', 'Python/3.9 requests/2.25.1', '{"data_volume": "10GB", "time_window": "5min"}'),
  ('rate_limit_exceeded', 'medium', 'API rate limit exceeded for user', '198.51.100.23', 'PostmanRuntime/7.28.4', '{"requests": 1000, "time_window": "1min"}'),
  ('security_scan_detected', 'high', 'Automated security scanning detected', '203.0.113.195', 'Nmap Scripting Engine', '{"scan_type": "port_scan", "ports_scanned": 65535}'),
  ('data_export_large', 'medium', 'Large data export operation', '192.168.1.50', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', '{"records_exported": 50000, "export_type": "CSV"}'),
  ('privilege_escalation_attempt', 'critical', 'Attempt to escalate user privileges', '172.16.0.42', 'Mozilla/5.0 (X11; Linux x86_64)', '{"target_role": "admin", "success": false}'),
  ('brute_force_attack', 'high', 'Brute force attack on admin panel', '198.51.100.67', 'Mozilla/5.0 (Windows NT 6.1; WOW64)', '{"attempts": 150, "duration": "30min"}'),
  ('sql_injection_attempt', 'critical', 'SQL injection attempt detected', '203.0.113.88', 'sqlmap/1.5.7', '{"payload": "UNION SELECT", "blocked": true}'),
  ('file_upload_malicious', 'high', 'Malicious file upload attempt', '10.0.0.99', 'Mozilla/5.0 (compatible; MSIE 9.0)', '{"file_type": "executable", "quarantined": true}');

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for agents table
DROP TRIGGER IF EXISTS update_agents_updated_at ON public.agents;
CREATE TRIGGER update_agents_updated_at
    BEFORE UPDATE ON public.agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verify the setup
SELECT 'Agents table created with ' || COUNT(*) || ' records' as status FROM public.agents;
SELECT 'Security events table created with ' || COUNT(*) || ' records' as status FROM public.security_events;