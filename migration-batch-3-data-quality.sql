-- =============================================================================
-- BATCH 3: Data Quality & Basic Info (Run this after Batch 2)
-- =============================================================================

-- Add data quality tracking
ALTER TABLE raw_props 
ADD COLUMN IF NOT EXISTS data_completeness NUMERIC DEFAULT 0.95,
ADD COLUMN IF NOT EXISTS outlier_score NUMERIC DEFAULT 0.95,
ADD COLUMN IF NOT EXISTS consistency_score NUMERIC DEFAULT 0.95,
ADD COLUMN IF NOT EXISTS data_validation_score NUMERIC DEFAULT 0.95,
ADD COLUMN IF NOT EXISTS portfolio_impact NUMERIC;

-- Add missing basic prop information
ALTER TABLE raw_props 
ADD COLUMN IF NOT EXISTS player_name TEXT,
ADD COLUMN IF NOT EXISTS team TEXT,
ADD COLUMN IF NOT EXISTS opponent TEXT,
ADD COLUMN IF NOT EXISTS market TEXT,
ADD COLUMN IF NOT EXISTS market_type TEXT;

-- Add source and metadata
ALTER TABLE raw_props 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'optimal',
ADD COLUMN IF NOT EXISTS league TEXT,
ADD COLUMN IF NOT EXISTS game_date DATE,
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add odds consistency columns
ALTER TABLE raw_props 
ADD COLUMN IF NOT EXISTS over NUMERIC,
ADD COLUMN IF NOT EXISTS under NUMERIC;

-- Copy existing odds data
UPDATE raw_props SET over = over_odds WHERE over IS NULL AND over_odds IS NOT NULL;
UPDATE raw_props SET under = under_odds WHERE under IS NULL AND under_odds IS NOT NULL;

-- Validation query
SELECT 
  'Batch 3 completed - Data quality and basic info added!' as status,
  COUNT(*) as total_props,
  COUNT(CASE WHEN over IS NOT NULL THEN 1 END) as props_with_over_odds,
  NOW() as completed_at
FROM raw_props;
