-- ============================================================================
-- PRODUCTION SECURITY ENABLEMENT - 2025-01-28
-- ============================================================================
-- Enables RLS, rate limiting, and security policies for canonical picks
-- Run this AFTER canonical convergence migration and validation
-- ============================================================================

\echo '🔒 Enabling Production Security Features...'
\echo ''

-- ============================================================================
-- PHASE 1: ENABLE ROW LEVEL SECURITY
-- ============================================================================

\echo '🔒 Phase 1: Enabling Row Level Security...'

-- Enable RLS on picks table
ALTER TABLE public.picks ENABLE ROW LEVEL SECURITY;
\echo '✅ RLS enabled on picks table'

-- Enable RLS on pick_publish table
ALTER TABLE public.pick_publish ENABLE ROW LEVEL SECURITY;
\echo '✅ RLS enabled on pick_publish table'

-- Verify RLS is enabled
DO $$
DECLARE
  v_picks_rls boolean;
  v_publish_rls boolean;
BEGIN
  SELECT relrowsecurity INTO v_picks_rls 
  FROM pg_class 
  WHERE relname = 'picks' AND relnamespace = 'public'::regnamespace;
  
  SELECT relrowsecurity INTO v_publish_rls 
  FROM pg_class 
  WHERE relname = 'pick_publish' AND relnamespace = 'public'::regnamespace;
  
  IF v_picks_rls AND v_publish_rls THEN
    RAISE NOTICE '✅ RLS verification passed';
  ELSE
    RAISE EXCEPTION '❌ RLS verification failed';
  END IF;
END $$;

\echo ''

-- ============================================================================
-- PHASE 2: CREATE AUDIT LOG TABLE
-- ============================================================================

\echo '📝 Phase 2: Creating Audit Log Table...'

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  actor_id uuid,
  actor_type text NOT NULL DEFAULT 'user',
  old_values jsonb,
  new_values jsonb,
  metadata jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON public.audit_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_event ON public.audit_log (event_type, created_at DESC);

\echo '✅ Audit log table created'

-- Enable RLS on audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Create audit log policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_log' AND policyname='audit_log_tenant_isolation'
  ) THEN
    CREATE POLICY audit_log_tenant_isolation ON public.audit_log
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    RAISE NOTICE 'Created RLS policy: audit_log_tenant_isolation';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_log' AND policyname='audit_log_service_role_bypass'
  ) THEN
    CREATE POLICY audit_log_service_role_bypass ON public.audit_log
      FOR ALL
      USING (current_setting('role', true) = 'service_role');
    RAISE NOTICE 'Created RLS policy: audit_log_service_role_bypass';
  END IF;
END $$;

\echo '✅ Audit log RLS policies created'
\echo ''

-- ============================================================================
-- PHASE 3: CREATE RATE LIMITING TABLE
-- ============================================================================

