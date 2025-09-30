-- =============================================================================
-- ROLLBACK: FEATURES_DAILY_AGG Feature Store Table
-- Purpose: Safe rollback procedures for features_daily_agg table and related objects
-- =============================================================================

-- 1) Drop all triggers first
DROP TRIGGER IF EXISTS trg_features_daily_agg_updated_at ON features_daily_agg;

-- 2) Drop functions (in reverse dependency order)
DROP FUNCTION IF EXISTS initialize_feature_store();
DROP FUNCTION IF EXISTS validate_feature_quality();
DROP FUNCTION IF EXISTS get_prop_features(UUID, INTEGER);
DROP FUNCTION IF EXISTS batch_compute_features(UUID[], DATE);
DROP FUNCTION IF EXISTS compute_daily_features(UUID, UUID, TEXT, DATE, TEXT);

-- 3) Drop views
DROP VIEW IF EXISTS feature_freshness_monitor;

-- 4) Revoke permissions
REVOKE ALL ON features_daily_agg FROM api_service;
REVOKE ALL ON feature_freshness_monitor FROM monitoring_service;

-- 5) Drop all indexes
DROP INDEX IF EXISTS idx_features_daily_prop_lookup;
DROP INDEX IF EXISTS idx_features_daily_entity_recent;
DROP INDEX IF EXISTS idx_features_daily_sport_season;
DROP INDEX IF EXISTS idx_features_daily_factor_scores_gin;
DROP INDEX IF EXISTS idx_features_daily_rolling_avgs_gin;
DROP INDEX IF EXISTS idx_features_daily_situational_gin;
DROP INDEX IF EXISTS idx_features_daily_entity_hash;

-- 6) Drop constraints (if any were added separately)
ALTER TABLE IF EXISTS features_daily_agg DROP CONSTRAINT IF EXISTS chk_factor_version;
ALTER TABLE IF EXISTS features_daily_agg DROP CONSTRAINT IF EXISTS chk_percentiles;
ALTER TABLE IF EXISTS features_daily_agg DROP CONSTRAINT IF EXISTS chk_data_quality;
ALTER TABLE IF EXISTS features_daily_agg DROP CONSTRAINT IF EXISTS chk_games_played;
ALTER TABLE IF EXISTS features_daily_agg DROP CONSTRAINT IF EXISTS uq_features_daily_entity;

-- 7) Drop main table (this will cascade to any remaining objects)
DROP TABLE IF EXISTS features_daily_agg CASCADE;

-- 8) Drop extensions if not used by other objects (optional - commented for safety)
-- DROP EXTENSION IF EXISTS pg_trgm;
-- DROP EXTENSION IF EXISTS btree_gin;

-- 9) Clean up any sample data or test records
-- (No cleanup needed for this migration)

-- =============================================================================
-- ROLLBACK VERIFICATION QUERIES
-- =============================================================================
-- Run these queries to verify complete rollback:

-- Verify table is dropped
-- SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'features_daily_agg';

-- Verify functions are dropped
-- SELECT COUNT(*) FROM pg_proc WHERE proname LIKE '%feature%' OR proname LIKE '%compute_daily%';

-- Verify indexes are dropped
-- SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE '%features_daily%';

-- Verify views are dropped
-- SELECT COUNT(*) FROM information_schema.views WHERE table_name = 'feature_freshness_monitor';

-- =============================================================================
-- ROLLBACK COMPLETE
-- =============================================================================