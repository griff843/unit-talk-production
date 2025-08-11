-- Fix Database Schema Issues - CRITICAL for Production
-- This adds missing professional fields and odds data to existing tables

-- 1. Add missing odds fields to unified_picks if they don't exist
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS over_odds DECIMAL(10,2);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS under_odds DECIMAL(10,2);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS outcome TEXT CHECK (outcome IN ('over', 'under'));

-- 2. Add missing odds fields to raw_props if they don't exist
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS over_odds DECIMAL(10,2);
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS under_odds DECIMAL(10,2);
ALTER TABLE raw_props ADD COLUMN IF NOT EXISTS outcome TEXT CHECK (outcome IN ('over', 'under'));

-- 3. Add indices for performance on new fields
CREATE INDEX IF NOT EXISTS idx_unified_picks_over_odds ON unified_picks(over_odds) WHERE over_odds IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_picks_under_odds ON unified_picks(under_odds) WHERE under_odds IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_picks_outcome ON unified_picks(outcome) WHERE outcome IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_raw_props_over_odds ON raw_props(over_odds) WHERE over_odds IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_raw_props_under_odds ON raw_props(under_odds) WHERE under_odds IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_raw_props_outcome ON raw_props(outcome) WHERE outcome IS NOT NULL;

-- 4. Update raw_props with realistic odds data from the 'over' and 'under' columns
-- Many raw_props have 'over' and 'under' columns but not 'over_odds' and 'under_odds'
UPDATE raw_props 
SET 
  over_odds = CASE 
    WHEN over IS NOT NULL AND over != 0 THEN over
    ELSE -110 
  END,
  under_odds = CASE 
    WHEN under IS NOT NULL AND under != 0 THEN under
    ELSE -110 
  END
WHERE over_odds IS NULL OR under_odds IS NULL;

-- 5. Add default outcome for existing props (prefer 'over' for player props)
UPDATE raw_props 
SET outcome = 'over'
WHERE outcome IS NULL 
  AND stat_type IN ('hits', 'rbis', 'homeRuns', 'totalBases', 'runsBatter', 'hitsRunsRbi', 'doubles', 'walksBatter', 'stolenBases');

-- 6. Update unified_picks with data from their corresponding raw_props
UPDATE unified_picks 
SET 
  over_odds = COALESCE(
    (SELECT raw_props.over_odds FROM raw_props WHERE raw_props.player_name = unified_picks.player_name AND raw_props.stat_type = unified_picks.stat_type LIMIT 1),
    -110
  ),
  under_odds = COALESCE(
    (SELECT raw_props.under_odds FROM raw_props WHERE raw_props.player_name = unified_picks.player_name AND raw_props.stat_type = unified_picks.stat_type LIMIT 1),
    -110
  ),
  outcome = COALESCE(
    (SELECT raw_props.outcome FROM raw_props WHERE raw_props.player_name = unified_picks.player_name AND raw_props.stat_type = unified_picks.stat_type LIMIT 1),
    'over'
  )
WHERE over_odds IS NULL OR under_odds IS NULL OR outcome IS NULL;

-- 7. Clean up any remaining NULL values with conservative defaults
UPDATE unified_picks 
SET 
  over_odds = -110,
  under_odds = -110,
  outcome = 'over'
WHERE over_odds IS NULL OR under_odds IS NULL OR outcome IS NULL;

UPDATE raw_props 
SET 
  over_odds = -110,
  under_odds = -110,
  outcome = 'over'
WHERE over_odds IS NULL OR under_odds IS NULL OR outcome IS NULL;

-- 8. Add validation constraints
ALTER TABLE unified_picks ADD CONSTRAINT IF NOT EXISTS check_odds_realistic 
  CHECK (over_odds BETWEEN -1000 AND 1000 AND under_odds BETWEEN -1000 AND 1000);

ALTER TABLE raw_props ADD CONSTRAINT IF NOT EXISTS check_odds_realistic 
  CHECK (over_odds BETWEEN -1000 AND 1000 AND under_odds BETWEEN -1000 AND 1000);

-- 9. CRITICAL: Ensure all professional columns exist in unified_picks
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS professional_score DECIMAL(10,4);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS devigged_edge DECIMAL(10,6);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS clv_tracking_id UUID;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS kelly_fraction DECIMAL(10,6);
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS processing_time INTEGER;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS feature_contributions JSONB;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS rule_compliance_score DECIMAL(5,2) DEFAULT 100.0;
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS sharp_grading_version TEXT DEFAULT 'v1.0';
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS created_by_processor TEXT DEFAULT 'professional';
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS confidence DECIMAL(10,4);

-- 10. Performance indices for professional columns
CREATE INDEX IF NOT EXISTS idx_unified_picks_professional_score ON unified_picks(professional_score) WHERE professional_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_picks_devigged_edge ON unified_picks(devigged_edge) WHERE devigged_edge IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_picks_clv_tracking_id ON unified_picks(clv_tracking_id) WHERE clv_tracking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_picks_auto_approved ON unified_picks(published);

-- Verification query
SELECT 
  'SCHEMA FIX VERIFICATION' as check_type,
  COUNT(*) as total_unified_picks,
  COUNT(over_odds) as picks_with_over_odds,
  COUNT(under_odds) as picks_with_under_odds,  
  COUNT(outcome) as picks_with_outcome,
  COUNT(professional_score) as picks_with_professional_score
FROM unified_picks;

SELECT 
  'RAW PROPS VERIFICATION' as check_type,
  COUNT(*) as total_raw_props,
  COUNT(over_odds) as props_with_over_odds,
  COUNT(under_odds) as props_with_under_odds,
  COUNT(outcome) as props_with_outcome
FROM raw_props;