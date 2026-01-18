-- Outbox Hardening Migration
-- Phase: Production Permanence
-- Date: 2025-10-28
--
-- Adds reliability columns to pick_publish for:
-- - Exponential backoff retry scheduling (next_attempt_at)
-- - Idempotency via stable deduplication key (dedupe_key)
-- - Attempt tracking (last_attempt_at)

-- Add columns if they don't exist (idempotent)
DO $$
BEGIN
  -- next_attempt_at: When to retry this publish job
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'pick_publish'
    AND column_name = 'next_attempt_at'
  ) THEN
    ALTER TABLE public.pick_publish
    ADD COLUMN next_attempt_at timestamptz;

    COMMENT ON COLUMN public.pick_publish.next_attempt_at IS
    'Scheduled time for next retry attempt. NULL = retry immediately. Used with exponential backoff.';
  END IF;

  -- dedupe_key: Stable hash for idempotency
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'pick_publish'
    AND column_name = 'dedupe_key'
  ) THEN
    ALTER TABLE public.pick_publish
    ADD COLUMN dedupe_key text;

    COMMENT ON COLUMN public.pick_publish.dedupe_key IS
    'Stable hash of (pick_id + league + market_type + line + side + tenant_id) for idempotent delivery';
  END IF;

  -- last_attempt_at: Track most recent publish attempt
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'pick_publish'
    AND column_name = 'last_attempt_at'
  ) THEN
    ALTER TABLE public.pick_publish
    ADD COLUMN last_attempt_at timestamptz;

    COMMENT ON COLUMN public.pick_publish.last_attempt_at IS
    'Timestamp of most recent publish attempt (success or failure)';
  END IF;
END $$;

-- Create index for efficient polling (idempotent)
CREATE INDEX IF NOT EXISTS idx_pick_publish_next_attempt
ON public.pick_publish (status, next_attempt_at NULLS LAST, created_at DESC)
WHERE status IN ('pending', 'retry');

COMMENT ON INDEX idx_pick_publish_next_attempt IS
'Optimized for publisher polling: SELECT WHERE status=pending AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())';

-- Create unique index for deduplication (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pick_publish_dedupe
ON public.pick_publish (dedupe_key)
WHERE dedupe_key IS NOT NULL;

COMMENT ON INDEX idx_pick_publish_dedupe IS
'Ensures idempotent delivery: one external message per unique dedupe_key';

-- Update existing 'retry' status to 'pending' for consistent polling
UPDATE public.pick_publish
SET status = 'pending'
WHERE status = 'retry';

-- Migration complete
DO $$
BEGIN
  RAISE NOTICE 'Outbox hardening migration complete. Columns: next_attempt_at, dedupe_key, last_attempt_at. Indexes: efficient polling + deduplication.';
END $$;
