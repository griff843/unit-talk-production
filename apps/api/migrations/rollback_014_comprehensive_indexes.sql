-- =============================================================================
-- ROLLBACK: COMPREHENSIVE INDEXES AND PERFORMANCE OPTIMIZATIONS
-- Purpose: Safe rollback procedures for performance optimization objects
-- =============================================================================

-- 1) Drop all functions (in reverse dependency order)
DROP FUNCTION IF EXISTS suggest_missing_indexes();
DROP FUNCTION IF EXISTS update_table_statistics();
DROP FUNCTION IF EXISTS get_prop_market_data(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_user_recent_performance(UUID, INTEGER);

-- 2) Drop views
DROP VIEW IF EXISTS lock_monitor;
DROP VIEW IF EXISTS connection_monitor;
DROP VIEW IF EXISTS table_bloat_monitor;
DROP VIEW IF EXISTS index_usage_monitor;
DROP VIEW IF EXISTS slow_queries_monitor;

-- 3) Revoke permissions
REVOKE ALL ON slow_queries_monitor FROM monitoring_service;
REVOKE ALL ON index_usage_monitor FROM monitoring_service;
REVOKE ALL ON table_bloat_monitor FROM monitoring_service;
REVOKE ALL ON connection_monitor FROM monitoring_service;
REVOKE ALL ON lock_monitor FROM monitoring_service;

-- 4) Drop all performance indexes (in batches to avoid long transactions)

-- UNIFIED_PICKS performance indexes
DROP INDEX IF EXISTS idx_unified_picks_grading_pipeline;
DROP INDEX IF EXISTS idx_unified_picks_user_recent_performance;
DROP INDEX IF EXISTS idx_unified_picks_prop_analysis;
DROP INDEX IF EXISTS idx_unified_picks_sharp_grading;
DROP INDEX IF EXISTS idx_unified_picks_clv_tracking;

-- UNIFIED_PICKS JSONB indexes
DROP INDEX IF EXISTS idx_unified_picks_insights_gin;
DROP INDEX IF EXISTS idx_unified_picks_features_gin;
DROP INDEX IF EXISTS idx_unified_picks_risk_gin;

-- RAW_PROPS performance indexes
DROP INDEX IF EXISTS idx_raw_props_market_lookup;
DROP INDEX IF EXISTS idx_raw_props_game_props;
DROP INDEX IF EXISTS idx_raw_props_player_name_trgm;
DROP INDEX IF EXISTS idx_raw_props_fresh_data;

-- GAMES performance indexes
DROP INDEX IF EXISTS idx_games_live_tracking;
DROP INDEX IF EXISTS idx_games_today_tomorrow;
DROP INDEX IF EXISTS idx_games_team_search;

-- USERS performance indexes
DROP INDEX IF EXISTS idx_users_capper_leaderboard;
DROP INDEX IF EXISTS idx_users_tier_analytics;
DROP INDEX IF EXISTS idx_users_discord_lookup;

-- Agent system indexes
DROP INDEX IF EXISTS idx_agent_health_recent;
DROP INDEX IF EXISTS idx_agent_metrics_performance;

-- Temporal workflow indexes (if they exist)
DROP INDEX IF EXISTS idx_temporal_visibility_task_queue;

-- Multi-dimensional analytics indexes
DROP INDEX IF EXISTS idx_picks_analytics_cube;
DROP INDEX IF EXISTS idx_props_market_analysis;

-- Performance monitoring indexes
DROP INDEX IF EXISTS idx_picks_processing_performance;

-- Partitioned table template indexes (these may not exist as separate objects)
DROP INDEX IF EXISTS idx_prop_ticks_hot_template_prop_time;
DROP INDEX IF EXISTS idx_prop_ticks_hot_template_market_type;

-- 5) Remove any scheduled cron jobs (if pg_cron was used)
-- These are commented out as they were commented in the original migration
-- DELETE FROM cron.job WHERE jobname IN ('update-statistics', 'analyze-slow-queries');

-- 6) Drop extensions if not used by other objects (optional - commented for safety)
-- Note: These extensions are likely used by other parts of the system
-- DROP EXTENSION IF EXISTS pg_stat_statements;
-- DROP EXTENSION IF EXISTS pg_trgm;
-- DROP EXTENSION IF EXISTS btree_gin;
-- DROP EXTENSION IF EXISTS btree_gist;

-- 7) Reset pg_stat_statements (if it was reset by functions)
-- SELECT pg_stat_statements_reset(); -- Only if the extension is still present

-- =============================================================================
-- ROLLBACK VERIFICATION QUERIES
-- =============================================================================
-- Run these queries to verify complete rollback:

-- Verify performance functions are dropped
-- SELECT COUNT(*) FROM pg_proc 
-- WHERE proname IN (
--   'get_user_recent_performance', 'get_prop_market_data', 
--   'update_table_statistics', 'suggest_missing_indexes'
-- );

-- Verify monitoring views are dropped
-- SELECT COUNT(*) FROM information_schema.views 
-- WHERE table_name IN (
--   'slow_queries_monitor', 'index_usage_monitor', 'table_bloat_monitor',
--   'connection_monitor', 'lock_monitor'
-- );

-- Verify performance indexes are dropped (sample check)
-- SELECT COUNT(*) FROM pg_indexes 
-- WHERE indexname LIKE 'idx_%_performance%' 
--    OR indexname LIKE 'idx_%_grading_pipeline%'
--    OR indexname LIKE 'idx_%_analytics_cube%';

-- Check for any remaining custom indexes on core tables
-- SELECT indexname, tablename 
-- FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- AND indexname LIKE 'idx_%' 
-- AND tablename IN ('unified_picks', 'raw_props', 'games', 'users')
-- ORDER BY tablename, indexname;

-- =============================================================================
-- ROLLBACK NOTES
-- =============================================================================
-- 1. This rollback removes performance optimizations but does not affect data
-- 2. Core table indexes that existed before this migration are preserved
-- 3. Query performance may degrade after rollback
-- 4. Re-applying the migration will recreate all performance optimizations
-- 5. Monitor query performance after rollback and consider re-applying
-- =============================================================================

-- =============================================================================
-- ROLLBACK COMPLETE
-- =============================================================================