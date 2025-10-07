-- =====================================================
-- SGO INGESTION SCHEMA FIX
-- Created: October 5, 2025
-- Purpose: Fix schema mismatches blocking SGO historical data ingestion
--
-- Issues Fixed:
-- 1. player_stats.metadata column missing
-- 2. player_stats.source column missing
-- 3. settled_outcomes.actual_value missing (has actual instead)
-- 4. settled_outcomes.decision missing (has outcome instead)
-- 5. Add necessary indexes for performance
-- =====================================================

-- =====================================================
-- PHASE 1: player_stats TABLE FIXES
-- =====================================================

-- Add missing 'source' column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_stats' AND column_name = 'source'
  ) THEN
    ALTER TABLE player_stats
    ADD COLUMN source TEXT DEFAULT 'sgo';

    COMMENT ON COLUMN player_stats.source IS 'Data source: sgo, oddsapi, manual, etc.';
  END IF;
END $$;

-- Add missing 'metadata' column (CRITICAL - SGOAdapter requires this)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_stats' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE player_stats
    ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

    COMMENT ON COLUMN player_stats.metadata IS 'Additional context: eventID, oddID, playerID, team, etc.';
  END IF;
END $$;

-- Add index for source lookups
CREATE INDEX IF NOT EXISTS idx_player_stats_source
  ON player_stats(source, sport, game_date DESC);

-- Update existing rows to have default metadata
UPDATE player_stats
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

-- =====================================================
-- PHASE 2: settled_outcomes TABLE FIXES
-- =====================================================

-- Add 'actual' column as alias/duplicate of actual_value for compatibility
-- Both settle-production-v2.ts and SGOAdapter use different names
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settled_outcomes' AND column_name = 'actual'
  ) THEN
    ALTER TABLE settled_outcomes
    ADD COLUMN actual NUMERIC(8,4);

    COMMENT ON COLUMN settled_outcomes.actual IS 'Actual stat value (alias for actual_value for compatibility)';
  END IF;
END $$;

-- Add 'decision' column as alias for outcome for compatibility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settled_outcomes' AND column_name = 'decision'
  ) THEN
    ALTER TABLE settled_outcomes
    ADD COLUMN decision TEXT CHECK (decision IN ('win', 'loss', 'push', 'void'));

    COMMENT ON COLUMN settled_outcomes.decision IS 'Settlement decision (alias for outcome for compatibility)';
  END IF;
END $$;

-- Add 'player' column as alias for player_name for compatibility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settled_outcomes' AND column_name = 'player'
  ) THEN
    ALTER TABLE settled_outcomes
    ADD COLUMN player TEXT;

    COMMENT ON COLUMN settled_outcomes.player IS 'Player name (alias for player_name for compatibility)';
  END IF;
END $$;

-- Add 'market' column as alias for market_type for compatibility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settled_outcomes' AND column_name = 'market'
  ) THEN
    ALTER TABLE settled_outcomes
    ADD COLUMN market TEXT;

    COMMENT ON COLUMN settled_outcomes.market IS 'Market type (alias for market_type for compatibility)';
  END IF;
END $$;

-- Add 'settlement_method' column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settled_outcomes' AND column_name = 'settlement_method'
  ) THEN
    ALTER TABLE settled_outcomes
    ADD COLUMN settlement_method TEXT DEFAULT 'automated';

    COMMENT ON COLUMN settled_outcomes.settlement_method IS 'How outcome was settled: automated, sgo_historical, manual';
  END IF;
END $$;

-- Add 'confidence' column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settled_outcomes' AND column_name = 'confidence'
  ) THEN
    ALTER TABLE settled_outcomes
    ADD COLUMN confidence NUMERIC(5,4) DEFAULT 1.0;

    COMMENT ON COLUMN settled_outcomes.confidence IS 'Confidence in settlement (0.0 to 1.0)';
  END IF;
END $$;

