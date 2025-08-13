-- Migration: Emergency Rollback System
-- One-click rollback capabilities with safety checks and audit trail
-- Version: 1.0.0
-- Author: System

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================================================
-- ROLLBACK SYSTEM TABLES
-- ============================================================================

-- Rollback requests and tracking
CREATE TABLE IF NOT EXISTS rollback_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rollback_type VARCHAR(50) NOT NULL, -- 'blue_green', 'canary_revert', 'database_rollback', etc.
  rollback_target VARCHAR(200) NOT NULL, -- commit hash, version, timestamp
  affected_services TEXT[] DEFAULT '{}', -- list of services to rollback
  rollback_reason VARCHAR(50) NOT NULL, -- 'critical_bug', 'performance_degradation', etc.
  severity_level VARCHAR(20) NOT NULL DEFAULT 'medium',
  skip_confirmations BOOLEAN DEFAULT false,
  maintenance_mode BOOLEAN DEFAULT false,
  initiated_by VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'executing', 'completed', 'failed'
  approved_by VARCHAR(100),
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  environment VARCHAR(50) DEFAULT 'production',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_rollback_type CHECK (rollback_type IN (
    'blue_green', 'canary_revert', 'database_rollback', 
    'feature_flag_disable', 'traffic_drain', 'full_system_rollback'
  )),
  CONSTRAINT valid_rollback_reason CHECK (rollback_reason IN (
    'critical_bug', 'performance_degradation', 'security_vulnerability',
    'data_corruption', 'service_outage', 'error_budget_exhaustion', 
    'user_impact', 'monitoring_alert'
  )),
  CONSTRAINT valid_severity CHECK (severity_level IN ('critical', 'high', 'medium', 'low')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'executing', 'completed', 'failed', 'cancelled'))
);

-- Rollback execution details and steps
CREATE TABLE IF NOT EXISTS rollback_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rollback_request_id UUID REFERENCES rollback_requests(id) NOT NULL,
  execution_plan JSONB NOT NULL, -- strategy, steps, estimated time
  status VARCHAR(50) DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_minutes DECIMAL(10,2),
  error_budget_impact DECIMAL(10,2) DEFAULT 0, -- minutes consumed
  execution_output TEXT,
  error_message TEXT,
  rollback_commit_hash VARCHAR(200),
  pre_rollback_state JSONB, -- system state before rollback
  post_rollback_state JSONB, -- system state after rollback
  environment VARCHAR(50) DEFAULT 'production',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_execution_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled'))
);

-- Individual rollback step execution tracking
CREATE TABLE IF NOT EXISTS rollback_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id UUID REFERENCES rollback_executions(id) NOT NULL,
  step_name VARCHAR(200) NOT NULL,
  step_order INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds DECIMAL(10,2),
  step_output TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_step_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped'))
);

-- Safety checks and validations
CREATE TABLE IF NOT EXISTS rollback_safety_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rollback_request_id UUID REFERENCES rollback_requests(id) NOT NULL,
  check_type VARCHAR(50) NOT NULL, -- 'environment', 'backup', 'impact', 'approval'
  check_name VARCHAR(200) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  required BOOLEAN DEFAULT true,
  check_result JSONB,
  error_message TEXT,
  performed_by VARCHAR(100),
  performed_at TIMESTAMPTZ,
  environment VARCHAR(50) DEFAULT 'production',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_safety_check_status CHECK (status IN ('pending', 'passed', 'failed', 'skipped'))
);

-- Post-rollback validations
CREATE TABLE IF NOT EXISTS rollback_validations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id UUID REFERENCES rollback_executions(id) NOT NULL,
  validation_type VARCHAR(50) NOT NULL, -- 'health_check', 'database_integrity', etc.
  validation_name VARCHAR(200) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  expected_value TEXT,
  actual_value TEXT,
  validation_result JSONB,
  error_message TEXT,
  performed_at TIMESTAMPTZ,
  environment VARCHAR(50) DEFAULT 'production',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_validation_status CHECK (status IN ('pending', 'passed', 'failed', 'warning'))
);

-- Traffic routing state tracking
CREATE TABLE IF NOT EXISTS traffic_routing_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_name VARCHAR(100) NOT NULL,
  current_traffic_split JSONB NOT NULL, -- {"version_a": 80, "version_b": 20}
  target_traffic_split JSONB NOT NULL,
  rollback_traffic_split JSONB,
  routing_config JSONB, -- load balancer specific config
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(100),
  environment VARCHAR(50) DEFAULT 'production',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(service_name, environment)
);

