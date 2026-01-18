-- Phase 14: Partner API & Developer SDK
-- Date: 2025-10-25
-- Purpose: Enable secure, metered public API for external partners

-- ===============================================================================
-- 1. Partner Organizations Table
-- ===============================================================================
CREATE TABLE IF NOT EXISTS public.partner_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  website_url TEXT,
  contact_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
  tier TEXT NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic', 'pro', 'enterprise')),

  -- Rate limiting configuration
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 1000,
  rate_limit_per_day INTEGER NOT NULL DEFAULT 10000,

  -- Quota configuration
  monthly_quota INTEGER NOT NULL DEFAULT 100000,
  current_month_usage INTEGER NOT NULL DEFAULT 0,
  quota_reset_date TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', NOW()) + INTERVAL '1 month'),

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT valid_email CHECK (contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_partner_orgs_slug ON public.partner_organizations(slug);
CREATE INDEX idx_partner_orgs_status ON public.partner_organizations(status);
CREATE INDEX idx_partner_orgs_tier ON public.partner_organizations(tier);

COMMENT ON TABLE public.partner_organizations IS 'External partner organizations using the API';

-- ===============================================================================
-- 2. Partner API Keys Table
-- ===============================================================================
CREATE TABLE IF NOT EXISTS public.partner_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,

  -- API Key details
  key_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of the API key
  key_prefix TEXT NOT NULL, -- First 8 chars for identification (e.g., "ut_live_")
  name TEXT NOT NULL,
  description TEXT,

  -- Scopes and permissions
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read:picks', 'read:markets'], -- API permissions
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  last_used_ip TEXT,
  usage_count BIGINT NOT NULL DEFAULT 0,

  -- Lifecycle
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revoked_reason TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_partner_api_keys_hash ON public.partner_api_keys(key_hash);
CREATE INDEX idx_partner_api_keys_partner ON public.partner_api_keys(partner_id);
CREATE INDEX idx_partner_api_keys_active ON public.partner_api_keys(is_active) WHERE is_active = true;
CREATE INDEX idx_partner_api_keys_prefix ON public.partner_api_keys(key_prefix);

COMMENT ON TABLE public.partner_api_keys IS 'API keys for partner authentication';

-- ===============================================================================
-- 3. OAuth2 Clients Table
-- ===============================================================================
CREATE TABLE IF NOT EXISTS public.partner_oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,

  -- OAuth2 details
  client_id TEXT NOT NULL UNIQUE,
  client_secret_hash TEXT NOT NULL, -- Hashed client secret
  redirect_uris TEXT[] NOT NULL DEFAULT '{}',
  grant_types TEXT[] NOT NULL DEFAULT ARRAY['authorization_code', 'refresh_token'],

  -- Scopes
  allowed_scopes TEXT[] NOT NULL DEFAULT ARRAY['read:picks', 'read:markets'],

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_clients_partner ON public.partner_oauth_clients(partner_id);
CREATE INDEX idx_oauth_clients_client_id ON public.partner_oauth_clients(client_id);

COMMENT ON TABLE public.partner_oauth_clients IS 'OAuth2 client configurations for partners';

-- ===============================================================================
-- 4. Partner API Usage Logs Table
-- ===============================================================================
CREATE TABLE IF NOT EXISTS public.partner_api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES public.partner_api_keys(id) ON DELETE SET NULL,

  -- Request details
  method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  endpoint TEXT NOT NULL,
  status_code INTEGER NOT NULL,

  -- Performance
  response_time_ms INTEGER,
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,

  -- Client info
  ip_address TEXT,
  user_agent TEXT,

  -- Rate limiting
  rate_limit_remaining INTEGER,
  quota_remaining INTEGER,

  -- Metadata
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition by month for performance
CREATE INDEX idx_partner_usage_partner_timestamp ON public.partner_api_usage_logs(partner_id, timestamp DESC);
CREATE INDEX idx_partner_usage_endpoint ON public.partner_api_usage_logs(endpoint);
CREATE INDEX idx_partner_usage_status ON public.partner_api_usage_logs(status_code);
CREATE INDEX idx_partner_usage_timestamp ON public.partner_api_usage_logs(timestamp DESC);

COMMENT ON TABLE public.partner_api_usage_logs IS 'API usage logs for monitoring and billing';

-- ===============================================================================
-- 5. Partner Webhooks Table
-- ===============================================================================
CREATE TABLE IF NOT EXISTS public.partner_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,

  -- Webhook configuration
  url TEXT NOT NULL,
  events TEXT[] NOT NULL, -- e.g., ['pick.scored', 'market.closed', 'score.updated']
  secret TEXT NOT NULL, -- HMAC secret for signature verification

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Reliability
  retry_count INTEGER NOT NULL DEFAULT 3,
  timeout_seconds INTEGER NOT NULL DEFAULT 30,

  -- Health tracking
  last_triggered_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_webhook_url CHECK (url ~* '^https?://')
);

