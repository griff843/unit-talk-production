-- ========================================================================
-- SaaS-Grade Production Schema Migration (HOT/WARM/COLD)
-- Version: 2025.09.23 - Production Readiness
-- ========================================================================

-- Enable Row Level Security extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================================================
-- 1. HOT TIER TABLES (Mission-Critical, Sub-Second Access)
-- ========================================================================

-- Extend existing unified_picks for approval workflow
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS denied_at TIMESTAMPTZ;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS denied_by VARCHAR(255);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS promoted_by VARCHAR(255);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS promoted_hash VARCHAR(64);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS ticket_id VARCHAR(255);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS leg_index INTEGER DEFAULT 0;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS edge_score NUMERIC(8,4);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS edge_breakdown JSONB;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS market_reaction TEXT;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS org_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;

-- Create approval_queue (HOT)
CREATE TABLE IF NOT EXISTS approval_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unified_id UUID NOT NULL REFERENCES unified_picks(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by VARCHAR(255),
    denied_at TIMESTAMPTZ,
    denied_by VARCHAR(255),
    org_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    actor_id VARCHAR(255),
    CONSTRAINT approval_single_decision CHECK (
        (approved_at IS NOT NULL AND denied_at IS NULL) OR
        (approved_at IS NULL AND denied_at IS NOT NULL) OR
        (approved_at IS NULL AND denied_at IS NULL)
    )
);

-- Create alerts_queue (HOT)
CREATE TABLE IF NOT EXISTS alerts_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unified_id UUID REFERENCES unified_picks(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('steam', 'injury', 'hedge', 'middle', 'line_movement', 'arbitrage')),
    signal_strength NUMERIC(3,2) DEFAULT 0.0 CHECK (signal_strength >= 0 AND signal_strength <= 1),
    cooldown_until TIMESTAMPTZ,
    last_sent_hash VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    org_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
);

-- Create scoring_explanations (HOT for latest, move to WARM after 7 days)
CREATE TABLE IF NOT EXISTS scoring_explanations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raw_id UUID REFERENCES raw_props(id) ON DELETE CASCADE,
    version VARCHAR(50) DEFAULT 'Enhanced175-2025.09.23',
    feature_vector JSONB NOT NULL,
    top_signals JSONB NOT NULL, -- Top 10 signals by weight
    confidence_score NUMERIC(5,4),
    edge_score NUMERIC(8,4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    org_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
);

-- Add org_id to existing tables for multi-tenancy
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS org_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS org_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;

-- Runtime configuration (HOT)
CREATE TABLE IF NOT EXISTS runtime_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    org_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
);

-- Temporal metrics (HOT)
CREATE TABLE IF NOT EXISTS temporal_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id VARCHAR(255) NOT NULL,
    workflow_type VARCHAR(255) NOT NULL,
    run_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms BIGINT,
    metadata JSONB,
    org_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log (HOT for recent, COLD for history)
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    actor_id VARCHAR(255),
    actor_type VARCHAR(50), -- user, system, api
    action VARCHAR(100) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    org_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================================
-- 2. CRITICAL INDEXES (Performance-Critical)
-- ========================================================================

