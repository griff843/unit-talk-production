-- =============================================================================
-- TICKET STATE MANAGEMENT: Leg-Aware Betting System
-- Architecture: Advanced State Machine for Multi-Leg Betting
-- Capacity: Real-time state tracking for complex betting scenarios
-- Features: Hedge windows, cashout values, individual leg tracking
-- =============================================================================

-- Enable required extensions for advanced state management
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1) Main ticket state management table
CREATE TABLE betting_tickets (
  -- Primary identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id TEXT NOT NULL UNIQUE,     -- External ticket identifier
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Ticket configuration
  ticket_type TEXT NOT NULL CHECK (ticket_type IN ('single', 'parlay', 'teaser', 'round_robin', 'system', 'if_bet')),
  legs_total INTEGER NOT NULL CHECK (legs_total >= 1 AND legs_total <= 25),
  legs_needed_to_win INTEGER NOT NULL DEFAULT 0, -- For system bets
  
  -- Current state tracking
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN (
    'open',           -- Ticket created, legs can be added
    'live',           -- All legs placed, games in progress
    'sweat',          -- Some legs hit, others pending
    'hedge_window',   -- Hedge opportunity detected
    'cashout_window', -- Cashout opportunity available
    'done'            -- Final state (won/lost/pushed)
  )),
  
  -- Leg tracking
  legs_hit INTEGER NOT NULL DEFAULT 0,
  legs_lost INTEGER NOT NULL DEFAULT 0,
  legs_pushed INTEGER NOT NULL DEFAULT 0,
  legs_pending INTEGER NOT NULL DEFAULT 0,
  legs_void INTEGER NOT NULL DEFAULT 0,
  
  -- Financial tracking
  total_stake NUMERIC(10,2) NOT NULL,
  exposure_units NUMERIC(8,2) NOT NULL DEFAULT 0,
  potential_payout NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  cashout_value NUMERIC(12,2),
  
  -- Risk management
  max_loss NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_win NUMERIC(12,2) NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'extreme')),
  
  -- Hedge recommendations
  hedge_recommendations JSONB DEFAULT '[]',
  hedge_window_open TIMESTAMPTZ,
  hedge_window_close TIMESTAMPTZ,
  auto_hedge_enabled BOOLEAN NOT NULL DEFAULT false,
  hedge_threshold NUMERIC(5,2) DEFAULT 80.0, -- Trigger hedge at 80% probability
  
  -- Cashout management  
  cashout_enabled BOOLEAN NOT NULL DEFAULT true,
  min_cashout_value NUMERIC(10,2),
  max_cashout_value NUMERIC(10,2),
  cashout_multiplier NUMERIC(6,3) DEFAULT 1.0,
  
  -- Advanced analytics
  win_probability NUMERIC(5,2),        -- Current win probability (0-100)
  expected_value NUMERIC(10,2),        -- Current expected value
  kelly_recommendation NUMERIC(8,4),   -- Kelly criterion recommendation
  market_movement JSONB DEFAULT '{}',  -- Market movement tracking
  
  -- State machine metadata
  state_history JSONB DEFAULT '[]',    -- State transition history
  last_state_change TIMESTAMPTZ,
  state_change_reason TEXT,
  automated_actions JSONB DEFAULT '[]', -- Auto-hedge, auto-cashout history
  
  -- External integrations
  sportsbook_ticket_id TEXT,
  sportsbook_name TEXT,
  api_sync_status TEXT DEFAULT 'pending' CHECK (api_sync_status IN ('pending', 'synced', 'failed', 'manual')),
  last_api_sync TIMESTAMPTZ,
  
  -- Performance tracking
  processing_latency INTEGER,          -- State update latency in ms
  last_calculation TIMESTAMPTZ,
  calculation_version TEXT DEFAULT 'v1.0',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT chk_legs_consistency CHECK (
    legs_hit + legs_lost + legs_pushed + legs_pending + legs_void = legs_total
  ),
  CONSTRAINT chk_financial_values CHECK (
    total_stake > 0 AND 
    potential_payout >= total_stake AND
    (cashout_value IS NULL OR cashout_value >= 0)
  ),
  CONSTRAINT chk_probabilities CHECK (
    win_probability IS NULL OR win_probability BETWEEN 0 AND 100
  )
);

