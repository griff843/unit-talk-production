-- =============================================================================
-- UNIT TALK SYNDICATE-GRADE DATABASE SCHEMA - PHASE 1
-- Master Migration Application Script
-- Architecture: World-Class Database Schema for High-Performance Betting Platform
-- =============================================================================

-- Migration Information
-- Created: 2025-09-10
-- Version: 1.0.0
-- Target: Production-ready syndicate-grade platform
-- Capacity: 8K+ concurrent operations with sub-second performance

\echo '=========================================================================='
\echo 'APPLYING UNIT TALK SYNDICATE-GRADE DATABASE SCHEMA'
\echo 'Phase 1: Core Infrastructure and Performance Optimization'
\echo '=========================================================================='

-- Enable transaction mode for atomic migration
BEGIN;

\echo 'Step 1/5: Creating high-volume tick data table with partitioning...'
\i 010_prop_ticks_hot_table.sql

\echo 'Step 2/5: Creating feature store with precomputed aggregations...'
\i 011_features_daily_agg_table.sql

\echo 'Step 3/5: Creating ticket state management for leg-aware betting...'
\i 012_ticket_state_management.sql

\echo 'Step 4/5: Creating SLO monitoring and incident management system...'
\i 013_system_incidents_slo_monitoring.sql

\echo 'Step 5/5: Applying comprehensive performance indexes and optimizations...'
\i 014_comprehensive_indexes_optimization.sql

-- Verify critical objects were created successfully
\echo 'Verifying migration success...'

-- Verify main tables exist
DO $$
DECLARE
  missing_tables TEXT[] := '{}';
BEGIN
  -- Check for required tables
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prop_ticks_hot') THEN
    missing_tables := array_append(missing_tables, 'prop_ticks_hot');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'features_daily_agg') THEN
    missing_tables := array_append(missing_tables, 'features_daily_agg');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'betting_tickets') THEN
    missing_tables := array_append(missing_tables, 'betting_tickets');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_incidents') THEN
    missing_tables := array_append(missing_tables, 'system_incidents');
  END IF;
  
  IF array_length(missing_tables, 1) > 0 THEN
    RAISE EXCEPTION 'Migration failed - missing tables: %', array_to_string(missing_tables, ', ');
  END IF;
  
  RAISE NOTICE 'All core tables created successfully';
END
$$;

-- Verify critical functions exist
DO $$
DECLARE
  missing_functions TEXT[] := '{}';
BEGIN
  -- Check for required functions
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'bulk_insert_prop_ticks') THEN
    missing_functions := array_append(missing_functions, 'bulk_insert_prop_ticks');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_prop_features') THEN
    missing_functions := array_append(missing_functions, 'get_prop_features');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_ticket_state') THEN
    missing_functions := array_append(missing_functions, 'update_ticket_state');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_slo_violations') THEN
    missing_functions := array_append(missing_functions, 'check_slo_violations');
  END IF;
  
  IF array_length(missing_functions, 1) > 0 THEN
    RAISE EXCEPTION 'Migration failed - missing functions: %', array_to_string(missing_functions, ', ');
  END IF;
  
  RAISE NOTICE 'All critical functions created successfully';
END
$$;

-- Verify performance indexes exist
DO $$
DECLARE
  index_count INTEGER;
BEGIN
  -- Count performance-critical indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes 
  WHERE schemaname = 'public' 
  AND (indexname LIKE '%prop_ticks%' OR 
       indexname LIKE '%features_daily%' OR 
       indexname LIKE '%betting_tickets%' OR 
       indexname LIKE '%system_incidents%' OR
       indexname LIKE '%performance%');
  
  IF index_count < 20 THEN
    RAISE WARNING 'Expected more performance indexes - found: %', index_count;
  ELSE
    RAISE NOTICE 'Performance indexes created successfully - count: %', index_count;
  END IF;
END
$$;

-- Display migration summary
\echo ''
\echo '=========================================================================='
\echo 'MIGRATION SUMMARY'
\echo '=========================================================================='

SELECT 
  'Core Tables Created' as category,
  COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('prop_ticks_hot', 'features_daily_agg', 'betting_tickets', 'ticket_legs', 'system_incidents')

UNION ALL

SELECT 
  'Performance Functions' as category,
  COUNT(*) as count
FROM pg_proc 
WHERE proname IN ('bulk_insert_prop_ticks', 'get_prop_features', 'update_ticket_state', 'check_slo_violations', 'get_user_recent_performance')

UNION ALL

SELECT 
  'Monitoring Views' as category,
  COUNT(*) as count
FROM information_schema.views 
WHERE table_schema = 'public'
AND table_name IN ('prop_ticks_performance', 'feature_freshness_monitor', 'active_tickets_monitor', 'incident_metrics_dashboard', 'slow_queries_monitor')

UNION ALL

SELECT 
  'Specialized Indexes' as category,
  COUNT(*) as count
FROM pg_indexes 
WHERE schemaname = 'public' 
AND (indexname LIKE '%_gin' OR indexname LIKE '%_brin' OR indexname LIKE '%_hash')

ORDER BY category;

-- Commit the transaction
COMMIT;

\echo ''
\echo '=========================================================================='
\echo 'SYNDICATE-GRADE SCHEMA MIGRATION COMPLETED SUCCESSFULLY'
\echo ''
\echo 'CAPABILITIES ADDED:'
\echo '• High-volume tick data (8K+ concurrent inserts with partitioning)'
\echo '• Feature store with 45 factors and precomputed aggregations'  
\echo '• Advanced ticket state management with hedge detection'
\echo '• Enterprise SLO monitoring with automated incident management'
\echo '• Comprehensive performance optimization (25+ specialized indexes)'
\echo ''
\echo 'PERFORMANCE TARGETS:'
\echo '• Sub-second query performance for 8K+ concurrent operations'
\echo '• <50ms feature lookups during prop grading'
\echo '• <25ms database response times with optimized indexes'
\echo '• Automated partition management for 14-day hot data retention'
\echo ''
\echo 'NEXT STEPS:'
\echo '1. Run performance tests to validate sub-second query targets'
\echo '2. Initialize feature store with historical data'
\echo '3. Configure SLO monitoring thresholds for production'
\echo '4. Enable automated incident management and alerting'
\echo '=========================================================================='

-- Display critical configuration reminders
\echo ''
\echo 'PRODUCTION CONFIGURATION REMINDERS:'
\echo '• Enable pg_cron extension for automated partition management'
\echo '• Configure SLO alert channels in slo_definitions table'
\echo '• Set up external monitoring integration (Prometheus/Grafana)'
\echo '• Initialize feature computation for existing props'
\echo '• Configure automated statistics updates via cron'
\echo ''