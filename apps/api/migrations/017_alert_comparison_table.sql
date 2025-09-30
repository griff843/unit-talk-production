-- =============================================
-- Alert Comparison Table
-- Stores results from feature-flagged alert processing comparisons
-- =============================================

CREATE TABLE IF NOT EXISTS alert_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification
    alert_id TEXT NOT NULL,
    user_id TEXT,
    
    -- Feature flag evaluation
    flag_enabled BOOLEAN NOT NULL,
    variant TEXT NOT NULL CHECK (variant IN ('control', 'treatment')),
    ab_test_group TEXT,
    
    -- Polling mode results
    polling_result JSONB NOT NULL,
    polling_latency INTEGER NOT NULL, -- milliseconds
    
    -- Event-driven mode results (optional)
    event_driven_result JSONB,
    event_driven_latency INTEGER, -- milliseconds
    
    -- Performance comparison
    latency_delta INTEGER NOT NULL, -- milliseconds difference
    accuracy_comparison DECIMAL(10,4), -- percentage difference in accuracy
    
    -- Selection
    selected_mode TEXT NOT NULL CHECK (selected_mode IN ('polling', 'event_driven')),
    selection_reason TEXT NOT NULL,
    
    -- Environment and metadata
    environment TEXT NOT NULL DEFAULT 'development',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_alert_comparisons_alert_id ON alert_comparisons(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_comparisons_user_id ON alert_comparisons(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_comparisons_flag_enabled ON alert_comparisons(flag_enabled);
CREATE INDEX IF NOT EXISTS idx_alert_comparisons_variant ON alert_comparisons(variant);
CREATE INDEX IF NOT EXISTS idx_alert_comparisons_created_at ON alert_comparisons(created_at);
CREATE INDEX IF NOT EXISTS idx_alert_comparisons_selected_mode ON alert_comparisons(selected_mode);
CREATE INDEX IF NOT EXISTS idx_alert_comparisons_environment ON alert_comparisons(environment);

-- Alert performance analysis view
CREATE OR REPLACE VIEW alert_performance_analysis AS
SELECT 
    environment,
    variant,
    selected_mode,
    
    -- Counts
    COUNT(*) as total_comparisons,
    COUNT(CASE WHEN event_driven_result IS NOT NULL THEN 1 END) as event_driven_evaluations,
    
    -- Performance metrics
    AVG(polling_latency) as avg_polling_latency,
    AVG(event_driven_latency) as avg_event_driven_latency,
    AVG(latency_delta) as avg_latency_delta,
    
    -- Performance percentiles
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY polling_latency) as p95_polling_latency,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY event_driven_latency) as p95_event_driven_latency,
    
    -- Accuracy comparison
    AVG(accuracy_comparison) as avg_accuracy_improvement,
    
    -- Mode selection rates
    COUNT(CASE WHEN selected_mode = 'event_driven' THEN 1 END)::DECIMAL / COUNT(*) as event_driven_selection_rate,
    COUNT(CASE WHEN selected_mode = 'polling' THEN 1 END)::DECIMAL / COUNT(*) as polling_selection_rate,
    
    -- Alert generation rates
    AVG((polling_result->>'alertsGenerated')::DECIMAL) as avg_polling_alerts,
    AVG((event_driven_result->>'alertsGenerated')::DECIMAL) as avg_event_driven_alerts,
    
    -- Time window
    MIN(created_at) as analysis_start,
    MAX(created_at) as analysis_end
    
FROM alert_comparisons
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY environment, variant, selected_mode;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON alert_comparisons TO service_role;
GRANT SELECT ON alert_performance_analysis TO service_role;

-- Comments
COMMENT ON TABLE alert_comparisons IS 'Comparison results between polling and event-driven alert systems for A/B testing analysis';
COMMENT ON VIEW alert_performance_analysis IS 'Performance analysis view for alert system A/B testing';