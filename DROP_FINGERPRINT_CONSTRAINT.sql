-- Temporarily drop the fingerprint constraint to test if it's blocking inserts
DROP INDEX IF EXISTS uq_unified_picks_fingerprint;

-- Verify it's gone
SELECT indexname
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND indexname = 'uq_unified_picks_fingerprint';
-- Expected: 0 rows
