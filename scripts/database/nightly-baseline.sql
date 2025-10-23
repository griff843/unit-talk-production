-- Nightly Baseline Database Maintenance Script
-- Phase 6 - Performance Execution & Hardening
-- 
-- Purpose: Verify grants, RLS policies, NOTIFY triggers, refresh MVs, check index usage
-- Schedule: Run manually for Phase 6, then automate via cron
-- Date: 2025-10-23

-- ============================================================================
-- 1. VERIFY DATABASE GRANTS
-- ============================================================================

DO $$
DECLARE
    missing_grants TEXT[];
    grant_check RECORD;
BEGIN
    RAISE NOTICE '=== Verifying Database Grants ===';
    
    -- Check for required roles
    SELECT array_agg(rolname) INTO missing_grants
    FROM (
        SELECT unnest(ARRAY['unit_talk_api', 'unit_talk_worker', 'unit_talk_readonly']) AS rolname
    ) expected
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_roles WHERE pg_roles.rolname = expected.rolname
    );
    
    IF array_length(missing_grants, 1) > 0 THEN
        RAISE WARNING 'Missing roles: %', array_to_string(missing_grants, ', ');
    ELSE
        RAISE NOTICE '✅ All required roles exist';
    END IF;
    
    -- Verify table grants
    FOR grant_check IN
        SELECT 
            schemaname,
            tablename,
            CASE 
                WHEN has_table_privilege('unit_talk_api', schemaname || '.' || tablename, 'SELECT') THEN '✅'
                ELSE '❌'
            END AS api_select,
            CASE 
                WHEN has_table_privilege('unit_talk_api', schemaname || '.' || tablename, 'INSERT') THEN '✅'
                ELSE '❌'
            END AS api_insert,
            CASE 
                WHEN has_table_privilege('unit_talk_readonly', schemaname || '.' || tablename, 'SELECT') THEN '✅'
                ELSE '❌'
            END AS readonly_select
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('unified_picks', 'raw_props', 'users', 'agent_health', 'agent_metrics')
    LOOP
        RAISE NOTICE 'Table: %.% - API SELECT: % INSERT: % | ReadOnly SELECT: %',
            grant_check.schemaname,
            grant_check.tablename,
            grant_check.api_select,
            grant_check.api_insert,
            grant_check.readonly_select;
    END LOOP;
END $$;

-- ============================================================================
-- 2. VERIFY RLS POLICIES
-- ============================================================================

DO $$
DECLARE
    policy_check RECORD;
    policy_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Verifying RLS Policies ===';
    
    -- Check if RLS is enabled on critical tables
    FOR policy_check IN
        SELECT 
            schemaname,
            tablename,
            CASE WHEN rowsecurity THEN '✅ Enabled' ELSE '❌ Disabled' END AS rls_status
        FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        WHERE schemaname = 'public'
        AND tablename IN ('unified_picks', 'users', 'agent_health')
    LOOP
        RAISE NOTICE 'Table: %.% - RLS: %',
            policy_check.schemaname,
            policy_check.tablename,
            policy_check.rls_status;
    END LOOP;
    
    -- Count active policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public';
    
    RAISE NOTICE 'Total active RLS policies: %', policy_count;
    
    -- List all policies
    FOR policy_check IN
        SELECT 
            schemaname,
            tablename,
            policyname,
            cmd,
            qual
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname
    LOOP
        RAISE NOTICE '  Policy: %.%.% (%) - %',
            policy_check.schemaname,
            policy_check.tablename,
            policy_check.policyname,
            policy_check.cmd,
            COALESCE(policy_check.qual, 'No restriction');
    END LOOP;
END $$;

-- ============================================================================
-- 3. VERIFY NOTIFY TRIGGERS
-- ============================================================================

DO $$
DECLARE
    trigger_check RECORD;
    trigger_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Verifying NOTIFY Triggers ===';
    
    -- Count NOTIFY triggers
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger
    WHERE tgname LIKE 'notify%' OR tgname LIKE '%_notify';
    
    RAISE NOTICE 'Total NOTIFY triggers: %', trigger_count;
    
    -- List all NOTIFY triggers
    FOR trigger_check IN
        SELECT 
            t.tgname AS trigger_name,
            c.relname AS table_name,
            p.proname AS function_name,
            CASE 
                WHEN t.tgenabled = 'O' THEN '✅ Enabled'
                WHEN t.tgenabled = 'D' THEN '❌ Disabled'
                ELSE '⚠️ Unknown'
            END AS status
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE t.tgname LIKE 'notify%' OR t.tgname LIKE '%_notify'
        ORDER BY c.relname, t.tgname
    LOOP
        RAISE NOTICE '  Trigger: % on % (function: %) - %',
            trigger_check.trigger_name,
            trigger_check.table_name,
            trigger_check.function_name,
            trigger_check.status;
    END LOOP;
END $$;

-- ============================================================================
-- 4. REFRESH MATERIALIZED VIEWS
-- ============================================================================

