-- =============================================================================
-- PHASE 1: STEP 2 - Create unified_picks table
-- Run this AFTER Step 1 completes successfully
-- =============================================================================

-- STEP 2: Create unified_picks table
-- =============================================================================
CREATE TABLE unified_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prop_id UUID,
  game_id UUID,
  
  -- Pick Details
  pick_type TEXT NOT NULL CHECK (pick_type IN ('single', 'parlay', 'system', 'teaser')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'push', 'void', 'cancelled')),
  
  -- Betting Information
  selection TEXT NOT NULL,
  line NUMERIC,
  odds NUMERIC NOT NULL,
  stake NUMERIC NOT NULL,
  potential_payout NUMERIC NOT NULL,
  actual_payout NUMERIC DEFAULT 0,
  profit_loss NUMERIC DEFAULT 0,
  
  -- Analysis & Confidence
  confidence INTEGER CHECK (confidence BETWEEN 1 AND 10),
  analysis TEXT,
  reasoning TEXT,
  tier_when_placed TEXT,
  
  -- Workflow Management
  pick_source TEXT NOT NULL DEFAULT 'manual' CHECK (pick_source IN ('manual', 'promoted', 'imported', 'system')),
  workflow_stage TEXT DEFAULT 'draft' CHECK (workflow_stage IN ('draft', 'pending_review', 'approved', 'published', 'settled')),
  promotion_status TEXT DEFAULT 'not_promoted' CHECK (promotion_status IN ('not_promoted', 'queued', 'promoted', 'failed')),
  promotion_data JSONB,
  
  -- Timing
  placed_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  game_start_time TIMESTAMPTZ,
  
  -- Settlement
  settlement_source TEXT,
  settlement_details JSONB,
  actual_result NUMERIC,
  
  -- Parlay Support
  parlay_id UUID,
  parlay_leg_number INTEGER,
  parlay_total_legs INTEGER,
  parlay_total_odds NUMERIC,
  parlay_stake_allocation NUMERIC,
  
  -- Discord Integration
  discord_thread_id TEXT,
  discord_message_id TEXT,
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Audit
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- Add indexes for unified_picks
CREATE INDEX idx_unified_picks_user_status ON unified_picks(user_id, status);
CREATE INDEX idx_unified_picks_placed_at ON unified_picks(placed_at DESC);
CREATE INDEX idx_unified_picks_game_id ON unified_picks(game_id);
CREATE INDEX idx_unified_picks_prop_id ON unified_picks(prop_id);
CREATE INDEX idx_unified_picks_parlay ON unified_picks(parlay_id) WHERE parlay_id IS NOT NULL;
CREATE INDEX idx_unified_picks_workflow ON unified_picks(workflow_stage, promotion_status);

-- Verify unified_picks table was created
SELECT 'Step 2 Complete: Unified picks table created' as status;
