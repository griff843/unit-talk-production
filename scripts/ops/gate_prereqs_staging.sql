-- ============================================================================
-- PR9: Staging Prerequisites Gate
-- ============================================================================
-- Purpose: Verify all PR1-PR8 infrastructure is deployed before staging rollout
-- Run: psql -f gate_prereqs_staging.sql or via Supabase SQL Editor
-- Expected: 0 failures, all checks PASS
-- ============================================================================

\echo '=== PR9 Staging Prerequisites Gate ==='
\echo 'Checking PR1-PR8 infrastructure...'
\echo ''

-- Create temp table for results
CREATE TEMP TABLE IF NOT EXISTS gate_results (
    check_id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    check_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PASS', 'FAIL', 'WARN')),
    details TEXT,
    checked_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 1. Schema Existence Checks (PR5-PR8 foundation)
-- ============================================================================

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'Schema',
    'ops schema exists',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'ops')
         THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'ops')
         THEN 'ops schema found'
         ELSE 'CRITICAL: ops schema missing - run PR5 migration first' END;

-- ============================================================================
-- 2. Core Tables Check (PR5: SLO Tables)
-- ============================================================================

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'PR5 Tables',
    'ops.slos table exists',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ops' AND table_name = 'slos'
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ops' AND table_name = 'slos'
    ) THEN 'ops.slos table found'
      ELSE 'CRITICAL: ops.slos missing - PR5 migration required' END;

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'PR5 Tables',
    'ops.slo_evaluations table exists',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ops' AND table_name = 'slo_evaluations'
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ops' AND table_name = 'slo_evaluations'
    ) THEN 'ops.slo_evaluations table found'
      ELSE 'CRITICAL: ops.slo_evaluations missing - PR5 migration required' END;

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'PR5 Tables',
    'ops.slo_incidents table exists',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ops' AND table_name = 'slo_incidents'
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ops' AND table_name = 'slo_incidents'
    ) THEN 'ops.slo_incidents table found'
      ELSE 'CRITICAL: ops.slo_incidents missing - PR5 migration required' END;

-- ============================================================================
-- 3. PR7 Tables Check (Incident Routing)
-- ============================================================================

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'PR7 Tables',
    'ops.incident_notifications table exists',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ops' AND table_name = 'incident_notifications'
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ops' AND table_name = 'incident_notifications'
    ) THEN 'ops.incident_notifications table found'
      ELSE 'CRITICAL: ops.incident_notifications missing - PR7 migration required' END;

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'PR7 Tables',
    'ops.notification_prefs table exists',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ops' AND table_name = 'notification_prefs'
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ops' AND table_name = 'notification_prefs'
    ) THEN 'ops.notification_prefs table found'
      ELSE 'CRITICAL: ops.notification_prefs missing - PR7 migration required' END;

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'PR7 Tables',
    'ops.digest_history table exists',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ops' AND table_name = 'digest_history'
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ops' AND table_name = 'digest_history'
    ) THEN 'ops.digest_history table found'
      ELSE 'CRITICAL: ops.digest_history missing - PR7 migration required' END;

-- ============================================================================
-- 4. PR8 Tables Check (Auto-Remediation)
-- ============================================================================

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'PR8 Tables',
    'ops.remediation_playbooks table exists',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ops' AND table_name = 'remediation_playbooks'
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ops' AND table_name = 'remediation_playbooks'
    ) THEN 'ops.remediation_playbooks table found'
      ELSE 'CRITICAL: ops.remediation_playbooks missing - PR8 migration required' END;

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'PR8 Tables',
    'ops.remediation_executions table exists',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ops' AND table_name = 'remediation_executions'
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ops' AND table_name = 'remediation_executions'
    ) THEN 'ops.remediation_executions table found'
      ELSE 'CRITICAL: ops.remediation_executions missing - PR8 migration required' END;

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'PR8 Tables',
    'ops.remediation_config table exists',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ops' AND table_name = 'remediation_config'
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ops' AND table_name = 'remediation_config'
    ) THEN 'ops.remediation_config table found'
      ELSE 'CRITICAL: ops.remediation_config missing - PR8 migration required' END;

-- ============================================================================
-- 5. PR8 Functions Check (Remediation Functions)
-- ============================================================================

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'PR8 Functions',
    'ops.should_execute_playbook function exists',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'ops' AND routine_name = 'should_execute_playbook'
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'ops' AND routine_name = 'should_execute_playbook'
    ) THEN 'ops.should_execute_playbook function found'
      ELSE 'CRITICAL: ops.should_execute_playbook missing - PR8 migration required' END;

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'PR8 Functions',
    'ops.create_remediation_execution function exists',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'ops' AND routine_name = 'create_remediation_execution'
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'ops' AND routine_name = 'create_remediation_execution'
    ) THEN 'ops.create_remediation_execution function found'
      ELSE 'CRITICAL: ops.create_remediation_execution missing - PR8 migration required' END;

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'PR8 Functions',
    'ops.get_remediation_stats function exists',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'ops' AND routine_name = 'get_remediation_stats'
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'ops' AND routine_name = 'get_remediation_stats'
    ) THEN 'ops.get_remediation_stats function found'
      ELSE 'CRITICAL: ops.get_remediation_stats missing - PR8 migration required' END;

