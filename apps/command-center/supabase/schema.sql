-- ============================================================================
-- UNIT TALK COMMAND CENTER - COMPLETE DATABASE SCHEMA
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- USERS TABLE - Discord user management
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discord_id TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    tier TEXT NOT NULL DEFAULT 'Free' CHECK (tier IN ('Free', 'Premium', 'VIP')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'banned', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_picks INTEGER DEFAULT 0,
    won_picks INTEGER DEFAULT 0,
    lost_picks INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0.00,
    total_profit DECIMAL(12,2) DEFAULT 0.00,
    revenue_generated DECIMAL(12,2) DEFAULT 0.00,
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    roles TEXT[] DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}'
);

-- ============================================================================
-- PICKS TABLE - Betting picks management
-- ============================================================================
CREATE TABLE IF NOT EXISTS picks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    sport TEXT NOT NULL,
    league TEXT,
    event_name TEXT NOT NULL,
    event_date TIMESTAMP WITH TIME ZONE,
    pick_type TEXT NOT NULL, -- 'spread', 'moneyline', 'total', 'prop'
    selection TEXT NOT NULL,
    odds DECIMAL(6,2),
    stake DECIMAL(8,2),
    confidence INTEGER CHECK (confidence BETWEEN 1 AND 10),
    reasoning TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'void', 'pushed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settled_at TIMESTAMP WITH TIME ZONE,
    profit DECIMAL(10,2),
    book_maker TEXT,
    unit_size DECIMAL(4,2) DEFAULT 1.00,
    tags TEXT[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT true,
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- ============================================================================
-- AGENTS TABLE - System agent monitoring
-- ============================================================================
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL, -- 'AlertAgent', 'GradingAgent', etc.
    description TEXT,
    status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('healthy', 'warning', 'error', 'inactive', 'maintenance')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    avg_response_time INTEGER DEFAULT 0, -- milliseconds
    total_operations INTEGER DEFAULT 0,
    successful_operations INTEGER DEFAULT 0,
    failed_operations INTEGER DEFAULT 0,
    configuration JSONB DEFAULT '{}',
    environment TEXT DEFAULT 'production',
    version TEXT,
    host_info JSONB DEFAULT '{}',
    metrics JSONB DEFAULT '{}',
    error_log TEXT[],
    is_enabled BOOLEAN DEFAULT true
);

-- ============================================================================
-- SECURITY_EVENTS TABLE - Security monitoring and audit logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, -- 'login_attempt', 'api_access', 'rate_limit', 'suspicious_activity'
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
    assigned_to UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}',
    geolocation JSONB DEFAULT '{}',
    risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100)
);

-- ============================================================================
-- ANALYTICS TABLE - Business metrics and KPIs
-- ============================================================================
CREATE TABLE IF NOT EXISTS analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(15,4),
    metric_type TEXT NOT NULL, -- 'counter', 'gauge', 'histogram'
    dimensions JSONB DEFAULT '{}', -- Additional dimensions for filtering
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- SYSTEM_LOGS TABLE - Application logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
    message TEXT NOT NULL,
    source TEXT NOT NULL, -- agent name, service name, etc.
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES users(id),
    correlation_id TEXT,
    metadata JSONB DEFAULT '{}',
    stack_trace TEXT
);

-- ============================================================================
-- DISCORD_GUILDS TABLE - Discord server management
-- ============================================================================
CREATE TABLE IF NOT EXISTS discord_guilds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id TEXT UNIQUE NOT NULL,
    guild_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settings JSONB DEFAULT '{}',
    member_count INTEGER DEFAULT 0,
    premium_members INTEGER DEFAULT 0
);

-- ============================================================================
-- NOTIFICATIONS TABLE - System notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'info', 'warning', 'error', 'success'
    user_id UUID REFERENCES users(id),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- ============================================================================
-- API_KEYS TABLE - API access management
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id),
    permissions TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0
);

-- ============================================================================
-- INDEXES for performance
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active);

