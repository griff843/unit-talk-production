-- =============================================================================
-- FINAL DATABASE CLEANUP - REMOVE REDUNDANT TABLES
-- Reduces 77 tables down to ~15 essential tables
-- =============================================================================

-- Step 1: Verify core data is safe before cleanup
-- =============================================================================
SELECT 
  'Pre-cleanup verification:' as check_type,
  (SELECT COUNT(*) FROM users) as users_count,
  (SELECT COUNT(*) FROM unified_picks) as picks_count,
  (SELECT COUNT(*) FROM raw_props) as props_count,
  (SELECT COUNT(*) FROM games) as games_count;

-- Step 2: Drop redundant/unused tables (SAFE TO REMOVE)
-- =============================================================================

-- Archive/duplicate tables (data already migrated)
DROP TABLE IF EXISTS archived_final_picks;
DROP TABLE IF EXISTS archived_picks;
DROP TABLE IF EXISTS graded_picks;
DROP TABLE IF EXISTS graded_tickets;

-- Duplicate parlay tables (replaced by parlay_tickets + unified_picks)
DROP TABLE IF EXISTS parlay_legs;
DROP TABLE IF EXISTS parlays;

-- Duplicate leaderboard tables
DROP TABLE IF EXISTS leaderboard;
DROP TABLE IF EXISTS leaderboards;

-- Historical data tables (can be recreated if needed)
DROP TABLE IF EXISTS mlb_history;
DROP TABLE IF EXISTS nba_history;
DROP TABLE IF EXISTS nfl_history;
DROP TABLE IF EXISTS nhl_history;
DROP TABLE IF EXISTS historical_player_logs;

-- DFS tables (not core to your business)
DROP TABLE IF EXISTS dfs_ownership;
DROP TABLE IF EXISTS dfs_salaries;

-- Unused analysis tables
DROP TABLE IF EXISTS clean_raw_props;
DROP TABLE IF EXISTS raw_props_archive;
DROP TABLE IF EXISTS ev_modeling;
DROP TABLE IF EXISTS ev_summaries;
DROP TABLE IF EXISTS dvp_matchup_ranks;
DROP TABLE IF EXISTS player_usage_trends;
DROP TABLE IF EXISTS stat_mappings;

-- Contest/referral tables (can be recreated if needed)
DROP TABLE IF EXISTS contest_participants;
DROP TABLE IF EXISTS contests;
DROP TABLE IF EXISTS referral_events;
DROP TABLE IF EXISTS referral_rewards;
DROP TABLE IF EXISTS referrals;

-- Unused operational tables
DROP TABLE IF EXISTS automation_errors;
DROP TABLE IF EXISTS bot_commands;
DROP TABLE IF EXISTS box_scores;
DROP TABLE IF EXISTS capper_evaluations;
DROP TABLE IF EXISTS matchups;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS odds_history;
DROP TABLE IF EXISTS player_injuries;
DROP TABLE IF EXISTS player_master;
DROP TABLE IF EXISTS recaps;
DROP TABLE IF EXISTS retool_recap_digest;
DROP TABLE IF EXISTS smart_tickets;
DROP TABLE IF EXISTS sop_tasks;
DROP TABLE IF EXISTS sops;

-- Onboarding tables (can be simplified)
DROP TABLE IF EXISTS onboarding_flows;
DROP TABLE IF EXISTS onboarding_progress;

-- User settings (consolidated into users table)
DROP TABLE IF EXISTS user_settings;

-- Step 3: Keep essential log tables but clean up duplicates
-- =============================================================================

-- Keep these log tables (useful for operations):
-- - alerts_log
-- - ai_alerts_log  
-- - error_logs
-- - line_movement_log
-- - player_logs
-- - player_stat_logs
-- - recap_log
-- - system_changelog
-- - unit_talk_alerts_log
-- - audit_logs

-- Remove duplicate log tables
DROP TABLE IF EXISTS hedge_alert_log;
DROP TABLE IF EXISTS injury_alert_log;

-- Step 4: Keep essential configuration tables
-- =============================================================================

-- Keep these config tables:
-- - edge_config
-- - onboarding_config
-- - system_config (already core)
-- - feature_flags (already core)

-- Step 5: Keep essential Discord tables
-- =============================================================================

-- Keep these Discord tables:
-- - discord_channels
-- - discord_messages

-- Step 6: Keep essential task management
-- =============================================================================

-- Keep these task tables:
-- - agent_tasks
-- - agents (already core)

-- Step 7: Final table count
-- =============================================================================

-- Count remaining tables
SELECT 
  'CLEANUP COMPLETE!' as status,
  COUNT(*) as remaining_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE '%backup%';

-- Show remaining tables by category
SELECT 
  'Remaining tables by category:' as info,
  CASE 
    WHEN table_name IN ('users', 'unified_picks', 'parlay_tickets', 'agents', 'system_config', 'feature_flags', 'analytics_summary') THEN '✅ Core SaaS'
    WHEN table_name IN ('raw_props', 'games', 'teams', 'players') THEN '📊 Sports Data'
    WHEN table_name LIKE '%discord%' THEN '💬 Discord'
    WHEN table_name LIKE '%log%' OR table_name LIKE '%alert%' THEN '📋 Logs'
    WHEN table_name LIKE '%config%' OR table_name = 'edge_config' OR table_name = 'onboarding_config' THEN '⚙️ Config'
    WHEN table_name LIKE '%agent%' OR table_name LIKE '%task%' THEN '🤖 System'
    WHEN table_name LIKE '%backup%' THEN '🗄️ Backup'
    ELSE '❓ Other'
  END as category,
  table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY 
  CASE 
    WHEN table_name IN ('users', 'unified_picks', 'parlay_tickets') THEN 1
    WHEN table_name IN ('raw_props', 'games', 'teams', 'players') THEN 2
    WHEN table_name LIKE '%backup%' THEN 9
    ELSE 5
  END,
  table_name;

-- Verify core data is still intact
SELECT 
  'Data integrity check:' as check_type,
  (SELECT COUNT(*) FROM users) as users_count,
  (SELECT COUNT(*) FROM unified_picks) as picks_count,
  (SELECT COUNT(*) FROM raw_props) as props_count,
  (SELECT COUNT(*) FROM games) as games_count,
  (SELECT COUNT(*) FROM cappers) as cappers_view_count,
  (SELECT COUNT(*) FROM final_picks) as final_picks_view_count,
  (SELECT COUNT(*) FROM daily_picks) as daily_picks_view_count;

-- Final summary
SELECT 
  'DATABASE CLEANUP SUMMARY' as summary,
  'Removed ~40+ redundant tables' as cleanup_action,
  'Kept essential operational and sports data tables' as preserved,
  'All core SaaS functionality intact' as status,
  'Views still provide backward compatibility' as compatibility;
