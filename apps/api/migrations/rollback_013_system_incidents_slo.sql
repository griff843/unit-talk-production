-- =============================================================================
-- ROLLBACK: SYSTEM_INCIDENTS SLO Monitoring and Alerting
-- Purpose: Safe rollback procedures for incident management system
-- =============================================================================

-- 1) Drop all triggers first (in reverse dependency order)
DROP TRIGGER IF EXISTS trg_slo_definitions_updated_at ON slo_definitions;
DROP TRIGGER IF EXISTS trg_system_incidents_updated_at ON system_incidents;
DROP TRIGGER IF EXISTS trg_incident_status_change ON system_incidents;

-- 2) Drop functions (in reverse dependency order)
DROP FUNCTION IF EXISTS incident_status_change_trigger();
DROP FUNCTION IF EXISTS escalate_stale_incidents();
DROP FUNCTION IF EXISTS check_slo_violations();

-- 3) Drop views
DROP VIEW IF EXISTS active_incidents_monitor;
DROP VIEW IF EXISTS incident_metrics_dashboard;

-- 4) Revoke permissions
REVOKE ALL ON system_incidents FROM api_service;
REVOKE ALL ON incident_timeline FROM api_service;
REVOKE ALL ON slo_definitions FROM api_service;
REVOKE ALL ON slo_measurements FROM api_service;
REVOKE USAGE ON SEQUENCE incident_sequence FROM api_service;
REVOKE ALL ON incident_metrics_dashboard FROM monitoring_service;
REVOKE ALL ON active_incidents_monitor FROM monitoring_service;

-- 5) Drop all indexes
-- System incidents indexes
DROP INDEX IF EXISTS idx_system_incidents_status_severity;
DROP INDEX IF EXISTS idx_system_incidents_start_time;
DROP INDEX IF EXISTS idx_system_incidents_affected_services_gin;
DROP INDEX IF EXISTS idx_system_incidents_slo_violations;

-- Incident timeline indexes
DROP INDEX IF EXISTS idx_incident_timeline_recent;

-- SLO measurements indexes
DROP INDEX IF EXISTS idx_slo_measurements_recent;
DROP INDEX IF EXISTS idx_slo_measurements_breaches;

-- 6) Delete sample data first to avoid foreign key constraints
DELETE FROM slo_definitions WHERE slo_name IN (
  'API Response Time', 'Database Query Performance', 'Prop Grading Throughput',
  'Discord Bot Availability', 'Data Feed Freshness'
);

-- 7) Drop foreign key constraints (if needed)
ALTER TABLE IF EXISTS incident_timeline DROP CONSTRAINT IF EXISTS incident_timeline_incident_id_fkey;
ALTER TABLE IF EXISTS incident_timeline DROP CONSTRAINT IF EXISTS incident_timeline_performed_by_fkey;

ALTER TABLE IF EXISTS slo_measurements DROP CONSTRAINT IF EXISTS slo_measurements_slo_definition_id_fkey;
ALTER TABLE IF EXISTS slo_measurements DROP CONSTRAINT IF EXISTS slo_measurements_incident_created_fkey;

ALTER TABLE IF EXISTS system_incidents DROP CONSTRAINT IF EXISTS system_incidents_assigned_to_fkey;
ALTER TABLE IF EXISTS system_incidents DROP CONSTRAINT IF EXISTS system_incidents_reporter_id_fkey;
ALTER TABLE IF EXISTS system_incidents DROP CONSTRAINT IF EXISTS system_incidents_escalated_to_fkey;

-- 8) Drop check constraints
ALTER TABLE IF EXISTS system_incidents DROP CONSTRAINT IF EXISTS chk_time_sequence;
ALTER TABLE IF EXISTS system_incidents DROP CONSTRAINT IF EXISTS chk_slo_values;

ALTER TABLE IF EXISTS slo_measurements DROP CONSTRAINT IF EXISTS uq_slo_measurement;

-- 9) Drop unique constraints
ALTER TABLE IF EXISTS system_incidents DROP CONSTRAINT IF EXISTS system_incidents_incident_id_key;
ALTER TABLE IF EXISTS slo_definitions DROP CONSTRAINT IF EXISTS slo_definitions_slo_name_key;
ALTER TABLE IF EXISTS incident_timeline DROP CONSTRAINT IF EXISTS uq_incident_timeline_order;

-- 10) Drop tables in correct dependency order
DROP TABLE IF EXISTS slo_measurements CASCADE;
DROP TABLE IF EXISTS incident_timeline CASCADE;
DROP TABLE IF EXISTS slo_definitions CASCADE;
DROP TABLE IF EXISTS system_incidents CASCADE;

-- 11) Drop sequences
DROP SEQUENCE IF EXISTS incident_sequence CASCADE;

-- 12) Drop extensions if not used by other objects (optional - commented for safety)
-- DROP EXTENSION IF EXISTS pg_trgm;
-- DROP EXTENSION IF EXISTS btree_gin;

-- 13) Clean up any enum types that might have been created
-- (None were created in this migration)

-- =============================================================================
-- ROLLBACK VERIFICATION QUERIES
-- =============================================================================
-- Run these queries to verify complete rollback:

-- Verify tables are dropped
-- SELECT COUNT(*) FROM information_schema.tables 
-- WHERE table_name IN ('system_incidents', 'incident_timeline', 'slo_definitions', 'slo_measurements');

-- Verify functions are dropped
-- SELECT COUNT(*) FROM pg_proc 
-- WHERE proname IN ('check_slo_violations', 'escalate_stale_incidents', 'incident_status_change_trigger');

-- Verify indexes are dropped
-- SELECT COUNT(*) FROM pg_indexes 
-- WHERE indexname LIKE '%incident%' OR indexname LIKE '%slo_%';

-- Verify views are dropped
-- SELECT COUNT(*) FROM information_schema.views 
-- WHERE table_name IN ('active_incidents_monitor', 'incident_metrics_dashboard');

-- Verify triggers are dropped
-- SELECT COUNT(*) FROM information_schema.triggers 
-- WHERE trigger_name LIKE '%incident%' OR trigger_name LIKE '%slo%';

-- Verify sequences are dropped
-- SELECT COUNT(*) FROM information_schema.sequences WHERE sequence_name = 'incident_sequence';

-- =============================================================================
-- ROLLBACK COMPLETE
-- =============================================================================