-- Settlement Database Schema Extensions for Unit Talk Platform
-- Adds comprehensive settlement tracking and game results management

-- ============================================================================
-- GAME RESULTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Game Identification
  external_game_id TEXT NOT NULL, -- From Odds API or other sources
  sport TEXT NOT NULL,
  sport_key TEXT, -- API-specific sport key (e.g., 'americanfootball_ncaaf')
  
  -- Teams
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  
  -- Game Timing
  scheduled_time TIMESTAMPTZ NOT NULL,
  actual_start_time TIMESTAMPTZ,
  completion_time TIMESTAMPTZ,
  
  -- Game Status
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, live, completed, postponed, cancelled
  completed BOOLEAN DEFAULT FALSE,
  
  -- Final Scores
  home_score INTEGER,
  away_score INTEGER,
  
  -- Detailed Scoring (JSON for flexibility)
  period_scores JSONB, -- Quarter/period breakdown
  
  -- Settlement Status
  settlement_status TEXT DEFAULT 'pending', -- pending, verified, disputed, manual
  settlement_timestamp TIMESTAMPTZ,
  
  -- Data Source
  data_source TEXT NOT NULL DEFAULT 'odds-api', -- odds-api, optimal-api, manual
  source_last_update TIMESTAMPTZ,
  
  -- Audit Trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('scheduled', 'live', 'completed', 'postponed', 'cancelled')),
  CONSTRAINT valid_settlement_status CHECK (settlement_status IN ('pending', 'verified', 'disputed', 'manual')),
  CONSTRAINT valid_completion CHECK (
    (completed = TRUE AND completion_time IS NOT NULL AND home_score IS NOT NULL AND away_score IS NOT NULL) OR
    (completed = FALSE)
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_results_external_id ON game_results(external_game_id);
CREATE INDEX IF NOT EXISTS idx_game_results_sport ON game_results(sport);
CREATE INDEX IF NOT EXISTS idx_game_results_status ON game_results(status);
CREATE INDEX IF NOT EXISTS idx_game_results_completion ON game_results(completion_time);
CREATE INDEX IF NOT EXISTS idx_game_results_settlement ON game_results(settlement_status);

-- ============================================================================
-- PROP SETTLEMENTS TABLE 
-- ============================================================================

CREATE TABLE IF NOT EXISTS prop_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links to existing data
  raw_prop_id UUID REFERENCES raw_props(id),
  final_pick_id UUID REFERENCES unified_picks(id),
  game_result_id UUID REFERENCES game_results(id),
  
  -- Prop Details (denormalized for performance)
  player_name TEXT NOT NULL,
  stat_type TEXT NOT NULL,
  line DECIMAL NOT NULL,
  bet_side TEXT NOT NULL, -- 'over', 'under', 'home', 'away', 'yes', 'no'
  
  -- Settlement Details
  actual_value DECIMAL, -- Actual stat value achieved
  settlement_result TEXT, -- 'win', 'loss', 'push', 'void'
  settlement_method TEXT DEFAULT 'automatic', -- automatic, manual, disputed
  
  -- Settlement Source & Verification
  data_source TEXT NOT NULL DEFAULT 'odds-api',
  verified_by TEXT, -- Manual verification source
  verification_timestamp TIMESTAMPTZ,
  
  -- Confidence & Quality
  settlement_confidence DECIMAL DEFAULT 1.0, -- 0.0 to 1.0
  data_quality_score DECIMAL DEFAULT 1.0,
  
  -- Dispute Management
  disputed BOOLEAN DEFAULT FALSE,
  dispute_reason TEXT,
  dispute_resolved_at TIMESTAMPTZ,
  
  -- Timing
  settled_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_settlement_result CHECK (settlement_result IN ('win', 'loss', 'push', 'void')),
  CONSTRAINT valid_settlement_method CHECK (settlement_method IN ('automatic', 'manual', 'disputed')),
  CONSTRAINT valid_bet_side CHECK (bet_side IN ('over', 'under', 'home', 'away', 'yes', 'no')),
  CONSTRAINT valid_confidence CHECK (settlement_confidence >= 0.0 AND settlement_confidence <= 1.0),
  CONSTRAINT valid_quality CHECK (data_quality_score >= 0.0 AND data_quality_score <= 1.0)
);

