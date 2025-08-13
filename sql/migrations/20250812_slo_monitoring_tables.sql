-- SLO Monitoring: Create tables for SLO tracking and burn-rate alerts
-- Migration: 20250812_slo_monitoring_tables.sql

-- =============================================================================
-- CREATE SLO TRACKING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS slo_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- SLO identification
  slo_name VARCHAR(100) NOT NULL,
  slo_type VARCHAR(50) NOT NULL CHECK (slo_type IN ('availability', 'latency', 'quality')),
  
  -- Measurement details
  measurement_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  measurement_window_minutes INTEGER NOT NULL,
  
  -- SLO metrics
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  
  -- Latency metrics (in milliseconds)
  p50_latency_ms DECIMAL(10,2) DEFAULT NULL,
  p95_latency_ms DECIMAL(10,2) DEFAULT NULL,
  p99_latency_ms DECIMAL(10,2) DEFAULT NULL,
  avg_latency_ms DECIMAL(10,2) DEFAULT NULL,
  
  -- SLO compliance
  slo_target DECIMAL(5,4) NOT NULL, -- e.g., 0.99 for 99%
  actual_performance DECIMAL(5,4) NOT NULL, -- actual measured performance
  slo_compliance BOOLEAN GENERATED ALWAYS AS (actual_performance >= slo_target) STORED,
  
  -- Error budget
  error_budget_consumed DECIMAL(8,6) CALCULATED AS (
    GREATEST(0, (slo_target - actual_performance) / (1 - slo_target))
  ),
  
  -- Additional metadata
  labels JSONB DEFAULT '{}',
  raw_metrics JSONB DEFAULT '{}',
  
  -- Indexes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- CREATE BURN RATE ALERTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS burn_rate_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Alert identification
  alert_name VARCHAR(200) NOT NULL,
  slo_name VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  
  -- Burn rate configuration
  lookback_window_minutes INTEGER NOT NULL,
  burn_rate_threshold DECIMAL(8,4) NOT NULL,
  min_duration_minutes INTEGER NOT NULL,
  
  -- Alert state
  status VARCHAR(20) NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'alerting', 'resolved')),
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  last_evaluation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Current measurements
  current_burn_rate DECIMAL(8,4) DEFAULT NULL,
  error_budget_remaining DECIMAL(5,4) DEFAULT NULL,
  
  -- Alert details
  description TEXT,
  runbook_url VARCHAR(500),
  alert_details JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- CREATE TEMPORAL CANARY TRACKING TABLE  
-- =============================================================================

CREATE TABLE IF NOT EXISTS temporal_canary_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Workflow identification
  workflow_id VARCHAR(255) NOT NULL,
  run_id VARCHAR(255) NOT NULL,
  
  -- Execution results
  success BOOLEAN NOT NULL,
  duration_ms INTEGER NOT NULL,
  error_message TEXT DEFAULT NULL,
  
  -- Health metrics
  consecutive_failures INTEGER DEFAULT 0,
  
  -- Timing
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Additional context
  workflow_result JSONB DEFAULT NULL,
  system_metrics JSONB DEFAULT NULL
);

-- =============================================================================
-- CREATE MONITORING ALERTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS monitoring_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Alert classification
  alert_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  
  -- Alert content
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  
  -- Alert lifecycle
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  acknowledged_by UUID DEFAULT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  -- Notification tracking
  notifications_sent JSONB DEFAULT '[]',
  escalation_level INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- CREATE SYSTEM METRICS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Metric identification
  metric_name VARCHAR(100) NOT NULL,
  metric_type VARCHAR(50) NOT NULL, -- 'counter', 'gauge', 'histogram'
  
  -- Metric values
  value DECIMAL(20,6) NOT NULL,
  labels JSONB DEFAULT '{}',
  
  -- Context
  instance VARCHAR(100) DEFAULT NULL,
  job VARCHAR(100) DEFAULT NULL,
  
  -- Timing
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- SLO measurements indexes
CREATE INDEX idx_slo_measurements_name_time ON slo_measurements(slo_name, measurement_timestamp);
CREATE INDEX idx_slo_measurements_timestamp ON slo_measurements(measurement_timestamp);
CREATE INDEX idx_slo_measurements_compliance ON slo_measurements(slo_compliance, slo_name);

-- Burn rate alerts indexes
CREATE INDEX idx_burn_rate_alerts_slo_status ON burn_rate_alerts(slo_name, status);
CREATE INDEX idx_burn_rate_alerts_severity ON burn_rate_alerts(severity, status);
CREATE INDEX idx_burn_rate_alerts_triggered ON burn_rate_alerts(triggered_at) WHERE triggered_at IS NOT NULL;

