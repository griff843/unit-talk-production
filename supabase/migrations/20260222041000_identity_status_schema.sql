-- ============================================================================
-- IDENTITY STATUS SCHEMA
-- Sprint: SPRINT-MARKET-SCOPED-IDENTITY-100B2
-- Date: 2026-02-22
--
-- Adds identity_status to participants for tracking resolution state.
-- Used by scoring to determine fail-closed behavior for market universe players.
--
-- Status meanings:
-- - 'resolved': Player has team linkage via participant_memberships
-- - 'unlinked': Player exists but no team linkage (free agent, historical)
-- - 'quarantined': Player in market universe without team linkage (scoring blocked)
-- ============================================================================

-- ============================================================================
-- 1. CREATE identity_status ENUM
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'identity_status_type') THEN
    CREATE TYPE identity_status_type AS ENUM ('resolved', 'unlinked', 'quarantined');
  END IF;
END$$;

-- ============================================================================
-- 2. ADD identity_status COLUMN TO participants
-- ============================================================================

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS identity_status identity_status_type DEFAULT 'unlinked';

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS identity_status_updated_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN participants.identity_status IS
  'Player identity resolution status: resolved (has team), unlinked (no team), quarantined (in market universe without team). V3.';

COMMENT ON COLUMN participants.identity_status_updated_at IS
  'Last time identity_status was evaluated. V3.';

-- Index for querying by status
CREATE INDEX IF NOT EXISTS idx_participants_identity_status
  ON participants(identity_status)
  WHERE type = 'player';

-- ============================================================================
-- 3. FUNCTION: update_identity_status
-- Updates identity_status for a single participant based on current data
-- ============================================================================

CREATE OR REPLACE FUNCTION update_identity_status(p_participant_id UUID)
RETURNS identity_status_type AS $$
DECLARE
  v_has_membership BOOLEAN;
  v_in_market_universe BOOLEAN;
  v_new_status identity_status_type;
BEGIN
  -- Check if player has current team membership
  SELECT EXISTS(
    SELECT 1 FROM participant_memberships pm
    WHERE pm.participant_id = p_participant_id
      AND pm.valid_to IS NULL
  ) INTO v_has_membership;

  -- Check if player is in market universe
  SELECT EXISTS(
    SELECT 1 FROM view_market_universe_players mu
    WHERE mu.participant_id = p_participant_id
  ) INTO v_in_market_universe;

  -- Determine new status
  IF v_has_membership THEN
    v_new_status := 'resolved';
  ELSIF v_in_market_universe THEN
    -- In market universe but no team = quarantined (fail-closed)
    v_new_status := 'quarantined';
  ELSE
    -- Not in market universe and no team = just unlinked (acceptable)
    v_new_status := 'unlinked';
  END IF;

  -- Update participant
  UPDATE participants
  SET identity_status = v_new_status,
      identity_status_updated_at = NOW()
  WHERE id = p_participant_id;

  RETURN v_new_status;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_identity_status IS
  'Update identity_status for a participant based on membership and market universe. V3.';

-- ============================================================================
-- 4. FUNCTION: refresh_all_identity_statuses
-- Batch update all player identity statuses
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_all_identity_statuses()
RETURNS TABLE (
  updated_count INTEGER,
  resolved_count INTEGER,
  unlinked_count INTEGER,
  quarantined_count INTEGER
) AS $$
DECLARE
  v_updated INTEGER := 0;
  v_resolved INTEGER := 0;
  v_unlinked INTEGER := 0;
  v_quarantined INTEGER := 0;
BEGIN
  -- Update all players based on current membership and market universe state
  WITH player_status AS (
    SELECT
      p.id,
      CASE
        WHEN pm.participant_id IS NOT NULL THEN 'resolved'::identity_status_type
        WHEN mu.participant_id IS NOT NULL THEN 'quarantined'::identity_status_type
        ELSE 'unlinked'::identity_status_type
      END AS new_status
    FROM participants p
    LEFT JOIN (
      SELECT DISTINCT participant_id
      FROM participant_memberships
      WHERE valid_to IS NULL
    ) pm ON pm.participant_id = p.id
    LEFT JOIN view_market_universe_players mu ON mu.participant_id = p.id
    WHERE p.type = 'player'
  ),
  updated AS (
    UPDATE participants p
    SET identity_status = ps.new_status,
        identity_status_updated_at = NOW()
    FROM player_status ps
    WHERE p.id = ps.id
      AND (p.identity_status IS DISTINCT FROM ps.new_status OR p.identity_status IS NULL)
    RETURNING p.id, p.identity_status
  )
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE identity_status = 'resolved')::INTEGER,
    COUNT(*) FILTER (WHERE identity_status = 'unlinked')::INTEGER,
    COUNT(*) FILTER (WHERE identity_status = 'quarantined')::INTEGER
  INTO v_updated, v_resolved, v_unlinked, v_quarantined
  FROM updated;

  RETURN QUERY SELECT v_updated, v_resolved, v_unlinked, v_quarantined;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_all_identity_statuses IS
  'Batch refresh identity_status for all players. Call after sync or feed ingestion. V3.';

