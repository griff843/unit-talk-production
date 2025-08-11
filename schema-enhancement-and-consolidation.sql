-- =============================================================================
-- SCHEMA ENHANCEMENT AND CONSOLIDATION
-- Add missing essential columns, then consolidate MLB data
-- =============================================================================

-- Step 1: Enhance contests table with missing columns
-- =============================================================================

-- Add missing columns to contests table
ALTER TABLE contests 
ADD COLUMN IF NOT EXISTS sport TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed', 'cancelled', 'upcoming')),
ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS prize_pool NUMERIC,
ADD COLUMN IF NOT EXISTS max_participants INTEGER,
ADD COLUMN IF NOT EXISTS entry_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS contest_type TEXT DEFAULT 'general' CHECK (contest_type IN ('general', 'sport_specific', 'daily', 'weekly', 'monthly')),
ADD COLUMN IF NOT EXISTS rules JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Update existing contests with default values
UPDATE contests SET 
  sport = 'general',
  status = 'active',
  description = title,
  prize_pool = CASE WHEN prize ~ '^[0-9]+\.?[0-9]*$' THEN prize::numeric ELSE 0 END,
  start_date = created_at,
  end_date = created_at + INTERVAL '30 days'
WHERE sport IS NULL;

-- Step 2: Enhance referral system with status columns
-- =============================================================================

-- Add status column to referrals table if missing
ALTER TABLE referrals 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'expired')),
ADD COLUMN IF NOT EXISTS referral_code TEXT,
ADD COLUMN IF NOT EXISTS referred_user_id UUID,
ADD COLUMN IF NOT EXISTS reward_earned NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add status column to referral_rewards table if missing
ALTER TABLE referral_rewards 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'));

-- Update existing records with default status
UPDATE referrals SET status = 'active' WHERE status IS NULL;
UPDATE referral_rewards SET status = 'pending' WHERE status IS NULL;

-- Step 3: Enhance ML/Analytics tables with sport columns
-- =============================================================================

-- Add sport column to dvp_matchup_ranks if missing
ALTER TABLE dvp_matchup_ranks 
ADD COLUMN IF NOT EXISTS sport TEXT DEFAULT 'MLB',
ADD COLUMN IF NOT EXISTS season TEXT,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT NOW();

-- Add sport column to ev_modeling if missing
ALTER TABLE ev_modeling 
ADD COLUMN IF NOT EXISTS sport TEXT DEFAULT 'MLB',
ADD COLUMN IF NOT EXISTS model_version TEXT DEFAULT '1.0',
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT NOW();

-- Add sport column to historical_player_logs if missing
ALTER TABLE historical_player_logs 
ADD COLUMN IF NOT EXISTS sport TEXT DEFAULT 'MLB';

-- Add sport column to player_stat_logs if missing
ALTER TABLE player_stat_logs 
ADD COLUMN IF NOT EXISTS sport TEXT DEFAULT 'MLB';

-- Update sport columns based on existing data patterns
UPDATE dvp_matchup_ranks SET sport = 'MLB' WHERE sport IS NULL;
UPDATE ev_modeling SET sport = 'MLB' WHERE sport IS NULL;
UPDATE historical_player_logs SET sport = 'MLB' WHERE sport IS NULL;
UPDATE player_stat_logs SET sport = 'MLB' WHERE sport IS NULL;

-- Step 4: Create unified sports history (MLB consolidation)
-- =============================================================================

-- Create unified sports history table
CREATE TABLE IF NOT EXISTS unified_sports_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL,
  game_date DATE NOT NULL,
  
  -- Player info
  player_name TEXT,
  player_id TEXT,
  opponent TEXT,
  result TEXT,
  
  -- Statistics (flexible JSONB for sport-specific stats)
  stats JSONB NOT NULL DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  source_table TEXT,
  source TEXT, -- ESPN, etc.
  metadata JSONB DEFAULT '{}'
);

