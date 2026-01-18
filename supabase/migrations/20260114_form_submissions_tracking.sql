-- ===============================================================================
-- SMART FORM SUBMISSIONS TRACKING TABLE
-- Date: 2026-01-14
-- Purpose: Track all smart form submissions for monitoring and analytics
-- Blocker: FOUNDATION_REALITY_REPORT.md - Blocker #1
-- Charter Compliance: Observability + audit trail requirements
-- ===============================================================================

-- ===============================================================================
-- 1. CREATE FORM_SUBMISSIONS TABLE (IDEMPOTENT)
-- ===============================================================================

CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Form Identification
  form_type VARCHAR(50) NOT NULL CHECK (form_type IN ('pick_submission', 'user_registration', 'capper_application', 'feedback', 'support', 'other')),
  form_version VARCHAR(20) NOT NULL DEFAULT 'v1.0.0',

  -- User Context
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  ip_address INET,
  user_agent TEXT,

  -- Submission Data
  form_data JSONB NOT NULL,  -- Full form payload
  validation_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid', 'processing', 'completed', 'failed')),
  validation_errors JSONB,  -- Array of validation error messages

  -- Processing Tracking
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  processing_duration_ms INTEGER,  -- Calculated: completed_at - started_at in milliseconds
  processed_by VARCHAR(255),  -- Agent or service that processed the submission

  -- Result Tracking
  result_status VARCHAR(20) CHECK (result_status IN ('success', 'partial_success', 'failure', 'error')),
  result_data JSONB,  -- Processing results, errors, or created entity IDs
  error_message TEXT,

  -- Metadata
  source_url TEXT,  -- URL where form was submitted from
  referrer_url TEXT,  -- Referrer URL
  device_type VARCHAR(20) CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  browser_type VARCHAR(50),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexing and constraints
  CONSTRAINT form_submissions_processing_duration_check CHECK (processing_duration_ms >= 0)
);

-- ===============================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ===============================================================================

-- Query by validation status (for monitoring dashboards)
CREATE INDEX IF NOT EXISTS idx_form_submissions_validation_status
ON form_submissions(validation_status)
WHERE validation_status IN ('pending', 'processing');

-- Query by form type and date (for analytics)
CREATE INDEX IF NOT EXISTS idx_form_submissions_type_created
ON form_submissions(form_type, created_at DESC);

-- Query by user (for user history)
CREATE INDEX IF NOT EXISTS idx_form_submissions_user_id
ON form_submissions(user_id, created_at DESC)
WHERE user_id IS NOT NULL;

-- Query by processing status (for worker queues)
CREATE INDEX IF NOT EXISTS idx_form_submissions_result_status
ON form_submissions(result_status, created_at DESC)
WHERE result_status IS NOT NULL;

-- Full-text search on form data (for debugging)
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_data_gin
ON form_submissions USING GIN (form_data);

-- Query by session (for session tracking)
CREATE INDEX IF NOT EXISTS idx_form_submissions_session_id
ON form_submissions(session_id)
WHERE session_id IS NOT NULL;

-- ===============================================================================
-- 3. CREATE UPDATED_AT TRIGGER
-- ===============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_form_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();

  -- Auto-calculate processing duration if both timestamps exist
  IF NEW.processing_started_at IS NOT NULL AND NEW.processing_completed_at IS NOT NULL THEN
    NEW.processing_duration_ms = EXTRACT(EPOCH FROM (NEW.processing_completed_at - NEW.processing_started_at)) * 1000;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call function on every update
DROP TRIGGER IF EXISTS trigger_update_form_submissions_updated_at ON form_submissions;
CREATE TRIGGER trigger_update_form_submissions_updated_at
  BEFORE UPDATE ON form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_form_submissions_updated_at();

-- ===============================================================================
-- 4. ROW-LEVEL SECURITY (RLS) POLICIES
-- ===============================================================================

