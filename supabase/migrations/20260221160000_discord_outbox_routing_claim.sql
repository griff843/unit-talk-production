-- ============================================================================
-- DISCORD OUTBOX ROUTING AND ATOMIC CLAIM
-- Sprint: SPRINT-DISCORD-OUTBOX-ROUTING-CLAIM-092
-- Date: 2026-02-21
--
-- Implements:
-- 1. Config-driven channel routing with fail-closed enqueue
-- 2. Atomic claim semantics with processing status
-- 3. Stale claim guardrails
-- 4. Backfill/cleanup of legacy null-channel pending rows
-- ============================================================================

-- ============================================================================
-- 1. ADD PROCESSING STATUS AND CLAIM COLUMNS
-- ============================================================================

-- Add 'processing' to status check constraint
ALTER TABLE ticket_discord_outbox
  DROP CONSTRAINT IF EXISTS ticket_discord_outbox_status_check;

ALTER TABLE ticket_discord_outbox
  ADD CONSTRAINT ticket_discord_outbox_status_check
  CHECK (status IN ('pending', 'processing', 'posted', 'failed'));

-- Add claim tracking columns
ALTER TABLE ticket_discord_outbox
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_by TEXT;

-- Index for processing status (to detect stale claims)
CREATE INDEX IF NOT EXISTS idx_ticket_discord_outbox_processing
  ON ticket_discord_outbox(claimed_at)
  WHERE status = 'processing';

-- ============================================================================
-- 2. DISCORD ROUTES CONFIG TABLE (optional, env var is primary)
-- ============================================================================

CREATE TABLE IF NOT EXISTS discord_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_key TEXT NOT NULL UNIQUE,
  channel_id TEXT NOT NULL,
  webhook_url TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default ticket route (can be overridden by env var)
INSERT INTO discord_routes (route_key, channel_id, description, is_active)
VALUES ('tickets_default', 'ENV_VAR_REQUIRED', 'Default channel for ticket posts - set via DEFAULT_DISCORD_TICKET_CHANNEL_ID env var', true)
ON CONFLICT (route_key) DO NOTHING;

COMMENT ON TABLE discord_routes IS
  'Config table for Discord channel routing. ENV var DEFAULT_DISCORD_TICKET_CHANNEL_ID takes precedence.';

-- ============================================================================
-- 3. HELPER FUNCTION: RESOLVE DISCORD CHANNEL
-- ============================================================================

CREATE OR REPLACE FUNCTION resolve_discord_channel(
  p_route_key TEXT DEFAULT 'tickets_default'
)
RETURNS TEXT AS $$
DECLARE
  v_channel_id TEXT;
BEGIN
  -- First check discord_routes table
  SELECT channel_id INTO v_channel_id
  FROM discord_routes
  WHERE route_key = p_route_key
    AND is_active = true;

  -- Return channel if found and not placeholder
  IF v_channel_id IS NOT NULL AND v_channel_id != 'ENV_VAR_REQUIRED' THEN
    RETURN v_channel_id;
  END IF;

  -- Return NULL - app layer should resolve from env var
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION resolve_discord_channel IS
  'Resolves Discord channel from routes table. Returns NULL if env var should be used.';

-- ============================================================================
-- 4. ENHANCED ENQUEUE FUNCTION (v2) - FAIL-CLOSED
-- ============================================================================

CREATE OR REPLACE FUNCTION enqueue_ticket_discord_outbox_v2(
  p_ticket_id UUID,
  p_bet_slip_id TEXT,
  p_discord_channel_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  outbox_id UUID,
  status TEXT,
  error_code TEXT,
  error_message TEXT
) AS $$
DECLARE
  v_channel_id TEXT;
  v_outbox_id UUID;
  v_existing_id UUID;
