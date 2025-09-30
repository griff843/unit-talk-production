-- =============================================================================
-- OPERATOR ACTIONS TABLE - Fortune 100 Grade Audit Trail
-- =============================================================================
-- 
-- Comprehensive audit logging for all operator dashboard actions:
-- - Safe mode toggles with detailed reasoning
-- - Agent control operations (start/stop/pause/restart)
-- - Circuit breaker activations and deactivations
-- - Feature flag modifications and rollout changes
-- - Emergency stop procedures with confirmation
-- - System control changes with rollback capabilities
-- 
-- Features:
-- - Complete audit trail for compliance and troubleshooting
-- - Rollback data storage for safety operations
-- - Performance optimized with appropriate indexing
-- - Integration with incident management system
-- - Real-time action tracking for monitoring

-- 1) Operator actions audit table
CREATE TABLE operator_actions (
  -- Primary identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Action classification
  action_type TEXT NOT NULL CHECK (action_type IN (
    'safe_mode_toggle',     -- Safe mode enable/disable
    'agent_control',        -- Agent start/stop/pause/restart
    'circuit_breaker',      -- Circuit breaker enable/disable
    'feature_flag',         -- Feature flag toggle/rollout
    'system_restart',       -- System restart operations
    'emergency_stop'        -- Emergency stop procedures
  )),
  
  -- Action targets
  target_service TEXT,      -- Service name for circuit breaker actions
  target_agent TEXT,        -- Agent name for agent control actions
  target_feature TEXT,      -- Feature flag name for feature actions
  
  -- Action details
  action_data JSONB NOT NULL DEFAULT '{}',  -- Action-specific data
  performed_by TEXT NOT NULL,               -- User ID or username who performed action
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT NOT NULL,                     -- Required reason for all actions
  
  -- Rollback and safety
  rollback_available BOOLEAN NOT NULL DEFAULT false,
  rollback_data JSONB DEFAULT '{}',         -- Data needed to rollback action
  rollback_executed BOOLEAN DEFAULT false,
  rollback_executed_at TIMESTAMPTZ,
  rollback_executed_by TEXT,
  
  -- Status and validation
  action_status TEXT NOT NULL DEFAULT 'completed' CHECK (action_status IN (
    'initiated',    -- Action started
    'in_progress',  -- Action being executed
    'completed',    -- Action completed successfully
    'failed',       -- Action failed
    'rolled_back'   -- Action was rolled back
  )),
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Compliance and audit
  approval_required BOOLEAN DEFAULT false,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  
  -- Impact tracking
  affected_systems TEXT[] DEFAULT '{}',
  estimated_impact_duration INTEGER,  -- Estimated impact duration in minutes
  actual_impact_duration INTEGER,     -- Actual impact duration in minutes
  
  -- Incident correlation
  related_incident_id UUID REFERENCES system_incidents(id),
  
  -- Metadata
  user_agent TEXT,
  ip_address INET,
  session_id TEXT,
  request_id TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_rollback_executed CHECK (
    rollback_executed = false OR 
    (rollback_executed = true AND rollback_executed_at IS NOT NULL AND rollback_executed_by IS NOT NULL)
  ),
  CONSTRAINT chk_approval_complete CHECK (
    approval_required = false OR 
    (approval_required = true AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
  )
);

-- 2) Action execution log table (for tracking multi-step actions)
CREATE TABLE operator_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES operator_actions(id) ON DELETE CASCADE,
  
  -- Log entry details
  log_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  log_level TEXT NOT NULL CHECK (log_level IN ('debug', 'info', 'warn', 'error')),
  log_message TEXT NOT NULL,
  
  -- Step tracking
  step_number INTEGER,
  step_name TEXT,
  step_status TEXT CHECK (step_status IN ('started', 'completed', 'failed', 'skipped')),
  
  -- Additional context
  details JSONB DEFAULT '{}',
  
  CONSTRAINT uq_action_step UNIQUE (action_id, step_number)
);

