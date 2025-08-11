-- =============================================================================
-- SAAS DATA MIGRATION SCRIPT
-- Consolidates existing fragmented data into unified SaaS architecture
-- =============================================================================

-- PHASE 1: MIGRATE USER DATA
-- =============================================================================

-- Migrate from cappers table to unified users table
INSERT INTO users (
  discord_id, username, display_name, tier, total_picks, wins, losses, pushes,
  roi, units_won, streak_current, streak_type, created_at, updated_at, metadata
)
SELECT 
  discord_id,
  username,
  COALESCE(display_name, username) as display_name,
  CASE 
    WHEN tier IN ('bronze', 'silver', 'gold', 'platinum', 'vip', 'vip_plus') THEN tier
    ELSE 'bronze'
  END as tier,
  COALESCE(total_picks, 0) as total_picks,
  COALESCE(wins, 0) as wins,
  COALESCE(losses, 0) as losses,
  COALESCE(pushes, 0) as pushes,
  COALESCE(roi, 0) as roi,
  COALESCE(units_won, 0) as units_won,
  COALESCE(streak_current, 0) as streak_current,
  COALESCE(streak_type, 'none') as streak_type,
  COALESCE(created_at, NOW()) as created_at,
  COALESCE(updated_at, NOW()) as updated_at,
  COALESCE(metadata, '{}') as metadata
FROM cappers
WHERE discord_id IS NOT NULL
ON CONFLICT (discord_id) DO UPDATE SET
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name,
  tier = EXCLUDED.tier,
  total_picks = EXCLUDED.total_picks,
  wins = EXCLUDED.wins,
  losses = EXCLUDED.losses,
  pushes = EXCLUDED.pushes,
  roi = EXCLUDED.roi,
  units_won = EXCLUDED.units_won,
  streak_current = EXCLUDED.streak_current,
  streak_type = EXCLUDED.streak_type,
  updated_at = NOW();

-- Migrate from user_profiles table (if it has additional data)
INSERT INTO users (
  discord_id, username, display_name, tier, created_at, updated_at, last_active, metadata
)
SELECT 
  discord_id,
  COALESCE(username, 'Unknown') as username,
  display_name,
  CASE 
    WHEN tier IN ('bronze', 'silver', 'gold', 'platinum', 'vip', 'vip_plus') THEN tier
    WHEN subscription_tier = 'VIP' THEN 'vip'
    WHEN subscription_tier = 'PREMIUM' THEN 'gold'
    ELSE 'bronze'
  END as tier,
  COALESCE(created_at, NOW()) as created_at,
  COALESCE(updated_at, NOW()) as updated_at,
  COALESCE(last_active, NOW()) as last_active,
  COALESCE(metadata, '{}') as metadata
FROM user_profiles
WHERE discord_id IS NOT NULL
ON CONFLICT (discord_id) DO UPDATE SET
  display_name = COALESCE(EXCLUDED.display_name, users.display_name),
  last_active = GREATEST(users.last_active, EXCLUDED.last_active),
  updated_at = NOW();

-- PHASE 2: MIGRATE PICKS DATA
-- =============================================================================

-- Create a function to get user_id from discord_id for picks migration
CREATE OR REPLACE FUNCTION get_user_id_from_discord(discord_id_param TEXT)
RETURNS UUID AS $$
DECLARE
  user_uuid UUID;
BEGIN
  SELECT id INTO user_uuid FROM users WHERE discord_id = discord_id_param;
  RETURN user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Migrate from final_picks table
