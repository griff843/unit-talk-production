-- Phase 1: Dead Letter Queue (DLQ) Implementation
-- Purpose: Capture failed events from all critical async paths for manual inspection and replay
-- Date: 2025-01-30

-- Create dead_letter_queue table
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source identification
  source TEXT NOT NULL CHECK (source IN (
    'bridge_worker',
    'discord_publisher',
    'grading_worker',
    'ingestion_worker',
    'temporal_activity',
    'other'
  )),

  -- Original event reference
  original_event_id TEXT,  -- Reference to original event (e.g., bridge_outbox.id, events.id)
  original_table TEXT,     -- Source table name (e.g., 'bridge_outbox', 'events')

  -- Event payload (full payload for replay)
  payload JSONB NOT NULL,

  -- Error details
  error_message TEXT NOT NULL,
  error_stack TEXT,        -- Full stack trace if available
  error_code TEXT,         -- Application-specific error code

  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  max_retries_attempted INTEGER,  -- What was the max retry limit when DLQ'd?

  -- Timestamps
  first_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Replay tracking
  requeued_at TIMESTAMPTZ,
  requeued_by TEXT,        -- User/system that triggered replay
  replay_status TEXT CHECK (replay_status IN ('pending', 'succeeded', 'failed', 'cancelled')),
  replay_error TEXT,       -- Error if replay failed

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,  -- Additional context (correlation_id, tenant_id, etc.)

  -- Indexes
  CONSTRAINT dlq_source_not_empty CHECK (source IS NOT NULL AND source != ''),
  CONSTRAINT dlq_error_message_not_empty CHECK (error_message IS NOT NULL AND error_message != '')
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_dlq_source_created_at
  ON dead_letter_queue(source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dlq_first_failed_at
  ON dead_letter_queue(first_failed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dlq_replay_status
  ON dead_letter_queue(replay_status)
  WHERE replay_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dlq_original_event_id
  ON dead_letter_queue(original_event_id)
  WHERE original_event_id IS NOT NULL;

-- GIN index for payload JSONB queries
CREATE INDEX IF NOT EXISTS idx_dlq_payload
  ON dead_letter_queue USING GIN (payload);

-- GIN index for metadata JSONB queries
CREATE INDEX IF NOT EXISTS idx_dlq_metadata
  ON dead_letter_queue USING GIN (metadata);

-- Create view for operational monitoring
CREATE OR REPLACE VIEW vw_dlq_summary AS
SELECT
  source,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE requeued_at IS NULL) as pending_events,
  COUNT(*) FILTER (WHERE replay_status = 'succeeded') as replayed_successfully,
  COUNT(*) FILTER (WHERE replay_status = 'failed') as replay_failed,
  MIN(first_failed_at) as oldest_failure,
  MAX(first_failed_at) as newest_failure,
  AVG(retry_count)::INTEGER as avg_retry_count
FROM dead_letter_queue
GROUP BY source
ORDER BY total_events DESC;

-- Create view for recent DLQ events
CREATE OR REPLACE VIEW vw_dlq_recent AS
SELECT
  id,
  source,
  original_event_id,
  error_message,
  retry_count,
  first_failed_at,
  requeued_at,
  replay_status,
  created_at
FROM dead_letter_queue
ORDER BY created_at DESC
LIMIT 100;

-- Add comment for documentation
COMMENT ON TABLE dead_letter_queue IS
  'Dead Letter Queue for failed events from all async pipelines.
   Events that exceed max retries are captured here for manual inspection and replay.
   See docs/modernization/phase1_dlq_design.md for operational procedures.';

COMMENT ON COLUMN dead_letter_queue.source IS
  'Source subsystem that generated the DLQ event (bridge_worker, discord_publisher, etc.)';

COMMENT ON COLUMN dead_letter_queue.payload IS
  'Full event payload for replay. Must contain all data needed to reprocess the event.';

COMMENT ON COLUMN dead_letter_queue.metadata IS
  'Additional context: correlation_id, tenant_id, user_id, etc. for debugging.';

-- Grant permissions (adjust based on your RLS policies)
-- This assumes a service role with appropriate permissions
-- ALTER TABLE dead_letter_queue ENABLE ROW LEVEL SECURITY;

-- Example RLS policy (uncomment and adjust if needed)
-- CREATE POLICY dlq_tenant_isolation ON dead_letter_queue
--   FOR ALL
--   USING (metadata->>'tenant_id' = current_setting('request.jwt.claims', true)::json->>'tenant_id');

-- Notify PostgREST to reload schema
SELECT pg_notify('pgrst', 'reload schema');

-- Execute PostgREST reload RPC if available
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'pgrst_reload'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    PERFORM pgrst_reload('phase1-dlq-migration', 'Added dead_letter_queue table');
  END IF;
END $$;
