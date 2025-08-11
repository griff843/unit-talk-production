-- =============================================================================
-- DATABASE RELATIONSHIP FIXES - IMPROVE HEALTH SCORE
-- Fix missing indexes, foreign keys, and relationship issues
-- =============================================================================

-- Step 1: Add Missing Critical Indexes
-- =============================================================================

-- Add missing picks to user index (critical for performance)
CREATE INDEX IF NOT EXISTS idx_unified_picks_user_id ON unified_picks(user_id);

-- Add other critical missing indexes
CREATE INDEX IF NOT EXISTS idx_unified_picks_prop_id ON unified_picks(prop_id);
CREATE INDEX IF NOT EXISTS idx_unified_picks_placed_at ON unified_picks(placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_picks_status ON unified_picks(status);

-- Add raw_props performance indexes
CREATE INDEX IF NOT EXISTS idx_raw_props_player_name ON raw_props(player_name);
CREATE INDEX IF NOT EXISTS idx_raw_props_stat_type ON raw_props(stat_type);
CREATE INDEX IF NOT EXISTS idx_raw_props_game_date ON raw_props(game_date DESC);

-- Add games performance indexes
CREATE INDEX IF NOT EXISTS idx_games_game_date ON games(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_games_home_team ON games(home_team);
CREATE INDEX IF NOT EXISTS idx_games_away_team ON games(away_team);

-- Add users performance indexes
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_capper ON users(is_capper) WHERE is_capper = true;

-- Step 2: Add Missing Foreign Key Constraints
-- =============================================================================

-- Add foreign key constraints to improve referential integrity
-- Note: We'll add them as NOT VALID first, then validate to avoid locking

-- unified_picks to users foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_unified_picks_user_id' 
    AND table_name = 'unified_picks'
  ) THEN
    ALTER TABLE unified_picks 
    ADD CONSTRAINT fk_unified_picks_user_id 
    FOREIGN KEY (user_id) REFERENCES users(id) 
    NOT VALID;
  END IF;
END $$;

-- unified_picks to raw_props foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_unified_picks_prop_id' 
    AND table_name = 'unified_picks'
  ) THEN
    ALTER TABLE unified_picks 
    ADD CONSTRAINT fk_unified_picks_prop_id 
    FOREIGN KEY (prop_id) REFERENCES raw_props(id) 
    NOT VALID;
  END IF;
END $$;

-- raw_props to games foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_raw_props_game_id' 
    AND table_name = 'raw_props'
  ) THEN
    ALTER TABLE raw_props 
    ADD CONSTRAINT fk_raw_props_game_id 
    FOREIGN KEY (game_id) REFERENCES games(id) 
    NOT VALID;
  END IF;
END $$;

-- contest_participants to contests foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_contest_participants_contest_id' 
    AND table_name = 'contest_participants'
  ) THEN
    ALTER TABLE contest_participants 
    ADD CONSTRAINT fk_contest_participants_contest_id 
    FOREIGN KEY (contest_id) REFERENCES contests(id) 
    NOT VALID;
  END IF;
END $$;

-- contest_participants to users foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_contest_participants_user_id' 
    AND table_name = 'contest_participants'
  ) THEN
    ALTER TABLE contest_participants 
    ADD CONSTRAINT fk_contest_participants_user_id 
    FOREIGN KEY (user_id) REFERENCES users(id) 
    NOT VALID;
  END IF;
END $$;

-- Step 3: Validate Foreign Key Constraints
-- =============================================================================

-- Validate the foreign key constraints (this checks data integrity)
ALTER TABLE unified_picks VALIDATE CONSTRAINT fk_unified_picks_user_id;
ALTER TABLE unified_picks VALIDATE CONSTRAINT fk_unified_picks_prop_id;
ALTER TABLE raw_props VALIDATE CONSTRAINT fk_raw_props_game_id;
ALTER TABLE contest_participants VALIDATE CONSTRAINT fk_contest_participants_contest_id;
ALTER TABLE contest_participants VALIDATE CONSTRAINT fk_contest_participants_user_id;

