-- Migration 006: Fortune-100 SLO/SLI Monitoring Framework
-- Adds comprehensive SLO monitoring, exposure tracking, and operational controls
-- Supports Supabase and Docker PG with full backward compatibility

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- =============================================================================
-- CORE METRICS & SLO FRAMEWORK
-- =============================================================================

-- Generic time-series metrics storage
CREATE TABLE IF NOT EXISTS system_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    metric text NOT NULL,              -- e.g., 'grading_lag_ms_p95', 'api_response_time'
    value numeric NOT NULL,
    labels jsonb DEFAULT '{}'::jsonb,  -- {workflow:'AutoRecheck', sport:'NBA', environment:'prod'}
    tags text[] DEFAULT '{}',          -- ['performance', 'critical', 'grading']
    source text DEFAULT 'system',      -- 'system', 'agent', 'user', 'external'
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz DEFAULT now() + interval '90 days' -- Auto-cleanup old metrics
);

-- Optimized indexes for metric queries
CREATE INDEX IF NOT EXISTS idx_system_metrics_metric_time ON system_metrics(metric, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_labels_gin ON system_metrics USING gin(labels);
CREATE INDEX IF NOT EXISTS idx_system_metrics_tags_gin ON system_metrics USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_system_metrics_source_time ON system_metrics(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_expires_at ON system_metrics(expires_at) WHERE expires_at IS NOT NULL;

-- SLO catalog and configuration
CREATE TABLE IF NOT EXISTS slos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,         -- 'grading_latency_p95'
    title text NOT NULL,               -- 'Grading Latency (95th percentile)'
    objective numeric NOT NULL,        -- e.g., 30000 (30 seconds in ms)
    window text NOT NULL DEFAULT '30d',-- '30d', '7d', '24h'
    sli_metric text NOT NULL,          -- metric name to read from system_metrics
    error_budget numeric DEFAULT 0.1,  -- 10% error budget (0.1 = 10%)
    
    -- Burn rate thresholds
    fast_burn_rate numeric DEFAULT 14.4,    -- 2% in 1 hour
    slow_burn_rate numeric DEFAULT 1.0,     -- 2% in 1 day
    fast_burn_window text DEFAULT '1h',
    slow_burn_window text DEFAULT '6h',
    
    -- Alert configuration
    severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    enabled boolean DEFAULT true,
    description text,
    runbook_url text,
    
    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Burn-rate incidents and SLO violations
CREATE TABLE IF NOT EXISTS slo_incidents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slo_id uuid REFERENCES slos(id) ON DELETE CASCADE,
    burn_rate numeric NOT NULL,        -- e.g., 2.5x normal burn rate
    window text NOT NULL,              -- '5m', '1h', '6h'
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'closed')),
    severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Incident details
    error_budget_consumed numeric,      -- % of error budget consumed
    current_sli_value numeric,         -- Current SLI measurement
    threshold_value numeric,           -- SLO threshold that was breached
    
    -- Metadata and context
    details jsonb DEFAULT '{}'::jsonb,
    labels jsonb DEFAULT '{}'::jsonb,
    assignee text,
    acknowledged_at timestamptz,
    acknowledged_by text,
    resolved_at timestamptz,
    resolved_by text,
    created_at timestamptz DEFAULT now(),
    closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_slo_incidents_slo_status ON slo_incidents(slo_id, status);
CREATE INDEX IF NOT EXISTS idx_slo_incidents_created_at ON slo_incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_slo_incidents_status_severity ON slo_incidents(status, severity);

-- =============================================================================
-- EXPOSURE & RISK MANAGEMENT
-- =============================================================================

-- Per-pick snapshot for risk aggregation (written on grade/promote)
CREATE TABLE IF NOT EXISTS exposure_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    unified_pick_id uuid,
    
    -- Core risk identifiers
    sport text,
    league text, 
    event_id text,
    game_id uuid,
    
    -- Position details
    team text,
    opponent text,
    market text,                       -- 'player_props', 'game_totals', 'spreads'
    stat_type text,                    -- 'points', 'rebounds', 'assists'
    
    -- Risk calculations
    kelly_fraction numeric,
    units numeric,
    exposure_amount numeric,           -- Calculated risk exposure
    max_loss numeric,                  -- Maximum potential loss
    
    -- Correlation and clustering
    correlation_key text,              -- e.g., `${game_id}:${market}`
    correlation_cluster text,          -- 'same_game', 'same_player', 'same_market'
    
    -- Status and workflow
    published boolean DEFAULT false,
    risk_tier text DEFAULT 'medium' CHECK (risk_tier IN ('low', 'medium', 'high', 'critical')),
    
    -- Metadata
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz DEFAULT now() + interval '30 days'
);

