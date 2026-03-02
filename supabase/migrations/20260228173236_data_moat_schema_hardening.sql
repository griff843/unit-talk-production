-- ============================================================================
-- DATA MOAT SCHEMA HARDENING
-- Sprint: DATA-MOAT-ACTIVATION-002
-- Date: 2026-02-28
--
-- PURPOSE:
-- 1. Auto-compute feature_vector_hash on INSERT (trigger)
-- 2. Enforce NOT NULL for feature_vector_hash on new rows
-- 3. Enforce loss_classification NOT NULL for loss settlements
-- 4. Add integrity constraints
--
-- APPROACH:
-- - Use triggers for auto-computation (not blocking legacy)
-- - Add constraints that respect legacy NULL data
-- - Fail-closed for new data only
-- ============================================================================

-- ============================================================================
-- 1. AUTO-COMPUTE TRIGGER FOR feature_vector_hash
-- Ensures every new feature_snapshot gets a hash automatically
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_compute_feature_hash()
RETURNS TRIGGER AS $$
BEGIN
  -- Only compute if feature_vector exists and hash is not already set
  IF NEW.feature_vector IS NOT NULL AND NEW.feature_vector_hash IS NULL THEN
    NEW.feature_vector_hash := encode(sha256(NEW.feature_vector::text::bytea), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger on INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_feature_snapshots_hash ON feature_snapshots;
CREATE TRIGGER trigger_feature_snapshots_hash
  BEFORE INSERT OR UPDATE ON feature_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION trigger_compute_feature_hash();

COMMENT ON FUNCTION trigger_compute_feature_hash() IS
  'Auto-compute feature_vector_hash if not provided. Sprint: DATA-MOAT-ACTIVATION-002.';

-- ============================================================================
-- 2. CONSTRAINT: feature_vector_hash NOT NULL for new scored rows
-- Uses a partial constraint that only applies to rows after this migration
-- ============================================================================

-- Add a marker column to track migration boundary (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_snapshots' AND column_name = 'schema_version'
  ) THEN
    ALTER TABLE feature_snapshots ADD COLUMN schema_version INTEGER DEFAULT 1;
  END IF;
END $$;

-- Update schema_version for new constraint enforcement
-- All NEW rows will have schema_version = 2
ALTER TABLE feature_snapshots ALTER COLUMN schema_version SET DEFAULT 2;

-- Add CHECK constraint for new rows (schema_version >= 2)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'feature_snapshots_hash_required_v2'
      AND table_name = 'feature_snapshots'
  ) THEN
    ALTER TABLE feature_snapshots
      ADD CONSTRAINT feature_snapshots_hash_required_v2
      CHECK (
        schema_version < 2 OR
        (schema_version >= 2 AND feature_vector_hash IS NOT NULL)
      );
  END IF;
END $$;

COMMENT ON COLUMN feature_snapshots.schema_version IS
  'Schema version for constraint enforcement. v2+ requires feature_vector_hash NOT NULL. Sprint: DATA-MOAT-ACTIVATION-002.';

-- ============================================================================
-- 3. CONSTRAINT: loss_classification required for loss settlements
-- Only enforces for settlement_result = 'loss'
-- ============================================================================

-- First, drop the old check constraint
ALTER TABLE prop_settlements
  DROP CONSTRAINT IF EXISTS prop_settlements_loss_classification_check;

-- Add new constraint: losses MUST have classification
ALTER TABLE prop_settlements
  ADD CONSTRAINT prop_settlements_loss_classification_check
  CHECK (
    -- Non-loss settlements: classification must be NULL
    (settlement_result IS NULL AND loss_classification IS NULL)
    OR
    (settlement_result IN ('win', 'push', 'void') AND loss_classification IS NULL)
    OR
    -- Loss settlements: classification is required
    (settlement_result = 'loss' AND loss_classification IN (
      'PROJECTION_MISS',
      'VARIANCE',
      'EXECUTION_MISS',
      'NEWS_MISS',
      'CORRELATION_MISS',
      'PRICE_MISS',
      'UNKNOWN'
    ))
  );

COMMENT ON CONSTRAINT prop_settlements_loss_classification_check ON prop_settlements IS
  'Losses require classification. Non-losses must have NULL. Sprint: DATA-MOAT-ACTIVATION-002.';

-- ============================================================================
-- 4. BACKFILL: Classify existing unclassified losses as UNKNOWN
-- Required before constraint can be enforced
-- ============================================================================

UPDATE prop_settlements
SET
  loss_classification = 'UNKNOWN',
  attribution_timestamp = NOW()
WHERE settlement_result = 'loss'
  AND loss_classification IS NULL;

-- ============================================================================
-- 5. BACKFILL: Ensure all existing feature_snapshots have hashes
-- (Repeat from previous migration for safety)
-- ============================================================================

UPDATE feature_snapshots
SET feature_vector_hash = encode(sha256(feature_vector::text::bytea), 'hex')
WHERE feature_vector IS NOT NULL
  AND feature_vector_hash IS NULL;

-- ============================================================================
-- 6. VALIDATION QUERIES (for proof)
-- ============================================================================

-- These should all return 0 after migration:
-- SELECT COUNT(*) FROM feature_snapshots WHERE feature_vector IS NOT NULL AND feature_vector_hash IS NULL;
-- SELECT COUNT(*) FROM prop_settlements WHERE settlement_result = 'loss' AND loss_classification IS NULL;

-- ============================================================================
-- END MIGRATION
-- Sprint: DATA-MOAT-ACTIVATION-002
--
-- ROLLBACK SQL:
-- DROP TRIGGER IF EXISTS trigger_feature_snapshots_hash ON feature_snapshots;
-- DROP FUNCTION IF EXISTS trigger_compute_feature_hash();
-- ALTER TABLE prop_settlements DROP CONSTRAINT IF EXISTS prop_settlements_loss_classification_check;
-- ALTER TABLE feature_snapshots DROP CONSTRAINT IF EXISTS feature_snapshots_hash_required_v2;
-- ALTER TABLE feature_snapshots DROP COLUMN IF EXISTS schema_version;
-- -- Re-add old constraint:
-- ALTER TABLE prop_settlements ADD CONSTRAINT prop_settlements_loss_classification_check
--   CHECK (loss_classification IS NULL OR loss_classification IN (...));
-- ============================================================================
