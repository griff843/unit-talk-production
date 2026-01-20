-- ============================================================================
-- PR9: Production Prerequisites Gate
-- ============================================================================
-- Purpose: Verify all PR1-PR8 infrastructure is deployed AND safe for production
-- Run: psql -f gate_prereqs_prod.sql or via Supabase SQL Editor
-- Expected: 0 failures, all checks PASS
--
-- CRITICAL: This script has STRICTER checks than staging:
-- - All feature flags must be OFF
-- - Dry-run mode must be ON
-- - Approval workflow must be required
-- ============================================================================

\echo '=== PR9 Production Prerequisites Gate ==='
\echo 'Running production-grade safety checks...'
\echo ''

-- Create temp table for results
CREATE TEMP TABLE IF NOT EXISTS gate_results (
    check_id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    check_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PASS', 'FAIL', 'WARN')),
    details TEXT,
    severity TEXT DEFAULT 'normal',
    checked_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 1. Schema Existence Checks (same as staging)
-- ============================================================================

INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT
    'Schema',
    'ops schema exists',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'ops')
         THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'ops')
         THEN 'ops schema found'
         ELSE 'CRITICAL: ops schema missing - cannot proceed' END,
    'critical';

-- ============================================================================
-- 2. All Required Tables Check
-- ============================================================================

-- PR5 Tables
INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT 'PR5 Tables', 'ops.slos',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'ops' AND table_name = 'slos')
         THEN 'PASS' ELSE 'FAIL' END,
    'SLO definitions table', 'critical';

INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT 'PR5 Tables', 'ops.slo_evaluations',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'ops' AND table_name = 'slo_evaluations')
         THEN 'PASS' ELSE 'FAIL' END,
    'SLO evaluation history table', 'critical';

INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT 'PR5 Tables', 'ops.slo_incidents',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'ops' AND table_name = 'slo_incidents')
         THEN 'PASS' ELSE 'FAIL' END,
    'SLO incidents table', 'critical';

-- PR7 Tables
INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT 'PR7 Tables', 'ops.incident_notifications',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'ops' AND table_name = 'incident_notifications')
         THEN 'PASS' ELSE 'FAIL' END,
    'Incident notifications table', 'critical';

INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT 'PR7 Tables', 'ops.notification_prefs',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'ops' AND table_name = 'notification_prefs')
         THEN 'PASS' ELSE 'FAIL' END,
    'Notification preferences table', 'critical';

INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT 'PR7 Tables', 'ops.notification_cursor',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'ops' AND table_name = 'notification_cursor')
         THEN 'PASS' ELSE 'FAIL' END,
    'Notification cursor table', 'critical';

INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT 'PR7 Tables', 'ops.digest_history',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'ops' AND table_name = 'digest_history')
         THEN 'PASS' ELSE 'FAIL' END,
    'Digest history table', 'critical';

-- PR8 Tables
INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT 'PR8 Tables', 'ops.remediation_playbooks',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'ops' AND table_name = 'remediation_playbooks')
         THEN 'PASS' ELSE 'FAIL' END,
    'Remediation playbooks table', 'critical';

INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT 'PR8 Tables', 'ops.remediation_executions',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'ops' AND table_name = 'remediation_executions')
         THEN 'PASS' ELSE 'FAIL' END,
    'Remediation executions table', 'critical';

INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT 'PR8 Tables', 'ops.remediation_config',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'ops' AND table_name = 'remediation_config')
         THEN 'PASS' ELSE 'FAIL' END,
    'Remediation config table', 'critical';

-- ============================================================================
-- 3. RLS Security Checks (ALL ops tables must have RLS)
-- ============================================================================

INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT
    'RLS Security',
    'All ops tables have RLS enabled',
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'ops' AND rowsecurity = false
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'ops' AND rowsecurity = false
    ) THEN 'All ops tables have RLS enabled'
      ELSE 'SECURITY VIOLATION: Some ops tables lack RLS: ' || (
          SELECT string_agg(tablename, ', ')
          FROM pg_tables
          WHERE schemaname = 'ops' AND rowsecurity = false
      ) END,
    'critical';

-- ============================================================================
-- 4. PRODUCTION SAFETY CHECKS - Feature Flags OFF
-- ============================================================================

