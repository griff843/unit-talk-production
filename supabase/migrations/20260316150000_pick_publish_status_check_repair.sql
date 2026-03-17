-- Migration: Repair pick_publish status CHECK constraint
-- Sprint: SPRINT-062-FULL-LIFECYCLE-E2E-TRUTH-AUDIT
-- Context: The pick_publish_status_check constraint does not include 'posted' as a valid
--          status value, but publishOutbox.ts markPublished() sets status='posted'.
--          This blocks all outbox receipt writes after Discord posting succeeds.
--          The code canonical status values are: pending, posted, failed
-- Rollback:
--   ALTER TABLE pick_publish DROP CONSTRAINT IF EXISTS pick_publish_status_check;
--   ALTER TABLE pick_publish ADD CONSTRAINT pick_publish_status_check
--     CHECK (status IN ('pending', 'sent', 'failed'));

ALTER TABLE pick_publish DROP CONSTRAINT IF EXISTS pick_publish_status_check;
ALTER TABLE pick_publish ADD CONSTRAINT pick_publish_status_check
  CHECK (status IN ('pending', 'sent', 'posted', 'failed', 'processing'));
