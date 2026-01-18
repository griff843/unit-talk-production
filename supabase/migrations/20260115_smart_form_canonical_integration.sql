-- ===============================================================================
-- Smart Form Canonical Integration
-- Date: 2026-01-15
-- Purpose: Integrate Smart Form with canonical picks + pick_publish tables
--          Consolidate migrations from apps/smart-form/sql/ into central location
--          Ensure Production Charter v3.0 compliance
-- ===============================================================================

-- ===============================================================================
-- IMPORTANT: This migration consolidates Smart Form schema with canonical tables
-- All Smart Form submissions MUST flow through picks + pick_publish tables
-- ===============================================================================

-- ===============================================================================
-- 1. SMART_FORM_SUBMISSIONS - Tracking table for form submissions
-- ===============================================================================
-- This table tracks Smart Form submissions for auditing and analytics
-- The authoritative pick data lives in the canonical `picks` table

CREATE TABLE IF NOT EXISTS smart_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Link to canonical pick
  pick_id UUID NOT NULL REFERENCES picks(id) ON DELETE CASCADE,

  -- Form metadata
  bet_slip_id TEXT NOT NULL,  -- User-facing ID (idempotency key)
  form_version TEXT NOT NULL DEFAULT '3.0-canonical',
  submission_source TEXT NOT NULL DEFAULT 'web' CHECK (submission_source IN ('web', 'mobile', 'api')),

  -- User context
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent TEXT,
  ip_address INET,

  -- Submission tracking
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_duration_ms INTEGER,

  -- Validation results
  validation_passed BOOLEAN NOT NULL DEFAULT true,
  validation_warnings JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT smart_form_submissions_tenant_bet_slip_unique UNIQUE (tenant_id, bet_slip_id)
);

