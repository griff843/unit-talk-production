-- Performance Budgets: Create comprehensive performance monitoring and SLA enforcement
-- Migration: 20250812_performance_budgets.sql

-- =============================================================================
-- CREATE PERFORMANCE METRICS TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS performance_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Test identification
  test_name VARCHAR(100) NOT NULL,
  test_type VARCHAR(50) NOT NULL CHECK (test_type IN ('load', 'stress', 'spike', 'volume', 'endurance', 'smoke')),
  test_suite VARCHAR(100) NOT NULL,
  
  -- Test configuration
  target_endpoint VARCHAR(500) NOT NULL,
  virtual_users INTEGER NOT NULL DEFAULT 10,
  duration_seconds INTEGER NOT NULL DEFAULT 60,
  ramp_up_seconds INTEGER DEFAULT 30,
  test_data JSONB DEFAULT '{}',
  
  -- SLA thresholds
  max_response_time_ms INTEGER NOT NULL DEFAULT 5000,
  max_error_rate_percent DECIMAL(5,2) NOT NULL DEFAULT 5.0,
  min_throughput_rps DECIMAL(10,2) NOT NULL DEFAULT 1.0,
  max_cpu_percent DECIMAL(5,2) DEFAULT 80.0,
  max_memory_mb INTEGER DEFAULT 2048,
  
  -- Execution tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  duration_ms INTEGER DEFAULT NULL,
  
  -- Results summary
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  avg_response_time_ms DECIMAL(10,2) DEFAULT 0,
  p95_response_time_ms DECIMAL(10,2) DEFAULT 0,
  p99_response_time_ms DECIMAL(10,2) DEFAULT 0,
  max_response_time_ms_actual DECIMAL(10,2) DEFAULT 0,
  requests_per_second DECIMAL(10,2) DEFAULT 0,
  error_rate_percent DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN total_requests = 0 THEN 0
      ELSE (failed_requests::DECIMAL / total_requests::DECIMAL) * 100
    END
  ) STORED,
  
  -- SLA compliance
  sla_passed BOOLEAN DEFAULT NULL,
  sla_violations JSONB DEFAULT '[]',
  
  -- Environment and metadata
  environment VARCHAR(50) NOT NULL DEFAULT 'test',
  git_commit_hash VARCHAR(40) DEFAULT NULL,
  build_number VARCHAR(100) DEFAULT NULL,
  test_runner VARCHAR(100) DEFAULT 'unknown',
  tags JSONB DEFAULT '[]',
  
  -- Performance budget enforcement
  budget_category VARCHAR(50) DEFAULT 'standard' CHECK (budget_category IN ('critical', 'high', 'standard', 'background')),
  budget_limits JSONB DEFAULT '{}',
  budget_passed BOOLEAN DEFAULT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- CREATE PERFORMANCE METRICS DETAILS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Test reference
  test_id UUID REFERENCES performance_tests(id) ON DELETE CASCADE,
  
  -- Metric identification
  metric_name VARCHAR(100) NOT NULL,
  metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('counter', 'gauge', 'histogram', 'summary', 'rate')),
  metric_category VARCHAR(50) DEFAULT 'performance' CHECK (metric_category IN ('performance', 'resource', 'business', 'error', 'custom')),
  
  -- Metric values
  value DECIMAL(15,4) NOT NULL,
  unit VARCHAR(20) DEFAULT '',
  tags JSONB DEFAULT '{}',
  
  -- Timing
  timestamp_ms BIGINT NOT NULL, -- Unix timestamp in milliseconds
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Context
  virtual_user_id INTEGER DEFAULT NULL,
  iteration_id INTEGER DEFAULT NULL,
  checkpoint_name VARCHAR(100) DEFAULT NULL,
  
  -- Partitioning helper
  partition_key DATE GENERATED ALWAYS AS (DATE(recorded_at)) STORED
);

