-- ============================================================================
-- TICKET DISCORD OUTBOX (COMPLIANT VERSION)
-- Sprint: SPRINT-V3-TICKET-DISCORD-PUBLISH-086
-- Date: 2026-02-20
--
-- Implements outbox pattern for V3 Ticket -> Discord publishing:
-- - Creates outbox table with UNIQUE(ticket_id) for idempotency
-- - Helper functions for worker consumption
-- - Does NOT modify atomic_submit_ticket_v2 (enqueue happens in app layer)
-- ============================================================================

-- ============================================================================
-- 1. CREATE TICKET_DISCORD_OUTBOX TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ticket_discord_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
  bet_slip_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'failed')),
  posted_at TIMESTAMPTZ,
  discord_message_id TEXT,
  discord_channel_id TEXT,
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for worker polling
CREATE INDEX IF NOT EXISTS idx_ticket_discord_outbox_status_pending
  ON ticket_discord_outbox(status, created_at)
  WHERE status = 'pending';

-- Index for idempotency checks
CREATE INDEX IF NOT EXISTS idx_ticket_discord_outbox_bet_slip_id
  ON ticket_discord_outbox(bet_slip_id);

COMMENT ON TABLE ticket_discord_outbox IS
  'Outbox for Discord publishing of V3 tickets. Idempotent by ticket_id. Enqueue from app layer.';

-- ============================================================================
-- 2. UPDATE TRIGGER FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_ticket_discord_outbox_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ticket_discord_outbox_updated_at ON ticket_discord_outbox;
CREATE TRIGGER trigger_ticket_discord_outbox_updated_at
  BEFORE UPDATE ON ticket_discord_outbox
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_discord_outbox_updated_at();

-- ============================================================================
-- 3. HELPER FUNCTION: ENQUEUE DISCORD OUTBOX (for app layer)
-- ============================================================================

CREATE OR REPLACE FUNCTION enqueue_ticket_discord_outbox(
  p_ticket_id UUID,
  p_bet_slip_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  INSERT INTO ticket_discord_outbox (
    ticket_id,
    bet_slip_id,
    status
  ) VALUES (
    p_ticket_id,
    p_bet_slip_id,
    'pending'
  )
  ON CONFLICT (ticket_id) DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enqueue_ticket_discord_outbox IS
  'Enqueues a ticket for Discord publishing. Idempotent by ticket_id. Called from app layer after successful submission.';

-- ============================================================================
-- 4. HELPER FUNCTION: GET PENDING DISCORD OUTBOX ITEMS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pending_discord_outbox(
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  outbox_id UUID,
  ticket_id UUID,
  bet_slip_id TEXT,
  ticket_type TEXT,
  total_stake NUMERIC,
  source TEXT,
  meta JSONB,
  legs JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id AS outbox_id,
    o.ticket_id,
    o.bet_slip_id,
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
    o.created_at
  FROM ticket_discord_outbox o
  JOIN tickets t ON t.id = o.ticket_id
  WHERE o.status = 'pending'
  ORDER BY o.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_pending_discord_outbox IS
  'Fetches pending Discord outbox items with full ticket and leg details.';

-- ============================================================================
-- 5. HELPER FUNCTION: MARK OUTBOX AS POSTED
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_discord_outbox_posted(
  p_outbox_id UUID,
  p_discord_message_id TEXT,
  p_discord_channel_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  UPDATE ticket_discord_outbox
  SET
    status = 'posted',
    posted_at = NOW(),
    discord_message_id = p_discord_message_id,
    discord_channel_id = p_discord_channel_id,
    error = NULL
  WHERE id = p_outbox_id
    AND status IN ('pending', 'failed');

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_discord_outbox_posted IS
  'Marks an outbox item as posted with Discord message details. Idempotent.';

-- ============================================================================
-- 6. HELPER FUNCTION: MARK OUTBOX AS FAILED
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_discord_outbox_failed(
  p_outbox_id UUID,
  p_error TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  UPDATE ticket_discord_outbox
  SET
    status = 'failed',
    error = p_error,
    retry_count = retry_count + 1
  WHERE id = p_outbox_id
    AND status IN ('pending', 'failed');

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_discord_outbox_failed IS
  'Marks an outbox item as failed with error message. Increments retry count.';

-- ============================================================================
-- 7. HELPER FUNCTION: RESET FAILED OUTBOX FOR RETRY
-- ============================================================================

CREATE OR REPLACE FUNCTION reset_failed_discord_outbox(
  p_max_retries INTEGER DEFAULT 3
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE ticket_discord_outbox
  SET status = 'pending'
  WHERE status = 'failed'
    AND retry_count < p_max_retries;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_failed_discord_outbox IS
  'Resets failed outbox items to pending for retry, up to max_retries.';

-- ============================================================================
-- END OF MIGRATION
-- Sprint: SPRINT-V3-TICKET-DISCORD-PUBLISH-086
--
-- NOTE: This migration does NOT modify atomic_submit_ticket_v2.
-- Enqueue logic is handled in the app layer after successful submission.
-- ============================================================================
