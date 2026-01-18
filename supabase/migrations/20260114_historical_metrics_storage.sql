-- ===============================================================================
-- HISTORICAL METRICS STORAGE TABLES
-- Date: 2026-01-14
-- Purpose: Store time-series metrics for trend analysis and capacity planning
-- Blocker: FOUNDATION_REALITY_REPORT.md - Blocker #2
-- Charter Compliance: Observability + historical trend analysis requirements
-- ===============================================================================

-- ===============================================================================
-- 1. AGENT_METRICS_HISTORY TABLE (Time-Series Storage)
-- ===============================================================================

CREATE TABLE IF NOT EXISTS agent_metrics_history (
  id BIGSERIAL PRIMARY KEY,

  -- Agent Identification
  agent_id UUID,
  agent_name VARCHAR(255) NOT NULL,
  agent_type VARCHAR(50) NOT NULL,

  -- Performance Metrics
  success_rate NUMERIC(5, 2) CHECK (success_rate >= 0 AND success_rate <= 100),
  avg_response_time_ms INTEGER CHECK (avg_response_time_ms >= 0),
  total_operations INTEGER NOT NULL DEFAULT 0,
  successful_operations INTEGER NOT NULL DEFAULT 0,
  failed_operations INTEGER NOT NULL DEFAULT 0,

  -- Resource Metrics
  cpu_usage_percent NUMERIC(5, 2) CHECK (cpu_usage_percent >= 0 AND cpu_usage_percent <= 100),
  memory_usage_mb INTEGER CHECK (memory_usage_mb >= 0),
  memory_usage_percent NUMERIC(5, 2) CHECK (memory_usage_percent >= 0 AND memory_usage_percent <= 100),

  -- Health Status
  status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'warning', 'error', 'inactive', 'unknown')),
  error_count INTEGER NOT NULL DEFAULT 0,
  last_error_message TEXT,

  -- Metadata
  snapshot_interval VARCHAR(20) NOT NULL DEFAULT '1hour' CHECK (snapshot_interval IN ('1min', '5min', '1hour', '1day')),
  data_source VARCHAR(50) DEFAULT 'agent_health_table',

  -- Timestamp
  measured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexing
  CONSTRAINT agent_metrics_history_agent_measured_unique UNIQUE (agent_name, measured_at, snapshot_interval)
);