-- =============================================================================
-- CREATE SLA BUDGETS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS sla_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Budget identification
  service_name VARCHAR(100) NOT NULL,
  endpoint_pattern VARCHAR(500) NOT NULL,
  environment VARCHAR(50) NOT NULL,
  
  -- SLA thresholds
  availability_percent DECIMAL(5,2) NOT NULL DEFAULT 99.9,
  max_response_time_p95_ms INTEGER NOT NULL DEFAULT 1000,
  max_response_time_p99_ms INTEGER NOT NULL DEFAULT 5000,
  max_error_rate_percent DECIMAL(5,2) NOT NULL DEFAULT 1.0,
  min_throughput_rps DECIMAL(10,2) NOT NULL DEFAULT 10.0,
  
  -- Resource limits
  max_cpu_percent DECIMAL(5,2) DEFAULT 70.0,
  max_memory_mb INTEGER DEFAULT 1024,
  max_disk_io_mbps DECIMAL(10,2) DEFAULT 100.0,
  max_network_mbps DECIMAL(10,2) DEFAULT 100.0,
  
  -- Error budgets (monthly)
  error_budget_percent DECIMAL(8,5) NOT NULL DEFAULT 0.1, -- 0.1% = 43.8 minutes downtime per month
  error_budget_consumed_percent DECIMAL(8,5) DEFAULT 0,
  error_budget_remaining_percent DECIMAL(8,5) GENERATED ALWAYS AS (
    GREATEST(0, error_budget_percent - error_budget_consumed_percent)
  ) STORED,
  
  -- Burn rate thresholds
  fast_burn_rate_threshold DECIMAL(10,2) DEFAULT 14.4, -- Consume budget in 2 hours
  slow_burn_rate_threshold DECIMAL(10,2) DEFAULT 1.0,  -- Consume budget in 30 days
  
  -- Budget reset
  budget_period_start TIMESTAMP WITH TIME ZONE DEFAULT DATE_TRUNC('month', NOW()),
  budget_period_end TIMESTAMP WITH TIME ZONE DEFAULT (DATE_TRUNC('month', NOW()) + INTERVAL '1 month'),
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  escalation_policy VARCHAR(100) DEFAULT 'default',
  notification_channels JSONB DEFAULT '["alerts"]',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(service_name, endpoint_pattern, environment)
);

-- =============================================================================
-- CREATE PERFORMANCE ALERTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS performance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Alert identification
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('sla_violation', 'budget_exceeded', 'burn_rate', 'regression', 'anomaly')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  
  -- Alert details
  service_name VARCHAR(100) NOT NULL,
  endpoint VARCHAR(500) DEFAULT NULL,
  metric_name VARCHAR(100) NOT NULL,
  
  -- Values
  threshold_value DECIMAL(15,4) NOT NULL,
  actual_value DECIMAL(15,4) NOT NULL,
  deviation_percent DECIMAL(8,2) GENERATED ALWAYS AS (
    CASE 
      WHEN threshold_value = 0 THEN 0
      ELSE ((actual_value - threshold_value) / threshold_value) * 100
    END
  ) STORED,
  
  -- Context
  test_id UUID REFERENCES performance_tests(id) ON DELETE SET NULL,
  budget_id UUID REFERENCES sla_budgets(id) ON DELETE CASCADE,
  environment VARCHAR(50) NOT NULL,
  
  -- Alert lifecycle
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'investigating', 'resolved', 'false_positive')),
  acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  acknowledged_by VARCHAR(255) DEFAULT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  resolution_notes TEXT DEFAULT NULL,
  
  -- Notification tracking
  notifications_sent JSONB DEFAULT '[]',
  escalated BOOLEAN DEFAULT FALSE,
  escalated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  -- Error budget impact
  budget_impact_minutes DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Partitioning helper
  partition_key DATE GENERATED ALWAYS AS (DATE(created_at)) STORED
);

