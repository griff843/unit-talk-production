-- Missing Tables Migration Script
-- This script creates all tables that are referenced in the codebase but missing from the current schema

-- User Profiles Table (Most critical - heavily referenced)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id TEXT NOT NULL UNIQUE,
    username TEXT,
    discriminator TEXT,
    avatar TEXT,
    tier TEXT DEFAULT 'member' CHECK (tier IN ('member', 'vip', 'vip_plus', 'staff', 'admin', 'owner')),
    subscription_tier TEXT DEFAULT 'FREE' CHECK (subscription_tier IN ('FREE', 'PREMIUM', 'VIP', 'VIP_PLUS')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Game Threads Table (Critical for thread management)
CREATE TABLE IF NOT EXISTS game_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    sport TEXT NOT NULL,
    teams TEXT[] NOT NULL,
    game_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    pick_count INTEGER DEFAULT 0,
    user_count INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT false,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(game_id)
);

-- User Picks Table
CREATE TABLE IF NOT EXISTS user_picks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    discord_id TEXT NOT NULL,
    game_id TEXT,
    thread_id TEXT,
    pick_type TEXT NOT NULL,
    player_name TEXT,
    stat_type TEXT,
    line DECIMAL,
    over_under TEXT CHECK (over_under IN ('over', 'under')),
    odds INTEGER,
    stake DECIMAL DEFAULT 1.0,
    confidence INTEGER CHECK (confidence >= 1 AND confidence <= 5),
    reasoning TEXT,
    result TEXT CHECK (result IN ('win', 'loss', 'push', 'pending')) DEFAULT 'pending',
    actual_value DECIMAL,
    profit_loss DECIMAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Thread Stats Table
CREATE TABLE IF NOT EXISTS thread_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    total_picks INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    messages_count INTEGER DEFAULT 0,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(thread_id)
);

-- Thread Followers Table
CREATE TABLE IF NOT EXISTS thread_followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    discord_id TEXT NOT NULL,
    followed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notifications_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(thread_id, user_id)
);

-- User Cooldowns Table
CREATE TABLE IF NOT EXISTS user_cooldowns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    discord_id TEXT NOT NULL,
    command_type TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, command_type)
);

-- Pick Gradings Table
CREATE TABLE IF NOT EXISTS pick_gradings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pick_id UUID NOT NULL,
    user_id TEXT NOT NULL,
    grade TEXT CHECK (grade IN ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F')),
    reasoning TEXT,
    confidence_score INTEGER CHECK (confidence_score >= 1 AND confidence_score <= 10),
    edge_analysis JSONB DEFAULT '{}',
    graded_by TEXT NOT NULL,
    graded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (pick_id) REFERENCES user_picks(id) ON DELETE CASCADE
);

-- Coaching Sessions Table
CREATE TABLE IF NOT EXISTS coaching_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    discord_id TEXT NOT NULL,
    coach_id TEXT NOT NULL,
    session_type TEXT NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    notes TEXT,
    feedback JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Message Feedback Table
CREATE TABLE IF NOT EXISTS message_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('helpful', 'not_helpful', 'spam', 'inappropriate')),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Feedback Messages Table
CREATE TABLE IF NOT EXISTS feedback_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    discord_id TEXT NOT NULL,
    feedback_type TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to TEXT,
    response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Config Edit Sessions Table
CREATE TABLE IF NOT EXISTS config_edit_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    config_type TEXT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    changes JSONB DEFAULT '[]',
    current_config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Config Changes Table
CREATE TABLE IF NOT EXISTS config_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    field_path TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES config_edit_sessions(id) ON DELETE CASCADE
);

-- Agent Health Checks Table
CREATE TABLE IF NOT EXISTS agent_health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'critical', 'offline')),
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    response_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Keyword Triggers Table
CREATE TABLE IF NOT EXISTS keyword_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    response_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    match_type TEXT DEFAULT 'contains' CHECK (match_type IN ('exact', 'contains', 'starts_with', 'ends_with')),
    case_sensitive BOOLEAN DEFAULT false,
    cooldown_minutes INTEGER DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Emoji Triggers Table
CREATE TABLE IF NOT EXISTS emoji_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    emoji TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    response_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    cooldown_minutes INTEGER DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auto DM Templates Table
CREATE TABLE IF NOT EXISTS auto_dm_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name TEXT NOT NULL,
    template_type TEXT NOT NULL,
    content JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(template_name)
);

-- Trigger Activation Logs Table
CREATE TABLE IF NOT EXISTS trigger_activation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_id UUID NOT NULL,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('keyword', 'emoji')),
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    triggered_content TEXT NOT NULL,
    response_sent BOOLEAN DEFAULT false,
    response_message_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VIP Notification Sequences Table
