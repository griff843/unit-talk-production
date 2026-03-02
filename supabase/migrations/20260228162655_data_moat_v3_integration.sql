-- ============================================================================
-- DATA MOAT V3 INTEGRATION
-- Sprint: DATA-MOAT-V3-INTEGRATION-001
-- Date: 2026-02-28
--
-- PURPOSE:
-- 1. Add feature_vector_hash to feature_snapshots for reproducibility
-- 2. Add feature_snapshot_id FK to unified_picks for data moat linkage
-- 3. Add loss attribution columns to prop_settlements
--
-- ROLLBACK: See end of file for rollback SQL
-- ============================================================================

-- ============================================================================
-- 1. ADD FEATURE_VECTOR_HASH TO FEATURE_SNAPSHOTS
-- SHA-256 hash of stable-serialized feature_vector JSONB
-- ============================================================================

ALTER TABLE feature_snapshots
  ADD COLUMN IF NOT EXISTS feature_vector_hash TEXT;

-- Index for hash lookups (reproducibility verification)
CREATE INDEX IF NOT EXISTS idx_feature_snapshots_hash
  ON feature_snapshots(feature_vector_hash)
  WHERE feature_vector_hash IS NOT NULL;

COMMENT ON COLUMN feature_snapshots.feature_vector_hash IS
  'SHA-256 hash of stable-serialized feature_vector JSONB. For reproducibility verification. Sprint: DATA-MOAT-V3-INTEGRATION-001.';

-- ============================================================================
-- 2. ADD FEATURE_SNAPSHOT_ID FK TO UNIFIED_PICKS
-- Links canonical picks to their scoring feature snapshots
-- ============================================================================

ALTER TABLE unified_picks
  ADD COLUMN IF NOT EXISTS feature_snapshot_id UUID;

-- Add FK constraint (separate statement for IF NOT EXISTS pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'unified_picks_feature_snapshot_id_fkey'
      AND table_name = 'unified_picks'
  ) THEN
    ALTER TABLE unified_picks
      ADD CONSTRAINT unified_picks_feature_snapshot_id_fkey
      FOREIGN KEY (feature_snapshot_id) REFERENCES feature_snapshots(id);
  END IF;
END $$;

-- Index for FK lookups
CREATE INDEX IF NOT EXISTS idx_unified_picks_feature_snapshot
  ON unified_picks(feature_snapshot_id)
  WHERE feature_snapshot_id IS NOT NULL;

COMMENT ON COLUMN unified_picks.feature_snapshot_id IS
  'FK to feature_snapshots. Required for promotion (fail-closed gate). Sprint: DATA-MOAT-V3-INTEGRATION-001.';

-- ============================================================================
-- 3. ADD LOSS ATTRIBUTION COLUMNS TO PROP_SETTLEMENTS
-- Post-settlement classification per LOSS_POSTMORTEM_ENGINE_v1.md
-- ============================================================================

ALTER TABLE prop_settlements
  ADD COLUMN IF NOT EXISTS loss_classification TEXT,
  ADD COLUMN IF NOT EXISTS attribution_timestamp TIMESTAMPTZ;

-- Add constraint for valid classification codes (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'prop_settlements_loss_classification_check'
      AND table_name = 'prop_settlements'
  ) THEN
    ALTER TABLE prop_settlements
      ADD CONSTRAINT prop_settlements_loss_classification_check
      CHECK (loss_classification IS NULL OR loss_classification IN (
        'PROJECTION_MISS',
        'VARIANCE',
        'EXECUTION_MISS',
        'NEWS_MISS',
        'CORRELATION_MISS',
        'PRICE_MISS',
        'UNKNOWN'
      ));
  END IF;
END $$;

-- Index for loss classification queries
CREATE INDEX IF NOT EXISTS idx_prop_settlements_loss_classification
  ON prop_settlements(loss_classification)
  WHERE loss_classification IS NOT NULL;

COMMENT ON COLUMN prop_settlements.loss_classification IS
  'Post-settlement loss category per LOSS_POSTMORTEM_ENGINE_v1.md. Sprint: DATA-MOAT-V3-INTEGRATION-001.';
COMMENT ON COLUMN prop_settlements.attribution_timestamp IS
  'When loss classification was computed. Sprint: DATA-MOAT-V3-INTEGRATION-001.';

-- ============================================================================
-- 4. HELPER FUNCTION: Compute feature vector hash in PostgreSQL
-- For backfill and validation purposes
-- ============================================================================

CREATE OR REPLACE FUNCTION compute_feature_hash(feature_vector JSONB)
RETURNS TEXT AS $$
DECLARE
  sorted_json TEXT;
BEGIN
  -- Sort keys and serialize deterministically
  -- Note: PostgreSQL's jsonb naturally sorts keys alphabetically
  SELECT encode(sha256(feature_vector::text::bytea), 'hex') INTO sorted_json;
  RETURN sorted_json;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION compute_feature_hash(JSONB) IS
  'Compute SHA-256 hash of JSONB for reproducibility. Uses PostgreSQL native sorting. Sprint: DATA-MOAT-V3-INTEGRATION-001.';

-- ============================================================================
-- 5. BACKFILL: Compute hashes for existing feature_snapshots
-- Only for records that have feature_vector but no hash
-- ============================================================================

UPDATE feature_snapshots
SET feature_vector_hash = compute_feature_hash(feature_vector)
WHERE feature_vector IS NOT NULL
  AND feature_vector_hash IS NULL;

-- ============================================================================
-- END MIGRATION
-- Sprint: DATA-MOAT-V3-INTEGRATION-001
--
-- ROLLBACK SQL:
-- DROP FUNCTION IF EXISTS compute_feature_hash(JSONB);
-- DROP INDEX IF EXISTS idx_prop_settlements_loss_classification;
-- ALTER TABLE prop_settlements DROP CONSTRAINT IF EXISTS prop_settlements_loss_classification_check;
-- ALTER TABLE prop_settlements DROP COLUMN IF EXISTS attribution_timestamp;
-- ALTER TABLE prop_settlements DROP COLUMN IF EXISTS loss_classification;
-- DROP INDEX IF EXISTS idx_unified_picks_feature_snapshot;
-- ALTER TABLE unified_picks DROP CONSTRAINT IF EXISTS unified_picks_feature_snapshot_id_fkey;
-- ALTER TABLE unified_picks DROP COLUMN IF EXISTS feature_snapshot_id;
-- DROP INDEX IF EXISTS idx_feature_snapshots_hash;
-- ALTER TABLE feature_snapshots DROP COLUMN IF EXISTS feature_vector_hash;
-- ============================================================================
