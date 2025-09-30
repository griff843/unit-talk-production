-- =============================================
-- Feature Flags System Migration
-- Phase 7: Comprehensive Feature Flag Infrastructure
-- =============================================

-- Feature flags configuration table
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name TEXT UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT false,
    rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    environment TEXT NOT NULL DEFAULT 'development',
    user_segments TEXT[],
    emergency_kill_switch BOOLEAN DEFAULT false,
    validation_gates JSONB NOT NULL DEFAULT '[]',
    dependencies TEXT[],
    ab_test_groups JSONB DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature flag evaluations log for analysis
CREATE TABLE IF NOT EXISTS feature_flag_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name TEXT NOT NULL,
    user_id TEXT,
    enabled BOOLEAN NOT NULL,
    variant TEXT,
    segment_match BOOLEAN DEFAULT true,
    rollout_bucket INTEGER NOT NULL,
    ab_test_group TEXT,
    evaluation_time TIMESTAMPTZ DEFAULT NOW(),
    context JSONB DEFAULT '{}',
    
    -- Performance tracking
    evaluation_latency_ms INTEGER,
    cache_hit BOOLEAN DEFAULT false
);

-- Feature flag metrics for rollout monitoring
CREATE TABLE IF NOT EXISTS feature_flag_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name TEXT NOT NULL,
    environment TEXT NOT NULL,
    rollout_percentage INTEGER NOT NULL,
    
    -- User metrics
    active_users INTEGER DEFAULT 0,
    evaluations_per_second DECIMAL(10,2) DEFAULT 0,
    
    -- Performance metrics
    error_rate DECIMAL(5,4) DEFAULT 0,
    latency_p50_ms INTEGER DEFAULT 0,
    latency_p95_ms INTEGER DEFAULT 0,
    latency_p99_ms INTEGER DEFAULT 0,
    throughput DECIMAL(10,2) DEFAULT 0,
    
    -- A/B test metrics
    conversion_rate_control DECIMAL(5,4),
    conversion_rate_treatment DECIMAL(5,4),
    statistical_significance DECIMAL(5,4),
    
    -- Validation gates
    validation_gates_passed INTEGER DEFAULT 0,
    validation_gates_failed INTEGER DEFAULT 0,
    
    -- Metadata
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    collection_period_minutes INTEGER DEFAULT 5,
    metadata JSONB DEFAULT '{}'
);

-- A/B test results for statistical analysis
CREATE TABLE IF NOT EXISTS ab_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name TEXT NOT NULL,
    variant TEXT NOT NULL, -- 'control' or 'treatment'
    user_id TEXT NOT NULL,
    
    -- Event tracking
    event_type TEXT NOT NULL, -- 'conversion', 'error', 'engagement', etc.
    event_value DECIMAL(10,4), -- numeric value for the event
    event_metadata JSONB DEFAULT '{}',
    
    -- Context
    session_id TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    environment TEXT NOT NULL DEFAULT 'development',
    
    -- Performance impact
    latency_ms INTEGER,
    error_occurred BOOLEAN DEFAULT false,
    error_details TEXT,
    
    UNIQUE(flag_name, user_id, event_type, timestamp)
);

-- Feature flag deployment history
CREATE TABLE IF NOT EXISTS feature_flag_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name TEXT NOT NULL,
    deployment_type TEXT NOT NULL, -- 'rollout', 'rollback', 'kill_switch', 'config_change'
    
    -- Deployment details
    previous_percentage INTEGER,
    new_percentage INTEGER,
    previous_config JSONB,
    new_config JSONB,
    
    -- Deployment metadata
    initiated_by TEXT, -- user or system identifier
    reason TEXT,
    automated BOOLEAN DEFAULT false,
    
    -- Validation and safety
    validation_passed BOOLEAN,
    safety_checks_passed BOOLEAN,
    rollback_triggered BOOLEAN DEFAULT false,
    
    -- Timing
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    
    -- Results
    deployment_status TEXT DEFAULT 'in_progress', -- 'in_progress', 'completed', 'failed', 'rolled_back'
    error_message TEXT,
    
    metadata JSONB DEFAULT '{}'
);

