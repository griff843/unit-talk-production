-- =============================================================================
-- PROPS LINKING OPTIMIZATION - BATCHED APPROACH
-- Efficiently link props to games in smaller batches to avoid timeouts
-- =============================================================================

-- Step 1: Quick analysis first (lightweight queries)
-- =============================================================================

-- Check current linking status
SELECT 
  'CURRENT PROPS LINKING STATUS' as status,
  COUNT(*) as total_props,
  COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) as linked_props,
  COUNT(CASE WHEN game_id IS NULL THEN 1 END) as unlinked_props,
  ROUND(COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as current_percentage
FROM raw_props;

-- Sample matchup formats (just 5 to understand patterns)
SELECT 
  'SAMPLE MATCHUP FORMATS' as info,
  matchup,
  COUNT(*) as count
FROM raw_props 
WHERE game_id IS NULL 
  AND matchup IS NOT NULL
GROUP BY matchup
ORDER BY count DESC
LIMIT 5;

-- Step 2: Create index for performance (if not exists)
-- =============================================================================

-- Add index on matchup for faster matching
CREATE INDEX IF NOT EXISTS idx_raw_props_matchup_date ON raw_props(matchup, game_date) 
WHERE game_id IS NULL;

-- Add index on games for faster lookups
CREATE INDEX IF NOT EXISTS idx_games_teams_date ON games(home_team, away_team, game_date);

-- Step 3: Batch Update Strategy - Start with exact matches
-- =============================================================================

-- Batch 1: Exact "vs" format matches (most reliable, smaller batch)
UPDATE raw_props 
SET game_id = (
  SELECT g.id 
  FROM games g 
  WHERE g.game_date = raw_props.game_date
    AND raw_props.matchup LIKE '% vs %'
    AND (
      (g.home_team = TRIM(SPLIT_PART(raw_props.matchup, ' vs ', 2)) AND 
       g.away_team = TRIM(SPLIT_PART(raw_props.matchup, ' vs ', 1))) OR
      (g.away_team = TRIM(SPLIT_PART(raw_props.matchup, ' vs ', 2)) AND 
       g.home_team = TRIM(SPLIT_PART(raw_props.matchup, ' vs ', 1)))
    )
  LIMIT 1
)
WHERE game_id IS NULL 
  AND matchup LIKE '% vs %'
  AND game_date IS NOT NULL
  AND id IN (
    -- Limit to first 50,000 records to avoid timeout
    SELECT id FROM raw_props 
    WHERE game_id IS NULL 
      AND matchup LIKE '% vs %'
      AND game_date IS NOT NULL
    LIMIT 50000
  );

-- Check progress after batch 1
SELECT 
  'BATCH 1 RESULTS (vs format)' as batch,
  COUNT(*) as total_props,
  COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) as linked_props,
  ROUND(COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as linking_percentage
FROM raw_props;

-- Batch 2: Exact "@" format matches
UPDATE raw_props 
SET game_id = (
  SELECT g.id 
  FROM games g 
  WHERE g.game_date = raw_props.game_date
    AND raw_props.matchup LIKE '% @ %'
    AND (
      (g.home_team = TRIM(SPLIT_PART(raw_props.matchup, ' @ ', 2)) AND 
       g.away_team = TRIM(SPLIT_PART(raw_props.matchup, ' @ ', 1))) OR
      (g.away_team = TRIM(SPLIT_PART(raw_props.matchup, ' @ ', 2)) AND 
       g.home_team = TRIM(SPLIT_PART(raw_props.matchup, ' @ ', 1)))
    )
  LIMIT 1
)
WHERE game_id IS NULL 
  AND matchup LIKE '% @ %'
  AND game_date IS NOT NULL
  AND id IN (
    -- Limit to first 50,000 records
    SELECT id FROM raw_props 
    WHERE game_id IS NULL 
      AND matchup LIKE '% @ %'
      AND game_date IS NOT NULL
    LIMIT 50000
  );

-- Check progress after batch 2
SELECT 
  'BATCH 2 RESULTS (@ format)' as batch,
  COUNT(*) as total_props,
  COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) as linked_props,
  ROUND(COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as linking_percentage
FROM raw_props;

-- Step 4: Check if we need more batches
-- =============================================================================

-- See how many props are still unlinked
SELECT 
  'REMAINING UNLINKED PROPS' as status,
  COUNT(*) as unlinked_count,
  CASE 
    WHEN COUNT(*) > 100000 THEN 'Need more batches'
    WHEN COUNT(*) > 10000 THEN 'One more batch should do it'
    ELSE 'Almost done!'
  END as recommendation
FROM raw_props 
WHERE game_id IS NULL;

-- Step 5: Final health score check
-- =============================================================================

-- Calculate current health score after batched updates
WITH health_metrics AS (
  SELECT 
    CASE WHEN (SELECT COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) FROM raw_props) >= 90 THEN 25 ELSE 0 END as props_score,
    CASE WHEN (SELECT COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) FROM unified_picks) >= 90 THEN 25 ELSE 0 END as picks_score,
    CASE WHEN (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public') >= 20 THEN 25 ELSE 0 END as fk_score,
    CASE WHEN (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') >= 40 THEN 25 ELSE 0 END as index_score,
    (SELECT COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) FROM raw_props) as actual_props_percentage
)
SELECT 
  'CURRENT DATABASE HEALTH SCORE' as assessment,
  (props_score + picks_score + fk_score + index_score) as health_score_out_of_100,
  CASE 
    WHEN (props_score + picks_score + fk_score + index_score) >= 90 THEN 'EXCELLENT - Enterprise Grade 🏆'
    WHEN (props_score + picks_score + fk_score + index_score) >= 70 THEN 'GOOD - Production Ready'
    WHEN (props_score + picks_score + fk_score + index_score) >= 50 THEN 'FAIR - Needs Improvement'
    ELSE 'POOR - Critical Issues'
  END as grade,
  CONCAT('Props linking: ', ROUND(actual_props_percentage, 2), '%') as props_detail,
  'Batched linking approach - run more batches if needed' as next_steps
FROM health_metrics;

-- Step 6: Instructions for next batches (if needed)
-- =============================================================================

SELECT 
  'NEXT STEPS' as instructions,
  CASE 
    WHEN (SELECT COUNT(*) FROM raw_props WHERE game_id IS NULL) > 100000 
    THEN 'Run additional batches - create props-linking-batch-2.sql for partial matching'
    WHEN (SELECT COUNT(*) FROM raw_props WHERE game_id IS NULL) > 10000 
    THEN 'Run one more batch with partial matching'
    ELSE 'Linking optimization complete! 🎉'
  END as recommendation,
  (SELECT COUNT(*) FROM raw_props WHERE game_id IS NULL) as remaining_unlinked;

-- Update statistics
ANALYZE raw_props;
ANALYZE games;