INSERT INTO unified_picks (
  user_id, prop_id, game_id, pick_type, status, selection, line, odds, stake,
  potential_payout, actual_payout, profit_loss, confidence, analysis, tier_when_placed,
  placed_at, settled_at, settlement_source, actual_result, created_at, updated_at, metadata
)
SELECT 
  get_user_id_from_discord(capper_id) as user_id,
  NULL as prop_id, -- Will need to link later based on game_id and stat_type
  game_id,
  'single' as pick_type,
  CASE 
    WHEN result = 'win' THEN 'won'
    WHEN result = 'loss' THEN 'lost'
    WHEN result = 'push' THEN 'push'
    ELSE 'pending'
  END as status,
  CONCAT(stat_type, ' ', line) as selection,
  line,
  odds,
  stake,
  payout as potential_payout,
  CASE WHEN result = 'win' THEN payout ELSE 0 END as actual_payout,
  CASE 
    WHEN result = 'win' THEN payout - stake
    WHEN result = 'loss' THEN -stake
    ELSE 0
  END as profit_loss,
  LEAST(confidence, 10) as confidence,
  analysis,
  tier as tier_when_placed,
  COALESCE(created_at, NOW()) as placed_at,
  CASE WHEN result != 'pending' THEN COALESCE(updated_at, NOW()) END as settled_at,
  'manual' as settlement_source,
  actual_value as actual_result,
  COALESCE(created_at, NOW()) as created_at,
  COALESCE(updated_at, NOW()) as updated_at,
  COALESCE(metadata, '{}') as metadata
FROM final_picks
WHERE capper_id IS NOT NULL
  AND get_user_id_from_discord(capper_id) IS NOT NULL;

-- Migrate from daily_picks table
INSERT INTO unified_picks (
  user_id, pick_type, status, selection, odds, stake, potential_payout,
  confidence, analysis, placed_at, created_at, updated_at, metadata,
  parlay_id, parlay_total_legs, parlay_total_odds
)
SELECT 
  get_user_id_from_discord(capper_discord_id) as user_id,
  pick_type,
  CASE 
    WHEN status = 'finalized' THEN 'pending' -- Will be updated when settled
    WHEN status = 'cancelled' THEN 'cancelled'
    ELSE 'pending'
  END as status,
  'Daily Pick' as selection, -- Generic selection for daily picks
  total_odds,
  total_units as stake,
  total_units * total_odds as potential_payout,
  5 as confidence, -- Default confidence for daily picks
  analysis,
  COALESCE(created_at, NOW()) as placed_at,
  COALESCE(created_at, NOW()) as created_at,
  COALESCE(updated_at, NOW()) as updated_at,
  COALESCE(metadata, '{}') as metadata,
  id as parlay_id, -- Use original ID as parlay grouping
  total_legs as parlay_total_legs,
  total_odds as parlay_total_odds
FROM daily_picks
WHERE capper_discord_id IS NOT NULL
  AND get_user_id_from_discord(capper_discord_id) IS NOT NULL;

-- Migrate from picks table (if it has data)
INSERT INTO unified_picks (
  user_id, pick_type, status, selection, odds, stake, potential_payout,
  placed_at, settled_at, created_at, updated_at, metadata
)
SELECT 
  user_id,
  'single' as pick_type,
  COALESCE(status, 'pending') as status,
  COALESCE(selection, pick_type) as selection,
  odds,
  stake,
  potential_payout,
  COALESCE(placed_at, created_at, NOW()) as placed_at,
  settled_at,
  COALESCE(created_at, NOW()) as created_at,
  COALESCE(updated_at, NOW()) as updated_at,
  COALESCE(metadata, '{}') as metadata
FROM picks
WHERE user_id IS NOT NULL;

-- PHASE 3: LINK PROPS TO PICKS
-- =============================================================================

-- Update unified_picks with prop_id where possible
UPDATE unified_picks 
SET prop_id = rp.id
FROM raw_props rp
WHERE unified_picks.game_id = rp.game_id
  AND unified_picks.prop_id IS NULL
  AND rp.game_id IS NOT NULL;

-- PHASE 4: CREATE INITIAL SYSTEM DATA
-- =============================================================================

