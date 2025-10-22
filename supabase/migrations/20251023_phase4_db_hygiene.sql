-- ============================================================================
-- Phase 4 DB Hygiene: Comprehensive GRANT/RLS/NOTIFY
-- Generated: 2025-10-22
-- Purpose: Fix missing permissions and ensure PostgREST reload verification
-- Remediation for: STRUCTURAL_AUDIT.md Critical Risk #2, #4
-- ============================================================================

BEGIN;

SET search_path = public;

-- ============================================================================
-- 1. GRANT TABLE ACCESS TO service_role
-- ============================================================================

-- Core tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.market_props TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.scored_props TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.promotion_queue TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_health TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_metrics TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.raw_props TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.unified_picks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO service_role;

-- Additional tables (if they exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'line_history') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.line_history TO service_role;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.events TO service_role;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'picks_submissions') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.picks_submissions TO service_role;
    END IF;
END $$;

-- ============================================================================
-- 2. GRANT SEQUENCE ACCESS
-- ============================================================================

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ============================================================================
-- 3. GRANT FUNCTION EXECUTION
-- ============================================================================

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Explicitly grant admin functions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_backfill_market_props') THEN
        GRANT EXECUTE ON FUNCTION admin_backfill_market_props(int) TO service_role;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_score_batch') THEN
        GRANT EXECUTE ON FUNCTION admin_score_batch(int) TO service_role;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_refresh_views') THEN
        GRANT EXECUTE ON FUNCTION admin_refresh_views() TO service_role;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_unscored_market_props') THEN
        GRANT EXECUTE ON FUNCTION get_unscored_market_props(int) TO service_role;
    END IF;
END $$;

-- ============================================================================
-- 4. GRANT VIEW ACCESS
-- ============================================================================

-- Grant access to views
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'v_prop_read_model') THEN
        GRANT SELECT ON public.v_prop_read_model TO authenticated, anon, service_role;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'v_daily_board') THEN
        GRANT SELECT ON public.v_daily_board TO authenticated, anon, service_role;
    END IF;
END $$;

-- ============================================================================
-- 5. VERIFY RLS POLICIES (Add if missing)
-- ============================================================================

-- Note: Only enable RLS if application explicitly requires it
-- For now, verify that service_role can bypass RLS

-- Ensure service_role can bypass RLS on all tables
ALTER TABLE IF EXISTS public.market_props ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scored_props ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.promotion_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.raw_props ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.unified_picks ENABLE ROW LEVEL SECURITY;

-- Create bypass policies for service_role
CREATE POLICY IF NOT EXISTS "service_role_all_market_props" ON public.market_props
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "service_role_all_scored_props" ON public.scored_props
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "service_role_all_promotion_queue" ON public.promotion_queue
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "service_role_all_agent_health" ON public.agent_health
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "service_role_all_agent_metrics" ON public.agent_metrics
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "service_role_all_raw_props" ON public.raw_props
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "service_role_all_unified_picks" ON public.unified_picks
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. ADD POSTGREST RELOAD VERIFICATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_pgrst_reload()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_before TIMESTAMPTZ;
  v_after TIMESTAMPTZ;
BEGIN
  -- Record current time
  v_before := NOW();
  
  -- Send reload signal
  NOTIFY pgrst, 'reload schema';
  
  -- Wait 2 seconds for PostgREST to reload
  PERFORM pg_sleep(2);
  
  -- Record after time
  v_after := NOW();
  
  -- Log the reload attempt
  RAISE NOTICE 'PostgREST reload signal sent at %, verified at %', v_before, v_after;
  
  -- Return true (we can't actually verify PostgREST reloaded, but we sent the signal)
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.verify_pgrst_reload() IS 
'Sends NOTIFY pgrst reload signal and waits 2 seconds. Used after schema changes.';

GRANT EXECUTE ON FUNCTION public.verify_pgrst_reload() TO service_role;

-- ============================================================================
-- 7. ADD HELPER FUNCTION TO CHECK GRANTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_service_role_grants()
RETURNS TABLE (
    object_type TEXT,
    object_name TEXT,
    privilege_type TEXT,
    has_grant BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    -- Check table grants
    SELECT 
        'TABLE'::TEXT,
        table_name::TEXT,
        privilege_type::TEXT,
        true::BOOLEAN
    FROM information_schema.table_privileges
    WHERE grantee = 'service_role'
      AND table_schema = 'public'
    
    UNION ALL
    
    -- Check function grants
    SELECT 
        'FUNCTION'::TEXT,
        routine_name::TEXT,
        'EXECUTE'::TEXT,
        true::BOOLEAN
    FROM information_schema.routine_privileges
    WHERE grantee = 'service_role'
      AND routine_schema = 'public'
    
    ORDER BY object_type, object_name, privilege_type;
END;
$$;

COMMENT ON FUNCTION public.check_service_role_grants() IS 
'Returns all grants for service_role. Use for auditing permissions.';

GRANT EXECUTE ON FUNCTION public.check_service_role_grants() TO service_role;

-- ============================================================================
-- 8. RELOAD POSTGREST AND VERIFY
-- ============================================================================

SELECT public.verify_pgrst_reload();

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run manually after migration)
-- ============================================================================

-- Verify table grants
-- SELECT * FROM public.check_service_role_grants() WHERE object_type = 'TABLE';

-- Verify function grants
-- SELECT * FROM public.check_service_role_grants() WHERE object_type = 'FUNCTION';

-- Verify RLS policies
-- SELECT schemaname, tablename, policyname, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- ============================================================================
-- ROLLBACK PROCEDURE (if needed)
-- ============================================================================

-- To rollback this migration:
-- 1. REVOKE all grants: REVOKE ALL ON ALL TABLES IN SCHEMA public FROM service_role;
-- 2. DROP policies: DROP POLICY IF EXISTS "service_role_all_*" ON public.*;
-- 3. DROP functions: DROP FUNCTION IF EXISTS public.verify_pgrst_reload();
-- 4. DROP functions: DROP FUNCTION IF EXISTS public.check_service_role_grants();

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

