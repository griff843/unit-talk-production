-- Add professional grading columns to raw_props table

        ALTER TABLE raw_props 
        ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS pro_attempts INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS processing_error TEXT,
        ADD COLUMN IF NOT EXISTS professional_score DECIMAL(4,3),
        ADD COLUMN IF NOT EXISTS kelly_fraction DECIMAL(6,5),
        ADD COLUMN IF NOT EXISTS clv_tracking_id UUID;
      

-- Add published column to unified_picks table

        ALTER TABLE unified_picks 
        ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;
      