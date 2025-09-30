-- =============================================================================
-- HEALTH WORKFLOW INFRASTRUCTURE
-- System Health Monitoring with Operator Integration
-- Features: health snapshots, job tracking, incident detection
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- 1) Agent Job Runs Table - tracks all agent workflow executions
CREATE TABLE IF NOT EXISTS agent_job_runs (
  -- Primary identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL UNIQUE DEFAULT ('job_' || extract(epoch from now())::bigint || '_' || substr(gen_random_uuid()::text, 1, 8)),
  
  -- Job classification
  agent TEXT NOT NULL,                    -- Agent name (e.g., 'OperatorAgent', 'ScoringAgent')
  workflow TEXT NOT NULL,                 -- Workflow name (e.g., 'HealthWorkflow', 'ScoringWorkflow')
  job_name TEXT NOT NULL,                 -- Specific job name (e.g., 'system_health_check')
  
  -- Execution tracking
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'timeout', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Results and metadata
  metadata JSONB NOT NULL DEFAULT '{}',   -- Full execution metadata/results
  error_message TEXT,                     -- Error details if status = 'failed'
  retry_count INTEGER NOT NULL DEFAULT 0,
  
  -- Indexing helpers
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_job_runs_agent_workflow 
  ON agent_job_runs (agent, workflow, started_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_job_runs_status_time 
  ON agent_job_runs (status, started_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_job_runs_job_name 
  ON agent_job_runs (job_name, started_at DESC);

-- GIN index for metadata queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_job_runs_metadata_gin 
  ON agent_job_runs USING GIN (metadata);

-- 2) System Health Snapshot View - comprehensive health monitoring
CREATE OR REPLACE VIEW system_health_snapshot AS
SELECT 
  json_agg(
    json_build_object(
      'section', section_name,
      'status', health_status,
      'count_recent', count_recent,
      'count_total', count_total,
      'last_updated', last_updated,
      'details', section_details,
      'thresholds', thresholds,
      'alerts', alerts
    )
  ) as health_data
FROM (
  -- HOT_PROPS: Recent prop ingestion from prop_ticks_hot
  SELECT 
    'HOT_PROPS' as section_name,
    CASE 
      WHEN COUNT(*) FILTER (WHERE tick_timestamp > NOW() - INTERVAL '5 minutes') > 0 
      THEN 'healthy' 
      ELSE 'critical' 
    END as health_status,
    COUNT(*) FILTER (WHERE tick_timestamp > NOW() - INTERVAL '5 minutes') as count_recent,
    COUNT(*) as count_total,
    MAX(tick_timestamp) as last_updated,
    json_build_object(
      'recent_books', COUNT(DISTINCT book) FILTER (WHERE tick_timestamp > NOW() - INTERVAL '5 minutes'),
      'recent_sports', COUNT(DISTINCT sport) FILTER (WHERE tick_timestamp > NOW() - INTERVAL '5 minutes'),
      'avg_ticks_per_minute', COALESCE(COUNT(*) FILTER (WHERE tick_timestamp > NOW() - INTERVAL '5 minutes') / 5.0, 0)
    ) as section_details,
    json_build_object(
      'critical_threshold', 0,
      'warning_threshold', 10,
      'optimal_threshold', 100
    ) as thresholds,
    CASE 
      WHEN COUNT(*) FILTER (WHERE tick_timestamp > NOW() - INTERVAL '5 minutes') = 0 
      THEN json_build_array('IngestionHalted')
      ELSE json_build_array()
    END as alerts
  FROM prop_ticks_hot
  WHERE tick_timestamp > NOW() - INTERVAL '1 hour'

  UNION ALL

  -- WARM_FEATURES: Feature computation from features_daily_agg
  SELECT 
    'WARM_FEATURES' as section_name,
    CASE 
      WHEN COUNT(*) FILTER (WHERE computed_at > NOW() - INTERVAL '2 hours') > 0 
      THEN 'healthy' 
      ELSE 'degraded' 
    END as health_status,
    COUNT(*) FILTER (WHERE computed_at > NOW() - INTERVAL '2 hours') as count_recent,
    COUNT(*) as count_total,
    MAX(computed_at) as last_updated,
    json_build_object(
      'feature_types', COUNT(DISTINCT feature_type) FILTER (WHERE computed_at > NOW() - INTERVAL '2 hours'),
      'sports_covered', COUNT(DISTINCT sport) FILTER (WHERE computed_at > NOW() - INTERVAL '2 hours'),
      'avg_computation_time_ms', AVG(computation_time_ms) FILTER (WHERE computed_at > NOW() - INTERVAL '2 hours')
    ) as section_details,
    json_build_object(
      'critical_threshold', 0,
      'warning_threshold', 5,
      'optimal_threshold', 50
    ) as thresholds,
    CASE 
      WHEN COUNT(*) FILTER (WHERE computed_at > NOW() - INTERVAL '2 hours') = 0 
      THEN json_build_array('FeaturePipelineStalled')
      ELSE json_build_array()
    END as alerts
  FROM features_daily_agg
  WHERE computed_at > NOW() - INTERVAL '24 hours'

  UNION ALL

  -- AGENT_JOBS: Recent agent job runs
  SELECT 
    'AGENT_JOBS' as section_name,
    CASE 
      WHEN COUNT(*) FILTER (WHERE status = 'failed' AND started_at > NOW() - INTERVAL '15 minutes') > 0 
      THEN 'critical'
      WHEN COUNT(*) FILTER (WHERE status = 'success' AND started_at > NOW() - INTERVAL '15 minutes') > 0 
      THEN 'healthy'
      ELSE 'warning'
    END as health_status,
    COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '15 minutes') as count_recent,
    COUNT(*) as count_total,
    MAX(started_at) as last_updated,
    json_build_object(
      'success_rate', ROUND(
        COUNT(*) FILTER (WHERE status = 'success' AND started_at > NOW() - INTERVAL '1 hour') * 100.0 / 
        NULLIF(COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '1 hour'), 0), 2
      ),
      'failed_jobs', COUNT(*) FILTER (WHERE status = 'failed' AND started_at > NOW() - INTERVAL '15 minutes'),
      'running_jobs', COUNT(*) FILTER (WHERE status = 'running'),
      'agents_active', COUNT(DISTINCT agent) FILTER (WHERE started_at > NOW() - INTERVAL '1 hour')
    ) as section_details,
    json_build_object(
      'critical_failure_count', 1,
      'warning_success_rate', 90,
      'optimal_success_rate', 99
    ) as thresholds,
    CASE 
      WHEN COUNT(*) FILTER (WHERE status = 'failed' AND started_at > NOW() - INTERVAL '15 minutes') > 0 
      THEN json_build_array('AgentFailure')
      ELSE json_build_array()
    END as alerts
  FROM agent_job_runs
  WHERE started_at > NOW() - INTERVAL '24 hours'

  UNION ALL

  -- RECAP_RUNS: Daily recap generation status (from unified_picks perspective)
  SELECT 
    'RECAP_RUNS' as section_name,
    CASE 
      WHEN COUNT(*) FILTER (WHERE status = 'success' AND created_at::date = CURRENT_DATE) > 0 
      THEN 'healthy'
      WHEN CURRENT_TIME > TIME '12:00:00' AND COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE) = 0 
      THEN 'warning'
      ELSE 'degraded'
    END as health_status,
    COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE) as count_recent,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as count_total,
    MAX(created_at) as last_updated,
    json_build_object(
      'today_success', COUNT(*) FILTER (WHERE status = 'success' AND created_at::date = CURRENT_DATE),
      'today_total', COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE),
      'success_rate_7d', ROUND(
        COUNT(*) FILTER (WHERE status = 'success' AND created_at > NOW() - INTERVAL '7 days') * 100.0 / 
        NULLIF(COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'), 0), 2
      ),
      'avg_daily_picks', ROUND(COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') / 7.0, 1)
    ) as section_details,
    json_build_object(
      'daily_minimum', 1,
      'weekly_success_rate', 95,
      'optimal_daily_picks', 10
    ) as thresholds,
    CASE 
      WHEN COUNT(*) FILTER (WHERE status = 'failed' AND created_at::date = CURRENT_DATE) > 0 
      THEN json_build_array('RecapError')
      ELSE json_build_array()
    END as alerts
  FROM unified_picks
  WHERE created_at > NOW() - INTERVAL '7 days'

  UNION ALL

  -- ALERTS: Alert latency and processing (from system_incidents)
  SELECT 
    'ALERTS' as section_name,
    CASE 
      WHEN AVG(EXTRACT(epoch FROM (acknowledged_at - start_time)) * 1000) FILTER (WHERE start_time > NOW() - INTERVAL '1 hour') > 2000 
      THEN 'warning'
      WHEN COUNT(*) FILTER (WHERE status IN ('open', 'acknowledged') AND start_time > NOW() - INTERVAL '1 hour') > 5 
      THEN 'degraded'
      ELSE 'healthy'
    END as health_status,
    COUNT(*) FILTER (WHERE start_time > NOW() - INTERVAL '1 hour') as count_recent,
    COUNT(*) FILTER (WHERE start_time > NOW() - INTERVAL '24 hours') as count_total,
    MAX(start_time) as last_updated,
    json_build_object(
      'avg_response_time_ms', COALESCE(ROUND(AVG(EXTRACT(epoch FROM (acknowledged_at - start_time)) * 1000) FILTER (WHERE start_time > NOW() - INTERVAL '1 hour')), 0),
      'open_alerts', COUNT(*) FILTER (WHERE status IN ('open', 'acknowledged')),
      'critical_alerts', COUNT(*) FILTER (WHERE severity = 'critical' AND start_time > NOW() - INTERVAL '1 hour'),
      'resolution_rate', ROUND(
        COUNT(*) FILTER (WHERE status = 'resolved' AND start_time > NOW() - INTERVAL '24 hours') * 100.0 / 
        NULLIF(COUNT(*) FILTER (WHERE start_time > NOW() - INTERVAL '24 hours'), 0), 2
      )
    ) as section_details,
    json_build_object(
      'max_response_time_ms', 2000,
      'max_open_alerts', 5,
      'min_resolution_rate', 90
    ) as thresholds,
    CASE 
      WHEN AVG(EXTRACT(epoch FROM (acknowledged_at - start_time)) * 1000) FILTER (WHERE start_time > NOW() - INTERVAL '1 hour') > 2000 
      THEN json_build_array('AlertLatency')
      ELSE json_build_array()
    END as alerts
  FROM system_incidents
  WHERE start_time > NOW() - INTERVAL '24 hours'

  UNION ALL

  -- SYSTEM_PERFORMANCE: Overall system performance metrics
  SELECT 
    'SYSTEM_PERFORMANCE' as section_name,
    'healthy' as health_status, -- Placeholder - would be calculated from actual metrics
    COUNT(*) as count_recent,
    COUNT(*) as count_total,
    NOW() as last_updated,
    json_build_object(
      'cpu_usage_percent', 0,
      'memory_usage_percent', 0,
      'disk_usage_percent', 0,
      'active_connections', 0
    ) as section_details,
    json_build_object(
      'cpu_warning_threshold', 80,
      'memory_warning_threshold', 85,
      'disk_warning_threshold', 90
    ) as thresholds,
    json_build_array() as alerts
  FROM (SELECT 1) as dummy_table -- Placeholder for actual system metrics

  UNION ALL

  -- DATABASE_HEALTH: Database connection and query performance
  SELECT 
    'DATABASE_HEALTH' as section_name,
    CASE 
      WHEN pg_database_size(current_database()) > 1000000000 -- 1GB
      THEN 'warning'
      ELSE 'healthy'
    END as health_status,
    (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as count_recent,
    (SELECT COUNT(*) FROM pg_stat_activity) as count_total,
    NOW() as last_updated,
    json_build_object(
      'database_size_mb', ROUND(pg_database_size(current_database()) / 1024.0 / 1024.0, 2),
      'active_connections', (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active'),
      'total_connections', (SELECT COUNT(*) FROM pg_stat_activity),
      'slow_queries', 0  -- Would be calculated from pg_stat_statements
    ) as section_details,
    json_build_object(
      'max_database_size_gb', 5,
      'max_active_connections', 20,
      'max_slow_queries', 5
    ) as thresholds,
    json_build_array() as alerts
  FROM (SELECT 1) as dummy_table

  UNION ALL

  -- API_ENDPOINTS: API health and response times
  SELECT 
    'API_ENDPOINTS' as section_name,
    'healthy' as health_status, -- Would be calculated from actual API metrics
    0 as count_recent,
    0 as count_total,
    NOW() as last_updated,
    json_build_object(
      'avg_response_time_ms', 0,
      'error_rate_percent', 0,
      'requests_per_minute', 0,
      'active_endpoints', 0
    ) as section_details,
    json_build_object(
      'max_response_time_ms', 1000,
      'max_error_rate_percent', 5,
      'min_requests_per_minute', 1
    ) as thresholds,
    json_build_array() as alerts
  FROM (SELECT 1) as dummy_table
) health_sections;

-- 3) Helper functions for health workflow operations

-- Function to create standardized incident records
CREATE OR REPLACE FUNCTION create_health_incident(
  p_kind TEXT,
  p_severity TEXT DEFAULT 'medium',
  p_details JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_incident_id TEXT;
  v_uuid UUID;
  v_existing_count INTEGER;
BEGIN
  -- Check for duplicate incidents in the last hour (idempotent inserts)
  SELECT COUNT(*) INTO v_existing_count
  FROM system_incidents 
  WHERE incident_type = p_kind
    AND status IN ('open', 'acknowledged', 'investigating')
    AND start_time > NOW() - INTERVAL '1 hour';
  
  -- Only create new incident if no recent duplicate exists
  IF v_existing_count = 0 THEN
    -- Generate incident ID
    v_incident_id := 'INC-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
                     LPAD((EXTRACT(DOY FROM NOW())::INTEGER * 100 + EXTRACT(HOUR FROM NOW()))::TEXT, 4, '0');
    
    INSERT INTO system_incidents (
      incident_id,
      incident_type,
      title,
      description,
      severity,
      status,
      affected_services,
      metadata,
      reporter_id,
      start_time
    ) VALUES (
      v_incident_id,
      p_kind,
      'Health Workflow Alert: ' || p_kind,
      'Automated incident created by HealthWorkflow for: ' || p_kind,
      p_severity,
      'open',
      CASE 
        WHEN p_kind LIKE '%Agent%' THEN ARRAY['agents']
        WHEN p_kind LIKE '%Ingestion%' THEN ARRAY['data-ingestion']
        WHEN p_kind LIKE '%Feature%' THEN ARRAY['feature-pipeline']
        WHEN p_kind LIKE '%Alert%' THEN ARRAY['alerting']
        ELSE ARRAY['general']
      END,
      p_details,
      'system', -- System-generated incident
      NOW()
    ) RETURNING id INTO v_uuid;
    
    RETURN v_uuid;
  ELSE
    RETURN NULL; -- No new incident created (duplicate prevention)
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update job run completion
CREATE OR REPLACE FUNCTION complete_job_run(
  p_job_id TEXT,
  p_status TEXT,
  p_metadata JSONB DEFAULT '{}',
  p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE agent_job_runs 
  SET 
    status = p_status,
    completed_at = NOW(),
    duration_ms = EXTRACT(epoch FROM (NOW() - started_at)) * 1000,
    metadata = metadata || p_metadata,
    error_message = p_error_message,
    updated_at = NOW()
  WHERE job_id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- 4) Triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_job_runs_updated_at ON agent_job_runs;
CREATE TRIGGER trg_agent_job_runs_updated_at
    BEFORE UPDATE ON agent_job_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5) Sample test data insertion for development
DO $$
BEGIN
  -- Insert sample agent job runs for testing
  IF NOT EXISTS (SELECT 1 FROM agent_job_runs LIMIT 1) THEN
    INSERT INTO agent_job_runs (agent, workflow, job_name, status, metadata) VALUES
    ('OperatorAgent', 'HealthWorkflow', 'system_health_check', 'success', 
     '{"sections_checked": 8, "incidents_created": 0, "execution_time_ms": 1250}'),
    ('ScoringAgent', 'ScoringWorkflow', 'prop_scoring', 'success', 
     '{"props_scored": 450, "grade_distribution": {"S": 12, "A": 35, "B": 120}, "duration_ms": 2100}'),
    ('FeatureBuilderAgent', 'FeatureBuilderWorkflow', 'feature_computation', 'success', 
     '{"features_computed": 1200, "computation_time_ms": 3400}');
  END IF;
END $$;

-- 6) Permissions for API access
GRANT SELECT, INSERT, UPDATE ON agent_job_runs TO api_service;
GRANT SELECT ON system_health_snapshot TO api_service;
GRANT EXECUTE ON FUNCTION create_health_incident(TEXT, TEXT, JSONB) TO api_service;
GRANT EXECUTE ON FUNCTION complete_job_run(TEXT, TEXT, JSONB, TEXT) TO api_service;

-- 7) Comments for documentation
COMMENT ON TABLE agent_job_runs IS 'Tracks execution of all agent workflows with metadata and status';
COMMENT ON VIEW system_health_snapshot IS 'Comprehensive real-time system health monitoring view with 8 key sections';
COMMENT ON FUNCTION create_health_incident IS 'Creates idempotent incident records with duplicate prevention';
COMMENT ON FUNCTION complete_job_run IS 'Updates job run status and calculates execution metrics';

-- Success confirmation
\echo '✅ Health Workflow Infrastructure Created Successfully'
\echo '   • agent_job_runs table with comprehensive job tracking'
\echo '   • system_health_snapshot view with 8 health sections'
\echo '   • Helper functions for incident creation and job completion'
\echo '   • Indexes and triggers for optimal performance'