-- Indexes for time-series queries
CREATE INDEX IF NOT EXISTS idx_agent_metrics_history_name_measured
ON agent_metrics_history(agent_name, measured_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_history_type_measured
ON agent_metrics_history(agent_type, measured_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_history_measured_at
ON agent_metrics_history(measured_at DESC);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_agent_metrics_history_status
ON agent_metrics_history(status, measured_at DESC)
WHERE status IN ('error', 'warning');

-- ===============================================================================
-- 2. PICK_METRICS_HISTORY TABLE (Time-Series Storage)
-- ===============================================================================

CREATE TABLE IF NOT EXISTS pick_metrics_history (
  id BIGSERIAL PRIMARY KEY,

  -- Pick Volume Metrics
  total_picks INTEGER NOT NULL DEFAULT 0,
  pending_picks INTEGER NOT NULL DEFAULT 0,
  approved_picks INTEGER NOT NULL DEFAULT 0,
  rejected_picks INTEGER NOT NULL DEFAULT 0,
  published_picks INTEGER NOT NULL DEFAULT 0,

  -- Tier Distribution
  tier_s_count INTEGER NOT NULL DEFAULT 0,
  tier_a_count INTEGER NOT NULL DEFAULT 0,
  tier_b_count INTEGER NOT NULL DEFAULT 0,
  tier_c_count INTEGER NOT NULL DEFAULT 0,
  ungraded_count INTEGER NOT NULL DEFAULT 0,

  -- Sport Distribution
  nfl_picks INTEGER NOT NULL DEFAULT 0,
  nba_picks INTEGER NOT NULL DEFAULT 0,
  mlb_picks INTEGER NOT NULL DEFAULT 0,
  nhl_picks INTEGER NOT NULL DEFAULT 0,
  other_sport_picks INTEGER NOT NULL DEFAULT 0,

  -- Performance Metrics
  avg_grading_time_ms INTEGER,
  avg_approval_time_ms INTEGER,
  avg_end_to_end_time_ms INTEGER,  -- From creation to publication

  -- Quality Metrics
  approval_rate NUMERIC(5, 2),  -- Percentage of picks approved
  rejection_rate NUMERIC(5, 2),  -- Percentage of picks rejected
  avg_confidence_score NUMERIC(5, 2),  -- Average confidence across all picks

  -- User Metrics
  active_cappers INTEGER NOT NULL DEFAULT 0,
  new_cappers INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  snapshot_interval VARCHAR(20) NOT NULL DEFAULT '1hour' CHECK (snapshot_interval IN ('1min', '5min', '1hour', '1day')),

  -- Timestamp
  measured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexing
  CONSTRAINT pick_metrics_history_measured_unique UNIQUE (measured_at, snapshot_interval)
);

-- Indexes for time-series queries
CREATE INDEX IF NOT EXISTS idx_pick_metrics_history_measured_at
ON pick_metrics_history(measured_at DESC);

CREATE INDEX IF NOT EXISTS idx_pick_metrics_history_interval
ON pick_metrics_history(snapshot_interval, measured_at DESC);

-- ===============================================================================
-- 3. PIPELINE_METRICS_HISTORY TABLE (Time-Series Storage)
-- ===============================================================================

CREATE TABLE IF NOT EXISTS pipeline_metrics_history (
  id BIGSERIAL PRIMARY KEY,

  -- Ingestion Metrics
  props_ingested INTEGER NOT NULL DEFAULT 0,
  props_processed INTEGER NOT NULL DEFAULT 0,
  props_failed INTEGER NOT NULL DEFAULT 0,
  ingestion_rate_per_min NUMERIC(10, 2),  -- Props per minute

  -- Processing Metrics
  processing_queue_depth INTEGER NOT NULL DEFAULT 0,
  avg_processing_time_ms INTEGER,
  p50_processing_time_ms INTEGER,
  p95_processing_time_ms INTEGER,
  p99_processing_time_ms INTEGER,

  -- Approval Queue Metrics
  approval_queue_depth INTEGER NOT NULL DEFAULT 0,
  high_priority_queue_depth INTEGER NOT NULL DEFAULT 0,
  avg_approval_wait_time_ms INTEGER,

  -- Publishing Metrics
  picks_published INTEGER NOT NULL DEFAULT 0,
  publishing_errors INTEGER NOT NULL DEFAULT 0,
  avg_publishing_time_ms INTEGER,

  -- Discord Integration Metrics
  discord_messages_sent INTEGER NOT NULL DEFAULT 0,
  discord_errors INTEGER NOT NULL DEFAULT 0,

  -- System Health
  overall_health_score NUMERIC(5, 2) CHECK (overall_health_score >= 0 AND overall_health_score <= 100),
  active_agents INTEGER NOT NULL DEFAULT 0,
  unhealthy_agents INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  snapshot_interval VARCHAR(20) NOT NULL DEFAULT '1hour' CHECK (snapshot_interval IN ('1min', '5min', '1hour', '1day')),

  -- Timestamp
  measured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexing
  CONSTRAINT pipeline_metrics_history_measured_unique UNIQUE (measured_at, snapshot_interval)
);

-- Indexes for time-series queries
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_history_measured_at
ON pipeline_metrics_history(measured_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_history_interval
ON pipeline_metrics_history(snapshot_interval, measured_at DESC);

-- ===============================================================================
-- 4. RETENTION POLICIES (90-Day TTL)
-- ===============================================================================

-- Function to clean up old metrics (90-day retention)
CREATE OR REPLACE FUNCTION cleanup_metrics_history()
RETURNS void AS $$
DECLARE
  cutoff_date TIMESTAMPTZ := NOW() - INTERVAL '90 days';
  deleted_count INTEGER;
BEGIN
  -- Clean up agent metrics
  DELETE FROM agent_metrics_history WHERE measured_at < cutoff_date;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % agent_metrics_history rows older than %', deleted_count, cutoff_date;

  -- Clean up pick metrics
  DELETE FROM pick_metrics_history WHERE measured_at < cutoff_date;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % pick_metrics_history rows older than %', deleted_count, cutoff_date;

  -- Clean up pipeline metrics
  DELETE FROM pipeline_metrics_history WHERE measured_at < cutoff_date;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % pipeline_metrics_history rows older than %', deleted_count, cutoff_date;

  RAISE NOTICE 'Metrics history cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup via pg_cron (requires superuser, configure via Supabase Dashboard):
-- SELECT cron.schedule('cleanup-metrics-history', '0 2 * * *', 'SELECT cleanup_metrics_history()');

COMMENT ON FUNCTION cleanup_metrics_history() IS 'Deletes metrics history older than 90 days. Schedule via pg_cron at 2 AM daily.';

-- ===============================================================================
-- 5. SNAPSHOT COLLECTION FUNCTIONS
-- ===============================================================================

-- Function to snapshot current agent metrics
CREATE OR REPLACE FUNCTION snapshot_agent_metrics(interval_type VARCHAR DEFAULT '1hour')
RETURNS void AS $$
BEGIN
  INSERT INTO agent_metrics_history (
    agent_id,
    agent_name,
    agent_type,
    success_rate,
    avg_response_time_ms,
    total_operations,
    successful_operations,
    failed_operations,
    cpu_usage_percent,
    memory_usage_mb,
    memory_usage_percent,
    status,
    error_count,
    snapshot_interval,
    measured_at
  )
  SELECT
    id::UUID,
    agent,
    'system' AS agent_type,  -- Default type, customize if needed
    CASE
      WHEN total_operations > 0 THEN (total_operations - COALESCE(error_count, 0))::NUMERIC / total_operations * 100
      ELSE 100
    END AS success_rate,
    response_time_ms,
    total_operations,
    total_operations - COALESCE(error_count, 0) AS successful_operations,
    COALESCE(error_count, 0) AS failed_operations,
    NULL AS cpu_usage_percent,  -- Would need to add to agent_health table
    NULL AS memory_usage_mb,
    NULL AS memory_usage_percent,
    status,
    COALESCE(error_count, 0) AS error_count,
    interval_type,
    NOW()
  FROM agent_health
  WHERE last_heartbeat IS NOT NULL
  ON CONFLICT (agent_name, measured_at, snapshot_interval) DO NOTHING;

  RAISE NOTICE 'Agent metrics snapshot created for interval: %', interval_type;
END;
$$ LANGUAGE plpgsql;

-- Function to snapshot current pick metrics
CREATE OR REPLACE FUNCTION snapshot_pick_metrics(interval_type VARCHAR DEFAULT '1hour')
RETURNS void AS $$
DECLARE
  picks_data RECORD;
BEGIN
  -- Calculate pick metrics
  SELECT
    COUNT(*) AS total_picks,
    SUM(CASE WHEN workflow_stage = 'pending_review' THEN 1 ELSE 0 END) AS pending_picks,
    SUM(CASE WHEN workflow_stage = 'approved' OR status = 'approved' THEN 1 ELSE 0 END) AS approved_picks,
    SUM(CASE WHEN workflow_stage = 'rejected' OR status = 'rejected' THEN 1 ELSE 0 END) AS rejected_picks,
    SUM(CASE WHEN workflow_stage = 'published' THEN 1 ELSE 0 END) AS published_picks,
    SUM(CASE WHEN tier = 'S' THEN 1 ELSE 0 END) AS tier_s_count,
    SUM(CASE WHEN tier = 'A' THEN 1 ELSE 0 END) AS tier_a_count,
    SUM(CASE WHEN tier = 'B' THEN 1 ELSE 0 END) AS tier_b_count,
    SUM(CASE WHEN tier = 'C' THEN 1 ELSE 0 END) AS tier_c_count,
    SUM(CASE WHEN tier IS NULL OR tier = '' THEN 1 ELSE 0 END) AS ungraded_count,
    SUM(CASE WHEN sport = 'NFL' THEN 1 ELSE 0 END) AS nfl_picks,
    SUM(CASE WHEN sport = 'NBA' THEN 1 ELSE 0 END) AS nba_picks,
    SUM(CASE WHEN sport = 'MLB' THEN 1 ELSE 0 END) AS mlb_picks,
    SUM(CASE WHEN sport = 'NHL' THEN 1 ELSE 0 END) AS nhl_picks,
    SUM(CASE WHEN sport NOT IN ('NFL', 'NBA', 'MLB', 'NHL') THEN 1 ELSE 0 END) AS other_sport_picks,
    AVG(confidence) AS avg_confidence_score,
    COUNT(DISTINCT user_id) AS active_cappers
  INTO picks_data
  FROM unified_picks
  WHERE created_at >= NOW() - INTERVAL '24 hours';  -- Last 24 hours

  -- Insert snapshot
  INSERT INTO pick_metrics_history (
    total_picks,
    pending_picks,
    approved_picks,
    rejected_picks,
    published_picks,
    tier_s_count,
    tier_a_count,
    tier_b_count,
    tier_c_count,
    ungraded_count,
    nfl_picks,
    nba_picks,
    mlb_picks,
    nhl_picks,
    other_sport_picks,
    approval_rate,
    rejection_rate,
    avg_confidence_score,
    active_cappers,
    snapshot_interval,
    measured_at
  )
  VALUES (
    picks_data.total_picks,
    picks_data.pending_picks,
    picks_data.approved_picks,
    picks_data.rejected_picks,
    picks_data.published_picks,
    picks_data.tier_s_count,
    picks_data.tier_a_count,
    picks_data.tier_b_count,
    picks_data.tier_c_count,
    picks_data.ungraded_count,
    picks_data.nfl_picks,
    picks_data.nba_picks,
    picks_data.mlb_picks,
    picks_data.nhl_picks,
    picks_data.other_sport_picks,
    CASE WHEN picks_data.total_picks > 0 THEN (picks_data.approved_picks::NUMERIC / picks_data.total_picks * 100) ELSE 0 END,
    CASE WHEN picks_data.total_picks > 0 THEN (picks_data.rejected_picks::NUMERIC / picks_data.total_picks * 100) ELSE 0 END,
    picks_data.avg_confidence_score,
    picks_data.active_cappers,
    interval_type,
    NOW()
  )
  ON CONFLICT (measured_at, snapshot_interval) DO NOTHING;

  RAISE NOTICE 'Pick metrics snapshot created for interval: %', interval_type;
END;
$$ LANGUAGE plpgsql;

-- Function to snapshot current pipeline metrics
CREATE OR REPLACE FUNCTION snapshot_pipeline_metrics(interval_type VARCHAR DEFAULT '1hour')
RETURNS void AS $$
DECLARE
  raw_props_data RECORD;
  agents_data RECORD;
BEGIN
  -- Calculate raw props metrics
  SELECT
    COUNT(*) AS props_ingested,
    SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) AS props_processed,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS props_failed
  INTO raw_props_data
  FROM raw_props
  WHERE created_at >= NOW() - INTERVAL '1 hour';

  -- Calculate agent health metrics
  SELECT
    COUNT(*) AS active_agents,
    SUM(CASE WHEN status IN ('error', 'warning') THEN 1 ELSE 0 END) AS unhealthy_agents
  INTO agents_data
  FROM agent_health
  WHERE last_heartbeat >= NOW() - INTERVAL '5 minutes';

  -- Insert snapshot
  INSERT INTO pipeline_metrics_history (
    props_ingested,
    props_processed,
    props_failed,
    ingestion_rate_per_min,
    processing_queue_depth,
    active_agents,
    unhealthy_agents,
    overall_health_score,
    snapshot_interval,
    measured_at
  )
  VALUES (
    raw_props_data.props_ingested,
    raw_props_data.props_processed,
    raw_props_data.props_failed,
    CASE WHEN raw_props_data.props_ingested > 0 THEN raw_props_data.props_ingested / 60.0 ELSE 0 END,
    (SELECT COUNT(*) FROM unified_picks WHERE workflow_stage = 'pending_review'),
    agents_data.active_agents,
    agents_data.unhealthy_agents,
    CASE
      WHEN agents_data.active_agents > 0 THEN ((agents_data.active_agents - agents_data.unhealthy_agents)::NUMERIC / agents_data.active_agents * 100)
      ELSE 100
    END,
    interval_type,
    NOW()
  )
  ON CONFLICT (measured_at, snapshot_interval) DO NOTHING;

  RAISE NOTICE 'Pipeline metrics snapshot created for interval: %', interval_type;
END;
$$ LANGUAGE plpgsql;

-- ===============================================================================
-- 6. SCHEDULED SNAPSHOT JOBS (via pg_cron or external scheduler)
-- ===============================================================================

-- Schedule hourly snapshots:
-- SELECT cron.schedule('snapshot-agent-metrics-hourly', '0 * * * *', 'SELECT snapshot_agent_metrics(''1hour'')');
-- SELECT cron.schedule('snapshot-pick-metrics-hourly', '0 * * * *', 'SELECT snapshot_pick_metrics(''1hour'')');
-- SELECT cron.schedule('snapshot-pipeline-metrics-hourly', '0 * * * *', 'SELECT snapshot_pipeline_metrics(''1hour'')');

-- Schedule daily snapshots (for long-term trends):
-- SELECT cron.schedule('snapshot-agent-metrics-daily', '0 0 * * *', 'SELECT snapshot_agent_metrics(''1day'')');
-- SELECT cron.schedule('snapshot-pick-metrics-daily', '0 0 * * *', 'SELECT snapshot_pick_metrics(''1day'')');
-- SELECT cron.schedule('snapshot-pipeline-metrics-daily', '0 0 * * *', 'SELECT snapshot_pipeline_metrics(''1day'')');

-- ===============================================================================
-- 7. CREATE TREND ANALYSIS VIEWS
-- ===============================================================================

-- Agent Performance Trends (Last 7 Days)
CREATE OR REPLACE VIEW vw_agent_performance_trends AS
SELECT
  agent_name,
  DATE_TRUNC('day', measured_at) AS date,
  AVG(success_rate) AS avg_success_rate,
  AVG(avg_response_time_ms) AS avg_response_time,
  SUM(total_operations) AS total_operations,
  SUM(failed_operations) AS total_failures,
  MAX(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS had_errors
FROM agent_metrics_history
WHERE measured_at >= NOW() - INTERVAL '7 days'
  AND snapshot_interval = '1hour'
GROUP BY agent_name, DATE_TRUNC('day', measured_at)
ORDER BY date DESC, agent_name;

-- Pick Volume Trends (Last 30 Days)
CREATE OR REPLACE VIEW vw_pick_volume_trends AS
SELECT
  DATE_TRUNC('day', measured_at) AS date,
  AVG(total_picks) AS avg_total_picks,
  AVG(approved_picks) AS avg_approved_picks,
  AVG(rejected_picks) AS avg_rejected_picks,
  AVG(approval_rate) AS avg_approval_rate,
  AVG(tier_s_count + tier_a_count) AS avg_premium_picks
FROM pick_metrics_history
WHERE measured_at >= NOW() - INTERVAL '30 days'
  AND snapshot_interval = '1day'
GROUP BY DATE_TRUNC('day', measured_at)
ORDER BY date DESC;

-- Pipeline Health Trends (Last 7 Days)
CREATE OR REPLACE VIEW vw_pipeline_health_trends AS
SELECT
  DATE_TRUNC('day', measured_at) AS date,
  AVG(overall_health_score) AS avg_health_score,
  AVG(props_ingested) AS avg_props_ingested,
  AVG(processing_queue_depth) AS avg_queue_depth,
  AVG(active_agents) AS avg_active_agents,
  SUM(props_failed) AS total_props_failed
FROM pipeline_metrics_history
WHERE measured_at >= NOW() - INTERVAL '7 days'
  AND snapshot_interval = '1hour'
GROUP BY DATE_TRUNC('day', measured_at)
ORDER BY date DESC;

-- ===============================================================================
-- 8. NOTIFY POSTGREST TO RELOAD SCHEMA
-- ===============================================================================

SELECT pg_notify('pgrst', 'reload schema');

-- ===============================================================================
-- 9. AUDIT TRAIL (if audit_events table exists)
-- ===============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_events') THEN
    INSERT INTO audit_events (
      tenant_id,
      event_type,
      entity_type,
      entity_id,
      actor_type,
      metadata
    ) VALUES (
      '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a'::UUID,  -- Default tenant
      'schema.table.created',
      'database_table',
      'agent_metrics_history'::UUID,
      'system',
      jsonb_build_object(
        'migration', '20260114_historical_metrics_storage',
        'purpose', 'Time-series metrics storage for trend analysis and capacity planning',
        'tables_created', ARRAY['agent_metrics_history', 'pick_metrics_history', 'pipeline_metrics_history'],
        'views_created', ARRAY['vw_agent_performance_trends', 'vw_pick_volume_trends', 'vw_pipeline_health_trends'],
        'functions_created', ARRAY['cleanup_metrics_history', 'snapshot_agent_metrics', 'snapshot_pick_metrics', 'snapshot_pipeline_metrics'],
        'retention_policy', '90 days',
        'blocker_resolved', 'FOUNDATION_REALITY_REPORT.md - Blocker #2'
      )
    );
    RAISE NOTICE 'Audit event recorded: historical metrics tables created';
  END IF;
END $$;

-- ===============================================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- ===============================================================================

-- Verify tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('agent_metrics_history', 'pick_metrics_history', 'pipeline_metrics_history');

-- Verify views exist
-- SELECT table_name FROM information_schema.views WHERE table_name LIKE 'vw_%_trends';

-- Verify functions exist
-- SELECT proname FROM pg_proc WHERE proname LIKE 'snapshot_%' OR proname = 'cleanup_metrics_history';

-- ===============================================================================
-- END OF MIGRATION
-- ===============================================================================