-- Risk aggregation indexes
CREATE INDEX IF NOT EXISTS idx_exposure_snapshots_correlation ON exposure_snapshots(correlation_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exposure_snapshots_sport_market ON exposure_snapshots(sport, market, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exposure_snapshots_published ON exposure_snapshots(published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exposure_snapshots_risk_tier ON exposure_snapshots(risk_tier, created_at DESC);

-- =============================================================================
-- AUDIT & RBAC FRAMEWORK  
-- =============================================================================

-- Comprehensive audit logging
CREATE TABLE IF NOT EXISTS audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Actor identification
    actor text NOT NULL,               -- user id/email/system
    actor_type text DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'api', 'agent')),
    session_id text,                   -- Session identifier
    
    -- Action details
    action text NOT NULL,              -- e.g., 'TOGGLE_SAFE_MODE', 'APPROVE_PICK'
    resource_type text,                -- 'system', 'pick', 'agent', 'user'
    resource_id text,                  -- ID of affected resource
    
    -- Context and metadata
    payload jsonb DEFAULT '{}'::jsonb,
    previous_state jsonb,              -- State before action
    new_state jsonb,                   -- State after action
    
    -- Request context
    ip_address inet,
    user_agent text,
    request_id text,                   -- For tracing
    
    -- Result and impact
    status text DEFAULT 'success' CHECK (status IN ('success', 'failure', 'error')),
    error_message text,
    duration_ms integer,               -- Time taken to complete action
    
    created_at timestamptz DEFAULT now()
);

