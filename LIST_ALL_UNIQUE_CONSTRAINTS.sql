-- List ALL unique constraints and indexes on unified_picks
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND (indexdef LIKE '%UNIQUE%' OR indexname LIKE '%unique%' OR indexname LIKE '%uq_%' OR indexname LIKE '%dedup%')
ORDER BY indexname;
