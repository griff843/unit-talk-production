-- Check ML/Analytics table structures to see what columns exist
-- =============================================================================

-- Check dvp_matchup_ranks structure
SELECT 
  'dvp_matchup_ranks columns:' as table_info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'dvp_matchup_ranks' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check ev_modeling structure
SELECT 
  'ev_modeling columns:' as table_info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'ev_modeling' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check historical_player_logs structure
SELECT 
  'historical_player_logs columns:' as table_info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'historical_player_logs' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check player_stat_logs structure
SELECT 
  'player_stat_logs columns:' as table_info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'player_stat_logs' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check contests structure
SELECT 
  'contests columns:' as table_info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'contests' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Sample data to understand current structure
SELECT 'dvp_matchup_ranks sample:' as info, * FROM dvp_matchup_ranks LIMIT 1;
SELECT 'ev_modeling sample:' as info, * FROM ev_modeling LIMIT 1;
SELECT 'contests sample:' as info, * FROM contests LIMIT 1;
