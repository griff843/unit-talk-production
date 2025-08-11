-- =============================================================================
-- SAAS-LEVEL DATABASE IMPLEMENTATION
-- Unit Talk Production Platform
-- =============================================================================

-- PHASE 1: CRITICAL FOUNDATION TABLES
-- =============================================================================

-- 1. UNIFIED USERS TABLE (Consolidates user_profiles + cappers)
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  discord_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  email TEXT,
  
  -- Subscription & Tier
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'vip', 'vip_plus')),
  subscription_status TEXT NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'cancelled', 'trial', 'suspended')),
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium', 'vip', 'enterprise')),
  subscription_expires_at TIMESTAMPTZ,
  
  -- Performance Metrics
  total_picks INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  pushes INTEGER DEFAULT 0,
  win_rate NUMERIC GENERATED ALWAYS AS (
    CASE WHEN (wins + losses) > 0 
    THEN ROUND(wins::NUMERIC / (wins + losses), 4)
    ELSE 0 END
  ) STORED,
  roi NUMERIC DEFAULT 0,
  units_won NUMERIC DEFAULT 0,
  
  -- Streaks
  streak_current INTEGER DEFAULT 0,
  streak_type TEXT CHECK (streak_type IN ('win', 'loss', 'none')) DEFAULT 'none',
  streak_best INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  
  -- Preferences & Settings
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'en',
  notification_preferences JSONB DEFAULT '{}',
  privacy_settings JSONB DEFAULT '{}',
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

-- 2. UNIFIED PICKS TABLE (Consolidates picks + daily_picks + final_picks)
-- =============================================================================
CREATE TABLE IF NOT EXISTS unified_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prop_id UUID REFERENCES raw_props(id) ON DELETE SET NULL,
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  
  -- Pick Details
  pick_type TEXT NOT NULL CHECK (pick_type IN ('single', 'parlay', 'system', 'teaser')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'push', 'void', 'cancelled')),
  
  -- Betting Information
  selection TEXT NOT NULL,
  line NUMERIC,
  odds NUMERIC NOT NULL,
  stake NUMERIC NOT NULL,
  potential_payout NUMERIC NOT NULL,
  actual_payout NUMERIC DEFAULT 0,
  profit_loss NUMERIC DEFAULT 0,
  
  -- Analysis & Confidence
  confidence INTEGER CHECK (confidence BETWEEN 1 AND 10),
  analysis TEXT,
  reasoning TEXT,
  tier_when_placed TEXT,
  
  -- Timing
  placed_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  game_start_time TIMESTAMPTZ,
  
  -- Settlement
  settlement_source TEXT,
  settlement_details JSONB,
  actual_result NUMERIC,
  
  -- Parlay Support
  parlay_id UUID, -- Groups related picks
  parlay_leg_number INTEGER,
  parlay_total_legs INTEGER,
  parlay_total_odds NUMERIC,
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Audit
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- 3. AGENT MANAGEMENT SYSTEM
-- =============================================================================
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Agent Identity
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- 'feed', 'grading', 'analytics', etc.
  version TEXT NOT NULL,
  description TEXT,
  
  -- Status & Health
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error', 'maintenance', 'disabled')),
  health_score NUMERIC DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
  last_heartbeat TIMESTAMPTZ,
  
  -- Configuration
  config JSONB NOT NULL DEFAULT '{}',
  environment TEXT DEFAULT 'production',
  
  -- Scheduling
  schedule_cron TEXT,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  
  -- Performance
  success_rate NUMERIC DEFAULT 100,
  average_duration INTERVAL,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  
  -- Metrics
  performance_metrics JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  
  -- Execution Details
  execution_type TEXT NOT NULL, -- 'scheduled', 'manual', 'triggered'
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled', 'timeout')),
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration INTERVAL GENERATED ALWAYS AS (completed_at - started_at) STORED,
  
  -- Data
  input_data JSONB,
  output_data JSONB,
  
  -- Results
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  
  -- Error Handling
  error_details JSONB,
  error_message TEXT,
  stack_trace TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Performance
  memory_usage_mb NUMERIC,
  cpu_usage_percent NUMERIC,
  
  -- Logs
  logs TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- 4. DISCORD INTEGRATION