CREATE INDEX idx_partner_webhooks_partner ON public.partner_webhooks(partner_id);
CREATE INDEX idx_partner_webhooks_active ON public.partner_webhooks(is_active) WHERE is_active = true;
CREATE INDEX idx_partner_webhooks_events ON public.partner_webhooks USING GIN(events);

COMMENT ON TABLE public.partner_webhooks IS 'Webhook configurations for event notifications';

-- ===============================================================================
-- 6. Partner Webhook Delivery Logs Table
-- ===============================================================================
CREATE TABLE IF NOT EXISTS public.partner_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.partner_webhooks(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL,
  event_id UUID NOT NULL,
  payload JSONB NOT NULL,

  -- Delivery details
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  http_status_code INTEGER,
  response_time_ms INTEGER,

  -- Error tracking
  error_message TEXT,
  error_details JSONB,

  -- Retry scheduling
  next_retry_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_webhook_logs_webhook ON public.partner_webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_partner ON public.partner_webhook_logs(partner_id);
CREATE INDEX idx_webhook_logs_status ON public.partner_webhook_logs(status);
CREATE INDEX idx_webhook_logs_event ON public.partner_webhook_logs(event_type, event_id);
CREATE INDEX idx_webhook_logs_retry ON public.partner_webhook_logs(next_retry_at) WHERE status = 'retrying';
CREATE INDEX idx_webhook_logs_created ON public.partner_webhook_logs(created_at DESC);

COMMENT ON TABLE public.partner_webhook_logs IS 'Webhook delivery tracking and retry management';

-- ===============================================================================
-- 7. Partner Picks Table (tenant-aware)
-- ===============================================================================
CREATE TABLE IF NOT EXISTS public.partner_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,

  -- Pick details (references existing unified_picks or creates new)
  unified_pick_id UUID REFERENCES public.unified_picks(id) ON DELETE SET NULL,

  -- Partner-specific data
  external_id TEXT, -- Partner's own pick ID
  partner_metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(partner_id, external_id)
);

CREATE INDEX idx_partner_picks_partner ON public.partner_picks(partner_id);
CREATE INDEX idx_partner_picks_unified ON public.partner_picks(unified_pick_id);
CREATE INDEX idx_partner_picks_external ON public.partner_picks(partner_id, external_id);

COMMENT ON TABLE public.partner_picks IS 'Partner-submitted picks with tenant isolation';

-- ===============================================================================
-- 8. Row-Level Security Policies
-- ===============================================================================

-- Enable RLS on all partner tables
ALTER TABLE public.partner_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_picks ENABLE ROW LEVEL SECURITY;

-- Partner organizations: Only admins can manage
CREATE POLICY partner_orgs_admin_all ON public.partner_organizations
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- API Keys: Partners can view their own keys
CREATE POLICY partner_keys_view_own ON public.partner_api_keys
  FOR SELECT USING (
    partner_id IN (
      SELECT id FROM public.partner_organizations
      WHERE created_by = auth.uid()
    )
  );

-- Webhooks: Partners can manage their own webhooks
CREATE POLICY partner_webhooks_own ON public.partner_webhooks
  FOR ALL USING (
    partner_id IN (
      SELECT id FROM public.partner_organizations
      WHERE created_by = auth.uid()
    )
  );

-- Picks: Partners can only access their own picks
CREATE POLICY partner_picks_own ON public.partner_picks
  FOR ALL USING (partner_id IN (
    SELECT id FROM public.partner_organizations
    WHERE created_by = auth.uid()
  ));

-- ===============================================================================
-- 9. Helper Functions
-- ===============================================================================

-- Function to reset monthly quota
CREATE OR REPLACE FUNCTION reset_partner_monthly_quota()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.partner_organizations
  SET
    current_month_usage = 0,
    quota_reset_date = date_trunc('month', NOW()) + INTERVAL '1 month',
    updated_at = NOW()
  WHERE quota_reset_date <= NOW();
END;
$$;

COMMENT ON FUNCTION reset_partner_monthly_quota IS 'Resets monthly API quotas for all partners';

