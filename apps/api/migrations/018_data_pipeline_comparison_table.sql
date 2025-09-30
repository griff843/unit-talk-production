-- =============================================
-- Data Pipeline Comparison Table
-- Stores results from feature-flagged data pipeline comparisons
-- =============================================

CREATE TABLE IF NOT EXISTS data_pipeline_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification
    comparison_id TEXT NOT NULL,
    user_id TEXT,
    
    -- Feature flag evaluation
    flag_enabled BOOLEAN NOT NULL,
    variant TEXT NOT NULL CHECK (variant IN ('control', 'treatment')),
    ab_test_group TEXT,
    
    -- Raw props results (baseline)
    raw_props_result JSONB NOT NULL,
    raw_props_latency INTEGER NOT NULL, -- milliseconds
    
    -- HOT/WARM/COLD results (optional)
    hot_warm_cold_result JSONB,
    hot_warm_cold_latency INTEGER, -- milliseconds
    
    -- Performance comparison
    latency_delta INTEGER NOT NULL, -- milliseconds difference
    storage_efficiency_delta DECIMAL(10,4), -- percentage difference
    consistency_delta DECIMAL(10,4), -- percentage difference
    
    -- Selection
    selected_pipeline TEXT NOT NULL CHECK (selected_pipeline IN ('raw_props_only', 'hot_warm_cold')),
    selection_reason TEXT NOT NULL,
    
    -- Batch metadata
    batch_size INTEGER NOT NULL,
    
    -- Environment and metadata
    environment TEXT NOT NULL DEFAULT 'development',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipeline_comparisons_comparison_id ON data_pipeline_comparisons(comparison_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_comparisons_user_id ON data_pipeline_comparisons(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_comparisons_flag_enabled ON data_pipeline_comparisons(flag_enabled);
CREATE INDEX IF NOT EXISTS idx_pipeline_comparisons_variant ON data_pipeline_comparisons(variant);
CREATE INDEX IF NOT EXISTS idx_pipeline_comparisons_created_at ON data_pipeline_comparisons(created_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_comparisons_selected_pipeline ON data_pipeline_comparisons(selected_pipeline);
CREATE INDEX IF NOT EXISTS idx_pipeline_comparisons_environment ON data_pipeline_comparisons(environment);

-- Data pipeline performance analysis view
CREATE OR REPLACE VIEW data_pipeline_performance_analysis AS
SELECT 
    environment,
    variant,
    selected_pipeline,
    
    -- Counts
    COUNT(*) as total_comparisons,
    COUNT(CASE WHEN hot_warm_cold_result IS NOT NULL THEN 1 END) as hot_warm_cold_evaluations,
    
    -- Performance metrics
    AVG(raw_props_latency) as avg_raw_props_latency,
    AVG(hot_warm_cold_latency) as avg_hot_warm_cold_latency,
    AVG(latency_delta) as avg_latency_delta,
    
    -- Performance percentiles
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY raw_props_latency) as p95_raw_props_latency,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY hot_warm_cold_latency) as p95_hot_warm_cold_latency,
    
    -- Efficiency comparison
    AVG(storage_efficiency_delta) as avg_storage_efficiency_improvement,
    AVG(consistency_delta) as avg_consistency_improvement,
    
    -- Pipeline selection rates
    COUNT(CASE WHEN selected_pipeline = 'hot_warm_cold' THEN 1 END)::DECIMAL / COUNT(*) as hot_warm_cold_selection_rate,
    COUNT(CASE WHEN selected_pipeline = 'raw_props_only' THEN 1 END)::DECIMAL / COUNT(*) as raw_props_selection_rate,
    
    -- Processing efficiency
    AVG((raw_props_result->>'storageEfficiency')::DECIMAL) as avg_raw_props_efficiency,
    AVG((hot_warm_cold_result->>'storageEfficiency')::DECIMAL) as avg_hot_warm_cold_efficiency,
    
    -- Data quality metrics
    AVG((raw_props_result->>'dataConsistency')::DECIMAL) as avg_raw_props_consistency,
    AVG((hot_warm_cold_result->>'dataConsistency')::DECIMAL) as avg_hot_warm_cold_consistency,
    
    -- Batch size analysis
    AVG(batch_size) as avg_batch_size,
    SUM((raw_props_result->>'recordsProcessed')::INTEGER) as total_records_processed,
    
    -- Time window
    MIN(created_at) as analysis_start,
    MAX(created_at) as analysis_end
    
FROM data_pipeline_comparisons
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY environment, variant, selected_pipeline;

-- Storage efficiency trend view
CREATE OR REPLACE VIEW storage_efficiency_trends AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour_bucket,
    variant,
    selected_pipeline,
    
    -- Efficiency metrics
    AVG(storage_efficiency_delta) as avg_efficiency_delta,
    COUNT(*) as comparisons_count,
    
    -- Storage tier distribution (for hot_warm_cold)
    AVG((hot_warm_cold_result->>'hotDataWrites')::INTEGER) as avg_hot_writes,
    AVG((hot_warm_cold_result->>'warmDataWrites')::INTEGER) as avg_warm_writes,
    AVG((hot_warm_cold_result->>'coldDataWrites')::INTEGER) as avg_cold_writes,
    
    -- Compression effectiveness
    AVG((hot_warm_cold_result->>'compressionRatio')::DECIMAL) as avg_compression_ratio,
    
    -- Error rates
    AVG((raw_props_result->>'errorCount')::INTEGER) as avg_raw_props_errors,
    AVG((hot_warm_cold_result->>'errorCount')::INTEGER) as avg_hot_warm_cold_errors

FROM data_pipeline_comparisons
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY hour_bucket, variant, selected_pipeline
ORDER BY hour_bucket DESC;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON data_pipeline_comparisons TO service_role;
GRANT SELECT ON data_pipeline_performance_analysis TO service_role;
GRANT SELECT ON storage_efficiency_trends TO service_role;

-- Comments
COMMENT ON TABLE data_pipeline_comparisons IS 'Comparison results between raw props and HOT/WARM/COLD data pipelines for A/B testing analysis';
COMMENT ON VIEW data_pipeline_performance_analysis IS 'Performance analysis view for data pipeline A/B testing';
COMMENT ON VIEW storage_efficiency_trends IS 'Hourly trends for storage efficiency and data tier distribution';