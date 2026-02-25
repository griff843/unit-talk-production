-- ============================================================================
-- SPRINT-B3-OUTBOX-DETERMINISM-002: Outbox Determinism Hardening
-- Date: 2026-02-25
-- Purpose: Enforce idempotency and add health monitoring for bridge_outbox
--
-- Closes audit gaps:
-- - OUTBOX-001: UNIQUE constraint on idempotency key
-- - OUTBOX-002: Pending-age alerting infrastructure
--
-- Changes:
-- 1. Add UNIQUE constraint on (bet_slip_id, event_type) for all events with bet_slip_id
-- 2. Add check constraint for retry_count cap (5 attempts)
-- 3. Add helper functions for pending-age monitoring
-- 4. Add dead-letter detection function
--
-- Idempotency Key: (bet_slip_id, event_type) compound key
-- Rationale: Each bet slip can have exactly one event of each type.
--            Multiple event types per bet slip are allowed (ticket_submitted, ticket_status_updated).
--
-- Rollback:
--   DROP FUNCTION IF EXISTS get_stale_outbox_events(INTERVAL);
--   DROP FUNCTION IF EXISTS get_dead_letter_events();
--   DROP FUNCTION IF EXISTS check_outbox_health();
--   ALTER TABLE bridge_outbox DROP CONSTRAINT IF EXISTS chk_retry_count_cap;
--   DROP INDEX IF EXISTS idx_bridge_outbox_idempotency_key;
-- ============================================================================

-- ========================================================================
-- 1. ADD UNIQUE CONSTRAINT ON IDEMPOTENCY KEY (bet_slip_id, event_type)
--
-- This extends the existing partial index to cover ALL event types.
-- The constraint only applies when bet_slip_id IS NOT NULL.
-- ========================================================================

-- Drop the old partial index that only covered ticket_submitted
DROP INDEX IF EXISTS idx_bridge_outbox_betslip_event_unique;

-- Create new UNIQUE index covering ALL events with bet_slip_id
-- This is the canonical idempotency enforcement for the outbox pattern
CREATE UNIQUE INDEX IF NOT EXISTS idx_bridge_outbox_idempotency_key
ON bridge_outbox (bet_slip_id, event_type)
WHERE bet_slip_id IS NOT NULL;

COMMENT ON INDEX idx_bridge_outbox_idempotency_key IS
'SPRINT-B3-OUTBOX-DETERMINISM-002: Idempotency key constraint.
Compound key (bet_slip_id, event_type) ensures exactly-once semantics.
Each bet_slip_id can have at most one event of each type.';

-- ========================================================================
-- 2. ADD CHECK CONSTRAINT FOR RETRY CAP (5 attempts max)
--
-- Prevents runaway retries. Events exceeding retry_count should be
-- marked as failed (dead-letter) rather than retried indefinitely.
-- ========================================================================

-- First update any existing records that exceed the cap
UPDATE bridge_outbox
SET status = 'failed',
    error_message = COALESCE(error_message, '') || ' [RETRY_CAP_EXCEEDED]',
    processed_at = NOW()
WHERE retry_count > 5
  AND status NOT IN ('completed', 'failed');

-- Add check constraint for new records
ALTER TABLE bridge_outbox
DROP CONSTRAINT IF EXISTS chk_retry_count_cap;

ALTER TABLE bridge_outbox
ADD CONSTRAINT chk_retry_count_cap
CHECK (retry_count IS NULL OR retry_count <= 6);

COMMENT ON CONSTRAINT chk_retry_count_cap ON bridge_outbox IS
'SPRINT-B3-OUTBOX-DETERMINISM-002: Max retry cap of 5 attempts.
After 5 retries, events must be marked as failed (dead-letter).
Constraint allows 6 to account for the final retry before failure.';

-- ========================================================================
-- 3. PENDING-AGE MONITORING FUNCTION
--
-- Returns events that have been pending longer than the threshold.
-- Default threshold: 2 minutes (OUTBOX-002 requirement)
-- ========================================================================

