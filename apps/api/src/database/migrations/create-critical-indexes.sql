-- Critical Database Indexes for Production Performance
-- These indexes address the performance bottlenecks identified in the audit
-- Execute with CONCURRENTLY to avoid blocking production traffic

-- ========================================
-- UNIFIED PICKS TABLE INDEXES
-- ========================================

-- Index for user-specific pick queries (most common query pattern)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_user_date 
ON unified_picks (user_id, created_at DESC);

-- Index for pick status and grading queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_status_grade 
ON unified_picks (status, grade, created_at DESC);

-- Index for prop-specific queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_prop_id 
ON unified_picks (prop_id, created_at DESC);

-- Composite index for dashboard queries (user + status + date)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_dashboard 
ON unified_picks (user_id, status, created_at DESC, grade);

-- ========================================
-- RAW PROPS TABLE INDEXES
-- ========================================

-- Index for unprocessed props (grading pipeline)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_unprocessed 
ON raw_props (processed_at, pro_attempts) 
WHERE processed_at IS NULL;

-- Index for sport and stat type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_sport_stat 
ON raw_props (sport, stat_type, created_at DESC);

-- Index for player-specific queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_player 
ON raw_props (player_name, sport, created_at DESC);

-- Index for odds-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_odds 
ON raw_props (over_odds, under_odds, created_at DESC);

-- Index for tier-based queries (graded props)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_tier 
ON raw_props (tier, edge_score, created_at DESC) 
WHERE tier IS NOT NULL;

-- ========================================
-- AGENT HEALTH AND METRICS INDEXES
-- ========================================

-- Index for agent health monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_health_timestamp 
ON agent_health (timestamp DESC, agent_name, status);

-- Index for agent metrics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_metrics_timestamp 
ON agent_metrics (timestamp DESC, agent_name);

-- Index for agent performance analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_metrics_performance 
ON agent_metrics (agent_name, timestamp DESC, processed_count, error_count);

-- ========================================
-- USERS TABLE INDEXES
-- ========================================

-- Index for Discord ID lookups (common in Discord bot)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_discord_id 
ON users (discord_id) 
WHERE discord_id IS NOT NULL;

-- Index for username lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username 
ON users (username);

-- Index for tier-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_tier 
ON users (tier, created_at DESC);

-- ========================================
-- EVENTS TABLE INDEXES (if exists)
-- ========================================

-- Index for event processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_processed 
ON events (processed_at, event_type, created_at DESC) 
WHERE processed_at IS NULL;

-- Index for event type queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_type_timestamp 
ON events (event_type, created_at DESC);

-- ========================================
-- BRIDGE OUTBOX TABLE INDEXES (if exists)
-- ========================================

-- Index for outbox processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bridge_outbox_processed 
ON bridge_outbox (processed_at, created_at ASC) 
WHERE processed_at IS NULL;

-- Index for event correlation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bridge_outbox_correlation 
ON bridge_outbox (correlation_id, created_at DESC);

-- ========================================
-- PERFORMANCE MONITORING QUERIES
-- ========================================

-- Query to check index usage
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes 
-- ORDER BY idx_scan DESC;

-- Query to check table sizes
-- SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Query to check slow queries
-- SELECT query, mean_time, calls, total_time 
-- FROM pg_stat_statements 
-- ORDER BY mean_time DESC 
-- LIMIT 10;

-- ========================================
-- INDEX MAINTENANCE COMMANDS
-- ========================================

-- Analyze tables after index creation
ANALYZE unified_picks;
ANALYZE raw_props;
ANALYZE agent_health;
ANALYZE agent_metrics;
ANALYZE users;

-- Update table statistics
UPDATE pg_stat_user_tables SET n_tup_ins = n_tup_ins WHERE schemaname = 'public';

-- ========================================
-- PERFORMANCE VALIDATION
-- ========================================

-- Test query performance after index creation
-- EXPLAIN (ANALYZE, BUFFERS) 
-- SELECT * FROM unified_picks 
-- WHERE user_id = 'test-user-id' 
-- ORDER BY created_at DESC 
-- LIMIT 50;

-- EXPLAIN (ANALYZE, BUFFERS) 
-- SELECT * FROM raw_props 
-- WHERE processed_at IS NULL 
-- ORDER BY created_at ASC 
-- LIMIT 200;
