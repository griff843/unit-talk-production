-- ============================================================================
-- PR9: Materialized View Refresh Infrastructure
--
-- Creates the MV refresh infrastructure that was missing from the codebase:
-- 1. mv_pipeline_lag_24h - Materialized view for pipeline lag metrics
-- 2. ops.mv_refresh_log - Tracking table for refresh operations
-- 3. ops.logged_refresh_mv() - Safe refresh function with logging
-- 4. refresh_pipeline_lag_materialized_view() - RPC endpoint for Command Center
--
-- SECURITY: All functions use SECURITY DEFINER with explicit search_path
-- ACCESS: service_role only
-- ============================================================================

-- ============================================================================
-- 1. CREATE MATERIALIZED VIEW: mv_pipeline_lag_24h
-- ============================================================================

-- Drop if exists for idempotency
DROP MATERIALIZED VIEW IF EXISTS public.mv_pipeline_lag_24h CASCADE;

-- Create the materialized view for pipeline lag metrics
CREATE MATERIALIZED VIEW public.mv_pipeline_lag_24h AS
WITH recent_events AS (
  SELECT
    id,
    event_type,
    payload,
    created_at,
    processed_at,
    EXTRACT(EPOCH FROM (COALESCE(processed_at, NOW()) - created_at)) AS lag_seconds
  FROM public.events
  WHERE created_at >= NOW() - INTERVAL '24 hours'
),
lag_stats AS (
  SELECT
    event_type,
    COUNT(*) AS event_count,
    AVG(lag_seconds) AS avg_lag_seconds,
    MAX(lag_seconds) AS max_lag_seconds,
    MIN(lag_seconds) AS min_lag_seconds,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY lag_seconds) AS p50_lag_seconds,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY lag_seconds) AS p95_lag_seconds,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY lag_seconds) AS p99_lag_seconds,
    COUNT(*) FILTER (WHERE processed_at IS NULL) AS pending_count
  FROM recent_events
  GROUP BY event_type
)
SELECT
  ls.event_type,
  ls.event_count,
  ROUND(ls.avg_lag_seconds::numeric, 2) AS avg_lag_seconds,
  ROUND(ls.max_lag_seconds::numeric, 2) AS max_lag_seconds,
  ROUND(ls.min_lag_seconds::numeric, 2) AS min_lag_seconds,
  ROUND(ls.p50_lag_seconds::numeric, 2) AS p50_lag_seconds,
  ROUND(ls.p95_lag_seconds::numeric, 2) AS p95_lag_seconds,
  ROUND(ls.p99_lag_seconds::numeric, 2) AS p99_lag_seconds,
  ls.pending_count,
  NOW() AS refreshed_at
FROM lag_stats ls
ORDER BY ls.avg_lag_seconds DESC;

-- Create unique index (required for CONCURRENTLY refresh)
CREATE UNIQUE INDEX idx_mv_pipeline_lag_24h_event_type
ON public.mv_pipeline_lag_24h (event_type);

-- Grant access
GRANT SELECT ON public.mv_pipeline_lag_24h TO authenticated, anon, service_role;

COMMENT ON MATERIALIZED VIEW public.mv_pipeline_lag_24h IS
'Pipeline lag metrics aggregated over 24 hours. Refresh via refresh_pipeline_lag_materialized_view()';

-- ============================================================================
-- 2. CREATE TRACKING TABLE: ops.mv_refresh_log
-- ============================================================================

-- Ensure ops schema exists
CREATE SCHEMA IF NOT EXISTS ops;

-- Create refresh log table
CREATE TABLE IF NOT EXISTS ops.mv_refresh_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  view_name TEXT NOT NULL,
  trigger_source TEXT NOT NULL, -- 'manual', 'scheduled', 'playbook', 'api'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  rows_affected INTEGER,
  success BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  triggered_by TEXT, -- user_id or 'system'
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mv_refresh_log_view_name
ON ops.mv_refresh_log (view_name);