-- =============================================================================
-- CREATE PERFORMANCE BASELINES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS performance_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Baseline identification
  service_name VARCHAR(100) NOT NULL,
  endpoint_pattern VARCHAR(500) NOT NULL,
  test_type VARCHAR(50) NOT NULL,
  environment VARCHAR(50) NOT NULL,
  
  -- Baseline metrics
  baseline_p50_ms DECIMAL(10,2) NOT NULL,
  baseline_p95_ms DECIMAL(10,2) NOT NULL,
  baseline_p99_ms DECIMAL(10,2) NOT NULL,
  baseline_throughput_rps DECIMAL(10,2) NOT NULL,
  baseline_error_rate_percent DECIMAL(5,2) NOT NULL,
  baseline_cpu_percent DECIMAL(5,2) DEFAULT NULL,
  baseline_memory_mb INTEGER DEFAULT NULL,
  
  -- Statistical data
  sample_size INTEGER NOT NULL,
  confidence_level DECIMAL(5,2) DEFAULT 95.0,
  margin_of_error DECIMAL(5,2) DEFAULT 5.0,
  
  -- Regression detection thresholds
  regression_threshold_percent DECIMAL(5,2) DEFAULT 20.0, -- Alert if 20% worse than baseline
  improvement_threshold_percent DECIMAL(5,2) DEFAULT 10.0,
  
  -- Metadata
  baseline_test_ids UUID[] DEFAULT '{}',
  git_commit_range VARCHAR(100) DEFAULT NULL,
  build_range VARCHAR(200) DEFAULT NULL,
  created_from_tests_count INTEGER NOT NULL,
  
  -- Lifecycle
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'deprecated', 'archived')),
  approved_by VARCHAR(255) DEFAULT NULL,
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  superseded_by UUID REFERENCES performance_baselines(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '90 days'),
  
  UNIQUE(service_name, endpoint_pattern, test_type, environment, created_at)
);

-- =============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- Performance tests indexes
CREATE INDEX idx_performance_tests_status ON performance_tests(status, created_at);
CREATE INDEX idx_performance_tests_suite_type ON performance_tests(test_suite, test_type);
CREATE INDEX idx_performance_tests_environment ON performance_tests(environment, completed_at) WHERE status = 'completed';
CREATE INDEX idx_performance_tests_sla_violations ON performance_tests(sla_passed, environment) WHERE sla_passed = FALSE;
CREATE INDEX idx_performance_tests_budget_category ON performance_tests(budget_category, budget_passed);

-- Performance metrics indexes
CREATE INDEX idx_performance_metrics_test_id ON performance_metrics(test_id, metric_name);
CREATE INDEX idx_performance_metrics_timestamp ON performance_metrics(timestamp_ms, metric_type);
CREATE INDEX idx_performance_metrics_partition ON performance_metrics(partition_key, test_id);
CREATE INDEX idx_performance_metrics_category ON performance_metrics(metric_category, metric_name, recorded_at);

-- SLA budgets indexes
CREATE INDEX idx_sla_budgets_service_env ON sla_budgets(service_name, environment) WHERE active = TRUE;
CREATE INDEX idx_sla_budgets_budget_consumed ON sla_budgets(error_budget_consumed_percent, updated_at) WHERE active = TRUE;
CREATE INDEX idx_sla_budgets_period ON sla_budgets(budget_period_start, budget_period_end) WHERE active = TRUE;

-- Performance alerts indexes
CREATE INDEX idx_performance_alerts_status ON performance_alerts(status, severity, created_at);
CREATE INDEX idx_performance_alerts_service ON performance_alerts(service_name, alert_type, environment);
CREATE INDEX idx_performance_alerts_partition ON performance_alerts(partition_key, status);
CREATE INDEX idx_performance_alerts_escalation ON performance_alerts(escalated, escalated_at) WHERE escalated = TRUE;

-- Performance baselines indexes
CREATE INDEX idx_performance_baselines_service_env ON performance_baselines(service_name, environment, status);
CREATE INDEX idx_performance_baselines_valid ON performance_baselines(valid_until, status) WHERE status = 'active';

-- =============================================================================
-- CREATE PERFORMANCE MONITORING FUNCTIONS
-- =============================================================================

