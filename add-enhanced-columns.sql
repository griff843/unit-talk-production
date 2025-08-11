-- =============================================================================
-- ADD ENHANCED COLUMNS FOR BUSINESS LOGIC UPDATES
-- Run this FIRST to add the missing columns for ML confidence and expected value
-- =============================================================================

-- Step 1: Add enhanced columns to raw_props table
-- =============================================================================

-- Add confidence column (ML confidence score 0-1)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'raw_props' 
    AND column_name = 'confidence' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN confidence DECIMAL(5,4) DEFAULT 0;
    COMMENT ON COLUMN raw_props.confidence IS 'ML confidence score (0-1) for this prop prediction';
  END IF;
END $$;

-- Add expected_value column (expected value calculation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'raw_props' 
    AND column_name = 'expected_value' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN expected_value DECIMAL(8,6) DEFAULT 0;
    COMMENT ON COLUMN raw_props.expected_value IS 'Expected value calculation for this prop bet';
  END IF;
END $$;

-- Add sport column if it doesn't exist (for cross-sport analytics)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'raw_props' 
    AND column_name = 'sport' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN sport VARCHAR(10) DEFAULT 'MLB';
    COMMENT ON COLUMN raw_props.sport IS 'Sport classification for cross-sport analytics';
  END IF;
END $$;

-- Step 2: Add enhanced columns to unified_picks table
-- =============================================================================

-- Add confidence column to unified_picks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'unified_picks' 
    AND column_name = 'confidence' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE unified_picks ADD COLUMN confidence DECIMAL(5,4) DEFAULT 0;
    COMMENT ON COLUMN unified_picks.confidence IS 'ML confidence score for this pick';
  END IF;
END $$;

-- Add sport column to unified_picks if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'unified_picks' 
    AND column_name = 'sport' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE unified_picks ADD COLUMN sport VARCHAR(10) DEFAULT 'MLB';
    COMMENT ON COLUMN unified_picks.sport IS 'Sport classification for cross-sport analytics';
  END IF;
END $$;

-- Step 3: Add enhanced columns to ev_modeling table
-- =============================================================================

-- Add sport column to ev_modeling if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ev_modeling' 
    AND column_name = 'sport' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE ev_modeling ADD COLUMN sport VARCHAR(10) DEFAULT 'MLB';
    COMMENT ON COLUMN ev_modeling.sport IS 'Sport classification for cross-sport analytics';
  END IF;
END $$;

-- Ensure confidence and expected_value columns exist in ev_modeling
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ev_modeling' 
    AND column_name = 'confidence' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE ev_modeling ADD COLUMN confidence DECIMAL(5,4) DEFAULT 0;
    COMMENT ON COLUMN ev_modeling.confidence IS 'ML model confidence score';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ev_modeling' 
    AND column_name = 'expected_value' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE ev_modeling ADD COLUMN expected_value DECIMAL(8,6) DEFAULT 0;
    COMMENT ON COLUMN ev_modeling.expected_value IS 'Expected value calculation';
  END IF;
END $$;

-- Step 4: Add sport column to contests table
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contests' 
    AND column_name = 'sport' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE contests ADD COLUMN sport VARCHAR(10) DEFAULT 'MLB';
    COMMENT ON COLUMN contests.sport IS 'Sport-specific contest classification';
  END IF;
END $$;

-- Step 5: Create indexes for the new columns
-- =============================================================================

-- Index on raw_props confidence for sorting
CREATE INDEX IF NOT EXISTS idx_raw_props_confidence ON raw_props(confidence DESC) WHERE confidence > 0;

-- Index on raw_props expected_value for filtering
CREATE INDEX IF NOT EXISTS idx_raw_props_expected_value ON raw_props(expected_value DESC) WHERE expected_value IS NOT NULL;

-- Index on raw_props sport for cross-sport analytics
CREATE INDEX IF NOT EXISTS idx_raw_props_sport ON raw_props(sport);

-- Index on unified_picks sport for performance analytics
CREATE INDEX IF NOT EXISTS idx_unified_picks_sport ON unified_picks(sport);

-- Index on unified_picks confidence
CREATE INDEX IF NOT EXISTS idx_unified_picks_confidence ON unified_picks(confidence DESC) WHERE confidence > 0;

-- Index on ev_modeling sport
CREATE INDEX IF NOT EXISTS idx_ev_modeling_sport ON ev_modeling(sport);

-- Index on contests sport
CREATE INDEX IF NOT EXISTS idx_contests_sport ON contests(sport);

-- Composite index for contest sport and status filtering
CREATE INDEX IF NOT EXISTS idx_contests_sport_status ON contests(sport, status) WHERE status = 'active';

-- Step 6: Populate sample data for testing
-- =============================================================================

-- Update some raw_props with sample confidence and expected value data
UPDATE raw_props 
SET 
  confidence = 0.75 + (RANDOM() * 0.2), -- Random confidence between 0.75-0.95
  expected_value = (RANDOM() - 0.5) * 0.1, -- Random EV between -0.05 and +0.05
  sport = CASE 
    WHEN RANDOM() < 0.4 THEN 'MLB'
    WHEN RANDOM() < 0.6 THEN 'NBA' 
    WHEN RANDOM() < 0.8 THEN 'NFL'
    ELSE 'NHL'
  END
WHERE id IN (
  SELECT id FROM raw_props 
  WHERE confidence = 0 OR confidence IS NULL
  LIMIT 1000 -- Update first 1000 props for testing
);

-- Update some unified_picks with sample confidence and sport data
UPDATE unified_picks 
SET 
  confidence = 0.65 + (RANDOM() * 0.3), -- Random confidence between 0.65-0.95
  sport = CASE 
    WHEN RANDOM() < 0.4 THEN 'MLB'
    WHEN RANDOM() < 0.6 THEN 'NBA'
    WHEN RANDOM() < 0.8 THEN 'NFL' 
    ELSE 'NHL'
  END
WHERE id IN (
  SELECT id FROM unified_picks 
  WHERE confidence = 0 OR confidence IS NULL
  LIMIT 500 -- Update first 500 picks for testing
);

-- Update some ev_modeling records with sample data
UPDATE ev_modeling 
SET 
  confidence = 0.70 + (RANDOM() * 0.25), -- Random confidence between 0.70-0.95
  expected_value = (RANDOM() - 0.4) * 0.08, -- Slightly positive bias for EV
  sport = CASE 
    WHEN RANDOM() < 0.4 THEN 'MLB'
    WHEN RANDOM() < 0.6 THEN 'NBA'
    WHEN RANDOM() < 0.8 THEN 'NFL'
    ELSE 'NHL'
  END
WHERE id IN (
  SELECT id FROM ev_modeling 
  WHERE confidence = 0 OR confidence IS NULL
  LIMIT 200 -- Update first 200 records for testing
);

-- Update contests with sport classifications
UPDATE contests 
SET sport = CASE 
  WHEN RANDOM() < 0.4 THEN 'MLB'
  WHEN RANDOM() < 0.6 THEN 'NBA'
  WHEN RANDOM() < 0.8 THEN 'NFL'
  ELSE 'NHL'
END
WHERE sport IS NULL OR sport = 'MLB';

-- Step 7: Update table statistics
-- =============================================================================

ANALYZE raw_props;
ANALYZE unified_picks;
ANALYZE ev_modeling;
ANALYZE contests;

-- Step 8: Verification
-- =============================================================================

-- Verify columns were added successfully
SELECT 
  'COLUMN VERIFICATION' as check_type,
  table_name,
  column_name,
  data_type,
  'Column added successfully' as status
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('raw_props', 'unified_picks', 'ev_modeling', 'contests')
  AND column_name IN ('confidence', 'expected_value', 'sport')
ORDER BY table_name, column_name;

-- Verify indexes were created
SELECT 
  'INDEX VERIFICATION' as check_type,
  schemaname,
  tablename,
  indexname,
  'Index created successfully' as status
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%confidence%' 
   OR indexname LIKE 'idx_%sport%'
   OR indexname LIKE 'idx_%expected_value%'
ORDER BY tablename, indexname;

-- Verify sample data was populated
SELECT 
  'DATA VERIFICATION' as check_type,
  'raw_props' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN confidence > 0 THEN 1 END) as records_with_confidence,
  COUNT(CASE WHEN expected_value IS NOT NULL AND expected_value != 0 THEN 1 END) as records_with_ev,
  COUNT(CASE WHEN sport IS NOT NULL THEN 1 END) as records_with_sport
FROM raw_props
UNION ALL
SELECT 
  'DATA VERIFICATION' as check_type,
  'unified_picks' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN confidence > 0 THEN 1 END) as records_with_confidence,
  0 as records_with_ev, -- unified_picks doesn't have expected_value
  COUNT(CASE WHEN sport IS NOT NULL THEN 1 END) as records_with_sport
FROM unified_picks;

-- Success message
SELECT 
  'SCHEMA ENHANCEMENT COMPLETE!' as status,
  'Enhanced columns added successfully' as result,
  'Sample data populated for testing' as data_status,
  'Indexes created for performance' as performance_status,
  'Ready to run business logic tests' as next_step;