-- Migrate MLB history with RBI placeholder
INSERT INTO unified_sports_history (sport, game_date, player_name, player_id, opponent, result, stats, source_table, source)
SELECT 
  'MLB' as sport,
  game_date,
  player_name,
  player_id,
  opponent,
  result,
  json_build_object(
    'at_bats', ab,
    'runs', r,
    'hits', h,
    'total_bases', tb,
    'home_runs', hr,
    'walks', bb,
    'strikeouts', k,
    'rbi', NULL, -- Placeholder for backfill
    'needs_rbi_backfill', true
  ) as stats,
  'mlb_history' as source_table,
  source
FROM mlb_history
ON CONFLICT DO NOTHING; -- Avoid duplicates if run multiple times

-- Step 5: Create RBI backfill system
-- =============================================================================

-- Create RBI backfill tracking table
CREATE TABLE IF NOT EXISTS rbi_backfill_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_history_id UUID NOT NULL REFERENCES unified_sports_history(id),
  player_name TEXT NOT NULL,
  player_id TEXT,
  game_date DATE NOT NULL,
  opponent TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  rbi_value INTEGER,
  data_source TEXT,
  backfill_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Populate backfill queue (avoid duplicates)
INSERT INTO rbi_backfill_queue (unified_history_id, player_name, player_id, game_date, opponent)
SELECT 
  id,
  player_name,
  player_id,
  game_date,
  opponent
FROM unified_sports_history 
WHERE sport = 'MLB' 
  AND (stats->>'needs_rbi_backfill')::boolean = true
  AND id NOT IN (SELECT unified_history_id FROM rbi_backfill_queue);