-- Rollout validation gates configuration
CREATE TABLE IF NOT EXISTS rollout_validation_gates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name TEXT NOT NULL,
    gate_name TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    threshold_value DECIMAL(10,4) NOT NULL,
    comparison_operator TEXT NOT NULL CHECK (comparison_operator IN ('gt', 'lt', 'gte', 'lte', 'eq')),
    required BOOLEAN DEFAULT true,
    weight DECIMAL(3,2) DEFAULT 1.0, -- For weighted gate scoring
    
    -- Time-based validation
    evaluation_window_minutes INTEGER DEFAULT 5,
    minimum_sample_size INTEGER DEFAULT 100,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    
    UNIQUE(flag_name, gate_name)
);

-- Emergency rollback log
CREATE TABLE IF NOT EXISTS emergency_rollbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name TEXT NOT NULL,
    trigger_reason TEXT NOT NULL,
    trigger_type TEXT NOT NULL, -- 'manual', 'automatic', 'validation_failure'
    
    -- Pre-rollback state
    rollout_percentage_before INTEGER NOT NULL,
    active_users_affected INTEGER,
    
    -- Trigger details
    triggered_by TEXT, -- user or system identifier
    trigger_metric TEXT, -- which metric triggered the rollback
    trigger_value DECIMAL(10,4), -- value that triggered rollback
    threshold_breached DECIMAL(10,4), -- threshold that was breached
    
    -- Rollback execution
    rollback_initiated_at TIMESTAMPTZ DEFAULT NOW(),
    rollback_completed_at TIMESTAMPTZ,
    rollback_duration_seconds INTEGER,
    rollback_successful BOOLEAN,
    
    -- Impact assessment
    estimated_users_affected INTEGER,
    estimated_revenue_impact DECIMAL(12,2),
    
    -- Follow-up
    incident_created BOOLEAN DEFAULT false,
    incident_id TEXT,
    post_mortem_required BOOLEAN DEFAULT true,
    
    metadata JSONB DEFAULT '{}'
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Feature flags indexes
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(flag_name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_environment ON feature_flags(environment);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flags_updated_at ON feature_flags(updated_at);

-- Feature flag evaluations indexes
CREATE INDEX IF NOT EXISTS idx_evaluations_flag_name ON feature_flag_evaluations(flag_name);
CREATE INDEX IF NOT EXISTS idx_evaluations_user_id ON feature_flag_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_time ON feature_flag_evaluations(evaluation_time);
CREATE INDEX IF NOT EXISTS idx_evaluations_enabled ON feature_flag_evaluations(enabled);
CREATE INDEX IF NOT EXISTS idx_evaluations_variant ON feature_flag_evaluations(variant);

-- Feature flag metrics indexes  
CREATE INDEX IF NOT EXISTS idx_metrics_flag_name ON feature_flag_metrics(flag_name);
CREATE INDEX IF NOT EXISTS idx_metrics_environment ON feature_flag_metrics(environment);
CREATE INDEX IF NOT EXISTS idx_metrics_collected_at ON feature_flag_metrics(collected_at);
CREATE INDEX IF NOT EXISTS idx_metrics_rollout_percentage ON feature_flag_metrics(rollout_percentage);

-- A/B test results indexes
CREATE INDEX IF NOT EXISTS idx_ab_results_flag_name ON ab_test_results(flag_name);
CREATE INDEX IF NOT EXISTS idx_ab_results_variant ON ab_test_results(variant);
CREATE INDEX IF NOT EXISTS idx_ab_results_user_id ON ab_test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_ab_results_timestamp ON ab_test_results(timestamp);
CREATE INDEX IF NOT EXISTS idx_ab_results_event_type ON ab_test_results(event_type);

-- Deployment history indexes
CREATE INDEX IF NOT EXISTS idx_deployments_flag_name ON feature_flag_deployments(flag_name);
CREATE INDEX IF NOT EXISTS idx_deployments_type ON feature_flag_deployments(deployment_type);
CREATE INDEX IF NOT EXISTS idx_deployments_initiated_at ON feature_flag_deployments(initiated_at);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON feature_flag_deployments(deployment_status);

-- Emergency rollbacks indexes
CREATE INDEX IF NOT EXISTS idx_rollbacks_flag_name ON emergency_rollbacks(flag_name);
CREATE INDEX IF NOT EXISTS idx_rollbacks_initiated_at ON emergency_rollbacks(rollback_initiated_at);
CREATE INDEX IF NOT EXISTS idx_rollbacks_trigger_type ON emergency_rollbacks(trigger_type);

-- =============================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================

-- Update timestamp trigger for feature_flags
CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_feature_flags_updated_at
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_feature_flags_updated_at();

-- Update timestamp trigger for rollout_validation_gates
CREATE OR REPLACE FUNCTION update_validation_gates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_validation_gates_updated_at
    BEFORE UPDATE ON rollout_validation_gates
    FOR EACH ROW
    EXECUTE FUNCTION update_validation_gates_updated_at();

-- =============================================
-- VIEWS FOR ANALYTICS AND MONITORING
-- =============================================

-- Feature flag rollout status view
CREATE OR REPLACE VIEW feature_flag_status AS
SELECT 
    ff.flag_name,
    ff.enabled,
    ff.rollout_percentage,
    ff.environment,
    ff.emergency_kill_switch,
    ff.updated_at,
    
    -- Latest metrics
    fm.active_users,
    fm.error_rate,
    fm.latency_p99_ms,
    fm.throughput,
    fm.collected_at as metrics_updated_at,
    
    -- A/B test summary
    CASE 
        WHEN jsonb_array_length(ff.ab_test_groups) > 0 THEN true 
        ELSE false 
    END as has_ab_test,
    
    -- Deployment status
    (
        SELECT deployment_status 
        FROM feature_flag_deployments 
        WHERE flag_name = ff.flag_name 
        ORDER BY initiated_at DESC 
        LIMIT 1
    ) as last_deployment_status
    
FROM feature_flags ff
LEFT JOIN LATERAL (
    SELECT * FROM feature_flag_metrics 
    WHERE flag_name = ff.flag_name 
    ORDER BY collected_at DESC 
    LIMIT 1
) fm ON true;

-- A/B test performance comparison view
CREATE OR REPLACE VIEW ab_test_performance AS
SELECT 
    flag_name,
    environment,
    
    -- Control group metrics
    COUNT(CASE WHEN variant = 'control' THEN 1 END) as control_users,
    AVG(CASE WHEN variant = 'control' THEN event_value END) as control_avg_value,
    COUNT(CASE WHEN variant = 'control' AND event_type = 'conversion' THEN 1 END) as control_conversions,
    
    -- Treatment group metrics  
    COUNT(CASE WHEN variant = 'treatment' THEN 1 END) as treatment_users,
    AVG(CASE WHEN variant = 'treatment' THEN event_value END) as treatment_avg_value,
    COUNT(CASE WHEN variant = 'treatment' AND event_type = 'conversion' THEN 1 END) as treatment_conversions,
    
    -- Performance comparison
    AVG(CASE WHEN variant = 'control' THEN latency_ms END) as control_avg_latency,
    AVG(CASE WHEN variant = 'treatment' THEN latency_ms END) as treatment_avg_latency,
    
    -- Error rates
    AVG(CASE WHEN variant = 'control' THEN CASE WHEN error_occurred THEN 1.0 ELSE 0.0 END END) as control_error_rate,
    AVG(CASE WHEN variant = 'treatment' THEN CASE WHEN error_occurred THEN 1.0 ELSE 0.0 END END) as treatment_error_rate,
    
    -- Time window
    MIN(timestamp) as test_start,
    MAX(timestamp) as test_end,
    COUNT(DISTINCT DATE(timestamp)) as test_days
    
FROM ab_test_results
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY flag_name, environment
HAVING COUNT(*) >= 100; -- Minimum sample size

-- Emergency rollback summary view
CREATE OR REPLACE VIEW emergency_rollback_summary AS
SELECT 
    flag_name,
    COUNT(*) as total_rollbacks,
    COUNT(CASE WHEN rollback_successful THEN 1 END) as successful_rollbacks,
    AVG(rollback_duration_seconds) as avg_rollback_duration,
    MAX(rollback_initiated_at) as last_rollback,
    
    -- Most common trigger reasons
    mode() WITHIN GROUP (ORDER BY trigger_reason) as most_common_reason,
    
    -- Impact assessment
    SUM(estimated_users_affected) as total_users_affected,
    SUM(estimated_revenue_impact) as total_revenue_impact
    
FROM emergency_rollbacks
WHERE rollback_initiated_at >= NOW() - INTERVAL '90 days'
GROUP BY flag_name;

-- =============================================
-- INITIAL DATA SEEDING
-- =============================================

-- Insert default feature flags for syndicate-grade components
INSERT INTO feature_flags (flag_name, enabled, rollout_percentage, environment, validation_gates, dependencies, ab_test_groups, metadata) VALUES 
(
    'enhanced_45_factor_grading',
    false,
    0,
    'production',
    '[
        {"metric": "processing_latency_p99", "threshold": 50, "operator": "lt", "required": true},
        {"metric": "accuracy_rate", "threshold": 0.95, "operator": "gte", "required": true},
        {"metric": "error_rate", "threshold": 0.01, "operator": "lt", "required": true}
    ]'::jsonb,
    ARRAY['feature_store_integration'],
    '[
        {"name": "legacy_grading", "percentage": 50, "variant": "control", "config": {"engine": "legacy"}},
        {"name": "enhanced_45_factor", "percentage": 50, "variant": "treatment", "config": {"engine": "enhanced_45_factor"}}
    ]'::jsonb,
    '{
        "description": "Enhanced 45-factor scoring engine vs legacy system",
        "owner": "grading-team",
        "version": "1.0.0"
    }'::jsonb
),
(
    'event_driven_alert_agent',
    false,
    0,
    'production',
    '[
        {"metric": "alert_latency_p99", "threshold": 1000, "operator": "lt", "required": true},
        {"metric": "alert_accuracy", "threshold": 0.98, "operator": "gte", "required": true},
        {"metric": "false_positive_rate", "threshold": 0.05, "operator": "lt", "required": true}
    ]'::jsonb,
    ARRAY['hot_warm_cold_pipeline'],
    '[
        {"name": "polling_mode", "percentage": 50, "variant": "control", "config": {"mode": "polling"}},
        {"name": "event_driven", "percentage": 50, "variant": "treatment", "config": {"mode": "event_driven"}}
    ]'::jsonb,
    '{
        "description": "Event-driven AlertAgent vs polling mode",
        "owner": "alert-team",
        "version": "1.0.0"
    }'::jsonb
),
(
    'hot_warm_cold_pipeline',
    false,
    0,
    'production',
    '[
        {"metric": "data_ingestion_latency", "threshold": 100, "operator": "lt", "required": true},
        {"metric": "data_consistency_rate", "threshold": 0.999, "operator": "gte", "required": true},
        {"metric": "storage_efficiency", "threshold": 0.8, "operator": "gte", "required": true}
    ]'::jsonb,
    ARRAY[]::TEXT[],
    '[]'::jsonb,
    '{
        "description": "HOT/WARM/COLD data architecture vs raw_props only",
        "owner": "data-team",
        "version": "1.0.0"
    }'::jsonb
),
(
    'feature_store_integration',
    false,
    0,
    'production',
    '[
        {"metric": "feature_retrieval_latency", "threshold": 50, "operator": "lt", "required": true},
        {"metric": "feature_freshness", "threshold": 0.95, "operator": "gte", "required": true},
        {"metric": "cache_hit_rate", "threshold": 0.9, "operator": "gte", "required": true}
    ]'::jsonb,
    ARRAY['hot_warm_cold_pipeline'],
    '[
        {"name": "realtime_computation", "percentage": 50, "variant": "control", "config": {"mode": "realtime"}},
        {"name": "feature_store", "percentage": 50, "variant": "treatment", "config": {"mode": "feature_store"}}
    ]'::jsonb,
    '{
        "description": "Feature store integration vs real-time computation",
        "owner": "ml-team",
        "version": "1.0.0"
    }'::jsonb
),
(
    'slo_monitoring_system',
    false,
    0,
    'production',
    '[
        {"metric": "monitoring_latency", "threshold": 500, "operator": "lt", "required": true},
        {"metric": "alert_delivery_rate", "threshold": 0.99, "operator": "gte", "required": true},
        {"metric": "false_alert_rate", "threshold": 0.02, "operator": "lt", "required": true}
    ]'::jsonb,
    ARRAY[]::TEXT[],
    '[]'::jsonb,
    '{
        "description": "Advanced SLO monitoring and alerting system",
        "owner": "infrastructure-team",
        "version": "1.0.0"
    }'::jsonb
)
ON CONFLICT (flag_name) DO NOTHING;

