-- Phase 6.5: Autopilot Guard Infrastructure
-- Date: 2026-01-18
-- Purpose: Enable unified side-effect control plane with evidence logging
--
-- This migration adds:
-- 1. Enhanced autopilot_decisions table for evidence logging
-- 2. workflow_registry table for runtime workflow tracking
-- 3. Helper functions for workflow management
--
-- IMPORTANT: Run this AFTER existing migrations are applied

-- ============================================================================
-- 1. Create/Enhance autopilot_decisions table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.autopilot_decisions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,

  -- Action context
  action_type text NOT NULL,
  context_hash text NOT NULL,
  agent_name text NOT NULL,

  -- Correlation
  correlation_id text,
  run_id text,
  pick_id text,

  -- Decision outcome
  decision text NOT NULL CHECK (decision IN ('ALLOW', 'REJECT', 'UNKNOWN')),
  mode text NOT NULL CHECK (mode IN ('off', 'log_only', 'canary', 'prod')),
  reason text NOT NULL,

  -- Gate snapshot for debugging/replay
  gate_snapshot_json jsonb DEFAULT '{}'::jsonb
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_autopilot_decisions_created_at
  ON public.autopilot_decisions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_autopilot_decisions_action_type
  ON public.autopilot_decisions (action_type);

CREATE INDEX IF NOT EXISTS idx_autopilot_decisions_agent_name
  ON public.autopilot_decisions (agent_name);

CREATE INDEX IF NOT EXISTS idx_autopilot_decisions_pick_id
  ON public.autopilot_decisions (pick_id)
  WHERE pick_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_autopilot_decisions_decision
  ON public.autopilot_decisions (decision);

CREATE INDEX IF NOT EXISTS idx_autopilot_decisions_context_hash
  ON public.autopilot_decisions (context_hash);

-- Comment on table
COMMENT ON TABLE public.autopilot_decisions IS
'Evidence log for all side-effect decisions made by AutopilotGuard. Every Discord post, notification, etc. is logged here with full context for audit/debugging.';

-- ============================================================================
-- 2. Create workflow_registry table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.workflow_registry (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id text UNIQUE NOT NULL,
  run_id text NOT NULL,
  agent_name text NOT NULL,
  workflow_type text NOT NULL,
  task_queue text,

  -- Status tracking
  status text NOT NULL DEFAULT 'starting'
    CHECK (status IN ('starting', 'running', 'paused', 'stopping', 'completed', 'failed', 'terminated', 'stale')),

  -- Timestamps
  started_at timestamptz DEFAULT now() NOT NULL,
  stopped_at timestamptz,
  last_heartbeat timestamptz DEFAULT now() NOT NULL,

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_workflow_registry_agent_name
  ON public.workflow_registry (agent_name);

CREATE INDEX IF NOT EXISTS idx_workflow_registry_status
  ON public.workflow_registry (status);

CREATE INDEX IF NOT EXISTS idx_workflow_registry_last_heartbeat
  ON public.workflow_registry (last_heartbeat);

CREATE INDEX IF NOT EXISTS idx_workflow_registry_workflow_type
  ON public.workflow_registry (workflow_type);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_workflow_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workflow_registry_updated_at ON public.workflow_registry;
CREATE TRIGGER workflow_registry_updated_at
  BEFORE UPDATE ON public.workflow_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_registry_updated_at();

-- Comment on table
COMMENT ON TABLE public.workflow_registry IS
'Runtime registry of managed Temporal workflows. Maps agent_name → workflow_id for control plane operations.';

-- ============================================================================
-- 3. Helper functions for workflow management
-- ============================================================================

-- Register a new workflow
CREATE OR REPLACE FUNCTION register_workflow(
  p_workflow_id text,
  p_run_id text,
  p_agent_name text,
  p_workflow_type text,
  p_task_queue text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.workflow_registry (
    workflow_id, run_id, agent_name, workflow_type, task_queue,
    status, last_heartbeat, metadata
  )
  VALUES (
    p_workflow_id, p_run_id, p_agent_name, p_workflow_type, p_task_queue,
    'running', now(), p_metadata
  )
  ON CONFLICT (workflow_id) DO UPDATE SET
    run_id = EXCLUDED.run_id,
    status = 'running',
    last_heartbeat = now(),
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION register_workflow IS
'Registers a new workflow or updates existing one. Returns workflow registry ID.';

-- Send heartbeat for a workflow
CREATE OR REPLACE FUNCTION workflow_heartbeat(p_workflow_id text)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.workflow_registry
  SET last_heartbeat = now(),
      status = CASE WHEN status = 'stale' THEN 'running' ELSE status END
  WHERE workflow_id = p_workflow_id;
END;
$$;

COMMENT ON FUNCTION workflow_heartbeat IS
'Updates last_heartbeat for a workflow. Automatically recovers from stale status.';

-- Unregister a workflow
CREATE OR REPLACE FUNCTION unregister_workflow(
  p_workflow_id text,
  p_status text DEFAULT 'completed'
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.workflow_registry
  SET status = p_status,
      stopped_at = now(),
      last_heartbeat = now()
  WHERE workflow_id = p_workflow_id;
END;
$$;

COMMENT ON FUNCTION unregister_workflow IS
'Marks a workflow as stopped with final status.';

-- Reconcile stale workflows
CREATE OR REPLACE FUNCTION reconcile_workflow_registry(p_stale_threshold_seconds int DEFAULT 120)
RETURNS TABLE (
  stale_count int,
  stale_workflows text[]
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_stale_ids text[];
  v_cutoff timestamptz;
BEGIN
  v_cutoff := now() - (p_stale_threshold_seconds || ' seconds')::interval;

  -- Get stale workflows
  SELECT array_agg(workflow_id) INTO v_stale_ids
  FROM public.workflow_registry
  WHERE status IN ('running', 'starting', 'paused')
    AND last_heartbeat < v_cutoff;

  -- Mark as stale
  IF v_stale_ids IS NOT NULL AND array_length(v_stale_ids, 1) > 0 THEN
    UPDATE public.workflow_registry
    SET status = 'stale'
    WHERE workflow_id = ANY(v_stale_ids);
  END IF;

  RETURN QUERY SELECT
    COALESCE(array_length(v_stale_ids, 1), 0),
    COALESCE(v_stale_ids, ARRAY[]::text[]);
END;
$$;

COMMENT ON FUNCTION reconcile_workflow_registry IS
'Marks workflows as stale if no heartbeat received within threshold.';

-- Get managed workflows
CREATE OR REPLACE FUNCTION get_managed_workflows(
  p_agent_name text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS SETOF public.workflow_registry
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.workflow_registry wr
  WHERE (p_agent_name IS NULL OR wr.agent_name = p_agent_name)
    AND (p_status IS NULL OR wr.status = p_status)
  ORDER BY wr.started_at DESC;
END;
$$;

COMMENT ON FUNCTION get_managed_workflows IS
'Returns managed workflows with optional filtering by agent_name and status.';

-- ============================================================================
-- 4. Grant permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON public.autopilot_decisions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_registry TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION register_workflow TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION workflow_heartbeat TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION unregister_workflow TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION reconcile_workflow_registry TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_managed_workflows TO authenticated, service_role;

-- ============================================================================
-- 5. Reload PostgREST schema cache
-- ============================================================================
NOTIFY pgrst, 'reload schema';
