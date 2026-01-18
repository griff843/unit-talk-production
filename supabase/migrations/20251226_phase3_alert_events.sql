-- ============================================================================
-- Phase 3: Alert Events Table
-- Created: 2025-12-26
-- Purpose: Store alert history for SLO violations
-- ============================================================================

-- Create alert_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL,
  slo_name TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  current_value NUMERIC,
  threshold NUMERIC NOT NULL,
  data_source TEXT NOT NULL CHECK (data_source IN ('local_postgres', 'supabase', 'both')),
  metadata JSONB DEFAULT '{}'::jsonb,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_alert_events_created_at
  ON public.alert_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_events_fingerprint
  ON public.alert_events(fingerprint);

CREATE INDEX IF NOT EXISTS idx_alert_events_slo_name
  ON public.alert_events(slo_name);

CREATE INDEX IF NOT EXISTS idx_alert_events_severity
  ON public.alert_events(severity);

CREATE INDEX IF NOT EXISTS idx_alert_events_acknowledged
  ON public.alert_events(acknowledged)
  WHERE acknowledged = FALSE;

CREATE INDEX IF NOT EXISTS idx_alert_events_resolved
  ON public.alert_events(resolved)
  WHERE resolved = FALSE;

-- Create updated_at trigger function if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_updated_at_column'
    AND pronamespace = 'public'::regnamespace
  ) THEN
    CREATE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END$$;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_alert_events_updated_at ON public.alert_events;
CREATE TRIGGER update_alert_events_updated_at
  BEFORE UPDATE ON public.alert_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for service role (full access)
DROP POLICY IF EXISTS "Service role has full access to alert_events" ON public.alert_events;
CREATE POLICY "Service role has full access to alert_events"
  ON public.alert_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create RLS policy for authenticated users (read-only)
DROP POLICY IF EXISTS "Authenticated users can read alert_events" ON public.alert_events;
CREATE POLICY "Authenticated users can read alert_events"
  ON public.alert_events
  FOR SELECT
  TO authenticated
  USING (true);

-- Grant permissions
GRANT ALL ON public.alert_events TO service_role;
GRANT SELECT ON public.alert_events TO authenticated;
GRANT SELECT ON public.alert_events TO anon;

-- Add helpful comments
COMMENT ON TABLE public.alert_events IS 'Phase 3: Alert history for SLO violations';
COMMENT ON COLUMN public.alert_events.fingerprint IS 'Unique identifier for deduplication (e.g., slo:retry_exhaustion:FAIL)';
COMMENT ON COLUMN public.alert_events.slo_name IS 'Name of the SLO that triggered the alert';
COMMENT ON COLUMN public.alert_events.severity IS 'Alert severity: info, warning, or critical';
COMMENT ON COLUMN public.alert_events.acknowledged IS 'Whether the alert has been acknowledged by an operator';
COMMENT ON COLUMN public.alert_events.resolved IS 'Whether the underlying issue has been resolved';
