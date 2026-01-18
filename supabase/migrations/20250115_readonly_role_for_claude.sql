-- ===============================================================================
-- READ-ONLY DATABASE ROLE FOR CLAUDE AI AND MONITORING
-- Date: 2025-01-15
-- Purpose: Create restricted read-only user for safe AI query execution
-- Version: 1.0.0
-- Charter Compliance: Fail-closed access control, least privilege principle
-- ===============================================================================

-- ===============================================================================
-- SECURITY NOTICE
-- ===============================================================================
-- This migration creates a read-only database role with SELECT-only privileges.
-- This role is designed for:
--   1. Claude AI automation (safe query execution)
--   2. Monitoring systems (metrics collection)
--   3. Developer read-only access (troubleshooting)
--
-- The role CANNOT:
--   - INSERT, UPDATE, DELETE data
--   - Modify schema (CREATE, ALTER, DROP)
--   - Execute functions (except explicitly granted safe functions)
--   - Bypass RLS policies
-- ===============================================================================

-- ===============================================================================
-- 1. CREATE READ-ONLY ROLE (IDEMPOTENT)
-- ===============================================================================

-- Create role if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'readonly_user') THEN
    CREATE ROLE readonly_user WITH LOGIN PASSWORD NULL;  -- Password set via Supabase UI
    RAISE NOTICE 'Created readonly_user role';
  ELSE
    RAISE NOTICE 'readonly_user role already exists';
  END IF;
END $$;

-- ===============================================================================
-- 2. GRANT CONNECT PERMISSION
-- ===============================================================================

-- Allow connection to database
GRANT CONNECT ON DATABASE postgres TO readonly_user;

-- ===============================================================================
-- 3. GRANT SCHEMA USAGE
-- ===============================================================================

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO readonly_user;

-- Grant usage on other schemas if needed (add as required)
-- GRANT USAGE ON SCHEMA auth TO readonly_user;
-- GRANT USAGE ON SCHEMA storage TO readonly_user;

-- ===============================================================================
-- 4. GRANT SELECT ON ALL CURRENT TABLES
-- ===============================================================================

-- Grant SELECT on all existing tables in public schema
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;

-- ===============================================================================
-- 5. GRANT SELECT ON ALL FUTURE TABLES (DEFAULT PRIVILEGES)
-- ===============================================================================

-- Ensure readonly_user gets SELECT on all future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT ON TABLES TO readonly_user;

-- ===============================================================================
-- 6. GRANT EXECUTE ON SAFE READ-ONLY FUNCTIONS
-- ===============================================================================

-- Grant execute on explicitly safe functions only
-- Example: GRANT EXECUTE ON FUNCTION get_recent_picks TO readonly_user;

-- Grant execute on all current functions (read-only functions only)
-- WARNING: Review this carefully in production - may want to be more selective
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO readonly_user;

-- For future functions (optional, be cautious)
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public
-- GRANT EXECUTE ON FUNCTIONS TO readonly_user;

-- ===============================================================================
-- 7. EXPLICITLY REVOKE ALL WRITE PERMISSIONS
-- ===============================================================================

-- Revoke INSERT permissions
REVOKE INSERT ON ALL TABLES IN SCHEMA public FROM readonly_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT ON TABLES FROM readonly_user;

-- Revoke UPDATE permissions
REVOKE UPDATE ON ALL TABLES IN SCHEMA public FROM readonly_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE UPDATE ON TABLES FROM readonly_user;

-- Revoke DELETE permissions
REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM readonly_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE DELETE ON TABLES FROM readonly_user;

-- Revoke TRUNCATE permissions
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM readonly_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM readonly_user;

-- ===============================================================================
-- 8. REVOKE SCHEMA MODIFICATION PERMISSIONS
-- ===============================================================================

-- Revoke CREATE permission on schema
REVOKE CREATE ON SCHEMA public FROM readonly_user;

-- Revoke all database-level permissions except CONNECT
REVOKE ALL ON DATABASE postgres FROM readonly_user;
GRANT CONNECT ON DATABASE postgres TO readonly_user;

-- ===============================================================================
-- 9. CONFIGURE RLS BYPASS (READ-ONLY DOES NOT BYPASS RLS)
-- ===============================================================================

-- readonly_user is subject to RLS policies
-- This ensures data access is still controlled by row-level security

-- If you need to bypass RLS for monitoring (use with caution):
-- ALTER ROLE readonly_user SET row_security = off;

