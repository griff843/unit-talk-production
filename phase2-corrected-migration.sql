-- =============================================================================
-- PHASE 2: CORRECTED DATA MIGRATION - BASED ON ACTUAL TABLE STRUCTURES
-- Migrate data from fragmented tables into unified SaaS architecture
-- =============================================================================

-- Step 1: Migrate cappers data into users table
-- =============================================================================
INSERT INTO users (
  discord_id, username, display_name, tier, is_capper, capper_status, 
  total_picks, wins, losses, roi, created_at, updated_at, metadata
)
SELECT 
  -- Use name as discord_id since that's what you have
  COALESCE(name, 'capper_' || id::text) as discord_id,
  COALESCE(name, 'Unknown Capper') as username,
  COALESCE(name, 'Unknown Capper') as display_name,
  -- All cappers default to 'members' tier since role column contains 'Capper'
  'members' as tier,
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
    'original_status', status,
    'original_role', role
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

-- Step 2: Skip user_profiles migration since table is empty
-- =============================================================================
-- user_profiles table is empty, so we skip this step

-- Step 3: Create helper function to get user_id from capper name
-- =============================================================================
CREATE OR REPLACE FUNCTION get_user_id_from_capper_name(capper_name TEXT)
RETURNS UUID AS $$
DECLARE
  user_uuid UUID;
BEGIN
  SELECT id INTO user_uuid FROM users WHERE username = capper_name OR discord_id = capper_name;
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
  get_user_id_from_capper_name(capper) as user_id,
  NULL as prop_id, -- Will link later if possible
  game_id,
  CASE 
    WHEN ticket_type = 'parlay' THEN 'parlay'
    ELSE 'single'
  END as pick_type,
  CASE 
    WHEN result = 'win' THEN 'won'
    WHEN result = 'loss' THEN 'lost'
    WHEN result = 'push' THEN 'push'
    WHEN final_result = 'W' THEN 'won'
    WHEN final_result = 'L' THEN 'lost'
    WHEN final_result = 'P' THEN 'push'
    ELSE 'pending'
  END as status,
  CONCAT(
    COALESCE(player_name, team, ''), ' ',
    COALESCE(stat_type, bet_type, ''), ' ',
    COALESCE(direction, outcome, ''), ' ',
    COALESCE(line::text, '')
  ) as selection,
  line,
  odds,
  COALESCE(unit_size, 1) as stake,
  COALESCE(unit_size, 1) * odds as potential_payout,
  CASE 
    WHEN result = 'win' OR final_result = 'W' THEN COALESCE(unit_size, 1) * odds
    ELSE 0 
  END as actual_payout,
  CASE 
    WHEN result = 'win' OR final_result = 'W' THEN COALESCE(unit_size, 1) * (odds - 1)
    WHEN result = 'loss' OR final_result = 'L' THEN -COALESCE(unit_size, 1)
    ELSE 0
  END as profit_loss,
  LEAST(GREATEST(COALESCE(confidence_score, ai_confidence_score, 5), 1), 10) as confidence,
  pick_explainer as analysis,
  COALESCE(tier, ai_tier, true_tier, 'C') as tier_when_placed,
  'promoted' as pick_source, -- These were promoted from system
  CASE 
    WHEN result IN ('win', 'loss', 'push') OR final_result IN ('W', 'L', 'P') THEN 'settled'
    WHEN play_status = 'approved' THEN 'published'
    ELSE 'approved'
  END as workflow_stage,
  COALESCE(created_at, NOW()) as placed_at,
  CASE 
    WHEN result IN ('win', 'loss', 'push') OR final_result IN ('W', 'L', 'P') 
    THEN COALESCE(graded_at, created_at, NOW()) 
  END as settled_at,
  actual_stat as actual_result,
  COALESCE(created_at, NOW()) as created_at,
  COALESCE(created_at, NOW()) as updated_at,
  json_build_object(
    'migrated_from', 'final_picks',
    'original_id', id,
    'original_capper', capper,
    'original_result', result,
    'sport', sport,
    'matchup', matchup,
    'ticket_type', ticket_type,
    'play_tag', play_tag,
    'tier_tag', tier_tag,
    'edge_score', edge_score,
    'steam_flag', steam_flag,
    'injury_flag', injury_flag
  ) as metadata