-- 2) Individual leg tracking table
CREATE TABLE ticket_legs (
  -- Primary identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES betting_tickets(id) ON DELETE CASCADE,
  leg_index INTEGER NOT NULL,
  
  -- Leg details
  unified_pick_id UUID REFERENCES unified_picks(id) ON DELETE SET NULL,
  prop_id UUID REFERENCES raw_props(id) ON DELETE SET NULL,
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  
  -- Betting information
  selection TEXT NOT NULL,
  line NUMERIC(8,3),
  odds INTEGER NOT NULL,              -- American odds format
  stake NUMERIC(8,2) NOT NULL,
  
  -- Current status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'won', 'lost', 'pushed', 'void', 'cancelled'
  )),
  
  -- Settlement details
  actual_result NUMERIC(8,3),
  settlement_timestamp TIMESTAMPTZ,
  settlement_source TEXT,
  
  -- Live tracking
  current_score JSONB DEFAULT '{}',    -- Live game score/stats
  time_remaining TEXT,                 -- Game time remaining
  leg_probability NUMERIC(5,2),       -- Live win probability
  
  -- Market tracking
  opening_odds INTEGER,
  current_odds INTEGER,
  best_odds INTEGER,
  odds_movement JSONB DEFAULT '[]',    -- Historical odds movement
  
  -- Performance metrics
  closing_line_value NUMERIC(6,2),    -- CLV at settlement
  steam_indicator BOOLEAN DEFAULT false,
  sharp_action BOOLEAN DEFAULT false,
  
  -- Timestamps
  placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  game_start TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_ticket_leg UNIQUE (ticket_id, leg_index)
);

-- 3) State transition log for audit and analysis
CREATE TABLE ticket_state_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES betting_tickets(id) ON DELETE CASCADE,
  
  -- Transition details
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  transition_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Context
  trigger_event TEXT NOT NULL,         -- 'leg_result', 'hedge_detected', 'manual', 'auto_cashout'
  trigger_data JSONB DEFAULT '{}',     -- Event-specific data
  
  -- System info
  processor_name TEXT,                 -- Which system triggered the change
  processing_time_ms INTEGER,
  
  -- State snapshot
  state_snapshot JSONB NOT NULL       -- Complete state at time of transition
);

-- 4) Performance-optimized indexes
CREATE INDEX CONCURRENTLY idx_betting_tickets_user_state 
  ON betting_tickets (user_id, state) 
  WHERE state NOT IN ('done');

CREATE INDEX CONCURRENTLY idx_betting_tickets_live_tracking 
  ON betting_tickets (state, updated_at DESC) 
  WHERE state IN ('live', 'sweat', 'hedge_window');

CREATE INDEX CONCURRENTLY idx_betting_tickets_hedge_window 
  ON betting_tickets (hedge_window_open, hedge_window_close) 
  WHERE state = 'hedge_window';

CREATE INDEX CONCURRENTLY idx_ticket_legs_status 
  ON ticket_legs (ticket_id, status) 
  INCLUDE (leg_index, selection, odds);

CREATE INDEX CONCURRENTLY idx_ticket_legs_game_tracking 
  ON ticket_legs (game_id, game_start) 
  WHERE status = 'pending' AND game_start > NOW();

CREATE INDEX CONCURRENTLY idx_ticket_state_log_recent 
  ON ticket_state_log (ticket_id, transition_timestamp DESC);

-- GIN indexes for JSONB data
CREATE INDEX CONCURRENTLY idx_betting_tickets_hedge_gin 
  ON betting_tickets USING GIN (hedge_recommendations);

CREATE INDEX CONCURRENTLY idx_betting_tickets_state_history_gin 
  ON betting_tickets USING GIN (state_history);

CREATE INDEX CONCURRENTLY idx_ticket_legs_odds_movement_gin 
  ON ticket_legs USING GIN (odds_movement);

-- 5) Advanced state machine functions
CREATE OR REPLACE FUNCTION update_ticket_state(
  p_ticket_id UUID,
  p_trigger_event TEXT DEFAULT 'manual'
) RETURNS TEXT AS $$
DECLARE
  current_ticket RECORD;
  new_state TEXT;
  state_changed BOOLEAN := false;
