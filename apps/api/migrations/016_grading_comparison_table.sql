-- =============================================
-- Grading Comparison Table
-- Stores results from feature-flagged grading comparisons
-- =============================================

CREATE TABLE IF NOT EXISTS grading_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification
    prop_id TEXT NOT NULL,
    user_id TEXT,
    
    -- Feature flag evaluation
    flag_enabled BOOLEAN NOT NULL,
    variant TEXT NOT NULL CHECK (variant IN ('control', 'treatment')),
    ab_test_group TEXT,
    
    -- Legacy system results
    legacy_result JSONB NOT NULL,
    legacy_processing_time INTEGER NOT NULL, -- milliseconds
    
    -- Enhanced system results (optional)
    enhanced_result JSONB,
    enhanced_processing_time INTEGER, -- milliseconds
    
    -- Performance comparison
    performance_delta INTEGER NOT NULL, -- milliseconds difference
    accuracy_comparison DECIMAL(10,4), -- percentage difference in accuracy
    
    -- Selection
    selected_system TEXT NOT NULL CHECK (selected_system IN ('legacy', 'enhanced')),
    selection_reason TEXT NOT NULL,
    
    -- Environment and metadata
    environment TEXT NOT NULL DEFAULT 'development',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_grading_comparisons_prop_id ON grading_comparisons(prop_id);
CREATE INDEX IF NOT EXISTS idx_grading_comparisons_user_id ON grading_comparisons(user_id);
CREATE INDEX IF NOT EXISTS idx_grading_comparisons_flag_enabled ON grading_comparisons(flag_enabled);
CREATE INDEX IF NOT EXISTS idx_grading_comparisons_variant ON grading_comparisons(variant);
CREATE INDEX IF NOT EXISTS idx_grading_comparisons_created_at ON grading_comparisons(created_at);
CREATE INDEX IF NOT EXISTS idx_grading_comparisons_selected_system ON grading_comparisons(selected_system);
CREATE INDEX IF NOT EXISTS idx_grading_comparisons_environment ON grading_comparisons(environment);

-- Performance analysis view
CREATE OR REPLACE VIEW grading_performance_analysis AS
SELECT 
    environment,
    variant,
    selected_system,
    
    -- Counts
    COUNT(*) as total_comparisons,
    COUNT(CASE WHEN enhanced_result IS NOT NULL THEN 1 END) as enhanced_evaluations,
    
    -- Performance metrics
    AVG(legacy_processing_time) as avg_legacy_latency,
    AVG(enhanced_processing_time) as avg_enhanced_latency,
    AVG(performance_delta) as avg_performance_delta,
    
    -- Performance percentiles
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY legacy_processing_time) as p95_legacy_latency,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY enhanced_processing_time) as p95_enhanced_latency,
    
    -- Accuracy comparison
    AVG(accuracy_comparison) as avg_accuracy_improvement,
    
    -- System selection rates
    COUNT(CASE WHEN selected_system = 'enhanced' THEN 1 END)::DECIMAL / COUNT(*) as enhanced_selection_rate,
    COUNT(CASE WHEN selected_system = 'legacy' THEN 1 END)::DECIMAL / COUNT(*) as legacy_selection_rate,
    
    -- Score comparisons
    AVG((legacy_result->>'totalScore')::DECIMAL) as avg_legacy_score,
    AVG((enhanced_result->>'totalScore')::DECIMAL) as avg_enhanced_score,
    
    -- Time window
    MIN(created_at) as analysis_start,
    MAX(created_at) as analysis_end
    
FROM grading_comparisons
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY environment, variant, selected_system;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON grading_comparisons TO service_role;
GRANT SELECT ON grading_performance_analysis TO service_role;

-- Comments
COMMENT ON TABLE grading_comparisons IS 'Comparison results between legacy and enhanced grading systems for A/B testing analysis';
COMMENT ON VIEW grading_performance_analysis IS 'Performance analysis view for grading system A/B testing';