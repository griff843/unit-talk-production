-- ============================================================================
-- Phase 4 Index Optimization: Covering and Partial Indexes
-- Generated: 2025-10-22
-- Purpose: Add 8 high-impact indexes for query performance optimization
-- Remediation for: QUERY_INDEX_MAP.md recommendations
-- ============================================================================

BEGIN;

SET search_path = public;

-- ============================================================================
-- P0: CRITICAL INDEXES (Game Date Queries)
-- ============================================================================

-- Index 1: Covering index for v_prop_read_model (5000 queries/day)
-- Estimated impact: -85% query time (2000ms → 300ms)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_props_game_date_covering
ON public.market_props(game_date, id, sport, market, selection, line, odds, created_at)
WHERE game_date >= CURRENT_DATE;

COMMENT ON INDEX idx_market_props_game_date_covering IS 
'Covering index for v_prop_read_model. Includes all columns needed to avoid table lookups.';

-- Index 2: Tier/edge covering index for v_daily_board (400 queries/day)
-- Estimated impact: -80% query time (1500ms → 300ms)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scored_props_tier_edge_covering
ON public.scored_props(tier, edge DESC)
INCLUDE (prop_ref, professional_score, confidence, prob_win)
WHERE tier IN ('S', 'A', 'B');

COMMENT ON INDEX idx_scored_props_tier_edge_covering IS 
'Covering index for v_daily_board. Filters on S/A/B tiers and sorts by edge DESC.';

-- ============================================================================
-- P1: HIGH PRIORITY INDEXES
-- ============================================================================

-- Index 3: Promotion queue status/source index (500 queries/day)
-- Estimated impact: -80% query time (1000ms → 200ms)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_promotion_queue_status_source
ON public.promotion_queue(status, source, created_at)
WHERE status IN ('pending', 'approved');

COMMENT ON INDEX idx_promotion_queue_status_source IS 
'Composite index for promotion queue polling. Filters on pending/approved status.';

-- Index 4: Agent health monitoring index (2000 queries/day)
-- Estimated impact: -75% query time (500ms → 125ms)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_health_monitoring
ON public.agent_health(agent_name, last_ping DESC)
INCLUDE (status, metrics);

COMMENT ON INDEX idx_agent_health_monitoring IS 
'Index for agent watchdog queries. Includes status and metrics to avoid table lookups.';

-- ============================================================================
-- P2: MEDIUM PRIORITY INDEXES
-- ============================================================================

-- Index 5: Raw props external game ID index (3000 queries/day)
-- Estimated impact: -60% query time (800ms → 320ms)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_external_game_id
ON public.raw_props(external_game_id, game_date)
INCLUDE (metadata);

COMMENT ON INDEX idx_raw_props_external_game_id IS 
'Index for raw props lookups by external_game_id. Includes metadata for enrichment.';

-- Index 6: Unified picks user/status index (1000 queries/day)
-- Estimated impact: -50% query time (600ms → 300ms)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_user_id_status
ON public.unified_picks(user_id, status, created_at)
WHERE status IN ('pending', 'approved');

COMMENT ON INDEX idx_unified_picks_user_id_status IS 
'Index for user pick queries filtered by status. Partial index on pending/approved only.';

-- ============================================================================
-- P3: ADDITIONAL PERFORMANCE INDEXES
-- ============================================================================

-- Index 7: Raw props game_date + sport composite (800 queries/day)
-- Estimated impact: -55% query time (700ms → 315ms)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_game_date_sport
ON public.raw_props(game_date, sport)
WHERE game_date >= CURRENT_DATE;

COMMENT ON INDEX idx_raw_props_game_date_sport IS 
'Partial index for today+ props filtered by sport. Used in FeedAgent queries.';

-- Index 8: Scored props prop_ref lookup (3000 queries/day)
-- Estimated impact: -70% query time (400ms → 120ms)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scored_props_prop_ref
ON public.scored_props(prop_ref)
INCLUDE (professional_score, tier, edge, confidence);

COMMENT ON INDEX idx_scored_props_prop_ref IS 
'Index for scored_props lookups by prop_ref. Includes key scoring metrics.';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================

-- Verify all indexes created
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;

-- Check index sizes
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'idx_%'
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- Monitor index usage (run after 24 hours)
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan AS scans,
--   idx_tup_read AS tuples_read,
--   idx_tup_fetch AS tuples_fetched,
--   pg_size_pretty(pg_relation_size(indexrelid)) AS size
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'idx_%'
-- ORDER BY idx_scan DESC;

-- ============================================================================
-- PERFORMANCE IMPACT SUMMARY
-- ============================================================================

-- Expected improvements:
-- - v_prop_read_model: 2000ms → 300ms (-85%)
-- - v_daily_board: 1500ms → 300ms (-80%)
-- - Promotion queue polling: 1000ms → 200ms (-80%)
-- - Agent health checks: 500ms → 125ms (-75%)
-- - Raw props lookups: 800ms → 320ms (-60%)
-- - User pick queries: 600ms → 300ms (-50%)
-- - Sport-filtered props: 700ms → 315ms (-55%)
-- - Scored props lookups: 400ms → 120ms (-70%)

-- Total estimated query time reduction: ~70% average across all queries

-- ============================================================================
-- ROLLBACK PROCEDURE (if needed)
-- ============================================================================

-- To rollback this migration:
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_market_props_game_date_covering;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_scored_props_tier_edge_covering;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_promotion_queue_status_source;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_agent_health_monitoring;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_raw_props_external_game_id;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_unified_picks_user_id_status;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_raw_props_game_date_sport;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_scored_props_prop_ref;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

