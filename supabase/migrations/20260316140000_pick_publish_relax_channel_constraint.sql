-- Migration: Relax pick_publish.channel CHECK constraint
-- Sprint: SPRINT-062-FULL-LIFECYCLE-E2E-TRUTH-AUDIT
-- Context: The pick_publish_channel_check constraint only allowed uppercase values
--          (DISCORD, EMAIL, WEBHOOK). The publishOutbox.ts integration uses descriptive
--          channel names like 'system-picks', 'capper', 'legacy-picks'. The constraint
--          is too restrictive and blocks canonical Discord posting flow.
-- Rollback:
--   ALTER TABLE pick_publish ADD CONSTRAINT pick_publish_channel_check
--     CHECK (channel IN ('DISCORD', 'EMAIL', 'WEBHOOK'));

ALTER TABLE pick_publish DROP CONSTRAINT IF EXISTS pick_publish_channel_check;
