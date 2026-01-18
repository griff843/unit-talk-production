-- ===============================================================================
-- Add CANARY Channel Support for Live-Fire Testing
-- Date: 2025-12-03
-- Purpose: Enable CANARY channel type for isolated production testing
-- ===============================================================================

-- Update pick_publish channel CHECK constraint to include 'CANARY'
ALTER TABLE pick_publish
  DROP CONSTRAINT IF EXISTS pick_publish_channel_check;

ALTER TABLE pick_publish
  ADD CONSTRAINT pick_publish_channel_check
  CHECK (channel IN ('DISCORD', 'CANARY', 'WEBHOOK', 'EMAIL'));

-- Add comment explaining CANARY channel
COMMENT ON COLUMN pick_publish.channel IS 'Publishing channel: DISCORD (production), CANARY (testing), WEBHOOK (HTTP), EMAIL';

-- ===============================================================================
-- END OF MIGRATION
-- ===============================================================================
