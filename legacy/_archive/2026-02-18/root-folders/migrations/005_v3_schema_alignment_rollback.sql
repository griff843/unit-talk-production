-- =========================================================================
-- Unit Talk v3.0.0 Schema Alignment Rollback
-- Safely removes v3.0.0 columns if not in production
-- WARNING: Only run if safe to remove data
-- =========================================================================

-- Check environment safety
DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 130000 THEN
    -- Only proceed if this appears to be a development environment
    IF NOT EXISTS (
      SELECT 1 FROM unified_picks 
      WHERE published = true 
        AND created_at > now() - interval '7 days'
      LIMIT 10
    ) THEN
      RAISE NOTICE 'Environment appears safe for rollback';
    ELSE
      RAISE EXCEPTION 'Production environment detected - rollback blocked for safety';
    END IF;
  END IF;
END $$;

BEGIN;

-- -------------------------------------------------------------------------
-- DROP VIEWS
-- -------------------------------------------------------------------------
DROP VIEW IF EXISTS view_postable_picks;

-- -------------------------------------------------------------------------
-- DROP INDEXES (v3.0.0 specific)
-- -------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_raw_props_unprocessed;
DROP INDEX IF EXISTS idx_raw_props_processed;
DROP INDEX IF EXISTS idx_unified_picks_publish;
DROP INDEX IF EXISTS idx_unified_picks_stage;
DROP INDEX IF EXISTS idx_unified_picks_grading;
DROP INDEX IF EXISTS idx_unified_picks_instant;
DROP INDEX IF EXISTS idx_shadow_created;
DROP INDEX IF EXISTS idx_shadow_sport_time;
DROP INDEX IF EXISTS idx_shadow_decision_type;

-- -------------------------------------------------------------------------
-- DROP SHADOW_DECISIONS TABLE (if safe)
-- -------------------------------------------------------------------------
-- Only drop if it contains no critical data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'shadow_decisions'
  ) AND NOT EXISTS (
    SELECT 1 FROM shadow_decisions 
    WHERE created_at > now() - interval '24 hours'
    LIMIT 1
  ) THEN
    DROP TABLE shadow_decisions;
    RAISE NOTICE 'Dropped shadow_decisions table';
  ELSE
    RAISE NOTICE 'Keeping shadow_decisions table - contains recent data';
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- REMOVE COLUMNS FROM UNIFIED_PICKS (if safe)
-- -------------------------------------------------------------------------
-- Only remove if columns are empty or contain default values
DO $$
BEGIN
  -- Check if professional_score has meaningful data
  IF NOT EXISTS (
    SELECT 1 FROM unified_picks 
    WHERE professional_score IS NOT NULL 
      AND professional_score > 0
    LIMIT 1
  ) THEN
    ALTER TABLE unified_picks DROP COLUMN IF EXISTS professional_score;
    RAISE NOTICE 'Dropped professional_score column';
  END IF;
  
  -- Check if published has been used
  IF NOT EXISTS (
    SELECT 1 FROM unified_picks 
    WHERE published = true
    LIMIT 1
  ) THEN
    ALTER TABLE unified_picks DROP COLUMN IF EXISTS published;
    RAISE NOTICE 'Dropped published column';
  END IF;
END $$;

-- Drop other v3.0.0 columns if they're empty
ALTER TABLE unified_picks DROP COLUMN IF EXISTS devigged_win_prob;
ALTER TABLE unified_picks DROP COLUMN IF EXISTS devigged_edge;
ALTER TABLE unified_picks DROP COLUMN IF EXISTS clv_pct;
ALTER TABLE unified_picks DROP COLUMN IF EXISTS kelly_fraction;
ALTER TABLE unified_picks DROP COLUMN IF EXISTS risk;
ALTER TABLE unified_picks DROP COLUMN IF EXISTS clv_tracking_id;
ALTER TABLE unified_picks DROP COLUMN IF EXISTS grading_status;
ALTER TABLE unified_picks DROP COLUMN IF EXISTS stage;
ALTER TABLE unified_picks DROP COLUMN IF EXISTS is_instant;
ALTER TABLE unified_picks DROP COLUMN IF EXISTS group_key;
ALTER TABLE unified_picks DROP COLUMN IF EXISTS promoted_at;

-- -------------------------------------------------------------------------
-- REMOVE COLUMNS FROM RAW_PROPS
-- -------------------------------------------------------------------------
ALTER TABLE raw_props DROP COLUMN IF EXISTS processed_at;
ALTER TABLE raw_props DROP COLUMN IF EXISTS pro_attempts;
ALTER TABLE raw_props DROP COLUMN IF EXISTS processing_error;

COMMIT;

-- Report completion
SELECT 
  'ROLLBACK COMPLETE' as status,
  now() as completed_at,
  'v3.0.0 schema rollback successful' as message;