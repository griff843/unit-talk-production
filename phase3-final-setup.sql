-- =============================================================================
-- PHASE 3: FINAL SAAS SETUP & VALIDATION
-- Complete the transformation with enterprise features
-- =============================================================================

-- Step 1: Create additional SaaS infrastructure tables
-- =============================================================================

-- Agent management system
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- 'feed', 'grading', 'analytics', 'discord', 'settlement'
  version TEXT NOT NULL DEFAULT '1.0.0',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error', 'maintenance', 'disabled')),
  health_score NUMERIC DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
  last_heartbeat TIMESTAMPTZ,
  config JSONB NOT NULL DEFAULT '{}',
  environment TEXT DEFAULT 'production',
  schedule_cron TEXT,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  success_rate NUMERIC DEFAULT 100,
  average_duration INTERVAL,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  performance_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Discord integration
CREATE TABLE IF NOT EXISTS discord_guilds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  settings JSONB DEFAULT '{}',
  active_channels JSONB DEFAULT '[]',
  bot_permissions JSONB DEFAULT '{}',
  features_enabled JSONB DEFAULT '{}',
  premium_features BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'banned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS discord_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES discord_guilds(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  pick_id UUID REFERENCES unified_picks(id) ON DELETE SET NULL,
  thread_id TEXT UNIQUE NOT NULL,
  channel_id TEXT NOT NULL,
  parent_message_id TEXT,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'locked', 'deleted')),
  participant_count INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Analytics and reporting
CREATE TABLE IF NOT EXISTS analytics_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  metric_type TEXT NOT NULL, -- 'user_activity', 'pick_performance', 'revenue', etc.
  category TEXT,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT,
  sport TEXT,
  value NUMERIC NOT NULL,
  count INTEGER,
  trend NUMERIC,
  comparison_value NUMERIC,
  breakdown JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- System configuration
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  category TEXT NOT NULL,
  environment TEXT DEFAULT 'production',
  version TEXT,
  validation_schema JSONB,
  is_sensitive BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  description TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT FALSE,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  target_users JSONB DEFAULT '[]',
  target_tiers JSONB DEFAULT '[]',
  target_environments JSONB DEFAULT '["production"]',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  success_rate NUMERIC DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  description TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', etc.
  resource_type TEXT NOT NULL, -- 'user', 'pick', 'game', etc.
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  compliance_flags JSONB DEFAULT '{}',
  retention_until TIMESTAMPTZ,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Step 2: Create performance indexes for new tables (after all tables are created)
-- =============================================================================

-- Agents indexes
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_next_run ON agents(next_run) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);

-- Discord indexes
CREATE INDEX IF NOT EXISTS idx_discord_guilds_guild_id ON discord_guilds(guild_id);
CREATE INDEX IF NOT EXISTS idx_discord_threads_thread_id ON discord_threads(thread_id);
CREATE INDEX IF NOT EXISTS idx_discord_threads_game_id ON discord_threads(game_id);
CREATE INDEX IF NOT EXISTS idx_discord_threads_pick_id ON discord_threads(pick_id);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_summary_date_type ON analytics_summary(date, metric_type);
CREATE INDEX IF NOT EXISTS idx_analytics_summary_user_id ON analytics_summary(user_id) WHERE user_id IS NOT NULL;

-- System indexes
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(flag_name) WHERE enabled = TRUE;