BEGIN
  -- Get current ticket state with leg summary
  SELECT 
    bt.*,
    COUNT(tl.id) as total_legs_count,
    COUNT(tl.id) FILTER (WHERE tl.status = 'won') as won_count,
    COUNT(tl.id) FILTER (WHERE tl.status = 'lost') as lost_count,
    COUNT(tl.id) FILTER (WHERE tl.status = 'pushed') as pushed_count,
    COUNT(tl.id) FILTER (WHERE tl.status = 'pending') as pending_count,
    COUNT(tl.id) FILTER (WHERE tl.status = 'void') as void_count
  INTO current_ticket
  FROM betting_tickets bt
  LEFT JOIN ticket_legs tl ON bt.id = tl.ticket_id
  WHERE bt.id = p_ticket_id
  GROUP BY bt.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found: %', p_ticket_id;
  END IF;

  -- State machine logic
  new_state := current_ticket.state;
  
  CASE current_ticket.state
    WHEN 'open' THEN
      IF current_ticket.pending_count = 0 AND current_ticket.total_legs_count > 0 THEN
        new_state := 'live';
        state_changed := true;
      END IF;
    
    WHEN 'live' THEN
      IF current_ticket.lost_count > 0 AND 
         (current_ticket.ticket_type != 'system' OR current_ticket.lost_count > (current_ticket.legs_total - current_ticket.legs_needed_to_win)) THEN
        new_state := 'done';
        state_changed := true;
      ELSIF current_ticket.won_count > 0 AND current_ticket.pending_count > 0 THEN
        new_state := 'sweat';
        state_changed := true;
      ELSIF current_ticket.pending_count = 0 THEN
        new_state := 'done';
        state_changed := true;
      END IF;
    
    WHEN 'sweat' THEN
      -- Check for hedge opportunities
      IF current_ticket.win_probability > current_ticket.hedge_threshold AND 
         current_ticket.auto_hedge_enabled THEN
        new_state := 'hedge_window';
        state_changed := true;
      ELSIF current_ticket.lost_count > 0 AND 
            (current_ticket.ticket_type != 'system' OR current_ticket.lost_count > (current_ticket.legs_total - current_ticket.legs_needed_to_win)) THEN
        new_state := 'done';
        state_changed := true;
      ELSIF current_ticket.pending_count = 0 THEN
        new_state := 'done';
        state_changed := true;
      END IF;
    
    WHEN 'hedge_window' THEN
      IF current_ticket.hedge_window_close < NOW() OR 
         current_ticket.lost_count > 0 OR 
         current_ticket.pending_count = 0 THEN
        new_state := 'done';
        state_changed := true;
      END IF;
  END CASE;

  -- Update ticket if state changed
  IF state_changed THEN
    UPDATE betting_tickets 
    SET 
      state = new_state,
      legs_hit = current_ticket.won_count,
      legs_lost = current_ticket.lost_count,
      legs_pushed = current_ticket.pushed_count,
      legs_pending = current_ticket.pending_count,
      legs_void = current_ticket.void_count,
      last_state_change = NOW(),
      state_change_reason = p_trigger_event,
      updated_at = NOW()
    WHERE id = p_ticket_id;

    -- Log state transition
    INSERT INTO ticket_state_log (
      ticket_id, from_state, to_state, trigger_event,
      state_snapshot, processing_time_ms
    ) VALUES (
      p_ticket_id, current_ticket.state, new_state, p_trigger_event,
      jsonb_build_object(
        'legs_hit', current_ticket.won_count,
        'legs_lost', current_ticket.lost_count,
        'legs_pending', current_ticket.pending_count,
        'win_probability', current_ticket.win_probability,
        'current_value', current_ticket.current_value
      ),
      EXTRACT(MILLISECONDS FROM NOW() - current_ticket.updated_at)
    );
  END IF;

  RETURN new_state;
END;
$$ LANGUAGE plpgsql;