-- ============================================================================
-- 6. RLS Enabled Check
-- ============================================================================

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'RLS Security',
    'RLS enabled on ops.remediation_playbooks',
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'ops' AND tablename = 'remediation_playbooks' AND rowsecurity = true
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'ops' AND tablename = 'remediation_playbooks' AND rowsecurity = true
    ) THEN 'RLS enabled on remediation_playbooks'
      ELSE 'SECURITY: RLS not enabled on remediation_playbooks' END;

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'RLS Security',
    'RLS enabled on ops.remediation_executions',
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'ops' AND tablename = 'remediation_executions' AND rowsecurity = true
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'ops' AND tablename = 'remediation_executions' AND rowsecurity = true
    ) THEN 'RLS enabled on remediation_executions'
      ELSE 'SECURITY: RLS not enabled on remediation_executions' END;

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'RLS Security',
    'RLS enabled on ops.incident_notifications',
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'ops' AND tablename = 'incident_notifications' AND rowsecurity = true
    ) THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'ops' AND tablename = 'incident_notifications' AND rowsecurity = true
    ) THEN 'RLS enabled on incident_notifications'
      ELSE 'SECURITY: RLS not enabled on incident_notifications' END;

-- ============================================================================
-- 7. Playbook Seed Data Check
-- ============================================================================

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'Seed Data',
    'Default playbooks seeded',
    CASE WHEN (SELECT COUNT(*) FROM ops.remediation_playbooks) >= 5
         THEN 'PASS' ELSE 'WARN' END,
    'Found ' || (SELECT COUNT(*) FROM ops.remediation_playbooks) || ' playbooks (expected >= 5)';

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'Seed Data',
    'MV_REFRESH_LAG playbook exists',
    CASE WHEN EXISTS (SELECT 1 FROM ops.remediation_playbooks WHERE playbook_id = 'MV_REFRESH_LAG')
         THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (SELECT 1 FROM ops.remediation_playbooks WHERE playbook_id = 'MV_REFRESH_LAG')
         THEN 'MV_REFRESH_LAG playbook found'
         ELSE 'CRITICAL: MV_REFRESH_LAG playbook missing' END;

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'Seed Data',
    'PIPELINE_LAG_THROTTLE playbook exists',
    CASE WHEN EXISTS (SELECT 1 FROM ops.remediation_playbooks WHERE playbook_id = 'PIPELINE_LAG_THROTTLE')
         THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (SELECT 1 FROM ops.remediation_playbooks WHERE playbook_id = 'PIPELINE_LAG_THROTTLE')
         THEN 'PIPELINE_LAG_THROTTLE playbook found'
         ELSE 'CRITICAL: PIPELINE_LAG_THROTTLE playbook missing' END;

-- ============================================================================
-- 8. Default Config Check
-- ============================================================================

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'Config',
    'global_enabled config exists',
    CASE WHEN EXISTS (SELECT 1 FROM ops.remediation_config WHERE config_key = 'global_enabled')
         THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (SELECT 1 FROM ops.remediation_config WHERE config_key = 'global_enabled')
         THEN 'global_enabled config found'
         ELSE 'CRITICAL: global_enabled config missing' END;

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'Config',
    'dry_run_mode config exists',
    CASE WHEN EXISTS (SELECT 1 FROM ops.remediation_config WHERE config_key = 'dry_run_mode')
         THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS (SELECT 1 FROM ops.remediation_config WHERE config_key = 'dry_run_mode')
         THEN 'dry_run_mode config found'
         ELSE 'CRITICAL: dry_run_mode config missing' END;

-- ============================================================================
-- 9. MV Refresh Infrastructure Check (PR9 documentation)
-- ============================================================================

INSERT INTO gate_results (category, check_name, status, details)
SELECT
    'MV Infrastructure',
    'MV_REFRESH_LAG is RECOMMENDATION_ONLY',
    CASE WHEN EXISTS (
        SELECT 1 FROM ops.remediation_playbooks
        WHERE playbook_id = 'MV_REFRESH_LAG' AND execution_type = 'RECOMMENDATION_ONLY'
    ) THEN 'PASS' ELSE 'WARN' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM ops.remediation_playbooks
        WHERE playbook_id = 'MV_REFRESH_LAG' AND execution_type = 'RECOMMENDATION_ONLY'
    ) THEN 'MV_REFRESH_LAG correctly set to RECOMMENDATION_ONLY (no MV refresh infra exists)'
      ELSE 'WARNING: MV_REFRESH_LAG may have incorrect execution_type' END;

-- ============================================================================
-- RESULTS SUMMARY
-- ============================================================================

\echo ''
\echo '=== STAGING GATE RESULTS ==='
\echo ''

SELECT
    category,
    check_name,
    status,
    details
FROM gate_results
ORDER BY
    CASE status WHEN 'FAIL' THEN 1 WHEN 'WARN' THEN 2 ELSE 3 END,
    category,
    check_id;

\echo ''
\echo '=== SUMMARY ==='

SELECT
    COUNT(*) FILTER (WHERE status = 'PASS') as passed,
    COUNT(*) FILTER (WHERE status = 'WARN') as warnings,
    COUNT(*) FILTER (WHERE status = 'FAIL') as failed,
    COUNT(*) as total,
    CASE
        WHEN COUNT(*) FILTER (WHERE status = 'FAIL') = 0 THEN 'STAGING GATE: PASS'
        ELSE 'STAGING GATE: FAIL - ' || COUNT(*) FILTER (WHERE status = 'FAIL') || ' critical issues'
    END as gate_status
FROM gate_results;

-- Return failure exit code if any failures
DO $$
DECLARE
    fail_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO fail_count FROM gate_results WHERE status = 'FAIL';
    IF fail_count > 0 THEN
        RAISE EXCEPTION 'STAGING GATE FAILED: % critical issues found', fail_count;
    END IF;
END $$;

-- Cleanup
DROP TABLE IF EXISTS gate_results;

\echo ''
\echo 'Staging prerequisites verified successfully!'
