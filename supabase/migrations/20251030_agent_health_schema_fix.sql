-- ============================================================================
-- Agent Health Schema Standardization Migration
-- Date: 2025-10-30
-- Charter: v3.0
-- Purpose: Fix agent_health schema mismatch across environments
-- ============================================================================

-- Drop existing agent_health table if it exists (idempotent)
DROP TABLE IF EXISTS public.agent_health CASCADE;

-- Create standardized agent_health table
CREATE TABLE IF NOT EXISTS public.agent_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Agent identification
  agent VARCHAR(100) NOT NULL UNIQUE,
  
  -- Health status
  status VARCHAR(20) NOT NULL DEFAULT 'unknown' 
    CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'idle', 'unknown')),
  
  -- Timing information
  last_check TIMESTAMPTZ DEFAULT NOW(),
  last_run TIMESTAMPTZ DEFAULT NOW(),
  
  -- Performance metrics
  total_operations INTEGER DEFAULT 0,
  response_time_ms INTEGER DEFAULT 0,
  
  -- Error tracking
  error_message TEXT,
  
  -- Additional details (JSONB for flexibility)
  details JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_health_agent ON public.agent_health(agent);
CREATE INDEX IF NOT EXISTS idx_agent_health_status ON public.agent_health(status);
CREATE INDEX IF NOT EXISTS idx_agent_health_last_check ON public.agent_health(last_check DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_agent_health_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_health_updated_at_trigger ON public.agent_health;
CREATE TRIGGER agent_health_updated_at_trigger
  BEFORE UPDATE ON public.agent_health
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_health_updated_at();

-- Insert default agent health records for known agents
INSERT INTO public.agent_health (agent, status, details) VALUES
  ('GradingAgent', 'idle', '{"description": "Automated pick grading and settlement"}'),
  ('AlertAgent', 'idle', '{"description": "Real-time injury, hedge, and middle alerts"}'),
  ('BridgeWorker', 'idle', '{"description": "Event-driven bridge outbox processor"}'),
  ('FeedAgent', 'idle', '{"description": "Market data ingestion from APIs"}'),
  ('AnalyticsAgent', 'idle', '{"description": "Performance analytics and reporting"}')
ON CONFLICT (agent) DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.agent_health TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.agent_health TO service_role;

-- Add comment
COMMENT ON TABLE public.agent_health IS 'Standardized agent health monitoring table per Charter v3.0 - tracks status, performance, and errors for all system agents';

-- Reload PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');

