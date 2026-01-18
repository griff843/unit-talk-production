-- ===============================================================================
-- Test User Seeder + RLS RPC Functions
-- Date: 2025-10-30
-- Purpose: Idempotent test user seed and RLS enablement RPCs for production
-- Charter: docs/PRODUCTION_CHARTER.md v3.0
-- ===============================================================================
--
-- This migration is IDEMPOTENT and safe to re-run multiple times.
-- All statements use IF NOT EXISTS or ON CONFLICT patterns.
--
-- Functions Created:
--   • pgrst_reload() - Trigger PostgREST schema reload via pg_notify
--   • app_enable_rls() - Enable RLS and create policies for canonical tables
--
-- Seed Data:
--   • Test user (id: 00000000-0000-0000-0000-000000000001) for RLS testing
--
-- ===============================================================================

-- ===============================================================================
-- 1. SEED TEST USER (Idempotent)
-- ===============================================================================

-- Insert test user for RLS validation (idempotent via ON CONFLICT)
DO $$
DECLARE
  v_default_tenant_id UUID := '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a'::UUID;
  v_test_user_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN
  -- Ensure default tenant exists (from 20251101_core_picks.sql)
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = v_default_tenant_id) THEN
    RAISE NOTICE 'Default tenant not found - creating...';
    INSERT INTO tenants (id, name, slug, domain, tier, status, settings)
    VALUES (
      v_default_tenant_id,
      'Unit Talk',
      'unit-talk',
      'unittalk.com',
      'enterprise',
      'active',
      '{}'::JSONB
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Insert test user (idempotent)
  INSERT INTO users (id, tenant_id, username, role, tier, status, created_at)
  VALUES (
    v_test_user_id,
    v_default_tenant_id,
    'test-user-rls',
    'test',
    'free',
    'active',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Test user seed complete: id=%', v_test_user_id;
END $$;

-- ===============================================================================
-- 2. POSTGREST RELOAD RPC (Security Definer)
-- ===============================================================================

CREATE OR REPLACE FUNCTION public.pgrst_reload()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reload_id UUID;
  v_reloaded_at TIMESTAMPTZ;
BEGIN
  -- Generate reload tracking ID
  v_reload_id := gen_random_uuid();
  v_reloaded_at := NOW();

  -- Send PostgREST reload notification
  PERFORM pg_notify('pgrst', 'reload schema');

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'reload_id', v_reload_id,
    'reloaded_at', v_reloaded_at,
    'message', 'PostgREST schema reload notification sent'
  );
END $$;

COMMENT ON FUNCTION public.pgrst_reload() IS 
'Trigger PostgREST schema reload via pg_notify. Security definer allows service role to reload schema.';

-- ===============================================================================
-- 3. RLS ENABLE RPC (Security Definer)
-- ===============================================================================

CREATE OR REPLACE FUNCTION public.app_enable_rls()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables_enabled TEXT[] := ARRAY[]::TEXT[];
  v_policies_created TEXT[] := ARRAY[]::TEXT[];
  v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- ============================================================================
  -- PICKS TABLE
  -- ============================================================================
  BEGIN
    -- Enable RLS
    EXECUTE 'ALTER TABLE public.picks ENABLE ROW LEVEL SECURITY';
    v_tables_enabled := array_append(v_tables_enabled, 'picks');

    -- Tenant read policy (idempotent)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'picks' 
      AND policyname = 'picks_tenant_read'
    ) THEN
      EXECUTE $$
        CREATE POLICY picks_tenant_read ON public.picks
        FOR SELECT 
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      $$;
      v_policies_created := array_append(v_policies_created, 'picks_tenant_read');
    END IF;

    -- Service role write policy (idempotent)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'picks' 
      AND policyname = 'picks_service_write'
    ) THEN
      EXECUTE $$
        CREATE POLICY picks_service_write ON public.picks
        FOR ALL 
        TO service_role
        USING (true) 
        WITH CHECK (true)
      $$;
      v_policies_created := array_append(v_policies_created, 'picks_service_write');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'picks: ' || SQLERRM);
  END;

  -- ============================================================================
  -- PICK_PUBLISH TABLE
  -- ============================================================================
  BEGIN
    -- Enable RLS
    EXECUTE 'ALTER TABLE public.pick_publish ENABLE ROW LEVEL SECURITY';
    v_tables_enabled := array_append(v_tables_enabled, 'pick_publish');

    -- Tenant read policy (idempotent)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'pick_publish' 
      AND policyname = 'pick_publish_tenant_read'
    ) THEN
      EXECUTE $$
        CREATE POLICY pick_publish_tenant_read ON public.pick_publish
        FOR SELECT 
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      $$;
      v_policies_created := array_append(v_policies_created, 'pick_publish_tenant_read');
    END IF;

    -- Service role write policy (idempotent)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'pick_publish' 
      AND policyname = 'pick_publish_service_write'
    ) THEN
      EXECUTE $$
        CREATE POLICY pick_publish_service_write ON public.pick_publish
        FOR ALL 
        TO service_role
        USING (true) 
        WITH CHECK (true)
      $$;
      v_policies_created := array_append(v_policies_created, 'pick_publish_service_write');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'pick_publish: ' || SQLERRM);
  END;

  -- ============================================================================
  -- UNIFIED_PICKS TABLE (Read-Only Legacy)
  -- ============================================================================
  BEGIN
    -- Only enable if table exists (fallback table)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'unified_picks'
    ) THEN
      -- Enable RLS
      EXECUTE 'ALTER TABLE public.unified_picks ENABLE ROW LEVEL SECURITY';
      v_tables_enabled := array_append(v_tables_enabled, 'unified_picks');

      -- Read-only policy (idempotent)
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'unified_picks' 
        AND policyname = 'unified_picks_read_only'
      ) THEN
        EXECUTE $$
          CREATE POLICY unified_picks_read_only ON public.unified_picks
          FOR SELECT 
          USING (true)
        $$;
        v_policies_created := array_append(v_policies_created, 'unified_picks_read_only');
      END IF;

      -- Deny writes by absence of write policy (no INSERT/UPDATE/DELETE policies)
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'unified_picks: ' || SQLERRM);
  END;

  -- ============================================================================
  -- RETURN RESULT
  -- ============================================================================
  RETURN jsonb_build_object(
    'success', array_length(v_errors, 1) IS NULL OR array_length(v_errors, 1) = 0,
    'tables_enabled', v_tables_enabled,
    'policies_created', v_policies_created,
    'errors', v_errors,
    'timestamp', NOW(),
    'message', CASE 
      WHEN array_length(v_errors, 1) IS NULL OR array_length(v_errors, 1) = 0 
      THEN 'RLS enabled successfully on all canonical tables'
      ELSE 'RLS enabled with errors - check errors array'
    END
  );
