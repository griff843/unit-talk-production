-- ============================================================================
-- PROVIDER ENFORCEMENT FOR DISCORD CONTRACT v1.2
-- Sprint: SPRINT-DISCORD-CONTRACT-BOOK-ENFORCEMENT-108B
-- Date: 2026-02-22
--
-- Implements:
-- 1. provider_id column on unified_picks with FK to provider_registry
-- 2. UNKNOWN_LEGACY provider for backfilling legacy rows
-- 3. view_postable_picks_v1_2 - canonical postable selector
-- 4. blocked_contract outbox status for contract violations
--
-- Uses existing provider_registry table (created in canonical_v3_catalog_seeds)
-- Per Amendment: Legacy rows with UNKNOWN_LEGACY provider are NOT postable.
-- ============================================================================

-- ============================================================================
-- 1. ADD UNKNOWN_LEGACY PROVIDER TO REGISTRY
-- For backfilling legacy rows that cannot be corrected
-- ============================================================================

INSERT INTO provider_registry (code, display_name, api_source, priority, has_player_props, has_live_odds, active)
VALUES ('UNKNOWN_LEGACY', 'Unknown/Legacy', 'legacy', 999, FALSE, FALSE, FALSE)
ON CONFLICT (code) DO UPDATE SET
  display_name = 'Unknown/Legacy',
  active = FALSE,
  priority = 999;

-- ============================================================================
-- 2. ADD provider_id COLUMN TO unified_picks
-- References provider_registry.id (INTEGER)
-- ============================================================================

ALTER TABLE unified_picks
  ADD COLUMN IF NOT EXISTS provider_id INTEGER REFERENCES provider_registry(id);

-- Index for provider_id (analytics: ROI by provider, CLV per provider, sharp detection)
CREATE INDEX IF NOT EXISTS idx_unified_picks_provider_id ON unified_picks(provider_id);

-- Composite index for provider analytics queries
CREATE INDEX IF NOT EXISTS idx_unified_picks_provider_settlement
  ON unified_picks(provider_id, settlement_status)
  WHERE provider_id IS NOT NULL;

COMMENT ON COLUMN unified_picks.provider_id IS
  'SPRINT-108B: FK to provider_registry. Required for Discord posting per Contract v1.2.';

-- ============================================================================
-- 3. BACKFILL LEGACY ROWS TO UNKNOWN_LEGACY PROVIDER
-- Only backfill rows that are already posted or settled (cannot be corrected)
-- ============================================================================

DO $$
DECLARE
  v_legacy_id INTEGER;
  v_count INTEGER;
BEGIN
  -- Get UNKNOWN_LEGACY provider id
  SELECT id INTO v_legacy_id FROM provider_registry WHERE code = 'UNKNOWN_LEGACY';

  IF v_legacy_id IS NOT NULL THEN
    UPDATE unified_picks
    SET provider_id = v_legacy_id
    WHERE provider_id IS NULL
      AND (
        posted_to_discord = true
        OR settlement_status IN ('win', 'loss', 'push', 'void')
      );

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'SPRINT-108B: Backfilled % legacy rows to UNKNOWN_LEGACY provider', v_count;
  END IF;
END $$;

-- ============================================================================
-- 4. CREATE view_postable_picks_v1_2 (CANONICAL POSTABLE SELECTOR)
--
-- This view enforces Discord Contract v1.2 hard fields.
-- ALL posting paths MUST read from this view, NOT from unified_picks directly.
--
-- Per Amendment:
-- - UNKNOWN_LEGACY provider rows are NOT postable
-- - All hard fields must be NOT NULL
-- - Only pending (not posted, not settled) rows are selectable
-- ============================================================================

CREATE OR REPLACE VIEW view_postable_picks_v1_2 AS
SELECT
  up.id AS pick_id,
  up.bet_slip_id,
  up.user_id AS capper_id,
  up.sport,
  up.league,
  up.ticket_type,
  up.leg_index,
  up.stat_type AS market_type,
  up.bet_type,
  up.selection,
  up.line,
  up.odds,
  up.side AS direction,
  up.tier,
  up.promotion_band,
  up.confidence,
  up.player_id,
  up.player_name,
  up.team_id,
  up.team,
  up.matchup,
  up.game_date,
  up.game_time,
  up.manual_matchup_home,
  up.manual_matchup_away,
  up.manual_game_date,
  up.manual_fields_blob,
  up.meta,
  up.source,
  up.is_live,
  up.posted_to_discord,
  up.discord_message_id,
  up.settlement_status,
  up.created_at,
  up.updated_at,
  -- Provider fields (denormalized for embed builder)
  up.provider_id,
  pr.code AS provider_code,
  pr.display_name AS provider_display_name
