-- =====================================================
-- Phase 1 Schema Alignment: Odds Column (Part 6 FINAL)
-- =====================================================
--
-- Purpose: Add the missing 'odds' column
-- This was missed in Part 5 - holds absolute odds value
--
-- Run Time: ~3 seconds
-- Safe: Nullable numeric column, idempotent
--
-- =====================================================

BEGIN;

-- Add odds column (absolute odds value)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'odds'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN odds NUMERIC;
    RAISE NOTICE 'Added odds column';
  ELSE
    RAISE NOTICE 'odds column already exists';
  END IF;
END $$;

-- Add column documentation
COMMENT ON COLUMN raw_props.odds IS
  'Absolute odds value (always positive). Calculated as Math.abs(odds) from provider odds.';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

-- =====================================================
-- PART 6 COMPLETE - NOW TRULY ALL COLUMNS ADDED ✅
-- =====================================================
--
-- Run: npx tsx apps/api/scripts/live-fire-phase1-ingestion-simple.ts
--
-- Expected: ✅ Inserted 558 NBA props (SUCCESS!)
--
-- =====================================================
