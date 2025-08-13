-- Migration Tracking: Create tables for zero-downtime migration management
-- Migration: 20250812_migration_tracking_tables.sql

-- =============================================================================
-- CREATE MIGRATION LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Migration identification
  migration_id VARCHAR(255) NOT NULL UNIQUE,
  migration_file VARCHAR(500) NOT NULL,
  strategy VARCHAR(50) NOT NULL CHECK (strategy IN ('blue-green', 'rolling', 'shadow')),
  
  -- Execution details
  success BOOLEAN NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  duration_ms INTEGER DEFAULT NULL,
  
  -- Migration metadata
  affected_tables TEXT[] DEFAULT '{}',
  statement_count INTEGER DEFAULT 0,
  estimated_duration_ms INTEGER DEFAULT 0,
  risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  
  -- Rollback information
  rollback_info JSONB DEFAULT NULL,
  rollback_executed BOOLEAN DEFAULT FALSE,
  rollback_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  -- Error tracking
  error_message TEXT DEFAULT NULL,
  error_details JSONB DEFAULT NULL,
  
  -- Execution context
  executed_by VARCHAR(255) DEFAULT NULL,
  environment VARCHAR(50) DEFAULT 'staging',
  git_commit VARCHAR(40) DEFAULT NULL,
  
  -- Additional metadata
  migration_metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- CREATE SCHEMA SNAPSHOTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS migration_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Snapshot identification
  snapshot_id VARCHAR(255) NOT NULL UNIQUE,
  migration_id VARCHAR(255) REFERENCES migration_log(migration_id),
  
  -- Snapshot timing
  snapshot_type VARCHAR(50) NOT NULL CHECK (snapshot_type IN ('pre_migration', 'post_migration', 'rollback_point')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Schema data
  schema_data JSONB NOT NULL,
  schema_checksum VARCHAR(64) NOT NULL,
  
  -- Metadata
  table_count INTEGER DEFAULT 0,
  index_count INTEGER DEFAULT 0,
  function_count INTEGER DEFAULT 0,
  size_bytes BIGINT DEFAULT 0,
  
  -- Backup information (if applicable)
  backup_location VARCHAR(500) DEFAULT NULL,
  backup_type VARCHAR(50) DEFAULT NULL,
  backup_size_bytes BIGINT DEFAULT NULL,
  
  -- Retention
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  archived BOOLEAN DEFAULT FALSE
);

-- =============================================================================
-- CREATE MIGRATION DRIFT DETECTION TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_drift_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Drift detection
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  environment VARCHAR(50) NOT NULL,
  
  -- Schema comparison
  expected_checksum VARCHAR(64) NOT NULL,
  actual_checksum VARCHAR(64) NOT NULL,
  drift_detected BOOLEAN GENERATED ALWAYS AS (expected_checksum != actual_checksum) STORED,
  
  -- Drift details
  schema_differences JSONB DEFAULT NULL,
  affected_tables TEXT[] DEFAULT '{}',
  severity VARCHAR(20) DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Context
  git_commit VARCHAR(40) DEFAULT NULL,
  detected_by VARCHAR(255) DEFAULT NULL,
  
  -- Resolution tracking
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  acknowledged_by VARCHAR(255) DEFAULT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  resolution_notes TEXT DEFAULT NULL
);

-- =============================================================================
-- CREATE MIGRATION HEALTH MONITORING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS migration_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Health check identification
  migration_id VARCHAR(255) REFERENCES migration_log(migration_id),
  check_type VARCHAR(50) NOT NULL CHECK (check_type IN ('pre_migration', 'during_migration', 'post_migration')),
  check_name VARCHAR(100) NOT NULL,
  
  -- Check execution
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  duration_ms INTEGER NOT NULL,
  
  -- Check results
  result_data JSONB DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  
  -- Health metrics
  cpu_usage_percent DECIMAL(5,2) DEFAULT NULL,
  memory_usage_percent DECIMAL(5,2) DEFAULT NULL,
  disk_usage_percent DECIMAL(5,2) DEFAULT NULL,
  active_connections INTEGER DEFAULT NULL,
  query_performance_ms DECIMAL(8,2) DEFAULT NULL,
  error_rate_percent DECIMAL(5,2) DEFAULT NULL,
  
  -- Thresholds and alerts
  threshold_exceeded BOOLEAN DEFAULT FALSE,
  alert_triggered BOOLEAN DEFAULT FALSE,
  alert_severity VARCHAR(20) DEFAULT NULL
);