-- Function to start performance test
CREATE OR REPLACE FUNCTION start_performance_test(
  p_test_name VARCHAR(100),
  p_test_type VARCHAR(50),
  p_test_suite VARCHAR(100),
  p_target_endpoint VARCHAR(500),
  p_virtual_users INTEGER DEFAULT 10,
  p_duration_seconds INTEGER DEFAULT 60,
  p_environment VARCHAR(50) DEFAULT 'test'
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_test_id UUID;
  v_budget RECORD;
BEGIN
  -- Get SLA budget for this endpoint
  SELECT * INTO v_budget
  FROM sla_budgets
  WHERE service_name = p_test_suite
    AND endpoint_pattern = p_target_endpoint
    AND environment = p_environment
    AND active = TRUE;
  
  -- Create performance test record
  INSERT INTO performance_tests (
    test_name,
    test_type,
    test_suite,
    target_endpoint,
    virtual_users,
    duration_seconds,
    environment,
    status,
    started_at,
    max_response_time_ms,
    max_error_rate_percent,
    min_throughput_rps
  ) VALUES (
    p_test_name,
    p_test_type,
    p_test_suite,
    p_target_endpoint,
    p_virtual_users,
    p_duration_seconds,
    p_environment,
    'running',
    NOW(),
    COALESCE(v_budget.max_response_time_p95_ms, 5000),
    COALESCE(v_budget.max_error_rate_percent, 5.0),
    COALESCE(v_budget.min_throughput_rps, 1.0)
  ) RETURNING id INTO v_test_id;
  
  -- Log test start
  INSERT INTO audit_log (table_name, operation, details)
  VALUES ('performance_tests', 'START', jsonb_build_object(
    'test_id', v_test_id,
    'test_name', p_test_name,
    'test_type', p_test_type,
    'target_endpoint', p_target_endpoint,
    'virtual_users', p_virtual_users,
    'duration_seconds', p_duration_seconds
  ));
  
  RETURN v_test_id;
END;
$$;

-- Function to record performance metric
CREATE OR REPLACE FUNCTION record_performance_metric(
  p_test_id UUID,
  p_metric_name VARCHAR(100),
  p_metric_type VARCHAR(50),
  p_value DECIMAL(15,4),
  p_unit VARCHAR(20) DEFAULT '',
  p_tags JSONB DEFAULT '{}',
  p_timestamp_ms BIGINT DEFAULT NULL
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_metric_id UUID;
  v_timestamp_ms BIGINT;
BEGIN
  -- Use current timestamp if not provided
  v_timestamp_ms := COALESCE(p_timestamp_ms, EXTRACT(EPOCH FROM NOW()) * 1000);
  
  INSERT INTO performance_metrics (
    test_id,
    metric_name,
    metric_type,
    metric_category,
    value,
    unit,
    tags,
    timestamp_ms
  ) VALUES (
    p_test_id,
    p_metric_name,
    p_metric_type,
    CASE 
      WHEN p_metric_name LIKE '%response_time%' OR p_metric_name LIKE '%latency%' THEN 'performance'
      WHEN p_metric_name LIKE '%cpu%' OR p_metric_name LIKE '%memory%' OR p_metric_name LIKE '%disk%' THEN 'resource'
      WHEN p_metric_name LIKE '%error%' OR p_metric_name LIKE '%fail%' THEN 'error'
      WHEN p_metric_name LIKE '%business%' OR p_metric_name LIKE '%conversion%' THEN 'business'
      ELSE 'custom'
    END,
    p_value,
    p_unit,
    p_tags,
    v_timestamp_ms
  ) RETURNING id INTO v_metric_id;
  
  RETURN v_metric_id;
END;
$$;

-- Function to complete performance test
CREATE OR REPLACE FUNCTION complete_performance_test(
  p_test_id UUID,
  p_total_requests INTEGER,
  p_successful_requests INTEGER,
  p_failed_requests INTEGER,
  p_avg_response_time_ms DECIMAL(10,2),
  p_p95_response_time_ms DECIMAL(10,2),
  p_p99_response_time_ms DECIMAL(10,2),
  p_max_response_time_ms DECIMAL(10,2),
  p_requests_per_second DECIMAL(10,2)
) RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_test_record RECORD;
  v_sla_violations JSONB := '[]'::jsonb;
  v_sla_passed BOOLEAN := TRUE;
  v_budget_passed BOOLEAN := TRUE;
  v_baseline RECORD;
  v_alert_id UUID;
BEGIN
  -- Get test details
  SELECT * INTO v_test_record
  FROM performance_tests
  WHERE id = p_test_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Performance test not found: %', p_test_id;
  END IF;
  
  -- Check SLA violations
  IF p_p95_response_time_ms > v_test_record.max_response_time_ms THEN
    v_sla_violations := v_sla_violations || jsonb_build_object(
      'type', 'response_time',
      'threshold', v_test_record.max_response_time_ms,
      'actual', p_p95_response_time_ms,
      'metric', 'p95_response_time_ms'
    );
    v_sla_passed := FALSE;
  END IF;
  
  IF (p_failed_requests::DECIMAL / NULLIF(p_total_requests, 0)::DECIMAL * 100) > v_test_record.max_error_rate_percent THEN
    v_sla_violations := v_sla_violations || jsonb_build_object(
      'type', 'error_rate',
      'threshold', v_test_record.max_error_rate_percent,
      'actual', (p_failed_requests::DECIMAL / NULLIF(p_total_requests, 0)::DECIMAL * 100),
      'metric', 'error_rate_percent'
    );
    v_sla_passed := FALSE;
  END IF;
  
  IF p_requests_per_second < v_test_record.min_throughput_rps THEN
    v_sla_violations := v_sla_violations || jsonb_build_object(
      'type', 'throughput',
      'threshold', v_test_record.min_throughput_rps,
      'actual', p_requests_per_second,
      'metric', 'requests_per_second'
    );
    v_sla_passed := FALSE;
  END IF;
  
  -- Check against baseline for regression detection
  SELECT * INTO v_baseline
  FROM performance_baselines
  WHERE service_name = v_test_record.test_suite
    AND endpoint_pattern = v_test_record.target_endpoint
    AND test_type = v_test_record.test_type
    AND environment = v_test_record.environment
    AND status = 'active'
    AND valid_until > NOW()
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Update test with results
  UPDATE performance_tests
  SET 
    status = 'completed',
    completed_at = NOW(),
    duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER * 1000,
    total_requests = p_total_requests,
    successful_requests = p_successful_requests,
    failed_requests = p_failed_requests,
    avg_response_time_ms = p_avg_response_time_ms,
    p95_response_time_ms = p_p95_response_time_ms,
    p99_response_time_ms = p_p99_response_time_ms,
    max_response_time_ms_actual = p_max_response_time_ms,
    requests_per_second = p_requests_per_second,
    sla_passed = v_sla_passed,
    sla_violations = v_sla_violations,
    budget_passed = v_budget_passed,
    updated_at = NOW()
  WHERE id = p_test_id;
  
  -- Create alerts for violations
  IF NOT v_sla_passed THEN
    INSERT INTO performance_alerts (
      alert_type,
      severity,
      service_name,
      endpoint,
      metric_name,
      threshold_value,
      actual_value,
      test_id,
      environment
    ) 
    SELECT 
      'sla_violation',
      CASE 
        WHEN v_test_record.budget_category = 'critical' THEN 'critical'
        WHEN v_test_record.budget_category = 'high' THEN 'high'
        ELSE 'medium'
      END,
      v_test_record.test_suite,
      v_test_record.target_endpoint,
      (violation->>'metric')::VARCHAR(100),
      (violation->>'threshold')::DECIMAL(15,4),
      (violation->>'actual')::DECIMAL(15,4),
      p_test_id,
      v_test_record.environment
    FROM jsonb_array_elements(v_sla_violations) AS violation;
  END IF;
  
  -- Check for performance regression
  IF v_baseline.id IS NOT NULL THEN
    IF p_p95_response_time_ms > (v_baseline.baseline_p95_ms * (1 + v_baseline.regression_threshold_percent / 100)) THEN
      INSERT INTO performance_alerts (
        alert_type,
        severity,
        service_name,
        endpoint,
        metric_name,
        threshold_value,
        actual_value,
        test_id,
        environment
      ) VALUES (
        'regression',
        'high',
        v_test_record.test_suite,
        v_test_record.target_endpoint,
        'p95_response_time_regression',
        v_baseline.baseline_p95_ms,
        p_p95_response_time_ms,
        p_test_id,
        v_test_record.environment
      );
    END IF;
  END IF;
  
  -- Log completion
  INSERT INTO audit_log (table_name, operation, details)
  VALUES ('performance_tests', 'COMPLETE', jsonb_build_object(
    'test_id', p_test_id,
    'sla_passed', v_sla_passed,
    'violations_count', jsonb_array_length(v_sla_violations),
    'total_requests', p_total_requests,
    'avg_response_time_ms', p_avg_response_time_ms,
    'requests_per_second', p_requests_per_second
  ));
  
  RETURN v_sla_passed;
END;
$$;

-- Function to update error budget
CREATE OR REPLACE FUNCTION update_error_budget(
  p_service_name VARCHAR(100),
  p_environment VARCHAR(50),
  p_error_minutes DECIMAL(10,2),
  p_total_minutes DECIMAL(10,2)
) RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_budget_record RECORD;
  v_error_rate DECIMAL(8,5);
  v_burn_rate DECIMAL(10,2);
  v_remaining_days INTEGER;
BEGIN
  -- Calculate error rate
  v_error_rate := (p_error_minutes / NULLIF(p_total_minutes, 0)) * 100;
  
  -- Get current budget period remaining days
  v_remaining_days := EXTRACT(DAY FROM (DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - NOW()));
  
  -- Calculate current burn rate (how fast we're consuming budget)
  v_burn_rate := CASE 
    WHEN v_remaining_days > 0 THEN v_error_rate / v_remaining_days
    ELSE 0
  END;
  
  -- Update error budget
  UPDATE sla_budgets
  SET 
    error_budget_consumed_percent = LEAST(error_budget_percent, error_budget_consumed_percent + v_error_rate),
    updated_at = NOW()
  WHERE service_name = p_service_name
    AND environment = p_environment
    AND active = TRUE
  RETURNING * INTO v_budget_record;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Create burn rate alerts
  IF v_burn_rate > v_budget_record.fast_burn_rate_threshold THEN
    INSERT INTO performance_alerts (
      alert_type,
      severity,
      service_name,
      metric_name,
      threshold_value,
      actual_value,
      environment,
      budget_impact_minutes
    ) VALUES (
      'burn_rate',
      'critical',
      p_service_name,
      'fast_burn_rate',
      v_budget_record.fast_burn_rate_threshold,
      v_burn_rate,
      p_environment,
      p_error_minutes
    );
  ELSIF v_burn_rate > v_budget_record.slow_burn_rate_threshold THEN
    INSERT INTO performance_alerts (
      alert_type,
      severity,
      service_name,
      metric_name,
      threshold_value,
      actual_value,
      environment,
      budget_impact_minutes
    ) VALUES (
      'burn_rate',
      'high',
      p_service_name,
      'slow_burn_rate',
      v_budget_record.slow_burn_rate_threshold,
      v_burn_rate,
      p_environment,
      p_error_minutes
    );
  END IF;
  
  RETURN TRUE;
END;
$$;

-- =============================================================================
-- CREATE PERFORMANCE MONITORING VIEWS
-- =============================================================================

-- Performance test summary view
CREATE OR REPLACE VIEW performance_test_summary AS
SELECT 
  pt.id,
  pt.test_name,
  pt.test_type,
  pt.test_suite,
  pt.environment,
  pt.status,
  pt.sla_passed,
  pt.budget_passed,
  pt.total_requests,
  pt.error_rate_percent,
  pt.avg_response_time_ms,
  pt.p95_response_time_ms,
  pt.p99_response_time_ms,
  pt.requests_per_second,
  pt.duration_ms,
  pt.started_at,
  pt.completed_at,
  jsonb_array_length(COALESCE(pt.sla_violations, '[]')) as violation_count,
  pb.baseline_p95_ms,
  CASE 
    WHEN pb.baseline_p95_ms IS NOT NULL AND pt.p95_response_time_ms IS NOT NULL 
    THEN ((pt.p95_response_time_ms - pb.baseline_p95_ms) / pb.baseline_p95_ms * 100)
    ELSE NULL
  END as performance_change_percent
FROM performance_tests pt
LEFT JOIN performance_baselines pb ON (
  pb.service_name = pt.test_suite
  AND pb.endpoint_pattern = pt.target_endpoint
  AND pb.test_type = pt.test_type
  AND pb.environment = pt.environment
  AND pb.status = 'active'
)
WHERE pt.created_at > NOW() - INTERVAL '30 days'
ORDER BY pt.created_at DESC;

-- SLA budget status view
CREATE OR REPLACE VIEW sla_budget_status AS
SELECT 
  sb.id,
  sb.service_name,
  sb.endpoint_pattern,
  sb.environment,
  sb.error_budget_percent,
  sb.error_budget_consumed_percent,
  sb.error_budget_remaining_percent,
  sb.budget_period_start,
  sb.budget_period_end,
  EXTRACT(DAY FROM (sb.budget_period_end - NOW())) as days_remaining,
  -- Risk assessment
  CASE 
    WHEN sb.error_budget_remaining_percent <= 0 THEN 'EXHAUSTED'
    WHEN sb.error_budget_remaining_percent < 10 THEN 'CRITICAL'
    WHEN sb.error_budget_remaining_percent < 25 THEN 'HIGH_RISK'
    WHEN sb.error_budget_remaining_percent < 50 THEN 'MODERATE_RISK'
    ELSE 'HEALTHY'
  END as budget_health,
  -- Burn rate calculation
  CASE 
    WHEN EXTRACT(DAY FROM (NOW() - sb.budget_period_start)) > 0 
    THEN sb.error_budget_consumed_percent / EXTRACT(DAY FROM (NOW() - sb.budget_period_start))
    ELSE 0
  END as current_burn_rate_per_day,
  -- Count of recent alerts
  COALESCE(recent_alerts.alert_count, 0) as alerts_last_24h
FROM sla_budgets sb
LEFT JOIN (
  SELECT 
    budget_id,
    COUNT(*) as alert_count
  FROM performance_alerts
  WHERE created_at > NOW() - INTERVAL '24 hours'
    AND status = 'open'
  GROUP BY budget_id
) recent_alerts ON sb.id = recent_alerts.budget_id
WHERE sb.active = TRUE
ORDER BY sb.error_budget_remaining_percent ASC;

-- Performance metrics aggregation view
CREATE OR REPLACE VIEW performance_metrics_hourly AS
SELECT 
  DATE_TRUNC('hour', recorded_at) as hour,
  pt.test_suite as service_name,
  pt.environment,
  pm.metric_name,
  pm.metric_type,
  COUNT(*) as sample_count,
  AVG(pm.value) as avg_value,
  MIN(pm.value) as min_value,
  MAX(pm.value) as max_value,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pm.value) as p50_value,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pm.value) as p95_value,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY pm.value) as p99_value,
  STDDEV(pm.value) as stddev_value
