-- Unit Talk Discord Bot - Required Database Tables
-- Run these queries in your Supabase SQL Editor

-- 1. ONBOARDING_CONFIG TABLE (Critical - Bot failing without this)
CREATE TABLE IF NOT EXISTS onboarding_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    welcome_channel_id TEXT,
    role_assignment_enabled BOOLEAN DEFAULT true,
    default_role_id TEXT,
    welcome_message TEXT DEFAULT 'Welcome to Unit Talk! 🎉',
    onboarding_flow_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ONBOARDING_FLOWS TABLE (Critical - Bot failing without this)
CREATE TABLE IF NOT EXISTS onboarding_flows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    steps JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. USER_PROFILES TABLE
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    discord_id TEXT UNIQUE NOT NULL,
    username TEXT,
    display_name TEXT,
    email TEXT,
    subscription_tier TEXT DEFAULT 'free',
    preferences JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ONBOARDING_PROGRESS TABLE
CREATE TABLE IF NOT EXISTS onboarding_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    flow_id UUID REFERENCES onboarding_flows(id) ON DELETE CASCADE,
    current_step INTEGER DEFAULT 0,
    completed_steps JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'in_progress',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. PICKS TABLE
CREATE TABLE IF NOT EXISTS picks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    game_id TEXT,
    pick_type TEXT,
    selection TEXT,
    odds DECIMAL(10,2),
    stake DECIMAL(10,2),
    potential_payout DECIMAL(10,2),
    status TEXT DEFAULT 'pending',
    placed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settled_at TIMESTAMP WITH TIME ZONE,
    result TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 6. USER_SETTINGS TABLE
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, setting_key)
);

-- 7. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT,
    message TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. AUDIT_LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. ANALYTICS_EVENTS TABLE
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    session_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. CONTESTS TABLE
CREATE TABLE IF NOT EXISTS contests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    prize_pool DECIMAL(10,2),
    entry_fee DECIMAL(10,2) DEFAULT 0,
    max_participants INTEGER,
    rules JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'upcoming',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. CONTEST_PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS contest_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contest_id UUID REFERENCES contests(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    entry_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    score DECIMAL(10,2) DEFAULT 0,
    rank INTEGER,
    UNIQUE(contest_id, user_id)
);

-- 12. LEADERBOARDS TABLE
CREATE TABLE IF NOT EXISTS leaderboards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'all_time'
    metric_type TEXT NOT NULL, -- 'profit', 'roi', 'win_rate', etc.
    value DECIMAL(15,4),
    rank INTEGER,
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, period, metric_type)
);

-- 13. DISCORD_CHANNELS TABLE
CREATE TABLE IF NOT EXISTS discord_channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id TEXT UNIQUE NOT NULL,
    guild_id TEXT NOT NULL,
    channel_name TEXT,
    channel_type TEXT,
    purpose TEXT,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. DISCORD_MESSAGES TABLE
CREATE TABLE IF NOT EXISTS discord_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id TEXT UNIQUE NOT NULL,
    channel_id TEXT NOT NULL,
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    discord_user_id TEXT,
    content TEXT,
    message_type TEXT DEFAULT 'user',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. BOT_COMMANDS TABLE
CREATE TABLE IF NOT EXISTS bot_commands (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    command_name TEXT NOT NULL,
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    discord_user_id TEXT,
    channel_id TEXT,
    parameters JSONB DEFAULT '{}'::jsonb,
    response_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INSERT DEFAULT DATA

-- Insert default onboarding config
INSERT INTO onboarding_config (
    welcome_message,
    role_assignment_enabled,
    is_active
) VALUES (
    'Welcome to Unit Talk! 🎉 Get ready for premium betting insights and community discussions.',
    true,
    true
) ON CONFLICT DO NOTHING;

-- Insert default onboarding flow
INSERT INTO onboarding_flows (
    name,
    description,
    steps,
    is_active
) VALUES (
    'Default Welcome Flow',
    'Standard onboarding process for new members',
    '[
        {
            "id": 1,
            "type": "welcome",
            "title": "Welcome to Unit Talk!",
            "description": "Thanks for joining our community"
        },
        {
            "id": 2,
            "type": "role_assignment",
            "title": "Role Assignment",
            "description": "Getting your member role"
        },
        {
            "id": 3,
            "type": "channel_introduction",
            "title": "Channel Tour",
            "description": "Learn about our channels"
        }
    ]'::jsonb,
    true
) ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_discord_id ON user_profiles(discord_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user_id ON onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_picks_user_id ON picks(user_id);
CREATE INDEX IF NOT EXISTS idx_picks_status ON picks(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_discord_messages_channel_id ON discord_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_bot_commands_command_name ON bot_commands(command_name);
CREATE INDEX IF NOT EXISTS idx_leaderboards_period_metric ON leaderboards(period, metric_type);

-- Enable Row Level Security (RLS) for sensitive tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic examples - adjust based on your needs)
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid()::text = discord_id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid()::text = discord_id);

-- Grant necessary permissions to service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;