CREATE OR REPLACE FUNCTION get_stale_outbox_events(
  p_max_pending_age INTERVAL DEFAULT INTERVAL '2 minutes'
)
RETURNS TABLE (
  id UUID,
  bet_slip_id TEXT,
  event_type TEXT,
  status TEXT,
  retry_count INTEGER,
  created_at TIMESTAMPTZ,
  pending_duration INTERVAL,
  is_critical BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bo.id,
    bo.bet_slip_id,
    bo.event_type,
    bo.status,
    bo.retry_count::INTEGER,
    bo.created_at::TIMESTAMPTZ,
    (NOW() - bo.created_at::TIMESTAMPTZ) AS pending_duration,
    -- Critical if: pending > 5 min OR retry_count >= 3
    ((NOW() - bo.created_at::TIMESTAMPTZ) > INTERVAL '5 minutes' OR bo.retry_count >= 3) AS is_critical
  FROM bridge_outbox bo
  WHERE bo.status IN ('pending', 'processing')
    AND bo.created_at::TIMESTAMPTZ < (NOW() - p_max_pending_age)
  ORDER BY bo.created_at ASC;
END;
$$;

COMMENT ON FUNCTION get_stale_outbox_events IS
'SPRINT-B3-OUTBOX-DETERMINISM-002: Returns events pending longer than threshold.
Default threshold: 2 minutes (per OUTBOX-002 alerting requirement).
is_critical flag: true if pending > 5 min OR retry_count >= 3.';

-- ========================================================================
-- 4. DEAD-LETTER DETECTION FUNCTION
--
-- Returns events that have failed permanently (exhausted retries or
-- explicitly marked failed).
-- ========================================================================

CREATE OR REPLACE FUNCTION get_dead_letter_events()
RETURNS TABLE (
  id UUID,
  bet_slip_id TEXT,
  event_type TEXT,
  retry_count INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  age INTERVAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bo.id,
    bo.bet_slip_id,
    bo.event_type,
    bo.retry_count::INTEGER,
    bo.error_message,
    bo.created_at::TIMESTAMPTZ,
    bo.processed_at::TIMESTAMPTZ,
    (NOW() - bo.created_at::TIMESTAMPTZ) AS age
  FROM bridge_outbox bo
  WHERE bo.status = 'failed'
    OR (bo.retry_count >= 5 AND bo.status NOT IN ('completed'))
  ORDER BY bo.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_dead_letter_events IS
'SPRINT-B3-OUTBOX-DETERMINISM-002: Returns permanently failed events (dead-letter).
Includes: status=failed OR retry_count >= 5.
These events require manual intervention or alerting.';

-- ========================================================================
-- 5. OUTBOX HEALTH CHECK FUNCTION
--
-- Returns comprehensive health status for verification gates.
-- Fails if: stale_count > 0 OR dead_letter_count > 0
-- ========================================================================

CREATE OR REPLACE FUNCTION check_outbox_health()
RETURNS TABLE (
  is_healthy BOOLEAN,
  total_pending INTEGER,
  stale_count INTEGER,
  dead_letter_count INTEGER,
  oldest_pending_age INTERVAL,
  health_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_pending INTEGER;
  v_stale_count INTEGER;
  v_dead_letter_count INTEGER;
  v_oldest_pending_age INTERVAL;
  v_is_healthy BOOLEAN;
  v_message TEXT;
BEGIN
  -- Count total pending
  SELECT COUNT(*)::INTEGER INTO v_total_pending
  FROM bridge_outbox
  WHERE status IN ('pending', 'processing');

  -- Count stale (pending > 2 min)
  SELECT COUNT(*)::INTEGER INTO v_stale_count
  FROM bridge_outbox
  WHERE status IN ('pending', 'processing')
    AND created_at::TIMESTAMPTZ < (NOW() - INTERVAL '2 minutes');

  -- Count dead-letter
  SELECT COUNT(*)::INTEGER INTO v_dead_letter_count
  FROM bridge_outbox
  WHERE status = 'failed'
    OR (retry_count >= 5 AND status NOT IN ('completed'));

  -- Get oldest pending age
  SELECT (NOW() - MIN(created_at::TIMESTAMPTZ)) INTO v_oldest_pending_age
  FROM bridge_outbox
  WHERE status IN ('pending', 'processing');

  -- Determine health
  v_is_healthy := (v_stale_count = 0 AND v_dead_letter_count = 0);

  -- Build message
  IF v_is_healthy THEN
    v_message := 'Outbox healthy';
  ELSE
    v_message := '';
    IF v_stale_count > 0 THEN
      v_message := v_message || format('%s stale events (> 2 min pending). ', v_stale_count);
    END IF;
    IF v_dead_letter_count > 0 THEN
      v_message := v_message || format('%s dead-letter events. ', v_dead_letter_count);
    END IF;
    v_message := trim(v_message);
  END IF;

  RETURN QUERY SELECT
    v_is_healthy,
    v_total_pending,
    v_stale_count,
    v_dead_letter_count,
    v_oldest_pending_age,
    v_message;
END;
$$;

COMMENT ON FUNCTION check_outbox_health IS
'SPRINT-B3-OUTBOX-DETERMINISM-002: Health check for verification gates.
Returns is_healthy=false if: stale_count > 0 OR dead_letter_count > 0.
Stale threshold: 2 minutes. Dead-letter: retry_count >= 5 OR status=failed.';

-- ========================================================================
-- 6. ADD INDEX FOR PENDING EVENT QUERIES
--
-- Optimize queries that filter on status and created_at
-- ========================================================================

CREATE INDEX IF NOT EXISTS idx_bridge_outbox_pending_age
ON bridge_outbox (status, created_at)
WHERE status IN ('pending', 'processing');

COMMENT ON INDEX idx_bridge_outbox_pending_age IS
'SPRINT-B3-OUTBOX-DETERMINISM-002: Optimize pending-age monitoring queries.';

-- ========================================================================
-- Complete
-- ========================================================================
