-- Migration: api_credit_log for persistent credit tracking
-- Sprint: MARKET-DATA-INGESTION-WIREUP-002
-- Rollback: DROP TABLE api_credit_log;

CREATE TABLE IF NOT EXISTS api_credit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,           -- 'odds_api', 'sgo', etc.
  endpoint TEXT NOT NULL,           -- '/v4/sports/nba/odds'
  credits_used INTEGER NOT NULL DEFAULT 1,
  response_status INTEGER,
  latency_ms INTEGER,
  remaining_credits INTEGER,        -- From x-requests-remaining header
  error_message TEXT,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying recent usage by provider
CREATE INDEX idx_api_credit_log_provider_time
  ON api_credit_log(provider, created_at DESC);

-- Index for cost analysis queries
CREATE INDEX idx_api_credit_log_created_at
  ON api_credit_log(created_at DESC);

-- View for hourly credit burn rate
CREATE OR REPLACE VIEW view_api_credit_burn_hourly AS
SELECT
  provider,
  date_trunc('hour', created_at) AS hour,
  SUM(credits_used) AS credits_burned,
  COUNT(*) AS request_count,
  AVG(latency_ms) AS avg_latency_ms
FROM api_credit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY provider, date_trunc('hour', created_at)
ORDER BY hour DESC;

COMMENT ON TABLE api_credit_log IS 'Persistent API credit usage tracking for market data providers';
