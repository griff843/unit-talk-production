-- =============================================================================
-- ROLLBACK: TICKET STATE MANAGEMENT Leg-Aware Betting System
-- Purpose: Safe rollback procedures for ticket state management tables
-- =============================================================================

-- 1) Drop all triggers first (in reverse dependency order)
DROP TRIGGER IF EXISTS trg_ticket_leg_status_change ON ticket_legs;
DROP TRIGGER IF EXISTS trg_ticket_legs_updated_at ON ticket_legs;
DROP TRIGGER IF EXISTS trg_betting_tickets_updated_at ON betting_tickets;

-- 2) Drop functions (in reverse dependency order)
DROP FUNCTION IF EXISTS ticket_leg_status_trigger();
DROP FUNCTION IF EXISTS detect_hedge_opportunities(NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS update_ticket_state(UUID, TEXT);

-- 3) Drop views
DROP VIEW IF EXISTS active_tickets_monitor;

-- 4) Revoke permissions
REVOKE ALL ON betting_tickets FROM api_service;
REVOKE ALL ON ticket_legs FROM api_service;
REVOKE ALL ON ticket_state_log FROM api_service;
REVOKE ALL ON active_tickets_monitor FROM monitoring_service;

-- 5) Drop all indexes
-- Betting tickets indexes
DROP INDEX IF EXISTS idx_betting_tickets_user_state;
DROP INDEX IF EXISTS idx_betting_tickets_live_tracking;
DROP INDEX IF EXISTS idx_betting_tickets_hedge_window;
DROP INDEX IF EXISTS idx_betting_tickets_hedge_gin;
DROP INDEX IF EXISTS idx_betting_tickets_state_history_gin;

-- Ticket legs indexes
DROP INDEX IF EXISTS idx_ticket_legs_status;
DROP INDEX IF EXISTS idx_ticket_legs_game_tracking;
DROP INDEX IF EXISTS idx_ticket_legs_odds_movement_gin;

-- State log indexes
DROP INDEX IF EXISTS idx_ticket_state_log_recent;

-- 6) Drop foreign key constraints (if needed)
-- These should be handled by CASCADE, but explicit removal for safety
ALTER TABLE IF EXISTS ticket_legs DROP CONSTRAINT IF EXISTS ticket_legs_ticket_id_fkey;
ALTER TABLE IF EXISTS ticket_legs DROP CONSTRAINT IF EXISTS ticket_legs_unified_pick_id_fkey;
ALTER TABLE IF EXISTS ticket_legs DROP CONSTRAINT IF EXISTS ticket_legs_prop_id_fkey;
ALTER TABLE IF EXISTS ticket_legs DROP CONSTRAINT IF EXISTS ticket_legs_game_id_fkey;

ALTER TABLE IF EXISTS ticket_state_log DROP CONSTRAINT IF EXISTS ticket_state_log_ticket_id_fkey;

ALTER TABLE IF EXISTS betting_tickets DROP CONSTRAINT IF EXISTS betting_tickets_user_id_fkey;

-- 7) Drop check constraints
ALTER TABLE IF EXISTS betting_tickets DROP CONSTRAINT IF EXISTS chk_legs_consistency;
ALTER TABLE IF EXISTS betting_tickets DROP CONSTRAINT IF EXISTS chk_financial_values;
ALTER TABLE IF EXISTS betting_tickets DROP CONSTRAINT IF EXISTS chk_probabilities;

ALTER TABLE IF EXISTS ticket_legs DROP CONSTRAINT IF EXISTS uq_ticket_leg;

-- 8) Drop unique constraints
ALTER TABLE IF EXISTS betting_tickets DROP CONSTRAINT IF EXISTS betting_tickets_ticket_id_key;

-- 9) Drop tables in correct dependency order
DROP TABLE IF EXISTS ticket_state_log CASCADE;
DROP TABLE IF EXISTS ticket_legs CASCADE;
DROP TABLE IF EXISTS betting_tickets CASCADE;

-- 10) Drop extensions if not used by other objects (optional - commented for safety)
-- DROP EXTENSION IF EXISTS pg_trgm;
-- DROP EXTENSION IF EXISTS btree_gist;

-- 11) Clean up any enum types that might have been created
-- (None were created in this migration)

-- =============================================================================
-- ROLLBACK VERIFICATION QUERIES
-- =============================================================================
-- Run these queries to verify complete rollback:

-- Verify tables are dropped
-- SELECT COUNT(*) FROM information_schema.tables 
-- WHERE table_name IN ('betting_tickets', 'ticket_legs', 'ticket_state_log');

-- Verify functions are dropped
-- SELECT COUNT(*) FROM pg_proc 
-- WHERE proname IN ('update_ticket_state', 'detect_hedge_opportunities', 'ticket_leg_status_trigger');

-- Verify indexes are dropped
-- SELECT COUNT(*) FROM pg_indexes 
-- WHERE indexname LIKE '%betting_tickets%' OR indexname LIKE '%ticket_legs%' OR indexname LIKE '%ticket_state%';

-- Verify views are dropped
-- SELECT COUNT(*) FROM information_schema.views WHERE table_name = 'active_tickets_monitor';

-- Verify triggers are dropped
-- SELECT COUNT(*) FROM information_schema.triggers 
-- WHERE trigger_name LIKE '%ticket%' OR trigger_name LIKE '%betting%';

-- =============================================================================
-- ROLLBACK COMPLETE
-- =============================================================================