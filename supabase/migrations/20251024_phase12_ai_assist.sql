-- ===============================================================================
-- Phase 12: AI Assist & Discord Integration
-- Date: 2025-10-24
-- Purpose: AI-powered analysis, insights, and Discord notification integration
-- ===============================================================================

-- ===============================================================================
-- 1. AI_LOGS TABLE - Core AI interaction tracking
-- ===============================================================================
CREATE TABLE IF NOT EXISTS ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Request Identity
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (request_type IN (
    'scoring_copilot',
    'insight_summarizer',
    'moderator_coach',
    'pick_analysis',
    'hedge_analysis',
    'general_query'
  )),

  -- AI Model Configuration
  model TEXT NOT NULL, -- 'gpt-4-turbo', 'claude-3-opus', etc.
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic')),

  -- Request/Response
  prompt TEXT NOT NULL,
  response TEXT,

  -- Performance Metrics
  tokens_used INTEGER,
  cost_dollars DECIMAL(10,6),
  latency_ms INTEGER,
  confidence DECIMAL(5,2),

  -- Status Tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Indexes for efficient querying
  CONSTRAINT ai_logs_confidence_range CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100))
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_tenant_created ON ai_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_user_id ON ai_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_request_type ON ai_logs(tenant_id, request_type);
CREATE INDEX IF NOT EXISTS idx_ai_logs_status ON ai_logs(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_ai_logs_provider_model ON ai_logs(provider, model);
CREATE INDEX IF NOT EXISTS idx_ai_logs_metadata ON ai_logs USING GIN (metadata);

-- ===============================================================================
-- 2. AI_ASSIST_ANALYSIS_CACHE - Deduplication and performance
-- ===============================================================================
CREATE TABLE IF NOT EXISTS ai_assist_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Entity Reference
  pick_id UUID, -- References unified_picks, soft reference for flexibility
  entity_type TEXT NOT NULL DEFAULT 'pick',
  entity_id UUID NOT NULL,

  -- Analysis Details
  analysis_type TEXT NOT NULL,
  analysis_result JSONB NOT NULL,
  confidence DECIMAL(5,2),

  -- Cache Management
  cache_key TEXT NOT NULL, -- Hash of input parameters for deduplication
  cache_expires_at TIMESTAMPTZ NOT NULL,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT ai_cache_confidence_range CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100)),
  CONSTRAINT ai_cache_tenant_key_unique UNIQUE (tenant_id, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_tenant_entity ON ai_assist_analysis_cache(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON ai_assist_analysis_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_assist_analysis_cache(cache_expires_at) WHERE cache_expires_at > NOW();
CREATE INDEX IF NOT EXISTS idx_ai_cache_analysis_type ON ai_assist_analysis_cache(tenant_id, analysis_type);
CREATE INDEX IF NOT EXISTS idx_ai_cache_result ON ai_assist_analysis_cache USING GIN (analysis_result);

-- ===============================================================================
-- 3. AI_ASSIST_USER_PREFERENCES - Per-user AI customization
-- ===============================================================================
CREATE TABLE IF NOT EXISTS ai_assist_user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- AI Feature Toggles
  ai_enabled BOOLEAN DEFAULT TRUE,
  auto_analysis BOOLEAN DEFAULT FALSE, -- Automatically analyze new picks
  discord_notifications BOOLEAN DEFAULT TRUE,

  -- Analysis Configuration
  analysis_depth TEXT DEFAULT 'standard' CHECK (analysis_depth IN ('brief', 'standard', 'detailed')),
  focus_areas TEXT[] DEFAULT ARRAY['clv', 'steam', 'timing', 'value'], -- Analysis priorities
  preferred_model TEXT DEFAULT 'gpt-4-turbo',

  -- Usage Limits
  monthly_token_limit INTEGER DEFAULT 100000,
  monthly_tokens_used INTEGER DEFAULT 0,
  monthly_requests_count INTEGER DEFAULT 0,
  quota_reset_at TIMESTAMPTZ DEFAULT (DATE_TRUNC('month', NOW()) + INTERVAL '1 month'),

  -- Discord Integration
  discord_channel_id TEXT, -- Personal notification channel
  discord_webhook_url TEXT, -- Personal webhook (encrypted in production)

  -- Metadata
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_prefs_tenant ON ai_assist_user_preferences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_prefs_enabled ON ai_assist_user_preferences(user_id) WHERE ai_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_ai_prefs_quota ON ai_assist_user_preferences(user_id) WHERE monthly_tokens_used >= monthly_token_limit;

-- ===============================================================================
-- 4. AI_ASSIST_REQUESTS - Request queue for async processing
-- ===============================================================================
CREATE TABLE IF NOT EXISTS ai_assist_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Request Details
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10), -- 1=highest, 10=lowest

  -- Input Data
  prompt TEXT NOT NULL,
  context JSONB DEFAULT '{}', -- Additional context (pick data, market data, etc.)

  -- Processing
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  assigned_to TEXT, -- Worker/agent ID
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Results
  response TEXT,
  result_metadata JSONB DEFAULT '{}',
  ai_log_id UUID REFERENCES ai_logs(id) ON DELETE SET NULL,

  -- Error Handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,

  -- Metadata
  idempotency_key TEXT UNIQUE, -- Prevent duplicate requests
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_requests_tenant_status ON ai_assist_requests(tenant_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_ai_requests_user ON ai_assist_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_requests_pending ON ai_assist_requests(status, priority, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ai_requests_retry ON ai_assist_requests(next_retry_at) WHERE status = 'failed' AND retry_count < max_retries;
CREATE INDEX IF NOT EXISTS idx_ai_requests_idempotency ON ai_assist_requests(idempotency_key);

-- ===============================================================================
-- 5. AI_ASSIST_METRICS - Aggregate metrics for monitoring
-- ===============================================================================
CREATE TABLE IF NOT EXISTS ai_assist_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Time Period
  metric_date DATE NOT NULL,
  metric_hour INTEGER CHECK (metric_hour >= 0 AND metric_hour <= 23),

  -- Request Metrics
  requests_total INTEGER DEFAULT 0,
  requests_completed INTEGER DEFAULT 0,
  requests_failed INTEGER DEFAULT 0,
  requests_cancelled INTEGER DEFAULT 0,

  -- Performance Metrics
  avg_latency_ms INTEGER,
  p50_latency_ms INTEGER,
  p95_latency_ms INTEGER,
  p99_latency_ms INTEGER,
  max_latency_ms INTEGER,

  -- Cost Metrics
  total_tokens INTEGER DEFAULT 0,
  total_cost_dollars DECIMAL(10,4) DEFAULT 0,

  -- Quality Metrics
  avg_confidence DECIMAL(5,2),
  cache_hit_rate DECIMAL(5,2),
  error_rate DECIMAL(5,2),

  -- Provider Breakdown
  provider_stats JSONB DEFAULT '{}', -- { "openai": {...}, "anthropic": {...} }
  model_stats JSONB DEFAULT '{}', -- { "gpt-4-turbo": {...}, "claude-3-opus": {...} }

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT ai_metrics_tenant_date_hour_unique UNIQUE (tenant_id, metric_date, metric_hour)
);

CREATE INDEX IF NOT EXISTS idx_ai_metrics_tenant_date ON ai_assist_metrics(tenant_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_date_hour ON ai_assist_metrics(metric_date DESC, metric_hour DESC);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_error_rate ON ai_assist_metrics(tenant_id, error_rate) WHERE error_rate > 0.005;

-- ===============================================================================
-- 6. DISCORD_NOTIFICATIONS - Discord notification queue
-- ===============================================================================
CREATE TABLE IF NOT EXISTS discord_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Notification Details
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'pick_scored',
    'pick_failed',
    'ai_insight',
    'health_alert',
    'hedge_opportunity',
    'system_alert'
  )),

  -- Target
  discord_channel_id TEXT NOT NULL,
  discord_webhook_url TEXT, -- Optional webhook override
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Optional user-specific notification

  -- Content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  fields JSONB DEFAULT '[]', -- Discord embed fields
  color TEXT DEFAULT '#0099ff', -- Hex color for embed

  -- References
  pick_id UUID, -- Optional reference to pick
  ai_log_id UUID REFERENCES ai_logs(id) ON DELETE SET NULL,
  event_id UUID, -- Reference to source event

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,

  -- Error Handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_notif_tenant_status ON discord_notifications(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_discord_notif_pending ON discord_notifications(status, next_retry_at) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_discord_notif_type ON discord_notifications(tenant_id, notification_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discord_notif_user ON discord_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discord_notif_pick ON discord_notifications(pick_id);

-- ===============================================================================
-- 7. FUNCTIONS & TRIGGERS
-- ===============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_ai_logs_updated_at BEFORE UPDATE ON ai_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_prefs_updated_at BEFORE UPDATE ON ai_assist_user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_requests_updated_at BEFORE UPDATE ON ai_assist_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discord_notif_updated_at BEFORE UPDATE ON discord_notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check and reset monthly quota
CREATE OR REPLACE FUNCTION reset_monthly_ai_quota()
RETURNS void AS $$
BEGIN
  UPDATE ai_assist_user_preferences
  SET
    monthly_tokens_used = 0,
    monthly_requests_count = 0,
    quota_reset_at = DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  WHERE quota_reset_at <= NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to increment user quota usage
CREATE OR REPLACE FUNCTION increment_ai_quota(
  p_user_id UUID,
  p_tokens INTEGER,
  p_request_count INTEGER DEFAULT 1
)
RETURNS void AS $$
BEGIN
  INSERT INTO ai_assist_user_preferences (user_id, tenant_id, monthly_tokens_used, monthly_requests_count)
  SELECT p_user_id, u.tenant_id, p_tokens, p_request_count
  FROM users u WHERE u.id = p_user_id
  ON CONFLICT (user_id)
  DO UPDATE SET
    monthly_tokens_used = ai_assist_user_preferences.monthly_tokens_used + p_tokens,
    monthly_requests_count = ai_assist_user_preferences.monthly_requests_count + p_request_count,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get cache or null
CREATE OR REPLACE FUNCTION get_ai_cache(
  p_tenant_id UUID,
  p_cache_key TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT analysis_result INTO v_result
  FROM ai_assist_analysis_cache
  WHERE tenant_id = p_tenant_id
    AND cache_key = p_cache_key
    AND cache_expires_at > NOW();

  IF FOUND THEN
    UPDATE ai_assist_analysis_cache
    SET
      access_count = access_count + 1,
      last_accessed_at = NOW()
    WHERE tenant_id = p_tenant_id AND cache_key = p_cache_key;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ===============================================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ===============================================================================

-- Enable RLS on all tables
ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_assist_analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_assist_user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_assist_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_assist_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies (tenant-isolated by default)
CREATE POLICY ai_logs_tenant_isolation ON ai_logs
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY ai_cache_tenant_isolation ON ai_assist_analysis_cache
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY ai_prefs_tenant_isolation ON ai_assist_user_preferences
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY ai_requests_tenant_isolation ON ai_assist_requests
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY ai_metrics_tenant_isolation ON ai_assist_metrics
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY discord_notif_tenant_isolation ON discord_notifications
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ===============================================================================
-- 9. INITIAL DATA & CONFIGURATION
-- ===============================================================================

-- Insert default AI preferences for existing users (if users table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    INSERT INTO ai_assist_user_preferences (user_id, tenant_id)
    SELECT id, tenant_id FROM users
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;

-- ===============================================================================
-- Migration Complete
-- ===============================================================================

COMMENT ON TABLE ai_logs IS 'Phase 12: Core AI interaction tracking with cost and performance metrics';
COMMENT ON TABLE ai_assist_analysis_cache IS 'Phase 12: Analysis result caching for performance and cost optimization';
COMMENT ON TABLE ai_assist_user_preferences IS 'Phase 12: Per-user AI configuration and quota management';
COMMENT ON TABLE ai_assist_requests IS 'Phase 12: Async AI request queue with retry logic';
COMMENT ON TABLE ai_assist_metrics IS 'Phase 12: Aggregated AI metrics for monitoring and SLO tracking';
COMMENT ON TABLE discord_notifications IS 'Phase 12: Discord notification queue for AI insights and alerts';
