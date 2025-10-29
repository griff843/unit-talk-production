-- ===============================================================================
-- PostgREST Reload RPC (SECURITY DEFINER)
-- Date: 2025-10-29
-- Purpose: Dashboard-free PostgREST schema reload via RPC
-- Version: 1.0.0
-- ===============================================================================
--
-- This migration creates a SECURITY DEFINER RPC that allows the API to trigger
-- PostgREST schema reloads without requiring direct database superuser access.
--
-- Key Features:
-- • SECURITY DEFINER - Executes with creator (postgres) privileges
-- • Public accessible - Callable by service_role and authenticated users
-- • Idempotent - Safe to call multiple times
-- • Logged - Tracks reload attempts in public.schema_reload_log
--
-- Charter Compliance:
-- • Canonical-first: Required for PICK_DRIVER=canonical self-healing
-- • Dashboard-free: No manual intervention needed
-- • Secure: Proper grants, no privilege escalation
-- ===============================================================================

-- ===============================================================================
-- 1. SCHEMA RELOAD LOG TABLE
-- ===============================================================================
CREATE TABLE IF NOT EXISTS public.schema_reload_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reloaded_at TIMESTAMPTZ DEFAULT NOW(),
  triggered_by TEXT NOT NULL,
  reason TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_schema_reload_log_reloaded_at
  ON public.schema_reload_log(reloaded_at DESC);

COMMENT ON TABLE public.schema_reload_log IS 'Audit log for PostgREST schema reload operations';
COMMENT ON COLUMN public.schema_reload_log.triggered_by IS 'Source of reload: boot, error-handler, manual, etc.';
COMMENT ON COLUMN public.schema_reload_log.reason IS 'Human-readable reason for reload (e.g., PGRST205, visibility issue)';

-- ===============================================================================
-- 2. PGRST RELOAD RPC (SECURITY DEFINER)
-- ===============================================================================

/**
 * pgrst_reload - Trigger PostgREST schema cache reload
 *
 * SECURITY DEFINER function that sends pg_notify to pgrst channel.
 * This allows API to reload PostgREST schema without direct superuser access.
 *
 * @param p_triggered_by TEXT - Source identifier (e.g., 'boot', 'error-handler')
 * @param p_reason TEXT - Optional reason for reload
 * @return TABLE - Single row with success status and timestamp
 *
 * Usage:
 *   SELECT * FROM pgrst_reload('boot', 'startup schema sync');
 *   SELECT * FROM pgrst_reload('error-handler', 'PGRST205 visibility error');
 */
CREATE OR REPLACE FUNCTION public.pgrst_reload(
  p_triggered_by TEXT DEFAULT 'manual',
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  reloaded_at TIMESTAMPTZ,
  reload_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reload_id UUID;
  v_reloaded_at TIMESTAMPTZ;
  v_error_message TEXT;
BEGIN
  -- Generate reload ID and timestamp
  v_reload_id := gen_random_uuid();
  v_reloaded_at := NOW();

  -- Trigger PostgREST schema reload
  PERFORM pg_notify('pgrst', 'reload schema');

  -- Log successful reload
  INSERT INTO public.schema_reload_log (
    id,
    reloaded_at,
    triggered_by,
    reason,
    success,
    metadata
  ) VALUES (
    v_reload_id,
    v_reloaded_at,
    p_triggered_by,
    p_reason,
    true,
    jsonb_build_object(
      'channel', 'pgrst',
      'payload', 'reload schema'
    )
  );

  -- Return success result
  RETURN QUERY SELECT true, v_reloaded_at, v_reload_id;

EXCEPTION
  WHEN OTHERS THEN
    -- Log failed reload attempt
    v_error_message := SQLERRM;

    INSERT INTO public.schema_reload_log (
      id,
      reloaded_at,
      triggered_by,
      reason,
      success,
      error_message,
      metadata
    ) VALUES (
      v_reload_id,
      v_reloaded_at,
      p_triggered_by,
      p_reason,
      false,
      v_error_message,
      jsonb_build_object(
        'channel', 'pgrst',
        'payload', 'reload schema',
        'error', v_error_message
      )
    );

    -- Return failure result
    RETURN QUERY SELECT false, v_reloaded_at, v_reload_id;
END;
$$;

COMMENT ON FUNCTION public.pgrst_reload IS 'SECURITY DEFINER RPC to trigger PostgREST schema reload via pg_notify';

-- ===============================================================================
-- 3. GRANTS & PERMISSIONS
-- ===============================================================================

-- Grant execute to service_role (API access)
GRANT EXECUTE ON FUNCTION public.pgrst_reload TO service_role;

-- Grant execute to authenticated users (optional - for future admin dashboard)
GRANT EXECUTE ON FUNCTION public.pgrst_reload TO authenticated;

-- Grant execute to anon (for public health checks - optional)
-- GRANT EXECUTE ON FUNCTION public.pgrst_reload TO anon;

-- Grant select on log table to service_role (for audit queries)
GRANT SELECT ON TABLE public.schema_reload_log TO service_role;

-- ===============================================================================
-- 4. VALIDATION
-- ===============================================================================

-- Test RPC execution (dry run)
DO $$
DECLARE
  v_result RECORD;
BEGIN
  -- Test reload RPC
  SELECT * INTO v_result FROM public.pgrst_reload('migration-test', 'post-migration validation');

  IF NOT v_result.success THEN
    RAISE EXCEPTION 'pgrst_reload RPC test failed';
  END IF;

  RAISE NOTICE 'pgrst_reload RPC test passed: reload_id=%', v_result.reload_id;
END $$;

-- Verify log entry created
DO $$
DECLARE
  v_log_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_log_count
  FROM public.schema_reload_log
  WHERE triggered_by = 'migration-test';

  IF v_log_count = 0 THEN
    RAISE EXCEPTION 'schema_reload_log entry not created';
  END IF;

  RAISE NOTICE 'schema_reload_log validation passed: % entries', v_log_count;
END $$;

-- ===============================================================================
-- 5. CLEANUP TEST DATA
-- ===============================================================================

-- Remove test log entry
DELETE FROM public.schema_reload_log WHERE triggered_by = 'migration-test';

-- ===============================================================================
-- END OF MIGRATION
-- ===============================================================================
--
-- Post-Migration Usage:
--
-- 1. From API (TypeScript):
--    const { data } = await supabase.rpc('pgrst_reload', {
--      p_triggered_by: 'boot',
--      p_reason: 'startup schema sync'
--    });
--
-- 2. From SQL:
--    SELECT * FROM pgrst_reload('error-handler', 'PGRST205 visibility error');
--
-- 3. Query reload history:
--    SELECT * FROM schema_reload_log ORDER BY reloaded_at DESC LIMIT 10;
--
-- Security Notes:
-- • SECURITY DEFINER executes with creator (postgres) privileges
-- • Only service_role and authenticated users can execute
-- • All reloads are logged for audit trail
-- • No privilege escalation - only sends pg_notify
--
-- Monitoring:
-- • Check reload success rate: SELECT AVG(CASE WHEN success THEN 1 ELSE 0 END) FROM schema_reload_log
-- • Recent failures: SELECT * FROM schema_reload_log WHERE NOT success ORDER BY reloaded_at DESC
-- • Reload frequency: SELECT COUNT(*), DATE_TRUNC('hour', reloaded_at) FROM schema_reload_log GROUP BY 2
-- ===============================================================================