-- Global remediation must be disabled
INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT
    'Safety Flags',
    'global_enabled is FALSE',
    CASE WHEN EXISTS (
        SELECT 1 FROM ops.remediation_config
        WHERE config_key = 'global_enabled' AND config_value::text = 'false'
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM ops.remediation_config
        WHERE config_key = 'global_enabled' AND config_value::text = 'false'
    ) THEN 'SAFE: global_enabled is OFF as required'
      ELSE 'DANGER: global_enabled is ON - must be OFF for initial production deploy' END,
    'critical';

-- Dry-run mode must be enabled
INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT
    'Safety Flags',
    'dry_run_mode is TRUE',
    CASE WHEN EXISTS (
        SELECT 1 FROM ops.remediation_config
        WHERE config_key = 'dry_run_mode' AND config_value::text = 'true'
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM ops.remediation_config
        WHERE config_key = 'dry_run_mode' AND config_value::text = 'true'
    ) THEN 'SAFE: dry_run_mode is ON as required'
      ELSE 'DANGER: dry_run_mode is OFF - must be ON for initial production deploy' END,
    'critical';

-- Approval required by default
INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT
    'Safety Flags',
    'require_approval_by_default is TRUE',
    CASE WHEN EXISTS (
        SELECT 1 FROM ops.remediation_config
        WHERE config_key = 'require_approval_by_default' AND config_value::text = 'true'
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM ops.remediation_config
        WHERE config_key = 'require_approval_by_default' AND config_value::text = 'true'
    ) THEN 'SAFE: require_approval_by_default is ON'
      ELSE 'DANGER: require_approval_by_default is OFF - must be ON for production' END,
    'critical';

-- ============================================================================
-- 5. PLAYBOOK SAFETY CHECKS - All must be disabled
-- ============================================================================

INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT
    'Playbook Safety',
    'All playbooks disabled',
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM ops.remediation_playbooks WHERE enabled = true
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM ops.remediation_playbooks WHERE enabled = true
    ) THEN 'SAFE: All playbooks are disabled as required'
      ELSE 'DANGER: Some playbooks enabled: ' || (
          SELECT string_agg(playbook_id, ', ')
          FROM ops.remediation_playbooks
          WHERE enabled = true
      ) END,
    'critical';

-- All playbooks must require approval
INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT
    'Playbook Safety',
    'All playbooks require approval',
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM ops.remediation_playbooks
        WHERE requires_approval = false AND execution_type = 'EXECUTABLE'
    ) THEN 'PASS' ELSE 'WARN' END,
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM ops.remediation_playbooks
        WHERE requires_approval = false AND execution_type = 'EXECUTABLE'
    ) THEN 'All EXECUTABLE playbooks require approval'
      ELSE 'WARNING: Some EXECUTABLE playbooks skip approval: ' || (
          SELECT string_agg(playbook_id, ', ')
          FROM ops.remediation_playbooks
          WHERE requires_approval = false AND execution_type = 'EXECUTABLE'
      ) END,
    'high';

-- All playbooks must be dry-run only
INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT
    'Playbook Safety',
    'All playbooks are dry-run only',
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM ops.remediation_playbooks WHERE dry_run_only = false
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM ops.remediation_playbooks WHERE dry_run_only = false
    ) THEN 'SAFE: All playbooks are dry-run only'
      ELSE 'DANGER: Some playbooks allow live execution: ' || (
          SELECT string_agg(playbook_id, ', ')
          FROM ops.remediation_playbooks
          WHERE dry_run_only = false
      ) END,
    'critical';

-- ============================================================================
-- 6. MV_REFRESH_LAG Playbook Check
-- ============================================================================

INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT
    'MV Infrastructure',
    'MV_REFRESH_LAG is RECOMMENDATION_ONLY',
    CASE WHEN EXISTS (
        SELECT 1 FROM ops.remediation_playbooks
        WHERE playbook_id = 'MV_REFRESH_LAG' AND execution_type = 'RECOMMENDATION_ONLY'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'MV_REFRESH_LAG must remain RECOMMENDATION_ONLY (no MV refresh infrastructure exists)',
    'high';

-- ============================================================================
-- 7. No Pending Executions Check
-- ============================================================================

INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT
    'Clean State',
    'No pending remediation executions',
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM ops.remediation_executions
        WHERE status IN ('pending', 'approved', 'executing')
    ) THEN 'PASS' ELSE 'WARN' END,
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM ops.remediation_executions
        WHERE status IN ('pending', 'approved', 'executing')
    ) THEN 'No pending/approved/executing remediations'
      ELSE 'WARNING: ' || (
          SELECT COUNT(*)
          FROM ops.remediation_executions
          WHERE status IN ('pending', 'approved', 'executing')
      ) || ' pending remediations exist' END,
    'normal';

