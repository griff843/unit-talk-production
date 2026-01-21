-- ============================================================================
-- Migration: PR10 Add Missing pick_publish Columns for DiscordPromotionAgent
-- Date: 2026-01-21
-- Authority: DiscordPromotionAgent atomic claim requirements
-- ============================================================================
--
-- PURPOSE:
-- Add missing columns required by DiscordPromotionAgent for atomic claim
-- and error tracking functionality.
--
-- COLUMNS TO ADD:
-- 1. worker_id - Identifies the worker that claimed the record
-- 2. processing_started_at - Timestamp when processing started
-- 3. error - Error message column (alias for consistency with agent code)
-- ============================================================================

-- Add worker_id column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pick_publish' AND column_name = 'worker_id'
  ) THEN
    ALTER TABLE pick_publish ADD COLUMN worker_id TEXT DEFAULT NULL;
    COMMENT ON COLUMN pick_publish.worker_id IS
      'Identifier of the worker that claimed this record for processing';
  END IF;
END $$;

-- Add processing_started_at column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pick_publish' AND column_name = 'processing_started_at'
  ) THEN
    ALTER TABLE pick_publish ADD COLUMN processing_started_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN pick_publish.processing_started_at IS
      'Timestamp when a worker started processing this record';
  END IF;
END $$;

-- Add error column if not exists (agent expects 'error', table has 'last_error')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pick_publish' AND column_name = 'error'
  ) THEN
    ALTER TABLE pick_publish ADD COLUMN error TEXT DEFAULT NULL;
    COMMENT ON COLUMN pick_publish.error IS
      'Error message from the last processing attempt';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'pick_publish'
-- AND column_name IN ('worker_id', 'processing_started_at', 'error');
-- ============================================================================