-- Enable RLS
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT - Allow authenticated users to read their own submissions
CREATE POLICY form_submissions_select_own ON form_submissions
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    -- Allow service role full access
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Policy: INSERT - Allow authenticated users to create submissions
CREATE POLICY form_submissions_insert_own ON form_submissions
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR
    -- Allow service role full access
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Policy: UPDATE - Only service role can update (for processing)
CREATE POLICY form_submissions_update_service ON form_submissions
  FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: DELETE - Only service role can delete (for cleanup)
CREATE POLICY form_submissions_delete_service ON form_submissions
  FOR DELETE
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ===============================================================================
-- 5. CREATE MONITORING VIEW FOR COMMAND CENTER
-- ===============================================================================

CREATE OR REPLACE VIEW vw_form_submissions_metrics AS
SELECT
  form_type,
  validation_status,
  result_status,
  COUNT(*) AS submission_count,
  AVG(processing_duration_ms) AS avg_processing_time_ms,
  MIN(processing_duration_ms) AS min_processing_time_ms,
  MAX(processing_duration_ms) AS max_processing_time_ms,
  SUM(CASE WHEN validation_status = 'valid' THEN 1 ELSE 0 END) AS valid_count,
  SUM(CASE WHEN validation_status = 'invalid' THEN 1 ELSE 0 END) AS invalid_count,
  SUM(CASE WHEN result_status = 'success' THEN 1 ELSE 0 END) AS success_count,
  SUM(CASE WHEN result_status = 'failure' OR result_status = 'error' THEN 1 ELSE 0 END) AS failure_count,
  MIN(created_at) AS first_submission_at,
  MAX(created_at) AS last_submission_at
FROM form_submissions
WHERE created_at >= NOW() - INTERVAL '24 hours'  -- Last 24 hours
GROUP BY form_type, validation_status, result_status
ORDER BY form_type, submission_count DESC;

COMMENT ON VIEW vw_form_submissions_metrics IS 'Real-time metrics for Command Center monitoring - 24-hour rolling window';

-- ===============================================================================
-- 6. CREATE AGGREGATE METRICS TABLE (FOR HISTORICAL TRENDS)
-- ===============================================================================

CREATE TABLE IF NOT EXISTS form_submissions_daily_metrics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  form_type VARCHAR(50) NOT NULL,

  -- Submission Counts
  total_submissions INTEGER NOT NULL DEFAULT 0,
  valid_submissions INTEGER NOT NULL DEFAULT 0,
  invalid_submissions INTEGER NOT NULL DEFAULT 0,
  successful_submissions INTEGER NOT NULL DEFAULT 0,
  failed_submissions INTEGER NOT NULL DEFAULT 0,

  -- Performance Metrics
  avg_processing_time_ms INTEGER,
  min_processing_time_ms INTEGER,
  max_processing_time_ms INTEGER,
  p50_processing_time_ms INTEGER,
  p95_processing_time_ms INTEGER,
  p99_processing_time_ms INTEGER,

  -- Validation Metrics
  validation_error_count INTEGER NOT NULL DEFAULT 0,
  most_common_error JSONB,  -- Top 5 validation errors

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(date, form_type)
);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_form_submissions_daily_metrics_date
ON form_submissions_daily_metrics(date DESC, form_type);

-- ===============================================================================
-- 7. CREATE DAILY AGGREGATION FUNCTION
-- ===============================================================================

CREATE OR REPLACE FUNCTION aggregate_form_submissions_daily()
RETURNS void AS $$
DECLARE
  target_date DATE := CURRENT_DATE - INTERVAL '1 day';  -- Yesterday
