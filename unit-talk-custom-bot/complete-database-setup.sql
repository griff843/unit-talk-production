-- Complete Database Setup for Unit Talk Discord Bot
-- Run this script in your Supabase SQL Editor

-- =====================================================
-- CORE TABLES
-- =====================================================

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  discord_id TEXT NOT NULL UNIQUE,
  username TEXT,
  avatar_url TEXT,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'vip', 'vip_plus')),
  total_picks INTEGER DEFAULT 0,
  winning_picks INTEGER DEFAULT 0,
  losing_picks INTEGER DEFAULT 0,
  pending_picks INTEGER DEFAULT 0,
  total_units DECIMAL DEFAULT 0,
  units_won DECIMAL DEFAULT 0,
  units_lost DECIMAL DEFAULT 0,
  win_rate DECIMAL DEFAULT 0,
  roi DECIMAL DEFAULT 0,
  streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  worst_streak INTEGER DEFAULT 0,
  average_odds DECIMAL DEFAULT 0,
  total_profit DECIMAL DEFAULT 0,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Picks table
CREATE TABLE IF NOT EXISTS picks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  discord_id TEXT NOT NULL,
  pick_text TEXT NOT NULL,
  sport TEXT,
  bet_type TEXT,
  odds DECIMAL,
  units DECIMAL DEFAULT 1,
  confidence TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'void')),
  channel_id TEXT,
  message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  graded_at TIMESTAMPTZ,
  graded_by TEXT
);

-- =====================================================
-- ONBOARDING SYSTEM TABLES
-- =====================================================

-- Onboarding Configuration Table
CREATE TABLE IF NOT EXISTS onboarding_config (
  id TEXT PRIMARY KEY DEFAULT 'main',
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Onboarding Flows Table (MISSING FROM ORIGINAL SCHEMA)
CREATE TABLE IF NOT EXISTS onboarding_flows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  flow_data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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

-- =====================================================
-- FORTUNE 100 ENHANCEMENT TABLES
-- =====================================================

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

CREATE TABLE IF NOT EXISTS user_cohort_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  cohort_id TEXT NOT NULL REFERENCES ab_test_cohorts(id),
  test_type TEXT NOT NULL DEFAULT 'default',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB,
  UNIQUE(user_id, test_type)
);

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

-- Feedback System Tables
CREATE TABLE IF NOT EXISTS feedback_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  message_type TEXT NOT NULL CHECK (message_type IN ('recap', 'alert', 'notification', 'command_response')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_message_id UUID NOT NULL REFERENCES feedback_messages(id),
  user_id TEXT NOT NULL,
  response_type TEXT NOT NULL CHECK (response_type IN ('thumbs_up', 'thumbs_down', 'star_rating')),
  response_value INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bot Configuration Table
CREATE TABLE IF NOT EXISTS bot_config (
  id TEXT PRIMARY KEY DEFAULT 'main',
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_discord_id ON user_profiles(discord_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tier ON user_profiles(tier);

-- Picks indexes
CREATE INDEX IF NOT EXISTS idx_picks_discord_id ON picks(discord_id);
CREATE INDEX IF NOT EXISTS idx_picks_status ON picks(status);
CREATE INDEX IF NOT EXISTS idx_picks_created_at ON picks(created_at);

-- Onboarding indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_flows_active ON onboarding_flows(is_active);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user_id ON onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_status ON onboarding_progress(status);

-- Agent health indexes
CREATE INDEX IF NOT EXISTS idx_agent_health_checks_agent_id ON agent_health_checks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_health_checks_timestamp ON agent_health_checks(timestamp);
CREATE INDEX IF NOT EXISTS idx_agent_health_checks_status ON agent_health_checks(status);

-- Agent notifications indexes
CREATE INDEX IF NOT EXISTS idx_agent_notifications_agent_id ON agent_notifications(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_notifications_processed ON agent_notifications(processed);
CREATE INDEX IF NOT EXISTS idx_agent_notifications_created_at ON agent_notifications(created_at);

-- A/B testing indexes
CREATE INDEX IF NOT EXISTS idx_ab_test_cohorts_test_type ON ab_test_cohorts(test_type);
CREATE INDEX IF NOT EXISTS idx_ab_test_cohorts_active ON ab_test_cohorts(is_active);
CREATE INDEX IF NOT EXISTS idx_user_cohort_assignments_user_id ON user_cohort_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cohort_assignments_cohort_id ON user_cohort_assignments(cohort_id);
CREATE INDEX IF NOT EXISTS idx_user_cohort_assignments_test_type ON user_cohort_assignments(test_type);
CREATE INDEX IF NOT EXISTS idx_ab_test_results_user_id ON ab_test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_results_cohort_id ON ab_test_results(cohort_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_results_test_type ON ab_test_results(test_type);
CREATE INDEX IF NOT EXISTS idx_ab_test_results_metric ON ab_test_results(metric);
CREATE INDEX IF NOT EXISTS idx_ab_test_results_timestamp ON ab_test_results(timestamp);

-- Message templates indexes
CREATE INDEX IF NOT EXISTS idx_message_templates_type ON message_templates(type);
CREATE INDEX IF NOT EXISTS idx_message_templates_cohort_id ON message_templates(cohort_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_active ON message_templates(is_active);

-- =====================================================
-- DEFAULT DATA INSERTION
-- =====================================================

-- Insert default onboarding configuration
INSERT INTO onboarding_config (id, config, is_active) 
VALUES (
  'main',
  '{
    "welcomeMessage": "Welcome to Unit Talk! 🎉",
    "steps": ["welcome", "role_selection", "channel_intro", "first_pick"],
    "features": {
      "dmNotifications": true,
      "autoThreads": true,
      "analytics": true
    },
    "channels": {
      "welcome": "1288606775121285273",
      "general": "1288606775121285273",
      "freePicks": "1289720383767056405"
    }
  }',
  true
) ON CONFLICT (id) DO UPDATE SET 
  config = EXCLUDED.config,
  updated_at = NOW();

-- Insert default onboarding flow
INSERT INTO onboarding_flows (id, name, description, flow_data, is_active) 
VALUES (
  'default',
  'Default Onboarding Flow',
  'Standard onboarding process for new members',
  '{
    "steps": [
      {
        "id": "welcome",
        "type": "message",
        "content": "Welcome to Unit Talk! Let''s get you started. 🚀",
        "actions": ["continue"]
      },
      {
        "id": "role_selection",
        "type": "role_select",
        "content": "Please select your membership tier:",
        "options": ["Free", "VIP", "VIP+"]
      },
      {
        "id": "channel_intro",
        "type": "message",
        "content": "Great! Here are the key channels you should know about:",
        "actions": ["continue"]
      },
      {
        "id": "first_pick",
        "type": "message",
        "content": "Ready to make your first pick? Check out our daily picks channels!",
        "actions": ["complete"]
      }
    ]
  }',
  true
) ON CONFLICT (id) DO UPDATE SET 
  flow_data = EXCLUDED.flow_data,
  updated_at = NOW();

-- Insert default bot configuration
INSERT INTO bot_config (id, config, is_active) 
VALUES (
  'main',
  '{
    "features": {
      "autoGrading": true,
      "dmNotifications": true,
      "analytics": true,
      "threadManagement": true
    },
    "limits": {
      "maxPicksPerDay": 10,
      "maxDMsPerHour": 5,
      "maxThreadsPerDay": 20
    },
    "cooldowns": {
      "picks": 3600000,
      "commands": 5000,
      "dms": 600000
    }
  }',
  true
) ON CONFLICT (id) DO UPDATE SET 
  config = EXCLUDED.config,
  updated_at = NOW();