-- Phase 3: Alert Events Table Migration
-- Creates alert_events table for SLO alert history and tracking

-- =============================================================================
-- Alert Events Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fingerprint TEXT NOT NULL,
  slo_name TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  current_value NUMERIC,
  threshold NUMERIC NOT NULL,
  data_source TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_alert_events_created_at
  ON alert_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_events_fingerprint
  ON alert_events(fingerprint);

CREATE INDEX IF NOT EXISTS idx_alert_events_slo_name
  ON alert_events(slo_name);

CREATE INDEX IF NOT EXISTS idx_alert_events_severity
  ON alert_events(severity);

CREATE INDEX IF NOT EXISTS idx_alert_events_acknowledged
  ON alert_events(acknowledged)
  WHERE NOT acknowledged;

CREATE INDEX IF NOT EXISTS idx_alert_events_resolved
  ON alert_events(resolved)
  WHERE NOT resolved;

-- =============================================================================
-- Updated At Trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION update_alert_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER alert_events_updated_at
  BEFORE UPDATE ON alert_events
  FOR EACH ROW
  EXECUTE FUNCTION update_alert_events_updated_at();

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to alert_events"
  ON alert_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read alert_events
CREATE POLICY "Authenticated users can read alert_events"
  ON alert_events
  FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================================
-- Cleanup Function (optional - for automatic old alert cleanup)
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_alert_events(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM alert_events
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL
    AND resolved = TRUE;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_alert_events IS
  'Cleans up resolved alert events older than specified days (default 30 days)';

-- =============================================================================
-- Comments for Documentation
-- =============================================================================

COMMENT ON TABLE alert_events IS
  'Stores SLO alert history for tracking, acknowledgement, and resolution';

COMMENT ON COLUMN alert_events.fingerprint IS
  'Unique identifier for deduplication (e.g., slo:ingestion_freshness:FAIL)';

COMMENT ON COLUMN alert_events.slo_name IS
  'Name of the SLO that triggered the alert';

COMMENT ON COLUMN alert_events.severity IS
  'Alert severity level: info, warning, or critical';

COMMENT ON COLUMN alert_events.current_value IS
  'Measured value that violated the SLO threshold';

COMMENT ON COLUMN alert_events.threshold IS
  'SLO threshold value that was exceeded';

COMMENT ON COLUMN alert_events.data_source IS
  'Source of the data: local_postgres, supabase, or both';

COMMENT ON COLUMN alert_events.metadata IS
  'Additional context data for the alert (JSONB format)';

COMMENT ON COLUMN alert_events.acknowledged IS
  'Whether alert has been acknowledged by operator';

COMMENT ON COLUMN alert_events.resolved IS
  'Whether the underlying issue has been resolved';