CREATE INDEX IF NOT EXISTS idx_mv_refresh_log_created_at
ON ops.mv_refresh_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mv_refresh_log_success
ON ops.mv_refresh_log (success) WHERE NOT success;

-- Enable RLS
ALTER TABLE ops.mv_refresh_log ENABLE ROW LEVEL SECURITY;

-- RLS policy: Only service_role can access
CREATE POLICY "service_role_mv_refresh_log" ON ops.mv_refresh_log
  FOR ALL USING (auth.role() = 'service_role');

-- Grant access to service_role
GRANT ALL ON ops.mv_refresh_log TO service_role;

COMMENT ON TABLE ops.mv_refresh_log IS
'Audit log for materialized view refresh operations. Part of PR9 MV refresh infrastructure.';

-- ============================================================================
-- 3. CREATE FUNCTION: ops.logged_refresh_mv
-- ============================================================================

CREATE OR REPLACE FUNCTION ops.logged_refresh_mv(
  p_view_name TEXT,
  p_trigger_source TEXT DEFAULT 'manual',
  p_triggered_by TEXT DEFAULT 'system',
  p_correlation_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  log_id UUID,
  success BOOLEAN,
  duration_ms INTEGER,
  error_message TEXT
)
SECURITY DEFINER
SET search_path = public, ops
LANGUAGE plpgsql
AS $$
DECLARE
  v_log_id UUID;
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_duration_ms INTEGER;
  v_rows_affected INTEGER;
  v_success BOOLEAN := FALSE;
  v_error TEXT := NULL;
BEGIN
  -- Validate view name (whitelist approach for security)
  IF p_view_name NOT IN ('mv_pipeline_lag_24h', 'mv_daily_stats', 'mv_player_performance') THEN
    RAISE EXCEPTION 'Invalid view name: %. Only whitelisted views can be refreshed.', p_view_name;
  END IF;

  -- Create log entry
  v_start_time := clock_timestamp();

  INSERT INTO ops.mv_refresh_log (
    view_name,
    trigger_source,
    started_at,
    triggered_by,
    correlation_id
  )
  VALUES (
    p_view_name,
    p_trigger_source,
    v_start_time,
    p_triggered_by,
    p_correlation_id
  )
  RETURNING id INTO v_log_id;

  -- Attempt refresh
  BEGIN
    -- Use CONCURRENTLY to avoid locking
    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY public.%I', p_view_name);

    -- Get row count
    EXECUTE format('SELECT COUNT(*) FROM public.%I', p_view_name) INTO v_rows_affected;

    v_success := TRUE;
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
    v_success := FALSE;
  END;

  -- Calculate duration
  v_end_time := clock_timestamp();
  v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::INTEGER;

  -- Update log entry
  UPDATE ops.mv_refresh_log
  SET
    completed_at = v_end_time,
    duration_ms = v_duration_ms,
    rows_affected = v_rows_affected,
    success = v_success,
    error_message = v_error
  WHERE id = v_log_id;

  -- Return result
  RETURN QUERY SELECT v_log_id, v_success, v_duration_ms, v_error;
