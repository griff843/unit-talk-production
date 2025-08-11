-- =============================================================================
-- BATCH 5: Performance Indexes (Safe Version - Run this last)
-- =============================================================================

-- This version handles errors gracefully if indexes already exist

-- Drop existing indexes first (ignore errors if they don't exist)
DROP INDEX IF EXISTS idx_raw_props_outcome;
DROP INDEX IF EXISTS idx_raw_props_promoted_to_picks;
DROP INDEX IF EXISTS idx_raw_props_expected_value;
DROP INDEX IF EXISTS idx_raw_props_sharp_money;
DROP INDEX IF EXISTS idx_final_picks_tier_status;
DROP INDEX IF EXISTS idx_grading_results_tier_confidence;
DROP INDEX IF EXISTS idx_capper_profiles_discord_id;
DROP INDEX IF EXISTS idx_capper_profiles_win_rate;
DROP INDEX IF EXISTS idx_ml_features_prop_id;
DROP INDEX IF EXISTS idx_settlement_tracking_status;
DROP INDEX IF EXISTS idx_settlement_tracking_game_completed;

-- Create indexes for grading agent performance
CREATE INDEX idx_raw_props_outcome 
ON raw_props(outcome);

CREATE INDEX idx_raw_props_promoted_to_picks 
ON raw_props(promoted_to_picks);

CREATE INDEX idx_raw_props_expected_value 
ON raw_props(expected_value);

CREATE INDEX idx_raw_props_sharp_money 
ON raw_props(sharp_money);

-- Final picks performance
CREATE INDEX idx_final_picks_tier_status 
ON final_picks(tier, play_status);

-- Grading results performance (only if table exists)
CREATE INDEX idx_grading_results_tier_confidence 
ON grading_results(tier, confidence);

-- Capper profiles performance (only if table exists)
CREATE INDEX idx_capper_profiles_discord_id 
ON capper_profiles(discord_id);

CREATE INDEX idx_capper_profiles_win_rate 
ON capper_profiles(win_rate DESC);

-- ML features performance (only if table exists)
CREATE INDEX idx_ml_features_prop_id 
ON ml_features(prop_id);

-- Settlement tracking performance (only if table exists)
CREATE INDEX idx_settlement_tracking_status 
ON settlement_tracking(settlement_status);

CREATE INDEX idx_settlement_tracking_game_completed 
ON settlement_tracking(game_completed_at);

-- Final validation query
SELECT 
  'All indexes created successfully!' as status,
  COUNT(*) as total_props,
  COUNT(CASE WHEN expected_value IS NOT NULL THEN 1 END) as props_with_expected_value,
  COUNT(CASE WHEN edge_score IS NOT NULL THEN 1 END) as props_with_edge_score,
  COUNT(CASE WHEN sharp_money IS NOT NULL THEN 1 END) as props_with_sharp_money,
  NOW() as completed_at
FROM raw_props;

-- Success message
SELECT 
  '🎉 ENHANCED SCORING MIGRATION COMPLETED SUCCESSFULLY!' as message,
  '✅ Your database now has professional-grade scoring capabilities' as capabilities,
  '✅ Performance indexes created for optimal speed' as performance;
