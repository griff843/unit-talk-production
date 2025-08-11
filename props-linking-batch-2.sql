-- =============================================================================
-- PROPS LINKING BATCH 2 - PARTIAL/FUZZY MATCHING
-- Handle team name variations and abbreviations
-- =============================================================================

-- Step 1: Analyze the mismatch between matchup and games team names
-- =============================================================================

-- Sample unlinked props to understand team name format differences
SELECT 
  'UNLINKED PROPS SAMPLE' as analysis,
  matchup,
  game_date,
  COUNT(*) as count
FROM raw_props 
WHERE game_id IS NULL 
  AND matchup IS NOT NULL
GROUP BY matchup, game_date
ORDER BY count DESC
LIMIT 10;

-- Sample games team names to compare
SELECT 
  'GAMES TEAM NAMES SAMPLE' as analysis,
  home_team,
  away_team,
  game_date,
  COUNT(*) as count
FROM games
GROUP BY home_team, away_team, game_date
ORDER BY count DESC
LIMIT 10;

-- Step 2: Create team name mapping for common abbreviations
-- =============================================================================

-- Create a temporary mapping table for team abbreviations
CREATE TEMP TABLE team_mappings AS
SELECT * FROM (VALUES
  ('LAL', 'Los Angeles Lakers'),
  ('LAC', 'Los Angeles Clippers'),
  ('GSW', 'Golden State Warriors'),
  ('BOS', 'Boston Celtics'),
  ('MIA', 'Miami Heat'),
  ('NYK', 'New York Knicks'),
  ('CHI', 'Chicago Bulls'),
  ('ATL', 'Atlanta Hawks'),
  ('PHI', 'Philadelphia 76ers'),
  ('MIL', 'Milwaukee Bucks'),
  ('TOR', 'Toronto Raptors'),
  ('BRK', 'Brooklyn Nets'),
  ('CLE', 'Cleveland Cavaliers'),
  ('DET', 'Detroit Pistons'),
  ('IND', 'Indiana Pacers'),
  ('WAS', 'Washington Wizards'),
  ('ORL', 'Orlando Magic'),
  ('CHA', 'Charlotte Hornets'),
  ('DEN', 'Denver Nuggets'),
  ('UTA', 'Utah Jazz'),
  ('PHX', 'Phoenix Suns'),
  ('POR', 'Portland Trail Blazers'),
  ('SAC', 'Sacramento Kings'),
  ('MIN', 'Minnesota Timberwolves'),
  ('OKC', 'Oklahoma City Thunder'),
  ('NOP', 'New Orleans Pelicans'),
  ('SAS', 'San Antonio Spurs'),
  ('DAL', 'Dallas Mavericks'),
  ('HOU', 'Houston Rockets'),
  ('MEM', 'Memphis Grizzlies')
) AS t(abbreviation, full_name);

-- Step 3: Batch 3 - Partial matching with team name variations
-- =============================================================================

-- Batch 3: Partial team name matching (case insensitive)
UPDATE raw_props 
SET game_id = (
  SELECT g.id 
  FROM games g 
  WHERE g.game_date = raw_props.game_date
    AND (
      -- Check if matchup contains parts of team names
      raw_props.matchup ILIKE '%' || SUBSTRING(g.home_team FROM 1 FOR 8) || '%' OR
      raw_props.matchup ILIKE '%' || SUBSTRING(g.away_team FROM 1 FOR 8) || '%' OR
      g.home_team ILIKE '%' || SPLIT_PART(raw_props.matchup, ' vs ', 1) || '%' OR
      g.home_team ILIKE '%' || SPLIT_PART(raw_props.matchup, ' vs ', 2) || '%' OR
      g.away_team ILIKE '%' || SPLIT_PART(raw_props.matchup, ' vs ', 1) || '%' OR
      g.away_team ILIKE '%' || SPLIT_PART(raw_props.matchup, ' vs ', 2) || '%' OR
      g.home_team ILIKE '%' || SPLIT_PART(raw_props.matchup, ' @ ', 1) || '%' OR
      g.home_team ILIKE '%' || SPLIT_PART(raw_props.matchup, ' @ ', 2) || '%' OR
      g.away_team ILIKE '%' || SPLIT_PART(raw_props.matchup, ' @ ', 1) || '%' OR
      g.away_team ILIKE '%' || SPLIT_PART(raw_props.matchup, ' @ ', 2) || '%'
    )
  ORDER BY 
    -- Prefer matches where both teams are found
    CASE WHEN (
      (raw_props.matchup ILIKE '%' || g.home_team || '%' OR raw_props.matchup ILIKE '%' || SUBSTRING(g.home_team FROM 1 FOR 8) || '%') AND
      (raw_props.matchup ILIKE '%' || g.away_team || '%' OR raw_props.matchup ILIKE '%' || SUBSTRING(g.away_team FROM 1 FOR 8) || '%')
    ) THEN 1 ELSE 2 END
  LIMIT 1
)
WHERE game_id IS NULL 
  AND matchup IS NOT NULL 
  AND game_date IS NOT NULL
  AND id IN (
    -- Limit to first 100,000 records for this batch
    SELECT id FROM raw_props 
    WHERE game_id IS NULL 
      AND matchup IS NOT NULL
      AND game_date IS NOT NULL
    LIMIT 100000
  );

