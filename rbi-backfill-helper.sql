-- =============================================================================
-- RBI BACKFILL HELPER SCRIPT
-- Tools and queries to help backfill RBI data for MLB historical records
-- =============================================================================

-- 1. Check backfill status
-- =============================================================================
SELECT 
  'RBI Backfill Status Summary:' as summary,
  (SELECT COUNT(*) FROM rbi_backfill_queue WHERE status = 'pending') as pending_records,
  (SELECT COUNT(*) FROM rbi_backfill_queue WHERE status = 'completed') as completed_records,
  (SELECT COUNT(*) FROM rbi_backfill_queue WHERE status = 'failed') as failed_records,
  (SELECT COUNT(*) FROM unified_sports_history WHERE sport = 'MLB') as total_mlb_records;

-- 2. Show sample records that need RBI backfill
-- =============================================================================
SELECT 
  'Sample records needing RBI backfill:' as info,
  rbq.id as backfill_id,
  rbq.unified_history_id,
  rbq.player_name,
  rbq.game_date,
  rbq.opponent,
  ush.stats
FROM rbi_backfill_queue rbq
JOIN unified_sports_history ush ON rbq.unified_history_id = ush.id
WHERE rbq.status = 'pending'
ORDER BY rbq.game_date DESC
LIMIT 10;

-- 3. Example backfill usage
-- =============================================================================
/*
-- To backfill RBI data manually, use this pattern:

-- Example 1: Update a specific record
SELECT update_rbi_data(
  'your-unified-history-id-here'::uuid,
  3, -- RBI value
  'manual' -- data source
);

-- Example 2: Batch update for a specific player/game
-- First, find the records:
SELECT 
  rbq.unified_history_id,
  rbq.player_name,
  rbq.game_date,
  rbq.opponent
FROM rbi_backfill_queue rbq
WHERE rbq.player_name = 'Juan Soto' 
  AND rbq.game_date = '2024-04-29'
  AND rbq.status = 'pending';

-- Then update with actual RBI values:
SELECT update_rbi_data('unified-history-id-here'::uuid, 2, 'espn');
*/

-- 4. Bulk backfill template (for when you have RBI data source)
-- =============================================================================
/*
-- Template for bulk RBI backfill when you have external data
-- Replace with your actual data source

WITH rbi_data AS (
  SELECT 
    player_name,
    game_date,
    opponent,
    rbi_value,
    'external_api' as data_source
  FROM (VALUES
    ('Juan Soto', '2024-04-29'::date, 'vsARI', 2),
    ('Player Name', '2024-04-30'::date, 'vsOPP', 1)
    -- Add more rows as needed
  ) AS t(player_name, game_date, opponent, rbi_value)
)
SELECT 
  rbq.unified_history_id,
  rd.rbi_value,
  update_rbi_data(rbq.unified_history_id, rd.rbi_value, rd.data_source) as updated
FROM rbi_backfill_queue rbq
JOIN rbi_data rd ON rbq.player_name = rd.player_name 
  AND rbq.game_date = rd.game_date 
  AND rbq.opponent = rd.opponent
WHERE rbq.status = 'pending';
*/

-- 5. Progress tracking queries
-- =============================================================================

-- Show backfill progress by player
SELECT 
  'Backfill progress by player:' as info,
  player_name,
  COUNT(*) as total_games,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  ROUND(
    COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 
    2
  ) as completion_percentage
FROM rbi_backfill_queue
GROUP BY player_name
ORDER BY total_games DESC
LIMIT 20;

-- Show backfill progress by date range
SELECT 
  'Backfill progress by month:' as info,
  DATE_TRUNC('month', game_date) as month,
  COUNT(*) as total_games,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  ROUND(
    COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 
    2
  ) as completion_percentage
FROM rbi_backfill_queue
GROUP BY DATE_TRUNC('month', game_date)
ORDER BY month DESC;

-- 6. Data quality checks
-- =============================================================================

-- Check for potential data inconsistencies
SELECT 
  'Data quality check:' as info,
  COUNT(CASE WHEN (stats->>'home_runs')::int > 0 AND rbi_value = 0 THEN 1 END) as home_runs_with_zero_rbi,
  COUNT(CASE WHEN rbi_value > 10 THEN 1 END) as unusually_high_rbi,
  COUNT(CASE WHEN rbi_value < 0 THEN 1 END) as negative_rbi
FROM rbi_backfill_queue rbq
JOIN unified_sports_history ush ON rbq.unified_history_id = ush.id
WHERE rbq.status = 'completed';

-- 7. Performance impact check
-- =============================================================================

-- Show updated player averages including RBI
SELECT
  'Updated player performance with RBI:' as info,
  player_name,
  games_played,
  ROUND(avg_runs, 2) as avg_runs,
  ROUND(avg_hits, 2) as avg_hits,
  ROUND(avg_home_runs, 2) as avg_home_runs,
  ROUND(avg_rbi, 2) as avg_rbi,
  games_with_rbi_data,
  games_needing_rbi_backfill
FROM mlb_player_performance_summary
ORDER BY games_played DESC
LIMIT 10;

-- 8. Backfill automation suggestions
-- =============================================================================
/*
-- For automated backfill, you could:

1. Create an agent that fetches RBI data from ESPN/MLB API
2. Use the rbi_backfill_queue table to track progress
3. Set up scheduled jobs to process pending records
4. Implement retry logic for failed attempts

Example agent pseudocode:
- Query rbi_backfill_queue WHERE status = 'pending' LIMIT 100
- For each record, fetch RBI from external API
- Call update_rbi_data() with the fetched value
- Handle rate limits and errors appropriately
*/

-- 9. Manual backfill workflow
-- =============================================================================
SELECT 
  'Manual backfill workflow:' as workflow,
  '1. Run this script to see pending records' as step1,
  '2. Look up RBI data from ESPN, MLB.com, or other sources' as step2,
  '3. Use update_rbi_data(id, rbi_value) to update records' as step3,
  '4. Check progress with the tracking queries above' as step4,
  '5. Refresh player_performance_summary materialized view when done' as step5;

-- Command to refresh materialized view after backfill:
-- REFRESH MATERIALIZED VIEW mlb_player_performance_summary;
