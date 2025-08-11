-- =============================================================================
-- PHASE 2: DATA MIGRATION - CONSOLIDATE EXISTING DATA
-- Migrate data from fragmented tables into unified SaaS architecture
-- =============================================================================

-- Step 1: Migrate cappers data into users table
-- =============================================================================
INSERT INTO users (
  discord_id, username, display_name, tier, is_capper, capper_status, 
  total_picks, wins, losses, roi, created_at, updated_at, metadata
)
SELECT 
  -- Use a unique identifier from cappers table
  COALESCE(name, 'capper_' || id::text) as discord_id,
  COALESCE(name, 'Unknown Capper') as username,
  COALESCE(name, 'Unknown Capper') as display_name,
  CASE 
    WHEN role IN ('bronze', 'silver', 'gold', 'platinum', 'vip', 'vip_plus') THEN role
    ELSE 'bronze'
  END as tier,
  TRUE as is_capper,
  CASE 
    WHEN is_active = TRUE THEN 'active'
    ELSE 'inactive'
  END as capper_status,
  0 as total_picks, -- Will be calculated later
  0 as wins,
  0 as losses,
  0 as roi,
  COALESCE(created_at, NOW()) as created_at,
  NOW() as updated_at,
  json_build_object(
    'migrated_from', 'cappers',
    'original_id', id,
    'original_status', status
  ) as metadata
FROM cappers
WHERE name IS NOT NULL
ON CONFLICT (discord_id) DO UPDATE SET
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name,
  tier = EXCLUDED.tier,
  is_capper = TRUE,
  capper_status = EXCLUDED.capper_status,
  updated_at = NOW();

-- Step 2: Migrate user_profiles data into users table
-- =============================================================================
INSERT INTO users (
  discord_id, username, display_name, tier, is_capper, capper_status,
  created_at, updated_at, last_active, metadata
)
SELECT 
  discord_id,
  COALESCE(username, 'User') as username,
  display_name,
  CASE 
    WHEN tier IN ('bronze', 'silver', 'gold', 'platinum', 'vip', 'vip_plus') THEN tier
    WHEN subscription_tier = 'VIP' THEN 'vip'
    WHEN subscription_tier = 'PREMIUM' THEN 'gold'
    ELSE 'bronze'
  END as tier,
  FALSE as is_capper, -- Regular users, not cappers
  'inactive' as capper_status,
  COALESCE(created_at, NOW()) as created_at,
  COALESCE(updated_at, NOW()) as updated_at,
  COALESCE(last_active, NOW()) as last_active,
  json_build_object(
    'migrated_from', 'user_profiles',
    'original_subscription_tier', subscription_tier
  ) as metadata
FROM user_profiles
WHERE discord_id IS NOT NULL
ON CONFLICT (discord_id) DO UPDATE SET
  username = COALESCE(EXCLUDED.username, users.username),
  display_name = COALESCE(EXCLUDED.display_name, users.display_name),
  last_active = GREATEST(users.last_active, EXCLUDED.last_active),
  updated_at = NOW();

-- Step 3: Create helper function to get user_id from discord_id
-- =============================================================================
CREATE OR REPLACE FUNCTION get_user_id_from_discord(discord_id_param TEXT)
RETURNS UUID AS $$
DECLARE
  user_uuid UUID;
BEGIN
  SELECT id INTO user_uuid FROM users WHERE discord_id = discord_id_param;
  RETURN user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Migrate final_picks data into unified_picks
-- =============================================================================
INSERT INTO unified_picks (
  user_id, prop_id, game_id, pick_type, status, selection, line, odds, stake,
  potential_payout, actual_payout, profit_loss, confidence, analysis, tier_when_placed,
  pick_source, workflow_stage, placed_at, settled_at, actual_result, 
  created_at, updated_at, metadata
)
SELECT 
  get_user_id_from_discord(capper_id) as user_id,
  NULL as prop_id, -- Will link later if possible
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
  LEAST(GREATEST(confidence, 1), 10) as confidence, -- Ensure 1-10 range
  analysis,
  tier as tier_when_placed,
  'promoted' as pick_source, -- These were promoted from system
  CASE 
    WHEN result IN ('win', 'loss', 'push') THEN 'settled'
    ELSE 'published'
  END as workflow_stage,
  COALESCE(created_at, NOW()) as placed_at,
  CASE WHEN result != 'pending' THEN COALESCE(updated_at, NOW()) END as settled_at,
  actual_value as actual_result,
  COALESCE(created_at, NOW()) as created_at,
  COALESCE(updated_at, NOW()) as updated_at,
  json_build_object(
    'migrated_from', 'final_picks',
    'original_capper_id', capper_id,
    'original_result', result,
    'sport', sport,
    'league', league,
    'ticket_type', ticket_type
  ) as metadata
FROM final_picks
WHERE capper_id IS NOT NULL
  AND get_user_id_from_discord(capper_id) IS NOT NULL;

-- Step 5: Migrate daily_picks data into unified_picks
-- =============================================================================
INSERT INTO unified_picks (
  user_id, pick_type, status, selection, odds, stake, potential_payout,
  confidence, analysis, placed_at, created_at, updated_at, metadata,
  parlay_id, parlay_total_legs, parlay_total_odds, workflow_stage, pick_source
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
  json_build_object(
    'migrated_from', 'daily_picks',
    'original_id', id,
    'original_status', status,
    'thread_id', thread_id,
    'message_id', message_id,
    'legs', legs
  ) as metadata,
  id as parlay_id, -- Use original ID as parlay grouping
  total_legs as parlay_total_legs,
  total_odds as parlay_total_odds,
  'published' as workflow_stage,
  'manual' as pick_source -- These were manually created
FROM daily_picks
WHERE capper_discord_id IS NOT NULL
  AND get_user_id_from_discord(capper_discord_id) IS NOT NULL;

-- Step 6: Update user statistics based on migrated picks
-- =============================================================================
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

-- Step 7: Link props to picks where possible
-- =============================================================================
UPDATE unified_picks 
SET prop_id = rp.id
FROM raw_props rp
WHERE unified_picks.game_id = rp.game_id
  AND unified_picks.prop_id IS NULL
  AND rp.game_id IS NOT NULL;

-- Step 8: Clean up helper function
-- =============================================================================
DROP FUNCTION IF EXISTS get_user_id_from_discord(TEXT);

-- Step 9: Final validation and summary
-- =============================================================================
SELECT 
  '🎉 Phase 2: Data Migration Complete!' as status,
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(*) FROM users WHERE is_capper = TRUE) as total_cappers,
  (SELECT COUNT(*) FROM unified_picks) as total_picks,
  (SELECT COUNT(*) FROM unified_picks WHERE prop_id IS NOT NULL) as picks_with_props,
  (SELECT COUNT(*) FROM unified_picks WHERE parlay_id IS NOT NULL) as parlay_legs,
  NOW() as completed_at;