-- Check progress after batch 3
SELECT 
  'BATCH 3 RESULTS (partial matching)' as batch,
  COUNT(*) as total_props,
  COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) as linked_props,
  ROUND(COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as linking_percentage,
  COUNT(CASE WHEN game_id IS NULL THEN 1 END) as still_unlinked
FROM raw_props;

-- Step 4: Batch 4 - Date-only matching for single game days
-- =============================================================================

-- Batch 4: Match props to games on days with only one game
UPDATE raw_props 
SET game_id = (
  SELECT g.id 
  FROM games g 
  WHERE g.game_date = raw_props.game_date
  LIMIT 1
)
WHERE game_id IS NULL 
  AND game_date IS NOT NULL
  AND game_date IN (
    -- Only match on dates where there's exactly one game
    SELECT game_date 
    FROM games 
    GROUP BY game_date 
    HAVING COUNT(*) = 1
  )
  AND id IN (
    -- Limit to first 50,000 records
    SELECT id FROM raw_props 
    WHERE game_id IS NULL 
      AND game_date IS NOT NULL
      AND game_date IN (
        SELECT game_date 
        FROM games 
        GROUP BY game_date 
        HAVING COUNT(*) = 1
      )
    LIMIT 50000
  );

-- Check progress after batch 4
SELECT 
  'BATCH 4 RESULTS (single game days)' as batch,
  COUNT(*) as total_props,
  COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) as linked_props,
  ROUND(COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as linking_percentage,
  COUNT(CASE WHEN game_id IS NULL THEN 1 END) as still_unlinked
FROM raw_props;

-- Step 5: Analyze remaining unlinked props
-- =============================================================================

-- Check what types of props are still unlinked
SELECT 
  'REMAINING UNLINKED ANALYSIS' as analysis,
  stat_type,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM raw_props WHERE game_id IS NULL), 2) as percentage_of_unlinked
FROM raw_props 
WHERE game_id IS NULL
GROUP BY stat_type
ORDER BY count DESC
LIMIT 10;

-- Sample remaining unlinked props to understand patterns
SELECT 
  'SAMPLE REMAINING UNLINKED' as sample,
  matchup,
  stat_type,
  game_date,
  COUNT(*) as count
FROM raw_props 
WHERE game_id IS NULL
GROUP BY matchup, stat_type, game_date
ORDER BY count DESC
LIMIT 10;

-- Step 6: Final health score check
-- =============================================================================

-- Calculate current health score after batch 2
WITH health_metrics AS (
  SELECT 
    CASE WHEN (SELECT COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) FROM raw_props) >= 90 THEN 25 ELSE 0 END as props_score,
    CASE WHEN (SELECT COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) FROM unified_picks) >= 90 THEN 25 ELSE 0 END as picks_score,
    CASE WHEN (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public') >= 20 THEN 25 ELSE 0 END as fk_score,
    CASE WHEN (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') >= 40 THEN 25 ELSE 0 END as index_score,
    (SELECT COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) FROM raw_props) as actual_props_percentage
)
SELECT 
  'UPDATED DATABASE HEALTH SCORE' as assessment,
  (props_score + picks_score + fk_score + index_score) as health_score_out_of_100,
  CASE 
    WHEN (props_score + picks_score + fk_score + index_score) >= 90 THEN 'EXCELLENT - Enterprise Grade 🏆'
    WHEN (props_score + picks_score + fk_score + index_score) >= 70 THEN 'GOOD - Production Ready'
    WHEN (props_score + picks_score + fk_score + index_score) >= 50 THEN 'FAIR - Needs Improvement'
    ELSE 'POOR - Critical Issues'
  END as grade,
  CONCAT('Props linking: ', ROUND(actual_props_percentage, 2), '%') as props_detail,
  'Partial matching applied - check if more batches needed' as next_steps
FROM health_metrics;

-- Step 7: Next steps recommendation
-- =============================================================================

SELECT 
  'BATCH 2 COMPLETION STATUS' as status,
  COUNT(CASE WHEN game_id IS NULL THEN 1 END) as remaining_unlinked,
  CASE 
    WHEN COUNT(CASE WHEN game_id IS NULL THEN 1 END) > 300000 
    THEN 'Many props may be futures/season-long bets without specific games'
    WHEN COUNT(CASE WHEN game_id IS NULL THEN 1 END) > 100000 
    THEN 'Consider if remaining props are actually game-specific'
    WHEN COUNT(CASE WHEN game_id IS NULL THEN 1 END) < 50000 
    THEN 'Excellent progress! Most props now linked'
    ELSE 'Good progress - evaluate if remaining props should be linked'
  END as assessment,
  ROUND(COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as current_linking_percentage
FROM raw_props;

-- Update statistics
ANALYZE raw_props;
ANALYZE games;
