-- Rollback: Add professional grading columns to raw_props table

        ALTER TABLE raw_props 
        DROP COLUMN IF EXISTS processed_at,
        DROP COLUMN IF EXISTS pro_attempts,
        DROP COLUMN IF EXISTS processing_error,
        DROP COLUMN IF EXISTS professional_score,
        DROP COLUMN IF EXISTS kelly_fraction,
        DROP COLUMN IF EXISTS clv_tracking_id;
      

-- Rollback: Add published column to unified_picks table

        ALTER TABLE unified_picks 
        DROP COLUMN IF EXISTS published;
      