\echo '⏱️  Phase 3: Creating Rate Limiting Table...'

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,  -- IP address or user ID
  endpoint text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (identifier, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON public.rate_limits (identifier, endpoint, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup ON public.rate_limits (window_start) WHERE window_start < now() - interval '1 hour';

\echo '✅ Rate limiting table created'
\echo ''

-- ============================================================================
-- PHASE 4: CREATE CIRCUIT BREAKER STATE TABLE
-- ============================================================================

\echo '⚡ Phase 4: Creating Circuit Breaker State Table...'

CREATE TABLE IF NOT EXISTS public.circuit_breaker_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL UNIQUE,
  state text NOT NULL CHECK (state IN ('CLOSED','OPEN','HALF_OPEN')),
  failure_count int NOT NULL DEFAULT 0,
  success_count int NOT NULL DEFAULT 0,
  last_failure_at timestamptz,
  last_success_at timestamptz,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_circuit_breaker_service ON public.circuit_breaker_state (service_name);
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_state ON public.circuit_breaker_state (state) WHERE state = 'OPEN';

\echo '✅ Circuit breaker state table created'
\echo ''

-- ============================================================================
-- PHASE 5: CREATE SECURITY FUNCTIONS
-- ============================================================================

\echo '🛠️  Phase 5: Creating Security Functions...'

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  p_tenant_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_actor_id uuid DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_audit_id uuid;
BEGIN
  INSERT INTO public.audit_log (
    tenant_id,
    event_type,
    entity_type,
    entity_id,
    actor_id,
    old_values,
    new_values,
    metadata
  ) VALUES (
    p_tenant_id,
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_actor_id,
    p_old_values,
    p_new_values,
    p_metadata
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

\echo '✅ log_audit_event function created'

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier text,
  p_endpoint text,
  p_max_requests int,
  p_window_seconds int
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_window_start timestamptz;
  v_current_count int;
BEGIN
  v_window_start := date_trunc('minute', now()) - (extract(epoch from now())::int % p_window_seconds) * interval '1 second';
  
  -- Get current count for this window
  SELECT request_count INTO v_current_count
  FROM public.rate_limits
  WHERE identifier = p_identifier
    AND endpoint = p_endpoint
    AND window_start = v_window_start;
  
  IF v_current_count IS NULL THEN
    -- First request in this window
    INSERT INTO public.rate_limits (identifier, endpoint, window_start, request_count)
    VALUES (p_identifier, p_endpoint, v_window_start, 1)
    ON CONFLICT (identifier, endpoint, window_start) 
    DO UPDATE SET request_count = rate_limits.request_count + 1, updated_at = now();
    
    RETURN true;
  ELSIF v_current_count < p_max_requests THEN
    -- Within limit
    UPDATE public.rate_limits
    SET request_count = request_count + 1, updated_at = now()
    WHERE identifier = p_identifier
      AND endpoint = p_endpoint
      AND window_start = v_window_start;
    
    RETURN true;
  ELSE
    -- Rate limit exceeded
    RETURN false;
  END IF;
END;
$$;

\echo '✅ check_rate_limit function created'

-- Function to update circuit breaker state
CREATE OR REPLACE FUNCTION update_circuit_breaker(
  p_service_name text,
  p_success boolean
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_state text;
  v_failure_count int;
BEGIN
  -- Get current state
  SELECT state, failure_count INTO v_current_state, v_failure_count
  FROM public.circuit_breaker_state
  WHERE service_name = p_service_name;
  
  IF NOT FOUND THEN
    -- Initialize circuit breaker
    INSERT INTO public.circuit_breaker_state (service_name, state, failure_count, success_count)
    VALUES (p_service_name, 'CLOSED', CASE WHEN p_success THEN 0 ELSE 1 END, CASE WHEN p_success THEN 1 ELSE 0 END);
    RETURN;
  END IF;
  
  IF p_success THEN
    -- Success - reset failure count, potentially close circuit
    UPDATE public.circuit_breaker_state
    SET 
      success_count = success_count + 1,
      failure_count = 0,
      last_success_at = now(),
      state = CASE 
        WHEN state = 'HALF_OPEN' AND success_count >= 2 THEN 'CLOSED'
        ELSE state
      END,
      updated_at = now()
    WHERE service_name = p_service_name;
  ELSE
    -- Failure - increment failure count, potentially open circuit
    UPDATE public.circuit_breaker_state
    SET 
      failure_count = failure_count + 1,
      last_failure_at = now(),
      state = CASE 
        WHEN failure_count + 1 >= 5 THEN 'OPEN'
        ELSE state
      END,
      next_retry_at = CASE 
        WHEN failure_count + 1 >= 5 THEN now() + interval '1 minute'
        ELSE next_retry_at
      END,
      updated_at = now()
    WHERE service_name = p_service_name;
  END IF;
END;
$$;

\echo '✅ update_circuit_breaker function created'
\echo ''

-- ============================================================================
-- PHASE 6: CREATE CLEANUP JOBS
-- ============================================================================

\echo '🧹 Phase 6: Creating Cleanup Jobs...'

-- Function to cleanup old rate limit records
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '1 hour';
END;
$$;

\echo '✅ cleanup_rate_limits function created'

-- Function to cleanup old audit logs (optional - keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_audit_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.audit_log
  WHERE created_at < now() - interval '90 days';
END;
$$;

\echo '✅ cleanup_audit_logs function created'
\echo ''

-- ============================================================================
-- SECURITY ENABLEMENT COMPLETE
-- ============================================================================

\echo '========================================='
\echo '✅ PRODUCTION SECURITY ENABLED'
\echo '========================================='
\echo ''
\echo 'Summary:'
\echo '  ✓ RLS enabled on picks, pick_publish, audit_log'
\echo '  ✓ Audit log table created with policies'
\echo '  ✓ Rate limiting table and functions created'
\echo '  ✓ Circuit breaker state tracking created'
\echo '  ✓ Security helper functions created'
\echo '  ✓ Cleanup jobs configured'
\echo ''
\echo 'Next Steps:'
\echo '  1. Configure application rate limits in .env'
\echo '  2. Setup cron job for cleanup functions'
\echo '  3. Monitor audit_log for security events'
\echo '  4. Configure circuit breaker thresholds'
\echo ''