-- Create trigger to sync actual <-> actual_value
CREATE OR REPLACE FUNCTION sync_settled_outcomes_actual()
RETURNS TRIGGER AS $$
BEGIN
  -- If actual_value is set, sync to actual
  IF NEW.actual_value IS NOT NULL AND NEW.actual IS NULL THEN
    NEW.actual := NEW.actual_value;
  END IF;

  -- If actual is set, sync to actual_value
  IF NEW.actual IS NOT NULL AND NEW.actual_value IS NULL THEN
    NEW.actual_value := NEW.actual;
  END IF;

  -- Sync decision <-> outcome
  IF NEW.outcome IS NOT NULL AND NEW.decision IS NULL THEN
    NEW.decision := NEW.outcome;
  END IF;

  IF NEW.decision IS NOT NULL AND NEW.outcome IS NULL THEN
    NEW.outcome := NEW.decision;
  END IF;

  -- Sync player <-> player_name
  IF NEW.player_name IS NOT NULL AND NEW.player IS NULL THEN
    NEW.player := NEW.player_name;
  END IF;

  IF NEW.player IS NOT NULL AND NEW.player_name IS NULL THEN
    NEW.player_name := NEW.player;
  END IF;

  -- Sync market <-> market_type
  IF NEW.market_type IS NOT NULL AND NEW.market IS NULL THEN
    NEW.market := NEW.market_type;
  END IF;

  IF NEW.market IS NOT NULL AND NEW.market_type IS NULL THEN
    NEW.market_type := NEW.market;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS sync_settled_outcomes_actual_trigger ON settled_outcomes;
CREATE TRIGGER sync_settled_outcomes_actual_trigger
  BEFORE INSERT OR UPDATE ON settled_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION sync_settled_outcomes_actual();

-- Backfill existing rows
UPDATE settled_outcomes
SET
  actual = actual_value,
  decision = outcome,
  player = player_name,
  market = market_type
WHERE actual IS NULL OR decision IS NULL OR player IS NULL OR market IS NULL;

-- Add indexes for settlement queries
CREATE INDEX IF NOT EXISTS idx_settled_outcomes_game_date
  ON settled_outcomes(game_date DESC);

CREATE INDEX IF NOT EXISTS idx_settled_outcomes_settlement_method
  ON settled_outcomes(settlement_method, settled_at DESC);

-- =====================================================
-- PHASE 3: PERFORMANCE INDEXES
-- =====================================================

-- Composite index for common SGO ingestion pattern
CREATE INDEX IF NOT EXISTS idx_player_stats_sgo_lookup
  ON player_stats(sport, game_date, player_name, source);

-- Index for settlement queries joining player_stats
CREATE INDEX IF NOT EXISTS idx_player_stats_game_player
  ON player_stats(game_date, player_name)
  INCLUDE (stats, metadata);

-- =====================================================
-- PHASE 4: VALIDATION QUERIES
-- =====================================================

-- Count rows that would have been blocked before this fix
DO $$
DECLARE
  v_stats_without_metadata INTEGER;
  v_outcomes_without_actual INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_stats_without_metadata
  FROM player_stats
  WHERE metadata IS NULL;

  SELECT COUNT(*) INTO v_outcomes_without_actual
  FROM settled_outcomes
  WHERE actual IS NULL AND actual_value IS NOT NULL;

  RAISE NOTICE 'Schema Migration Complete:';
  RAISE NOTICE '  - player_stats rows without metadata: %', v_stats_without_metadata;
  RAISE NOTICE '  - settled_outcomes rows needing sync: %', v_outcomes_without_actual;
END $$;

-- =====================================================
-- ROLLBACK INSTRUCTIONS (commented)
-- =====================================================
/*
-- To rollback this migration:

-- Remove player_stats columns
ALTER TABLE player_stats DROP COLUMN IF EXISTS source;
ALTER TABLE player_stats DROP COLUMN IF EXISTS metadata;

-- Remove settled_outcomes columns
ALTER TABLE settled_outcomes DROP COLUMN IF EXISTS actual;
ALTER TABLE settled_outcomes DROP COLUMN IF EXISTS decision;
ALTER TABLE settled_outcomes DROP COLUMN IF EXISTS player;
ALTER TABLE settled_outcomes DROP COLUMN IF EXISTS market;
ALTER TABLE settled_outcomes DROP COLUMN IF EXISTS settlement_method;
ALTER TABLE settled_outcomes DROP COLUMN IF EXISTS confidence;

-- Drop trigger
DROP TRIGGER IF EXISTS sync_settled_outcomes_actual_trigger ON settled_outcomes;
DROP FUNCTION IF EXISTS sync_settled_outcomes_actual();

-- Drop indexes
DROP INDEX IF EXISTS idx_player_stats_source;
DROP INDEX IF EXISTS idx_player_stats_sgo_lookup;
DROP INDEX IF EXISTS idx_player_stats_game_player;
DROP INDEX IF EXISTS idx_settled_outcomes_game_date;
DROP INDEX IF EXISTS idx_settled_outcomes_settlement_method;
*/