FROM performance_metrics pm
JOIN performance_tests pt ON pm.test_id = pt.id
WHERE pm.recorded_at > NOW() - INTERVAL '7 days'
GROUP BY 
  DATE_TRUNC('hour', pm.recorded_at),
  pt.test_suite,
  pt.environment,
  pm.metric_name,
  pm.metric_type
ORDER BY hour DESC, service_name, metric_name;

-- =============================================================================
-- ENABLE RLS
-- =============================================================================

ALTER TABLE performance_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_baselines ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "performance_tests_service_role" ON performance_tests
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "performance_metrics_service_role" ON performance_metrics
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "sla_budgets_service_role" ON sla_budgets
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "performance_alerts_service_role" ON performance_alerts
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "performance_baselines_service_role" ON performance_baselines
  FOR ALL USING (current_setting('role') = 'service_role');

-- Authenticated users can read performance data
CREATE POLICY "performance_read" ON performance_tests
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "metrics_read" ON performance_metrics
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "budgets_read" ON sla_budgets
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "alerts_read" ON performance_alerts
  FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION start_performance_test TO service_role;
GRANT EXECUTE ON FUNCTION record_performance_metric TO service_role;
GRANT EXECUTE ON FUNCTION complete_performance_test TO service_role;
GRANT EXECUTE ON FUNCTION update_error_budget TO service_role;

