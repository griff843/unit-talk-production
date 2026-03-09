-- SPRINT-044G: Relax NOT NULL on event_data column
-- Same rationale as 20260308130000 — auto_create_event_for_ingestion
-- inserts V3-style rows that don't use the legacy event_data JSONB column.
--
-- Rollback: ALTER TABLE events ALTER COLUMN event_data SET NOT NULL;

ALTER TABLE events ALTER COLUMN event_data DROP NOT NULL;