-- =============================================================================
CREATE TABLE IF NOT EXISTS discord_guilds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Discord Identity
  guild_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  
  -- Configuration
  settings JSONB DEFAULT '{}',
  active_channels JSONB DEFAULT '[]',
  bot_permissions JSONB DEFAULT '{}',
  
  -- Features
  features_enabled JSONB DEFAULT '{}',
  premium_features BOOLEAN DEFAULT FALSE,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'banned')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS discord_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  guild_id UUID NOT NULL REFERENCES discord_guilds(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  pick_id UUID REFERENCES unified_picks(id) ON DELETE SET NULL,
  
  -- Discord Identity
  thread_id TEXT UNIQUE NOT NULL,
  channel_id TEXT NOT NULL,
  parent_message_id TEXT,
  
  -- Thread Details
  title TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'locked', 'deleted')),
  
  -- Engagement
  participant_count INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- 5. ANALYTICS & REPORTING
-- =============================================================================
CREATE TABLE IF NOT EXISTS analytics_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Dimensions
  date DATE NOT NULL,
  metric_type TEXT NOT NULL, -- 'user_activity', 'pick_performance', 'revenue', etc.
  category TEXT, -- Additional grouping
  
  -- Optional Filters
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT,
  sport TEXT,
  
  -- Metrics
  value NUMERIC NOT NULL,
  count INTEGER,
  trend NUMERIC, -- Percentage change from previous period
  comparison_value NUMERIC, -- Previous period value
  
  -- Breakdown
  breakdown JSONB, -- Detailed metrics
  
  -- Timestamps
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- 6. SYSTEM CONFIGURATION
-- =============================================================================
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Configuration
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  category TEXT NOT NULL,
  
  -- Environment
  environment TEXT DEFAULT 'production',
  version TEXT,
  
  -- Validation
  validation_schema JSONB,
  is_sensitive BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Audit
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Flag Details
  flag_name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT FALSE,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  
  -- Targeting
  target_users JSONB DEFAULT '[]',
  target_tiers JSONB DEFAULT '[]',
  target_environments JSONB DEFAULT '["production"]',
  
  -- Scheduling
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  
  -- Metrics
  usage_count INTEGER DEFAULT 0,
  success_rate NUMERIC DEFAULT 100,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Audit
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}'
);

-- 7. AUDIT & COMPLIANCE
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Actor
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,
  
  -- Action
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', etc.
  resource_type TEXT NOT NULL, -- 'user', 'pick', 'game', etc.
  resource_id TEXT, -- ID of the affected resource
  
  -- Changes
  old_values JSONB,
  new_values JSONB,
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  
  -- Compliance
  compliance_flags JSONB DEFAULT '{}',
  retention_until TIMESTAMPTZ,
  
  -- Timestamp
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Users
CREATE INDEX idx_users_discord_id ON users(discord_id);
CREATE INDEX idx_users_tier_status ON users(tier, subscription_status);
CREATE INDEX idx_users_performance ON users(win_rate DESC, roi DESC);
CREATE INDEX idx_users_active ON users(last_active) WHERE deleted_at IS NULL;

-- Unified Picks
CREATE INDEX idx_unified_picks_user_status ON unified_picks(user_id, status);
CREATE INDEX idx_unified_picks_placed_at ON unified_picks(placed_at DESC);
CREATE INDEX idx_unified_picks_game_id ON unified_picks(game_id);
CREATE INDEX idx_unified_picks_prop_id ON unified_picks(prop_id);
CREATE INDEX idx_unified_picks_parlay ON unified_picks(parlay_id) WHERE parlay_id IS NOT NULL;

-- Agents
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_next_run ON agents(next_run) WHERE status = 'active';
CREATE INDEX idx_agent_executions_agent_status ON agent_executions(agent_id, status);
CREATE INDEX idx_agent_executions_started_at ON agent_executions(started_at DESC);

-- Discord
CREATE INDEX idx_discord_guilds_guild_id ON discord_guilds(guild_id);
CREATE INDEX idx_discord_threads_thread_id ON discord_threads(thread_id);
CREATE INDEX idx_discord_threads_game_id ON discord_threads(game_id);

-- Analytics
CREATE INDEX idx_analytics_summary_date_type ON analytics_summary(date, metric_type);
CREATE INDEX idx_analytics_summary_user_id ON analytics_summary(user_id) WHERE user_id IS NOT NULL;

-- System
CREATE INDEX idx_system_config_key ON system_config(key);
CREATE INDEX idx_feature_flags_enabled ON feature_flags(flag_name) WHERE enabled = TRUE;

-- Audit
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- =============================================================================
-- TRIGGERS FOR AUTOMATION
-- =============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_unified_picks_updated_at BEFORE UPDATE ON unified_picks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_discord_guilds_updated_at BEFORE UPDATE ON discord_guilds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_discord_threads_updated_at BEFORE UPDATE ON discord_threads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON feature_flags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Success message
SELECT 
  '🎉 SaaS-Level Database Architecture Implemented!' as status,
  'Core tables created with enterprise-grade structure' as message,
  NOW() as completed_at;