END $$;

COMMENT ON FUNCTION public.app_enable_rls() IS 
'Enable RLS and create policies for canonical tables (picks, pick_publish, unified_picks). Idempotent and safe to re-run.';

-- ===============================================================================
-- 4. GRANT EXECUTE PERMISSIONS
-- ===============================================================================

-- Grant execute to service_role (for API calls)
GRANT EXECUTE ON FUNCTION public.pgrst_reload() TO service_role;
GRANT EXECUTE ON FUNCTION public.app_enable_rls() TO service_role;

-- Grant execute to authenticated users (for dashboard/CLI)
GRANT EXECUTE ON FUNCTION public.pgrst_reload() TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_enable_rls() TO authenticated;

-- ===============================================================================
-- 5. TRIGGER POSTGREST RELOAD
-- ===============================================================================

-- Trigger PostgREST to reload schema and recognize new RPCs
SELECT pg_notify('pgrst', 'reload schema');

-- ===============================================================================
-- MIGRATION COMPLETE
-- ===============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20251030_seed_user_and_rls_rpc.sql complete';
  RAISE NOTICE '   - Test user seeded: 00000000-0000-0000-0000-000000000001';
  RAISE NOTICE '   - RPC created: pgrst_reload()';
  RAISE NOTICE '   - RPC created: app_enable_rls()';
  RAISE NOTICE '   - PostgREST reload triggered';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '   1. Wait 10 seconds for PostgREST reload';
  RAISE NOTICE '   2. Run: npm run ops:rls:enable';
  RAISE NOTICE '   3. Run: npm run ops:pgrst:verify';
END $$;

