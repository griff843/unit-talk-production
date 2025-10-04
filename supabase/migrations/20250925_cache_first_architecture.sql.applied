-- Cache-First Architecture Foundation
-- Adds comprehensive caching infrastructure for >90% hit rates and <100ms response times
-- Includes cache coordination, metrics, warming strategies, and invalidation rules

-- ============================================================================
-- CACHE COORDINATION TABLES
-- ============================================================================

-- Cache coordination and status tracking
CREATE TABLE IF NOT EXISTS public.cache_coordination (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key TEXT NOT NULL,
    cache_type TEXT NOT NULL CHECK (cache_type IN ('l1', 'l2', 'l3')),
    status TEXT NOT NULL CHECK (status IN ('valid', 'invalid', 'warming', 'error')),
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    last_refreshed TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    access_count INTEGER DEFAULT 0,
    size_bytes INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for cache coordination
CREATE INDEX IF NOT EXISTS idx_cache_coordination_key_type 
    ON public.cache_coordination (cache_key, cache_type);
CREATE INDEX IF NOT EXISTS idx_cache_coordination_status 
    ON public.cache_coordination (status);
CREATE INDEX IF NOT EXISTS idx_cache_coordination_expires 
    ON public.cache_coordination (expires_at) 
    WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cache_coordination_accessed 
    ON public.cache_coordination (last_accessed DESC);

-- Cache metrics aggregation table
CREATE TABLE IF NOT EXISTS public.cache_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type TEXT NOT NULL CHECK (metric_type IN ('hit_rate', 'response_time', 'invalidations', 'errors')),
    cache_layer TEXT NOT NULL CHECK (cache_layer IN ('l1', 'l2', 'l3', 'all')),
    time_bucket TIMESTAMPTZ NOT NULL, -- 5-minute buckets for aggregation
    value_count INTEGER DEFAULT 0,
    value_sum NUMERIC DEFAULT 0,
    value_avg NUMERIC DEFAULT 0,
    value_min NUMERIC DEFAULT 0,
    value_max NUMERIC DEFAULT 0,
    percentile_95 NUMERIC DEFAULT 0,
    percentile_99 NUMERIC DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint to prevent duplicate metric buckets
CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_metrics_unique 
    ON public.cache_metrics (metric_type, cache_layer, time_bucket);

-- Indexes for cache metrics queries
CREATE INDEX IF NOT EXISTS idx_cache_metrics_time 
    ON public.cache_metrics (time_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_cache_metrics_type_layer 
    ON public.cache_metrics (metric_type, cache_layer);

-- ============================================================================
-- CACHE WARMING STRATEGIES
-- ============================================================================

-- Cache warming strategy configurations
CREATE TABLE IF NOT EXISTS public.cache_warming_strategies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 10),
    frequency TEXT NOT NULL CHECK (frequency IN ('startup', 'hourly', 'daily', 'on-demand')),
    conditions JSONB DEFAULT '{}'::jsonb,
    target_patterns TEXT[] DEFAULT '{}',
    last_executed TIMESTAMPTZ,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    avg_execution_time_ms NUMERIC DEFAULT 0,
    items_warmed_total INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cache warming execution log
CREATE TABLE IF NOT EXISTS public.cache_warming_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id TEXT NOT NULL REFERENCES public.cache_warming_strategies(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    items_warmed INTEGER DEFAULT 0,
    execution_time_ms INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for warming log
CREATE INDEX IF NOT EXISTS idx_cache_warming_log_strategy 
    ON public.cache_warming_log (strategy_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_warming_log_status 
    ON public.cache_warming_log (status, started_at DESC);

-- ============================================================================
-- CACHE INVALIDATION RULES
-- ============================================================================

-- Cache invalidation rule definitions
CREATE TABLE IF NOT EXISTS public.cache_invalidation_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    triggers JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of trigger objects
    scope JSONB NOT NULL DEFAULT '{}'::jsonb, -- Scope configuration
    priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 10),
    delay_ms INTEGER DEFAULT 0,
    conditions JSONB DEFAULT '[]'::jsonb, -- Array of condition objects
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    avg_processing_time_ms NUMERIC DEFAULT 0,
    last_executed TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cache invalidation execution log
CREATE TABLE IF NOT EXISTS public.cache_invalidation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id TEXT NOT NULL REFERENCES public.cache_invalidation_rules(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL,
    trigger_data JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    processing_time_ms INTEGER DEFAULT 0,
    keys_invalidated INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for invalidation log
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_log_rule 
    ON public.cache_invalidation_log (rule_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_log_status 
    ON public.cache_invalidation_log (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_log_trigger 
    ON public.cache_invalidation_log (trigger_type, started_at DESC);

-- ============================================================================
-- PERFORMANCE MONITORING VIEWS
-- ============================================================================

-- Real-time cache performance view
CREATE OR REPLACE VIEW public.cache_performance_realtime AS
WITH recent_metrics AS (
    SELECT 
        cache_layer,
        metric_type,
        value_avg,
        percentile_95,
        percentile_99,
        time_bucket,
        ROW_NUMBER() OVER (PARTITION BY cache_layer, metric_type ORDER BY time_bucket DESC) AS rn
    FROM public.cache_metrics
    WHERE time_bucket >= NOW() - INTERVAL '1 hour'
),
latest_metrics AS (
    SELECT 
        cache_layer,
        metric_type,
        value_avg AS current_value,
        percentile_95,
        percentile_99
    FROM recent_metrics
    WHERE rn = 1
),
cache_status AS (
    SELECT 
        cache_type AS cache_layer,
        COUNT(*) AS total_keys,
        COUNT(*) FILTER (WHERE status = 'valid') AS valid_keys,
        COUNT(*) FILTER (WHERE status = 'invalid') AS invalid_keys,
        COUNT(*) FILTER (WHERE status = 'warming') AS warming_keys,
        COUNT(*) FILTER (WHERE status = 'error') AS error_keys,
        ROUND(AVG(access_count), 2) AS avg_access_count,
        SUM(size_bytes) AS total_size_bytes
    FROM public.cache_coordination
    WHERE updated_at >= NOW() - INTERVAL '5 minutes'
    GROUP BY cache_type
)
SELECT 
    cs.cache_layer,
    cs.total_keys,
    cs.valid_keys,
    cs.invalid_keys,
    cs.warming_keys,
    cs.error_keys,
    ROUND((cs.valid_keys::NUMERIC / NULLIF(cs.total_keys, 0)) * 100, 2) AS validity_percentage,
    cs.avg_access_count,
    cs.total_size_bytes,
    hr.current_value AS hit_rate,
    rt.current_value AS avg_response_time,
    rt.percentile_95 AS response_time_p95,
    rt.percentile_99 AS response_time_p99,
    inv.current_value AS invalidation_rate,
    err.current_value AS error_rate
FROM cache_status cs
LEFT JOIN latest_metrics hr ON cs.cache_layer = hr.cache_layer AND hr.metric_type = 'hit_rate'
LEFT JOIN latest_metrics rt ON cs.cache_layer = rt.cache_layer AND rt.metric_type = 'response_time'
LEFT JOIN latest_metrics inv ON cs.cache_layer = inv.cache_layer AND inv.metric_type = 'invalidations'
LEFT JOIN latest_metrics err ON cs.cache_layer = err.cache_layer AND err.metric_type = 'errors';

-- Cache warming strategy performance view
CREATE OR REPLACE VIEW public.cache_warming_performance AS
WITH strategy_stats AS (
    SELECT 
        s.id,
        s.name,
        s.enabled,
        s.priority,
        s.frequency,
        s.last_executed,
        s.success_count,
        s.failure_count,
        s.avg_execution_time_ms,
        s.items_warmed_total,
        COALESCE(s.success_count + s.failure_count, 0) AS total_executions,
        CASE 
            WHEN COALESCE(s.success_count + s.failure_count, 0) > 0 
            THEN ROUND((s.success_count::NUMERIC / (s.success_count + s.failure_count)) * 100, 2)
            ELSE NULL 
        END AS success_rate,
        COUNT(l.id) FILTER (WHERE l.started_at >= NOW() - INTERVAL '24 hours') AS executions_24h,
        COUNT(l.id) FILTER (WHERE l.started_at >= NOW() - INTERVAL '24 hours' AND l.status = 'completed') AS successes_24h,
        AVG(l.execution_time_ms) FILTER (WHERE l.started_at >= NOW() - INTERVAL '24 hours') AS avg_time_24h
    FROM public.cache_warming_strategies s
    LEFT JOIN public.cache_warming_log l ON s.id = l.strategy_id
    GROUP BY s.id, s.name, s.enabled, s.priority, s.frequency, s.last_executed, 
             s.success_count, s.failure_count, s.avg_execution_time_ms, s.items_warmed_total
)
SELECT 
    *,
    CASE 
        WHEN executions_24h > 0 
        THEN ROUND((successes_24h::NUMERIC / executions_24h) * 100, 2)
        ELSE NULL 
    END AS success_rate_24h
FROM strategy_stats;

-- Cache invalidation performance view
CREATE OR REPLACE VIEW public.cache_invalidation_performance AS
WITH rule_stats AS (
    SELECT 
        r.id,
        r.name,
        r.enabled,
        r.priority,
        r.execution_count,
        r.success_count,
        r.failure_count,
        r.avg_processing_time_ms,
        r.last_executed,
        CASE 
            WHEN r.execution_count > 0 
            THEN ROUND((r.success_count::NUMERIC / r.execution_count) * 100, 2)
            ELSE NULL 
        END AS success_rate,
        COUNT(l.id) FILTER (WHERE l.started_at >= NOW() - INTERVAL '24 hours') AS executions_24h,
        COUNT(l.id) FILTER (WHERE l.started_at >= NOW() - INTERVAL '24 hours' AND l.status = 'completed') AS successes_24h,
        AVG(l.processing_time_ms) FILTER (WHERE l.started_at >= NOW() - INTERVAL '24 hours') AS avg_time_24h,
        SUM(l.keys_invalidated) FILTER (WHERE l.started_at >= NOW() - INTERVAL '24 hours') AS keys_invalidated_24h
    FROM public.cache_invalidation_rules r
    LEFT JOIN public.cache_invalidation_log l ON r.id = l.rule_id
    GROUP BY r.id, r.name, r.enabled, r.priority, r.execution_count, 
             r.success_count, r.failure_count, r.avg_processing_time_ms, r.last_executed
)
SELECT 
    *,
    CASE 
        WHEN executions_24h > 0 
        THEN ROUND((successes_24h::NUMERIC / executions_24h) * 100, 2)
        ELSE NULL 
    END AS success_rate_24h
FROM rule_stats;

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to record cache metrics (called by application)
CREATE OR REPLACE FUNCTION public.record_cache_metric(
    p_metric_type TEXT,
    p_cache_layer TEXT,
    p_value NUMERIC,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
DECLARE
    v_time_bucket TIMESTAMPTZ;
BEGIN
    -- Round to 5-minute bucket
    v_time_bucket := date_trunc('hour', NOW()) + 
        (EXTRACT(MINUTE FROM NOW())::INT / 5) * INTERVAL '5 minutes';
    
    INSERT INTO public.cache_metrics (
        metric_type, 
        cache_layer, 
        time_bucket, 
        value_count, 
        value_sum,
        value_avg,
        value_min,
        value_max,
        metadata
    ) VALUES (
        p_metric_type,
        p_cache_layer,
        v_time_bucket,
        1,
        p_value,
        p_value,
        p_value,
        p_value,
        p_metadata
    )
    ON CONFLICT (metric_type, cache_layer, time_bucket) DO UPDATE SET
        value_count = public.cache_metrics.value_count + 1,
        value_sum = public.cache_metrics.value_sum + p_value,
        value_avg = (public.cache_metrics.value_sum + p_value) / (public.cache_metrics.value_count + 1),
        value_min = LEAST(public.cache_metrics.value_min, p_value),
        value_max = GREATEST(public.cache_metrics.value_max, p_value),
        metadata = public.cache_metrics.metadata || p_metadata;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update cache coordination status
CREATE OR REPLACE FUNCTION public.update_cache_coordination(
    p_cache_key TEXT,
    p_cache_type TEXT,
    p_status TEXT,
    p_size_bytes INTEGER DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.cache_coordination (
        cache_key,
        cache_type,
        status,
        last_accessed,
        last_refreshed,
        expires_at,
        access_count,
        size_bytes,
        metadata
    ) VALUES (
        p_cache_key,
        p_cache_type,
        p_status,
        NOW(),
        NOW(),
        p_expires_at,
        1,
        COALESCE(p_size_bytes, 0),
        p_metadata
    )
    ON CONFLICT (cache_key, cache_type) DO UPDATE SET
        status = p_status,
        last_accessed = NOW(),
        last_refreshed = CASE WHEN p_status = 'valid' THEN NOW() ELSE public.cache_coordination.last_refreshed END,
        expires_at = COALESCE(p_expires_at, public.cache_coordination.expires_at),
        access_count = public.cache_coordination.access_count + 1,
        size_bytes = COALESCE(p_size_bytes, public.cache_coordination.size_bytes),
        metadata = public.cache_coordination.metadata || p_metadata,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired cache coordination entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache_coordination() RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM public.cache_coordination 
    WHERE expires_at IS NOT NULL 
      AND expires_at < NOW() 
      AND status != 'warming';
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get cache health summary
CREATE OR REPLACE FUNCTION public.get_cache_health_summary() RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{}'::jsonb;
    v_l1_metrics JSONB;
    v_l2_metrics JSONB;
    v_l3_metrics JSONB;
    v_overall_hit_rate NUMERIC;
    v_avg_response_time NUMERIC;
BEGIN
    -- Get L1 cache metrics
    SELECT jsonb_build_object(
        'total_keys', COUNT(*),
        'valid_keys', COUNT(*) FILTER (WHERE status = 'valid'),
        'hit_rate', COALESCE(AVG(access_count), 0),
        'avg_size_bytes', COALESCE(AVG(size_bytes), 0)
    ) INTO v_l1_metrics
    FROM public.cache_coordination 
    WHERE cache_type = 'l1';
    
    -- Get L2 cache metrics
    SELECT jsonb_build_object(
        'total_keys', COUNT(*),
        'valid_keys', COUNT(*) FILTER (WHERE status = 'valid'),
        'hit_rate', COALESCE(AVG(access_count), 0),
        'avg_size_bytes', COALESCE(AVG(size_bytes), 0)
    ) INTO v_l2_metrics
    FROM public.cache_coordination 
    WHERE cache_type = 'l2';
    
    -- Get L3 cache metrics (database)
    SELECT jsonb_build_object(
        'total_keys', COUNT(*),
        'valid_keys', COUNT(*) FILTER (WHERE status = 'valid'),
        'hit_rate', COALESCE(AVG(access_count), 0),
        'avg_size_bytes', COALESCE(AVG(size_bytes), 0)
    ) INTO v_l3_metrics
    FROM public.cache_coordination 
    WHERE cache_type = 'l3';
    
    -- Get overall metrics
    SELECT 
        COALESCE(AVG(value_avg) FILTER (WHERE metric_type = 'hit_rate'), 0),
        COALESCE(AVG(value_avg) FILTER (WHERE metric_type = 'response_time'), 0)
    INTO v_overall_hit_rate, v_avg_response_time
    FROM public.cache_metrics 
    WHERE time_bucket >= NOW() - INTERVAL '1 hour';
    
    v_result := jsonb_build_object(
        'overall', jsonb_build_object(
            'hit_rate', v_overall_hit_rate,
            'avg_response_time_ms', v_avg_response_time,
            'status', CASE 
                WHEN v_overall_hit_rate >= 90 AND v_avg_response_time <= 100 THEN 'healthy'
                WHEN v_overall_hit_rate >= 70 AND v_avg_response_time <= 250 THEN 'degraded'
                ELSE 'unhealthy'
            END
        ),
        'l1', v_l1_metrics,
        'l2', v_l2_metrics,
        'l3', v_l3_metrics,
        'timestamp', NOW()
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DEFAULT DATA SEEDING
-- ============================================================================

-- Insert default cache warming strategies
INSERT INTO public.cache_warming_strategies (id, name, enabled, priority, frequency, conditions, target_patterns) VALUES
    ('published_picks', 'Published Picks', true, 10, 'hourly', '{"minimumAge": 30}'::jsonb, '{"unified_picks:published_picks:*"}'),
    ('todays_picks', 'Today''s Picks', true, 9, 'hourly', '{"timeOfDay": ["06:00", "12:00", "18:00", "21:00"], "minimumAge": 15}'::jsonb, '{"unified_picks:daily_picks:*"}'),
    ('top_capper_picks', 'Top Capper Picks', true, 8, 'daily', '{"timeOfDay": ["07:00", "19:00"], "minimumAge": 120}'::jsonb, '{"unified_picks:user_picks:*"}'),
    ('popular_picks', 'Popular Picks', true, 7, 'daily', '{"minimumAge": 180}'::jsonb, '{"unified_picks:picks_list:*"}'),
    ('user_favorites', 'User Favorites', true, 5, 'daily', '{"timeOfDay": ["08:00"], "minimumAge": 360}'::jsonb, '{"unified_picks:user_picks:*"}')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    enabled = EXCLUDED.enabled,
    priority = EXCLUDED.priority,
    frequency = EXCLUDED.frequency,
    conditions = EXCLUDED.conditions,
    target_patterns = EXCLUDED.target_patterns,
    updated_at = NOW();

-- Insert default cache invalidation rules
INSERT INTO public.cache_invalidation_rules (id, name, enabled, triggers, scope, priority, delay_ms, conditions) VALUES
    ('pick_updated', 'Pick Updated', true, 
     '[{"type": "database_change", "event": "unified_picks.updated", "table": "unified_picks", "operation": "UPDATE"}]'::jsonb,
     '{"type": "cascade", "target": "unified_picks:pick:{id}", "cascade": {"related": ["unified_picks:picks_list:*", "unified_picks:user_picks:{userId}", "unified_picks:published_picks:*", "unified_picks:daily_picks:*"], "maxDepth": 2}}'::jsonb,
     9, 0, '[]'::jsonb),
    ('pick_published', 'Pick Published', true,
     '[{"type": "database_change", "event": "unified_picks.published", "table": "unified_picks", "operation": "UPDATE", "columns": ["published"]}]'::jsonb,
     '{"type": "cascade", "target": "unified_picks:published_picks:*", "cascade": {"related": ["unified_picks:picks_list:*", "unified_picks:daily_picks:*", "unified_picks:user_picks:{userId}"], "maxDepth": 2}}'::jsonb,
     10, 0, '[{"field": "published", "operator": "equals", "value": true}]'::jsonb),
    ('user_updated', 'User Updated', true,
     '[{"type": "database_change", "event": "users.updated", "table": "users", "operation": "UPDATE"}]'::jsonb,
     '{"type": "pattern", "target": "unified_picks:user_picks:{id}:*"}'::jsonb,
     6, 0, '[]'::jsonb),
    ('daily_refresh', 'Daily Cache Refresh', true,
     '[{"type": "time_based", "event": "daily_refresh"}]'::jsonb,
     '{"type": "pattern", "target": "unified_picks:daily_picks:*"}'::jsonb,
     5, 0, '[]'::jsonb),
    ('odds_updated', 'Odds Updated', true,
     '[{"type": "external_event", "event": "odds.updated"}]'::jsonb,
     '{"type": "cascade", "target": "unified_picks:*", "cascade": {"related": ["cache:book_quotes:*", "cache:game_results:*"], "maxDepth": 1}}'::jsonb,
     8, 1000, '[]'::jsonb),
    ('pick_settled', 'Pick Settled', true,
     '[{"type": "database_change", "event": "unified_picks.settled", "table": "unified_picks", "operation": "UPDATE", "columns": ["status", "settled_at"]}]'::jsonb,
     '{"type": "cascade", "target": "unified_picks:pick:{id}", "cascade": {"related": ["unified_picks:user_picks:{userId}", "unified_picks:picks_list:*"], "maxDepth": 1}}'::jsonb,
     7, 0, '[{"field": "status", "operator": "in", "value": ["won", "lost", "push", "void"]}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    enabled = EXCLUDED.enabled,
    triggers = EXCLUDED.triggers,
    scope = EXCLUDED.scope,
    priority = EXCLUDED.priority,
    delay_ms = EXCLUDED.delay_ms,
    conditions = EXCLUDED.conditions,
    updated_at = NOW();

-- ============================================================================
-- CLEANUP AND MAINTENANCE
-- ============================================================================

-- Create cleanup job for old metrics (run daily)
CREATE OR REPLACE FUNCTION public.cleanup_old_cache_data() RETURNS INTEGER AS $$
DECLARE
    v_deleted_metrics INTEGER := 0;
    v_deleted_logs INTEGER := 0;
    v_deleted_coord INTEGER := 0;
BEGIN
    -- Clean up cache metrics older than 30 days
    DELETE FROM public.cache_metrics 
    WHERE time_bucket < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS v_deleted_metrics = ROW_COUNT;
    
    -- Clean up warming logs older than 7 days
    DELETE FROM public.cache_warming_log 
    WHERE started_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS v_deleted_logs = ROW_COUNT;
    
    -- Clean up invalidation logs older than 7 days
    DELETE FROM public.cache_invalidation_log 
    WHERE started_at < NOW() - INTERVAL '7 days';
    
    -- Clean up expired cache coordination
    v_deleted_coord := public.cleanup_expired_cache_coordination();
    
    RETURN v_deleted_metrics + v_deleted_logs + v_deleted_coord;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE public.cache_coordination IS 'Tracks cache key status across L1/L2/L3 layers for coordination';
COMMENT ON TABLE public.cache_metrics IS 'Aggregated cache performance metrics in 5-minute buckets';
COMMENT ON TABLE public.cache_warming_strategies IS 'Configuration for automatic cache warming strategies';
COMMENT ON TABLE public.cache_warming_log IS 'Execution log for cache warming operations';
COMMENT ON TABLE public.cache_invalidation_rules IS 'Rules for automated cache invalidation triggers';
COMMENT ON TABLE public.cache_invalidation_log IS 'Execution log for cache invalidation operations';

COMMENT ON VIEW public.cache_performance_realtime IS 'Real-time cache performance metrics across all layers';
COMMENT ON VIEW public.cache_warming_performance IS 'Performance statistics for cache warming strategies';
COMMENT ON VIEW public.cache_invalidation_performance IS 'Performance statistics for cache invalidation rules';

COMMENT ON FUNCTION public.record_cache_metric IS 'Records cache performance metrics for aggregation';
COMMENT ON FUNCTION public.update_cache_coordination IS 'Updates cache coordination status for a key';
COMMENT ON FUNCTION public.get_cache_health_summary IS 'Returns comprehensive cache health summary as JSON';
COMMENT ON FUNCTION public.cleanup_old_cache_data IS 'Cleans up old cache-related data (run daily)';