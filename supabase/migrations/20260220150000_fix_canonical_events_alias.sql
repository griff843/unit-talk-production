-- ============================================================================
-- FIX: canonical_events alias view
-- Sprint: SPRINT-SMARTFORM-UX-REBUILD-080
-- Date: 2026-02-20
--
-- BUG: atomic_submit_ticket_v2 references `canonical_events` table but only
-- `events` table exists. This creates an alias view to fix the reference.
--
-- Rollback: DROP VIEW IF EXISTS canonical_events;
-- ============================================================================

-- Create alias view for events table
-- This allows atomic_submit_ticket_v2 to work without modifying the RPC
CREATE OR REPLACE VIEW canonical_events AS
SELECT * FROM events;

COMMENT ON VIEW canonical_events IS 'Alias for events table. Fixes reference in atomic_submit_ticket_v2. V3 bugfix.';

-- ============================================================================
-- END OF MIGRATION
-- Sprint: SPRINT-SMARTFORM-UX-REBUILD-080
-- FIX: canonical_events alias view created
-- ============================================================================