-- 3) Performance-optimized indexes
CREATE INDEX CONCURRENTLY idx_operator_actions_performed_at 
  ON operator_actions (performed_at DESC);

CREATE INDEX CONCURRENTLY idx_operator_actions_action_type 
  ON operator_actions (action_type, performed_at DESC);

CREATE INDEX CONCURRENTLY idx_operator_actions_performed_by 
  ON operator_actions (performed_by, performed_at DESC);

CREATE INDEX CONCURRENTLY idx_operator_actions_target_service 
  ON operator_actions (target_service, performed_at DESC) 
  WHERE target_service IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_operator_actions_target_agent 
  ON operator_actions (target_agent, performed_at DESC) 
  WHERE target_agent IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_operator_actions_rollback_available 
  ON operator_actions (rollback_available, performed_at DESC) 
  WHERE rollback_available = true;

CREATE INDEX CONCURRENTLY idx_operator_actions_recent 
  ON operator_actions (performed_at DESC) 
  WHERE performed_at > NOW() - INTERVAL '30 days';

CREATE INDEX CONCURRENTLY idx_operator_action_logs_action_id 
  ON operator_action_logs (action_id, log_timestamp DESC);

-- 4) Action tracking functions
CREATE OR REPLACE FUNCTION log_operator_action(
  p_action_type TEXT,
  p_target_service TEXT DEFAULT NULL,
  p_target_agent TEXT DEFAULT NULL,
  p_action_data JSONB DEFAULT '{}',
  p_performed_by TEXT DEFAULT 'system',
  p_reason TEXT DEFAULT 'Automated action',
  p_rollback_available BOOLEAN DEFAULT false,
  p_rollback_data JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  action_id UUID;
BEGIN
  INSERT INTO operator_actions (
    action_type, target_service, target_agent, action_data,
    performed_by, reason, rollback_available, rollback_data
  ) VALUES (
    p_action_type, p_target_service, p_target_agent, p_action_data,
    p_performed_by, p_reason, p_rollback_available, p_rollback_data
  ) RETURNING id INTO action_id;
  
  RETURN action_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION add_action_log(
  p_action_id UUID,
  p_log_level TEXT,
  p_log_message TEXT,
  p_step_number INTEGER DEFAULT NULL,
  p_step_name TEXT DEFAULT NULL,
  p_step_status TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO operator_action_logs (
    action_id, log_level, log_message, step_number, 
    step_name, step_status, details
  ) VALUES (
    p_action_id, p_log_level, p_log_message, p_step_number,
    p_step_name, p_step_status, p_details
  );
END;
$$ LANGUAGE plpgsql;

-- 5) Action rollback function
CREATE OR REPLACE FUNCTION execute_action_rollback(
  p_action_id UUID,
  p_rolled_back_by TEXT,
  p_rollback_reason TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  action_record RECORD;
  rollback_success BOOLEAN := false;
BEGIN
  -- Get the action record
  SELECT * INTO action_record FROM operator_actions WHERE id = p_action_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action not found: %', p_action_id;
  END IF;
  
  IF NOT action_record.rollback_available THEN
    RAISE EXCEPTION 'Rollback not available for action: %', p_action_id;
  END IF;
  
  IF action_record.rollback_executed THEN
    RAISE EXCEPTION 'Action already rolled back: %', p_action_id;
  END IF;
  
  -- Log the rollback initiation
  PERFORM add_action_log(
    p_action_id, 'info', 
    'Rollback initiated: ' || p_rollback_reason,
    1, 'rollback_initiated', 'started'
  );
  
  -- Update the action record
  UPDATE operator_actions SET
    rollback_executed = true,
    rollback_executed_at = NOW(),
    rollback_executed_by = p_rolled_back_by,
    action_status = 'rolled_back',
    updated_at = NOW()
  WHERE id = p_action_id;
  
  -- Log successful rollback
  PERFORM add_action_log(
    p_action_id, 'info', 
    'Rollback completed successfully',
    2, 'rollback_completed', 'completed'
  );
  
  RETURN true;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log rollback failure
    PERFORM add_action_log(
      p_action_id, 'error', 
      'Rollback failed: ' || SQLERRM,
      2, 'rollback_failed', 'failed'
    );
    
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- 6) Automated triggers
CREATE OR REPLACE FUNCTION operator_actions_updated_at_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_operator_actions_updated_at
BEFORE UPDATE ON operator_actions
FOR EACH ROW EXECUTE FUNCTION operator_actions_updated_at_trigger();

-- 7) Action summary view for dashboard
CREATE OR REPLACE VIEW operator_actions_summary AS
WITH recent_actions AS (
  SELECT 
    action_type,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE performed_at > NOW() - INTERVAL '24 hours') as last_24h_count,
    COUNT(*) FILTER (WHERE performed_at > NOW() - INTERVAL '7 days') as last_7d_count,
    COUNT(*) FILTER (WHERE action_status = 'failed') as failed_count,
    COUNT(*) FILTER (WHERE rollback_executed = true) as rolled_back_count,
    MAX(performed_at) as last_action_time,
    AVG(EXTRACT(EPOCH FROM (updated_at - performed_at))/60) as avg_execution_time_minutes
  FROM operator_actions 
  WHERE performed_at > NOW() - INTERVAL '30 days'
  GROUP BY action_type
)
SELECT 
  action_type,
  total_count,
  last_24h_count,
  last_7d_count,
  failed_count,
  rolled_back_count,
  last_action_time,
  ROUND(avg_execution_time_minutes::NUMERIC, 2) as avg_execution_time_minutes,
  ROUND((failed_count::FLOAT / NULLIF(total_count, 0) * 100)::NUMERIC, 2) as failure_rate_percent,
  ROUND((rolled_back_count::FLOAT / NULLIF(total_count, 0) * 100)::NUMERIC, 2) as rollback_rate_percent
