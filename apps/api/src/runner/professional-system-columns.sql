-- Add missing columns for Professional System compliance
-- Run this SQL directly in Supabase SQL Editor

-- Add missing columns to raw_props table
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS processing_batch_id UUID;
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS grading_version TEXT DEFAULT 'v1.0';
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS quality_flags JSONB DEFAULT '{}'::jsonb;

-- Add missing columns to unified_picks table for professional system
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS professional_score DECIMAL(10,4);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS devigged_edge DECIMAL(10,6);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS clv_tracking_id UUID;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS kelly_fraction DECIMAL(10,6);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS processing_time INTEGER;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS feature_contributions JSONB DEFAULT '{}'::jsonb;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS rule_compliance_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS sharp_grading_version TEXT DEFAULT 'v1.0';
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS created_by_processor TEXT DEFAULT 'professional';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_raw_props_processed_at ON raw_props(processed_at);
CREATE INDEX IF NOT EXISTS idx_raw_props_error_message ON raw_props(error_message);
CREATE INDEX IF NOT EXISTS idx_unified_picks_professional_score ON unified_picks(professional_score);
CREATE INDEX IF NOT EXISTS idx_unified_picks_clv_tracking_id ON unified_picks(clv_tracking_id);