-- Function to increment API usage
CREATE OR REPLACE FUNCTION increment_partner_usage(p_partner_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.partner_organizations
  SET
    current_month_usage = current_month_usage + 1,
    updated_at = NOW()
  WHERE id = p_partner_id;
END;
$$;

COMMENT ON FUNCTION increment_partner_usage IS 'Increments API usage counter for a partner';

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_partner_rate_limit(
  p_partner_id UUID,
  p_window TEXT DEFAULT 'minute'
)
RETURNS TABLE (
  allowed BOOLEAN,
  limit_value INTEGER,
  current_usage INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_usage INTEGER;
  v_window_start TIMESTAMPTZ;
  v_reset_at TIMESTAMPTZ;
BEGIN
  -- Determine time window
  CASE p_window
    WHEN 'minute' THEN
      v_window_start := date_trunc('minute', NOW());
      v_reset_at := v_window_start + INTERVAL '1 minute';
      SELECT rate_limit_per_minute INTO v_limit
      FROM public.partner_organizations WHERE id = p_partner_id;
    WHEN 'hour' THEN
      v_window_start := date_trunc('hour', NOW());
      v_reset_at := v_window_start + INTERVAL '1 hour';
      SELECT rate_limit_per_hour INTO v_limit
      FROM public.partner_organizations WHERE id = p_partner_id;
    WHEN 'day' THEN
      v_window_start := date_trunc('day', NOW());
      v_reset_at := v_window_start + INTERVAL '1 day';
      SELECT rate_limit_per_day INTO v_limit
      FROM public.partner_organizations WHERE id = p_partner_id;
    ELSE
      v_limit := 0;
  END CASE;

  -- Count recent requests
  SELECT COUNT(*) INTO v_usage
  FROM public.partner_api_usage_logs
  WHERE partner_id = p_partner_id
    AND timestamp >= v_window_start;

  -- Return result
  RETURN QUERY SELECT
    (v_usage < v_limit) AS allowed,
    v_limit AS limit_value,
    v_usage::INTEGER AS current_usage,
    v_reset_at AS reset_at;
END;
$$;

COMMENT ON FUNCTION check_partner_rate_limit IS 'Checks if partner has exceeded rate limit';

-- Function to get partner by API key
CREATE OR REPLACE FUNCTION get_partner_by_api_key(p_key_hash TEXT)
RETURNS TABLE (
  partner_id UUID,
  partner_slug TEXT,
  partner_tier TEXT,
  partner_status TEXT,
  api_key_id UUID,
  scopes TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    po.id AS partner_id,
    po.slug AS partner_slug,
    po.tier AS partner_tier,
    po.status AS partner_status,
    pak.id AS api_key_id,
    pak.scopes
  FROM public.partner_api_keys pak
  INNER JOIN public.partner_organizations po ON pak.partner_id = po.id
  WHERE pak.key_hash = p_key_hash
    AND pak.is_active = true
    AND (pak.expires_at IS NULL OR pak.expires_at > NOW())
    AND pak.revoked_at IS NULL
    AND po.status = 'active';
END;
$$;

COMMENT ON FUNCTION get_partner_by_api_key IS 'Retrieves partner information from API key hash';

-- ===============================================================================
-- 10. Scheduled Jobs Setup (pg_cron integration)
-- ===============================================================================

-- Reset monthly quotas on the first of each month at midnight
-- Note: Requires pg_cron extension
-- SELECT cron.schedule('reset-partner-quotas', '0 0 1 * *', 'SELECT reset_partner_monthly_quota()');

-- ===============================================================================
-- 11. Grants and Permissions
-- ===============================================================================

-- Grant access to authenticated users
GRANT SELECT ON public.partner_organizations TO authenticated;
GRANT SELECT ON public.partner_api_keys TO authenticated;
GRANT SELECT ON public.partner_webhooks TO authenticated;
GRANT SELECT, INSERT ON public.partner_picks TO authenticated;

-- Grant access to service role (for API server)
GRANT ALL ON public.partner_organizations TO service_role;
GRANT ALL ON public.partner_api_keys TO service_role;
GRANT ALL ON public.partner_oauth_clients TO service_role;
GRANT ALL ON public.partner_api_usage_logs TO service_role;
GRANT ALL ON public.partner_webhooks TO service_role;
GRANT ALL ON public.partner_webhook_logs TO service_role;
GRANT ALL ON public.partner_picks TO service_role;

-- ===============================================================================
-- 12. Initial Seed Data (Development)
-- ===============================================================================

-- Insert sample partner organization for testing
INSERT INTO public.partner_organizations (
  name, slug, description, contact_email, tier,
  rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
  monthly_quota
) VALUES (
  'Unit Talk Development Partner',
  'unit-talk-dev',
  'Internal development and testing partner',
  'dev@unittalk.com',
  'enterprise',
  120, -- 120 req/min
  5000, -- 5000 req/hour
  50000, -- 50000 req/day
  1000000 -- 1M req/month
) ON CONFLICT (slug) DO NOTHING;

-- ===============================================================================
-- Migration Complete
-- ===============================================================================

COMMENT ON SCHEMA public IS 'Phase 14: Partner API & Developer SDK - Database schema ready';