END;
$$;

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION ops.logged_refresh_mv(TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION ops.logged_refresh_mv IS
'Safely refresh a whitelisted materialized view with audit logging. Part of PR9 MV refresh infrastructure.';

-- ============================================================================
-- 4. CREATE RPC FUNCTION: refresh_pipeline_lag_materialized_view
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refresh_pipeline_lag_materialized_view()
RETURNS TABLE (
  success BOOLEAN,
  duration_ms INTEGER,
  rows_refreshed INTEGER,
  error_message TEXT
)
SECURITY DEFINER
SET search_path = public, ops
LANGUAGE plpgsql
AS $$
DECLARE
  v_result RECORD;
  v_rows INTEGER;
BEGIN
  -- Call the logged refresh function
  SELECT * INTO v_result
  FROM ops.logged_refresh_mv(
    'mv_pipeline_lag_24h',
    'api',
    'command_center',
    gen_random_uuid()::TEXT
  );

  -- Get row count if successful
  IF v_result.success THEN
    SELECT COUNT(*) INTO v_rows FROM public.mv_pipeline_lag_24h;
  ELSE
    v_rows := 0;
  END IF;

  -- Return result
  RETURN QUERY SELECT
    v_result.success,
    v_result.duration_ms,
    v_rows,
    v_result.error_message;
END;
$$;

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION public.refresh_pipeline_lag_materialized_view() TO service_role;

COMMENT ON FUNCTION public.refresh_pipeline_lag_materialized_view IS
'RPC endpoint to refresh mv_pipeline_lag_24h. Called by Command Center. Part of PR9 MV refresh infrastructure.';

-- ============================================================================
-- 5. CREATE HELPER FUNCTION: ops.get_mv_refresh_history
-- ============================================================================

CREATE OR REPLACE FUNCTION ops.get_mv_refresh_history(
  p_view_name TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  view_name TEXT,
  trigger_source TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  rows_affected INTEGER,
  success BOOLEAN,
  error_message TEXT,
  triggered_by TEXT,
  correlation_id TEXT
)
SECURITY DEFINER
SET search_path = ops
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.view_name,
    l.trigger_source,
    l.started_at,
    l.completed_at,
    l.duration_ms,
    l.rows_affected,
    l.success,
    l.error_message,
    l.triggered_by,
    l.correlation_id
  FROM ops.mv_refresh_log l
  WHERE (p_view_name IS NULL OR l.view_name = p_view_name)
  ORDER BY l.created_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION ops.get_mv_refresh_history(TEXT, INTEGER) TO service_role;

COMMENT ON FUNCTION ops.get_mv_refresh_history IS
'Retrieve MV refresh history. Part of PR9 MV refresh infrastructure.';

-- ============================================================================
-- 6. CREATE HELPER VIEW: ops.v_mv_freshness
-- ============================================================================

CREATE OR REPLACE VIEW ops.v_mv_freshness AS
SELECT
  'mv_pipeline_lag_24h' AS view_name,
  MAX(refreshed_at) AS last_refreshed_at,
  EXTRACT(EPOCH FROM (NOW() - MAX(refreshed_at))) AS age_seconds,
  CASE
    WHEN MAX(refreshed_at) > NOW() - INTERVAL '5 minutes' THEN 'fresh'
    WHEN MAX(refreshed_at) > NOW() - INTERVAL '15 minutes' THEN 'stale'
    ELSE 'very_stale'
  END AS freshness_status
FROM public.mv_pipeline_lag_24h;

GRANT SELECT ON ops.v_mv_freshness TO service_role;

COMMENT ON VIEW ops.v_mv_freshness IS
'Check freshness of materialized views. Part of PR9 MV refresh infrastructure.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_mv_exists BOOLEAN;
  v_log_exists BOOLEAN;
  v_refresh_fn_exists BOOLEAN;
BEGIN
  -- Check MV exists
  SELECT EXISTS (
    SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_pipeline_lag_24h'
  ) INTO v_mv_exists;

  -- Check log table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'ops' AND table_name = 'mv_refresh_log'
  ) INTO v_log_exists;

  -- Check refresh function exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'refresh_pipeline_lag_materialized_view'
  ) INTO v_refresh_fn_exists;

  IF NOT v_mv_exists THEN
    RAISE EXCEPTION 'mv_pipeline_lag_24h materialized view not created';
  END IF;

  IF NOT v_log_exists THEN
    RAISE EXCEPTION 'ops.mv_refresh_log table not created';
  END IF;

  IF NOT v_refresh_fn_exists THEN
    RAISE EXCEPTION 'refresh_pipeline_lag_materialized_view function not created';
  END IF;

  RAISE NOTICE 'PR9 MV Refresh Infrastructure verification PASSED';
END;
$$;