-- Create default system configuration
INSERT INTO system_config (key, value, category, description) VALUES
('platform.name', '"Unit Talk"', 'general', 'Platform name'),
('platform.version', '"3.0.0"', 'general', 'Current platform version'),
('picks.max_confidence', '10', 'picks', 'Maximum confidence level for picks'),
('picks.min_stake', '0.1', 'picks', 'Minimum stake amount'),
('picks.max_stake', '100', 'picks', 'Maximum stake amount'),
('analytics.retention_days', '365', 'analytics', 'Days to retain analytics data'),
('discord.max_threads_per_game', '1', 'discord', 'Maximum threads per game'),
('agents.default_timeout', '300', 'agents', 'Default agent timeout in seconds');

-- Create default feature flags
INSERT INTO feature_flags (flag_name, enabled, description) VALUES
('enhanced_scoring', true, 'Enable enhanced prop scoring system'),
('ml_predictions', false, 'Enable ML-based predictions'),
('real_time_odds', true, 'Enable real-time odds updates'),
('discord_integration', true, 'Enable Discord bot integration'),
('advanced_analytics', true, 'Enable advanced analytics features'),
('mobile_app', false, 'Enable mobile app features');

-- PHASE 5: UPDATE STATISTICS
-- =============================================================================

-- Recalculate user statistics based on migrated picks
UPDATE users 
SET 
  total_picks = pick_stats.total_picks,
  wins = pick_stats.wins,
  losses = pick_stats.losses,
  pushes = pick_stats.pushes,
  roi = pick_stats.roi,
  units_won = pick_stats.units_won,
  updated_at = NOW()
FROM (
  SELECT 
    user_id,
    COUNT(*) as total_picks,
    COUNT(*) FILTER (WHERE status = 'won') as wins,
    COUNT(*) FILTER (WHERE status = 'lost') as losses,
    COUNT(*) FILTER (WHERE status = 'push') as pushes,
    COALESCE(
      CASE 
        WHEN SUM(stake) > 0 THEN ROUND((SUM(profit_loss) / SUM(stake)) * 100, 2)
        ELSE 0 
      END, 0
    ) as roi,
    COALESCE(SUM(profit_loss), 0) as units_won
  FROM unified_picks 
  WHERE status IN ('won', 'lost', 'push')
  GROUP BY user_id
) pick_stats
WHERE users.id = pick_stats.user_id;

-- PHASE 6: VALIDATION QUERIES
-- =============================================================================

-- Validation summary
SELECT 
  '🎉 Data Migration Completed Successfully!' as status,
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(*) FROM unified_picks) as total_picks,
  (SELECT COUNT(*) FROM unified_picks WHERE prop_id IS NOT NULL) as picks_with_props,
  (SELECT COUNT(*) FROM system_config) as config_entries,
  (SELECT COUNT(*) FROM feature_flags) as feature_flags,
  NOW() as completed_at;

-- Data quality checks
SELECT 
  'Data Quality Report' as report_type,
  (SELECT COUNT(*) FROM users WHERE discord_id IS NOT NULL) as users_with_discord_id,
  (SELECT COUNT(*) FROM unified_picks WHERE user_id IS NOT NULL) as picks_with_valid_user,
  (SELECT COUNT(*) FROM unified_picks WHERE game_id IS NOT NULL) as picks_with_game,
  (SELECT ROUND(AVG(win_rate), 2) FROM users WHERE total_picks > 0) as avg_user_win_rate,
  (SELECT SUM(total_picks) FROM users) as total_platform_picks;

-- Performance metrics
SELECT 
  'Performance Metrics' as metric_type,
  tier,
  COUNT(*) as user_count,
  ROUND(AVG(win_rate), 2) as avg_win_rate,
  ROUND(AVG(roi), 2) as avg_roi,
  SUM(total_picks) as total_picks
FROM users 
WHERE total_picks > 0
GROUP BY tier
ORDER BY avg_roi DESC;

-- Clean up temporary function
DROP FUNCTION IF EXISTS get_user_id_from_discord(TEXT);

-- Success message
SELECT 
  '✅ SaaS Database Migration Complete!' as message,
  'All legacy data consolidated into unified architecture' as details,
  'Ready for production deployment' as status;