-- Insert validation gates for each feature
INSERT INTO rollout_validation_gates (flag_name, gate_name, metric_name, threshold_value, comparison_operator, required, weight) VALUES
-- Enhanced 45-factor grading gates
('enhanced_45_factor_grading', 'processing_latency', 'processing_latency_p99', 50, 'lt', true, 1.0),
('enhanced_45_factor_grading', 'accuracy_threshold', 'accuracy_rate', 0.95, 'gte', true, 1.0),
('enhanced_45_factor_grading', 'error_threshold', 'error_rate', 0.01, 'lt', true, 1.0),
('enhanced_45_factor_grading', 'throughput_minimum', 'throughput', 100, 'gte', true, 0.8),

-- Event-driven alert agent gates
('event_driven_alert_agent', 'alert_latency', 'alert_latency_p99', 1000, 'lt', true, 1.0),
('event_driven_alert_agent', 'alert_accuracy', 'alert_accuracy', 0.98, 'gte', true, 1.0),
('event_driven_alert_agent', 'false_positive_threshold', 'false_positive_rate', 0.05, 'lt', true, 1.0),

-- HOT/WARM/COLD pipeline gates
('hot_warm_cold_pipeline', 'ingestion_latency', 'data_ingestion_latency', 100, 'lt', true, 1.0),
('hot_warm_cold_pipeline', 'consistency_rate', 'data_consistency_rate', 0.999, 'gte', true, 1.0),
('hot_warm_cold_pipeline', 'storage_efficiency', 'storage_efficiency', 0.8, 'gte', true, 0.8),