-- Step 4: Fix Data Quality Issues
-- =============================================================================

-- Clean up any orphaned records that might prevent FK validation
-- (Run this if FK validation fails)

-- Remove picks without valid users (if any)
-- DELETE FROM unified_picks WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);

-- Remove picks without valid props (if any)  
-- DELETE FROM unified_picks WHERE prop_id IS NOT NULL AND prop_id NOT IN (SELECT id FROM raw_props);

-- Remove props without valid games (if any)
-- DELETE FROM raw_props WHERE game_id IS NOT NULL AND game_id NOT IN (SELECT id FROM games);

-- Step 5: Add Additional Performance Indexes
-- =============================================================================

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_unified_picks_user_status ON unified_picks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_unified_picks_user_placed_at ON unified_picks(user_id, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_props_game_stat ON raw_props(game_id, stat_type);
CREATE INDEX IF NOT EXISTS idx_raw_props_player_stat ON raw_props(player_name, stat_type);

-- Contest system indexes
CREATE INDEX IF NOT EXISTS idx_contest_participants_user_contest ON contest_participants(user_id, contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_participants_contest_score ON contest_participants(contest_id, score DESC);

-- Referral system indexes
CREATE INDEX IF NOT EXISTS idx_referrals_status_created ON referrals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referral_status ON referral_rewards(referral_id, status);

-- Step 6: Update Table Statistics
-- =============================================================================

-- Update statistics for query planner optimization
ANALYZE unified_picks;
ANALYZE raw_props;
ANALYZE games;
ANALYZE users;
ANALYZE contests;
ANALYZE contest_participants;
ANALYZE referrals;
ANALYZE referral_rewards;

-- Step 7: Verification
-- =============================================================================

-- Verify improvements
SELECT 
  'RELATIONSHIP FIXES APPLIED' as status,
  (SELECT COUNT(*) FROM information_schema.table_constraints 
   WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public') as foreign_key_count,
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as index_count,
  'Indexes and foreign keys added' as result;

-- Check critical indexes now exist
SELECT 
  'CRITICAL INDEXES VERIFICATION' as check_type,
  CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_unified_picks_user_id') 
       THEN 'EXISTS' ELSE 'MISSING' END as picks_user_index,
  CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_unified_picks_prop_id') 
       THEN 'EXISTS' ELSE 'MISSING' END as picks_prop_index,
  CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_raw_props_game_id') 
       THEN 'EXISTS' ELSE 'MISSING' END as props_game_index,
  'All critical indexes should now exist' as status;

-- Final health check preview
WITH health_metrics AS (
  SELECT 
    CASE WHEN (SELECT COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) FROM raw_props) >= 90 THEN 25 ELSE 0 END as props_score,
    CASE WHEN (SELECT COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) FROM unified_picks) >= 90 THEN 25 ELSE 0 END as picks_score,
    CASE WHEN (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public') >= 20 THEN 25 ELSE 0 END as fk_score,
    CASE WHEN (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') >= 40 THEN 25 ELSE 0 END as index_score
)
SELECT 
  'IMPROVED DATABASE HEALTH SCORE' as assessment,
  (props_score + picks_score + fk_score + index_score) as health_score_out_of_100,
  CASE 
    WHEN (props_score + picks_score + fk_score + index_score) >= 90 THEN 'EXCELLENT - Enterprise Grade'
    WHEN (props_score + picks_score + fk_score + index_score) >= 70 THEN 'GOOD - Production Ready'
    WHEN (props_score + picks_score + fk_score + index_score) >= 50 THEN 'FAIR - Needs Improvement'
    ELSE 'POOR - Critical Issues'
  END as grade,
  'Database relationships and performance optimized' as conclusion
FROM health_metrics;
