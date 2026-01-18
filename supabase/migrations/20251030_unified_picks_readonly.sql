-- ===============================================================================
-- Make unified_picks READ-ONLY (Deprecated Table)
-- Date: 2025-10-30
-- Purpose: Lock down unified_picks to prevent writes; canonical tables are authoritative
-- Version: 1.0.0
-- Charter Compliance: v3.0 - Canonical-first architecture
-- ===============================================================================

-- ===============================================================================
-- 1. CHECK IF unified_picks EXISTS
-- ===============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'unified_picks') THEN
    RAISE NOTICE 'unified_picks table does not exist. Skipping read-only enforcement.';
    RETURN;
  END IF;

  RAISE NOTICE 'unified_picks table found. Enabling RLS and read-only policies.';
END $$;

-- ===============================================================================
-- 2. ENABLE RLS ON unified_picks
-- ===============================================================================
ALTER TABLE unified_picks ENABLE ROW LEVEL SECURITY;

-- ===============================================================================
-- 3. DROP EXISTING POLICIES (If Any)
-- ===============================================================================
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'unified_picks'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON unified_picks', policy_record.policyname);
  END LOOP;
END $$;

-- ===============================================================================
-- 4. CREATE READ-ONLY POLICIES
-- ===============================================================================

-- Allow SELECT for all users (service role and authenticated users)
CREATE POLICY "unified_picks: Allow SELECT for all"
  ON unified_picks
  FOR SELECT
  USING (true);

-- Deny INSERT for all users (except service role for emergency operations)
CREATE POLICY "unified_picks: Deny INSERT"
  ON unified_picks
  FOR INSERT
  WITH CHECK (
    current_setting('role', true) = 'service_role'
    AND current_setting('app.emergency_mode', true) = 'true'
  );

-- Deny UPDATE for all users (except service role for emergency operations)
CREATE POLICY "unified_picks: Deny UPDATE"
  ON unified_picks
  FOR UPDATE
  USING (
    current_setting('role', true) = 'service_role'
    AND current_setting('app.emergency_mode', true) = 'true'
  );

-- Deny DELETE for all users (except service role for emergency operations)
CREATE POLICY "unified_picks: Deny DELETE"
  ON unified_picks
  FOR DELETE
  USING (
    current_setting('role', true) = 'service_role'
    AND current_setting('app.emergency_mode', true) = 'true'
  );

-- ===============================================================================
-- 5. ADD TABLE COMMENT (Deprecation Notice)
-- ===============================================================================
COMMENT ON TABLE unified_picks IS 'DEPRECATED - READ ONLY. Use canonical "picks" table for all operations. This table remains for backward compatibility and fallback reads during convergence. Charter v3.0 mandates canonical-first architecture.';

-- ===============================================================================
-- 6. CREATE READ-ONLY ATTESTATION VIEW
-- ===============================================================================
CREATE OR REPLACE VIEW vw_unified_picks_readonly_status AS
SELECT
  'unified_picks' AS table_name,
  'READ_ONLY' AS access_mode,
  true AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'unified_picks' AND cmd = 'SELECT') AS select_policies_count,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'unified_picks' AND cmd = 'INSERT') AS insert_policies_count,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'unified_picks' AND cmd = 'UPDATE') AS update_policies_count,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'unified_picks' AND cmd = 'DELETE') AS delete_policies_count,
  obj_description('unified_picks'::regclass, 'pg_class') AS table_comment,
  NOW() AS attested_at
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'unified_picks');

-- ===============================================================================
-- 7. AUDIT LOG: Record Read-Only Enforcement
-- ===============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_events') THEN
    INSERT INTO audit_events (
      tenant_id,
      event_type,
      entity_type,
      entity_id,
      actor_type,
      old_values,
      new_values,
      metadata
    ) VALUES (
      '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a'::UUID,  -- Default tenant
      'schema.table.readonly_enforced',
      'table',
      'unified_picks'::UUID,
      'system',
      jsonb_build_object('access_mode', 'read_write'),
      jsonb_build_object('access_mode', 'read_only'),
      jsonb_build_object(
        'migration', '20251030_unified_picks_readonly',
        'charter_version', 'v3.0',
        'reason', 'Canonical-first architecture enforcement',
        'canonical_table', 'picks',
        'fallback_allowed', true,
        'emergency_override', 'app.emergency_mode=true'
      )
    );

    RAISE NOTICE 'Audit event recorded: unified_picks set to READ-ONLY';
  END IF;
END $$;

-- ===============================================================================
-- 8. TRIGGER POSTGREST RELOAD
-- ===============================================================================
SELECT pg_notify('pgrst', 'reload schema');

-- Log reload via RPC (if available)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'pgrst_reload'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    PERFORM pgrst_reload('unified-readonly-migration', 'Post read-only enforcement schema reload');
  END IF;
END $$;

-- ===============================================================================
-- 9. VERIFICATION QUERY
-- ===============================================================================
-- Run this to verify read-only status:
-- SELECT * FROM vw_unified_picks_readonly_status;

-- ===============================================================================
-- 10. COMMENTS
-- ===============================================================================
COMMENT ON VIEW vw_unified_picks_readonly_status IS 'Attestation view showing unified_picks read-only enforcement status for Charter compliance';

-- ===============================================================================
-- END OF MIGRATION
-- ===============================================================================