-- Feature store integration gates
('feature_store_integration', 'retrieval_latency', 'feature_retrieval_latency', 50, 'lt', true, 1.0),
('feature_store_integration', 'feature_freshness', 'feature_freshness', 0.95, 'gte', true, 1.0),
('feature_store_integration', 'cache_performance', 'cache_hit_rate', 0.9, 'gte', true, 0.8),

-- SLO monitoring system gates
('slo_monitoring_system', 'monitoring_latency', 'monitoring_latency', 500, 'lt', true, 1.0),
('slo_monitoring_system', 'alert_delivery', 'alert_delivery_rate', 0.99, 'gte', true, 1.0),
('slo_monitoring_system', 'false_alert_threshold', 'false_alert_rate', 0.02, 'lt', true, 1.0)
ON CONFLICT (flag_name, gate_name) DO NOTHING;

-- =============================================
-- GRANTS AND PERMISSIONS
-- =============================================

-- Grant necessary permissions to service roles
GRANT SELECT, INSERT, UPDATE ON feature_flags TO service_role;
GRANT SELECT, INSERT ON feature_flag_evaluations TO service_role;
GRANT SELECT, INSERT, UPDATE ON feature_flag_metrics TO service_role;
GRANT SELECT, INSERT ON ab_test_results TO service_role;
GRANT SELECT, INSERT, UPDATE ON feature_flag_deployments TO service_role;
GRANT SELECT, INSERT ON emergency_rollbacks TO service_role;
GRANT SELECT, INSERT, UPDATE ON rollout_validation_gates TO service_role;

