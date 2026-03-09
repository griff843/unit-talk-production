-- SPRINT-044G: Add meta column to events (patch)
-- This was missed in 20260308120000; added separately to preserve migration history.
--
-- Rollback: ALTER TABLE events DROP COLUMN IF EXISTS meta;

ALTER TABLE events ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::JSONB;
