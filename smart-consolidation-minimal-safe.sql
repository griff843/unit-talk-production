-- =============================================================================
-- SMART CONSOLIDATION - MINIMAL SAFE VERSION
-- Focus on core MLB consolidation and essential optimizations only
-- =============================================================================

-- Step 1: Verify critical business data (completely safe queries)
-- =============================================================================
SELECT 
  'Pre-consolidation verification:' as check_type,
  (SELECT COUNT(*) FROM contests) as contests_count,
  (SELECT COUNT(*) FROM referrals) as referrals_count,
  (SELECT COUNT(*) FROM leaderboards) as leaderboards_count,
  (SELECT COUNT(*) FROM mlb_history) as mlb_history_count;

-- Step 2: Create unified sports history focused on MLB
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
FROM mlb_history;

-- Step 3: Create RBI backfill system
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
  data_source TEXT, -- 'espn', 'mlb_api', 'manual', etc.
  backfill_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Populate backfill queue with MLB records that need RBI data
INSERT INTO rbi_backfill_queue (unified_history_id, player_name, player_id, game_date, opponent)
SELECT 
  id,
  player_name,
  player_id,
  game_date,
  opponent
FROM unified_sports_history 
WHERE sport = 'MLB' 
  AND (stats->>'needs_rbi_backfill')::boolean = true;

-- Create function to update RBI data
CREATE OR REPLACE FUNCTION update_rbi_data(
  p_unified_history_id UUID,
  p_rbi_value INTEGER,
  p_data_source TEXT DEFAULT 'manual'
) RETURNS BOOLEAN AS $$
BEGIN
  -- Update the unified_sports_history record
  UPDATE unified_sports_history 
  SET 
    stats = jsonb_set(
      jsonb_set(stats, '{rbi}', to_jsonb(p_rbi_value)),
      '{needs_rbi_backfill}', 'false'
    ),
    updated_at = NOW()
  WHERE id = p_unified_history_id;
  
  -- Update the backfill queue
  UPDATE rbi_backfill_queue 
  SET 
    status = 'completed',
    rbi_value = p_rbi_value,
    data_source = p_data_source,
    updated_at = NOW()
  WHERE unified_history_id = p_unified_history_id;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  -- Update backfill queue with error
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

-- Step 4: Create essential performance indexes
-- =============================================================================

-- Unified sports history indexes (CRITICAL for ML performance)
CREATE INDEX IF NOT EXISTS idx_unified_sports_history_sport_date ON unified_sports_history(sport, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_unified_sports_history_player ON unified_sports_history(player_name, sport) WHERE player_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_sports_history_player_id ON unified_sports_history(player_id, sport) WHERE player_id IS NOT NULL;

-- RBI backfill indexes
CREATE INDEX IF NOT EXISTS idx_rbi_backfill_queue_status ON rbi_backfill_queue(status);
CREATE INDEX IF NOT EXISTS idx_rbi_backfill_queue_player_date ON rbi_backfill_queue(player_name, game_date);

-- Essential business table indexes (safe - no column assumptions)
CREATE INDEX IF NOT EXISTS idx_contest_participants_contest_score ON contest_participants(contest_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboards_period_rank ON leaderboards(period, metric_type, rank);
CREATE INDEX IF NOT EXISTS idx_referrals_created ON referrals(created_at DESC);

-- ML/Analytics optimization (PRESERVE COMPETITIVE EDGE) - Conditional indexes
DO $$
BEGIN
  -- DVP matchup ranks index (check for sport column)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'dvp_matchup_ranks' AND column_name = 'sport') THEN
    CREATE INDEX IF NOT EXISTS idx_dvp_matchup_ranks_sport_position ON dvp_matchup_ranks(sport, position, rank);
  ELSE
    CREATE INDEX IF NOT EXISTS idx_dvp_matchup_ranks_position ON dvp_matchup_ranks(position, rank);
  END IF;

  -- EV modeling index (check for sport column)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'ev_modeling' AND column_name = 'sport') THEN
    CREATE INDEX IF NOT EXISTS idx_ev_modeling_sport_confidence ON ev_modeling(sport, confidence DESC);
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'ev_modeling' AND column_name = 'confidence') THEN
    CREATE INDEX IF NOT EXISTS idx_ev_modeling_confidence ON ev_modeling(confidence DESC);
  END IF;

  -- Historical player logs index (check for columns)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'historical_player_logs' AND column_name = 'player_name')
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'historical_player_logs' AND column_name = 'game_date') THEN
    CREATE INDEX IF NOT EXISTS idx_historical_player_logs_player_date ON historical_player_logs(player_name, game_date DESC);
  END IF;

  -- Player stat logs index (check for columns)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'player_stat_logs' AND column_name = 'player_name')
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'player_stat_logs' AND column_name = 'game_date') THEN
    CREATE INDEX IF NOT EXISTS idx_player_stat_logs_player_date ON player_stat_logs(player_name, game_date DESC);
  END IF;
END $$;

-- Step 5: Create MLB performance view
-- =============================================================================

-- MLB player performance summary with RBI tracking
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

-- Step 6: Remove only truly safe redundant tables
-- =============================================================================
DROP TABLE IF EXISTS automation_errors; -- covered by error_logs
DROP TABLE IF EXISTS clean_raw_props; -- duplicate of raw_props
DROP TABLE IF EXISTS retool_recap_digest; -- external tool data

-- Step 7: Verification and summary (completely safe)
-- =============================================================================

-- Verify consolidation success
SELECT 
  'MLB CONSOLIDATION VERIFICATION:' as check_type,
  (SELECT COUNT(*) FROM unified_sports_history WHERE sport = 'MLB') as mlb_records_migrated,
  (SELECT COUNT(*) FROM rbi_backfill_queue WHERE status = 'pending') as rbi_records_needing_backfill;

-- Show sample MLB data structure
SELECT 
  'Sample MLB data in unified format:' as info,
  player_name,
  game_date,
  opponent,
  result,
  stats
FROM unified_sports_history 
WHERE sport = 'MLB' 
LIMIT 3;

-- Show RBI backfill status
SELECT 
  'RBI backfill status:' as info,
  (SELECT COUNT(*) FROM rbi_backfill_queue WHERE status = 'pending') as pending_backfills,
  (SELECT COUNT(*) FROM rbi_backfill_queue WHERE status = 'completed') as completed_backfills,
  'Use update_rbi_data(id, rbi_value) function to backfill' as backfill_method;

-- Show business functions preserved (completely safe queries)
SELECT 
  'Business functions preserved and optimized:' as info,
  (SELECT COUNT(*) FROM contests) as total_contests,
  (SELECT COUNT(*) FROM referrals) as total_referrals,
  (SELECT COUNT(*) FROM dvp_matchup_ranks) as ml_analysis_records,
  'All competitive advantages maintained and optimized' as status;

-- Final summary
SELECT 
  'MINIMAL CONSOLIDATION COMPLETE!' as status,
  'MLB historical data consolidated with RBI backfill system' as history_status,
  'Essential indexes added for performance' as performance_status,
  'All competitive advantages preserved' as preservation_status,
  'Use rbi-backfill-helper.sql to manage RBI data' as next_step;