-- Temporal canary indexes
CREATE INDEX idx_temporal_canary_timestamp ON temporal_canary_results(timestamp);
CREATE INDEX idx_temporal_canary_success ON temporal_canary_results(success, timestamp);
CREATE INDEX idx_temporal_canary_workflow ON temporal_canary_results(workflow_id);

-- Monitoring alerts indexes
CREATE INDEX idx_monitoring_alerts_type_status ON monitoring_alerts(alert_type, status);
CREATE INDEX idx_monitoring_alerts_severity ON monitoring_alerts(severity, created_at);
CREATE INDEX idx_monitoring_alerts_created ON monitoring_alerts(created_at);

-- System metrics indexes
CREATE INDEX idx_system_metrics_name_time ON system_metrics_snapshots(metric_name, timestamp);
CREATE INDEX idx_system_metrics_timestamp ON system_metrics_snapshots(timestamp);

-- =============================================================================
-- CREATE SLO MONITORING FUNCTIONS
-- =============================================================================

-- Function to calculate current burn rate for an SLO
CREATE OR REPLACE FUNCTION calculate_burn_rate(
  p_slo_name VARCHAR(100),
  p_lookback_minutes INTEGER
) RETURNS DECIMAL(8,4)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_performance DECIMAL(5,4);
  v_slo_target DECIMAL(5,4);
  v_burn_rate DECIMAL(8,4);
BEGIN
  -- Get latest SLO measurement within lookback window
  SELECT 
    actual_performance,
    slo_target
  INTO v_current_performance, v_slo_target
  FROM slo_measurements 
  WHERE slo_name = p_slo_name 
    AND measurement_timestamp > NOW() - (p_lookback_minutes * INTERVAL '1 minute')
  ORDER BY measurement_timestamp DESC
  LIMIT 1;
  
  IF v_current_performance IS NULL THEN
    RETURN 0; -- No data available
  END IF;
  
  -- Calculate burn rate
  -- Burn rate = (Target - Actual) / (Target - 0) * Normal Rate
  -- For 99% SLO: Normal rate = 1, so burn rate = (0.99 - actual) / 0.01
  IF v_slo_target = v_current_performance THEN
    v_burn_rate := 0; -- Perfect performance
  ELSIF v_current_performance < v_slo_target THEN
    v_burn_rate := (v_slo_target - v_current_performance) / (1 - v_slo_target);
  ELSE
    v_burn_rate := 0; -- Better than target
  END IF;
  
  RETURN GREATEST(0, v_burn_rate);
END;
$$;

-- Function to evaluate burn rate alerts
CREATE OR REPLACE FUNCTION evaluate_burn_rate_alerts()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_alert RECORD;
  v_current_burn_rate DECIMAL(8,4);
  v_should_alert BOOLEAN;
  v_alerts_updated INTEGER := 0;
BEGIN
  -- Loop through all configured burn rate alerts
  FOR v_alert IN 
    SELECT * FROM burn_rate_alerts 
    WHERE status IN ('ok', 'alerting')
  LOOP
    -- Calculate current burn rate
    v_current_burn_rate := calculate_burn_rate(
      v_alert.slo_name,
      v_alert.lookback_window_minutes
    );
    
    -- Determine if alert condition is met
    v_should_alert := v_current_burn_rate >= v_alert.burn_rate_threshold;
    
    -- Update alert status
    IF v_should_alert AND v_alert.status = 'ok' THEN
      -- Trigger alert
      UPDATE burn_rate_alerts 
      SET 
        status = 'alerting',
        triggered_at = NOW(),
        current_burn_rate = v_current_burn_rate,
        last_evaluation = NOW(),
        updated_at = NOW()
      WHERE id = v_alert.id;
      
      -- Log alert trigger
      INSERT INTO monitoring_alerts (alert_type, severity, message, details)
      VALUES (
        'burn_rate_alert',
        v_alert.severity,
        v_alert.alert_name || ' - SLO burn rate exceeded',
        jsonb_build_object(
          'slo_name', v_alert.slo_name,
          'current_burn_rate', v_current_burn_rate,
          'threshold', v_alert.burn_rate_threshold,
          'lookback_minutes', v_alert.lookback_window_minutes
        )
      );
      
      v_alerts_updated := v_alerts_updated + 1;
      
    ELSIF NOT v_should_alert AND v_alert.status = 'alerting' THEN
      -- Resolve alert
      UPDATE burn_rate_alerts 
      SET 
        status = 'ok',
        resolved_at = NOW(),
        current_burn_rate = v_current_burn_rate,
        last_evaluation = NOW(),
        updated_at = NOW()
      WHERE id = v_alert.id;
      
      v_alerts_updated := v_alerts_updated + 1;
      
    ELSE
      -- Update current metrics
      UPDATE burn_rate_alerts 
      SET 
        current_burn_rate = v_current_burn_rate,
        last_evaluation = NOW(),
        updated_at = NOW()
      WHERE id = v_alert.id;
    END IF;
  END LOOP;
  
  RETURN v_alerts_updated;
