-- =============================================================================
-- SMART CONSOLIDATION PHASE 1: PRESERVE BUSINESS VALUE, REDUCE COMPLEXITY
-- Consolidates 77 tables → ~25 optimized tables while preserving all functionality
-- =============================================================================

-- Step 1: Verify critical business data before consolidation
-- =============================================================================
SELECT 
  'Pre-consolidation verification:' as check_type,
  (SELECT COUNT(*) FROM contests) as contests_count,
  (SELECT COUNT(*) FROM referrals) as referrals_count,
  (SELECT COUNT(*) FROM leaderboards) as leaderboards_count,
  (SELECT COUNT(*) FROM historical_player_logs) as historical_logs_count,
  (SELECT COUNT(*) FROM line_movement_log) as line_movement_count,
  (SELECT COUNT(*) FROM dfs_ownership) as dfs_data_count;

-- Step 2: Create consolidated alert system (merge 5 alert tables → 1)
-- =============================================================================

-- Create unified alerts table
CREATE TABLE IF NOT EXISTS unified_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL, -- 'injury', 'line_movement', 'hedge', 'ai', 'unit_talk'
  alert_category TEXT NOT NULL, -- 'player', 'market', 'system', 'user'
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Core alert data
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  
  -- Targeting
  user_id UUID REFERENCES users(id),
  sport TEXT,
  game_id UUID REFERENCES games(id),
  prop_id UUID REFERENCES raw_props(id),
  
  -- Status tracking
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'dismissed', 'expired')),
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  
  -- Delivery tracking
  channels_sent JSONB DEFAULT '[]', -- ['discord', 'email', 'push']
  delivery_status JSONB DEFAULT '{}',
  
  -- Timing
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Migrate existing alert data
INSERT INTO unified_alerts (alert_type, alert_category, title, message, data, sport, triggered_at, metadata)
SELECT 
  'injury' as alert_type,
  'player' as alert_category,
  COALESCE(player_name, 'Injury Alert') as title,
  COALESCE(alert_message, 'Player injury detected') as message,
  json_build_object(
    'player_name', player_name,
    'injury_type', injury_type,
    'severity', severity,
    'original_table', 'injury_alert_log'
  ) as data,
  sport,
  COALESCE(created_at, NOW()) as triggered_at,
  COALESCE(metadata, '{}') as metadata
FROM injury_alert_log;

INSERT INTO unified_alerts (alert_type, alert_category, title, message, data, sport, game_id, triggered_at, metadata)
SELECT 
  'line_movement' as alert_type,
  'market' as alert_category,
  'Line Movement Detected' as title,
  CONCAT('Line moved from ', old_line, ' to ', new_line) as message,
  json_build_object(
    'old_line', old_line,
    'new_line', new_line,
    'movement_size', movement_size,
    'book', book,
    'original_table', 'line_movement_log'
  ) as data,
  sport,
  game_id,
  COALESCE(timestamp, NOW()) as triggered_at,
  COALESCE(metadata, '{}') as metadata
FROM line_movement_log;

INSERT INTO unified_alerts (alert_type, alert_category, title, message, data, sport, triggered_at, metadata)
SELECT 
  'hedge' as alert_type,
  'market' as alert_category,
  'Hedge Opportunity' as title,
  COALESCE(alert_message, 'Hedge opportunity detected') as message,
  json_build_object(
    'opportunity_type', opportunity_type,
    'potential_profit', potential_profit,
    'original_table', 'hedge_alert_log'
  ) as data,
  sport,
  COALESCE(created_at, NOW()) as triggered_at,
  COALESCE(metadata, '{}') as metadata
FROM hedge_alert_log;

INSERT INTO unified_alerts (alert_type, alert_category, title, message, data, triggered_at, metadata)
SELECT 
  'ai' as alert_type,
  'system' as alert_category,
  COALESCE(alert_type, 'AI Alert') as title,
  COALESCE(message, 'AI system alert') as message,
  json_build_object(
    'confidence', confidence,
    'model_version', model_version,
    'original_table', 'ai_alerts_log'
  ) as data,
  COALESCE(created_at, NOW()) as triggered_at,
  COALESCE(metadata, '{}') as metadata
FROM ai_alerts_log;

INSERT INTO unified_alerts (alert_type, alert_category, title, message, data, sport, triggered_at, metadata)
SELECT 
  'unit_talk' as alert_type,
  'system' as alert_category,
  COALESCE(alert_title, 'Unit Talk Alert') as title,
  COALESCE(alert_message, 'System alert') as message,
  json_build_object(
    'alert_level', alert_level,
    'component', component,
    'original_table', 'unit_talk_alerts_log'
  ) as data,
  sport,
  COALESCE(created_at, NOW()) as triggered_at,
  COALESCE(metadata, '{}') as metadata
FROM unit_talk_alerts_log;

-- Step 3: Create consolidated sports history (merge 4 history tables → 1)
-- =============================================================================