-- Grant read access to views
GRANT SELECT ON feature_flag_status TO service_role;
GRANT SELECT ON ab_test_performance TO service_role;
GRANT SELECT ON emergency_rollback_summary TO service_role;

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE feature_flags IS 'Configuration table for feature flags with rollout controls, A/B testing, and validation gates';
COMMENT ON TABLE feature_flag_evaluations IS 'Log of all feature flag evaluations for analysis and debugging';
COMMENT ON TABLE feature_flag_metrics IS 'Real-time metrics for monitoring feature flag rollout performance';
COMMENT ON TABLE ab_test_results IS 'Results tracking for A/B tests including conversion and performance metrics';
COMMENT ON TABLE feature_flag_deployments IS 'History of all feature flag deployment activities and rollouts';
COMMENT ON TABLE emergency_rollbacks IS 'Log of emergency rollbacks with trigger reasons and impact assessment';
COMMENT ON TABLE rollout_validation_gates IS 'Configuration for validation gates that control rollout progression';

COMMENT ON VIEW feature_flag_status IS 'Real-time status view combining flag configuration with latest metrics';
COMMENT ON VIEW ab_test_performance IS 'A/B test performance comparison with statistical analysis';
COMMENT ON VIEW emergency_rollback_summary IS 'Summary of emergency rollbacks for operational insights';