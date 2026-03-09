-- SPRINT-044G: Add V3 catalog columns to legacy events table
-- The V3 foundation migration (20260220100000) used CREATE TABLE IF NOT EXISTS events,
-- which was a no-op because the old event-sourcing events table already existed.
-- This ALTERs the existing table to add the V3 columns needed by auto_create_event_for_ingestion.
--
-- Rollback:
-- ALTER TABLE events DROP COLUMN IF EXISTS external_id;
-- ALTER TABLE events DROP COLUMN IF EXISTS sport;
-- ALTER TABLE events DROP COLUMN IF EXISTS league;
-- ALTER TABLE events DROP COLUMN IF EXISTS scheduled_at;
-- ALTER TABLE events DROP COLUMN IF EXISTS status;
-- ALTER TABLE events DROP COLUMN IF EXISTS home_participant_id;
-- ALTER TABLE events DROP COLUMN IF EXISTS away_participant_id;
-- ALTER TABLE events DROP COLUMN IF EXISTS source;
-- ALTER TABLE events DROP COLUMN IF EXISTS meta;

ALTER TABLE events ADD COLUMN IF NOT EXISTS external_id TEXT UNIQUE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS sport TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS league TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';
ALTER TABLE events ADD COLUMN IF NOT EXISTS home_participant_id UUID REFERENCES participants(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS away_participant_id UUID REFERENCES participants(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::JSONB;