-- By default, readonly_user respects RLS:
ALTER ROLE readonly_user SET row_security = on;

-- ===============================================================================
-- 10. SET SAFE CONNECTION LIMITS AND TIMEOUTS
-- ===============================================================================

-- Limit concurrent connections (prevent resource exhaustion)
ALTER ROLE readonly_user CONNECTION LIMIT 10;

-- Set statement timeout (prevent long-running queries)
ALTER ROLE readonly_user SET statement_timeout = '30s';

-- Set idle timeout
ALTER ROLE readonly_user SET idle_in_transaction_session_timeout = '60s';

-- ===============================================================================
-- 11. DISABLE DANGEROUS FUNCTIONS
-- ===============================================================================

-- Prevent execution of file system functions
ALTER ROLE readonly_user SET pg_read_file = off;
ALTER ROLE readonly_user SET pg_ls_dir = off;

-- ===============================================================================
-- 12. CREATE MONITORING VIEW FOR READONLY_USER PERMISSIONS
-- ===============================================================================

CREATE OR REPLACE VIEW vw_readonly_user_permissions AS
SELECT
  'readonly_user' AS role_name,
  schemaname,
  tablename,
  has_table_privilege('readonly_user', schemaname || '.' || tablename, 'SELECT') AS can_select,
  has_table_privilege('readonly_user', schemaname || '.' || tablename, 'INSERT') AS can_insert,
  has_table_privilege('readonly_user', schemaname || '.' || tablename, 'UPDATE') AS can_update,
  has_table_privilege('readonly_user', schemaname || '.' || tablename, 'DELETE') AS can_delete,
  has_table_privilege('readonly_user', schemaname || '.' || tablename, 'TRUNCATE') AS can_truncate
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

COMMENT ON VIEW vw_readonly_user_permissions IS 'Shows what permissions readonly_user has on each table for audit and verification';

-- ===============================================================================
-- 13. CREATE AUDIT LOG ENTRY
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
      metadata
    ) VALUES (
      '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a'::UUID,  -- Default tenant
      'security.role.created',
      'database_role',
      'readonly_user'::UUID,
      'system',
      jsonb_build_object(
        'migration', '20250115_readonly_role_for_claude',
        'purpose', 'Claude AI and monitoring read-only access',
        'privileges', ARRAY['SELECT'],
        'connection_limit', 10,
        'statement_timeout', '30s',
        'rls_enforcement', true,
        'charter_compliance', 'v1.0 - Fail-closed access control'
      )
    );
    RAISE NOTICE 'Audit event recorded: readonly_user role created';
  END IF;
END $$;

-- ===============================================================================
-- 14. NOTIFY POSTGREST TO RELOAD SCHEMA
-- ===============================================================================

SELECT pg_notify('pgrst', 'reload schema');

-- ===============================================================================
-- 15. POST-MIGRATION VERIFICATION QUERIES
-- ===============================================================================

-- Verify role exists
-- SELECT rolname, rolcanlogin, rolconnlimit FROM pg_roles WHERE rolname = 'readonly_user';

-- Verify permissions
-- SELECT * FROM vw_readonly_user_permissions WHERE can_insert = true OR can_update = true OR can_delete = true;
-- Expected: 0 rows (no write permissions)

-- Test SELECT permission
-- SET ROLE readonly_user;
-- SELECT COUNT(*) FROM picks LIMIT 1;  -- Should succeed
-- RESET ROLE;

-- Test INSERT permission (should fail)
-- SET ROLE readonly_user;
-- INSERT INTO picks (user_id, ...) VALUES (...);  -- Should fail with permission denied
-- RESET ROLE;

-- ===============================================================================
-- 16. DOCUMENTATION AND USAGE
-- ===============================================================================

-- To use this role in applications:
-- 1. Set password via Supabase Dashboard: Database > Roles > readonly_user > Set Password
-- 2. Create connection string:
--    postgresql://readonly_user:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
-- 3. Store in environment variables:
--    SUPABASE_READONLY_DATABASE_URL_DEV=postgresql://readonly_user:...
--    SUPABASE_READONLY_DATABASE_URL_STAGING=postgresql://readonly_user:...
--    SUPABASE_READONLY_DATABASE_URL_PROD=postgresql://readonly_user:...
-- 4. Use with scripts/ops/supabase-query.ts (automatically uses readonly credentials)

-- ===============================================================================
-- END OF MIGRATION
-- ===============================================================================
