-- =============================================================================
-- BATCH 1: Core Scoring Columns (Run this first)
-- =============================================================================

-- Add core enhanced scoring metrics (most important columns)
ALTER TABLE raw_props 
ADD COLUMN IF NOT EXISTS expected_value NUMERIC,
ADD COLUMN IF NOT EXISTS sharp_money NUMERIC,
ADD COLUMN IF NOT EXISTS line_movement NUMERIC,
ADD COLUMN IF NOT EXISTS player_form NUMERIC,
ADD COLUMN IF NOT EXISTS injury_impact NUMERIC;

-- Add professional capper essentials
ALTER TABLE raw_props 
ADD COLUMN IF NOT EXISTS steam_detected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS best_available_line NUMERIC,
ADD COLUMN IF NOT EXISTS best_book TEXT,
ADD COLUMN IF NOT EXISTS public_betting_percentage NUMERIC,
ADD COLUMN IF NOT EXISTS sharp_betting_percentage NUMERIC;

-- Add basic risk management
ALTER TABLE raw_props 
ADD COLUMN IF NOT EXISTS volatility NUMERIC DEFAULT 5,
ADD COLUMN IF NOT EXISTS correlation_risk NUMERIC,
ADD COLUMN IF NOT EXISTS bid_ask_spread NUMERIC DEFAULT 0.02;

-- Validation query
SELECT 
  'Batch 1 completed - Core scoring columns added!' as status,
  COUNT(*) as total_props,
  NOW() as completed_at
FROM raw_props;
