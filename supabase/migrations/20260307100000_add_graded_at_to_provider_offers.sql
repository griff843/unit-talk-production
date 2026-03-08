-- Migration: Add graded_at column to provider_offers for GradingAgent processing tracking
-- Sprint: SPRINT-044D
-- Rollback:
--   DROP INDEX IF EXISTS idx_provider_offers_ungraded;
--   ALTER TABLE provider_offers DROP COLUMN IF EXISTS graded_at;

ALTER TABLE provider_offers ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ;

-- Partial index for efficient query: WHERE graded_at IS NULL ORDER BY created_at ASC
CREATE INDEX IF NOT EXISTS idx_provider_offers_ungraded
  ON provider_offers (created_at ASC)
  WHERE graded_at IS NULL;
