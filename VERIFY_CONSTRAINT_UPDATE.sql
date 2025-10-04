-- Verify the player props constraint includes bookmaker_key
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND indexname = 'idx_unified_picks_player_props_dedup';