-- Audit indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Step 3: Insert default system configuration
-- =============================================================================
INSERT INTO system_config (key, value, category, description) VALUES
('platform.name', '"Unit Talk"', 'general', 'Platform name'),
('platform.version', '"3.0.0"', 'general', 'Current platform version'),
('picks.max_confidence', '10', 'picks', 'Maximum confidence level for picks'),
('picks.min_stake', '0.1', 'picks', 'Minimum stake amount'),
('picks.max_stake', '100', 'picks', 'Maximum stake amount'),
('analytics.retention_days', '365', 'analytics', 'Days to retain analytics data'),
('discord.max_threads_per_game', '1', 'discord', 'Maximum threads per game'),
('agents.default_timeout', '300', 'agents', 'Default agent timeout in seconds'),
('tiers.available', '["members", "vip", "vip+", "black label"]', 'users', 'Available user tiers'),
('migration.completed_at', '"2025-08-03T16:52:44.072671Z"', 'system', 'SaaS migration completion timestamp')
ON CONFLICT (key) DO NOTHING;

-- Step 4: Insert default feature flags
-- =============================================================================
INSERT INTO feature_flags (flag_name, enabled, description) VALUES
('enhanced_scoring', true, 'Enable enhanced prop scoring system'),
('ml_predictions', false, 'Enable ML-based predictions'),
('real_time_odds', true, 'Enable real-time odds updates'),
('discord_integration', true, 'Enable Discord bot integration'),
('advanced_analytics', true, 'Enable advanced analytics features'),
('mobile_app', false, 'Enable mobile app features'),
('parlay_tracking', true, 'Enable advanced parlay leg tracking'),
('capper_tiers', true, 'Enable capper tier system')
ON CONFLICT (flag_name) DO NOTHING;

-- Step 5: Create enhanced compatibility views
-- =============================================================================

-- Enhanced cappers view with performance metrics
CREATE OR REPLACE VIEW cappers AS
SELECT 
  u.id,
  u.discord_id,
  u.username,
  u.display_name,
  u.tier,
  u.total_picks,
  u.wins,
  u.losses,
  u.pushes,
  u.win_rate,
  u.roi,
  u.units_won,
  u.streak_current,
  u.streak_type,
  u.created_at,
  u.updated_at,
  u.metadata,
  -- Enhanced fields
  u.capper_status as status,
  u.is_capper,
  CASE WHEN u.last_active > NOW() - INTERVAL '7 days' THEN true ELSE false END as is_active
FROM users u 
WHERE u.is_capper = TRUE;

-- Final picks view with enhanced data
CREATE OR REPLACE VIEW final_picks AS
SELECT 
  up.id,
  u.discord_id as capper_id,
  u.username as capper,
  up.prop_id,
  up.game_id,
  up.selection,
  up.line,
  up.odds,
  up.stake as unit_size,
  up.potential_payout as payout,
  CASE 
    WHEN up.status = 'won' THEN 'win'
    WHEN up.status = 'lost' THEN 'loss'
    WHEN up.status = 'push' THEN 'push'
    ELSE 'pending'
  END as result,
  up.actual_result as actual_stat,
  up.tier_when_placed as tier,
  up.pick_type as ticket_type,
  up.confidence as confidence_score,
  up.analysis as pick_explainer,
  up.placed_at as created_at,
  up.updated_at,
  up.metadata
FROM unified_picks up
JOIN users u ON up.user_id = u.id
WHERE up.pick_source = 'promoted';

-- Step 6: Final validation and summary
-- =============================================================================
SELECT 
  '🎉 Phase 3: SaaS Infrastructure Complete!' as status,
  'Enterprise tables created' as infrastructure,
  'Performance indexes added' as performance,
  'System configuration loaded' as config,
  'Feature flags enabled' as features,
  'Compatibility views updated' as compatibility,
  NOW() as completed_at;

-- Comprehensive system summary
SELECT 
  'SAAS TRANSFORMATION COMPLETE!' as final_status,
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(*) FROM users WHERE is_capper = TRUE) as total_cappers,
  (SELECT COUNT(*) FROM unified_picks) as total_picks,
  (SELECT COUNT(*) FROM parlay_tickets) as parlay_tickets,
  (SELECT COUNT(*) FROM system_config) as config_entries,
  (SELECT COUNT(*) FROM feature_flags) as feature_flags,
  'Ready for production scaling!' as ready;
