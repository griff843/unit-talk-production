-- Extensions (sanity)
SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm','pgvector','pg_stat_statements','pgcrypto');

-- Basic table presence
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('raw_props','daily_picks','unified_picks','games')
ORDER BY table_name;

-- Nulls in required keys (adjust as needed)
SELECT 'raw_props.unique_key_nulls' AS check, COUNT(*) AS n
FROM raw_props WHERE unique_key IS NULL;

SELECT 'unified_picks.raw_prop_id_nulls' AS check, COUNT(*) AS n
FROM unified_picks WHERE raw_prop_id IS NULL;

-- Duplicate keys
SELECT 'raw_props.duplicate_unique_key' AS check, COUNT(*) AS n
FROM (
  SELECT unique_key FROM raw_props GROUP BY 1 HAVING COUNT(*) > 1
) d;

-- Orphan references (only runs if tables exist)
SELECT 'daily_picks.orphan_game_id' AS check, COUNT(*) AS n
FROM daily_picks dp
LEFT JOIN games g ON g.id = dp.game_id
WHERE g.id IS NULL;

-- Markets sanity (tweak allowed values to your spec)
SELECT 'raw_props.market_values' AS check, array_agg(DISTINCT market)
FROM raw_props;

-- Index usage (0 scans = likely missing/unused)
SELECT relname AS table_name, indexrelname AS index_name, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname='public'
ORDER BY idx_scan ASC, relname;

-- Broken views (if any)
SELECT v.schemaname, v.viewname
FROM pg_views v
WHERE v.schemaname='public';
