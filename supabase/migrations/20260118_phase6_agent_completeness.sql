-- Phase 6: Agent Control Plane Completeness
-- Date: 2026-01-18
-- Purpose: Real enforcement layer for agent lifecycle control

-- ===============================================================================
-- 1. AGENT REGISTRY: Central source of truth for agent desired/current state
-- ===============================================================================
CREATE TABLE IF NOT EXISTS agent_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT UNIQUE NOT NULL,
  agent_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,

  -- Lifecycle state management
  desired_state TEXT NOT NULL DEFAULT 'running' CHECK (desired_state IN ('stopped', 'running', 'paused', 'draining', 'killed')),
  current_state TEXT NOT NULL DEFAULT 'stopped' CHECK (current_state IN ('stopped', 'starting', 'running', 'pausing', 'paused', 'resuming', 'stopping', 'draining', 'error', 'killed')),

  -- Heartbeat tracking
  last_heartbeat TIMESTAMPTZ,
  heartbeat_interval_ms INTEGER DEFAULT 10000,
  heartbeat_timeout_ms INTEGER DEFAULT 30000,

  -- Metadata
  config JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  state_changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_registry_agent_id ON agent_registry(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_registry_state ON agent_registry(desired_state, current_state);
CREATE INDEX IF NOT EXISTS idx_agent_registry_heartbeat ON agent_registry(last_heartbeat DESC);

-- ===============================================================================
-- 2. AGENT LIFECYCLE EVENTS: Audit trail for all state transitions
-- ===============================================================================
CREATE TABLE IF NOT EXISTS agent_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agent_registry(agent_id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN (
    'registered', 'started', 'stopped', 'paused', 'resumed',
    'heartbeat', 'heartbeat_missed', 'error', 'killed',
    'state_change_requested', 'state_change_confirmed', 'drain_started', 'drain_completed'
  )),

  -- State transition tracking
  previous_state TEXT,
  new_state TEXT,
  requested_by TEXT, -- User/system that requested the change

  -- Context
  correlation_id TEXT,
  reason TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_events_agent ON agent_lifecycle_events(agent_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_type ON agent_lifecycle_events(event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_correlation ON agent_lifecycle_events(correlation_id);

-- ===============================================================================
-- 3. AGENT METRICS SNAPSHOTS: Time-series metrics for observability
-- ===============================================================================
CREATE TABLE IF NOT EXISTS agent_metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agent_registry(agent_id) ON DELETE CASCADE,

  -- Core metrics
  run_count BIGINT DEFAULT 0,
  success_count BIGINT DEFAULT 0,
  failure_count BIGINT DEFAULT 0,

  -- Latency metrics
  avg_latency_ms DOUBLE PRECISION,
  p50_latency_ms DOUBLE PRECISION,
  p95_latency_ms DOUBLE PRECISION,
  p99_latency_ms DOUBLE PRECISION,

  -- Workload metrics
  backlog_size INTEGER DEFAULT 0,
  events_processed INTEGER DEFAULT 0,
  events_failed INTEGER DEFAULT 0,

  -- Resource metrics
  memory_usage_mb DOUBLE PRECISION,
  cpu_usage_percent DOUBLE PRECISION,

  -- Timestamp
  collected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_agent_time ON agent_metrics_snapshots(agent_id, collected_at DESC);

-- Partition by time for efficient queries (30-day retention)
-- Note: In production, set up time-based partitioning

-- ===============================================================================
-- 4. KILL CONFIRMATION TOKENS: Time-bound authorization for kill operations
-- ===============================================================================
CREATE TABLE IF NOT EXISTS kill_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agent_registry(agent_id) ON DELETE CASCADE,

  -- Token management
  confirmation_token TEXT UNIQUE NOT NULL,
  requested_by TEXT NOT NULL,
  reason TEXT NOT NULL,

  -- Time bounds
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_kill_confirmations_agent ON kill_confirmations(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_kill_confirmations_token ON kill_confirmations(confirmation_token) WHERE status = 'pending';

-- ===============================================================================
-- 5. FUNCTIONS: Agent control plane operations
-- ===============================================================================

-- Function to update agent heartbeat (callable from workers)
CREATE OR REPLACE FUNCTION update_agent_heartbeat(
  p_agent_id TEXT,
  p_current_state TEXT DEFAULT 'running',
  p_metrics JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent RECORD;
  v_should_stop BOOLEAN := FALSE;
  v_response JSONB;
BEGIN
  -- Upsert agent registry
  INSERT INTO agent_registry (agent_id, agent_type, display_name, current_state, last_heartbeat)
  VALUES (p_agent_id, 'worker', p_agent_id, p_current_state, NOW())
  ON CONFLICT (agent_id) DO UPDATE SET
    current_state = EXCLUDED.current_state,
    last_heartbeat = NOW(),
    updated_at = NOW()
  RETURNING * INTO v_agent;

  -- Check if agent should stop/pause
  IF v_agent.desired_state IN ('stopped', 'paused', 'draining', 'killed') THEN
    v_should_stop := TRUE;
  END IF;

  -- Record heartbeat event
  INSERT INTO agent_lifecycle_events (agent_id, event_type, new_state, metadata)
  VALUES (p_agent_id, 'heartbeat', p_current_state, p_metrics);

  -- Record metrics snapshot if provided
  IF p_metrics IS NOT NULL AND p_metrics != '{}' THEN
    INSERT INTO agent_metrics_snapshots (
      agent_id,
      run_count,
      success_count,
      failure_count,
      avg_latency_ms,
      backlog_size,
      events_processed,
      memory_usage_mb
    )
    VALUES (
      p_agent_id,
      COALESCE((p_metrics->>'run_count')::BIGINT, 0),
      COALESCE((p_metrics->>'success_count')::BIGINT, 0),
      COALESCE((p_metrics->>'failure_count')::BIGINT, 0),
      (p_metrics->>'avg_latency_ms')::DOUBLE PRECISION,
      COALESCE((p_metrics->>'backlog_size')::INTEGER, 0),
      COALESCE((p_metrics->>'events_processed')::INTEGER, 0),
      (p_metrics->>'memory_usage_mb')::DOUBLE PRECISION
    );
  END IF;

  -- Build response with control instructions
  v_response := jsonb_build_object(
    'should_process', NOT v_should_stop,
    'desired_state', v_agent.desired_state,
    'current_state', v_agent.current_state,
    'heartbeat_recorded', TRUE,
    'timestamp', NOW()
  );

  RETURN v_response;
END;
$$;

-- Function to request agent state change (with RBAC)
CREATE OR REPLACE FUNCTION request_agent_state_change(
  p_agent_id TEXT,
  p_desired_state TEXT,
  p_requested_by TEXT,
  p_reason TEXT DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent RECORD;
  v_previous_state TEXT;
BEGIN
  -- Get current agent state
  SELECT * INTO v_agent FROM agent_registry WHERE agent_id = p_agent_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Agent not found');
  END IF;

  v_previous_state := v_agent.desired_state;

  -- Validate state transition
  IF p_desired_state = 'killed' THEN
    -- Kill requires confirmation token
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Kill requires confirmation token',
      'action_required', 'create_kill_confirmation'
    );
  END IF;

  -- Update desired state
  UPDATE agent_registry
  SET
    desired_state = p_desired_state,
    state_changed_at = NOW(),
    updated_at = NOW()
  WHERE agent_id = p_agent_id;

  -- Record lifecycle event
  INSERT INTO agent_lifecycle_events (
    agent_id, event_type, previous_state, new_state,
    requested_by, reason, correlation_id
  )
  VALUES (
    p_agent_id, 'state_change_requested', v_previous_state, p_desired_state,
    p_requested_by, p_reason, p_correlation_id
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'agent_id', p_agent_id,
    'previous_state', v_previous_state,
    'new_state', p_desired_state,
    'timestamp', NOW()
  );
END;
$$;

-- Function to create kill confirmation token
CREATE OR REPLACE FUNCTION create_kill_confirmation(
  p_agent_id TEXT,
  p_requested_by TEXT,
  p_reason TEXT,
  p_validity_seconds INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Generate secure token
  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires_at := NOW() + (p_validity_seconds || ' seconds')::INTERVAL;

  -- Cancel any existing pending confirmations
  UPDATE kill_confirmations
  SET status = 'cancelled'
  WHERE agent_id = p_agent_id AND status = 'pending';

  -- Create new confirmation
  INSERT INTO kill_confirmations (
    agent_id, confirmation_token, requested_by, reason, expires_at
  )
  VALUES (
    p_agent_id, v_token, p_requested_by, p_reason, v_expires_at
  );

  -- Record lifecycle event
  INSERT INTO agent_lifecycle_events (
    agent_id, event_type, requested_by, reason,
    metadata
  )
  VALUES (
    p_agent_id, 'state_change_requested', p_requested_by, p_reason,
    jsonb_build_object('action', 'kill', 'expires_at', v_expires_at)
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'confirmation_token', v_token,
    'expires_at', v_expires_at,
    'agent_id', p_agent_id,
    'message', 'Confirm kill within ' || p_validity_seconds || ' seconds'
  );
END;
$$;

-- Function to confirm kill operation
CREATE OR REPLACE FUNCTION confirm_agent_kill(
  p_confirmation_token TEXT,
  p_confirmed_by TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmation RECORD;
BEGIN
  -- Find and validate confirmation
  SELECT * INTO v_confirmation
  FROM kill_confirmations
  WHERE confirmation_token = p_confirmation_token
    AND status = 'pending'
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Invalid or expired confirmation token'
    );
  END IF;

  -- Mark confirmation as confirmed
  UPDATE kill_confirmations
  SET status = 'confirmed', confirmed_at = NOW()
  WHERE id = v_confirmation.id;

  -- Update agent to killed state
  UPDATE agent_registry
  SET
    desired_state = 'killed',
    current_state = 'killed',
    state_changed_at = NOW(),
    updated_at = NOW()
  WHERE agent_id = v_confirmation.agent_id;

  -- Record lifecycle event
  INSERT INTO agent_lifecycle_events (
    agent_id, event_type, previous_state, new_state,
    requested_by, reason
  )
  VALUES (
    v_confirmation.agent_id, 'killed',
    (SELECT current_state FROM agent_registry WHERE agent_id = v_confirmation.agent_id),
    'killed',
    p_confirmed_by,
    v_confirmation.reason
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'agent_id', v_confirmation.agent_id,
    'killed_at', NOW()
  );
END;
$$;

-- Function to get agent control status (for workers to check)
CREATE OR REPLACE FUNCTION get_agent_control_status(p_agent_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent RECORD;
  v_system_status RECORD;
  v_should_process BOOLEAN := TRUE;
BEGIN
  -- Get agent state
  SELECT * INTO v_agent FROM agent_registry WHERE agent_id = p_agent_id;

  IF NOT FOUND THEN
    -- Auto-register new agent
    INSERT INTO agent_registry (agent_id, agent_type, display_name, desired_state, current_state)
    VALUES (p_agent_id, 'worker', p_agent_id, 'running', 'running')
    RETURNING * INTO v_agent;

    INSERT INTO agent_lifecycle_events (agent_id, event_type, new_state)
    VALUES (p_agent_id, 'registered', 'running');
  END IF;

  -- Check system-wide freeze gates
  SELECT * INTO v_system_status FROM system_status LIMIT 1;
  IF FOUND AND (v_system_status.emergency_stop = TRUE OR v_system_status.maintenance_mode = TRUE) THEN
    v_should_process := FALSE;
  END IF;

  -- Check agent-specific state
  IF v_agent.desired_state NOT IN ('running') THEN
    v_should_process := FALSE;
  END IF;

  RETURN jsonb_build_object(
    'should_process', v_should_process,
    'desired_state', v_agent.desired_state,
    'current_state', v_agent.current_state,
    'system_freeze', (v_system_status.emergency_stop IS TRUE OR v_system_status.maintenance_mode IS TRUE),
    'last_heartbeat', v_agent.last_heartbeat,
    'heartbeat_timeout_ms', v_agent.heartbeat_timeout_ms
  );
END;
$$;

-- ===============================================================================
-- 6. CLEANUP: Expire old confirmations
-- ===============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_confirmations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE kill_confirmations
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ===============================================================================
-- 7. GRANTS: Ensure service role can execute functions
-- ===============================================================================
GRANT EXECUTE ON FUNCTION update_agent_heartbeat TO service_role;
GRANT EXECUTE ON FUNCTION request_agent_state_change TO service_role;
GRANT EXECUTE ON FUNCTION create_kill_confirmation TO service_role;
GRANT EXECUTE ON FUNCTION confirm_agent_kill TO service_role;
GRANT EXECUTE ON FUNCTION get_agent_control_status TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_confirmations TO service_role;

-- Grant table access to service role
GRANT SELECT, INSERT, UPDATE ON agent_registry TO service_role;
GRANT SELECT, INSERT ON agent_lifecycle_events TO service_role;
GRANT SELECT, INSERT ON agent_metrics_snapshots TO service_role;
GRANT SELECT, INSERT, UPDATE ON kill_confirmations TO service_role;

-- ===============================================================================
-- 8. COMMENTS
-- ===============================================================================
COMMENT ON TABLE agent_registry IS 'Central registry for all agent instances with lifecycle state management';
COMMENT ON TABLE agent_lifecycle_events IS 'Audit trail for all agent lifecycle events and state transitions';
COMMENT ON TABLE agent_metrics_snapshots IS 'Time-series metrics snapshots for agent observability';
COMMENT ON TABLE kill_confirmations IS 'Time-bound authorization tokens for kill operations';
COMMENT ON FUNCTION update_agent_heartbeat IS 'Called by workers to report heartbeat and receive control instructions';
COMMENT ON FUNCTION get_agent_control_status IS 'Called by workers to check if they should process work';