-- =============================================================================
-- CREATE MIGRATION PERFORMANCE METRICS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS migration_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Metric identification
  migration_id VARCHAR(255) REFERENCES migration_log(migration_id),
  metric_name VARCHAR(100) NOT NULL,
  metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('counter', 'gauge', 'histogram')),
  
  -- Metric values
  value DECIMAL(20,6) NOT NULL,
  unit VARCHAR(20) DEFAULT NULL,
  
  -- Context
  table_name VARCHAR(255) DEFAULT NULL,
  operation_type VARCHAR(100) DEFAULT NULL,
  statement_index INTEGER DEFAULT NULL,
  
  -- Timing
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Labels for filtering
  labels JSONB DEFAULT '{}'
);

-- =============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- Migration log indexes
CREATE INDEX idx_migration_log_id ON migration_log(migration_id);
CREATE INDEX idx_migration_log_strategy_env ON migration_log(strategy, environment);
CREATE INDEX idx_migration_log_completed ON migration_log(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX idx_migration_log_success ON migration_log(success, created_at);

-- Snapshot indexes
CREATE INDEX idx_snapshots_migration_id ON migration_snapshots(migration_id);
CREATE INDEX idx_snapshots_type ON migration_snapshots(snapshot_type, created_at);
CREATE INDEX idx_snapshots_checksum ON migration_snapshots(schema_checksum);

-- Drift detection indexes
CREATE INDEX idx_drift_environment_detected ON schema_drift_log(environment, detected_at);
CREATE INDEX idx_drift_severity ON schema_drift_log(severity, detected_at) WHERE drift_detected = TRUE;
CREATE INDEX idx_drift_unresolved ON schema_drift_log(resolved, acknowledged, detected_at) WHERE resolved = FALSE;

-- Health check indexes
CREATE INDEX idx_health_migration_type ON migration_health_checks(migration_id, check_type);
CREATE INDEX idx_health_success ON migration_health_checks(success, executed_at);

-- Performance metrics indexes
CREATE INDEX idx_metrics_migration_name ON migration_performance_metrics(migration_id, metric_name);
CREATE INDEX idx_metrics_recorded ON migration_performance_metrics(recorded_at);

-- =============================================================================
-- CREATE MIGRATION MANAGEMENT FUNCTIONS
-- =============================================================================

-- Function to create schema snapshot
CREATE OR REPLACE FUNCTION create_schema_snapshot(
  p_migration_id VARCHAR(255),
  p_snapshot_type VARCHAR(50)
) RETURNS VARCHAR(255)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_snapshot_id VARCHAR(255);
  v_schema_data JSONB;
  v_checksum VARCHAR(64);
  v_table_count INTEGER;
  v_index_count INTEGER;
BEGIN
  -- Generate snapshot ID
  v_snapshot_id := 'snapshot-' || p_migration_id || '-' || EXTRACT(EPOCH FROM NOW())::bigint;
  
  -- Collect schema information
  WITH schema_info AS (
    SELECT jsonb_build_object(
      'tables', (
        SELECT jsonb_object_agg(table_name, table_data)
        FROM (
          SELECT 
            t.table_name,
            jsonb_build_object(
              'columns', (
                SELECT jsonb_object_agg(column_name, column_info)
                FROM (
                  SELECT 
                    column_name,
                    jsonb_build_object(
                      'data_type', data_type,
                      'is_nullable', is_nullable,
                      'column_default', column_default
                    ) as column_info
                  FROM information_schema.columns c
                  WHERE c.table_name = t.table_name AND c.table_schema = 'public'
                ) col_data
              ),
              'constraints', (
                SELECT jsonb_agg(constraint_name)
                FROM information_schema.table_constraints tc
                WHERE tc.table_name = t.table_name AND tc.table_schema = 'public'
              )
            ) as table_data
          FROM information_schema.tables t
          WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        ) table_data
      ),
      'indexes', (
        SELECT jsonb_object_agg(indexname, indexdef)
        FROM pg_indexes
        WHERE schemaname = 'public'
      ),
      'functions', (
        SELECT jsonb_object_agg(routine_name, routine_definition)
        FROM information_schema.routines
        WHERE routine_schema = 'public'
      )
    ) as schema_data
  )
  SELECT schema_data INTO v_schema_data FROM schema_info;
  
  -- Calculate checksum
  v_checksum := encode(digest(v_schema_data::text, 'sha256'), 'hex');
  
  -- Count objects
  SELECT 
    (v_schema_data->'tables')::jsonb ? 'COUNT(*)'::text,
    (v_schema_data->'indexes')::jsonb ? 'COUNT(*)'::text
  INTO v_table_count, v_index_count;
  
  -- Insert snapshot
  INSERT INTO migration_snapshots (
    snapshot_id,
    migration_id,
    snapshot_type,
    schema_data,
    schema_checksum,
    table_count,
    index_count
  ) VALUES (
    v_snapshot_id,
    p_migration_id,
    p_snapshot_type,
    v_schema_data,
    v_checksum,
    COALESCE(v_table_count, 0),
    COALESCE(v_index_count, 0)
  );
  
  RETURN v_snapshot_id;
END;
$$;

-- Function to detect schema drift
CREATE OR REPLACE FUNCTION detect_schema_drift(
  p_environment VARCHAR(50),
  p_expected_checksum VARCHAR(64)
) RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_checksum VARCHAR(64);
  v_drift_detected BOOLEAN;
  v_schema_data JSONB;
BEGIN
  -- Get current schema checksum
  SELECT create_schema_snapshot('drift-check-' || EXTRACT(EPOCH FROM NOW())::bigint, 'drift_check')
  INTO v_current_checksum;
  
  -- Compare checksums
  v_drift_detected := (p_expected_checksum != v_current_checksum);
  
  -- Log drift detection result
  INSERT INTO schema_drift_log (
    environment,
    expected_checksum,
    actual_checksum,
    detected_by,
    git_commit
  ) VALUES (
    p_environment,
    p_expected_checksum,
    v_current_checksum,
    current_setting('application_name', true),
    current_setting('app.git_commit', true)
  );
  
  RETURN v_drift_detected;
END;
$$;

-- Function to log migration health check
CREATE OR REPLACE FUNCTION log_migration_health_check(
  p_migration_id VARCHAR(255),
  p_check_type VARCHAR(50),
  p_check_name VARCHAR(100),
  p_success BOOLEAN,
  p_duration_ms INTEGER,
  p_result_data JSONB DEFAULT NULL
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_check_id UUID;
BEGIN
  INSERT INTO migration_health_checks (
    migration_id,
    check_type,
    check_name,
    success,
    duration_ms,
    result_data
  ) VALUES (
    p_migration_id,
    p_check_type,
    p_check_name,
    p_success,
    p_duration_ms,
    p_result_data
  ) RETURNING id INTO v_check_id;
  
  RETURN v_check_id;
END;
$$;

-- Function to record migration performance metric
CREATE OR REPLACE FUNCTION record_migration_metric(
  p_migration_id VARCHAR(255),
  p_metric_name VARCHAR(100),
  p_metric_type VARCHAR(50),
  p_value DECIMAL(20,6),
  p_labels JSONB DEFAULT NULL
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_metric_id UUID;
BEGIN
  INSERT INTO migration_performance_metrics (
    migration_id,
    metric_name,
    metric_type,
    value,
    labels
  ) VALUES (
    p_migration_id,
    p_metric_name,
    p_metric_type,
    p_value,
    p_labels
  ) RETURNING id INTO v_metric_id;
  
  RETURN v_metric_id;
END;
$$;

-- =============================================================================
-- CREATE MIGRATION MONITORING VIEWS
-- =============================================================================

-- Migration status view
CREATE OR REPLACE VIEW migration_status AS
SELECT 
  migration_id,
  migration_file,
  strategy,
  environment,
  success,
  EXTRACT(EPOCH FROM (completed_at - started_at))::integer as duration_seconds,
  affected_tables,
  risk_level,
  rollback_executed,
  error_message,
  started_at,
  completed_at
FROM migration_log
ORDER BY started_at DESC;

-- Recent drift detections view
CREATE OR REPLACE VIEW recent_drift_detections AS
SELECT 
  environment,
  detected_at,
  drift_detected,
  severity,
  affected_tables,
  acknowledged,
  resolved,
  resolution_notes
FROM schema_drift_log
WHERE detected_at > NOW() - INTERVAL '7 days'
ORDER BY detected_at DESC;

-- Migration health summary view
CREATE OR REPLACE VIEW migration_health_summary AS
SELECT 
  migration_id,
  check_type,
  COUNT(*) as total_checks,
  COUNT(*) FILTER (WHERE success = TRUE) as successful_checks,
  COUNT(*) FILTER (WHERE success = FALSE) as failed_checks,
  AVG(duration_ms) as avg_duration_ms,
  MAX(executed_at) as last_check_at
FROM migration_health_checks
GROUP BY migration_id, check_type
ORDER BY last_check_at DESC;

-- =============================================================================
-- ENABLE RLS
-- =============================================================================

ALTER TABLE migration_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_drift_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "migration_service_role" ON migration_log
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "snapshots_service_role" ON migration_snapshots
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "drift_service_role" ON schema_drift_log
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "health_service_role" ON migration_health_checks
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "metrics_service_role" ON migration_performance_metrics
  FOR ALL USING (current_setting('role') = 'service_role');

-- Authenticated users can read migration data
CREATE POLICY "migration_read" ON migration_log
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "drift_read" ON schema_drift_log
  FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION create_schema_snapshot TO service_role;
GRANT EXECUTE ON FUNCTION detect_schema_drift TO service_role;
GRANT EXECUTE ON FUNCTION log_migration_health_check TO service_role;
GRANT EXECUTE ON FUNCTION record_migration_metric TO service_role;

GRANT SELECT ON migration_status TO anon, authenticated, service_role;
GRANT SELECT ON recent_drift_detections TO anon, authenticated, service_role;
GRANT SELECT ON migration_health_summary TO anon, authenticated, service_role;

-- =============================================================================
-- CREATE TEST DATA AND VERIFICATION
-- =============================================================================

DO $$
DECLARE
  v_migration_id VARCHAR(255);
  v_snapshot_id VARCHAR(255);
  v_check_id UUID;
  v_drift_detected BOOLEAN;
BEGIN
  -- Test migration log
  v_migration_id := 'test-migration-' || EXTRACT(EPOCH FROM NOW())::bigint;
  
  INSERT INTO migration_log (
    migration_id,
    migration_file,
    strategy,
    success,
    completed_at,
    duration_ms,
    affected_tables,
    environment
  ) VALUES (
    v_migration_id,
    'test-migration.sql',
    'blue-green',
    TRUE,
    NOW(),
    5000,
    ARRAY['test_table'],
    'staging'
  );
  
  -- Test snapshot creation
  SELECT create_schema_snapshot(v_migration_id, 'pre_migration') INTO v_snapshot_id;
  
  -- Test health check logging
  SELECT log_migration_health_check(
    v_migration_id,
    'post_migration',
    'database_connectivity',
    TRUE,
    1500,
    '{"connections": 25, "response_time_ms": 150}'::jsonb
  ) INTO v_check_id;
  
  -- Test metric recording
  PERFORM record_migration_metric(
    v_migration_id,
    'table_scan_duration',
    'histogram',
    2500.50,
    '{"table": "test_table", "operation": "full_scan"}'::jsonb
  );
  
  -- Test views
  PERFORM * FROM migration_status LIMIT 1;
  PERFORM * FROM migration_health_summary LIMIT 1;
  
  -- Cleanup test data
  DELETE FROM migration_performance_metrics WHERE migration_id = v_migration_id;
  DELETE FROM migration_health_checks WHERE migration_id = v_migration_id;
  DELETE FROM migration_snapshots WHERE migration_id = v_migration_id;
  DELETE FROM migration_log WHERE migration_id = v_migration_id;
  
  RAISE NOTICE 'Migration tracking system verification successful';
END;
$$;

-- Migration completed
INSERT INTO audit_log (table_name, operation, details)
VALUES ('migration', 'COMPLETE', jsonb_build_object(
  'migration', '20250812_migration_tracking_tables',
  'timestamp', NOW(),
  'description', 'Zero-downtime migration tracking system with drift detection and health monitoring'
));