CREATE TABLE IF NOT EXISTS vip_notification_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_name TEXT NOT NULL,
    sequence_type TEXT NOT NULL,
    steps JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(sequence_name)
);

-- VIP Welcome Flows Table
CREATE TABLE IF NOT EXISTS vip_welcome_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_name TEXT NOT NULL,
    tier_level TEXT NOT NULL,
    welcome_message JSONB NOT NULL,
    follow_up_sequence UUID,
    is_active BOOLEAN DEFAULT true,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (follow_up_sequence) REFERENCES vip_notification_sequences(id),
    UNIQUE(flow_name)
);

-- Notification Logs Table
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    sequence_id UUID,
    step_number INTEGER,
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending', 'cancelled')),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_discord_id ON user_profiles(discord_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tier ON user_profiles(tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_active ON user_profiles(last_active);

CREATE INDEX IF NOT EXISTS idx_game_threads_game_id ON game_threads(game_id);
CREATE INDEX IF NOT EXISTS idx_game_threads_is_active ON game_threads(is_active);
CREATE INDEX IF NOT EXISTS idx_game_threads_sport ON game_threads(sport);
CREATE INDEX IF NOT EXISTS idx_game_threads_last_activity ON game_threads(last_activity);

CREATE INDEX IF NOT EXISTS idx_user_picks_user_id ON user_picks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_picks_discord_id ON user_picks(discord_id);
CREATE INDEX IF NOT EXISTS idx_user_picks_game_id ON user_picks(game_id);
CREATE INDEX IF NOT EXISTS idx_user_picks_result ON user_picks(result);
CREATE INDEX IF NOT EXISTS idx_user_picks_created_at ON user_picks(created_at);

CREATE INDEX IF NOT EXISTS idx_thread_stats_thread_id ON thread_stats(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_followers_thread_id ON thread_followers(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_followers_user_id ON thread_followers(user_id);

CREATE INDEX IF NOT EXISTS idx_user_cooldowns_user_id ON user_cooldowns(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cooldowns_expires_at ON user_cooldowns(expires_at);

CREATE INDEX IF NOT EXISTS idx_pick_gradings_pick_id ON pick_gradings(pick_id);
CREATE INDEX IF NOT EXISTS idx_pick_gradings_user_id ON pick_gradings(user_id);

CREATE INDEX IF NOT EXISTS idx_coaching_sessions_user_id ON coaching_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_status ON coaching_sessions(status);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_scheduled_at ON coaching_sessions(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_message_feedback_message_id ON message_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_feedback_messages_user_id ON feedback_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_messages_status ON feedback_messages(status);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_config_edit_sessions_user_id ON config_edit_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_config_changes_session_id ON config_changes(session_id);

CREATE INDEX IF NOT EXISTS idx_agent_health_checks_agent_id ON agent_health_checks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_health_checks_status ON agent_health_checks(status);

CREATE INDEX IF NOT EXISTS idx_keyword_triggers_keyword ON keyword_triggers(keyword);
CREATE INDEX IF NOT EXISTS idx_keyword_triggers_is_active ON keyword_triggers(is_active);
CREATE INDEX IF NOT EXISTS idx_emoji_triggers_emoji ON emoji_triggers(emoji);
CREATE INDEX IF NOT EXISTS idx_emoji_triggers_is_active ON emoji_triggers(is_active);

CREATE INDEX IF NOT EXISTS idx_trigger_activation_logs_trigger_id ON trigger_activation_logs(trigger_id);
CREATE INDEX IF NOT EXISTS idx_trigger_activation_logs_user_id ON trigger_activation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_trigger_activation_logs_created_at ON trigger_activation_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_vip_notification_sequences_is_active ON vip_notification_sequences(is_active);
CREATE INDEX IF NOT EXISTS idx_vip_welcome_flows_tier_level ON vip_welcome_flows(tier_level);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_game_threads_updated_at BEFORE UPDATE ON game_threads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_picks_updated_at BEFORE UPDATE ON user_picks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_thread_stats_updated_at BEFORE UPDATE ON thread_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_coaching_sessions_updated_at BEFORE UPDATE ON coaching_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_feedback_messages_updated_at BEFORE UPDATE ON feedback_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_config_edit_sessions_updated_at BEFORE UPDATE ON config_edit_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agent_health_checks_updated_at BEFORE UPDATE ON agent_health_checks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_keyword_triggers_updated_at BEFORE UPDATE ON keyword_triggers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_emoji_triggers_updated_at BEFORE UPDATE ON emoji_triggers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_auto_dm_templates_updated_at BEFORE UPDATE ON auto_dm_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vip_notification_sequences_updated_at BEFORE UPDATE ON vip_notification_sequences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vip_welcome_flows_updated_at BEFORE UPDATE ON vip_welcome_flows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();