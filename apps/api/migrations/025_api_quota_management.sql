-- Migration 025: API Quota Management Tables
-- Adds comprehensive API quota tracking and emergency management

-- ============================================================================
-- 1. API QUOTA USAGE TABLE
-- ============================================================================
CREATE TABLE api_quota_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(100) NOT NULL,
    service VARCHAR(100) NOT NULL,
    request_id VARCHAR(200) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,
    cost_per_request NUMERIC(10,4) DEFAULT 1,
    success BOOLEAN DEFAULT true,
    response_time_ms INTEGER,

    -- Indexes for efficient querying
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_api_quota_usage_provider ON api_quota_usage(provider);
CREATE INDEX idx_api_quota_usage_timestamp ON api_quota_usage(timestamp DESC);
CREATE INDEX idx_api_quota_usage_service ON api_quota_usage(service, timestamp DESC);
CREATE INDEX idx_api_quota_usage_daily ON api_quota_usage(provider, timestamp DESC) WHERE timestamp >= current_date;
CREATE INDEX idx_api_quota_usage_monthly ON api_quota_usage(provider, timestamp DESC) WHERE timestamp >= date_trunc('month', current_timestamp);

-- ============================================================================
-- 2. API EMERGENCY STATES TABLE
-- ============================================================================
CREATE TABLE api_emergency_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'expired')),
    enabled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    disabled_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_api_emergency_states_provider ON api_emergency_states(provider);
CREATE INDEX idx_api_emergency_states_status ON api_emergency_states(status, enabled_at DESC);
CREATE INDEX idx_api_emergency_states_active ON api_emergency_states(provider, status) WHERE status = 'active';

-- ============================================================================
-- 3. API QUOTA CONFIGS TABLE (For dynamic configuration)
-- ============================================================================
CREATE TABLE api_quota_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(100) NOT NULL UNIQUE,
    daily_limit INTEGER NOT NULL DEFAULT 100,
    monthly_limit INTEGER NOT NULL DEFAULT 3000,
    rate_limit INTEGER NOT NULL DEFAULT 10, -- requests per minute
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    cost_per_request NUMERIC(10,4) DEFAULT 1,
    enabled BOOLEAN DEFAULT true,

    -- Configuration metadata
    config_metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add update trigger for updated_at
CREATE TRIGGER update_api_quota_configs_updated_at
    BEFORE UPDATE ON api_quota_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_emergency_states_updated_at
    BEFORE UPDATE ON api_emergency_states
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. INSERT DEFAULT API CONFIGURATIONS
-- ============================================================================
INSERT INTO api_quota_configs (provider, daily_limit, monthly_limit, rate_limit, priority, cost_per_request, enabled, config_metadata) VALUES
('odds-api', 16, 500, 1, 8, 1, true, '{"type": "free_tier", "notes": "500 requests/month free tier"}'),
('optimal-api', 1000, 30000, 10, 9, 1, true, '{"type": "premium", "notes": "Premium API with higher limits"}'),
('sgo-api', 2000, 60000, 20, 7, 1, true, '{"type": "partner", "notes": "SportGameOdds partner API"}'),
('espn-api', 500, 15000, 5, 5, 0, true, '{"type": "free", "notes": "ESPN public API"}');

-- ============================================================================
-- 5. CREATE VIEWS FOR MONITORING
-- ============================================================================

-- View for daily quota usage by provider
CREATE VIEW daily_quota_usage AS
SELECT
    provider,
    service,
    DATE(timestamp) as usage_date,
    COUNT(*) as requests_count,
    SUM(cost_per_request) as total_cost,
    AVG(response_time_ms) as avg_response_time,
    COUNT(*) FILTER (WHERE success = true) as successful_requests,
    COUNT(*) FILTER (WHERE success = false) as failed_requests
FROM api_quota_usage
WHERE timestamp >= current_date - INTERVAL '7 days'
GROUP BY provider, service, DATE(timestamp)
ORDER BY usage_date DESC, provider;

