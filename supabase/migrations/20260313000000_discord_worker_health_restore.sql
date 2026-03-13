-- ============================================================================
-- Migration: SPRINT-DISCORD-WORKER-HEALTH-RESTORE
-- Date: 2026-03-13
-- Purpose: Two-part fix to restore Discord worker health:
--   Part A: Create ops_worker_heartbeats table + upsert RPC (was in
--           20260221180000_ops_worker_heartbeats.sql but never applied to cloud)
--   Part B: Add dead_letter status to ticket_discord_outbox and quarantine
--           the 6 stale CONTRACT_VIOLATION rows (created 2026-02-21, unrecoverable)
--
-- Rollback:
--   -- Part A
--   DROP FUNCTION IF EXISTS get_discord_routing_status();
--   DROP FUNCTION IF EXISTS upsert_worker_heartbeat(TEXT,TEXT,TEXT,TEXT,BIGINT,TIMESTAMPTZ,JSONB);
--   DROP VIEW IF EXISTS ops_discord_routing_status;
--   DROP TABLE IF EXISTS ops_worker_heartbeats;
--   -- Part B
--   UPDATE ticket_discord_outbox SET status='failed', updated_at=NOW()
--     WHERE status='dead_letter';
--   ALTER TABLE ticket_discord_outbox DROP CONSTRAINT IF EXISTS ticket_discord_outbox_status_check;
--   ALTER TABLE ticket_discord_outbox ADD CONSTRAINT ticket_discord_outbox_status_check
--     CHECK (status IN ('pending','processing','posted','failed'));
-- ============================================================================

-- ============================================================================
-- PART A: OPS_WORKER_HEARTBEATS (from 20260221180000 — applying now)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ops_worker_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'stopped')),
  last_error TEXT,
  items_processed_total BIGINT NOT NULL DEFAULT 0,
  last_successful_post_at TIMESTAMPTZ,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(worker_name, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_ops_worker_heartbeats_worker_name
  ON ops_worker_heartbeats(worker_name);

CREATE INDEX IF NOT EXISTS idx_ops_worker_heartbeats_last_heartbeat
  ON ops_worker_heartbeats(last_heartbeat_at);

COMMENT ON TABLE ops_worker_heartbeats IS
  'SPRINT-093/SPRINT-DISCORD-WORKER-HEALTH-RESTORE: Worker heartbeat tracking';

CREATE OR REPLACE FUNCTION upsert_worker_heartbeat(
  p_worker_name TEXT,
  p_worker_id TEXT,
  p_status TEXT DEFAULT 'healthy',
  p_last_error TEXT DEFAULT NULL,
  p_items_processed BIGINT DEFAULT 0,
  p_last_successful_post_at TIMESTAMPTZ DEFAULT NULL,
  p_meta JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO ops_worker_heartbeats (
    worker_name, worker_id, last_heartbeat_at, status, last_error,
    items_processed_total, last_successful_post_at, meta, updated_at
  ) VALUES (
    p_worker_name, p_worker_id, NOW(), p_status, p_last_error,
    p_items_processed, p_last_successful_post_at, p_meta, NOW()
  )
  ON CONFLICT (worker_name, worker_id) DO UPDATE SET
    last_heartbeat_at = NOW(),
    status = EXCLUDED.status,
    last_error = EXCLUDED.last_error,
    items_processed_total = ops_worker_heartbeats.items_processed_total + EXCLUDED.items_processed_total,
    last_successful_post_at = COALESCE(EXCLUDED.last_successful_post_at, ops_worker_heartbeats.last_successful_post_at),
    meta = EXCLUDED.meta,
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION upsert_worker_heartbeat IS
  'SPRINT-093/SPRINT-DISCORD-WORKER-HEALTH-RESTORE: Atomic upsert of worker heartbeat';

GRANT EXECUTE ON FUNCTION upsert_worker_heartbeat TO service_role;
GRANT SELECT, INSERT, UPDATE ON ops_worker_heartbeats TO service_role;

-- ============================================================================
-- PART B: DEAD_LETTER STATUS + QUARANTINE STALE CONTRACT_VIOLATIONS
-- ============================================================================

-- Extend the status check constraint to include dead_letter
ALTER TABLE ticket_discord_outbox
  DROP CONSTRAINT IF EXISTS ticket_discord_outbox_status_check;

ALTER TABLE ticket_discord_outbox
  ADD CONSTRAINT ticket_discord_outbox_status_check
  CHECK (status IN ('pending', 'processing', 'posted', 'failed', 'dead_letter'));

COMMENT ON COLUMN ticket_discord_outbox.status IS
  'pending=awaiting processing, processing=claimed by worker,
   posted=successfully sent to Discord, failed=retryable error,
   dead_letter=permanently unrecoverable (archived, not counted in health checks)';

-- Quarantine the 6 stale CONTRACT_VIOLATION rows from 2026-02-21
-- These are unrecoverable: source data missing required fields (capper, matchup)
-- Already retried once (retry_count=1), still fail — no new data will appear
UPDATE ticket_discord_outbox
SET
  status = 'dead_letter',
  updated_at = NOW(),
  error = error || ' [QUARANTINED:SPRINT-DISCORD-WORKER-HEALTH-RESTORE:2026-03-13:UNRECOVERABLE_CONTRACT_VIOLATION]'
WHERE
  status = 'failed'
  AND (error::jsonb->>'type') = 'CONTRACT_VIOLATION'
  AND retry_count >= 1
  AND updated_at < NOW() - INTERVAL '7 days';

-- ============================================================================
-- ROLLBACK REFERENCE (do not execute):
-- UPDATE ticket_discord_outbox SET status='failed', updated_at=NOW()
--   WHERE status='dead_letter'
--   AND error LIKE '%QUARANTINED:SPRINT-DISCORD-WORKER-HEALTH-RESTORE%';
-- ALTER TABLE ticket_discord_outbox DROP CONSTRAINT ticket_discord_outbox_status_check;
-- ALTER TABLE ticket_discord_outbox ADD CONSTRAINT ticket_discord_outbox_status_check
--   CHECK (status IN ('pending','processing','posted','failed'));
-- DROP TABLE IF EXISTS ops_worker_heartbeats;
-- DROP FUNCTION IF EXISTS upsert_worker_heartbeat(TEXT,TEXT,TEXT,TEXT,BIGINT,TIMESTAMPTZ,JSONB);
-- ============================================================================
