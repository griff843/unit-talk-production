-- Smart Form Bridge Constraints Migration
-- Date: 2025-08-09
-- Purpose: Production-grade constraints for Smart Form bridge integration

-- Sport enum (if not already exists)
DO $$ BEGIN
    CREATE TYPE sport_t AS ENUM ('NFL','NBA','MLB','NHL','NCAAF');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Ensure consistency across props table
-- Add foreign key constraints for data integrity
ALTER TABLE raw_props
  ADD CONSTRAINT IF NOT EXISTS fk_props_team 
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  ADD CONSTRAINT IF NOT EXISTS fk_props_player 
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

-- Sport consistency check across related tables
-- This ensures sport values are consistent between props, teams, and players
ALTER TABLE raw_props
  DROP CONSTRAINT IF EXISTS chk_props_sport_consistency;

ALTER TABLE raw_props
  ADD CONSTRAINT chk_props_sport_consistency CHECK (
    sport = COALESCE(
      (SELECT t.sport FROM teams t WHERE t.id = team_id),
      (SELECT p.sport FROM players p WHERE p.id = player_id),
      sport
    )
  );

-- Performance indexes for sport-scoped filtering
CREATE INDEX IF NOT EXISTS idx_raw_props_sport_team_player
  ON raw_props (sport, team_id, player_id);

CREATE INDEX IF NOT EXISTS idx_raw_props_sport_active
  ON raw_props (sport) WHERE odds IS NOT NULL AND line IS NOT NULL;

-- Smart tickets table (if not exists)
CREATE TABLE IF NOT EXISTS smart_tickets (
  bet_slip_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capper_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport sport_t NOT NULL,
  ticket_type TEXT NOT NULL CHECK (ticket_type IN ('single','parlay','round_robin')),
  game_selections JSONB NOT NULL DEFAULT '[]'::jsonb,
  parlay_odds DECIMAL(10,2) NULL, -- Overall parlay odds
  total_units DECIMAL(8,2) NOT NULL DEFAULT 1.0,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','processing','completed','cancelled')),
  selection_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure bet_slip_id is unique across smart_tickets
CREATE UNIQUE INDEX IF NOT EXISTS idx_smart_tickets_bet_slip_id 
  ON smart_tickets (bet_slip_id);

-- Index for capper queries
CREATE INDEX IF NOT EXISTS idx_smart_tickets_capper_status 
  ON smart_tickets (capper_id, status, created_at DESC);

-- Unified picks linkage to smart tickets
-- Add bet_slip_id column if it doesn't exist
ALTER TABLE unified_picks
  ADD COLUMN IF NOT EXISTS bet_slip_id UUID;

-- Add foreign key constraint to link picks with tickets
ALTER TABLE unified_picks
  DROP CONSTRAINT IF EXISTS fk_unified_picks_ticket;

ALTER TABLE unified_picks
  ADD CONSTRAINT fk_unified_picks_ticket 
    FOREIGN KEY (bet_slip_id) REFERENCES smart_tickets(bet_slip_id) ON DELETE CASCADE;

-- Index for quick bet_slip_id lookups
CREATE INDEX IF NOT EXISTS idx_unified_picks_bet_slip_id 
  ON unified_picks (bet_slip_id);

-- Bridge outbox table for idempotent event processing
CREATE TABLE IF NOT EXISTS bridge_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_attempt_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ NULL,
  unique_key TEXT UNIQUE, -- e.g., bet_slip_id for idempotency
  error_message TEXT NULL
);

-- Index for processing outbox events
CREATE INDEX IF NOT EXISTS idx_bridge_outbox_status_next_attempt 
  ON bridge_outbox (status, next_attempt_at) 
  WHERE status IN ('pending', 'failed');

-- Index for unique key lookups
CREATE INDEX IF NOT EXISTS idx_bridge_outbox_unique_key 
  ON bridge_outbox (unique_key) WHERE unique_key IS NOT NULL;

-- Trigger to update updated_at timestamp on smart_tickets
CREATE OR REPLACE FUNCTION update_smart_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_smart_tickets_updated_at ON smart_tickets;
CREATE TRIGGER trigger_smart_tickets_updated_at
    BEFORE UPDATE ON smart_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_smart_tickets_updated_at();

-- Function to validate ticket selection count consistency
CREATE OR REPLACE FUNCTION validate_ticket_selections()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure selection_count matches actual selections in game_selections JSONB
    IF jsonb_array_length(NEW.game_selections) != NEW.selection_count THEN
        RAISE EXCEPTION 'selection_count (%) does not match game_selections array length (%)', 
            NEW.selection_count, jsonb_array_length(NEW.game_selections);
    END IF;
    
    -- Ensure parlay/round_robin tickets have multiple selections
    IF NEW.ticket_type IN ('parlay', 'round_robin') AND NEW.selection_count < 2 THEN
        RAISE EXCEPTION 'Ticket type % requires at least 2 selections, got %', 
            NEW.ticket_type, NEW.selection_count;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_validate_ticket_selections ON smart_tickets;
CREATE TRIGGER trigger_validate_ticket_selections
    BEFORE INSERT OR UPDATE ON smart_tickets
    FOR EACH ROW
    EXECUTE FUNCTION validate_ticket_selections();

-- Comments for documentation
COMMENT ON TABLE smart_tickets IS 'Authoritative record of all smart form ticket submissions';
COMMENT ON TABLE bridge_outbox IS 'Outbox pattern for reliable event publishing to external systems';
COMMENT ON COLUMN smart_tickets.bet_slip_id IS 'Unique identifier for ticket, used as idempotency key';
COMMENT ON COLUMN smart_tickets.game_selections IS 'JSONB array of selections with full context for each leg';
COMMENT ON COLUMN bridge_outbox.unique_key IS 'Idempotency key to prevent duplicate processing';

-- Grant appropriate permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON smart_tickets TO authenticated;
-- GRANT SELECT, INSERT, UPDATE ON bridge_outbox TO authenticated;
-- GRANT SELECT, INSERT, UPDATE ON unified_picks TO authenticated;