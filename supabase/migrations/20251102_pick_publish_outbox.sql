-- ===============================================================================
-- Pick Publish Outbox Table
-- Date: 2025-11-02
-- Purpose: Outbox pattern for reliable Discord publishing
-- ===============================================================================

-- ===============================================================================
-- PICK_PUBLISH TABLE - Outbox for Discord publishing
-- ===============================================================================
CREATE TABLE IF NOT EXISTS pick_publish (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID NOT NULL REFERENCES picks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Publishing Details
  channel TEXT NOT NULL DEFAULT 'DISCORD' CHECK (channel IN ('DISCORD', 'WEBHOOK', 'EMAIL')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),

  -- Discord Integration
  thread_id TEXT,
  external_message_id TEXT,
  discord_channel_id TEXT,

  -- Retry Logic
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,

  -- Scheduling
  scheduled_for TIMESTAMPTZ,

  -- Delivery Tracking
  sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_pick_publish_pick_id ON pick_publish(pick_id);
CREATE INDEX IF NOT EXISTS idx_pick_publish_status ON pick_publish(tenant_id, status, created_at DESC) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_pick_publish_next_retry ON pick_publish(next_retry_at) WHERE status = 'failed' AND attempts < max_attempts;
CREATE INDEX IF NOT EXISTS idx_pick_publish_scheduled ON pick_publish(scheduled_for) WHERE status = 'pending' AND scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pick_publish_channel ON pick_publish(tenant_id, channel, status);

-- RLS Policy
ALTER TABLE pick_publish ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pick Publish: Tenant isolation"
  ON pick_publish FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "Pick Publish: Service role full access"
  ON pick_publish FOR ALL
  USING (current_setting('role', true) = 'service_role');

-- Function to update pick_publish status
CREATE OR REPLACE FUNCTION update_pick_publish_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();

  -- Track sent time when status changes to sent
  IF NEW.status = 'sent' AND OLD.status != 'sent' THEN
    NEW.sent_at = NOW();
  END IF;

  -- Increment attempts on retry
  IF NEW.status = 'processing' AND OLD.status = 'failed' THEN
    NEW.attempts = OLD.attempts + 1;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_pick_publish_status
  BEFORE UPDATE ON pick_publish
  FOR EACH ROW
  EXECUTE FUNCTION update_pick_publish_status();

-- Comments
COMMENT ON TABLE pick_publish IS 'Outbox pattern for reliable Discord publishing with retry logic';
COMMENT ON COLUMN pick_publish.status IS 'Publishing status: pending, processing, sent, failed, cancelled';
COMMENT ON COLUMN pick_publish.attempts IS 'Number of delivery attempts (max 3 by default)';
COMMENT ON COLUMN pick_publish.next_retry_at IS 'Timestamp for next retry attempt (exponential backoff)';

-- ===============================================================================
-- END OF MIGRATION
-- ===============================================================================

-- ============================================================================
-- FORCE POSTGREST SCHEMA RELOAD (Charter-mandated)
-- ============================================================================
-- Trigger PostgREST to reload its schema cache
-- This ensures canonical tables are immediately visible via REST API
SELECT pg_notify('pgrst', 'reload schema');