BEGIN
  -- Check for existing outbox entry (idempotency)
  SELECT id INTO v_existing_id
  FROM ticket_discord_outbox
  WHERE ticket_id = p_ticket_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY SELECT
      true AS success,
      v_existing_id AS outbox_id,
      'exists'::TEXT AS status,
      NULL::TEXT AS error_code,
      NULL::TEXT AS error_message;
    RETURN;
  END IF;

  -- Resolve channel: use param, then try db config
  v_channel_id := COALESCE(p_discord_channel_id, resolve_discord_channel('tickets_default'));

  -- FAIL-CLOSED: If no channel resolved, create FAILED row with ROUTE_MISSING
  IF v_channel_id IS NULL OR v_channel_id = '' THEN
    INSERT INTO ticket_discord_outbox (
      ticket_id,
      bet_slip_id,
      discord_channel_id,
      status,
      error,
      retry_count
    ) VALUES (
      p_ticket_id,
      p_bet_slip_id,
      NULL,
      'failed',
      jsonb_build_object(
        'type', 'ROUTE_MISSING',
        'message', 'No Discord channel configured. Set DEFAULT_DISCORD_TICKET_CHANNEL_ID env var or configure discord_routes table.',
        'timestamp', NOW()
      )::TEXT,
      0
    )
    ON CONFLICT (ticket_id) DO NOTHING
    RETURNING id INTO v_outbox_id;

    RETURN QUERY SELECT
      false AS success,
      COALESCE(v_outbox_id, v_existing_id) AS outbox_id,
      'failed'::TEXT AS status,
      'ROUTE_MISSING'::TEXT AS error_code,
      'No Discord channel configured'::TEXT AS error_message;
    RETURN;
  END IF;

  -- SUCCESS: Create pending row with channel
  INSERT INTO ticket_discord_outbox (
    ticket_id,
    bet_slip_id,
    discord_channel_id,
    status
  ) VALUES (
    p_ticket_id,
    p_bet_slip_id,
    v_channel_id,
    'pending'
  )
  ON CONFLICT (ticket_id) DO NOTHING
  RETURNING id INTO v_outbox_id;

  IF v_outbox_id IS NOT NULL THEN
    RETURN QUERY SELECT
      true AS success,
      v_outbox_id AS outbox_id,
      'pending'::TEXT AS status,
      NULL::TEXT AS error_code,
      NULL::TEXT AS error_message;
  ELSE
    -- Conflict happened, return existing
    SELECT id INTO v_existing_id FROM ticket_discord_outbox WHERE ticket_id = p_ticket_id;
    RETURN QUERY SELECT
      true AS success,
      v_existing_id AS outbox_id,
      'exists'::TEXT AS status,
      NULL::TEXT AS error_code,
      NULL::TEXT AS error_message;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enqueue_ticket_discord_outbox_v2 IS
  'SPRINT-092: Fail-closed enqueue with channel routing. Returns structured result.';

-- ============================================================================
-- 5. ATOMIC CLAIM FUNCTION (SELECT FOR UPDATE SKIP LOCKED)
-- ============================================================================

CREATE OR REPLACE FUNCTION claim_discord_outbox_batch(
  p_limit INTEGER DEFAULT 10,
  p_worker_id TEXT DEFAULT 'default'
)
RETURNS TABLE (
  outbox_id UUID,
  ticket_id UUID,
  bet_slip_id TEXT,
  discord_channel_id TEXT,
  ticket_type TEXT,
  total_stake NUMERIC,
  source TEXT,
  meta JSONB,
  legs JSONB,
  retry_count INTEGER,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT o.id
    FROM ticket_discord_outbox o
    WHERE o.status = 'pending'
      AND o.discord_channel_id IS NOT NULL  -- Only claim rows with valid channel
    ORDER BY o.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE ticket_discord_outbox o
    SET
      status = 'processing',
      claimed_at = NOW(),
      claimed_by = p_worker_id
    FROM claimed c
    WHERE o.id = c.id
    RETURNING o.id
  )
  SELECT
    o.id AS outbox_id,
    o.ticket_id,
    o.bet_slip_id,
    o.discord_channel_id,
    t.ticket_type,
    t.total_stake,
    t.source,
    t.meta,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'leg_index', tl.leg_index,
          'selection', tl.selection,
          'provider', tl.provider,
          'provider_line', tl.provider_line,
          'provider_odds', tl.provider_odds,
          'provider_value', tl.provider_value
        )
        ORDER BY tl.leg_index
      )
      FROM ticket_legs tl
      WHERE tl.ticket_id = o.ticket_id
    ) AS legs,
    o.retry_count,
    o.created_at
  FROM ticket_discord_outbox o
  JOIN tickets t ON t.id = o.ticket_id
  WHERE o.id IN (SELECT id FROM updated);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION claim_discord_outbox_batch IS
  'SPRINT-092: Atomic claim with SKIP LOCKED. Only claims rows with valid discord_channel_id.';

-- ============================================================================
-- 6. RELEASE CLAIM FUNCTION (for success/failure)
-- ============================================================================

