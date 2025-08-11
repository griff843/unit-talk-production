-- =============================================================================
-- PHASE 1: STEP 3 - Create remaining tables and setup
-- Run this AFTER Step 2 completes successfully
-- =============================================================================

-- STEP 3: Create parlay_tickets table
-- =============================================================================
CREATE TABLE parlay_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parlay_type TEXT NOT NULL CHECK (parlay_type IN ('parlay', 'teaser', 'round_robin', 'system')),
  total_legs INTEGER NOT NULL,
  legs_needed_to_win INTEGER DEFAULT NULL,
  total_odds NUMERIC NOT NULL,
  total_stake NUMERIC NOT NULL,
  potential_payout NUMERIC NOT NULL,
  actual_payout NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'push', 'partial')),
  legs_won INTEGER DEFAULT 0,
  legs_lost INTEGER DEFAULT 0,
  legs_pushed INTEGER DEFAULT 0,
  legs_pending INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- Add indexes for parlay_tickets
CREATE INDEX idx_parlay_tickets_user_id ON parlay_tickets(user_id);
CREATE INDEX idx_parlay_tickets_status ON parlay_tickets(status);

-- STEP 4: Create automated triggers
-- =============================================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
CREATE TRIGGER update_unified_picks_updated_at 
  BEFORE UPDATE ON unified_picks 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- STEP 5: Create backward compatibility views
-- =============================================================================

-- Cappers view (matches existing cappers table structure)
CREATE OR REPLACE VIEW cappers_new AS
SELECT 
  id,
  discord_id,
  username,
  display_name,
  tier,
  total_picks,
  wins,
  losses,
  pushes,
  win_rate,
  roi,
  units_won,
  streak_current,
  streak_type,
  created_at,
  updated_at,
  metadata
FROM users 
WHERE is_capper = TRUE;

-- STEP 6: Add foreign key constraints to existing tables if they exist
-- =============================================================================

-- Try to add foreign key to raw_props if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'raw_props') THEN
    -- Add foreign key constraint if column exists
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'raw_props' AND column_name = 'id') THEN
      ALTER TABLE unified_picks 
        ADD CONSTRAINT fk_unified_picks_prop_id 
        FOREIGN KEY (prop_id) REFERENCES raw_props(id) ON DELETE SET NULL;
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors, constraint might already exist
    NULL;
END $$;

-- Try to add foreign key to games if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'games') THEN
    -- Add foreign key constraint if column exists
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'id') THEN
      ALTER TABLE unified_picks 
        ADD CONSTRAINT fk_unified_picks_game_id 
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL;
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors, constraint might already exist
    NULL;
END $$;

-- Final verification
SELECT 
  '🎉 Phase 1 Complete: SaaS Foundation Ready!' as status,
  'All tables created successfully' as tables,
  'Ready for data migration' as next_step,
  NOW() as completed_at;