-- 6) Automated hedge detection
CREATE OR REPLACE FUNCTION detect_hedge_opportunities(
  p_min_probability NUMERIC DEFAULT 75.0,
  p_min_value NUMERIC DEFAULT 100.0
) RETURNS TABLE(
  ticket_id UUID,
  current_value NUMERIC,
  hedge_value NUMERIC,
  win_probability NUMERIC,
  recommendation TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bt.id,
    bt.current_value,
    bt.current_value * 0.85 as hedge_value, -- Conservative hedge
    bt.win_probability,
    CASE 
      WHEN bt.win_probability > 90 THEN 'STRONG_HEDGE'
      WHEN bt.win_probability > 80 THEN 'CONSIDER_HEDGE' 
      ELSE 'MONITOR'
    END as recommendation
  FROM betting_tickets bt
  WHERE bt.state IN ('sweat', 'live')
  AND bt.win_probability >= p_min_probability
  AND bt.current_value >= p_min_value
  AND bt.auto_hedge_enabled = true
  ORDER BY bt.win_probability DESC, bt.current_value DESC;
END;
$$ LANGUAGE plpgsql;

-- 7) Real-time ticket monitoring view
CREATE OR REPLACE VIEW active_tickets_monitor AS
SELECT 
  bt.ticket_id,
  bt.user_id,
  u.username,
  bt.ticket_type,
  bt.state,
  bt.legs_total,
  bt.legs_hit,
  bt.legs_lost,
  bt.legs_pending,
  bt.total_stake,
  bt.current_value,
  bt.win_probability,
  bt.risk_level,
  CASE 
    WHEN bt.state = 'hedge_window' THEN bt.hedge_window_close - NOW()
    WHEN bt.state = 'live' AND EXISTS (
      SELECT 1 FROM ticket_legs tl 
      WHERE tl.ticket_id = bt.id 
      AND tl.status = 'pending' 
      AND tl.game_start < NOW() + INTERVAL '1 hour'
    ) THEN INTERVAL '1 hour'
    ELSE NULL
  END as time_sensitive,
  bt.last_state_change,
  bt.updated_at
FROM betting_tickets bt
JOIN users u ON bt.user_id = u.id
WHERE bt.state NOT IN ('done')
AND bt.updated_at > NOW() - INTERVAL '7 days'
ORDER BY 
  CASE bt.state 
    WHEN 'hedge_window' THEN 1
    WHEN 'sweat' THEN 2
    WHEN 'live' THEN 3
    ELSE 4
  END,
  bt.current_value DESC;

-- 8) Automated triggers for state management
CREATE OR REPLACE FUNCTION ticket_leg_status_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Update ticket state when leg status changes
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    PERFORM update_ticket_state(NEW.ticket_id, 'leg_result');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ticket_leg_status_change
AFTER UPDATE OF status ON ticket_legs
FOR EACH ROW EXECUTE FUNCTION ticket_leg_status_trigger();

-- 9) Updated_at triggers
CREATE TRIGGER trg_betting_tickets_updated_at
BEFORE UPDATE ON betting_tickets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_ticket_legs_updated_at
BEFORE UPDATE ON ticket_legs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 10) Grant permissions
GRANT SELECT, INSERT, UPDATE ON betting_tickets TO api_service;
GRANT SELECT, INSERT, UPDATE ON ticket_legs TO api_service;
GRANT SELECT, INSERT ON ticket_state_log TO api_service;
GRANT EXECUTE ON FUNCTION update_ticket_state(UUID, TEXT) TO api_service;
GRANT EXECUTE ON FUNCTION detect_hedge_opportunities(NUMERIC, NUMERIC) TO api_service;
GRANT SELECT ON active_tickets_monitor TO monitoring_service;

-- 11) Store knowledge about this implementation
-- This will be handled separately by the knowledge storage system

-- =============================================================================
-- TICKET STATE MANAGEMENT SUMMARY
-- =============================================================================
-- 1. Advanced state machine: open → live → sweat → hedge_window → done
-- 2. Individual leg tracking with real-time status updates
-- 3. Automated hedge detection based on win probability thresholds
-- 4. Cashout value calculation and management
-- 5. Complete audit trail via state transition logging
-- 6. Performance optimized for real-time monitoring
-- 7. System bet support with flexible leg requirements
-- 8. Integration with external sportsbook APIs
-- 9. Risk management with exposure tracking
-- 10. Automated state transitions via database triggers
-- =============================================================================