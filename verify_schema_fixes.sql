-- ============================================================================
-- QUICK SCHEMA VERIFICATION SCRIPT
-- File: verify_schema_fixes.sql
-- Date: September 29, 2025
-- Purpose: Quick verification that all critical schema issues are resolved
-- Usage: Run this after applying migration 028 to verify system readiness
-- ============================================================================

-- Set up verification tracking
CREATE TEMP TABLE verification_results (
    test_name TEXT,
    status TEXT,
    details TEXT,
    critical BOOLEAN DEFAULT true
);

-- ============================================================================
-- TEST 1: SPORTS_GAME_ODDS.PLAYER_NAME COLUMN
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sports_game_odds' AND column_name = 'player_name'
    ) THEN
        INSERT INTO verification_results VALUES (
            'sports_game_odds.player_name',
            '✅ PASS',
            'Column exists and ready for FeedAgent queries',
            true
        );
    ELSE
        INSERT INTO verification_results VALUES (
            'sports_game_odds.player_name',
            '❌ FAIL',
            'Column missing - FeedAgent will fail',
            true
        );
    END IF;
END $$;

-- ============================================================================
-- TEST 2: UNIFIED_PICKS ENHANCED45FACTOR COLUMNS
-- ============================================================================

DO $$
DECLARE
    missing_columns TEXT[] := ARRAY[]::TEXT[];
    col TEXT;
    required_columns TEXT[] := ARRAY[
        'professional_score',
        'feature_contributions',
        'kelly_fraction',
        'devigged_edge',
        'clv_tracking_id',
        'processing_time',
        'rule_compliance_score',
        'tier'
    ];
BEGIN
    -- Check each required Enhanced45Factor column
    FOREACH col IN ARRAY required_columns LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'unified_picks' AND column_name = col
        ) THEN
            missing_columns := array_append(missing_columns, col);
        END IF;
    END LOOP;

    IF array_length(missing_columns, 1) > 0 THEN
        INSERT INTO verification_results VALUES (
            'unified_picks Enhanced45Factor columns',
            '❌ FAIL',
            'Missing columns: ' || array_to_string(missing_columns, ', '),
            true
        );
    ELSE
        INSERT INTO verification_results VALUES (
            'unified_picks Enhanced45Factor columns',
            '✅ PASS',
            'All Enhanced45Factor columns present',
            true
        );
    END IF;
END $$;

-- ============================================================================
-- TEST 3: FOREIGN KEY RELATIONSHIPS
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'unified_picks_user_id_fkey'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        INSERT INTO verification_results VALUES (
            'unified_picks -> users foreign key',
            '✅ PASS',
            'v3.0.0 compatible foreign key relationship',
            true
        );
    ELSE
        INSERT INTO verification_results VALUES (
            'unified_picks -> users foreign key',
            '❌ FAIL',
            'Foreign key relationship missing',
            true
        );
    END IF;
END $$;

-- ============================================================================
-- TEST 4: PERFORMANCE INDEXES
-- ============================================================================

DO $$
DECLARE
    missing_indexes TEXT[] := ARRAY[]::TEXT[];
    idx TEXT;
    required_indexes TEXT[] := ARRAY[
        'idx_sports_game_odds_player_name',
        'idx_unified_picks_professional_lookup',
        'idx_unified_picks_clv_tracking',
        'idx_unified_picks_clv_unique'
    ];
BEGIN
    FOREACH idx IN ARRAY required_indexes LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE indexname = idx
        ) THEN
            missing_indexes := array_append(missing_indexes, idx);
        END IF;
    END LOOP;

    IF array_length(missing_indexes, 1) > 0 THEN
        INSERT INTO verification_results VALUES (
            'Performance indexes',
            '⚠️  WARNING',
            'Missing indexes: ' || array_to_string(missing_indexes, ', '),
            false
        );
    ELSE
        INSERT INTO verification_results VALUES (
            'Performance indexes',
            '✅ PASS',
            'All critical performance indexes created',
            false
        );
    END IF;
END $$;

-- ============================================================================
-- TEST 5: DATA TYPE COMPATIBILITY
-- ============================================================================

DO $$
DECLARE
    users_id_type TEXT;
    unified_picks_user_id_type TEXT;
BEGIN
    -- Check users.id data type
    SELECT data_type INTO users_id_type
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'id';

    -- Check unified_picks.user_id data type
    SELECT data_type INTO unified_picks_user_id_type
    FROM information_schema.columns
    WHERE table_name = 'unified_picks' AND column_name = 'user_id';

    IF users_id_type = 'uuid' AND unified_picks_user_id_type = 'uuid' THEN
        INSERT INTO verification_results VALUES (
            'UUID data type compatibility',
            '✅ PASS',
            'Both users.id and unified_picks.user_id are UUID type',
            true
        );
    ELSE
        INSERT INTO verification_results VALUES (
            'UUID data type compatibility',
            '❌ FAIL',
            format('users.id: %s, unified_picks.user_id: %s', users_id_type, unified_picks_user_id_type),
            true
        );
    END IF;