FROM unified_picks up
INNER JOIN provider_registry pr ON up.provider_id = pr.id
WHERE
  -- ============================================
  -- HARD FIELD REQUIREMENTS (Contract v1.2)
  -- ============================================
  up.provider_id IS NOT NULL
  AND pr.code != 'UNKNOWN_LEGACY'  -- Legacy rows are NOT postable
  AND pr.active = true             -- Only active providers
  AND up.user_id IS NOT NULL       -- capper_id required
  AND up.odds IS NOT NULL          -- odds required
  AND up.selection IS NOT NULL     -- selection required
  AND up.tier IS NOT NULL          -- tier required
  AND up.sport IS NOT NULL         -- sport required
  -- unit_amount: Accept if any of these exist
  AND (up.meta->>'unit_size' IS NOT NULL
       OR up.meta->>'units' IS NOT NULL
       OR up.meta->>'total_units' IS NOT NULL
       OR up.confidence IS NOT NULL)
  -- matchup: Accept if any matchup source exists
  AND (up.matchup IS NOT NULL
       OR (up.manual_matchup_home IS NOT NULL AND up.manual_matchup_away IS NOT NULL)
       OR up.manual_fields_blob->>'matchup' IS NOT NULL
       OR up.meta->>'matchup' IS NOT NULL)
  -- ============================================
  -- ELIGIBILITY REQUIREMENTS
  -- ============================================
  AND up.posted_to_discord = false
  AND up.settlement_status = 'pending'
  AND (up.blocked_reason IS NULL OR up.blocked_reason = '');

COMMENT ON VIEW view_postable_picks_v1_2 IS
  'SPRINT-108B: Canonical postable picks selector. Enforces Discord Contract v1.2 hard fields.
   ALL posting paths MUST query this view, NOT unified_picks directly.
   UNKNOWN_LEGACY provider rows are explicitly excluded.';

-- ============================================================================
-- 5. UPDATE OUTBOX STATUS CONSTRAINT
-- Add blocked_contract status (TERMINAL - never retry)
-- ============================================================================

ALTER TABLE ticket_discord_outbox
  DROP CONSTRAINT IF EXISTS ticket_discord_outbox_status_check;

ALTER TABLE ticket_discord_outbox
  ADD CONSTRAINT ticket_discord_outbox_status_check
  CHECK (status IN ('pending', 'processing', 'posted', 'failed', 'blocked_contract'));

-- Add missing_fields column for contract violation tracking
ALTER TABLE ticket_discord_outbox
  ADD COLUMN IF NOT EXISTS missing_fields TEXT[];

-- Add contract_violation_at timestamp
ALTER TABLE ticket_discord_outbox
  ADD COLUMN IF NOT EXISTS contract_violation_at TIMESTAMPTZ;

-- Index for blocked_contract rows (analytics)
CREATE INDEX IF NOT EXISTS idx_ticket_discord_outbox_blocked
  ON ticket_discord_outbox(contract_violation_at)
  WHERE status = 'blocked_contract';

COMMENT ON COLUMN ticket_discord_outbox.missing_fields IS
  'SPRINT-108B: Array of missing hard fields when status = blocked_contract.';

COMMENT ON COLUMN ticket_discord_outbox.contract_violation_at IS
  'SPRINT-108B: Timestamp when contract violation was detected.';

-- ============================================================================
-- 6. CREATE HELPER FUNCTION: GET PROVIDER BY ID
-- For embed builder to resolve provider display name
-- ============================================================================

CREATE OR REPLACE FUNCTION get_provider_display(p_provider_id INTEGER)
RETURNS TABLE (
  code TEXT,
  display_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT pr.code, pr.display_name
  FROM provider_registry pr
  WHERE pr.id = p_provider_id AND pr.active = true;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_provider_display IS
  'SPRINT-108B: Get provider display info by ID. Returns NULL for inactive providers.';

-- ============================================================================
-- 7. GRANTS
-- ============================================================================

GRANT SELECT ON view_postable_picks_v1_2 TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_provider_display TO authenticated, anon, service_role;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (manual execution if needed):
-- ============================================================================
-- DROP VIEW IF EXISTS view_postable_picks_v1_2;
-- DROP FUNCTION IF EXISTS get_provider_display(INTEGER);
-- ALTER TABLE unified_picks DROP COLUMN IF EXISTS provider_id;
-- DROP INDEX IF EXISTS idx_unified_picks_provider_id;
-- DROP INDEX IF EXISTS idx_unified_picks_provider_settlement;
-- ALTER TABLE ticket_discord_outbox DROP COLUMN IF EXISTS missing_fields;
-- ALTER TABLE ticket_discord_outbox DROP COLUMN IF EXISTS contract_violation_at;
-- DROP INDEX IF EXISTS idx_ticket_discord_outbox_blocked;
-- ALTER TABLE ticket_discord_outbox DROP CONSTRAINT IF EXISTS ticket_discord_outbox_status_check;
-- ALTER TABLE ticket_discord_outbox ADD CONSTRAINT ticket_discord_outbox_status_check
--   CHECK (status IN ('pending', 'processing', 'posted', 'failed'));
-- DELETE FROM provider_registry WHERE code = 'UNKNOWN_LEGACY';

-- ============================================================================
-- END OF MIGRATION
-- Sprint: SPRINT-DISCORD-CONTRACT-BOOK-ENFORCEMENT-108B
-- Columns Added: 3 (provider_id on unified_picks, missing_fields + contract_violation_at on outbox)
-- Views Created: 1 (view_postable_picks_v1_2)
-- Functions Created: 1 (get_provider_display)
-- ============================================================================
