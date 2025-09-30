-- =============================================================================
-- UNIT TALK SYNDICATE-GRADE DATABASE SCHEMA - ROLLBACK SCRIPT
-- Master Rollback Script for Complete Schema Removal
-- =============================================================================

-- Rollback Information
-- Created: 2025-09-10  
-- Version: 1.0.0
-- Purpose: Complete rollback of syndicate-grade schema additions

\echo '=========================================================================='
\echo 'ROLLING BACK UNIT TALK SYNDICATE-GRADE DATABASE SCHEMA'
\echo 'WARNING: This will remove all performance optimizations and new tables'
\echo '=========================================================================='

-- Prompt for confirmation in interactive mode
-- \prompt 'Are you sure you want to proceed with complete rollback? (yes/no): ' confirm
-- \if :{?confirm}
--   \if :confirm != 'yes'
--     \echo 'Rollback cancelled by user'
--     \q
--   \endif
-- \endif

-- Enable transaction mode for atomic rollback
BEGIN;

\echo 'Step 1/5: Rolling back comprehensive indexes and performance optimizations...'
\i rollback_014_comprehensive_indexes.sql

\echo 'Step 2/5: Rolling back SLO monitoring and incident management system...'
\i rollback_013_system_incidents_slo.sql

\echo 'Step 3/5: Rolling back ticket state management system...'
\i rollback_012_ticket_state_management.sql

\echo 'Step 4/5: Rolling back feature store and aggregation system...'
\i rollback_011_features_daily_agg.sql

\echo 'Step 5/5: Rolling back high-volume tick data system...'
\i rollback_010_prop_ticks_hot.sql

-- Verify rollback completed successfully
\echo 'Verifying rollback completion...'

DO $$
DECLARE
  remaining_tables TEXT[] := '{}';
  remaining_functions INTEGER;
  remaining_indexes INTEGER;
BEGIN
  -- Check that new tables were removed
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prop_ticks_hot') THEN
    remaining_tables := array_append(remaining_tables, 'prop_ticks_hot');
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'features_daily_agg') THEN
    remaining_tables := array_append(remaining_tables, 'features_daily_agg');
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'betting_tickets') THEN
    remaining_tables := array_append(remaining_tables, 'betting_tickets');
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_incidents') THEN
    remaining_tables := array_append(remaining_tables, 'system_incidents');
  END IF;
  
  -- Check remaining functions
  SELECT COUNT(*) INTO remaining_functions
  FROM pg_proc 
  WHERE proname IN (
    'bulk_insert_prop_ticks', 'get_prop_features', 'update_ticket_state', 
    'check_slo_violations', 'get_user_recent_performance', 'batch_compute_features',
    'detect_hedge_opportunities', 'escalate_stale_incidents'
  );
  
  -- Check remaining specialized indexes
  SELECT COUNT(*) INTO remaining_indexes
  FROM pg_indexes 
  WHERE schemaname = 'public' 
  AND (indexname LIKE '%prop_ticks%' OR 
       indexname LIKE '%features_daily%' OR 
       indexname LIKE '%betting_tickets%' OR 
       indexname LIKE '%system_incidents%');
  
  -- Report results
  IF array_length(remaining_tables, 1) > 0 THEN
    RAISE WARNING 'Rollback incomplete - remaining tables: %', array_to_string(remaining_tables, ', ');
  ELSE
    RAISE NOTICE 'All new tables successfully removed';
  END IF;
  
  IF remaining_functions > 0 THEN
    RAISE WARNING 'Rollback incomplete - % functions still exist', remaining_functions;
  ELSE
    RAISE NOTICE 'All new functions successfully removed';
  END IF;
  
  IF remaining_indexes > 0 THEN
    RAISE WARNING 'Rollback incomplete - % specialized indexes still exist', remaining_indexes;
  ELSE
    RAISE NOTICE 'All specialized indexes successfully removed';
  END IF;
END
$$;

-- Display rollback summary
\echo ''
\echo '=========================================================================='
\echo 'ROLLBACK SUMMARY'
\echo '=========================================================================='

SELECT 
  'Syndicate Tables Removed' as category,
  COUNT(*) as count
FROM (
  SELECT 'prop_ticks_hot' as table_name WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prop_ticks_hot')
  UNION ALL
  SELECT 'features_daily_agg' WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'features_daily_agg')  
  UNION ALL
  SELECT 'betting_tickets' WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'betting_tickets')
  UNION ALL
  SELECT 'system_incidents' WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_incidents')
) removed_tables

UNION ALL

SELECT 
  'Performance Functions Removed' as category,
  (8 - COUNT(*)) as count
FROM pg_proc 
WHERE proname IN (
  'bulk_insert_prop_ticks', 'get_prop_features', 'update_ticket_state', 
  'check_slo_violations', 'get_user_recent_performance', 'batch_compute_features',
  'detect_hedge_opportunities', 'escalate_stale_incidents'
)

