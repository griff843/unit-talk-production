-- Phase 6: Agent Lifecycle and Retry State Management
-- Implements durable agent lifecycle controls and deterministic retry state

-- ============================================================================
-- 1. Agent Lifecycle State Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agent_lifecycle_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Agent identification
  agent_name TEXT NOT NULL UNIQUE,
  agent_type TEXT NOT NULL, -- 'grading', 'alert', 'notification', etc.

  -- Lifecycle state
  lifecycle_status TEXT NOT NULL CHECK (lifecycle_status IN ('stopped', 'starting', 'running', 'pausing', 'paused', 'resuming', 'stopping', 'error')),
  desired_status TEXT NOT NULL CHECK (desired_status IN ('stopped', 'running', 'paused')),

  -- State metadata
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  resumed_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,

  -- Control settings
  drain_on_pause BOOLEAN DEFAULT TRUE, -- Whether to finish in-flight work before pausing
  drain_timeout_seconds INTEGER DEFAULT 30,
  max_restart_attempts INTEGER DEFAULT 3,
  restart_count INTEGER DEFAULT 0,

  -- State reason
  status_reason TEXT,
  last_error TEXT,
  error_count INTEGER DEFAULT 0,

  -- Operational metadata
  version TEXT,
  config JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_lifecycle_agent_name ON public.agent_lifecycle_state(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_lifecycle_status ON public.agent_lifecycle_state(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_agent_lifecycle_heartbeat ON public.agent_lifecycle_state(last_heartbeat_at DESC);

-- ============================================================================
-- 2. Agent Retry State Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agent_retry_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Retry identification
  agent_name TEXT NOT NULL,
  operation_type TEXT NOT NULL, -- 'publish', 'grade', 'alert', etc.
  idempotency_key TEXT NOT NULL UNIQUE, -- Derived from stable fields (pick_id, operation, timestamp hash)

  -- Retry configuration
  max_attempts INTEGER NOT NULL DEFAULT 3,
  base_delay_ms INTEGER NOT NULL DEFAULT 1000,
  max_delay_ms INTEGER NOT NULL DEFAULT 60000,
  backoff_factor NUMERIC(3,2) NOT NULL DEFAULT 2.0,

  -- Retry state
  attempt_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  first_attempt_at TIMESTAMPTZ DEFAULT NOW(),

  -- Error classification
  error_type TEXT, -- 'retryable', 'non-retryable', 'fatal', 'transient'
  last_error TEXT,
  last_error_code TEXT,

  -- Operation context
  operation_data JSONB NOT NULL, -- Full context for retry
  result_data JSONB, -- Result when successful

  -- Status
  status TEXT NOT NULL CHECK (status IN ('pending', 'retrying', 'succeeded', 'failed', 'abandoned')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_retry_idempotency ON public.agent_retry_state(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_agent_retry_agent_status ON public.agent_retry_state(agent_name, status);
CREATE INDEX IF NOT EXISTS idx_agent_retry_next_retry ON public.agent_retry_state(next_retry_at) WHERE status = 'retrying';
CREATE INDEX IF NOT EXISTS idx_agent_retry_operation ON public.agent_retry_state(operation_type, status);

-- ============================================================================
-- 3. Autopilot Evidence Log (extends existing autopilot_decisions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.autopilot_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Evidence tracking
  decision_id UUID REFERENCES public.autopilot_decisions(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL, -- 'gate_evaluation', 'manual_override', 'system_check'

  -- Evidence data
  gate_name TEXT, -- Which promotion gate if applicable
  gate_passed BOOLEAN,
  gate_score NUMERIC(5,2),
  gate_threshold NUMERIC(5,2),
  gate_details JSONB,

  -- Context
  evaluator TEXT NOT NULL, -- 'autopilot_controller', 'manual_operator', 'system'
  evaluation_timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autopilot_evidence_decision ON public.autopilot_evidence(decision_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_evidence_type ON public.autopilot_evidence(evidence_type);
CREATE INDEX IF NOT EXISTS idx_autopilot_evidence_gate ON public.autopilot_evidence(gate_name, gate_passed);

-- ============================================================================
-- 4. Circuit Breaker Events Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.circuit_breaker_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Circuit breaker identification
  service_name TEXT NOT NULL, -- 'discord', 'supabase', 'openai', 'odds_api'
  agent_name TEXT, -- Which agent triggered the event

  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN ('opened', 'closed', 'half_open', 'failure', 'success')),
  failure_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,

  -- Circuit state snapshot
  state TEXT NOT NULL CHECK (state IN ('closed', 'open', 'half_open')),
  failure_threshold INTEGER,
  reset_timeout_ms INTEGER,

  -- Error context
  error_message TEXT,
  error_code TEXT,

  -- Timing
  occurred_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_circuit_breaker_service ON public.circuit_breaker_events(service_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_agent ON public.circuit_breaker_events(agent_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_event_type ON public.circuit_breaker_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_state ON public.circuit_breaker_events(state, service_name);

-- ============================================================================
-- 5. Unified Agent Health Metrics Schema (extends agent_health)
-- ============================================================================
-- Add columns to existing agent_health table for unified metrics
DO $$
BEGIN
  -- Add unified metrics columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_health' AND column_name = 'version') THEN
    ALTER TABLE public.agent_health ADD COLUMN version TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_health' AND column_name = 'last_success_at') THEN
    ALTER TABLE public.agent_health ADD COLUMN last_success_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_health' AND column_name = 'last_error_at') THEN
    ALTER TABLE public.agent_health ADD COLUMN last_error_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_health' AND column_name = 'run_count') THEN
    ALTER TABLE public.agent_health ADD COLUMN run_count BIGINT DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_health' AND column_name = 'success_count') THEN
    ALTER TABLE public.agent_health ADD COLUMN success_count BIGINT DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_health' AND column_name = 'failure_count') THEN
    ALTER TABLE public.agent_health ADD COLUMN failure_count BIGINT DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_health' AND column_name = 'retry_count') THEN
    ALTER TABLE public.agent_health ADD COLUMN retry_count BIGINT DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_health' AND column_name = 'backlog_size') THEN
    ALTER TABLE public.agent_health ADD COLUMN backlog_size INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_health' AND column_name = 'processing_lag_ms') THEN
    ALTER TABLE public.agent_health ADD COLUMN processing_lag_ms INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_health' AND column_name = 'p95_latency_ms') THEN
    ALTER TABLE public.agent_health ADD COLUMN p95_latency_ms INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_health' AND column_name = 'circuit_breaker_state') THEN
    ALTER TABLE public.agent_health ADD COLUMN circuit_breaker_state JSONB DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_health' AND column_name = 'autopilot_mode_snapshot') THEN
    ALTER TABLE public.agent_health ADD COLUMN autopilot_mode_snapshot TEXT;
  END IF;
END $$;

-- ============================================================================
-- 6. Helper Functions
-- ============================================================================

-- Function to update agent lifecycle state with heartbeat
CREATE OR REPLACE FUNCTION public.update_agent_heartbeat(
  p_agent_name TEXT,
  p_lifecycle_status TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.agent_lifecycle_state
  SET
    last_heartbeat_at = NOW(),
    lifecycle_status = COALESCE(p_lifecycle_status, lifecycle_status),
    last_error = CASE WHEN p_error_message IS NOT NULL THEN p_error_message ELSE last_error END,
    error_count = CASE WHEN p_error_message IS NOT NULL THEN error_count + 1 ELSE error_count END,
    updated_at = NOW()
  WHERE agent_name = p_agent_name;

  IF NOT FOUND THEN
    INSERT INTO public.agent_lifecycle_state (agent_name, agent_type, lifecycle_status, desired_status, last_heartbeat_at)
    VALUES (p_agent_name, 'unknown', COALESCE(p_lifecycle_status, 'stopped'), 'stopped', NOW());
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate next retry time with deterministic jitter
CREATE OR REPLACE FUNCTION public.calculate_next_retry(
  p_idempotency_key TEXT,
  p_attempt_count INTEGER,
  p_base_delay_ms INTEGER,
  p_max_delay_ms INTEGER,
  p_backoff_factor NUMERIC
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_delay_ms INTEGER;
  v_jitter_ms INTEGER;
  v_hash BIGINT;
BEGIN
  -- Calculate exponential backoff
  v_delay_ms := LEAST(p_base_delay_ms * POWER(p_backoff_factor, p_attempt_count), p_max_delay_ms);

  -- Deterministic jitter based on idempotency key hash (0-20% of delay)
  v_hash := ABS(('x' || MD5(p_idempotency_key))::bit(63)::bigint);
  v_jitter_ms := (v_delay_ms * 0.2 * (v_hash % 100) / 100)::INTEGER;

  -- Return next retry time
  RETURN NOW() + (v_delay_ms + v_jitter_ms || ' milliseconds')::INTERVAL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get agent health summary
CREATE OR REPLACE FUNCTION public.get_agent_health_summary()
RETURNS TABLE (
  total_agents BIGINT,
  healthy_agents BIGINT,
  warning_agents BIGINT,
  error_agents BIGINT,
  inactive_agents BIGINT,
  avg_success_rate NUMERIC,
  total_operations BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_agents,
    COUNT(*) FILTER (WHERE status = 'healthy')::BIGINT as healthy_agents,
    COUNT(*) FILTER (WHERE status = 'warning')::BIGINT as warning_agents,
    COUNT(*) FILTER (WHERE status = 'error')::BIGINT as error_agents,
    COUNT(*) FILTER (WHERE status = 'inactive')::BIGINT as inactive_agents,
    AVG(CASE WHEN success_count + failure_count > 0 THEN success_count::NUMERIC / (success_count + failure_count) ELSE 0 END) as avg_success_rate,
    SUM(run_count)::BIGINT as total_operations
  FROM public.agent_health;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Row Level Security
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE public.agent_lifecycle_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_retry_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autopilot_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuit_breaker_events ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to agent_lifecycle_state"
  ON public.agent_lifecycle_state FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to agent_retry_state"
  ON public.agent_retry_state FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to autopilot_evidence"
  ON public.autopilot_evidence FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to circuit_breaker_events"
  ON public.circuit_breaker_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 8. Grants
-- ============================================================================

GRANT ALL ON public.agent_lifecycle_state TO service_role;
GRANT ALL ON public.agent_retry_state TO service_role;
GRANT ALL ON public.autopilot_evidence TO service_role;
GRANT ALL ON public.circuit_breaker_events TO service_role;

-- ============================================================================
-- 9. Comments
-- ============================================================================

COMMENT ON TABLE public.agent_lifecycle_state IS 'Phase 6: Agent lifecycle state for start/stop/pause/resume controls';
COMMENT ON TABLE public.agent_retry_state IS 'Phase 6: Durable retry state with deterministic scheduling';
COMMENT ON TABLE public.autopilot_evidence IS 'Phase 6: Evidence logging for autopilot gate evaluations';
COMMENT ON TABLE public.circuit_breaker_events IS 'Phase 6: Circuit breaker event log for dependency tracking';

COMMENT ON FUNCTION public.update_agent_heartbeat IS 'Updates agent heartbeat and lifecycle status';
COMMENT ON FUNCTION public.calculate_next_retry IS 'Calculates next retry time with deterministic jitter';
COMMENT ON FUNCTION public.get_agent_health_summary IS 'Returns summary of all agent health metrics';