-- Audit query optimization
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_time ON audit_log(actor, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_time ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_session ON audit_log(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_status_time ON audit_log(status, created_at DESC);

-- Role-based access control
CREATE TABLE IF NOT EXISTS roles (
    user_id text PRIMARY KEY,          -- email or UUID
    role text NOT NULL CHECK (role IN ('VIEWER','OPS','ADMIN')),
    permissions text[] DEFAULT '{}',   -- Granular permissions array
    
    -- Role metadata
    granted_by text,                   -- Who granted this role
    granted_at timestamptz DEFAULT now(),
    expires_at timestamptz,            -- Optional role expiry
    
    -- Context
    team text,                         -- Team assignment
    region text,                       -- Regional access
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roles_role ON roles(role);
CREATE INDEX IF NOT EXISTS idx_roles_expires_at ON roles(expires_at) WHERE expires_at IS NOT NULL;

-- =============================================================================
-- TEMPORAL & WORKFLOW MONITORING
-- =============================================================================

-- Temporal workflow health tracking
CREATE TABLE IF NOT EXISTS temporal_workflow_health (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Workflow identification
    workflow_id text NOT NULL,
    workflow_type text NOT NULL,       -- 'GradingWorkflow', 'AlertWorkflow'
    task_queue text,                   -- 'grading', 'alerts', 'analytics'
    
    -- Status tracking
    status text NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'terminated', 'canceled')),
    execution_count integer DEFAULT 1,
    retry_count integer DEFAULT 0,
    
    -- Timing information
    started_at timestamptz,
    completed_at timestamptz,
    last_heartbeat timestamptz,
    duration_ms integer,               -- Total execution time
    
    -- Error tracking
    error_message text,
    error_stack text,
    failure_reason text,
    
    -- Metadata
    input_size_bytes integer,          -- Size of workflow input
    output_size_bytes integer,         -- Size of workflow output
    metadata jsonb DEFAULT '{}'::jsonb,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_temporal_workflow_type_status ON temporal_workflow_health(workflow_type, status);
CREATE INDEX IF NOT EXISTS idx_temporal_workflow_queue ON temporal_workflow_health(task_queue, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_temporal_workflow_heartbeat ON temporal_workflow_health(last_heartbeat DESC) WHERE status = 'running';

-- Temporal schedule monitoring
CREATE TABLE IF NOT EXISTS temporal_schedule_health (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Schedule identification
    schedule_id text NOT NULL,
    schedule_spec text,                -- Cron expression or interval
    workflow_type text NOT NULL,
    
    -- Health metrics
    last_scheduled_at timestamptz,
    last_completed_at timestamptz,
    next_scheduled_at timestamptz,
    
    -- Missed schedule detection
    expected_frequency_minutes integer DEFAULT 60,
    missed_count integer DEFAULT 0,
    is_missing boolean DEFAULT false,
    missing_since timestamptz,
    
    -- Status
    enabled boolean DEFAULT true,
    paused boolean DEFAULT false,
    paused_reason text,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_temporal_schedule_missing ON temporal_schedule_health(is_missing, missing_since);
CREATE INDEX IF NOT EXISTS idx_temporal_schedule_next ON temporal_schedule_health(next_scheduled_at);

-- =============================================================================
-- PERFORMANCE VIEWS & ROLLUPS
-- =============================================================================

-- Real-time queue backlog view
CREATE OR REPLACE VIEW vw_queue_backlog AS
SELECT
    COALESCE(sum(CASE WHEN workflow_stage IN ('draft', 'pending_review') AND is_instant = true THEN 1 ELSE 0 END), 0) AS instant_backlog,
    COALESCE(sum(CASE WHEN workflow_stage IN ('draft', 'pending_review') AND is_instant = false THEN 1 ELSE 0 END), 0) AS scheduled_backlog,
    COALESCE(sum(CASE WHEN workflow_stage = 'published' THEN 1 ELSE 0 END), 0) AS published_count,
    COALESCE(count(*), 0) AS total_picks
FROM unified_picks
WHERE created_at >= now() - interval '24 hours';

-- Grading performance metrics
CREATE OR REPLACE VIEW vw_grading_lag AS
SELECT
    COALESCE(avg(extract(epoch FROM (processed_at - created_at))*1000), 0)::numeric AS avg_ms,
    COALESCE(percentile_disc(0.95) WITHIN GROUP (ORDER BY extract(epoch FROM (processed_at - created_at))*1000), 0)::numeric AS p95_ms,
    COALESCE(percentile_disc(0.50) WITHIN GROUP (ORDER BY extract(epoch FROM (processed_at - created_at))*1000), 0)::numeric AS p50_ms,
    COALESCE(count(*), 0) AS processed_count,
    COALESCE(count(*) FILTER (WHERE processed_at IS NOT NULL), 0) AS completed_count
FROM raw_props
WHERE created_at >= now() - interval '24 hours';

-- CLV cohort analysis by time-to-post buckets  
CREATE OR REPLACE VIEW vw_clv_cohorts AS
SELECT
    sport,
    CASE
        WHEN (promoted_at - created_at) <= interval '1 hour' THEN '≤1h'
        WHEN (promoted_at - created_at) <= interval '3 hours' THEN '≤3h'
        WHEN (promoted_at - created_at) <= interval '6 hours' THEN '≤6h'
        ELSE '>6h'
    END AS post_delay_bucket,
    count(*) AS picks,
    COALESCE(avg(clv_pct), 0) AS avg_clv_pct,
    COALESCE(avg(devigged_edge), 0) AS avg_ev,
    COALESCE(avg(professional_score), 0) AS avg_score
FROM unified_picks
WHERE published = true
    AND promoted_at IS NOT NULL
    AND created_at >= now() - interval '30 days'
GROUP BY sport, post_delay_bucket;

-- Posting window recommendations
CREATE OR REPLACE VIEW vw_post_window_reco AS
SELECT 
    sport,
    post_delay_bucket,
    avg_clv_pct,
    picks,
    rank() OVER (PARTITION BY sport ORDER BY avg_clv_pct DESC) as recommendation_rank
FROM vw_clv_cohorts
WHERE picks >= 5  -- Minimum sample size
ORDER BY sport, avg_clv_pct DESC;

-- Exposure risk rollups
CREATE OR REPLACE VIEW vw_exposure_summary AS
SELECT
    sport,
    market,
    correlation_cluster,
    count(*) as position_count,
    sum(units) as total_units,
    sum(exposure_amount) as total_exposure,
    sum(max_loss) as total_max_loss,
    avg(kelly_fraction) as avg_kelly,
    max(created_at) as last_updated
FROM exposure_snapshots
WHERE published = true
    AND created_at >= now() - interval '24 hours'
GROUP BY sport, market, correlation_cluster;

-- SLO burn rate calculations
CREATE OR REPLACE VIEW vw_slo_status AS
SELECT
    s.id,
    s.name,
    s.title,
    s.objective,
    s.window,
    s.error_budget,
    
    -- Current SLI value (latest metric)
    (SELECT value 
     FROM system_metrics sm 
     WHERE sm.metric = s.sli_metric 
     ORDER BY created_at DESC 
     LIMIT 1) as current_sli,
     
    -- SLO status
    CASE 
        WHEN (SELECT value FROM system_metrics sm WHERE sm.metric = s.sli_metric ORDER BY created_at DESC LIMIT 1) <= s.objective 
        THEN 'healthy'
        ELSE 'breached'
    END as status,
    
    -- Active incidents
    (SELECT count(*) FROM slo_incidents si WHERE si.slo_id = s.id AND si.status = 'open') as active_incidents,
    
    s.enabled,
    s.created_at,
    s.updated_at
FROM slos s
WHERE s.enabled = true;

-- =============================================================================
-- CLEANUP & MAINTENANCE FUNCTIONS
-- =============================================================================

-- Auto-cleanup expired metrics
CREATE OR REPLACE FUNCTION cleanup_expired_metrics()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM system_metrics 
    WHERE expires_at IS NOT NULL 
        AND expires_at < now();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log cleanup action
    INSERT INTO audit_log (actor, action, payload) 
    VALUES (
        'system', 
        'CLEANUP_EXPIRED_METRICS', 
        jsonb_build_object('deleted_count', deleted_count)
    );
    
    RETURN deleted_count;
END;
$$;

-- Calculate SLO burn rate
CREATE OR REPLACE FUNCTION calculate_slo_burn_rate(
    slo_name text,
    window_duration interval DEFAULT interval '1 hour'
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_error_rate numeric;
    target_error_rate numeric;
    burn_rate numeric;
BEGIN
    -- Get current error rate for the window
    SELECT 
        COALESCE(
            (COUNT(*) FILTER (WHERE value > (SELECT objective FROM slos WHERE name = slo_name)))::numeric / 
            NULLIF(COUNT(*), 0)::numeric,
            0
        )
    INTO current_error_rate
    FROM system_metrics sm
    WHERE sm.metric = (SELECT sli_metric FROM slos WHERE name = slo_name)
        AND sm.created_at >= now() - window_duration;
    
    -- Get target error rate (error budget)
    SELECT error_budget INTO target_error_rate
    FROM slos 
    WHERE name = slo_name;
    
    -- Calculate burn rate
    burn_rate := CASE 
        WHEN target_error_rate > 0 
        THEN current_error_rate / target_error_rate
        ELSE 0
    END;
    
    RETURN COALESCE(burn_rate, 0);
END;
$$;

-- =============================================================================
-- INSERT DEFAULT SLOs
-- =============================================================================

-- Insert default SLOs for the platform
INSERT INTO slos (name, title, objective, window, sli_metric, error_budget, severity, description) VALUES
    ('grading_latency_p95', 'Grading Latency (95th percentile)', 30000, '30d', 'grading_lag_ms_p95', 0.05, 'high', 'Props must be graded within 30 seconds at 95th percentile'),
    ('api_response_time_p95', 'API Response Time (95th percentile)', 1000, '30d', 'api_response_time_ms_p95', 0.1, 'medium', 'API responses must be under 1 second at 95th percentile'),
    ('system_availability', 'System Availability', 99.9, '30d', 'system_uptime_pct', 0.001, 'critical', 'System must be available 99.9% of the time'),
    ('pick_processing_success', 'Pick Processing Success Rate', 99.5, '30d', 'pick_success_rate_pct', 0.005, 'high', 'Pick processing must succeed 99.5% of the time'),
    ('temporal_workflow_success', 'Temporal Workflow Success Rate', 99.0, '30d', 'temporal_success_rate_pct', 0.01, 'medium', 'Temporal workflows must succeed 99% of the time')
ON CONFLICT (name) DO UPDATE SET
    objective = EXCLUDED.objective,
    error_budget = EXCLUDED.error_budget,
    description = EXCLUDED.description,
    updated_at = now();

-- Insert default admin role
INSERT INTO roles (user_id, role, permissions) VALUES
    ('admin@unittalk.com', 'ADMIN', ARRAY['system:*', 'user:*', 'agent:*', 'audit:*'])
ON CONFLICT (user_id) DO UPDATE SET
    permissions = EXCLUDED.permissions,
    updated_at = now();

COMMENT ON TABLE system_metrics IS 'Time-series metrics storage for SLI/SLO monitoring';
COMMENT ON TABLE slos IS 'Service Level Objective definitions and configuration';
COMMENT ON TABLE slo_incidents IS 'SLO violations and burn-rate incidents';
COMMENT ON TABLE exposure_snapshots IS 'Risk exposure tracking per pick';
COMMENT ON TABLE audit_log IS 'Comprehensive audit trail for all system actions';
COMMENT ON TABLE roles IS 'Role-based access control for users';
COMMENT ON TABLE temporal_workflow_health IS 'Temporal workflow execution monitoring';
COMMENT ON TABLE temporal_schedule_health IS 'Temporal schedule health and missed schedule detection';