END $$;

-- ============================================================================
-- TEST 6: ENHANCED45FACTOR SYSTEM READINESS
-- ============================================================================

DO $$
DECLARE
    professional_columns_count INTEGER;
    required_count INTEGER := 8; -- Minimum columns for Enhanced45Factor
BEGIN
    SELECT COUNT(*) INTO professional_columns_count
    FROM information_schema.columns
    WHERE table_name = 'unified_picks'
    AND column_name IN (
        'professional_score',
        'feature_contributions',
        'kelly_fraction',
        'devigged_edge',
        'clv_tracking_id',
        'processing_time',
        'rule_compliance_score',
        'tier'
    );

    IF professional_columns_count >= required_count THEN
        INSERT INTO verification_results VALUES (
            'Enhanced45Factor system readiness',
            '✅ PASS',
            format('%s/8 professional columns ready', professional_columns_count),
            true
        );
    ELSE
        INSERT INTO verification_results VALUES (
            'Enhanced45Factor system readiness',
            '❌ FAIL',
            format('Only %s/8 professional columns found', professional_columns_count),
            true
        );
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION REPORT
-- ============================================================================

-- Display comprehensive verification results
SELECT
    '🔍 SCHEMA VERIFICATION REPORT' as report_title,
    NOW() as verification_time;

SELECT
    test_name,
    status,
    details,
    CASE WHEN critical THEN '🔴 CRITICAL' ELSE '🟡 IMPORTANT' END as priority
FROM verification_results
ORDER BY critical DESC, test_name;

-- Summary of critical failures
DO $$
DECLARE
    critical_failures INTEGER;
    total_critical_tests INTEGER;
    system_ready BOOLEAN;
BEGIN
    SELECT
        COUNT(*) FILTER (WHERE status LIKE '%FAIL%' AND critical = true),
        COUNT(*) FILTER (WHERE critical = true)
    INTO critical_failures, total_critical_tests
    FROM verification_results;

    system_ready := (critical_failures = 0);

    -- Display final assessment
    IF system_ready THEN
        RAISE NOTICE '🎯 SYSTEM READY: All critical tests passed (%/% passed)',
            total_critical_tests - critical_failures, total_critical_tests;
        RAISE NOTICE '✅ Enhanced45Factor system is operational';
        RAISE NOTICE '✅ FeedAgent can process sports_game_odds.player_name queries';
        RAISE NOTICE '✅ Professional grading pipeline ready';
    ELSE
        RAISE WARNING '⚠️  SYSTEM NOT READY: % critical test(s) failed', critical_failures;
        RAISE WARNING '❌ Enhanced45Factor system requires fixes before operation';

        -- Show specific failures
        FOR rec IN
            SELECT test_name, details
            FROM verification_results
            WHERE status LIKE '%FAIL%' AND critical = true
        LOOP
            RAISE WARNING '❌ CRITICAL FAILURE: % - %', rec.test_name, rec.details;
        END LOOP;
    END IF;
END $$;

-- Performance metrics
SELECT
    '📊 SYSTEM METRICS' as metrics_title,
    (SELECT COUNT(*) FROM sports_game_odds) as total_game_odds,
    (SELECT COUNT(*) FROM unified_picks) as total_unified_picks,
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename IN ('sports_game_odds', 'unified_picks')) as total_indexes;

-- Show next steps
SELECT
    '🚀 NEXT STEPS' as guidance,
    ARRAY[
        'Run FeedAgent to test sports_game_odds.player_name queries',
        'Process props through Enhanced45Factor scoring system',
        'Verify CLV tracking system functionality',
        'Test professional grading automation triggers',
        'Monitor query performance with new indexes'
    ] as recommended_actions;

-- Cleanup
DROP TABLE verification_results;

-- Final status message
SELECT
    CASE
        WHEN (
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_name = 'sports_game_odds' AND column_name = 'player_name'
        ) > 0
        AND (
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_name = 'unified_picks'
            AND column_name IN ('professional_score', 'kelly_fraction', 'devigged_edge')
        ) >= 3
        THEN '🎯 SCHEMA VERIFICATION PASSED: System ready for Enhanced45Factor operation'
        ELSE '❌ SCHEMA VERIFICATION FAILED: Critical issues remain'
    END as final_status;