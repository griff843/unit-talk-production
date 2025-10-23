-- Migration: ML Shadow Predictions Table
-- Purpose: Store shadow mode predictions for ML model validation
-- Date: 2025-10-23
-- Phase: 7B Online ML Serving

BEGIN;

-- Create ML shadow predictions table for shadow mode logging
CREATE TABLE IF NOT EXISTS public.ml_shadow_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prop_id VARCHAR(255) NOT NULL,
    raw_prop_id UUID REFERENCES public.raw_props(id),
    
    -- Prediction data
    ml_prediction DECIMAL(10, 8) NOT NULL,
    ml_confidence DECIMAL(10, 8) NOT NULL,
    heuristic_prediction DECIMAL(10, 8),
    
    -- Model information
    model_version VARCHAR(100) NOT NULL,
    model_features JSONB NOT NULL,
    feature_values JSONB NOT NULL,
    
    -- Performance metrics
    prediction_latency_ms INTEGER NOT NULL,
    from_cache BOOLEAN DEFAULT FALSE,
    fallback_used BOOLEAN DEFAULT FALSE,
    
    -- Comparison data (vs production heuristic)
    production_score DECIMAL(10, 8),
    production_tier VARCHAR(10),
    discrepancy_score DECIMAL(10, 8),
    discrepancy_magnitude VARCHAR(20), -- 'low', 'medium', 'high', 'extreme'
    
    -- Validation tracking
    actual_outcome DECIMAL(10, 8), -- Set when game completes
    ml_correct BOOLEAN, -- Set after game completion
    heuristic_correct BOOLEAN, -- Set after game completion
    accuracy_differential DECIMAL(10, 8), -- ML accuracy - heuristic accuracy
    
    -- Metadata
    environment VARCHAR(20) DEFAULT 'shadow', -- 'shadow', 'canary', 'production'
    deployment_stage VARCHAR(20) DEFAULT 'stage1', -- 'stage1' (0%), 'stage2' (5%), 'stage3' (100%)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    validated_at TIMESTAMPTZ,
    
    -- Sports context
    sport VARCHAR(10),
    market_type VARCHAR(50),
    player_name VARCHAR(255),
    game_date TIMESTAMPTZ,
    
    -- Error tracking
    error_message TEXT,
    error_type VARCHAR(50),
    
    CONSTRAINT ml_shadow_predictions_prop_id_model_version_unique 
        UNIQUE(prop_id, model_version, created_at)
);

