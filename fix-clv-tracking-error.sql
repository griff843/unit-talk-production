-- Fix CLV Tracking Table Creation Error
-- File: fix-clv-tracking-error.sql
-- Date: September 5, 2025

-- First, drop the table if it exists with issues
DROP TABLE IF EXISTS clv_tracking CASCADE;

-- Recreate CLV tracking table without immediate unique constraint
CREATE TABLE clv_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clv_tracking_id VARCHAR(100) NOT NULL,
    prop_id UUID,
    opening_line DECIMAL(10,2),
    closing_line DECIMAL(10,2),
    bet_line DECIMAL(10,2),
    clv_value DECIMAL(10,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Now add the unique constraint separately
ALTER TABLE clv_tracking 
ADD CONSTRAINT clv_tracking_id_unique UNIQUE (clv_tracking_id);

-- Create indexes for CLV tracking performance
CREATE INDEX IF NOT EXISTS idx_clv_tracking_id ON clv_tracking(clv_tracking_id);
CREATE INDEX IF NOT EXISTS idx_clv_prop_id ON clv_tracking(prop_id);

-- Validation
SELECT 'CLV tracking table fixed' as status, COUNT(*) as tracking_records
FROM clv_tracking;