GRANT SELECT ON performance_test_summary TO anon, authenticated, service_role;
GRANT SELECT ON sla_budget_status TO anon, authenticated, service_role;
GRANT SELECT ON performance_metrics_hourly TO anon, authenticated, service_role;

-- =============================================================================
-- CREATE INITIAL SLA BUDGETS
-- =============================================================================

INSERT INTO sla_budgets (
  service_name, endpoint_pattern, environment,
  availability_percent, max_response_time_p95_ms, max_response_time_p99_ms,
  max_error_rate_percent, min_throughput_rps, error_budget_percent
) VALUES 
  ('api', '/api/picks/**', 'production',
   99.9, 500, 2000, 0.5, 100.0, 0.1),
   
  ('api', '/api/users/**', 'production',
   99.5, 1000, 5000, 1.0, 50.0, 0.5),
   
  ('discord-bot', '/webhook/**', 'production',
   99.0, 3000, 10000, 2.0, 10.0, 1.0),
   
  ('dashboard', '/**', 'production',
   99.5, 2000, 8000, 1.0, 20.0, 0.5),
   
  ('api', '/api/**', 'staging',
   99.0, 1000, 5000, 2.0, 10.0, 1.0)

ON CONFLICT (service_name, endpoint_pattern, environment) DO UPDATE SET
  max_response_time_p95_ms = EXCLUDED.max_response_time_p95_ms,
  max_response_time_p99_ms = EXCLUDED.max_response_time_p99_ms,
  updated_at = NOW();

