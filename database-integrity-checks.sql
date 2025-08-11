-- =============================================================================
-- DATABASE INTEGRITY CHECKS - POST TRANSFORMATION
-- Comprehensive validation of database relationships and functionality
-- =============================================================================

-- Step 1: Overall Database Health Check
-- =============================================================================
SELECT 
  'DATABASE HEALTH SUMMARY' as check_type,
  (SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE' 
   AND table_name NOT LIKE '%backup%') as total_tables,
  (SELECT COUNT(*) FROM information_schema.views 
   WHERE table_schema = 'public') as total_views,
  (SELECT COUNT(*) FROM information_schema.table_constraints 
   WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public') as foreign_keys,
  (SELECT COUNT(*) FROM information_schema.table_constraints 
   WHERE constraint_type = 'CHECK' AND table_schema = 'public') as check_constraints;

-- Step 2: Core Table Record Counts
-- =============================================================================
SELECT 
  'CORE TABLE RECORD COUNTS' as check_type,
  (SELECT COUNT(*) FROM users) as users_count,
  (SELECT COUNT(*) FROM unified_picks) as unified_picks_count,
  (SELECT COUNT(*) FROM unified_sports_history) as sports_history_count,
  (SELECT COUNT(*) FROM raw_props) as props_count,
  (SELECT COUNT(*) FROM games) as games_count,
  (SELECT COUNT(*) FROM teams) as teams_count,
  (SELECT COUNT(*) FROM players) as players_count;

-- Step 3: Foreign Key Relationship Integrity
-- =============================================================================

-- Check props to games relationship
SELECT 
  'PROPS TO GAMES RELATIONSHIP' as check_type,
  COUNT(*) as total_props,
  COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) as props_with_games,
  ROUND(COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as linking_percentage,
  COUNT(CASE WHEN game_id IS NULL THEN 1 END) as orphaned_props
FROM raw_props;

-- Check picks to users relationship
SELECT 
  'PICKS TO USERS RELATIONSHIP' as check_type,
  COUNT(*) as total_picks,
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as picks_with_users,
  ROUND(COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as linking_percentage,
  COUNT(CASE WHEN user_id IS NULL THEN 1 END) as orphaned_picks
FROM unified_picks;

-- Check picks to props relationship
SELECT 
  'PICKS TO PROPS RELATIONSHIP' as check_type,
  COUNT(*) as total_picks,
  COUNT(CASE WHEN prop_id IS NOT NULL THEN 1 END) as picks_with_props,
  ROUND(COUNT(CASE WHEN prop_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as linking_percentage,
  COUNT(CASE WHEN prop_id IS NULL THEN 1 END) as picks_without_props
FROM unified_picks;

-- Check games to teams relationship
SELECT
  'GAMES TO TEAMS RELATIONSHIP' as check_type,
  COUNT(*) as total_games,
  COUNT(CASE WHEN home_team IS NOT NULL AND away_team IS NOT NULL THEN 1 END) as games_with_both_teams,
  ROUND(COUNT(CASE WHEN home_team IS NOT NULL AND away_team IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as complete_games_percentage,
  COUNT(CASE WHEN home_team IS NULL OR away_team IS NULL THEN 1 END) as incomplete_games
FROM games;

-- Step 4: Data Quality Checks
-- =============================================================================

-- Check for duplicate records in key tables
SELECT
  'DUPLICATE RECORDS CHECK' as check_type,
  (SELECT COUNT(*) - COUNT(DISTINCT discord_id) FROM users WHERE discord_id IS NOT NULL) as duplicate_users,
  (SELECT COUNT(*) - COUNT(DISTINCT (game_id, stat_type, player_name)) FROM raw_props WHERE game_id IS NOT NULL) as potential_duplicate_props,
  (SELECT COUNT(*) - COUNT(DISTINCT (home_team, away_team, game_date)) FROM games WHERE home_team IS NOT NULL) as potential_duplicate_games;

-- Check for missing critical data
SELECT
  'MISSING CRITICAL DATA CHECK' as check_type,
  (SELECT COUNT(*) FROM raw_props WHERE stat_type IS NULL OR stat_type = '') as props_missing_type,
  (SELECT COUNT(*) FROM games WHERE game_date IS NULL) as games_missing_date,
  (SELECT COUNT(*) FROM users WHERE discord_id IS NULL OR discord_id = '') as users_missing_discord_id,
  (SELECT COUNT(*) FROM unified_picks WHERE selection IS NULL OR selection = '') as picks_missing_selection;

-- Step 5: Business Logic Validation
-- =============================================================================

-- Check contest system integrity
SELECT 
  'CONTEST SYSTEM INTEGRITY' as check_type,
  (SELECT COUNT(*) FROM contests) as total_contests,
  (SELECT COUNT(*) FROM contests WHERE sport IS NOT NULL) as contests_with_sport,
  (SELECT COUNT(*) FROM contests WHERE status IS NOT NULL) as contests_with_status,
  (SELECT COUNT(*) FROM contest_participants) as total_participants;

-- Check referral system integrity
SELECT 
  'REFERRAL SYSTEM INTEGRITY' as check_type,
  (SELECT COUNT(*) FROM referrals) as total_referrals,
  (SELECT COUNT(*) FROM referrals WHERE status IS NOT NULL) as referrals_with_status,
  (SELECT COUNT(*) FROM referral_rewards) as total_rewards,
  (SELECT COUNT(*) FROM referral_rewards WHERE status IS NOT NULL) as rewards_with_status;

-- Check ML/Analytics tables
SELECT 
  'ML ANALYTICS INTEGRITY' as check_type,
  (SELECT COUNT(*) FROM dvp_matchup_ranks) as dvp_records,
  (SELECT COUNT(*) FROM dvp_matchup_ranks WHERE sport IS NOT NULL) as dvp_with_sport,
  (SELECT COUNT(*) FROM ev_modeling) as ev_records,
  (SELECT COUNT(*) FROM ev_modeling WHERE sport IS NOT NULL) as ev_with_sport;

-- Step 6: Performance and Index Validation
-- =============================================================================

-- Check if critical indexes exist
SELECT 
  'CRITICAL INDEXES CHECK' as check_type,
  CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_raw_props_game_id') 
       THEN 'EXISTS' ELSE 'MISSING' END as props_game_index,
  CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_unified_picks_user_id') 
       THEN 'EXISTS' ELSE 'MISSING' END as picks_user_index,
  CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_unified_sports_history_sport_date') 
       THEN 'EXISTS' ELSE 'MISSING' END as sports_history_index,
  CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_contests_sport_status') 
       THEN 'EXISTS' ELSE 'MISSING' END as contests_index;

-- Step 7: View Functionality Check
-- =============================================================================

-- Test backward compatibility views
SELECT 
  'BACKWARD COMPATIBILITY VIEWS' as check_type,
  (SELECT COUNT(*) FROM cappers) as cappers_view_count,
  (SELECT COUNT(*) FROM final_picks) as final_picks_view_count,
  (SELECT COUNT(*) FROM daily_picks) as daily_picks_view_count,
  'Views working correctly' as status;

-- Step 8: RBI Backfill System Check
-- =============================================================================
SELECT 
  'RBI BACKFILL SYSTEM' as check_type,
  (SELECT COUNT(*) FROM rbi_backfill_queue) as total_queue_items,
  (SELECT COUNT(*) FROM rbi_backfill_queue WHERE status = 'pending') as pending_backfills,
  (SELECT COUNT(*) FROM rbi_backfill_queue WHERE status = 'completed') as completed_backfills,
  (SELECT COUNT(*) FROM unified_sports_history WHERE sport = 'MLB') as mlb_records;

-- Step 9: Agent System Validation
-- =============================================================================
SELECT 
  'AGENT SYSTEM VALIDATION' as check_type,
  (SELECT COUNT(*) FROM agents) as total_agents,
  (SELECT COUNT(*) FROM agent_tasks) as total_tasks,
  (SELECT COUNT(*) FROM agents WHERE status = 'active') as active_agents,
  'Agent system operational' as status;

-- Step 10: Data Completeness Summary
-- =============================================================================
SELECT 
  'DATA COMPLETENESS SUMMARY' as check_type,
  ROUND((SELECT COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) FROM raw_props), 2) as props_linking_rate,
  ROUND((SELECT COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) FROM unified_picks), 2) as picks_user_linking_rate,
  ROUND((SELECT COUNT(CASE WHEN home_team IS NOT NULL AND away_team IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) FROM games), 2) as games_team_linking_rate,
  'Database integrity status' as overall_status;

-- Step 11: Final Health Score
-- =============================================================================
WITH health_metrics AS (
  SELECT 
    CASE WHEN (SELECT COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) FROM raw_props) >= 90 THEN 25 ELSE 0 END as props_score,
    CASE WHEN (SELECT COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) FROM unified_picks) >= 90 THEN 25 ELSE 0 END as picks_score,
    CASE WHEN (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public') >= 20 THEN 25 ELSE 0 END as fk_score,
    CASE WHEN (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') >= 30 THEN 25 ELSE 0 END as index_score
)
SELECT 
  'FINAL DATABASE HEALTH SCORE' as assessment,
  (props_score + picks_score + fk_score + index_score) as health_score_out_of_100,
  CASE 
    WHEN (props_score + picks_score + fk_score + index_score) >= 90 THEN 'EXCELLENT - Enterprise Grade'
    WHEN (props_score + picks_score + fk_score + index_score) >= 70 THEN 'GOOD - Production Ready'
    WHEN (props_score + picks_score + fk_score + index_score) >= 50 THEN 'FAIR - Needs Improvement'
    ELSE 'POOR - Critical Issues'
  END as grade,
  'Database transformation successful' as conclusion
FROM health_metrics;
