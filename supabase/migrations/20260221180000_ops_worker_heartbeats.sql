-- Migration: SPRINT-END-TO-END-TICKET-LIFECYCLE-TRUTH-093
-- Purpose: Worker heartbeats table, upsert RPC, and Discord routing status view
-- Date: 2026-02-21

-- ============================================================================
-- 1. OPS_WORKER_HEARTBEATS TABLE
-- ============================================================================
-- Tracks worker health via periodic heartbeat writes.
-- Each worker (by name + ID) upserts its status every poll cycle.

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

-- Index for quick lookups by worker name
CREATE INDEX IF NOT EXISTS idx_ops_worker_heartbeats_worker_name
  ON ops_worker_heartbeats(worker_name);

-- Index for stale detection
CREATE INDEX IF NOT EXISTS idx_ops_worker_heartbeats_last_heartbeat
  ON ops_worker_heartbeats(last_heartbeat_at);

COMMENT ON TABLE ops_worker_heartbeats IS
  'SPRINT-093: Worker heartbeat tracking for operational visibility';

-- ============================================================================
-- 2. UPSERT_WORKER_HEARTBEAT RPC
-- ============================================================================
-- Atomic upsert of worker heartbeat. Called by workers every poll cycle.

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
    worker_name,
    worker_id,
    last_heartbeat_at,
    status,
    last_error,
    items_processed_total,
    last_successful_post_at,
    meta,
    updated_at
  ) VALUES (
    p_worker_name,
    p_worker_id,
    NOW(),
    p_status,
    p_last_error,
    p_items_processed,
    p_last_successful_post_at,
    p_meta,
    NOW()
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
  'SPRINT-093: Atomic upsert of worker heartbeat with cumulative item count';

-- ============================================================================
-- 3. OPS_DISCORD_ROUTING_STATUS VIEW
-- ============================================================================
-- Aggregates all Discord routing health signals into a single queryable view.
-- Used by /ops/discord-routing-status endpoint.

CREATE OR REPLACE VIEW ops_discord_routing_status AS
WITH worker_status AS (
  SELECT
    worker_id,
    last_heartbeat_at,
    status,
    last_error,
    items_processed_total,
    last_successful_post_at,
    meta,
    -- Worker heartbeat freshness (10s poll interval):
    -- healthy: <30s, degraded: 30-120s, unhealthy: >120s
    CASE
      WHEN last_heartbeat_at > NOW() - INTERVAL '30 seconds' THEN 'healthy'
      WHEN last_heartbeat_at > NOW() - INTERVAL '120 seconds' THEN 'degraded'
      ELSE 'unhealthy'
    END AS heartbeat_status,
    (last_heartbeat_at > NOW() - INTERVAL '30 seconds') AS heartbeat_fresh
  FROM ops_worker_heartbeats
  WHERE worker_name = 'discord-ticket-worker'
  ORDER BY last_heartbeat_at DESC
  LIMIT 1
),
queue_metrics AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE status = 'processing') AS processing_count,
    COUNT(*) FILTER (WHERE status = 'posted') AS posted_count,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
    MAX(posted_at) AS last_post_at,
    (SELECT error FROM ticket_discord_outbox
     WHERE status = 'failed'
     ORDER BY updated_at DESC
     LIMIT 1) AS most_recent_error
  FROM ticket_discord_outbox
),
channel_config AS (
  SELECT
    route_key,
    discord_channel_id,
    is_active
  FROM discord_routes
  WHERE route_key = 'default' AND is_active = TRUE
  LIMIT 1
)
SELECT
  -- Worker health
  COALESCE(ws.heartbeat_fresh, FALSE) AS worker_enabled,
  COALESCE(ws.heartbeat_status, 'unhealthy') AS heartbeat_health,
  ws.worker_id,
  ws.last_heartbeat_at AS worker_last_heartbeat,
  ws.status AS worker_status,
  ws.last_error AS worker_last_error,
  ws.items_processed_total,

  -- Channel configuration (DB-level check; env var checked at runtime)
  (cc.discord_channel_id IS NOT NULL) AS channel_from_db,
  cc.discord_channel_id AS db_channel_id,

  -- Queue metrics
  COALESCE(qm.pending_count, 0) AS pending_count,
  COALESCE(qm.processing_count, 0) AS processing_count,
  COALESCE(qm.posted_count, 0) AS posted_count,
  COALESCE(qm.failed_count, 0) AS failed_count,

  -- Activity
  COALESCE(qm.last_post_at, ws.last_successful_post_at) AS last_post_at,
  qm.most_recent_error,

  -- Timestamp
  NOW() AS queried_at

FROM (SELECT 1) AS dummy
LEFT JOIN worker_status ws ON TRUE
LEFT JOIN queue_metrics qm ON TRUE
LEFT JOIN channel_config cc ON TRUE;

COMMENT ON VIEW ops_discord_routing_status IS
  'SPRINT-093: Aggregated Discord routing health status for self-verification';

-- ============================================================================
-- 4. GET_DISCORD_ROUTING_STATUS RPC
-- ============================================================================
-- Returns routing status as JSON for API consumption.

CREATE OR REPLACE FUNCTION get_discord_routing_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'worker_enabled', worker_enabled,
    'heartbeat_health', heartbeat_health,
    'worker_id', worker_id,
    'worker_last_heartbeat', worker_last_heartbeat,
    'worker_status', worker_status,
    'worker_last_error', worker_last_error,
    'items_processed_total', items_processed_total,
    'channel_from_db', channel_from_db,
    'db_channel_id', db_channel_id,
    'pending_count', pending_count,
    'processing_count', processing_count,
    'posted_count', posted_count,
    'failed_count', failed_count,
    'last_post_at', last_post_at,
    'most_recent_error', most_recent_error,
    'queried_at', queried_at
  )
  INTO v_result
  FROM ops_discord_routing_status;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_discord_routing_status IS
  'SPRINT-093: Returns Discord routing status as JSON for API endpoint';

-- ============================================================================
-- 5. PERMISSIONS
-- ============================================================================

-- Worker heartbeat: service_role only (workers run server-side)
GRANT EXECUTE ON FUNCTION upsert_worker_heartbeat TO service_role;

-- Routing status: service_role for API, authenticated for dashboard
GRANT EXECUTE ON FUNCTION get_discord_routing_status TO service_role, authenticated;

-- View access
GRANT SELECT ON ops_discord_routing_status TO service_role, authenticated;

-- Table access (for direct queries if needed)
GRANT SELECT, INSERT, UPDATE ON ops_worker_heartbeats TO service_role;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- DROP FUNCTION IF EXISTS get_discord_routing_status();
-- DROP FUNCTION IF EXISTS upsert_worker_heartbeat(TEXT, TEXT, TEXT, TEXT, BIGINT, TIMESTAMPTZ, JSONB);
-- DROP VIEW IF EXISTS ops_discord_routing_status;
-- DROP TABLE IF EXISTS ops_worker_heartbeats;