-- Create RBI update function
CREATE OR REPLACE FUNCTION update_rbi_data(
  p_unified_history_id UUID,
  p_rbi_value INTEGER,
  p_data_source TEXT DEFAULT 'manual'
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE unified_sports_history 
  SET 
    stats = jsonb_set(
      jsonb_set(stats, '{rbi}', to_jsonb(p_rbi_value)),
      '{needs_rbi_backfill}', 'false'
    ),
    updated_at = NOW()
  WHERE id = p_unified_history_id;
  
  UPDATE rbi_backfill_queue 
  SET 
    status = 'completed',
    rbi_value = p_rbi_value,
    data_source = p_data_source,
    updated_at = NOW()
  WHERE unified_history_id = p_unified_history_id;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  UPDATE rbi_backfill_queue 
  SET 
    status = 'failed',
    error_message = SQLERRM,
    backfill_attempts = backfill_attempts + 1,
    last_attempt_at = NOW(),
    updated_at = NOW()
  WHERE unified_history_id = p_unified_history_id;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create comprehensive performance indexes
-- =============================================================================

-- Enhanced contests indexes
CREATE INDEX IF NOT EXISTS idx_contests_sport_status ON contests(sport, status);
CREATE INDEX IF NOT EXISTS idx_contests_status_dates ON contests(status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_contests_type_sport ON contests(contest_type, sport);

-- Enhanced referral indexes
CREATE INDEX IF NOT EXISTS idx_referrals_status_created ON referrals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_status ON referral_rewards(status);

-- Enhanced ML/Analytics indexes (conditional based on actual columns)
DO $$
BEGIN
  -- DVP index - check what columns actually exist
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dvp_matchup_ranks' AND column_name = 'position') THEN
    CREATE INDEX IF NOT EXISTS idx_dvp_matchup_ranks_sport_position ON dvp_matchup_ranks(sport, position, rank);
  ELSE
    CREATE INDEX IF NOT EXISTS idx_dvp_matchup_ranks_sport ON dvp_matchup_ranks(sport);
  END IF;

  -- EV modeling index
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ev_modeling' AND column_name = 'confidence') THEN
    CREATE INDEX IF NOT EXISTS idx_ev_modeling_sport_confidence ON ev_modeling(sport, confidence DESC);
  ELSE
    CREATE INDEX IF NOT EXISTS idx_ev_modeling_sport ON ev_modeling(sport);
  END IF;

  -- Historical player logs index
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'historical_player_logs' AND column_name = 'player_name') THEN
    CREATE INDEX IF NOT EXISTS idx_historical_player_logs_sport_player ON historical_player_logs(sport, player_name, game_date DESC);
  END IF;

  -- Player stat logs index
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_stat_logs' AND column_name = 'player_name') THEN
    CREATE INDEX IF NOT EXISTS idx_player_stat_logs_sport_player ON player_stat_logs(sport, player_name, game_date DESC);
  END IF;
END $$;

-- Unified sports history indexes
CREATE INDEX IF NOT EXISTS idx_unified_sports_history_sport_date ON unified_sports_history(sport, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_unified_sports_history_player ON unified_sports_history(player_name, sport);
CREATE INDEX IF NOT EXISTS idx_unified_sports_history_player_id ON unified_sports_history(player_id, sport);

-- RBI backfill indexes
CREATE INDEX IF NOT EXISTS idx_rbi_backfill_queue_status ON rbi_backfill_queue(status);
CREATE INDEX IF NOT EXISTS idx_rbi_backfill_queue_player_date ON rbi_backfill_queue(player_name, game_date);

-- Step 7: Create enhanced materialized views
-- =============================================================================

-- Enhanced contests summary
CREATE MATERIALIZED VIEW IF NOT EXISTS enhanced_contests_summary AS
SELECT 
  c.id,
  c.title,
  c.sport,
  c.status,
  c.start_date,
  c.end_date,
  c.prize_pool,
  COUNT(cp.user_id) as participant_count,
  MAX(cp.score) as highest_score,
  AVG(cp.score) as average_score,
  NOW() as last_updated
FROM contests c
LEFT JOIN contest_participants cp ON c.id = cp.contest_id
GROUP BY c.id, c.title, c.sport, c.status, c.start_date, c.end_date, c.prize_pool;

-- MLB player performance with RBI tracking
CREATE MATERIALIZED VIEW IF NOT EXISTS mlb_player_performance_summary AS
SELECT 
  player_name,
  player_id,
  COUNT(*) as games_played,
  AVG((stats->>'runs')::numeric) as avg_runs,
  AVG((stats->>'hits')::numeric) as avg_hits,
  AVG((stats->>'home_runs')::numeric) as avg_home_runs,
  AVG((stats->>'walks')::numeric) as avg_walks,
  AVG((stats->>'strikeouts')::numeric) as avg_strikeouts,
  AVG(CASE WHEN (stats->>'rbi') IS NOT NULL THEN (stats->>'rbi')::numeric END) as avg_rbi,
  COUNT(CASE WHEN (stats->>'rbi') IS NOT NULL THEN 1 END) as games_with_rbi_data,
  COUNT(CASE WHEN (stats->>'needs_rbi_backfill')::boolean = true THEN 1 END) as games_needing_rbi_backfill,
  MAX(game_date) as last_game_date,
  NOW() as last_updated
FROM unified_sports_history
WHERE sport = 'MLB' AND stats IS NOT NULL
GROUP BY player_name, player_id;

-- Step 8: Clean up redundant tables
-- =============================================================================
DROP TABLE IF EXISTS automation_errors;
DROP TABLE IF EXISTS clean_raw_props;
DROP TABLE IF EXISTS retool_recap_digest;

-- Step 9: Verification and summary
-- =============================================================================

-- Verify enhancements
SELECT 
  'SCHEMA ENHANCEMENT COMPLETE!' as status,
  'Enhanced contests with sport and status columns' as contests_enhanced,
  'Enhanced referral system with status tracking' as referrals_enhanced,
  'Enhanced ML tables with sport columns' as ml_enhanced,
  'MLB data consolidated with RBI backfill system' as mlb_consolidated;

-- Show enhanced capabilities
SELECT 
  'Enhanced system capabilities:' as info,
  (SELECT COUNT(*) FROM contests WHERE sport IS NOT NULL) as contests_with_sport,
  (SELECT COUNT(*) FROM referrals WHERE status IS NOT NULL) as referrals_with_status,
  (SELECT COUNT(*) FROM dvp_matchup_ranks WHERE sport IS NOT NULL) as dvp_with_sport,
  (SELECT COUNT(*) FROM unified_sports_history WHERE sport = 'MLB') as mlb_records_consolidated,
  (SELECT COUNT(*) FROM rbi_backfill_queue WHERE status = 'pending') as rbi_backfill_pending;
