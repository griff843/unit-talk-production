-- Fix NFL props constraint issue
-- Problem: idx_unified_picks_external_ids doesn't handle NULL external_prop_id properly
-- Solution: Drop it and create proper dedup constraint that allows multiple NULLs

BEGIN;

-- Drop the problematic unique constraint
DROP INDEX IF EXISTS idx_unified_picks_external_ids;

-- Create proper dedup constraint that handles both player props and core markets
-- For player props: external_game_id + external_prop_id should be unique (when NOT NULL)
-- For core markets with NULL external_prop_id: use composite key on source + market + metadata fields

-- Partial unique index for player props only (where external_prop_id IS NOT NULL)
-- This allows multiple NULLs for the same external_game_id
CREATE UNIQUE INDEX idx_unified_picks_player_props_dedup
ON unified_picks (external_game_id, external_prop_id)
WHERE external_prop_id IS NOT NULL;

-- For core markets, create composite unique constraint using JSONB fields
-- This prevents duplicate entries for same market/team/bookmaker/line
CREATE UNIQUE INDEX idx_unified_picks_core_markets_dedup
ON unified_picks (
  source,
  market,
  matchup,
  (meta->>'bookmaker_key'),
  game_date,
  COALESCE(line, 0),
  COALESCE(side, team, player_name, '')
)
WHERE external_prop_id IS NULL;

COMMIT;

-- Verify constraints
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND (indexname LIKE '%dedup%' OR indexname LIKE '%external%')
ORDER BY indexname;