BEGIN
  -- Insert or update daily metrics for each form type
  INSERT INTO form_submissions_daily_metrics (
    date,
    form_type,
    total_submissions,
    valid_submissions,
    invalid_submissions,
    successful_submissions,
    failed_submissions,
    avg_processing_time_ms,
    min_processing_time_ms,
    max_processing_time_ms,
    p50_processing_time_ms,
    p95_processing_time_ms,
    p99_processing_time_ms,
    validation_error_count
  )
  SELECT
    target_date,
    form_type,
    COUNT(*) AS total_submissions,
    SUM(CASE WHEN validation_status = 'valid' THEN 1 ELSE 0 END) AS valid_submissions,
    SUM(CASE WHEN validation_status = 'invalid' THEN 1 ELSE 0 END) AS invalid_submissions,
    SUM(CASE WHEN result_status = 'success' THEN 1 ELSE 0 END) AS successful_submissions,
    SUM(CASE WHEN result_status IN ('failure', 'error') THEN 1 ELSE 0 END) AS failed_submissions,
    AVG(processing_duration_ms)::INTEGER AS avg_processing_time_ms,
    MIN(processing_duration_ms) AS min_processing_time_ms,
    MAX(processing_duration_ms) AS max_processing_time_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY processing_duration_ms)::INTEGER AS p50_processing_time_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_duration_ms)::INTEGER AS p95_processing_time_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY processing_duration_ms)::INTEGER AS p99_processing_time_ms,
    SUM(CASE WHEN validation_errors IS NOT NULL THEN jsonb_array_length(validation_errors) ELSE 0 END) AS validation_error_count
  FROM form_submissions
  WHERE DATE(created_at) = target_date
  GROUP BY form_type
  ON CONFLICT (date, form_type) DO UPDATE SET
    total_submissions = EXCLUDED.total_submissions,
    valid_submissions = EXCLUDED.valid_submissions,
    invalid_submissions = EXCLUDED.invalid_submissions,
    successful_submissions = EXCLUDED.successful_submissions,
    failed_submissions = EXCLUDED.failed_submissions,
    avg_processing_time_ms = EXCLUDED.avg_processing_time_ms,
    min_processing_time_ms = EXCLUDED.min_processing_time_ms,
    max_processing_time_ms = EXCLUDED.max_processing_time_ms,
    p50_processing_time_ms = EXCLUDED.p50_processing_time_ms,
    p95_processing_time_ms = EXCLUDED.p95_processing_time_ms,
    p99_processing_time_ms = EXCLUDED.p99_processing_time_ms,
    validation_error_count = EXCLUDED.validation_error_count,
    updated_at = NOW();

  RAISE NOTICE 'Daily aggregation completed for %', target_date;
END;
$$ LANGUAGE plpgsql;

-- ===============================================================================
-- 8. SCHEDULE DAILY AGGREGATION (via pg_cron or external scheduler)
-- ===============================================================================

-- Note: pg_cron requires superuser privileges. This should be configured via Supabase Dashboard.
-- For now, document the cron job:
-- SELECT cron.schedule('aggregate-form-submissions-daily', '0 1 * * *', 'SELECT aggregate_form_submissions_daily()');

COMMENT ON FUNCTION aggregate_form_submissions_daily() IS 'Aggregates form submission metrics daily at 1 AM. Schedule via pg_cron or external scheduler.';

-- ===============================================================================
-- 9. NOTIFY POSTGREST TO RELOAD SCHEMA
-- ===============================================================================

SELECT pg_notify('pgrst', 'reload schema');

-- ===============================================================================
-- 10. AUDIT TRAIL (if audit_events table exists)
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
      'form_submissions'::UUID,
      'system',
      jsonb_build_object(
        'migration', '20260114_form_submissions_tracking',
        'purpose', 'Smart form submissions tracking for monitoring and analytics',
        'tables_created', ARRAY['form_submissions', 'form_submissions_daily_metrics'],
        'views_created', ARRAY['vw_form_submissions_metrics'],
        'functions_created', ARRAY['aggregate_form_submissions_daily', 'update_form_submissions_updated_at'],
        'blocker_resolved', 'FOUNDATION_REALITY_REPORT.md - Blocker #1'
      )
    );
    RAISE NOTICE 'Audit event recorded: form_submissions table created';
  END IF;
END $$;

-- ===============================================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- ===============================================================================

-- Verify table exists
-- SELECT table_name, table_type FROM information_schema.tables WHERE table_name = 'form_submissions';

-- Verify indexes
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'form_submissions';

-- Verify RLS enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'form_submissions';

-- Verify view exists
-- SELECT table_name FROM information_schema.views WHERE table_name = 'vw_form_submissions_metrics';

-- ===============================================================================
-- END OF MIGRATION
-- ===============================================================================
