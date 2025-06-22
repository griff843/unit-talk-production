-- Agent Health Monitoring Tables
CREATE TABLE IF NOT EXISTS agent_health_checks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('healthy', 'error')),
    response_time INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_health_checks_agent_id ON agent_health_checks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_health_checks_timestamp ON agent_health_checks(timestamp);
CREATE INDEX IF NOT EXISTS idx_agent_health_checks_status ON agent_health_checks(status);

-- Agent Notifications Table
CREATE TABLE IF NOT EXISTS agent_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    metadata JSONB,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_notifications_agent_id ON agent_notifications(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_notifications_processed ON agent_notifications(processed);
CREATE INDEX IF NOT EXISTS idx_agent_notifications_created_at ON agent_notifications(created_at);

-- A/B Testing Tables
CREATE TABLE IF NOT EXISTS ab_test_cohorts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    test_type TEXT NOT NULL DEFAULT 'default',
    percentage INTEGER NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    config JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ab_test_cohorts_test_type ON ab_test_cohorts(test_type);
CREATE INDEX IF NOT EXISTS idx_ab_test_cohorts_active ON ab_test_cohorts(is_active);

CREATE TABLE IF NOT EXISTS user_cohort_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    cohort_id TEXT NOT NULL REFERENCES ab_test_cohorts(id),
    test_type TEXT NOT NULL DEFAULT 'default',
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB,
    UNIQUE(user_id, test_type)
);

CREATE INDEX IF NOT EXISTS idx_user_cohort_assignments_user_id ON user_cohort_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cohort_assignments_cohort_id ON user_cohort_assignments(cohort_id);
CREATE INDEX IF NOT EXISTS idx_user_cohort_assignments_test_type ON user_cohort_assignments(test_type);

CREATE TABLE IF NOT EXISTS ab_test_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    cohort_id TEXT NOT NULL,
    test_type TEXT NOT NULL DEFAULT 'default',
    metric TEXT NOT NULL,
    value DECIMAL NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_ab_test_results_user_id ON ab_test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_results_cohort_id ON ab_test_results(cohort_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_results_test_type ON ab_test_results(test_type);
CREATE INDEX IF NOT EXISTS idx_ab_test_results_metric ON ab_test_results(metric);
CREATE INDEX IF NOT EXISTS idx_ab_test_results_timestamp ON ab_test_results(timestamp);

-- Message Templates Table
CREATE TABLE IF NOT EXISTS message_templates (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('recap', 'alert', 'command_response', 'notification')),
    cohort_id TEXT NOT NULL,
    template TEXT NOT NULL,
    variables TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_type ON message_templates(type);
CREATE INDEX IF NOT EXISTS idx_message_templates_cohort_id ON message_templates(cohort_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_active ON message_templates(is_active);

-- Feedback System Tables
CREATE TABLE IF NOT EXISTS feedback_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id TEXT NOT NULL UNIQUE,
    message_type TEXT NOT NULL CHECK (message_type IN ('recap', 'alert', 'notification', 'command_response')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_messages_message_id ON feedback_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_feedback_messages_type ON feedback_messages(message_type);

CREATE TABLE IF NOT EXISTS message_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    message_type TEXT NOT NULL,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative', 'neutral')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB,
    UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_feedback_message_id ON message_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_user_id ON message_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_type ON message_feedback(message_type);
CREATE INDEX IF NOT EXISTS idx_message_feedback_feedback_type ON message_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_message_feedback_timestamp ON message_feedback(timestamp);

-- Enhanced User Profiles (add missing columns if they don't exist)
DO $$ 
BEGIN
    -- Add betting statistics columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'win_rate') THEN
        ALTER TABLE user_profiles ADD COLUMN win_rate DECIMAL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'roi') THEN
        ALTER TABLE user_profiles ADD COLUMN roi DECIMAL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'total_picks') THEN
        ALTER TABLE user_profiles ADD COLUMN total_picks INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'streak') THEN
        ALTER TABLE user_profiles ADD COLUMN streak INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'total_units') THEN
        ALTER TABLE user_profiles ADD COLUMN total_units DECIMAL DEFAULT 0;
    END IF;
END $$;

-- Enhanced Engagement Tracking
CREATE TABLE IF NOT EXISTS engagement_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    channel_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_tracking_user_id ON engagement_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_tracking_event_type ON engagement_tracking(event_type);
CREATE INDEX IF NOT EXISTS idx_engagement_tracking_created_at ON engagement_tracking(created_at);

-- Command Usage Analytics
CREATE TABLE IF NOT EXISTS command_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    command_name TEXT NOT NULL,
    user_id TEXT NOT NULL,
    guild_id TEXT,
    channel_id TEXT,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    execution_time INTEGER, -- milliseconds
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_command_usage_command_name ON command_usage(command_name);
CREATE INDEX IF NOT EXISTS idx_command_usage_user_id ON command_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_command_usage_created_at ON command_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_command_usage_success ON command_usage(success);

-- System Configuration Table
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

-- Insert default configurations
INSERT INTO system_config (key, value, description) VALUES 
    ('monitoring_enabled', 'true', 'Enable agent monitoring system'),
    ('ab_testing_enabled', 'true', 'Enable A/B testing framework'),
    ('feedback_enabled', 'true', 'Enable user feedback collection'),
    ('auto_command_sync', 'true', 'Enable automatic slash command synchronization')
ON CONFLICT (key) DO NOTHING;

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at columns
DROP TRIGGER IF EXISTS update_message_templates_updated_at ON message_templates;
CREATE TRIGGER update_message_templates_updated_at 
    BEFORE UPDATE ON message_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_config_updated_at ON system_config;
CREATE TRIGGER update_system_config_updated_at 
    BEFORE UPDATE ON system_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for analytics
CREATE OR REPLACE VIEW agent_health_summary AS
SELECT 
    agent_id,
    COUNT(*) as total_checks,
    COUNT(CASE WHEN status = 'healthy' THEN 1 END) as healthy_checks,
    COUNT(CASE WHEN status = 'error' THEN 1 END) as error_checks,
    ROUND(AVG(response_time), 2) as avg_response_time,
    MAX(timestamp) as last_check,
    ROUND(
        (COUNT(CASE WHEN status = 'healthy' THEN 1 END)::DECIMAL / COUNT(*)) * 100, 
        2
    ) as health_percentage
FROM agent_health_checks 
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY agent_id;

CREATE OR REPLACE VIEW feedback_summary AS
SELECT 
    message_type,
    COUNT(*) as total_feedback,
    COUNT(CASE WHEN feedback_type = 'positive' THEN 1 END) as positive_count,
    COUNT(CASE WHEN feedback_type = 'negative' THEN 1 END) as negative_count,
    COUNT(CASE WHEN feedback_type = 'neutral' THEN 1 END) as neutral_count,
    ROUND(
        (COUNT(CASE WHEN feedback_type = 'positive' THEN 1 END)::DECIMAL / COUNT(*)) * 100, 
        2
    ) as positive_rate
FROM message_feedback 
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY message_type;

CREATE OR REPLACE VIEW user_engagement_summary AS
SELECT 
    u.tier,
    COUNT(*) as user_count,
    COUNT(CASE WHEN u.is_active THEN 1 END) as active_users,
    ROUND(AVG((u.stats->>'totalMessages')::INTEGER), 2) as avg_messages,
    ROUND(AVG((u.stats->>'activityScore')::INTEGER), 2) as avg_activity_score
FROM user_profiles u
GROUP BY u.tier;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_bot_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_bot_user;