-- ============================================================================
-- 8. Functions Security Check
-- ============================================================================

INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT
    'Function Security',
    'SECURITY DEFINER functions use proper search_path',
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'ops'
          AND p.prosecdef = true
          AND NOT (p.proconfig @> ARRAY['search_path=ops, public'])
    ) THEN 'PASS' ELSE 'WARN' END,
    'All SECURITY DEFINER functions should set search_path',
    'normal';

-- ============================================================================
-- 9. SLO Seed Data Check
-- ============================================================================

INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT
    'Seed Data',
    'SLOs are seeded',
    CASE WHEN (SELECT COUNT(*) FROM ops.slos) > 0
         THEN 'PASS' ELSE 'WARN' END,
    'Found ' || COALESCE((SELECT COUNT(*) FROM ops.slos), 0) || ' SLOs defined',
    'normal';

-- ============================================================================
-- 10. Notification Preferences Check
-- ============================================================================

INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT
    'Notification Prefs',
    'Production notification prefs exist',
    CASE WHEN EXISTS (
        SELECT 1 FROM ops.notification_prefs WHERE environment = 'production'
    ) THEN 'PASS' ELSE 'WARN' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM ops.notification_prefs WHERE environment = 'production'
    ) THEN 'Production notification preferences configured'
      ELSE 'WARNING: No production notification preferences - notifications will not be sent' END,
    'normal';

-- Notifications should be disabled initially
INSERT INTO gate_results (category, check_name, status, details, severity)
SELECT
    'Notification Prefs',
    'Production notifications disabled',
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM ops.notification_prefs
        WHERE environment = 'production' AND enabled = true
    ) THEN 'PASS' ELSE 'WARN' END,
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM ops.notification_prefs
        WHERE environment = 'production' AND enabled = true
    ) THEN 'Production notifications correctly disabled for initial deploy'
      ELSE 'NOTE: Some production notifications are enabled - ensure this is intentional' END,
    'normal';

-- ============================================================================
-- RESULTS SUMMARY
-- ============================================================================

\echo ''
\echo '=== PRODUCTION GATE RESULTS ==='
\echo ''

SELECT
    category,
    check_name,
    status,
    details
FROM gate_results
ORDER BY
    CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
    CASE status WHEN 'FAIL' THEN 1 WHEN 'WARN' THEN 2 ELSE 3 END,
    category,
    check_id;

\echo ''
\echo '=== PRODUCTION GATE SUMMARY ==='

SELECT
    COUNT(*) FILTER (WHERE status = 'PASS') as passed,
    COUNT(*) FILTER (WHERE status = 'WARN') as warnings,
    COUNT(*) FILTER (WHERE status = 'FAIL') as failed,
    COUNT(*) as total,
    CASE
        WHEN COUNT(*) FILTER (WHERE status = 'FAIL') = 0 THEN 'PRODUCTION GATE: PASS - Safe to deploy'
        ELSE 'PRODUCTION GATE: FAIL - ' || COUNT(*) FILTER (WHERE status = 'FAIL') || ' blocking issues'
    END as gate_status
FROM gate_results;

\echo ''

-- Return failure exit code if any failures
DO $$
DECLARE
    fail_count INTEGER;
    fail_details TEXT;
BEGIN
    SELECT COUNT(*), string_agg(check_name || ': ' || details, E'\n')
    INTO fail_count, fail_details
    FROM gate_results WHERE status = 'FAIL';

    IF fail_count > 0 THEN
        RAISE EXCEPTION E'PRODUCTION GATE FAILED\n\n% blocking issues:\n%', fail_count, fail_details;
    END IF;
END $$;

-- Cleanup
DROP TABLE IF EXISTS gate_results;

\echo 'Production prerequisites verified successfully!'
\echo ''
\echo 'NEXT STEPS:'
\echo '1. Run smoke_ops_loop.sql to verify end-to-end functionality'
\echo '2. Enable features incrementally per GO_LIVE_RUNBOOK.md'
\echo '3. Monitor Command Center dashboard for health'
