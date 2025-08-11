-- Onboarding Configuration Table
CREATE TABLE IF NOT EXISTS onboarding_config (
    id TEXT PRIMARY KEY DEFAULT 'main',
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Onboarding Progress Tracking
CREATE TABLE IF NOT EXISTS onboarding_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    flow_type TEXT NOT NULL,
    current_step TEXT,
    step_data JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, guild_id)
);

-- DM Delivery Failures
CREATE TABLE IF NOT EXISTS dm_failures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    step TEXT NOT NULL,
    failure_reason TEXT NOT NULL,
    error_message TEXT,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    retry_count INTEGER DEFAULT 0,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics Events
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_id TEXT,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Journeys
CREATE TABLE IF NOT EXISTS user_journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned', 'failed')),
    flow_type TEXT NOT NULL,
    steps JSONB DEFAULT '[]',
    total_duration INTEGER, -- in milliseconds
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, guild_id)
);

-- Onboarding Flow Edits (Audit Trail)
CREATE TABLE IF NOT EXISTS onboarding_flow_edits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id TEXT NOT NULL,
    field TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    edited_by TEXT NOT NULL,
    edited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin Actions Log
CREATE TABLE IF NOT EXISTS admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    target_user_id TEXT,
    action_data JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    sports TEXT[] DEFAULT '{}',
    notification_level TEXT,
    experience_level TEXT,
    betting_style TEXT,
    bankroll_size TEXT,
    risk_tolerance TEXT,
    notification_timing TEXT,
    custom_preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, guild_id)
);

-- Onboarding Templates (for admin-editable content)
CREATE TABLE IF NOT EXISTS onboarding_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key TEXT NOT NULL,
    template_type TEXT NOT NULL, -- 'message', 'embed', 'button'
    content JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(template_key)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user_guild ON onboarding_progress(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_status ON onboarding_progress(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_flow_type ON onboarding_progress(flow_type);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_last_activity ON onboarding_progress(last_activity);

CREATE INDEX IF NOT EXISTS idx_dm_failures_user_guild ON dm_failures(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_dm_failures_resolved ON dm_failures(resolved);
CREATE INDEX IF NOT EXISTS idx_dm_failures_attempted_at ON dm_failures(attempted_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_guild ON analytics_events(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);

CREATE INDEX IF NOT EXISTS idx_user_journeys_user_guild ON user_journeys(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_user_journeys_status ON user_journeys(status);
CREATE INDEX IF NOT EXISTS idx_user_journeys_flow_type ON user_journeys(flow_type);
CREATE INDEX IF NOT EXISTS idx_user_journeys_started_at ON user_journeys(started_at);

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_user ON admin_actions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_guild ON admin_actions(guild_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_timestamp ON admin_actions(timestamp);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_guild ON user_preferences(user_id, guild_id);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_onboarding_config_updated_at BEFORE UPDATE ON onboarding_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_onboarding_progress_updated_at BEFORE UPDATE ON onboarding_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dm_failures_updated_at BEFORE UPDATE ON dm_failures FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_journeys_updated_at BEFORE UPDATE ON user_journeys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_onboarding_templates_updated_at BEFORE UPDATE ON onboarding_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default onboarding configuration
INSERT INTO onboarding_config (id, config, is_active) 
VALUES ('main', '{
  "flows": {
    "member": {
      "id": "member_onboarding",
      "name": "Member Onboarding",
      "description": "Standard onboarding flow for new members",
      "targetRole": "",
      "isActive": true,
      "triggers": {
        "autoStart": true
      },
      "steps": []
    }
  },
  "settings": {
    "dmRetryAttempts": 3,
    "dmRetryDelayMinutes": 5,
    "onboardingTimeoutHours": 24,
    "adminNotificationChannel": "",
    "welcomeChannelFallback": "",
    "enableAnalytics": true,
    "enablePreferenceCollection": true
  }
}', true)
ON CONFLICT (id) DO NOTHING;

-- Insert default templates
INSERT INTO onboarding_templates (template_key, template_type, content, is_active, created_by) VALUES
('welcome_message', 'embed', '{
  "title": "🎉 Welcome to Unit Talk!",
  "description": "We are excited to have you join our community of successful bettors.",
  "color": 45158,
  "fields": [
    {
      "name": "🎯 Our Mission",
      "value": "Help you make profitable betting decisions with expert analysis and proven strategies.",
      "inline": false
    }
  ],
  "footer": {
    "text": "Unit Talk - Your Betting Edge"
  }
}', true, 'system'),

('preference_message', 'embed', '{
  "title": "📊 Personalize Your Experience",
  "description": "Help us tailor Unit Talk to your betting style and preferences.",
  "color": 3447003,
  "footer": {
    "text": "Your preferences can be changed anytime"
  }
}', true, 'system'),

('completion_message', 'embed', '{
  "title": "🎉 Welcome to the Team!",
  "description": "Your onboarding is complete. You are ready to start winning!",
  "color": 2664261,
  "fields": [
    {
      "name": "🚀 What is Next?",
      "value": "Explore your channels, check out today picks, and join the conversation!",
      "inline": false
    }
  ],
  "footer": {
    "text": "Happy betting!"
  }
}', true, 'system')

ON CONFLICT (template_key) DO NOTHING;

-- Create views for common queries
CREATE OR REPLACE VIEW onboarding_stats AS
SELECT 
    flow_type,
    status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000) as avg_duration_ms
FROM user_journeys 
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY flow_type, status;

CREATE OR REPLACE VIEW dm_failure_stats AS
SELECT 
    failure_reason,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE resolved = false) as unresolved_count,
    AVG(retry_count) as avg_retry_count
FROM dm_failures 
WHERE attempted_at >= NOW() - INTERVAL '30 days'
GROUP BY failure_reason;

CREATE OR REPLACE VIEW daily_onboarding_metrics AS
SELECT 
    DATE(started_at) as date,
    COUNT(*) as started,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'abandoned') as abandoned,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    ROUND(
        (COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / COUNT(*)) * 100, 
        2
    ) as completion_rate
FROM user_journeys 
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(started_at)
ORDER BY date DESC;

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_bot_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_bot_user;