-- Add indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_shadow_predictions_prop_id 
    ON public.ml_shadow_predictions(prop_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_shadow_predictions_model_version 
    ON public.ml_shadow_predictions(model_version);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_shadow_predictions_created_at 
    ON public.ml_shadow_predictions(created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_shadow_predictions_discrepancy 
    ON public.ml_shadow_predictions(discrepancy_magnitude, discrepancy_score);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_shadow_predictions_validation 
    ON public.ml_shadow_predictions(ml_correct, heuristic_correct, accuracy_differential);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_shadow_predictions_deployment 
    ON public.ml_shadow_predictions(environment, deployment_stage);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_shadow_predictions_sport_market 
    ON public.ml_shadow_predictions(sport, market_type);

-- Add composite index for time-series analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_shadow_predictions_time_series 
    ON public.ml_shadow_predictions(model_version, created_at, discrepancy_score);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_ml_shadow_predictions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ml_shadow_predictions_updated_at 
    ON public.ml_shadow_predictions;

CREATE TRIGGER trigger_update_ml_shadow_predictions_updated_at
    BEFORE UPDATE ON public.ml_shadow_predictions
    FOR EACH ROW
    EXECUTE FUNCTION update_ml_shadow_predictions_updated_at();

-- Create validation trigger to auto-calculate discrepancy
CREATE OR REPLACE FUNCTION calculate_ml_discrepancy()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate discrepancy if production score exists
    IF NEW.production_score IS NOT NULL THEN
        NEW.discrepancy_score = ABS(NEW.ml_prediction - NEW.production_score);
        
        -- Classify discrepancy magnitude
        NEW.discrepancy_magnitude = CASE
            WHEN NEW.discrepancy_score < 0.1 THEN 'low'
            WHEN NEW.discrepancy_score < 0.25 THEN 'medium'
            WHEN NEW.discrepancy_score < 0.5 THEN 'high'
            ELSE 'extreme'
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_ml_discrepancy 
    ON public.ml_shadow_predictions;

CREATE TRIGGER trigger_calculate_ml_discrepancy
    BEFORE INSERT OR UPDATE ON public.ml_shadow_predictions
    FOR EACH ROW
    EXECUTE FUNCTION calculate_ml_discrepancy();

-- Create RLS policies
ALTER TABLE public.ml_shadow_predictions ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users (monitoring dashboards)
CREATE POLICY "Allow read access for authenticated users" 
    ON public.ml_shadow_predictions
    FOR SELECT 
    TO authenticated
    USING (true);

-- Allow insert/update for service role (ML agents)
CREATE POLICY "Allow ML agents to insert predictions" 
    ON public.ml_shadow_predictions
    FOR INSERT 
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Allow ML agents to update predictions" 
    ON public.ml_shadow_predictions
    FOR UPDATE 
    TO service_role
    USING (true);

-- Create ML performance metrics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS public.ml_performance_metrics AS
SELECT 
    model_version,
    environment,
    deployment_stage,
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as total_predictions,
    AVG(prediction_latency_ms) as avg_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY prediction_latency_ms) as p95_latency_ms,
    COUNT(*) FILTER (WHERE from_cache = true) as cache_hits,
    COUNT(*) FILTER (WHERE fallback_used = true) as fallback_count,
    COUNT(*) FILTER (WHERE error_message IS NOT NULL) as error_count,
    AVG(discrepancy_score) as avg_discrepancy,
    COUNT(*) FILTER (WHERE discrepancy_magnitude = 'extreme') as extreme_discrepancies,
    COUNT(*) FILTER (WHERE ml_correct = true) as ml_correct_count,
    COUNT(*) FILTER (WHERE heuristic_correct = true) as heuristic_correct_count,
    COUNT(*) FILTER (WHERE actual_outcome IS NOT NULL) as validated_count,
    AVG(accuracy_differential) as avg_accuracy_differential
FROM public.ml_shadow_predictions
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY model_version, environment, deployment_stage, DATE_TRUNC('hour', created_at);

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_performance_metrics_unique 
    ON public.ml_performance_metrics(model_version, environment, deployment_stage, hour);

-- Create refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_ml_performance_metrics()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.ml_performance_metrics;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON public.ml_shadow_predictions TO authenticated;
GRANT ALL ON public.ml_shadow_predictions TO service_role;
GRANT SELECT ON public.ml_performance_metrics TO authenticated;
GRANT ALL ON public.ml_performance_metrics TO service_role;

-- Create function to log shadow prediction
CREATE OR REPLACE FUNCTION log_shadow_prediction(
    p_prop_id VARCHAR(255),
    p_raw_prop_id UUID,
    p_ml_prediction DECIMAL(10, 8),
    p_ml_confidence DECIMAL(10, 8),
    p_heuristic_prediction DECIMAL(10, 8),
    p_model_version VARCHAR(100),
    p_model_features JSONB,
    p_feature_values JSONB,
    p_prediction_latency_ms INTEGER,
    p_from_cache BOOLEAN DEFAULT FALSE,
    p_fallback_used BOOLEAN DEFAULT FALSE,
    p_production_score DECIMAL(10, 8) DEFAULT NULL,
    p_production_tier VARCHAR(10) DEFAULT NULL,
    p_environment VARCHAR(20) DEFAULT 'shadow',
    p_deployment_stage VARCHAR(20) DEFAULT 'stage1',
    p_sport VARCHAR(10) DEFAULT NULL,
    p_market_type VARCHAR(50) DEFAULT NULL,
    p_player_name VARCHAR(255) DEFAULT NULL,
    p_game_date TIMESTAMPTZ DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_error_type VARCHAR(50) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    prediction_id UUID;
BEGIN
    INSERT INTO public.ml_shadow_predictions (
        prop_id, raw_prop_id, ml_prediction, ml_confidence, heuristic_prediction,
        model_version, model_features, feature_values, prediction_latency_ms,
        from_cache, fallback_used, production_score, production_tier,
        environment, deployment_stage, sport, market_type, player_name,
        game_date, error_message, error_type
    ) VALUES (
        p_prop_id, p_raw_prop_id, p_ml_prediction, p_ml_confidence, p_heuristic_prediction,
        p_model_version, p_model_features, p_feature_values, p_prediction_latency_ms,
        p_from_cache, p_fallback_used, p_production_score, p_production_tier,
        p_environment, p_deployment_stage, p_sport, p_market_type, p_player_name,
        p_game_date, p_error_message, p_error_type
    )
    RETURNING id INTO prediction_id;
    
    RETURN prediction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on function
GRANT EXECUTE ON FUNCTION log_shadow_prediction TO service_role;

COMMIT;

-- Add comments for documentation
COMMENT ON TABLE public.ml_shadow_predictions IS 
'Shadow mode predictions for ML model validation and A/B testing';

COMMENT ON COLUMN public.ml_shadow_predictions.discrepancy_score IS 
'Absolute difference between ML prediction and production heuristic score';

COMMENT ON COLUMN public.ml_shadow_predictions.accuracy_differential IS 
'ML accuracy minus heuristic accuracy for this prediction';

COMMENT ON COLUMN public.ml_shadow_predictions.deployment_stage IS 
'Canary deployment stage: stage1 (0% shadow), stage2 (5% canary), stage3 (100% production)';

COMMENT ON MATERIALIZED VIEW public.ml_performance_metrics IS 
'Hourly aggregated ML performance metrics for monitoring and alerting';

COMMENT ON FUNCTION log_shadow_prediction IS 
'Utility function to log shadow predictions with automatic discrepancy calculation';