FROM final_picks
WHERE capper IS NOT NULL
  AND get_user_id_from_capper_name(capper) IS NOT NULL;

-- Step 5: Migrate daily_picks data into unified_picks
-- =============================================================================
INSERT INTO unified_picks (
  user_id, pick_type, status, selection, odds, stake, potential_payout,
  confidence, analysis, placed_at, created_at, updated_at, metadata,
  parlay_id, parlay_total_legs, workflow_stage, pick_source, tier_when_placed
)
SELECT 
  get_user_id_from_capper_name(capper) as user_id,
  CASE 
    WHEN play_type = 'parlay' THEN 'parlay'
    ELSE 'single'
  END as pick_type,
  CASE 
    WHEN play_status = 'approved' THEN 'pending'
    WHEN play_status = 'cancelled' THEN 'cancelled'
    ELSE 'pending'
  END as status,
  CONCAT(
    COALESCE(player_name, team, ''), ' ',
    COALESCE(stat_type, bet_type, ''), ' ',
    COALESCE(direction, outcome, ''), ' ',
    COALESCE(line::text, '')
  ) as selection,
  odds,
  COALESCE(unit_size, units, 1) as stake,
  COALESCE(unit_size, units, 1) * odds as potential_payout,
  LEAST(GREATEST(COALESCE(confidence_score, ai_confidence_score, 5), 1), 10) as confidence,
  pick_explainer as analysis,
  COALESCE(created_at, NOW()) as placed_at,
  COALESCE(created_at, NOW()) as created_at,
  COALESCE(updated_at, created_at, NOW()) as updated_at,
  json_build_object(
    'migrated_from', 'daily_picks',
    'original_id', id,
    'original_capper', capper,
    'sport', sport,
    'matchup', matchup,
    'play_tag', play_tag,
    'tier_tag', tier_tag,
    'edge_score', edge_score,
    'promoted_to_final', promoted_to_final,
    'rr_ticket_id', rr_ticket_id
  ) as metadata,
  CASE WHEN parlay_id IS NOT NULL THEN parlay_id::uuid ELSE id::uuid END as parlay_id,
  1 as parlay_total_legs, -- Will be updated for actual parlays
  CASE 
    WHEN promoted_to_final = TRUE THEN 'published'
    WHEN play_status = 'approved' THEN 'approved'
    ELSE 'draft'
  END as workflow_stage,
  'manual' as pick_source, -- These were manually created
  COALESCE(tier, ai_tier, true_tier, 'C') as tier_when_placed
FROM daily_picks
WHERE capper IS NOT NULL
  AND get_user_id_from_capper_name(capper) IS NOT NULL;

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
DROP FUNCTION IF EXISTS get_user_id_from_capper_name(TEXT);

-- Step 9: Final validation and summary
-- =============================================================================
SELECT 
  '🎉 Phase 2: Data Migration Complete!' as status,
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(*) FROM users WHERE is_capper = TRUE) as total_cappers,
  (SELECT COUNT(*) FROM unified_picks) as total_picks,
  (SELECT COUNT(*) FROM unified_picks WHERE pick_source = 'promoted') as final_picks_migrated,
  (SELECT COUNT(*) FROM unified_picks WHERE pick_source = 'manual') as daily_picks_migrated,
  (SELECT COUNT(*) FROM unified_picks WHERE prop_id IS NOT NULL) as picks_with_props,
  (SELECT COUNT(*) FROM unified_picks WHERE parlay_id IS NOT NULL) as parlay_legs,
  NOW() as completed_at;
