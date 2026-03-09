-- SPRINT-044G: Relax NOT NULL on idempotency_key column
-- Same rationale as 20260308130000 — V3 catalog inserts don't use
-- legacy event-sourcing columns.
--
-- Rollback: ALTER TABLE events ALTER COLUMN idempotency_key SET NOT NULL;

ALTER TABLE events ALTER COLUMN idempotency_key DROP NOT NULL;