CREATE INDEX IF NOT EXISTS idx_smart_form_submissions_tenant_id
  ON smart_form_submissions(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_smart_form_submissions_pick_id
  ON smart_form_submissions(pick_id);

CREATE INDEX IF NOT EXISTS idx_smart_form_submissions_user_id
  ON smart_form_submissions(tenant_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_smart_form_submissions_bet_slip_id
  ON smart_form_submissions(bet_slip_id);

-- ===============================================================================
-- 2. FORM_VALIDATION_LOGS - Detailed validation tracking
-- ===============================================================================
-- Track all validation attempts for debugging and improvement

CREATE TABLE IF NOT EXISTS form_validation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Submission reference (nullable if validation failed)
  submission_id UUID REFERENCES smart_form_submissions(id) ON DELETE CASCADE,
  bet_slip_id TEXT,

  -- Validation details
  validation_stage TEXT NOT NULL CHECK (validation_stage IN ('client', 'server', 'database')),
  passed BOOLEAN NOT NULL,
  errors JSONB DEFAULT '[]'::jsonb,
  warnings JSONB DEFAULT '[]'::jsonb,

  -- Input data (sanitized)
  input_data JSONB NOT NULL,

  -- Context
  user_id UUID REFERENCES users(id),
  ip_address INET,
  user_agent TEXT,

  -- Timing
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_validation_logs_tenant_id
  ON form_validation_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_form_validation_logs_submission_id
  ON form_validation_logs(submission_id);

CREATE INDEX IF NOT EXISTS idx_form_validation_logs_failed
  ON form_validation_logs(tenant_id, created_at DESC)
  WHERE passed = false;

-- ===============================================================================
-- 3. RATE_LIMIT_TRACKING - Rate limiting enforcement
-- ===============================================================================
-- Track API usage for rate limiting (writes: 10/min per IP+user, reads: 300/min)

CREATE TABLE IF NOT EXISTS rate_limit_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Rate limit key (combination of IP + user_id + endpoint)
  rate_limit_key TEXT NOT NULL,

  -- Tracking
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_end TIMESTAMPTZ NOT NULL,

  -- Context
  ip_address INET NOT NULL,
  user_id UUID REFERENCES users(id),
  endpoint TEXT NOT NULL,
  limit_type TEXT NOT NULL CHECK (limit_type IN ('write', 'read')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT rate_limit_tracking_key_window_unique UNIQUE (rate_limit_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_key_window
  ON rate_limit_tracking(rate_limit_key, window_start DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_ip_window
  ON rate_limit_tracking(ip_address, window_start DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_user_window
  ON rate_limit_tracking(user_id, window_start DESC)
  WHERE user_id IS NOT NULL;

-- Auto-cleanup old rate limit records (keep last 24 hours)
CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_cleanup
  ON rate_limit_tracking(created_at)
  WHERE created_at < NOW() - INTERVAL '24 hours';

-- ===============================================================================
-- 4. HELPER FUNCTIONS
-- ===============================================================================

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_ip_address INET,
  p_user_id UUID,
  p_endpoint TEXT,
  p_limit_type TEXT,
  p_max_requests INTEGER,
  p_window_minutes INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rate_limit_key TEXT;
  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
  v_current_count INTEGER;
BEGIN
  -- Generate rate limit key
  v_rate_limit_key := p_ip_address::TEXT || '_' || COALESCE(p_user_id::TEXT, 'anon') || '_' || p_endpoint;

  -- Define current window
  v_window_start := date_trunc('minute', NOW()) - (EXTRACT(MINUTE FROM NOW())::INTEGER % p_window_minutes) * INTERVAL '1 minute';
  v_window_end := v_window_start + (p_window_minutes * INTERVAL '1 minute');

  -- Get current request count in window
  SELECT COALESCE(request_count, 0) INTO v_current_count
  FROM rate_limit_tracking
  WHERE rate_limit_key = v_rate_limit_key
    AND window_start = v_window_start;

  -- Check if limit exceeded
  IF v_current_count >= p_max_requests THEN
    RETURN false;
  END IF;

  -- Increment or create tracking record
  INSERT INTO rate_limit_tracking (
    rate_limit_key,
    request_count,
    window_start,
    window_end,
    ip_address,
    user_id,
    endpoint,
    limit_type
  ) VALUES (
    v_rate_limit_key,
    1,
    v_window_start,
    v_window_end,
    p_ip_address,
    p_user_id,
    p_endpoint,
    p_limit_type
  )
  ON CONFLICT (rate_limit_key, window_start)
  DO UPDATE SET
    request_count = rate_limit_tracking.request_count + 1,
    updated_at = NOW();

  RETURN true;
END;
$$;

-- Function to record Smart Form submission
CREATE OR REPLACE FUNCTION record_smart_form_submission(
  p_tenant_id UUID,
  p_pick_id UUID,
  p_bet_slip_id TEXT,
  p_user_id UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_submission_id UUID;
BEGIN
  INSERT INTO smart_form_submissions (
    tenant_id,
    pick_id,
    bet_slip_id,
    user_id,
    metadata,
    submitted_at
  ) VALUES (
    p_tenant_id,
    p_pick_id,
    p_bet_slip_id,
    p_user_id,
    p_metadata,
    NOW()
  )
  ON CONFLICT (tenant_id, bet_slip_id) DO UPDATE
  SET
    pick_id = EXCLUDED.pick_id,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_submission_id;

  RETURN v_submission_id;
END;
$$;

-- Function to log form validation
CREATE OR REPLACE FUNCTION log_form_validation(
  p_tenant_id UUID,
  p_bet_slip_id TEXT,
  p_validation_stage TEXT,
  p_passed BOOLEAN,
  p_errors JSONB DEFAULT '[]'::jsonb,
  p_warnings JSONB DEFAULT '[]'::jsonb,
  p_input_data JSONB DEFAULT '{}'::jsonb,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO form_validation_logs (
    tenant_id,
    bet_slip_id,
    validation_stage,
    passed,
    errors,
    warnings,
    input_data,
    user_id
  ) VALUES (
    p_tenant_id,
    p_bet_slip_id,
    p_validation_stage,
    p_passed,
    p_errors,
    p_warnings,
    p_input_data,
    p_user_id
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ===============================================================================
-- 5. VIEWS FOR MONITORING
-- ===============================================================================

-- View: Smart Form submission rate
CREATE OR REPLACE VIEW vw_smart_form_submission_rate AS
SELECT
  date_trunc('hour', submitted_at) as hour,
  tenant_id,
  COUNT(*) as submission_count,
  COUNT(DISTINCT user_id) as unique_users,
  AVG(processing_duration_ms) as avg_processing_ms,
  COUNT(*) FILTER (WHERE validation_passed = false) as failed_validations
FROM smart_form_submissions
WHERE submitted_at >= NOW() - INTERVAL '24 hours'
GROUP BY date_trunc('hour', submitted_at), tenant_id
ORDER BY hour DESC;

-- View: Rate limit violations
CREATE OR REPLACE VIEW vw_rate_limit_violations AS
SELECT
  date_trunc('minute', created_at) as minute,
  ip_address,
  user_id,
  endpoint,
  limit_type,
  MAX(request_count) as peak_requests,
  COUNT(*) as violation_count
FROM rate_limit_tracking
WHERE created_at >= NOW() - INTERVAL '1 hour'
  AND (
    (limit_type = 'write' AND request_count >= 10)
    OR (limit_type = 'read' AND request_count >= 300)
  )
GROUP BY date_trunc('minute', created_at), ip_address, user_id, endpoint, limit_type
ORDER BY minute DESC;

-- ===============================================================================
-- 6. ROW LEVEL SECURITY
-- ===============================================================================

-- Enable RLS
ALTER TABLE smart_form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_validation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_tracking ENABLE ROW LEVEL SECURITY;

-- Smart Form Submissions policies
CREATE POLICY "Smart Form Submissions: Tenant isolation"
  ON smart_form_submissions FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "Smart Form Submissions: Users can view own"
  ON smart_form_submissions FOR SELECT
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    AND user_id = current_setting('app.current_user_id', true)::uuid
  );

CREATE POLICY "Smart Form Submissions: Service role full access"
  ON smart_form_submissions FOR ALL
  USING (current_setting('role', true) = 'service_role');

-- Form Validation Logs policies
CREATE POLICY "Form Validation Logs: Tenant isolation"
  ON form_validation_logs FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "Form Validation Logs: Service role full access"
  ON form_validation_logs FOR ALL
  USING (current_setting('role', true) = 'service_role');

-- Rate Limit Tracking policies (service role only)
CREATE POLICY "Rate Limit Tracking: Service role full access"
  ON rate_limit_tracking FOR ALL
  USING (current_setting('role', true) = 'service_role');

-- ===============================================================================
-- 7. CLEANUP JOBS
-- ===============================================================================

-- Function to cleanup old records
CREATE OR REPLACE FUNCTION cleanup_smart_form_tables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete old rate limit tracking records (> 24 hours)
  DELETE FROM rate_limit_tracking
  WHERE created_at < NOW() - INTERVAL '24 hours';

  -- Delete old validation logs (> 30 days)
  DELETE FROM form_validation_logs
  WHERE created_at < NOW() - INTERVAL '30 days';

  -- Archive old submissions (> 90 days) - optional, commented out by default
  -- DELETE FROM smart_form_submissions
  -- WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- ===============================================================================
-- 8. COMMENTS
-- ===============================================================================

COMMENT ON TABLE smart_form_submissions IS 'Smart Form submission tracking (canonical picks data in picks table)';
COMMENT ON TABLE form_validation_logs IS 'Detailed validation logs for debugging and improvement';
COMMENT ON TABLE rate_limit_tracking IS 'Rate limit enforcement tracking (10/min writes, 300/min reads)';

COMMENT ON FUNCTION check_rate_limit IS 'Check if request is within rate limit (returns true if allowed)';
COMMENT ON FUNCTION record_smart_form_submission IS 'Record Smart Form submission with idempotency';
COMMENT ON FUNCTION log_form_validation IS 'Log form validation attempt for monitoring';
COMMENT ON FUNCTION cleanup_smart_form_tables IS 'Cleanup old Smart Form tracking data';

-- ===============================================================================
-- 9. NOTIFY POSTGREST TO RELOAD SCHEMA
-- ===============================================================================

SELECT pg_notify('pgrst', 'reload schema');

-- ===============================================================================
-- END OF MIGRATION
-- ===============================================================================