CREATE OR REPLACE FUNCTION release_discord_outbox_claim(
  p_outbox_id UUID,
  p_success BOOLEAN,
  p_discord_message_id TEXT DEFAULT NULL,
  p_discord_channel_id TEXT DEFAULT NULL,
  p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  IF p_success THEN
    UPDATE ticket_discord_outbox
    SET
      status = 'posted',
      posted_at = NOW(),
      discord_message_id = p_discord_message_id,
      discord_channel_id = COALESCE(p_discord_channel_id, discord_channel_id),
      error = NULL,
      claimed_at = NULL,
      claimed_by = NULL
    WHERE id = p_outbox_id
      AND status = 'processing';
  ELSE
    UPDATE ticket_discord_outbox
    SET
      status = 'failed',
      error = p_error,
      retry_count = retry_count + 1,
      claimed_at = NULL,
      claimed_by = NULL
    WHERE id = p_outbox_id
      AND status = 'processing';
  END IF;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION release_discord_outbox_claim IS
  'SPRINT-092: Release claim after processing. Marks as posted or failed.';

-- ============================================================================
-- 7. STALE CLAIM RESET FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION reset_stale_discord_outbox_claims(
  p_stale_seconds INTEGER DEFAULT 60
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE ticket_discord_outbox
  SET
    status = 'pending',
    claimed_at = NULL,
    claimed_by = NULL,
    error = jsonb_build_object(
      'type', 'STALE_CLAIM_RESET',
      'message', 'Claim was held for too long and reset to pending',
      'stale_seconds', p_stale_seconds,
      'previous_error', error,
      'timestamp', NOW()
    )::TEXT
  WHERE status = 'processing'
    AND claimed_at < NOW() - (p_stale_seconds || ' seconds')::INTERVAL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_stale_discord_outbox_claims IS
  'SPRINT-092: Reset claims held longer than threshold back to pending.';

-- ============================================================================
-- 8. MARK NULL-CHANNEL PENDING ROWS AS FAILED
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_null_channel_outbox()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE ticket_discord_outbox
  SET
    status = 'failed',
    error = jsonb_build_object(
      'type', 'ROUTE_MISSING',
      'message', 'Legacy row with no discord_channel_id. Set DEFAULT_DISCORD_TICKET_CHANNEL_ID and re-submit.',
      'cleanup_timestamp', NOW()
    )::TEXT
  WHERE status = 'pending'
    AND (discord_channel_id IS NULL OR discord_channel_id = '');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_null_channel_outbox IS
  'SPRINT-092: Marks pending rows with null channel as failed with ROUTE_MISSING.';

-- ============================================================================
-- 9. BACKFILL: MARK SPECIFIC BAD ROWS AS FAILED
-- ============================================================================

-- Mark the 6 specific rows mentioned in sprint as ROUTE_MISSING
UPDATE ticket_discord_outbox
SET
  status = 'failed',
  error = jsonb_build_object(
    'type', 'ROUTE_MISSING',
    'message', 'Backfill SPRINT-092: Row had null discord_channel_id',
    'backfill_timestamp', NOW()
  )::TEXT
WHERE id IN (
  'f6e6d03d-baaf-4740-b3f8-13cc561c4e64',
  '76464527-5bf7-4135-ab33-98a35d776774',
  'a91ec9c1-4172-48ec-8b4a-079110c1374e',
  '53867c3a-be84-4891-9d5e-370a087bffba',
  '164c949e-2ba5-4e07-a543-30085b8997e3',
  '81cda52d-915e-45b1-ab69-0f393d50c4e3'
)
AND status = 'pending';

-- Also run cleanup for any other null-channel pending rows
SELECT cleanup_null_channel_outbox();

-- ============================================================================
-- 10. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION enqueue_ticket_discord_outbox_v2 TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION claim_discord_outbox_batch TO service_role;
GRANT EXECUTE ON FUNCTION release_discord_outbox_claim TO service_role;
GRANT EXECUTE ON FUNCTION reset_stale_discord_outbox_claims TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_null_channel_outbox TO service_role;
GRANT EXECUTE ON FUNCTION resolve_discord_channel TO authenticated, anon, service_role;

GRANT SELECT, INSERT, UPDATE ON discord_routes TO service_role;
GRANT SELECT ON discord_routes TO authenticated, anon;

-- ============================================================================
-- ROLLBACK (manual execution if needed):
-- ============================================================================
-- DROP FUNCTION IF EXISTS cleanup_null_channel_outbox();
-- DROP FUNCTION IF EXISTS reset_stale_discord_outbox_claims(INTEGER);
-- DROP FUNCTION IF EXISTS release_discord_outbox_claim(UUID, BOOLEAN, TEXT, TEXT, TEXT);
-- DROP FUNCTION IF EXISTS claim_discord_outbox_batch(INTEGER, TEXT);
-- DROP FUNCTION IF EXISTS enqueue_ticket_discord_outbox_v2(UUID, TEXT, TEXT);
-- DROP FUNCTION IF EXISTS resolve_discord_channel(TEXT);
-- DROP TABLE IF EXISTS discord_routes;
-- ALTER TABLE ticket_discord_outbox DROP COLUMN IF EXISTS claimed_at;
-- ALTER TABLE ticket_discord_outbox DROP COLUMN IF EXISTS claimed_by;
-- ALTER TABLE ticket_discord_outbox DROP CONSTRAINT IF EXISTS ticket_discord_outbox_status_check;
-- ALTER TABLE ticket_discord_outbox ADD CONSTRAINT ticket_discord_outbox_status_check CHECK (status IN ('pending', 'posted', 'failed'));

-- ============================================================================
-- END OF MIGRATION
-- Sprint: SPRINT-DISCORD-OUTBOX-ROUTING-CLAIM-092
-- ============================================================================
