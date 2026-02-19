-- =========================================================================
-- Unit Talk v3.0.0 Schema Alignment Migration
-- Aligns all tables with canonical v3.0.0 production schema
-- IDEMPOTENT: Safe to run multiple times
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- RAW_PROPS: Add professional grading columns
-- -------------------------------------------------------------------------
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS processed_at timestamptz;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS pro_attempts int DEFAULT 0;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS processing_error text;

-- Index for efficient unprocessed prop pickup
CREATE INDEX IF NOT EXISTS idx_raw_props_unprocessed
  ON raw_props ((processed_at IS NULL), created_at);

-- Index for processed props tracking
CREATE INDEX IF NOT EXISTS idx_raw_props_processed
  ON raw_props (processed_at DESC) WHERE processed_at IS NOT NULL;

-- -------------------------------------------------------------------------
-- UNIFIED_PICKS: Add v3.0.0 canonical columns
-- -------------------------------------------------------------------------

-- Professional scoring columns
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS professional_score numeric;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS devigged_win_prob numeric;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS devigged_edge numeric;

-- CLV and risk management columns  
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS clv_pct numeric;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS kelly_fraction numeric;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS risk numeric;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS clv_tracking_id text;

-- Status and workflow columns
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS grading_status text;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS published boolean DEFAULT false;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS is_instant boolean DEFAULT false;

-- Grouping and promotion columns
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS group_key text;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS promoted_at timestamptz;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_unified_picks_created 
  ON unified_picks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_unified_picks_publish 
  ON unified_picks(published, promoted_at DESC) WHERE published = true;

CREATE INDEX IF NOT EXISTS idx_unified_picks_stage 
  ON unified_picks(stage, created_at DESC) WHERE stage IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_unified_picks_grading 
  ON unified_picks(grading_status, created_at DESC) WHERE grading_status IS NOT NULL;

-- Index for is_instant picks
CREATE INDEX IF NOT EXISTS idx_unified_picks_instant 
  ON unified_picks(is_instant, created_at DESC) WHERE is_instant = true;

-- -------------------------------------------------------------------------
-- SHADOW_DECISIONS: Ensure test parity with production
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shadow_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_type text NOT NULL,
  raw_prop_id uuid,
  unified_pick_id uuid,
  
  -- Core pick identification
  sport text,
  market text, 
  player text,
  team text,
  
  -- Market data
  book text,
  odds_open int,
  odds_now int,
  line numeric,
  event_time timestamptz,
  
  -- Professional grading fields
  tier text,
  confidence int,
  professional_score numeric,
  devigged_win_prob numeric,
  devigged_edge numeric,
  clv_pct numeric,
  kelly_fraction numeric,
  risk numeric,
  
  -- Control flags
  chaos_muted boolean DEFAULT false,
  steam_muted boolean DEFAULT false,
  is_instant boolean DEFAULT false,
  
  -- Grouping and reasoning
  group_key text,
  reasons jsonb DEFAULT '[]'::jsonb,
  
  -- Audit trail
  created_at timestamptz DEFAULT now()
);

-- Shadow decisions indexes
CREATE INDEX IF NOT EXISTS idx_shadow_created 
  ON shadow_decisions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shadow_sport_time 
  ON shadow_decisions(sport, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_shadow_decision_type 
  ON shadow_decisions(decision_type, created_at DESC);

-- -------------------------------------------------------------------------
-- VIEW: Postable picks for production use
-- -------------------------------------------------------------------------
CREATE OR REPLACE VIEW view_postable_picks AS
SELECT 
  *,
  -- Calculated fields for backward compatibility
  CASE WHEN published = true THEN 'published' ELSE stage END as display_status,
  CASE WHEN is_instant = true THEN 'instant' ELSE 'queued' END as timing_type
FROM unified_picks 
WHERE published = true 
  AND (play_status = 'pending' OR play_status IS NULL)
ORDER BY promoted_at DESC NULLS LAST, created_at DESC;

-- Grant appropriate permissions
GRANT SELECT ON view_postable_picks TO authenticated;

-- -------------------------------------------------------------------------
-- DATA MIGRATION: Populate new columns from existing data where possible
-- -------------------------------------------------------------------------

-- Set grading_status based on existing tier field
UPDATE unified_picks 
SET grading_status = 'graded' 
WHERE tier IS NOT NULL 
  AND grading_status IS NULL;

-- Set published based on existing approval patterns
UPDATE unified_picks 
SET published = true,
    promoted_at = COALESCE(updated_at, created_at)
WHERE (
  -- Look for existing publish indicators
  (user_id IS NOT NULL AND tier IS NOT NULL) OR
  (confidence > 0) OR
  (created_at < now() - interval '1 day' AND tier IS NOT NULL)
) AND published IS FALSE
  AND grading_status = 'graded';

-- Set stage based on published status
UPDATE unified_picks 
SET stage = CASE 
  WHEN published = true THEN 'published'
  WHEN grading_status = 'graded' THEN 'approved' 
  WHEN tier IS NOT NULL THEN 'graded'
  ELSE 'ingested'
END
WHERE stage IS NULL;

-- -------------------------------------------------------------------------
-- CLEANUP: Remove deprecated columns (commented for safety)
-- -------------------------------------------------------------------------
-- These will be removed in a future migration after code is updated
-- ALTER TABLE unified_picks DROP COLUMN IF EXISTS auto_approved;
-- ALTER TABLE unified_picks DROP COLUMN IF EXISTS promoted_to_picks;
-- ALTER TABLE unified_picks DROP COLUMN IF EXISTS is_graded;
-- ALTER TABLE unified_picks DROP COLUMN IF EXISTS edge_score;
-- ALTER TABLE unified_picks DROP COLUMN IF EXISTS position_size;

-- -------------------------------------------------------------------------
-- VALIDATION: Ensure schema integrity
-- -------------------------------------------------------------------------

-- Check that new columns exist
DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'raw_props' AND column_name = 'processed_at'
  ), 'Missing processed_at column in raw_props';
  
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'unified_picks' AND column_name = 'published'
  ), 'Missing published column in unified_picks';
  
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'unified_picks' AND column_name = 'professional_score'
  ), 'Missing professional_score column in unified_picks';
  
  RAISE NOTICE 'Schema validation passed: All v3.0.0 columns exist';
END $$;

-- -------------------------------------------------------------------------
-- COMMIT TRANSACTION
-- -------------------------------------------------------------------------
COMMIT;

-- -------------------------------------------------------------------------
-- POST-MIGRATION VERIFICATION QUERIES
-- -------------------------------------------------------------------------

-- Verify column existence
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name IN ('raw_props', 'unified_picks', 'shadow_decisions')
  AND column_name IN (
    'processed_at', 'pro_attempts', 'processing_error',
    'published', 'professional_score', 'grading_status', 
    'devigged_edge', 'kelly_fraction', 'promoted_at'
  )
ORDER BY table_name, column_name;

-- Verify data distribution
SELECT 
  'raw_props' as table_name,
  COUNT(*) as total_rows,
  COUNT(processed_at) as processed_count,
  COUNT(*) - COUNT(processed_at) as unprocessed_count
FROM raw_props
UNION ALL
SELECT 
  'unified_picks' as table_name,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN published = true THEN 1 END) as published_count,
  COUNT(CASE WHEN grading_status = 'graded' THEN 1 END) as graded_count
FROM unified_picks;

-- Report completion
SELECT 
  'MIGRATION COMPLETE' as status,
  now() as completed_at,
  'v3.0.0 schema alignment successful' as message;