-- HOT table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_inserted_at_desc ON raw_props (inserted_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_processed_at ON raw_props (processed_at) WHERE processed_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_org_id ON raw_props (org_id);

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_raw_id_unique ON unified_picks (raw_prop_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_org_id ON unified_picks (org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_promoted_at ON unified_picks (promoted_at) WHERE promoted_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_approved_at ON unified_picks (approved_at) WHERE approved_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_posted_at ON unified_picks (posted_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_approval_queue_status_org ON approval_queue (status, org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_approval_queue_unified_id ON approval_queue (unified_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_queue_unified_id ON alerts_queue (unified_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_queue_type_cooldown ON alerts_queue (type, cooldown_until);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_queue_org_id ON alerts_queue (org_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scoring_explanations_raw_id ON scoring_explanations (raw_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scoring_explanations_created_at ON scoring_explanations (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_entity ON audit_log (entity_type, entity_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_org_id ON audit_log (org_id);

-- ========================================================================
-- 3. WARM TIER - MATERIALIZED VIEWS (Serving/Reporting)
-- ========================================================================

-- Capper Leaderboard (7/30/90 day periods)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_capper_leaderboard_7_30_90 AS
WITH periods AS (
    SELECT
        user_id,
        username,
        org_id,
        -- 7 day metrics
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as picks_7d,
        AVG(CASE WHEN created_at >= NOW() - INTERVAL '7 days' AND grading_status = 'completed' THEN score END) as avg_score_7d,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' AND tier IN ('S', 'A') THEN 1 END) as top_tier_7d,
        -- 30 day metrics
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as picks_30d,
        AVG(CASE WHEN created_at >= NOW() - INTERVAL '30 days' AND grading_status = 'completed' THEN score END) as avg_score_30d,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' AND tier IN ('S', 'A') THEN 1 END) as top_tier_30d,
        -- 90 day metrics
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '90 days' THEN 1 END) as picks_90d,
        AVG(CASE WHEN created_at >= NOW() - INTERVAL '90 days' AND grading_status = 'completed' THEN score END) as avg_score_90d,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '90 days' AND tier IN ('S', 'A') THEN 1 END) as top_tier_90d
    FROM unified_picks
    WHERE published = true
    GROUP BY user_id, username, org_id
)
SELECT
    *,
    RANK() OVER (PARTITION BY org_id ORDER BY avg_score_7d DESC NULLS LAST) as rank_7d,
    RANK() OVER (PARTITION BY org_id ORDER BY avg_score_30d DESC NULLS LAST) as rank_30d,
    RANK() OVER (PARTITION BY org_id ORDER BY avg_score_90d DESC NULLS LAST) as rank_90d,
    NOW() as refreshed_at
FROM periods
WHERE picks_7d > 0 OR picks_30d > 0 OR picks_90d > 0;

-- Daily recap view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_unified_recaps AS
SELECT
    DATE(created_at) as recap_date,
    org_id,
    sport,
    tier,
    COUNT(*) as pick_count,
    AVG(score) as avg_score,
    AVG(confidence) as avg_confidence,
    COUNT(CASE WHEN grading_status = 'completed' THEN 1 END) as completed_picks,
    AVG(CASE WHEN grading_status = 'completed' THEN score END) as avg_completed_score,
    COUNT(CASE WHEN tier IN ('S', 'A') THEN 1 END) as premium_picks,
    NOW() as refreshed_at
FROM unified_picks
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  AND published = true
GROUP BY DATE(created_at), org_id, sport, tier;

-- Alert overlay for today
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_alert_overlay_today AS
SELECT
    up.id as unified_id,
    up.prediction,
    up.sport,
    up.tier,
    up.score,
    aq.type as alert_type,
    aq.signal_strength,
    aq.created_at as alert_created_at,
    aq.cooldown_until,
    up.org_id,
    NOW() as refreshed_at
FROM unified_picks up
JOIN alerts_queue aq ON up.id = aq.unified_id
WHERE up.created_at >= CURRENT_DATE
  AND up.published = true
  AND (aq.cooldown_until IS NULL OR aq.cooldown_until <= NOW());

-- Provider quota state
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_provider_quota_state AS
SELECT
    provider,
    quota_limit,
    reset_period,
    COALESCE(
        (SELECT COUNT(*) FROM temporal_metrics tm
         WHERE tm.workflow_type LIKE '%' || provider || '%'
         AND tm.started_at >= CURRENT_DATE), 0
    ) as daily_usage,
    quota_limit - COALESCE(
        (SELECT COUNT(*) FROM temporal_metrics tm
         WHERE tm.workflow_type LIKE '%' || provider || '%'
         AND tm.started_at >= CURRENT_DATE), 0
    ) as remaining_quota,
    NOW() as refreshed_at
FROM api_quota_configs;

-- Edge summary for today
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_edge_summary_today AS
SELECT
    sport,
    tier,
    org_id,
    COUNT(*) as pick_count,
    AVG(edge_score) as avg_edge,
    MIN(edge_score) as min_edge,
    MAX(edge_score) as max_edge,
    STDDEV(edge_score) as edge_stddev,
    COUNT(CASE WHEN edge_score > 0.05 THEN 1 END) as positive_edge_count,
    AVG(CASE WHEN edge_score > 0.05 THEN edge_score END) as avg_positive_edge,
    NOW() as refreshed_at
FROM unified_picks
WHERE created_at >= CURRENT_DATE
  AND published = true
  AND edge_score IS NOT NULL
GROUP BY sport, tier, org_id;

-- ========================================================================
-- 4. POSTABLE QUEUE VIEW (Critical Business Logic)
-- ========================================================================

CREATE OR REPLACE VIEW view_postable_unified_picks AS
SELECT
    up.*,
    aq.approved_at,
    aq.approved_by
FROM unified_picks up
JOIN approval_queue aq ON up.id = aq.unified_id
WHERE aq.status = 'approved'
  AND aq.approved_at IS NOT NULL
  AND up.posted_at IS NULL
  AND (up.expires_at IS NULL OR up.expires_at > NOW())
  AND up.published = true
  AND (up.metadata->>'is_shadow')::boolean IS NOT TRUE;

-- ========================================================================
-- 5. COLD TIER TABLES (History/Analytics)
-- ========================================================================

-- Historical picks (moved from HOT after settlement)
CREATE TABLE IF NOT EXISTS unified_picks_history (
    LIKE unified_picks INCLUDING ALL
);

-- Settlement records (COLD)
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unified_id UUID NOT NULL,
    ticket_id VARCHAR(255),
    settled_at TIMESTAMPTZ DEFAULT NOW(),
    settlement_odds NUMERIC(8,4),
    settlement_result VARCHAR(20) CHECK (settlement_result IN ('win', 'loss', 'push', 'void')),
    settlement_source VARCHAR(50),
    settlement_metadata JSONB,
    org_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
);

-- Metrics timeseries (COLD)
CREATE TABLE IF NOT EXISTS metrics_timeseries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC,
    tags JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    org_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
);

-- SLO incidents (COLD)
CREATE TABLE IF NOT EXISTS slo_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name VARCHAR(100) NOT NULL,
    slo_name VARCHAR(100) NOT NULL,
    incident_type VARCHAR(50) CHECK (incident_type IN ('availability', 'latency', 'error_rate')),
    threshold_value NUMERIC,
    actual_value NUMERIC,
    severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    metadata JSONB,
    org_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
);

-- Exposure snapshots (COLD)
CREATE TABLE IF NOT EXISTS exposure_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_time TIMESTAMPTZ DEFAULT NOW(),
    sport VARCHAR(50),
    total_exposure NUMERIC(12,2),
    position_count INTEGER,
    max_single_exposure NUMERIC(12,2),
    risk_metrics JSONB,
    org_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
);

-- ========================================================================
-- 6. ROW LEVEL SECURITY (RLS) - MANDATORY FOR SAAS
-- ========================================================================

-- Enable RLS on all user-facing tables
ALTER TABLE raw_props ENABLE ROW LEVEL SECURITY;
ALTER TABLE unified_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE runtime_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE temporal_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_timeseries ENABLE ROW LEVEL SECURITY;
ALTER TABLE slo_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE exposure_snapshots ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (tenant isolation)
DO $$
BEGIN
    -- Raw props policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'raw_props' AND policyname = 'tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON raw_props FOR ALL TO authenticated USING (org_id = current_setting('app.current_org_id', true)::uuid);
    END IF;

    -- Unified picks policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'unified_picks' AND policyname = 'tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON unified_picks FOR ALL TO authenticated USING (org_id = current_setting('app.current_org_id', true)::uuid);
    END IF;

    -- Approval queue policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'approval_queue' AND policyname = 'tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON approval_queue FOR ALL TO authenticated USING (org_id = current_setting('app.current_org_id', true)::uuid);
    END IF;

    -- Service role bypass (for system operations)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'unified_picks' AND policyname = 'service_role_bypass') THEN
        CREATE POLICY service_role_bypass ON unified_picks FOR ALL TO service_role USING (true);
    END IF;
END $$;

-- ========================================================================
-- 7. MATERIALIZED VIEW INDEXES
-- ========================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mv_capper_leaderboard_org_rank_7d ON mv_capper_leaderboard_7_30_90 (org_id, rank_7d);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mv_daily_recaps_date_org ON mv_daily_unified_recaps (recap_date DESC, org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mv_alert_overlay_unified_id ON mv_alert_overlay_today (unified_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mv_edge_summary_sport_tier ON mv_edge_summary_today (sport, tier, org_id);

-- ========================================================================
-- 8. INSERT SAMPLE RUNTIME CONFIG
-- ========================================================================

INSERT INTO runtime_config (key, value, description) VALUES
('active_provider', '{"primary": "odds-api", "fallback": "sgo-api"}', 'Active data provider configuration'),
('shadow_mode', '{"enabled": false, "percentage": 0}', 'Shadow mode settings'),
('publish_to_discord', '{"enabled": true, "channels": {"general": "123", "vip": "456"}}', 'Discord publishing configuration'),
('scoring_engine_version', '{"version": "Enhanced175-2025.09.23", "features": 175}', 'Current scoring engine version'),
('rate_limits', '{"odds_api": 500, "sgo_api": 2000, "optimal": 1000}', 'API rate limits per provider')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();

-- ========================================================================
-- 9. FEATURE FLAGS TABLE
-- ========================================================================

CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flag_name VARCHAR(100) NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT false,
    rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    conditions JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    org_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
);

-- Insert production feature flags
INSERT INTO feature_flags (flag_name, enabled, rollout_percentage, conditions) VALUES
('vip_real_time_picks', true, 100, '{"tier_required": "VIP"}'),
('vip_plus_alerts', false, 0, '{"tier_required": "VIP+", "alert_types": ["steam", "injury"]}'),
('black_label_features', false, 0, '{"tier_required": "BLACK_LABEL"}'),
('manual_approval_required', true, 100, '{"all_picks": true}'),
('automated_promotion', false, 0, '{"score_threshold": 90, "tier_required": "S"}')
ON CONFLICT (flag_name) DO UPDATE SET updated_at = NOW();

-- ========================================================================
-- MIGRATION COMPLETE
-- ========================================================================

-- Record migration completion
INSERT INTO audit_log (event_type, action, metadata) VALUES
('migration', 'saas_production_schema_applied',
'{"version": "026", "timestamp": "' || NOW() || '", "tables_created": ["approval_queue", "alerts_queue", "scoring_explanations", "runtime_config", "temporal_metrics", "audit_log", "settlements", "metrics_timeseries", "slo_incidents", "exposure_snapshots", "feature_flags"], "materialized_views": ["mv_capper_leaderboard_7_30_90", "mv_daily_unified_recaps", "mv_alert_overlay_today", "mv_provider_quota_state", "mv_edge_summary_today"]}');