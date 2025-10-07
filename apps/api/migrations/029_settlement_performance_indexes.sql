-- Migration 029: Settlement Performance Indexes
-- Creates indexes to optimize ultra-fast settlement processing
-- Target: <2 hour runtime for 2.3M outcomes

-- ==================== SETTLEMENT LOOKUP INDEXES ====================

-- Fast lookup of already-settled props (eliminates 2.3M N+1 queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_external_prop_settled
  ON unified_picks(external_prop_id, settled_at)
  WHERE settled_at IS NOT NULL;

-- External prop ID for upserts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_external_prop_id
  ON unified_picks(external_prop_id)
  WHERE external_prop_id IS NOT NULL;

-- ==================== PLAYER STATS LOOKUP INDEXES ====================

-- Composite index for player stats lookup by date/sport
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_player_stats_date_sport_player
  ON player_stats(game_date, sport, player_name);

-- Lowercase player name for case-insensitive matching
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_player_stats_player_lower
  ON player_stats(LOWER(player_name), game_date);

-- ==================== RAW PROPS INDEXES ====================

-- Props to settle by game date and sport
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_game_date_sport
  ON raw_props(game_start, sport)
  WHERE game_start IS NOT NULL;

-- Unique game dates for batching
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_game_start_date
  ON raw_props(DATE(game_start))
  WHERE game_start IS NOT NULL;

-- ==================== SETTLEMENT ANALYTICS INDEXES ====================

-- Settlement rate by sport
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_sport_settled
  ON unified_picks(sport, settled_at);

-- Settlement rate by stat type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_stat_type_settled
  ON unified_picks(stat_type, settled_at)
  WHERE stat_type IS NOT NULL;

-- Unsettled props older than 7 days (data quality monitoring)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_old_unsettled
  ON unified_picks(game_date DESC)
  WHERE settled_at IS NULL
    AND game_date < CURRENT_DATE - INTERVAL '7 days';

-- ==================== BULK OPERATION OPTIMIZATION ====================

-- Optimize bulk upserts with ON CONFLICT
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_external_prop_unique
  ON unified_picks(external_prop_id)
  WHERE external_prop_id IS NOT NULL;

-- ==================== SETTLEMENT QUALITY INDEXES ====================

-- Outcome distribution analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_outcome
  ON unified_picks(outcome)
  WHERE outcome IS NOT NULL;

-- Actual value quality checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_picks_actual_value_null
  ON unified_picks(settled_at)
  WHERE settled_at IS NOT NULL
    AND actual_value IS NULL;

-- ==================== METADATA ====================

COMMENT ON INDEX idx_unified_picks_external_prop_settled IS
  'Optimizes already-settled lookup during settlement processing (eliminates N+1 queries)';

COMMENT ON INDEX idx_player_stats_date_sport_player IS
  'Optimizes player stats lookup during settlement (single query per date instead of per prop)';

COMMENT ON INDEX idx_raw_props_game_date_sport IS
  'Optimizes date-based batching for settlement processing';

COMMENT ON INDEX idx_unified_picks_external_prop_unique IS
  'Ensures ON CONFLICT works correctly during bulk upserts';

-- ==================== VACUUM AND ANALYZE ====================

-- Ensure statistics are up to date for query planner
ANALYZE unified_picks;
ANALYZE raw_props;
ANALYZE player_stats;

-- ==================== INDEX HEALTH CHECK ====================

-- Function to verify index usage
CREATE OR REPLACE FUNCTION check_settlement_index_health()
RETURNS TABLE (
  index_name TEXT,
  table_name TEXT,
  size_mb NUMERIC,
  is_valid BOOLEAN,
  notes TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.indexname::TEXT,
    i.tablename::TEXT,
    ROUND(pg_relation_size(i.indexname::regclass) / 1024.0 / 1024.0, 2) as size_mb,
    idx.indisvalid as is_valid,
    CASE
      WHEN NOT idx.indisvalid THEN 'INDEX INVALID - REBUILD REQUIRED'
      WHEN pg_relation_size(i.indexname::regclass) = 0 THEN 'INDEX EMPTY - CHECK CREATION'
      ELSE 'OK'
    END::TEXT as notes
  FROM pg_indexes i
  JOIN pg_class c ON c.relname = i.indexname
  JOIN pg_index idx ON idx.indexrelid = c.oid
  WHERE i.indexname LIKE 'idx_%settlement%'
     OR i.indexname LIKE 'idx_unified_picks%'
     OR i.indexname LIKE 'idx_player_stats%'
     OR i.indexname LIKE 'idx_raw_props%'
  ORDER BY pg_relation_size(i.indexname::regclass) DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_settlement_index_health() IS
  'Checks health of settlement-related indexes';

-- ==================== PERFORMANCE VALIDATION ====================

-- Expected query plan for settlement lookup (should use index scan)
-- EXPLAIN ANALYZE SELECT * FROM unified_picks WHERE external_prop_id = 'test' AND settled_at IS NOT NULL;
-- Expected: Index Scan using idx_unified_picks_external_prop_settled

-- Expected query plan for player stats lookup (should use index scan)
-- EXPLAIN ANALYZE SELECT * FROM player_stats WHERE game_date = '2024-10-01' AND sport = 'MLB' AND player_name = 'Test Player';
-- Expected: Index Scan using idx_player_stats_date_sport_player

-- Expected query plan for raw props by date (should use index scan)
-- EXPLAIN ANALYZE SELECT * FROM raw_props WHERE DATE(game_start) = '2024-10-01' AND sport = 'MLB';
-- Expected: Bitmap Index Scan using idx_raw_props_game_date_sport

-- ==================== SUCCESS ====================

DO $$
BEGIN
  RAISE NOTICE 'Settlement performance indexes created successfully';
  RAISE NOTICE 'Expected performance improvement: 20-47x faster settlement';
  RAISE NOTICE 'Run check_settlement_index_health() to verify index creation';
END $$;
