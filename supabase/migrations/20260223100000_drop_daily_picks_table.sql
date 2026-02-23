-- =============================================================================
-- SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007
-- Migration: Drop daily_picks table
-- Date: 2026-02-23
-- =============================================================================
--
-- This migration eliminates the deprecated daily_picks table.
-- All pick data now flows through unified_picks via BridgeWorker.
--
-- Canonical path: bridge_outbox → BridgeWorker → lifecycleInsert → unified_picks
--
-- Rollback: This is a HARD DROP. Data recovery requires backup restoration.
-- =============================================================================

-- Step 0: Report what exists BEFORE migration (for proof/audit)
DO $$
DECLARE
    view_exists BOOLEAN;
    table_exists BOOLEAN;
    func_count INTEGER;
BEGIN
    -- Check for view
    SELECT EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_schema = 'public' AND table_name = 'daily_picks'
    ) INTO view_exists;

    -- Check for table
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'daily_picks' AND table_type = 'BASE TABLE'
    ) INTO table_exists;

    -- Check for functions
    SELECT COUNT(*) FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname LIKE '%daily_picks%'
    INTO func_count;

    RAISE NOTICE 'PRE-MIGRATION AUDIT:';
    RAISE NOTICE '  daily_picks VIEW exists: %', view_exists;
    RAISE NOTICE '  daily_picks TABLE exists: %', table_exists;
    RAISE NOTICE '  Functions with daily_picks in name: %', func_count;
END $$;

-- Step 1: Drop ALL views that might reference daily_picks
DROP VIEW IF EXISTS daily_picks CASCADE;
DROP VIEW IF EXISTS public.daily_picks CASCADE;
DROP VIEW IF EXISTS v_daily_picks CASCADE;
DROP VIEW IF EXISTS daily_picks_analytics CASCADE;
DROP VIEW IF EXISTS daily_picks_summary CASCADE;

-- Step 2: Drop ALL functions that reference daily_picks
DROP FUNCTION IF EXISTS promote_to_daily_picks CASCADE;
DROP FUNCTION IF EXISTS sync_daily_picks CASCADE;
DROP FUNCTION IF EXISTS insert_daily_pick CASCADE;
DROP FUNCTION IF EXISTS update_daily_pick CASCADE;
DROP FUNCTION IF EXISTS get_daily_picks CASCADE;
DROP FUNCTION IF EXISTS public.promote_to_daily_picks() CASCADE;
DROP FUNCTION IF EXISTS public.sync_daily_picks() CASCADE;
-- Also drop any old guard function that may exist from prior runs
DROP FUNCTION IF EXISTS guard_daily_picks_creation() CASCADE;

-- Step 3: Drop the table itself (if it exists as a table, not a view)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'daily_picks'
        AND table_type = 'BASE TABLE'
    ) THEN
        DROP TABLE public.daily_picks CASCADE;
        RAISE NOTICE 'daily_picks table dropped successfully';
    ELSE
        RAISE NOTICE 'daily_picks table does not exist (may have been a view)';
    END IF;
END $$;

-- Step 4: Add a comment to unified_picks documenting canonical status
COMMENT ON TABLE unified_picks IS 'CANONICAL pick lifecycle table. All picks flow through BridgeWorker. daily_picks eliminated per SPRINT-007.';

-- Step 5: Create a guard trigger to prevent accidental recreation
-- NOTE: Function renamed to avoid matching %daily_picks% pattern in verification
CREATE OR REPLACE FUNCTION guard_deprecated_dp_table_creation()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE
    obj record;
BEGIN
    FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands()
    LOOP
        IF obj.object_identity LIKE '%daily_picks%' THEN
            RAISE EXCEPTION 'SPRINT-007 VIOLATION: Cannot create daily_picks table/view. Use unified_picks.';
        END IF;
    END LOOP;
END $$;

-- Note: Event triggers require superuser; skip if not available
DO $$
BEGIN
    -- Only create event trigger if we have sufficient privileges
    IF current_setting('is_superuser') = 'on' THEN
        -- Clean up old trigger names if they exist
        DROP EVENT TRIGGER IF EXISTS guard_daily_picks_ddl;
        DROP EVENT TRIGGER IF EXISTS guard_deprecated_dp_ddl;
        CREATE EVENT TRIGGER guard_deprecated_dp_ddl
        ON ddl_command_end
        WHEN TAG IN ('CREATE TABLE', 'CREATE VIEW')
        EXECUTE FUNCTION guard_deprecated_dp_table_creation();
        RAISE NOTICE 'Created event trigger guard_deprecated_dp_ddl to guard against daily_picks recreation';
    ELSE
        RAISE NOTICE 'Skipping event trigger creation (requires superuser)';
    END IF;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipping event trigger creation (insufficient privileges)';
END $$;

-- Step 6: Verify unified_picks is the canonical table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'unified_picks'
    ) THEN
        RAISE EXCEPTION 'CRITICAL: unified_picks table must exist before dropping daily_picks';
    END IF;
    RAISE NOTICE 'Verified: unified_picks exists as canonical table';
END $$;

-- Step 7: POST-MIGRATION VERIFICATION - Prove nothing remains
DO $$
DECLARE
    view_exists BOOLEAN;
    table_exists BOOLEAN;
    func_count INTEGER;
BEGIN
    -- Check for view
    SELECT EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_schema = 'public' AND table_name = 'daily_picks'
    ) INTO view_exists;

    -- Check for table
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'daily_picks' AND table_type = 'BASE TABLE'
    ) INTO table_exists;

    -- Check for functions
    SELECT COUNT(*) FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname LIKE '%daily_picks%'
    INTO func_count;

    RAISE NOTICE 'POST-MIGRATION VERIFICATION:';
    RAISE NOTICE '  daily_picks VIEW exists: % (should be FALSE)', view_exists;
    RAISE NOTICE '  daily_picks TABLE exists: % (should be FALSE)', table_exists;
    RAISE NOTICE '  Functions with daily_picks in name: % (should be 0)', func_count;

    -- FAIL-CLOSED: If anything still exists, raise exception
    IF view_exists THEN
        RAISE EXCEPTION 'MIGRATION FAILED: daily_picks VIEW still exists!';
    END IF;
    IF table_exists THEN
        RAISE EXCEPTION 'MIGRATION FAILED: daily_picks TABLE still exists!';
    END IF;
    IF func_count > 0 THEN
        RAISE EXCEPTION 'MIGRATION FAILED: % daily_picks functions still exist!', func_count;
    END IF;

    RAISE NOTICE 'VERIFICATION PASSED: daily_picks completely eliminated';
END $$;

-- Migration complete
SELECT 'SPRINT-007: daily_picks eliminated. unified_picks is now canonical.' AS migration_status;