END;
$$;

-- Function to record SLO measurement
CREATE OR REPLACE FUNCTION record_slo_measurement(
  p_slo_name VARCHAR(100),
  p_slo_type VARCHAR(50),
  p_measurement_window_minutes INTEGER,
  p_total_requests INTEGER DEFAULT 0,
  p_successful_requests INTEGER DEFAULT 0,
  p_slo_target DECIMAL(5,4) DEFAULT 0.99,
  p_latency_metrics JSONB DEFAULT NULL,
  p_labels JSONB DEFAULT NULL
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_measurement_id UUID;
  v_actual_performance DECIMAL(5,4);
BEGIN
  -- Calculate actual performance based on SLO type
  IF p_slo_type = 'availability' THEN
    v_actual_performance := CASE 
      WHEN p_total_requests = 0 THEN 1.0
      ELSE p_successful_requests::DECIMAL / p_total_requests::DECIMAL
    END;
  ELSIF p_slo_type = 'latency' THEN
    -- For latency SLOs, performance is the percentage meeting the threshold
    -- This would typically be calculated by the caller
    v_actual_performance := CASE 
      WHEN p_total_requests = 0 THEN 1.0
      ELSE p_successful_requests::DECIMAL / p_total_requests::DECIMAL
    END;
  ELSE
    v_actual_performance := 1.0; -- Default for quality SLOs
  END IF;
  
  -- Insert measurement
  INSERT INTO slo_measurements (
    slo_name,
    slo_type,
    measurement_window_minutes,
    total_requests,
    successful_requests,
    failed_requests,
    p50_latency_ms,
    p95_latency_ms,
    p99_latency_ms,
    avg_latency_ms,
    slo_target,
    actual_performance,
    labels,
    raw_metrics
  ) VALUES (
    p_slo_name,
    p_slo_type,
    p_measurement_window_minutes,
    p_total_requests,
    p_successful_requests,
    p_total_requests - p_successful_requests,
    (p_latency_metrics->>'p50')::DECIMAL,
    (p_latency_metrics->>'p95')::DECIMAL,
    (p_latency_metrics->>'p99')::DECIMAL,
    (p_latency_metrics->>'avg')::DECIMAL,
    p_slo_target,
    v_actual_performance,
    COALESCE(p_labels, '{}'),
    COALESCE(p_latency_metrics, '{}')
  ) RETURNING id INTO v_measurement_id;
  
  -- Trigger burn rate alert evaluation
  PERFORM evaluate_burn_rate_alerts();
  
  RETURN v_measurement_id;
END;
$$;

-- =============================================================================
-- CREATE MONITORING VIEWS
-- =============================================================================

-- Current SLO status view
CREATE OR REPLACE VIEW current_slo_status AS
WITH latest_measurements AS (
  SELECT DISTINCT ON (slo_name)
    slo_name,
    slo_type,
    actual_performance,
    slo_target,
    slo_compliance,
    error_budget_consumed,
    measurement_timestamp,
    total_requests,
    successful_requests,
    failed_requests,
    p95_latency_ms
  FROM slo_measurements
  ORDER BY slo_name, measurement_timestamp DESC
)
SELECT 
  lm.*,
  -- Error budget remaining (monthly)
  GREATEST(0, 1 - lm.error_budget_consumed) as error_budget_remaining,
  
  -- Current burn rate (last 5 minutes)
  calculate_burn_rate(lm.slo_name, 5) as current_burn_rate_5m,
  
  -- Active alerts for this SLO
  (SELECT COUNT(*) FROM burn_rate_alerts 
   WHERE slo_name = lm.slo_name AND status = 'alerting') as active_alerts
   
FROM latest_measurements lm;

-- Alert summary view
CREATE OR REPLACE VIEW alert_summary AS
SELECT 
  alert_type,
  severity,
  COUNT(*) as total_alerts,
  COUNT(*) FILTER (WHERE status = 'active') as active_alerts,
  COUNT(*) FILTER (WHERE status = 'acknowledged') as acknowledged_alerts,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved_alerts,
  MAX(created_at) as last_alert_time
FROM monitoring_alerts
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY alert_type, severity;

-- =============================================================================
-- ENABLE RLS
-- =============================================================================

ALTER TABLE slo_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE burn_rate_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE temporal_canary_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics_snapshots ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "monitoring_service_role" ON slo_measurements
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "alerts_service_role" ON burn_rate_alerts
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "canary_service_role" ON temporal_canary_results
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "monitoring_alerts_service_role" ON monitoring_alerts
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "metrics_service_role" ON system_metrics_snapshots
  FOR ALL USING (current_setting('role') = 'service_role');

-- Authenticated users can read monitoring data
CREATE POLICY "monitoring_read" ON slo_measurements
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "alerts_read" ON monitoring_alerts
  FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION calculate_burn_rate TO service_role;
GRANT EXECUTE ON FUNCTION evaluate_burn_rate_alerts TO service_role;
GRANT EXECUTE ON FUNCTION record_slo_measurement TO service_role;

GRANT SELECT ON current_slo_status TO anon, authenticated, service_role;
GRANT SELECT ON alert_summary TO anon, authenticated, service_role;

-- =============================================================================
-- CREATE INITIAL BURN RATE ALERT CONFIGURATIONS
-- =============================================================================

INSERT INTO burn_rate_alerts (
  alert_name, slo_name, severity, lookback_window_minutes, 
  burn_rate_threshold, min_duration_minutes, description, runbook_url
) VALUES 
  ('API Response Time - Fast Burn', 'api_response_time', 'critical', 5, 14.4, 2, 
   'API response time SLO burning error budget at 14.4x rate', 
   'https://github.com/unit-talk/platform/wiki/SLO-Runbook#api-response-time'),
   
  ('API Response Time - Slow Burn', 'api_response_time', 'warning', 60, 6, 15,
   'API response time SLO burning error budget at 6x rate',
   'https://github.com/unit-talk/platform/wiki/SLO-Runbook#api-response-time'),
   
  ('API Error Rate - Fast Burn', 'api_error_rate', 'critical', 5, 14.4, 2,
   'API error rate SLO burning error budget at 14.4x rate',
   'https://github.com/unit-talk/platform/wiki/SLO-Runbook#api-error-rate'),
   
  ('API Error Rate - Slow Burn', 'api_error_rate', 'warning', 60, 6, 15,
   'API error rate SLO burning error budget at 6x rate',
   'https://github.com/unit-talk/platform/wiki/SLO-Runbook#api-error-rate'),
   
  ('Database Performance - Fast Burn', 'database_performance', 'critical', 5, 14.4, 2,
   'Database performance SLO burning error budget at 14.4x rate',
   'https://github.com/unit-talk/platform/wiki/SLO-Runbook#database-performance'),
   
  ('Temporal Workflows - Fast Burn', 'temporal_workflows', 'critical', 5, 14.4, 2,
   'Temporal workflow SLO burning error budget at 14.4x rate',
   'https://github.com/unit-talk/platform/wiki/SLO-Runbook#temporal-workflows'),
   
  ('Pick Processing - Slow Burn', 'pick_processing', 'warning', 30, 3, 10,
   'Pick processing SLO burning error budget at 3x rate',
   'https://github.com/unit-talk/platform/wiki/SLO-Runbook#pick-processing')

ON CONFLICT DO NOTHING;

-- =============================================================================
-- MIGRATION VERIFICATION
-- =============================================================================

DO $$
DECLARE
  v_measurement_id UUID;
  v_burn_rate DECIMAL(8,4);
BEGIN
  -- Test SLO measurement recording
  SELECT record_slo_measurement(
    'test_slo',
    'availability',
    5,
    1000,
    990,
    0.99,
    '{"p95": 150.5, "avg": 85.2}'::jsonb,
    '{"service": "test"}'::jsonb
  ) INTO v_measurement_id;
  
  -- Test burn rate calculation
  SELECT calculate_burn_rate('test_slo', 5) INTO v_burn_rate;
  
  -- Test views
  PERFORM * FROM current_slo_status LIMIT 1;
  PERFORM * FROM alert_summary LIMIT 1;
  
  -- Cleanup test data
  DELETE FROM slo_measurements WHERE slo_name = 'test_slo';
  
  RAISE NOTICE 'SLO monitoring system verification successful';
END;
$$;

-- Migration completed
INSERT INTO audit_log (table_name, operation, details)
VALUES ('migration', 'COMPLETE', jsonb_build_object(
  'migration', '20250812_slo_monitoring_tables',
  'timestamp', NOW(),
  'description', 'SLO monitoring system with burn-rate alerts and Temporal canary tracking'
));