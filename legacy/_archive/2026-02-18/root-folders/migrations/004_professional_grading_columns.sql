-- =====================================================
-- Professional Grading Columns Migration
-- =====================================================
-- Adds all required columns for professional prop processing and grading
-- Idempotent: Safe to run multiple times on Supabase and Docker PG

-- =====================================================
-- Table: raw_props (gate for processing)
-- =====================================================
-- Add processing control columns
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS processed_at timestamptz;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS pro_attempts int DEFAULT 0;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS processing_error text;

-- Create index for unprocessed props query optimization
CREATE INDEX IF NOT EXISTS idx_raw_props_unprocessed
ON raw_props ((processed_at IS NULL), created_at);

-- =====================================================
-- Table: unified_picks (canonical grading_status fields)
-- =====================================================
-- Professional scoring columns
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS professional_score numeric;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS devigged_win_prob numeric;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS devigged_edge numeric;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS clv_pct numeric;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS kelly_fraction numeric;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS risk numeric;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS clv_tracking_id text;

-- Status and workflow columns
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS grading_status text;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS published boolean DEFAULT false;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS is_instant boolean DEFAULT false;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS group_key text;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS promoted_at timestamptz;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_unified_picks_created ON unified_picks(created_at);
CREATE INDEX IF NOT EXISTS idx_unified_picks_publish ON unified_picks(published, promoted_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_picks_stage ON unified_picks(stage, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_picks_grading_status ON unified_picks(grading_status);

-- =====================================================
-- Table: shadow_decisions (if not present for Shadow Mode)
-- =====================================================
-- Create shadow decisions table for tracking promotion decisions in shadow mode
CREATE TABLE IF NOT EXISTS shadow_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_type text NOT NULL,           -- 'promotion'|'metrics'|'recheck'|'alert'
  raw_prop_id uuid,
  unified_pick_id uuid,
  sport text, 
  market text, 
  player text, 
  team text,
  book text, 
  odds_open int, 
  odds_now int, 
  line numeric,
  event_time timestamptz,
  tier text, 
  confidence int, 
  professional_score numeric,
  devigged_win_prob numeric, 
  devigged_edge numeric, 
  clv_pct numeric,
  kelly_fraction numeric, 
  risk numeric,
  chaos_muted boolean, 
  steam_muted boolean, 
  is_instant boolean,
  group_key text,
  reasons jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes for shadow_decisions
CREATE INDEX IF NOT EXISTS idx_shadow_created ON shadow_decisions(created_at);
CREATE INDEX IF NOT EXISTS idx_shadow_sport_time ON shadow_decisions(sport, event_time);
CREATE INDEX IF NOT EXISTS idx_shadow_decision_type ON shadow_decisions(decision_type, created_at DESC);

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON COLUMN raw_props.processed_at IS 'Timestamp when prop was processed by professional grading system. NULL = unprocessed';
COMMENT ON COLUMN raw_props.pro_attempts IS 'Number of professional processing attempts for this prop';
COMMENT ON COLUMN raw_props.processing_error IS 'Last processing error message, if any';

COMMENT ON COLUMN unified_picks.professional_score IS 'Professional grading professional_score (0.0-1.0)';
COMMENT ON COLUMN unified_picks.devigged_win_prob IS 'Devigged probability of winning (0.0-1.0)';
COMMENT ON COLUMN unified_picks.devigged_edge IS 'Calculated edge after devig (percentage)';
COMMENT ON COLUMN unified_picks.clv_pct IS 'Closing Line Value percentage';
COMMENT ON COLUMN unified_picks.kelly_fraction IS 'Kelly Criterion betting fraction';
COMMENT ON COLUMN unified_picks.risk IS 'Risk assessment professional_score (0.0-1.0)';
COMMENT ON COLUMN unified_picks.clv_tracking_id IS 'External CLV tracking identifier';
COMMENT ON COLUMN unified_picks.grading_status IS 'Current grading status (pending, grading_status, failed, etc.)';
COMMENT ON COLUMN unified_picks.stage IS 'Processing stage (is_instant, queued, rejected, etc.)';
COMMENT ON COLUMN unified_picks.published IS 'Whether pick has been published publicly';
COMMENT ON COLUMN unified_picks.is_instant IS 'Whether pick qualifies for is_instant publication';
COMMENT ON COLUMN unified_picks.group_key IS 'Grouping key for batch operations';
COMMENT ON COLUMN unified_picks.promoted_at IS 'Timestamp when pick was promoted to public';

COMMENT ON TABLE shadow_decisions IS 'Tracks all promotion decisions made in shadow mode for testing and validation';