-- System health snapshots
CREATE TABLE IF NOT EXISTS system_health_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_timestamp TIMESTAMPTZ DEFAULT NOW(),
  overall_status VARCHAR(50) NOT NULL,
  service_health JSONB NOT NULL, -- detailed service health data
  error_rates JSONB, -- service error rates
  response_times JSONB, -- service response times
  system_metrics JSONB, -- CPU, memory, etc.
  active_alerts INTEGER DEFAULT 0,
  rollback_context VARCHAR(50), -- 'pre_rollback', 'post_rollback', 'monitoring'
  environment VARCHAR(50) DEFAULT 'production',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_health_status CHECK (overall_status IN ('healthy', 'degraded', 'critical', 'unknown'))
);

-- System state configuration
CREATE TABLE IF NOT EXISTS system_state (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by VARCHAR(100),
  environment VARCHAR(50) DEFAULT 'production',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROLLBACK SYSTEM FUNCTIONS
-- ============================================================================

-- Create rollback request with validation
CREATE OR REPLACE FUNCTION create_rollback_request(
  p_rollback_type VARCHAR(50),
  p_rollback_target VARCHAR(200),
  p_affected_services TEXT[],
  p_rollback_reason VARCHAR(50),
  p_severity_level VARCHAR(20),
  p_initiated_by VARCHAR(100),
  p_skip_confirmations BOOLEAN DEFAULT false,
  p_maintenance_mode BOOLEAN DEFAULT false
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request_id UUID;
  v_requires_approval BOOLEAN := false;
BEGIN
  -- Validate inputs
  IF p_rollback_type NOT IN ('blue_green', 'canary_revert', 'database_rollback', 
                            'feature_flag_disable', 'traffic_drain', 'full_system_rollback') THEN
    RAISE EXCEPTION 'Invalid rollback type: %', p_rollback_type;
  END IF;
  
  IF p_severity_level NOT IN ('critical', 'high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Invalid severity level: %', p_severity_level;
  END IF;
  
  -- Determine if approval is required
  IF p_severity_level != 'critical' AND NOT p_skip_confirmations THEN
    v_requires_approval := true;
  END IF;
  
  -- Create rollback request
  INSERT INTO rollback_requests (
    rollback_type, rollback_target, affected_services,
    rollback_reason, severity_level, initiated_by,
    skip_confirmations, maintenance_mode,
    status
  ) VALUES (
    p_rollback_type, p_rollback_target, p_affected_services,
    p_rollback_reason, p_severity_level, p_initiated_by,
    p_skip_confirmations, p_maintenance_mode,
    CASE WHEN v_requires_approval THEN 'pending' ELSE 'approved' END
  ) RETURNING id INTO v_request_id;
  
  -- Create safety checks
  PERFORM create_safety_checks(v_request_id, p_rollback_type, p_severity_level);
  
  RETURN v_request_id;
END;
$$;

-- Create safety checks for rollback request
CREATE OR REPLACE FUNCTION create_safety_checks(
  p_request_id UUID,
  p_rollback_type VARCHAR(50),
  p_severity_level VARCHAR(20)
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Environment validation check
  INSERT INTO rollback_safety_checks (rollback_request_id, check_type, check_name, required)
  VALUES (p_request_id, 'environment', 'Verify production environment', true);
  
  -- Backup validation check
  INSERT INTO rollback_safety_checks (rollback_request_id, check_type, check_name, required)
  VALUES (p_request_id, 'backup', 'Verify recent backups exist', true);
  
  -- Impact assessment check
  INSERT INTO rollback_safety_checks (rollback_request_id, check_type, check_name, required)
  VALUES (p_request_id, 'impact', 'Assess rollback impact', true);
  
  -- Approval check (if not critical)
  IF p_severity_level != 'critical' THEN
    INSERT INTO rollback_safety_checks (rollback_request_id, check_type, check_name, required)
    VALUES (p_request_id, 'approval', 'Rollback approval required', true);
  END IF;
  
  -- Database-specific checks
  IF p_rollback_type = 'database_rollback' THEN
    INSERT INTO rollback_safety_checks (rollback_request_id, check_type, check_name, required)
    VALUES (p_request_id, 'backup', 'Database backup verification', true);
    
    INSERT INTO rollback_safety_checks (rollback_request_id, check_type, check_name, required)
    VALUES (p_request_id, 'impact', 'Migration rollback validation', true);
  END IF;
END;
$$;

-- Start rollback execution
CREATE OR REPLACE FUNCTION start_rollback_execution(
  p_request_id UUID,
  p_execution_plan JSONB,
  p_executed_by VARCHAR(100)
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_execution_id UUID;
  v_step_name TEXT;
  v_step_order INTEGER := 1;
BEGIN
  -- Verify request is approved and ready
  IF NOT EXISTS (
    SELECT 1 FROM rollback_requests 
    WHERE id = p_request_id AND status IN ('approved', 'pending')
  ) THEN
    RAISE EXCEPTION 'Rollback request not found or not approved: %', p_request_id;
  END IF;
  
  -- Create execution record
  INSERT INTO rollback_executions (
    rollback_request_id, execution_plan, status, started_at
  ) VALUES (
    p_request_id, p_execution_plan, 'in_progress', NOW()
  ) RETURNING id INTO v_execution_id;
  
  -- Create execution steps from plan
  FOR v_step_name IN SELECT jsonb_array_elements_text(p_execution_plan->'steps')
  LOOP
    INSERT INTO rollback_steps (
      execution_id, step_name, step_order, status
    ) VALUES (
      v_execution_id, v_step_name, v_step_order, 'pending'
    );
    
    v_step_order := v_step_order + 1;
  END LOOP;
  
  -- Update request status
  UPDATE rollback_requests 
  SET status = 'executing', executed_at = NOW() 
  WHERE id = p_request_id;
  
  RETURN v_execution_id;
END;
$$;

-- Update rollback step status
CREATE OR REPLACE FUNCTION update_rollback_step(
  p_step_id UUID,
  p_status VARCHAR(50),
  p_output TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_execution_id UUID;
BEGIN
  -- Update step
  UPDATE rollback_steps 
  SET 
    status = p_status,
    completed_at = CASE WHEN p_status IN ('completed', 'failed', 'skipped') THEN NOW() ELSE completed_at END,
    duration_seconds = CASE 
      WHEN p_status IN ('completed', 'failed', 'skipped') AND started_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (NOW() - started_at))
      ELSE duration_seconds 
    END,
    step_output = p_output,
    error_message = p_error_message
  WHERE id = p_step_id
  RETURNING execution_id INTO v_execution_id;
  
  -- Check if all steps are completed
  IF NOT EXISTS (
    SELECT 1 FROM rollback_steps 
    WHERE execution_id = v_execution_id AND status IN ('pending', 'in_progress')
  ) THEN
    -- All steps completed, update execution status
    UPDATE rollback_executions 
    SET 
      status = CASE 
        WHEN EXISTS (SELECT 1 FROM rollback_steps WHERE execution_id = v_execution_id AND status = 'failed') 
        THEN 'failed' 
        ELSE 'completed' 
      END,
      completed_at = NOW(),
      duration_minutes = EXTRACT(EPOCH FROM (NOW() - started_at)) / 60
    WHERE id = v_execution_id;
  END IF;
END;
$$;

-- Capture system health snapshot
CREATE OR REPLACE FUNCTION capture_system_health(
  p_overall_status VARCHAR(50),
  p_service_health JSONB,
  p_error_rates JSONB DEFAULT '{}',
  p_response_times JSONB DEFAULT '{}',
  p_rollback_context VARCHAR(50) DEFAULT 'monitoring'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_snapshot_id UUID;
BEGIN
  INSERT INTO system_health_snapshots (
    overall_status, service_health, error_rates, 
    response_times, rollback_context
  ) VALUES (
    p_overall_status, p_service_health, p_error_rates,
    p_response_times, p_rollback_context
  ) RETURNING id INTO v_snapshot_id;
  
  RETURN v_snapshot_id;
END;
$$;

-- Update traffic routing state
CREATE OR REPLACE FUNCTION update_traffic_routing(
  p_service_name VARCHAR(100),
  p_current_split JSONB,
  p_target_split JSONB,
  p_rollback_split JSONB DEFAULT NULL,
  p_updated_by VARCHAR(100) DEFAULT 'system'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO traffic_routing_state (
    service_name, current_traffic_split, target_traffic_split,
    rollback_traffic_split, updated_by
  ) VALUES (
    p_service_name, p_current_split, p_target_split,
    p_rollback_split, p_updated_by
  )
  ON CONFLICT (service_name, environment) DO UPDATE SET
    current_traffic_split = EXCLUDED.current_traffic_split,
    target_traffic_split = EXCLUDED.target_traffic_split,
    rollback_traffic_split = EXCLUDED.rollback_traffic_split,
    last_updated = NOW(),
    updated_by = EXCLUDED.updated_by;
END;
$$;

-- Complete rollback execution with validations
CREATE OR REPLACE FUNCTION complete_rollback_execution(
  p_execution_id UUID,
  p_validation_results JSONB,
  p_error_budget_impact DECIMAL DEFAULT 0,
  p_post_rollback_state JSONB DEFAULT '{}'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request_id UUID;
  v_validation JSONB;
BEGIN
  -- Get request ID
  SELECT rollback_request_id INTO v_request_id 
  FROM rollback_executions WHERE id = p_execution_id;
  
  -- Update execution with final details
  UPDATE rollback_executions 
  SET 
    status = 'completed',
    completed_at = NOW(),
    error_budget_impact = p_error_budget_impact,
    post_rollback_state = p_post_rollback_state,
    duration_minutes = EXTRACT(EPOCH FROM (NOW() - started_at)) / 60
  WHERE id = p_execution_id;
  
  -- Create validation records
  FOR v_validation IN SELECT jsonb_array_elements(p_validation_results)
  LOOP
    INSERT INTO rollback_validations (
      execution_id, validation_type, validation_name, status,
      expected_value, actual_value, validation_result, performed_at
    ) VALUES (
      p_execution_id,
      v_validation->>'validation_type',
      v_validation->>'validation_name', 
      v_validation->>'status',
      v_validation->>'expected_value',
      v_validation->>'actual_value',
      v_validation->'result',
      NOW()
    );
  END LOOP;
  
  -- Update request status
  UPDATE rollback_requests 
  SET status = 'completed', completed_at = NOW() 
  WHERE id = v_request_id;
END;
$$;

-- ============================================================================
-- ROLLBACK SYSTEM VIEWS
-- ============================================================================

-- Active rollback requests
CREATE OR REPLACE VIEW active_rollback_requests AS
SELECT 
  rr.id,
  rr.rollback_type,
  rr.rollback_target,
  rr.affected_services,
  rr.rollback_reason,
  rr.severity_level,
  rr.initiated_by,
  rr.status,
  rr.created_at,
  -- Safety check status
  COUNT(rsc.*) as total_safety_checks,
  COUNT(rsc.*) FILTER (WHERE rsc.status = 'passed') as passed_safety_checks,
  COUNT(rsc.*) FILTER (WHERE rsc.status = 'failed') as failed_safety_checks,
  -- Execution info if exists
  re.id as execution_id,
  re.status as execution_status,
  re.started_at as execution_started,
  re.duration_minutes as execution_duration
FROM rollback_requests rr
LEFT JOIN rollback_safety_checks rsc ON rr.id = rsc.rollback_request_id
LEFT JOIN rollback_executions re ON rr.id = re.rollback_request_id
WHERE rr.status IN ('pending', 'approved', 'executing')
  AND rr.created_at > NOW() - INTERVAL '24 hours'
GROUP BY rr.id, re.id, re.status, re.started_at, re.duration_minutes
ORDER BY rr.created_at DESC;

-- Rollback execution status
CREATE OR REPLACE VIEW rollback_execution_status AS
SELECT 
  re.id as execution_id,
  rr.rollback_type,
  rr.rollback_reason,
  rr.severity_level,
  rr.initiated_by,
  re.status as execution_status,
  re.started_at,
  re.completed_at,
  re.duration_minutes,
  re.error_budget_impact,
  -- Step progress
  COUNT(rs.*) as total_steps,
  COUNT(rs.*) FILTER (WHERE rs.status = 'completed') as completed_steps,
  COUNT(rs.*) FILTER (WHERE rs.status = 'failed') as failed_steps,
  COUNT(rs.*) FILTER (WHERE rs.status = 'in_progress') as active_steps,
  -- Progress percentage
  ROUND(
    (COUNT(rs.*) FILTER (WHERE rs.status = 'completed')::DECIMAL / NULLIF(COUNT(rs.*), 0) * 100), 2
  ) as progress_percentage,
  -- Validation results
  COUNT(rv.*) as total_validations,
  COUNT(rv.*) FILTER (WHERE rv.status = 'passed') as passed_validations,
  COUNT(rv.*) FILTER (WHERE rv.status = 'failed') as failed_validations
FROM rollback_executions re
JOIN rollback_requests rr ON re.rollback_request_id = rr.id
LEFT JOIN rollback_steps rs ON re.id = rs.execution_id
LEFT JOIN rollback_validations rv ON re.id = rv.execution_id
GROUP BY re.id, rr.rollback_type, rr.rollback_reason, rr.severity_level, 
         rr.initiated_by, re.status, re.started_at, re.completed_at, 
         re.duration_minutes, re.error_budget_impact
ORDER BY re.started_at DESC;

-- Traffic routing dashboard
CREATE OR REPLACE VIEW traffic_routing_dashboard AS
SELECT 
  trs.service_name,
  trs.current_traffic_split,
  trs.target_traffic_split,
  trs.rollback_traffic_split,
  trs.last_updated,
  trs.updated_by,
  -- Calculate routing stability
  CASE 
    WHEN trs.current_traffic_split = trs.target_traffic_split THEN 'stable'
    WHEN trs.last_updated < NOW() - INTERVAL '5 minutes' THEN 'stale'
    ELSE 'transitioning'
  END as routing_status,
  -- Check if rollback routing is active
  CASE 
    WHEN trs.rollback_traffic_split IS NOT NULL 
         AND trs.rollback_traffic_split::text != '{}'::text THEN true
    ELSE false
  END as rollback_active
FROM traffic_routing_state trs
WHERE trs.environment = 'production'
ORDER BY trs.service_name;

-- System health overview
CREATE OR REPLACE VIEW system_health_overview AS
SELECT 
  shs.snapshot_timestamp,
  shs.overall_status,
  shs.service_health,
  shs.error_rates,
  shs.response_times,
  shs.active_alerts,
  shs.rollback_context,
  -- Health trend (compare with previous snapshot)
  LAG(shs.overall_status) OVER (ORDER BY shs.snapshot_timestamp) as previous_status,
  EXTRACT(EPOCH FROM (shs.snapshot_timestamp - LAG(shs.snapshot_timestamp) OVER (ORDER BY shs.snapshot_timestamp))) / 60 as minutes_since_last
FROM system_health_snapshots shs
WHERE shs.environment = 'production'
  AND shs.snapshot_timestamp > NOW() - INTERVAL '24 hours'
ORDER BY shs.snapshot_timestamp DESC;

-- Rollback audit trail
CREATE OR REPLACE VIEW rollback_audit_trail AS
SELECT 
  rr.id as request_id,
  rr.rollback_type,
  rr.rollback_target,
  rr.rollback_reason,
  rr.severity_level,
  rr.initiated_by,
  rr.created_at as requested_at,
  rr.approved_by,
  rr.approved_at,
  re.started_at as execution_started,
  re.completed_at as execution_completed,
  re.duration_minutes,
  re.error_budget_impact,
  re.status as final_status,
  -- Outcome summary
  CASE re.status
    WHEN 'completed' THEN 'SUCCESS'
    WHEN 'failed' THEN 'FAILED'
    WHEN 'cancelled' THEN 'CANCELLED'
    ELSE 'IN_PROGRESS'
  END as outcome,
  -- Total time from request to completion
  EXTRACT(EPOCH FROM (COALESCE(re.completed_at, NOW()) - rr.created_at)) / 60 as total_time_minutes
FROM rollback_requests rr
LEFT JOIN rollback_executions re ON rr.id = re.rollback_request_id
WHERE rr.environment = 'production'
ORDER BY rr.created_at DESC;

-- Insert initial system state
INSERT INTO system_state (key, value, description) VALUES
('maintenance_mode', '{"enabled": false, "reason": null, "timestamp": null}', 'System maintenance mode status'),
('emergency_contacts', '{"primary": "on-call-engineer", "secondary": "engineering-manager", "escalation": "cto"}', 'Emergency contact information'),
('rollback_settings', '{"max_parallel_rollbacks": 1, "auto_approval_critical": true, "max_execution_time_minutes": 30}', 'Rollback system configuration')
ON CONFLICT (key) DO NOTHING;

COMMIT;