-- Picks indexes
CREATE INDEX IF NOT EXISTS idx_picks_user_id ON picks(user_id);
CREATE INDEX IF NOT EXISTS idx_picks_status ON picks(status);
CREATE INDEX IF NOT EXISTS idx_picks_sport ON picks(sport);
CREATE INDEX IF NOT EXISTS idx_picks_created_at ON picks(created_at);
CREATE INDEX IF NOT EXISTS idx_picks_event_date ON picks(event_date);
CREATE INDEX IF NOT EXISTS idx_picks_approval_status ON picks(approval_status);

-- Agents indexes
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
CREATE INDEX IF NOT EXISTS idx_agents_last_run ON agents(last_run);

-- Security events indexes
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_status ON security_events(status);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_metric_name ON analytics(metric_name);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_metric_type ON analytics(metric_type);

-- System logs indexes
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_source ON system_logs(source);
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Basic policies (can be customized based on your auth requirements)
-- For now, allow all authenticated users to read/write (adjust as needed)

-- Users policies
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own record" ON users FOR UPDATE USING (true);

-- Picks policies  
CREATE POLICY "Anyone can view public picks" ON picks FOR SELECT USING (is_public = true OR auth.uid()::text = user_id::text);
CREATE POLICY "Users can insert own picks" ON picks FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own picks" ON picks FOR UPDATE USING (true);

-- Agents policies (admin only in production)
CREATE POLICY "Anyone can view agents" ON agents FOR SELECT USING (true);
CREATE POLICY "Service role can manage agents" ON agents FOR ALL USING (true);

-- Security events policies (admin only)
CREATE POLICY "Service role can manage security events" ON security_events FOR ALL USING (true);

-- Analytics policies
CREATE POLICY "Anyone can view analytics" ON analytics FOR SELECT USING (true);
CREATE POLICY "Service role can insert analytics" ON analytics FOR INSERT WITH CHECK (true);

-- System logs policies (admin only)
CREATE POLICY "Service role can manage logs" ON system_logs FOR ALL USING (true);

-- Notifications policies
CREATE POLICY "Users see own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service role can insert notifications" ON notifications FOR INSERT WITH CHECK (true);

-- ============================================================================
-- TRIGGERS for automatic updates
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER picks_updated_at BEFORE UPDATE ON picks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER discord_guilds_updated_at BEFORE UPDATE ON discord_guilds FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to update user stats when picks change
CREATE OR REPLACE FUNCTION update_user_pick_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user pick statistics
    UPDATE users SET 
        total_picks = (SELECT COUNT(*) FROM picks WHERE user_id = NEW.user_id),
        won_picks = (SELECT COUNT(*) FROM picks WHERE user_id = NEW.user_id AND status = 'won'),
        lost_picks = (SELECT COUNT(*) FROM picks WHERE user_id = NEW.user_id AND status = 'lost'),
        win_rate = CASE 
            WHEN (SELECT COUNT(*) FROM picks WHERE user_id = NEW.user_id AND status IN ('won', 'lost')) > 0 
            THEN (SELECT COUNT(*) FROM picks WHERE user_id = NEW.user_id AND status = 'won')::decimal / 
                 (SELECT COUNT(*) FROM picks WHERE user_id = NEW.user_id AND status IN ('won', 'lost'))::decimal * 100
            ELSE 0 
        END,
        total_profit = COALESCE((SELECT SUM(profit) FROM picks WHERE user_id = NEW.user_id AND profit IS NOT NULL), 0)
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply pick stats trigger
CREATE TRIGGER update_user_stats_on_pick_change 
    AFTER INSERT OR UPDATE ON picks 
    FOR EACH ROW EXECUTE FUNCTION update_user_pick_stats();

-- ============================================================================
-- SAMPLE DATA for testing (remove in production)
-- ============================================================================

-- Insert some sample agents
INSERT INTO agents (name, type, description, status, success_rate, total_operations) VALUES
('AlertAgent', 'notification', 'Handles system alerts and notifications', 'healthy', 98.5, 15420),
('GradingAgent', 'picks', 'Grades and validates betting picks', 'healthy', 97.2, 8934),
('RecapAgent', 'content', 'Generates daily and weekly recaps', 'warning', 89.1, 2847),
('FeedAgent', 'content', 'Manages content feeds and updates', 'healthy', 99.1, 45782),
('NotificationAgent', 'notification', 'Sends Discord notifications', 'healthy', 96.8, 12045)
ON CONFLICT (name) DO NOTHING;