DO $$
DECLARE
    mv_check RECORD;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    duration INTERVAL;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Refreshing Materialized Views ===';
    
    -- Refresh mv_pipeline_lag_24h
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_pipeline_lag_24h') THEN
        start_time := clock_timestamp();
        RAISE NOTICE 'Refreshing mv_pipeline_lag_24h...';
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pipeline_lag_24h;
        end_time := clock_timestamp();
        duration := end_time - start_time;
        RAISE NOTICE '✅ mv_pipeline_lag_24h refreshed in %', duration;
    ELSE
        RAISE WARNING '❌ mv_pipeline_lag_24h does not exist';
    END IF;
    
    -- Refresh mv_capper_performance
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_capper_performance') THEN
        start_time := clock_timestamp();
        RAISE NOTICE 'Refreshing mv_capper_performance...';
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_capper_performance;
        end_time := clock_timestamp();
        duration := end_time - start_time;
        RAISE NOTICE '✅ mv_capper_performance refreshed in %', duration;
    ELSE
        RAISE WARNING '❌ mv_capper_performance does not exist';
    END IF;
    
    -- List all materialized views
    RAISE NOTICE '';
    RAISE NOTICE 'All materialized views:';
    FOR mv_check IN
        SELECT 
            schemaname,
            matviewname,
            pg_size_pretty(pg_total_relation_size(schemaname || '.' || matviewname)) AS size,
            CASE WHEN ispopulated THEN '✅ Populated' ELSE '❌ Not populated' END AS status
        FROM pg_matviews
        WHERE schemaname = 'public'
        ORDER BY matviewname
    LOOP
        RAISE NOTICE '  MV: %.% (%) - %',
            mv_check.schemaname,
            mv_check.matviewname,
            mv_check.size,
            mv_check.status;
    END LOOP;
END $$;

-- ============================================================================
-- 5. CHECK INDEX USAGE VIA pg_stat_statements
-- ============================================================================

DO $$
DECLARE
    slow_query RECORD;
    unused_index RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Checking Index Usage ===';
    
    -- Check if pg_stat_statements is enabled
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
        RAISE WARNING '❌ pg_stat_statements extension not installed';
        RAISE NOTICE 'To install: CREATE EXTENSION pg_stat_statements;';
    ELSE
        RAISE NOTICE '✅ pg_stat_statements extension installed';
        
        -- Find slow queries (> 100ms average)
        RAISE NOTICE '';
        RAISE NOTICE 'Top 10 slowest queries (avg > 100ms):';
        FOR slow_query IN
            SELECT 
                LEFT(query, 80) AS query_snippet,
                calls,
                ROUND(mean_exec_time::numeric, 2) AS avg_time_ms,
                ROUND(total_exec_time::numeric, 2) AS total_time_ms
            FROM pg_stat_statements
            WHERE mean_exec_time > 100
            ORDER BY mean_exec_time DESC
            LIMIT 10
        LOOP
            RAISE NOTICE '  Query: % | Calls: % | Avg: %ms | Total: %ms',
                slow_query.query_snippet,
                slow_query.calls,
                slow_query.avg_time_ms,
                slow_query.total_time_ms;
        END LOOP;
    END IF;
    
    -- Find unused indexes (idx_scan < 100)
    RAISE NOTICE '';
    RAISE NOTICE 'Potentially unused indexes (scans < 100):';
    FOR unused_index IN
        SELECT 
            schemaname,
            tablename,
            indexname,
            idx_scan,
            pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        AND idx_scan < 100
        ORDER BY pg_relation_size(indexrelid) DESC
        LIMIT 10
    LOOP
        RAISE NOTICE '  Index: %.%.% | Scans: % | Size: %',
            unused_index.schemaname,
            unused_index.tablename,
            unused_index.indexname,
            unused_index.idx_scan,
            unused_index.index_size;
    END LOOP;
END $$;

-- ============================================================================
-- 6. UPDATE TABLE STATISTICS
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Updating Table Statistics ===';
    
    -- Analyze all tables
    ANALYZE;
    
    RAISE NOTICE '✅ Table statistics updated';
END $$;

-- ============================================================================
-- 7. VACUUM ANALYZE (Optional - comment out if not needed)
-- ============================================================================

-- Uncomment to run VACUUM ANALYZE during nightly maintenance
-- VACUUM ANALYZE;

-- ============================================================================
-- 8. SUMMARY REPORT
-- ============================================================================

DO $$
DECLARE
    db_size TEXT;
    table_count INTEGER;
    index_count INTEGER;
    mv_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Database Summary ===';
    
    -- Database size
    SELECT pg_size_pretty(pg_database_size(current_database())) INTO db_size;
    RAISE NOTICE 'Database size: %', db_size;
    
    -- Table count
    SELECT COUNT(*) INTO table_count FROM pg_tables WHERE schemaname = 'public';
    RAISE NOTICE 'Total tables: %', table_count;
    
    -- Index count
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE schemaname = 'public';
    RAISE NOTICE 'Total indexes: %', index_count;
    
    -- Materialized view count
    SELECT COUNT(*) INTO mv_count FROM pg_matviews WHERE schemaname = 'public';
    RAISE NOTICE 'Total materialized views: %', mv_count;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Nightly baseline maintenance completed successfully';
    RAISE NOTICE 'Timestamp: %', NOW();
END $$;