UNION ALL

SELECT 
  'Monitoring Views Removed' as category,
  (5 - COUNT(*)) as count
FROM information_schema.views 
WHERE table_schema = 'public'
AND table_name IN ('prop_ticks_performance', 'feature_freshness_monitor', 'active_tickets_monitor', 'incident_metrics_dashboard', 'slow_queries_monitor')

ORDER BY category;

-- Check for any remaining objects that should have been removed
\echo ''
\echo 'REMAINING OBJECTS CHECK:'

-- Check for any remaining prop_ticks related objects
SELECT 'prop_ticks objects' as type, COUNT(*) as remaining
FROM (
  SELECT 'table' as obj_type, table_name as name FROM information_schema.tables WHERE table_name LIKE '%prop_ticks%'
  UNION ALL
  SELECT 'function' as obj_type, proname FROM pg_proc WHERE proname LIKE '%prop_ticks%'
  UNION ALL  
  SELECT 'index' as obj_type, indexname FROM pg_indexes WHERE indexname LIKE '%prop_ticks%'
) remaining_objects

UNION ALL

-- Check for any remaining features related objects  
SELECT 'features objects' as type, COUNT(*) as remaining
FROM (
  SELECT 'table' as obj_type, table_name as name FROM information_schema.tables WHERE table_name LIKE '%feature%'
  UNION ALL
  SELECT 'function' as obj_type, proname FROM pg_proc WHERE proname LIKE '%feature%'
  UNION ALL
  SELECT 'index' as obj_type, indexname FROM pg_indexes WHERE indexname LIKE '%feature%'
) remaining_objects

UNION ALL

-- Check for any remaining betting/ticket related objects
SELECT 'betting/ticket objects' as type, COUNT(*) as remaining  
FROM (
  SELECT 'table' as obj_type, table_name as name FROM information_schema.tables WHERE table_name LIKE '%ticket%' OR table_name LIKE '%betting%'
  UNION ALL
  SELECT 'function' as obj_type, proname FROM pg_proc WHERE proname LIKE '%ticket%' OR proname LIKE '%betting%'
  UNION ALL
  SELECT 'index' as obj_type, indexname FROM pg_indexes WHERE indexname LIKE '%ticket%' OR indexname LIKE '%betting%'
) remaining_objects

UNION ALL

-- Check for any remaining incident/slo related objects
SELECT 'incident/slo objects' as type, COUNT(*) as remaining
FROM (
  SELECT 'table' as obj_type, table_name as name FROM information_schema.tables WHERE table_name LIKE '%incident%' OR table_name LIKE '%slo%'
  UNION ALL
  SELECT 'function' as obj_type, proname FROM pg_proc WHERE proname LIKE '%incident%' OR proname LIKE '%slo%'
  UNION ALL
  SELECT 'index' as obj_type, indexname FROM pg_indexes WHERE indexname LIKE '%incident%' OR indexname LIKE '%slo%'
) remaining_objects;

-- Commit the rollback transaction
COMMIT;

\echo ''
\echo '=========================================================================='
\echo 'SYNDICATE-GRADE SCHEMA ROLLBACK COMPLETED'
\echo ''
\echo 'REMOVED COMPONENTS:'
\echo '• High-volume tick data system (prop_ticks_hot + partitions)'
\echo '• Feature store with 45-factor aggregations (features_daily_agg)'
\echo '• Advanced ticket state management (betting_tickets + legs)'
\echo '• Enterprise SLO monitoring (system_incidents + timeline)'
\echo '• Comprehensive performance indexes (25+ specialized indexes)'
\echo ''
\echo 'PERFORMANCE IMPACT:'
\echo '• Query performance may degrade without specialized indexes'
\echo '• High-volume operations no longer optimized'
\echo '• Feature computation capabilities removed'
\echo '• Automated incident management disabled'
\echo ''
\echo 'RECOMMENDATIONS:'
\echo '1. Monitor query performance after rollback'
\echo '2. Consider re-applying schema if performance degrades'
\echo '3. Backup existing data before future schema changes'
\echo '4. Test application functionality with reduced capabilities'
\echo '=========================================================================='

\echo ''
\echo 'ROLLBACK VERIFICATION COMMANDS:'
\echo '-- Check for any remaining syndicate-grade objects:'
\echo '-- SELECT table_name FROM information_schema.tables WHERE table_name LIKE ''%prop_ticks%'' OR table_name LIKE ''%features_daily%'';'
\echo '-- SELECT proname FROM pg_proc WHERE proname LIKE ''%syndicate%'' OR proname LIKE ''%bulk_insert%'';'
\echo '-- SELECT indexname FROM pg_indexes WHERE indexname LIKE ''%_gin'' OR indexname LIKE ''%_brin'';'
\echo ''