-- SPRINT-044G: Relax NOT NULL constraints on legacy event-sourcing columns
-- The events table was originally an event-sourcing table with aggregate_id,
-- aggregate_type, event_data as NOT NULL. The V3 catalog uses events as a
-- sports-event catalog (external_id, sport, league, scheduled_at). The
-- auto_create_event_for_ingestion function inserts V3-style rows without
-- providing legacy columns, causing NOT NULL violations.
--
-- This migration makes legacy columns nullable so both old event-sourcing
-- rows (which have aggregate_id etc.) and new V3 catalog rows (which don't)
-- can coexist.
--
-- Rollback:
-- ALTER TABLE events ALTER COLUMN aggregate_id SET NOT NULL;
-- ALTER TABLE events ALTER COLUMN aggregate_type SET NOT NULL;
-- ALTER TABLE events ALTER COLUMN event_type SET NOT NULL;

ALTER TABLE events ALTER COLUMN aggregate_id DROP NOT NULL;
ALTER TABLE events ALTER COLUMN aggregate_type DROP NOT NULL;
ALTER TABLE events ALTER COLUMN event_type DROP NOT NULL;
