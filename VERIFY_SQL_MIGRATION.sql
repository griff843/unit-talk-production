-- ========================================
-- VERIFICATION SCRIPT
-- Copy this and run in Supabase SQL Editor to check constraints
-- ========================================

-- 1. Check all indexes on unified_picks
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND schemaname = 'public'
ORDER BY indexname;

-- 2. Check if old constraint exists (BAD if returns rows)
SELECT indexname
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND indexname = 'idx_unified_picks_external_ids';

-- 3. Check if new constraint exists (GOOD if returns rows)
SELECT indexname
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND indexname = 'idx_unified_picks_unique_per_bookmaker';

-- 4. Check metadata column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'unified_picks'
  AND column_name = 'metadata';
