-- Migration: ops_replay_runs table for historical replay logging
-- Sprint: LIVE-PIPELINE-HISTORICAL-REPLAY-001
-- Purpose: Track replay operations for auditing and ops visibility
-- Rollback: DROP TABLE IF EXISTS ops_replay_runs;

CREATE TABLE IF NOT EXISTS ops_replay_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  run_type TEXT NOT NULL DEFAULT 'historical_replay',
  legs_found INTEGER NOT NULL DEFAULT 0,
  legs_scored INTEGER NOT NULL DEFAULT 0,
  legs_with_probability INTEGER NOT NULL DEFAULT 0,
  legs_failed_probability INTEGER NOT NULL DEFAULT 0,
  fail_reasons_summary JSONB,
  error_message TEXT,
  run_config JSONB,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'partial'))
);

-- Index for querying recent runs
CREATE INDEX IF NOT EXISTS idx_ops_replay_runs_started_at ON ops_replay_runs (started_at DESC);

-- Comment for documentation
COMMENT ON TABLE ops_replay_runs IS 'Tracks historical replay runs for V3 scoring. Sprint: LIVE-PIPELINE-HISTORICAL-REPLAY-001';