-- Insert sample users
INSERT INTO users (discord_id, username, display_name, tier, total_picks, won_picks, lost_picks, win_rate, total_profit) VALUES
('123456789012345678', 'ProCapper23', 'Pro Capper', 'VIP', 247, 184, 63, 74.5, 2847.50),
('234567890123456789', 'BetMaster99', 'Bet Master', 'Premium', 189, 108, 81, 57.1, 1234.75),
('345678901234567890', 'LuckyStreak', 'Lucky', 'Free', 89, 42, 47, 47.2, -156.25),
('456789012345678901', 'SharpBettor', 'Sharp', 'VIP', 134, 89, 45, 66.4, 1876.90)
ON CONFLICT (discord_id) DO NOTHING;

-- Insert sample security events
INSERT INTO security_events (type, severity, title, description, ip_address) VALUES
('login_attempt', 'medium', 'Multiple Failed Login Attempts', 'User attempted login 5 times with wrong credentials', '192.168.1.100'),
('rate_limit', 'low', 'API Rate Limit Exceeded', 'Client exceeded API rate limit (100 req/min)', '10.0.0.45'),
('suspicious_activity', 'high', 'Unusual Access Pattern', 'User accessing from new geographic location', '203.0.113.15');

-- ============================================================================
-- VIEWS for common queries
-- ============================================================================

-- User statistics view
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.id,
    u.discord_id,
    u.username,
    u.tier,
    u.status,
    u.total_picks,
    u.won_picks,
    u.lost_picks,
    u.win_rate,
    u.total_profit,
    u.last_active,
    COUNT(p.id) FILTER (WHERE p.created_at >= NOW() - INTERVAL '30 days') as picks_last_30_days,
    COUNT(p.id) FILTER (WHERE p.created_at >= NOW() - INTERVAL '7 days') as picks_last_7_days
FROM users u
LEFT JOIN picks p ON u.id = p.user_id
GROUP BY u.id, u.discord_id, u.username, u.tier, u.status, u.total_picks, u.won_picks, u.lost_picks, u.win_rate, u.total_profit, u.last_active;

-- Recent activity view
CREATE OR REPLACE VIEW recent_activity AS
SELECT 
    'pick' as activity_type,
    p.id,
    u.username,
    CONCAT('New pick: ', p.selection, ' on ', p.event_name) as description,
    p.created_at as timestamp
FROM picks p
JOIN users u ON p.user_id = u.id
WHERE p.created_at >= NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
    'security' as activity_type,
    se.id,
    'System' as username,
    se.title as description,
    se.created_at as timestamp
FROM security_events se
WHERE se.created_at >= NOW() - INTERVAL '24 hours'

ORDER BY timestamp DESC
LIMIT 50;

-- ============================================================================
-- FUNCTIONS for common operations
-- ============================================================================

-- Function to get dashboard analytics
CREATE OR REPLACE FUNCTION get_dashboard_analytics()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_users', (SELECT COUNT(*) FROM users),
        'active_users', (SELECT COUNT(*) FROM users WHERE last_active >= NOW() - INTERVAL '7 days'),
        'vip_users', (SELECT COUNT(*) FROM users WHERE tier = 'VIP'),
        'premium_users', (SELECT COUNT(*) FROM users WHERE tier = 'Premium'),
        'total_picks', (SELECT COUNT(*) FROM picks),
        'pending_picks', (SELECT COUNT(*) FROM picks WHERE status = 'pending'),
        'won_picks', (SELECT COUNT(*) FROM picks WHERE status = 'won'),
        'lost_picks', (SELECT COUNT(*) FROM picks WHERE status = 'lost'),
        'total_revenue', (SELECT COALESCE(SUM(total_profit), 0) FROM users WHERE total_profit > 0),
        'healthy_agents', (SELECT COUNT(*) FROM agents WHERE status = 'healthy'),
        'warning_agents', (SELECT COUNT(*) FROM agents WHERE status = 'warning'),
        'error_agents', (SELECT COUNT(*) FROM agents WHERE status = 'error'),
        'open_security_events', (SELECT COUNT(*) FROM security_events WHERE status = 'open'),
        'high_severity_events', (SELECT COUNT(*) FROM security_events WHERE severity IN ('high', 'critical') AND status = 'open')
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;