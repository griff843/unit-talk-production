-- Migration: Align pick_publish as canonical publish outbox
-- Sprint: SPRINT-023-PRODUCTION-SURFACE-LOCK
-- Purpose: Add idempotency constraint, payload_hash, error_code to pick_publish
--          so it fulfills the publish_outbox contract from PIPELINE_CONTRACT_CLEANROOM_V3
--
-- pick_publish already has: id, pick_id, status, dedupe_key, external_message_id,
--   sent_at, confirmed_at, attempts, max_attempts, error, last_error, metadata,
--   discord_channel_id, thread_id, channel, tenant_id, worker_id, etc.
--
-- This migration adds:
--   payload_hash (text) — SHA-256 of embed payload for drift detection
--   error_code (text) — structured error classification
--   idempotency_key unique constraint on dedupe_key
--
-- Rollback:
--   ALTER TABLE pick_publish DROP COLUMN IF EXISTS payload_hash;
--   ALTER TABLE pick_publish DROP COLUMN IF EXISTS error_code;
--   DROP INDEX IF EXISTS idx_pick_publish_dedupe_key_unique;

-- Add payload_hash for drift detection
ALTER TABLE pick_publish ADD COLUMN IF NOT EXISTS payload_hash text;

-- Add structured error_code (e.g., WEBHOOK_TIMEOUT, RATE_LIMITED, INVALID_EMBED)
ALTER TABLE pick_publish ADD COLUMN IF NOT EXISTS error_code text;

-- Add unique constraint on dedupe_key for idempotency enforcement
-- Only applies to non-null dedupe_key values
CREATE UNIQUE INDEX IF NOT EXISTS idx_pick_publish_dedupe_key_unique
  ON pick_publish (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- Index for outbox polling: find PENDING jobs ordered by creation
CREATE INDEX IF NOT EXISTS idx_pick_publish_pending_poll
  ON pick_publish (status, created_at)
  WHERE status = 'pending';

-- Index for receipt lookup by pick_id
CREATE INDEX IF NOT EXISTS idx_pick_publish_pick_id
  ON pick_publish (pick_id)
  WHERE pick_id IS NOT NULL;

-- Comment documenting canonical role
COMMENT ON TABLE pick_publish IS
  'Canonical publish outbox (SPRINT-023). All Discord publishing must go through this table. '
  'Idempotency enforced via dedupe_key unique constraint. '
  'Status lifecycle: pending → processing → posted | failed. '
  'Receipt: external_message_id + sent_at + confirmed_at.';