-- ============================================================================
-- 5. VIEW: view_identity_status_summary
-- Summary of identity status by sport
-- ============================================================================

CREATE OR REPLACE VIEW view_identity_status_summary AS
SELECT
  COALESCE(p.sport, 'TOTAL') AS sport,
  COUNT(*) AS total_players,
  COUNT(*) FILTER (WHERE p.identity_status = 'resolved') AS resolved,
  COUNT(*) FILTER (WHERE p.identity_status = 'unlinked') AS unlinked,
  COUNT(*) FILTER (WHERE p.identity_status = 'quarantined') AS quarantined,
  ROUND(100.0 * COUNT(*) FILTER (WHERE p.identity_status = 'resolved') / NULLIF(COUNT(*), 0), 1) AS resolved_percent,
  ROUND(100.0 * COUNT(*) FILTER (WHERE p.identity_status = 'quarantined') / NULLIF(COUNT(*), 0), 1) AS quarantined_percent
FROM participants p
WHERE p.type = 'player'
GROUP BY ROLLUP(p.sport)
ORDER BY
  CASE WHEN p.sport IS NULL THEN 1 ELSE 0 END,
  quarantined DESC;

COMMENT ON VIEW view_identity_status_summary IS
  'Identity status summary by sport. V3.';

-- ============================================================================
-- 6. VIEW: view_quarantined_players
-- Players in quarantine state (market universe without team linkage)
-- Critical for operator attention
-- ============================================================================

CREATE OR REPLACE VIEW view_quarantined_players AS
SELECT
  p.id,
  p.external_id,
  p.name,
  p.sport,
  p.identity_status_updated_at,
  mu.in_recent_offers,
  mu.in_upcoming_roster,
  (
    SELECT MAX(po.snapshot_at)
    FROM provider_offers po
    WHERE po.participant_id = p.id
  ) AS last_offer_at
FROM participants p
LEFT JOIN view_market_universe_players mu ON mu.participant_id = p.id
WHERE p.type = 'player'
  AND p.identity_status = 'quarantined'
ORDER BY p.sport, p.name;

COMMENT ON VIEW view_quarantined_players IS
  'Quarantined players needing team linkage resolution. V3.';

-- ============================================================================
-- 7. INITIAL STATUS UPDATE
-- Set initial status for all existing players
-- ============================================================================

-- First set all players to 'unlinked' as default
UPDATE participants
SET identity_status = 'unlinked',
    identity_status_updated_at = NOW()
WHERE type = 'player'
  AND identity_status IS NULL;

-- Then update to 'resolved' for players with current membership
UPDATE participants p
SET identity_status = 'resolved',
    identity_status_updated_at = NOW()
FROM (
  SELECT DISTINCT participant_id
  FROM participant_memberships
  WHERE valid_to IS NULL
) pm
WHERE p.id = pm.participant_id
  AND p.type = 'player';

-- Note: 'quarantined' status requires view_market_universe_players which may be empty
-- Run refresh_all_identity_statuses() after provider_offers is populated

-- ============================================================================
-- END OF MIGRATION
-- Sprint: SPRINT-MARKET-SCOPED-IDENTITY-100B2
--
-- NEW TYPE:
-- - identity_status_type ENUM ('resolved', 'unlinked', 'quarantined')
--
-- SCHEMA CHANGES:
-- - participants.identity_status column
-- - participants.identity_status_updated_at column
--
-- NEW FUNCTIONS:
-- - update_identity_status(participant_id) - single participant update
-- - refresh_all_identity_statuses() - batch update all players
--
-- NEW VIEWS:
-- - view_identity_status_summary (stats by sport)
-- - view_quarantined_players (operators attention list)
-- ============================================================================