-- Indexes for performance  
CREATE INDEX IF NOT EXISTS idx_prop_settlements_raw_prop ON prop_settlements(raw_prop_id);
CREATE INDEX IF NOT EXISTS idx_prop_settlements_final_pick ON prop_settlements(final_pick_id);
CREATE INDEX IF NOT EXISTS idx_prop_settlements_game ON prop_settlements(game_result_id);
CREATE INDEX IF NOT EXISTS idx_prop_settlements_result ON prop_settlements(settlement_result);
CREATE INDEX IF NOT EXISTS idx_prop_settlements_player ON prop_settlements(player_name);
CREATE INDEX IF NOT EXISTS idx_prop_settlements_disputed ON prop_settlements(disputed);

-- ============================================================================
-- SETTLEMENT LOG TABLE (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS settlement_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  prop_settlement_id UUID REFERENCES prop_settlements(id),
  game_result_id UUID REFERENCES game_results(id),
  
  -- Action Details
  action_type TEXT NOT NULL, -- created, updated, disputed, resolved, verified
  old_values JSONB, -- Previous state for auditing
  new_values JSONB, -- New state
  
  -- Source & Reasoning
  data_source TEXT NOT NULL,
  processing_agent TEXT, -- Which agent performed the action
  confidence_score DECIMAL,
  notes TEXT,
  
  -- Timing
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_action_type CHECK (action_type IN ('created', 'updated', 'disputed', 'resolved', 'verified'))
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_settlement_log_prop ON settlement_log(prop_settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_log_action ON settlement_log(action_type);
CREATE INDEX IF NOT EXISTS idx_settlement_log_time ON settlement_log(performed_at);

-- ============================================================================
-- EXTEND EXISTING TABLES
-- ============================================================================

-- Add settlement tracking to raw_props table
ALTER TABLE raw_props 
ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS settlement_result TEXT,
ADD CONSTRAINT valid_raw_props_settlement_status 
  CHECK (settlement_status IN ('pending', 'settled', 'void', 'disputed'));

-- Add settlement tracking to unified_picks table  
ALTER TABLE unified_picks
ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS settlement_result TEXT,
ADD COLUMN IF NOT EXISTS actual_outcome DECIMAL,
ADD COLUMN IF NOT EXISTS payout_amount DECIMAL,
ADD CONSTRAINT valid_unified_picks_settlement_status
  CHECK (settlement_status IN ('pending', 'settled', 'void', 'disputed'));

-- ============================================================================
-- SETTLEMENT PERFORMANCE VIEWS
-- ============================================================================

-- View for settlement summary by sport
CREATE OR REPLACE VIEW settlement_summary_by_sport AS
SELECT 
  gr.sport,
  COUNT(*) as total_games,
  COUNT(CASE WHEN gr.completed THEN 1 END) as completed_games,
  COUNT(CASE WHEN gr.settlement_status = 'verified' THEN 1 END) as verified_games,
  COUNT(ps.id) as total_props,
  COUNT(CASE WHEN ps.settlement_result = 'win' THEN 1 END) as winning_props,
  COUNT(CASE WHEN ps.settlement_result = 'loss' THEN 1 END) as losing_props,
  COUNT(CASE WHEN ps.settlement_result = 'push' THEN 1 END) as push_props,
  COUNT(CASE WHEN ps.disputed THEN 1 END) as disputed_props,
  ROUND(
    COUNT(CASE WHEN ps.settlement_result = 'win' THEN 1 END)::DECIMAL / 
    NULLIF(COUNT(CASE WHEN ps.settlement_result IN ('win', 'loss') THEN 1 END), 0) * 100, 2
  ) as win_rate_percent
FROM game_results gr
LEFT JOIN prop_settlements ps ON gr.id = ps.game_result_id
GROUP BY gr.sport
ORDER BY total_games DESC;

-- View for recent settlement activity
CREATE OR REPLACE VIEW recent_settlement_activity AS
SELECT 
  ps.id,
  ps.player_name,
  ps.stat_type,
  ps.line,
  ps.bet_side,
  ps.actual_value,
  ps.settlement_result,
  gr.home_team,
  gr.away_team,
  gr.sport,
  ps.settled_at,
  ps.settlement_confidence,
  ps.disputed
FROM prop_settlements ps
JOIN game_results gr ON ps.game_result_id = gr.id
WHERE ps.settled_at >= NOW() - INTERVAL '7 days'
ORDER BY ps.settled_at DESC;

-- ============================================================================
-- FUNCTIONS FOR SETTLEMENT PROCESSING
-- ============================================================================

-- Function to automatically determine bet result
CREATE OR REPLACE FUNCTION calculate_bet_result(
  p_line DECIMAL,
  p_actual_value DECIMAL,
  p_bet_side TEXT
) RETURNS TEXT AS $$
BEGIN
  -- Handle NULL values
  IF p_actual_value IS NULL THEN
    RETURN 'void';
  END IF;
  
  -- Over/Under bets
  IF p_bet_side = 'over' THEN
    IF p_actual_value > p_line THEN
      RETURN 'win';
    ELSIF p_actual_value < p_line THEN
      RETURN 'loss';
    ELSE
      RETURN 'push';
    END IF;
  ELSIF p_bet_side = 'under' THEN
    IF p_actual_value < p_line THEN
      RETURN 'win';
    ELSIF p_actual_value > p_line THEN
      RETURN 'loss';
    ELSE
      RETURN 'push';
    END IF;
  END IF;
  
  -- Default to manual review for complex cases
  RETURN 'manual';
END;
$$ LANGUAGE plpgsql;

-- Function to update settlement timestamp
CREATE OR REPLACE FUNCTION update_settlement_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  
  -- Update settled_at when settlement_result changes
  IF OLD.settlement_result IS DISTINCT FROM NEW.settlement_result 
     AND NEW.settlement_result IS NOT NULL THEN
    NEW.settled_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_prop_settlements_timestamp
  BEFORE UPDATE ON prop_settlements
  FOR EACH ROW EXECUTE FUNCTION update_settlement_timestamp();

CREATE TRIGGER update_game_results_timestamp
  BEFORE UPDATE ON game_results
  FOR EACH ROW EXECUTE FUNCTION update_settlement_timestamp();

-- ============================================================================
-- SETTLEMENT DATA VALIDATION
-- ============================================================================

-- Add constraint to ensure settlement data integrity
ALTER TABLE prop_settlements 
ADD CONSTRAINT settlement_data_integrity 
CHECK (
  (settlement_result IS NULL AND actual_value IS NULL) OR
  (settlement_result IS NOT NULL AND (
    settlement_result = 'void' OR 
    actual_value IS NOT NULL
  ))
);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE game_results IS 'Stores comprehensive game results and settlement status for all sports';
COMMENT ON TABLE prop_settlements IS 'Tracks settlement outcomes for individual prop bets with audit trail';
COMMENT ON TABLE settlement_log IS 'Audit log for all settlement-related actions and changes';

COMMENT ON VIEW settlement_summary_by_sport IS 'Aggregated settlement performance metrics by sport';
COMMENT ON VIEW recent_settlement_activity IS 'Recent settlement activity for monitoring and review';

COMMENT ON FUNCTION calculate_bet_result IS 'Automatically calculates bet result based on line, actual value, and bet side';
COMMENT ON FUNCTION update_settlement_timestamp IS 'Trigger function to maintain settlement timestamps';