-- Create unified sports history table
CREATE TABLE IF NOT EXISTS unified_sports_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL,
  season TEXT NOT NULL,
  game_date DATE NOT NULL,
  
  -- Game info
  game_id TEXT,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  
  -- Player performance
  player_name TEXT,
  player_id TEXT,
  position TEXT,
  team TEXT,
  
  -- Statistics (flexible JSONB for sport-specific stats)
  stats JSONB NOT NULL DEFAULT '{}',
  
  -- Game context
  venue TEXT,
  weather JSONB,
  game_situation JSONB, -- overtime, playoffs, etc.
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  source_table TEXT, -- track original source
  metadata JSONB DEFAULT '{}'
);

-- Migrate MLB history
INSERT INTO unified_sports_history (sport, season, game_date, game_id, home_team, away_team, home_score, away_score, player_name, position, team, stats, source_table, metadata)
SELECT 
  'MLB' as sport,
  season,
  game_date,
  game_id,
  home_team,
  away_team,
  home_score,
  away_score,
  player_name,
  position,
  team,
  json_build_object(
    'hits', hits,
    'runs', runs,
    'rbis', rbis,
    'home_runs', home_runs,
    'stolen_bases', stolen_bases,
    'strikeouts', strikeouts
  ) as stats,
  'mlb_history' as source_table,
  COALESCE(metadata, '{}') as metadata
FROM mlb_history;

-- Migrate NBA history
INSERT INTO unified_sports_history (sport, season, game_date, game_id, home_team, away_team, home_score, away_score, player_name, position, team, stats, source_table, metadata)
SELECT 
  'NBA' as sport,
  season,
  game_date,
  game_id,
  home_team,
  away_team,
  home_score,
  away_score,
  player_name,
  position,
  team,
  json_build_object(
    'points', points,
    'rebounds', rebounds,
    'assists', assists,
    'steals', steals,
    'blocks', blocks,
    'turnovers', turnovers,
    'minutes', minutes
  ) as stats,
  'nba_history' as source_table,
  COALESCE(metadata, '{}') as metadata
FROM nba_history;

-- Migrate NFL history
INSERT INTO unified_sports_history (sport, season, game_date, game_id, home_team, away_team, home_score, away_score, player_name, position, team, stats, source_table, metadata)
SELECT 
  'NFL' as sport,
  season,
  game_date,
  game_id,
  home_team,
  away_team,
  home_score,
  away_score,
  player_name,
  position,
  team,
  json_build_object(
    'passing_yards', passing_yards,
    'rushing_yards', rushing_yards,
    'receiving_yards', receiving_yards,
    'touchdowns', touchdowns,
    'interceptions', interceptions,
    'fumbles', fumbles
  ) as stats,
  'nfl_history' as source_table,
  COALESCE(metadata, '{}') as metadata
FROM nfl_history;

-- Migrate NHL history
INSERT INTO unified_sports_history (sport, season, game_date, game_id, home_team, away_team, home_score, away_score, player_name, position, team, stats, source_table, metadata)
SELECT 
  'NHL' as sport,
  season,
  game_date,
  game_id,
  home_team,
  away_team,
  home_score,
  away_score,
  player_name,
  position,
  team,
  json_build_object(
    'goals', goals,
    'assists', assists,
    'shots', shots,
    'hits', hits,
    'blocked_shots', blocked_shots,
    'penalty_minutes', penalty_minutes
  ) as stats,
  'nhl_history' as source_table,
  COALESCE(metadata, '{}') as metadata
FROM nhl_history;

-- Step 4: Create performance indexes for new consolidated tables
-- =============================================================================

-- Unified alerts indexes
CREATE INDEX IF NOT EXISTS idx_unified_alerts_type_status ON unified_alerts(alert_type, status);
CREATE INDEX IF NOT EXISTS idx_unified_alerts_triggered_at ON unified_alerts(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_alerts_user_id ON unified_alerts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_alerts_game_id ON unified_alerts(game_id) WHERE game_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_alerts_sport ON unified_alerts(sport) WHERE sport IS NOT NULL;

-- Unified sports history indexes
CREATE INDEX IF NOT EXISTS idx_unified_sports_history_sport_date ON unified_sports_history(sport, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_unified_sports_history_player ON unified_sports_history(player_name, sport) WHERE player_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_sports_history_team ON unified_sports_history(team, sport) WHERE team IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_sports_history_season ON unified_sports_history(sport, season);

-- Step 5: Verification and summary
-- =============================================================================

-- Verify consolidation success
SELECT 
  'Consolidation verification:' as check_type,
  (SELECT COUNT(*) FROM unified_alerts) as unified_alerts_count,
  (SELECT COUNT(*) FROM unified_sports_history) as unified_history_count,
  'Alert types: ' || string_agg(DISTINCT alert_type, ', ') as alert_types
FROM unified_alerts
GROUP BY 1,2,3;

-- Show what we can now safely remove
SELECT 
  'Tables ready for removal after consolidation:' as info,
  'injury_alert_log, hedge_alert_log, ai_alerts_log, unit_talk_alerts_log, line_movement_log' as alert_tables,
  'mlb_history, nba_history, nfl_history, nhl_history' as history_tables,
  'Data preserved in unified_alerts and unified_sports_history' as preservation_note;
