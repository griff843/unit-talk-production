-- Fix Supabase cloud constraints for NFL props
-- Run this in Supabase SQL Editor

BEGIN;

-- Check current constraints
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'unified_picks'::regclass
  AND conname LIKE '%external%';

-- Drop problematic constraint if it exists
DROP INDEX IF EXISTS idx_unified_picks_external_ids;

-- Create proper dedup constraints
-- For player props: external_game_id + external_prop_id should be unique (when NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_picks_player_props_dedup
ON unified_picks (external_game_id, external_prop_id)
WHERE external_prop_id IS NOT NULL;

-- For core markets with NULL external_prop_id: use composite key
CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_picks_core_markets_dedup
ON unified_picks (
  source,
  market,
  selection,
  bookmaker_key,
  game_date,
  COALESCE(line, 0)
)
WHERE external_prop_id IS NULL;

COMMIT;

-- Verify new constraints
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND (indexname LIKE '%dedup%' OR indexname LIKE '%external%')
ORDER BY indexname;
