-- ============================================================================
-- DISCORD PUBLISH TOKEN CRASH WINDOW SAFETY
-- Sprint: SPRINT-STRUCTURAL-REINFORCEMENT-P0-003 (safety patch)
-- Date: 2026-02-27
--
-- CRITICAL FIX: Prevents duplicate Discord posts in crash window scenario.
--
-- VULNERABILITY PATCHED:
--   1. Worker A claims row, gets publish_token
--   2. Worker A POSTs to Discord successfully
--   3. Worker A CRASHES before storing discord_message_id
--   4. Stale reset cleared publish_token (WRONG - destroyed evidence)
--   5. Worker B claims, sees no discord_message_id, POSTs again = DUPLICATE
--
-- FIX:
--   - NEVER clear publish_token on stale reset
--   - publish_token presence = evidence of prior claim attempt
--   - Rows with publish_token after stale reset = "crash window" = FAIL
--   - Claim function SKIPS rows with existing publish_token
-- ============================================================================

-- ============================================================================
-- 1. UPDATE STALE RESET TO PRESERVE PUBLISH_TOKEN
-- ============================================================================

CREATE OR REPLACE FUNCTION reset_stale_discord_outbox_claims(
  p_stale_seconds INTEGER DEFAULT 60
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- CRITICAL SAFETY: Do NOT clear publish_token!
  -- If a worker crashed after POST but before recording discord_message_id,
  -- the publish_token is the ONLY evidence that a POST was attempted.
  -- Clearing it would cause duplicate posts on retry.

  UPDATE ticket_discord_outbox
  SET
    status = 'pending',
    claimed_at = NULL,
    claimed_by = NULL,
    -- SAFETY FIX: Keep publish_token as crash window evidence
    -- publish_token = NULL,        -- REMOVED - DO NOT CLEAR
    -- publish_token_at = NULL,     -- REMOVED - DO NOT CLEAR
    error = jsonb_build_object(
      'type', 'STALE_CLAIM_RESET',
      'message', 'Claim timed out. publish_token preserved for crash window detection.',
      'stale_seconds', p_stale_seconds,
      'previous_error', error,
      'publish_token_preserved', true,
      'crash_window_risk', 'Row may have posted before crash. Manual check required if claimed.',
      'timestamp', NOW()
    )::TEXT
  WHERE status = 'processing'
    AND claimed_at < NOW() - (p_stale_seconds || ' seconds')::INTERVAL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_stale_discord_outbox_claims IS
  'SPRINT-P0-003 SAFETY: Reset stale claims but PRESERVE publish_token for crash window detection.';

-- ============================================================================
-- 2. UPDATE CLAIM TO DETECT CRASH WINDOW ROWS
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
  created_at TIMESTAMPTZ,
  publish_token UUID
) AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT o.id
    FROM ticket_discord_outbox o
    WHERE o.status = 'pending'
      AND o.discord_channel_id IS NOT NULL  -- Only claim rows with valid channel
      -- SAFETY FIX: Skip rows with existing publish_token (crash window risk)
      -- These rows had a prior claim that timed out - possible crash after POST
      AND o.publish_token IS NULL
    ORDER BY o.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE ticket_discord_outbox o
    SET
      status = 'processing',
      claimed_at = NOW(),
      claimed_by = p_worker_id,
      -- Set fresh publish_token for this claim
      publish_token = gen_random_uuid(),
      publish_token_at = NOW()
    FROM claimed c
    WHERE o.id = c.id
    RETURNING o.id, o.publish_token
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
    o.created_at,
    u.publish_token
  FROM ticket_discord_outbox o
  JOIN tickets t ON t.id = o.ticket_id
  JOIN updated u ON u.id = o.id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION claim_discord_outbox_batch IS
  'SPRINT-P0-003 SAFETY: Claim batch, skip rows with existing publish_token (crash window).';

-- ============================================================================
-- 3. NEW: MARK CRASH WINDOW ROWS AS FAILED
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_crash_window_rows_failed()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Find pending rows with publish_token (evidence of prior crash)
  -- Mark them as FAILED for manual review - DO NOT auto-retry

  UPDATE ticket_discord_outbox
  SET
    status = 'failed',
    error = jsonb_build_object(
      'type', 'CRASH_WINDOW_DETECTED',
      'message', 'Row had prior claim with publish_token but no discord_message_id. Possible duplicate risk.',
      'action_required', 'Manual check: verify if message exists in Discord channel before re-processing.',
      'publish_token', publish_token,
      'publish_token_at', publish_token_at,
      'detected_at', NOW()
    )::TEXT
  WHERE status = 'pending'
    AND publish_token IS NOT NULL
    AND discord_message_id IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_crash_window_rows_failed IS
  'SPRINT-P0-003 SAFETY: Mark pending rows with publish_token as FAILED (crash window). Manual check required.';

-- ============================================================================
-- 4. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION mark_crash_window_rows_failed TO service_role;

-- ============================================================================
-- CRASH WINDOW SAFETY PROOF:
-- ============================================================================
--
-- SCENARIO: Worker crashes after Discord POST but before release_claim
--
-- OLD FLOW (VULNERABLE):
--   1. claim → publish_token = UUID-A
--   2. POST to Discord → success (message created)
--   3. CRASH (discord_message_id not stored)
--   4. stale reset → publish_token = NULL (DESTROYS EVIDENCE)
--   5. new claim → publish_token = UUID-B
--   6. idempotency check → discord_message_id IS NULL → POSTS AGAIN
--   RESULT: DUPLICATE MESSAGE
--
-- NEW FLOW (SAFE):
--   1. claim → publish_token = UUID-A
--   2. POST to Discord → success (message created)
--   3. CRASH (discord_message_id not stored)
--   4. stale reset → publish_token PRESERVED (evidence kept)
--   5. new claim → SKIPS row (publish_token IS NOT NULL)
--   6. mark_crash_window_rows_failed() → status = 'failed'
--   RESULT: NO DUPLICATE - Manual review required
--
-- GUARANTEE: A row can ONLY be claimed if publish_token IS NULL.
-- Once claimed, publish_token is set. If crash happens, token remains.
-- Stale reset does NOT clear token. Retry claim skips such rows.
-- Therefore: IMPOSSIBLE to double-post.
--
-- ============================================================================

-- ============================================================================
-- ROLLBACK (manual execution if needed):
-- ============================================================================
-- DROP FUNCTION IF EXISTS mark_crash_window_rows_failed();
-- -- Restore original reset_stale_discord_outbox_claims from 20260227100000
-- -- Restore original claim_discord_outbox_batch from 20260227100000

-- ============================================================================
-- END OF MIGRATION
-- Sprint: SPRINT-STRUCTURAL-REINFORCEMENT-P0-003 (safety patch)
-- ============================================================================