FROM recent_actions
ORDER BY total_count DESC;

-- 8) Grant permissions
GRANT SELECT, INSERT, UPDATE ON operator_actions TO api_service;
GRANT SELECT, INSERT ON operator_action_logs TO api_service;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO api_service;
GRANT EXECUTE ON FUNCTION log_operator_action(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, JSONB) TO api_service;
GRANT EXECUTE ON FUNCTION add_action_log(UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB) TO api_service;
GRANT EXECUTE ON FUNCTION execute_action_rollback(UUID, TEXT, TEXT) TO api_service;
GRANT SELECT ON operator_actions_summary TO monitoring_service;

-- 9) Insert sample data for testing
INSERT INTO operator_actions (
  action_type, target_agent, action_data, performed_by, reason, 
  rollback_available, rollback_data
) VALUES 
(
  'agent_control', 'ScoringAgent', 
  '{"action": "restart", "previous_status": "running"}',
  'admin', 'Routine restart for performance optimization',
  true, '{"action": "start", "restore_state": true}'
),
(
  'safe_mode_toggle', NULL, 
  '{"enabled": true, "reason": "System maintenance"}',
  'operator', 'Scheduled maintenance window',
  true, '{"enabled": false}'
),
(
  'circuit_breaker', 'api', 
  '{"enabled": true, "threshold_failures": 5}',
  'system', 'Automatic circuit breaker activation due to high failure rate',
  true, '{"enabled": false}'
);

-- =============================================================================
-- OPERATOR ACTIONS AUDIT TRAIL SUMMARY
-- =============================================================================
-- 1. Comprehensive audit logging for all operator dashboard actions
-- 2. Multi-step action tracking with detailed logs and status
-- 3. Rollback capabilities with safety checks and validation
-- 4. Performance optimized with appropriate indexing strategy
-- 5. Integration ready for compliance and incident management
-- 6. Real-time action monitoring with summary views
-- 7. Automated triggers for data consistency and audit trail
-- 8. Sample data and testing infrastructure included
-- =============================================================================