-- =============================================================================
-- MIGRATION VERIFICATION
-- =============================================================================

DO $$
DECLARE
  v_test_id UUID;
  v_metric_id UUID;
  v_budget_updated BOOLEAN;
  v_alert_count INTEGER;
BEGIN
  -- Test performance test creation
  SELECT start_performance_test(
    'migration_test',
    'smoke',
    'api',
    '/api/health',
    1,
    10,
    'test'
  ) INTO v_test_id;
  
  -- Test metric recording
  SELECT record_performance_metric(
    v_test_id,
    'response_time_ms',
    'histogram',
    250.5,
    'ms',
    '{"endpoint": "/api/health"}'::jsonb
  ) INTO v_metric_id;
  
  -- Test test completion
  PERFORM complete_performance_test(
    v_test_id,
    100,    -- total_requests
    98,     -- successful_requests
    2,      -- failed_requests
    245.2,  -- avg_response_time_ms
    350.0,  -- p95_response_time_ms
    450.0,  -- p99_response_time_ms
    500.0,  -- max_response_time_ms
    10.5    -- requests_per_second
  );
  
  -- Test error budget update
  SELECT update_error_budget(
    'api',
    'test',
    0.5,    -- error_minutes
    60.0    -- total_minutes
  ) INTO v_budget_updated;
  
  -- Test views
  PERFORM * FROM performance_test_summary LIMIT 1;
  PERFORM * FROM sla_budget_status LIMIT 1;
  
  -- Count alerts generated
  SELECT COUNT(*) INTO v_alert_count
  FROM performance_alerts
  WHERE test_id = v_test_id;
  
  -- Cleanup test data
  DELETE FROM performance_alerts WHERE test_id = v_test_id;
  DELETE FROM performance_metrics WHERE test_id = v_test_id;
  DELETE FROM performance_tests WHERE id = v_test_id;
  
  RAISE NOTICE 'Performance budgets verification successful. Test ID: %, Metric ID: %, Budget Updated: %, Alerts: %', 
    v_test_id, v_metric_id, v_budget_updated, v_alert_count;
END;
$$;

-- Migration completed
INSERT INTO audit_log (table_name, operation, details)
VALUES ('migration', 'COMPLETE', jsonb_build_object(
  'migration', '20250812_performance_budgets',
  'timestamp', NOW(),
  'description', 'Performance budgets system with k6/artillery testing integration, SLA enforcement, and error budget monitoring'
));