-- View for monthly quota usage by provider
CREATE VIEW monthly_quota_usage AS
SELECT
    provider,
    DATE_TRUNC('month', timestamp) as usage_month,
    COUNT(*) as requests_count,
    SUM(cost_per_request) as total_cost,
    AVG(response_time_ms) as avg_response_time,
    COUNT(*) FILTER (WHERE success = true) as successful_requests,
    COUNT(*) FILTER (WHERE success = false) as failed_requests,
    COUNT(DISTINCT service) as services_used
FROM api_quota_usage
WHERE timestamp >= date_trunc('month', current_timestamp) - INTERVAL '12 months'
GROUP BY provider, DATE_TRUNC('month', timestamp)
ORDER BY usage_month DESC, provider;

-- View for current quota status
CREATE VIEW current_quota_status AS
SELECT
    c.provider,
    c.daily_limit,
    c.monthly_limit,
    c.rate_limit,
    c.enabled,

    -- Daily usage
    COALESCE(d.daily_used, 0) as daily_used,
    (c.daily_limit - COALESCE(d.daily_used, 0)) as daily_remaining,
    ROUND((COALESCE(d.daily_used, 0)::NUMERIC / c.daily_limit * 100), 2) as daily_utilization_pct,

    -- Monthly usage
    COALESCE(m.monthly_used, 0) as monthly_used,
    (c.monthly_limit - COALESCE(m.monthly_used, 0)) as monthly_remaining,
    ROUND((COALESCE(m.monthly_used, 0)::NUMERIC / c.monthly_limit * 100), 2) as monthly_utilization_pct,

    -- Status
    CASE
        WHEN NOT c.enabled THEN 'disabled'
        WHEN (c.daily_limit - COALESCE(d.daily_used, 0)) <= 0 OR (c.monthly_limit - COALESCE(m.monthly_used, 0)) <= 0 THEN 'exhausted'
        WHEN COALESCE(d.daily_used, 0)::NUMERIC / c.daily_limit >= 0.9 OR COALESCE(m.monthly_used, 0)::NUMERIC / c.monthly_limit >= 0.9 THEN 'critical'
        WHEN COALESCE(d.daily_used, 0)::NUMERIC / c.daily_limit >= 0.7 OR COALESCE(m.monthly_used, 0)::NUMERIC / c.monthly_limit >= 0.7 THEN 'warning'
        ELSE 'healthy'
    END as status,

    c.updated_at as config_updated_at
FROM api_quota_configs c
LEFT JOIN (
    SELECT
        provider,
        COUNT(*) as daily_used
    FROM api_quota_usage
    WHERE timestamp >= current_date
    GROUP BY provider
) d ON c.provider = d.provider
LEFT JOIN (
    SELECT
        provider,
        COUNT(*) as monthly_used
    FROM api_quota_usage
    WHERE timestamp >= date_trunc('month', current_timestamp)
    GROUP BY provider
) m ON c.provider = m.provider;

-- ============================================================================
-- 6. ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE api_quota_usage IS 'Tracks all API requests for quota management and monitoring';
COMMENT ON TABLE api_emergency_states IS 'Records emergency states when API quotas are exhausted or compromised';
COMMENT ON TABLE api_quota_configs IS 'Configuration for API providers including limits and priorities';

COMMENT ON COLUMN api_quota_usage.provider IS 'API provider name (odds-api, optimal-api, etc.)';
COMMENT ON COLUMN api_quota_usage.service IS 'Service using the API (line-shopping, settlement, etc.)';
COMMENT ON COLUMN api_quota_usage.request_id IS 'Unique identifier for the API request';
COMMENT ON COLUMN api_quota_usage.cost_per_request IS 'Cost/weight of the request for quota calculation';

COMMENT ON VIEW current_quota_status IS 'Real-time view of quota utilization and status for all providers';

-- Migration completed successfully
-- Next migration number: 026