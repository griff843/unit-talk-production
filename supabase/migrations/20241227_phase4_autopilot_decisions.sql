-- Phase 4: Autopilot Decisions Table
-- Records all autopilot evaluation decisions in log_only mode
-- Enables daily reporting and decision analysis

CREATE TABLE IF NOT EXISTS public.autopilot_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Execution context
  mode TEXT NOT NULL CHECK (mode IN ('off', 'log_only', 'canary', 'prod')),
  evaluation_run_id UUID NOT NULL, -- Groups decisions from same evaluation run
  evaluated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Pick being evaluated
  pick_id UUID, -- Reference to picks table (may be null in log_only)
  pick_data JSONB NOT NULL, -- Complete pick snapshot for analysis

  -- Decision outcome
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'unknown')),
  decision_reason TEXT NOT NULL,

  -- Risk assessment results
  risk_score NUMERIC(5,2), -- 0.00 to 100.00
  risk_factors JSONB DEFAULT '[]'::jsonb, -- Array of risk factors detected

  -- Staleness checks
  data_age_minutes INTEGER,
  odds_staleness_minutes INTEGER,
  is_stale BOOLEAN DEFAULT FALSE,

  -- Publishing decision (what would have happened)
  would_publish BOOLEAN NOT NULL DEFAULT FALSE,
  publish_channel TEXT, -- 'discord', 'db', 'both', null
  publish_blocked_reason TEXT,

  -- SLO context at time of decision
  slo_snapshot JSONB, -- SLO status at time of evaluation

  -- Execution metadata
  execution_time_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_autopilot_decisions_evaluated_at
  ON public.autopilot_decisions(evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_autopilot_decisions_run_id
  ON public.autopilot_decisions(evaluation_run_id);

CREATE INDEX IF NOT EXISTS idx_autopilot_decisions_decision
  ON public.autopilot_decisions(decision);

CREATE INDEX IF NOT EXISTS idx_autopilot_decisions_mode
  ON public.autopilot_decisions(mode);

CREATE INDEX IF NOT EXISTS idx_autopilot_decisions_would_publish
  ON public.autopilot_decisions(would_publish);

-- Composite index for daily reporting queries
CREATE INDEX IF NOT EXISTS idx_autopilot_decisions_daily_report
  ON public.autopilot_decisions(evaluated_at DESC, decision, would_publish);

-- Row Level Security
ALTER TABLE public.autopilot_decisions ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access to autopilot_decisions"
  ON public.autopilot_decisions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.autopilot_decisions TO service_role;

-- Create function to get daily autopilot report
CREATE OR REPLACE FUNCTION public.get_daily_autopilot_report(
  report_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_evaluated BIGINT,
  approved_count BIGINT,
  rejected_count BIGINT,
  unknown_count BIGINT,
  would_publish_count BIGINT,
  avg_risk_score NUMERIC,
  stale_count BIGINT,
  rejection_reasons JSONB,
  avg_execution_time_ms NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_evaluated,
    COUNT(*) FILTER (WHERE decision = 'approved')::BIGINT as approved_count,
    COUNT(*) FILTER (WHERE decision = 'rejected')::BIGINT as rejected_count,
    COUNT(*) FILTER (WHERE decision = 'unknown')::BIGINT as unknown_count,
    COUNT(*) FILTER (WHERE would_publish = true)::BIGINT as would_publish_count,
    AVG(risk_score) as avg_risk_score,
    COUNT(*) FILTER (WHERE is_stale = true)::BIGINT as stale_count,
    jsonb_agg(
      DISTINCT jsonb_build_object('reason', decision_reason, 'count', 1)
    ) FILTER (WHERE decision = 'rejected') as rejection_reasons,
    AVG(execution_time_ms) as avg_execution_time_ms
  FROM public.autopilot_decisions
  WHERE DATE(evaluated_at) = report_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get autopilot timeline for last N hours
CREATE OR REPLACE FUNCTION public.get_autopilot_timeline(
  hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
  hour_bucket TIMESTAMPTZ,
  evaluated_count BIGINT,
  approved_count BIGINT,
  rejected_count BIGINT,
  would_publish_count BIGINT,
  avg_risk_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    date_trunc('hour', evaluated_at) as hour_bucket,
    COUNT(*)::BIGINT as evaluated_count,
    COUNT(*) FILTER (WHERE decision = 'approved')::BIGINT as approved_count,
    COUNT(*) FILTER (WHERE decision = 'rejected')::BIGINT as rejected_count,
    COUNT(*) FILTER (WHERE would_publish = true)::BIGINT as would_publish_count,
    AVG(risk_score) as avg_risk_score
  FROM public.autopilot_decisions
  WHERE evaluated_at >= NOW() - (hours_back || ' hours')::INTERVAL
  GROUP BY date_trunc('hour', evaluated_at)
  ORDER BY hour_bucket DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE public.autopilot_decisions IS 'Autopilot evaluation decisions for log_only and production modes';
COMMENT ON COLUMN public.autopilot_decisions.mode IS 'Autopilot mode: off, log_only, canary, prod';
COMMENT ON COLUMN public.autopilot_decisions.decision IS 'Final decision: approved, rejected, unknown (fail closed)';
COMMENT ON COLUMN public.autopilot_decisions.would_publish IS 'Whether this pick would have been published (if not blocked)';
COMMENT ON FUNCTION public.get_daily_autopilot_report IS 'Generates daily autopilot report for Command Center dashboard';
COMMENT ON FUNCTION public.get_autopilot_timeline IS 'Returns hourly autopilot metrics for timeline visualization';
