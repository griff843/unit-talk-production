-- Shadow Publish: Create shadow_publish_log table for audit trail
-- Migration: 20250812_shadow_publish_log.sql

-- =============================================================================
-- CREATE SHADOW PUBLISH LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS shadow_publish_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content identification
  content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('pick', 'recap', 'alert', 'notification')),
  content_id UUID,
  
  -- Channel information
  target_channel VARCHAR(255),
  shadow_channel VARCHAR(255),
  
  -- User context
  user_id UUID,
  
  -- Shadow mode state
  shadow_mode_enabled BOOLEAN NOT NULL DEFAULT true,
  public_posting_allowed BOOLEAN NOT NULL DEFAULT false,
  requires_approval BOOLEAN DEFAULT false,
  
  -- Validation results
  warnings JSONB DEFAULT '[]'::jsonb,
  
  -- Execution results
  success BOOLEAN NOT NULL,
  error_message TEXT,
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- CREATE INDEXES
-- =============================================================================

CREATE INDEX idx_shadow_publish_log_created_at ON shadow_publish_log(created_at);
CREATE INDEX idx_shadow_publish_log_content_type ON shadow_publish_log(content_type);
CREATE INDEX idx_shadow_publish_log_user_id ON shadow_publish_log(user_id);
CREATE INDEX idx_shadow_publish_log_success ON shadow_publish_log(success);
CREATE INDEX idx_shadow_publish_log_shadow_mode ON shadow_publish_log(shadow_mode_enabled);

-- =============================================================================
-- ADD SHADOW CONFIGURATION TO SYSTEM_CONFIG
-- =============================================================================

INSERT INTO system_config (key, value, description) VALUES
  ('SHADOW_PRIVATE_CHANNEL_ID', '', 'Discord channel ID for shadow mode previews')
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_config (key, value, description) VALUES
  ('SHADOW_MAX_DAYS', '7', 'Number of days to retain shadow publish logs')
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_config (key, value, description) VALUES
  ('SHADOW_REQUIRE_APPROVAL', 'false', 'Require manual approval for pick promotion in shadow mode')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- CREATE RLS POLICIES
-- =============================================================================

ALTER TABLE shadow_publish_log ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "shadow_publish_log_service_role" ON shadow_publish_log
  FOR ALL USING (current_setting('role') = 'service_role');

-- Allow authenticated users to read their own logs
CREATE POLICY "shadow_publish_log_user_read" ON shadow_publish_log
  FOR SELECT USING (
    auth.role() = 'authenticated' AND 
    (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin')
  );

-- =============================================================================
-- CREATE SHADOW MODE MONITORING VIEW
-- =============================================================================

CREATE OR REPLACE VIEW shadow_mode_status AS
SELECT 
  -- Current configuration
  sc_shadow.value::boolean as shadow_mode_enabled,
  sc_publish.value::boolean as publish_to_discord_enabled,
  sc_channel.value as shadow_channel_id,
  sc_days.value::integer as retention_days,
  sc_approval.value::boolean as requires_approval,
  
  -- Recent activity (last 24 hours)
  (SELECT COUNT(*) FROM shadow_publish_log 
   WHERE created_at > NOW() - INTERVAL '24 hours') as events_24h,
   
  (SELECT COUNT(*) FROM shadow_publish_log 
   WHERE created_at > NOW() - INTERVAL '24 hours' AND success = false) as errors_24h,
   
  -- Content type breakdown (last 24 hours)
  (SELECT COUNT(*) FROM shadow_publish_log 
   WHERE created_at > NOW() - INTERVAL '24 hours' AND content_type = 'pick') as picks_24h,
   
  (SELECT COUNT(*) FROM shadow_publish_log 
   WHERE created_at > NOW() - INTERVAL '24 hours' AND content_type = 'recap') as recaps_24h,
   
  (SELECT COUNT(*) FROM shadow_publish_log 
   WHERE created_at > NOW() - INTERVAL '24 hours' AND content_type = 'alert') as alerts_24h,
   
  -- Cleanup metrics
  (SELECT COUNT(*) FROM shadow_publish_log 
   WHERE created_at < NOW() - (sc_days.value::integer * INTERVAL '1 day')) as old_records_count,
   
  -- Configuration consistency check
  CASE 
    WHEN sc_shadow.value::boolean = true AND sc_publish.value::boolean = true THEN 
      'WARNING: Shadow mode enabled but public posting also enabled'
    WHEN sc_shadow.value::boolean = false AND sc_publish.value::boolean = false THEN 
      'WARNING: Both shadow mode and public posting disabled - no output'
    ELSE 'OK'
  END as config_status
  
FROM system_config sc_shadow
CROSS JOIN system_config sc_publish
CROSS JOIN system_config sc_channel
CROSS JOIN system_config sc_days
CROSS JOIN system_config sc_approval
WHERE sc_shadow.key = 'SHADOW_MODE'
  AND sc_publish.key = 'PUBLISH_TO_DISCORD'
  AND sc_channel.key = 'SHADOW_PRIVATE_CHANNEL_ID'
  AND sc_days.key = 'SHADOW_MAX_DAYS'
  AND sc_approval.key = 'SHADOW_REQUIRE_APPROVAL';

-- =============================================================================
-- CREATE CLEANUP FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_shadow_publish_logs()
RETURNS TABLE(deleted_count INTEGER, retention_days INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_retention_days INTEGER;
  v_cutoff_date TIMESTAMP WITH TIME ZONE;
  v_deleted_count INTEGER;
BEGIN
  -- Get retention period from config
  SELECT value::integer INTO v_retention_days 
  FROM system_config 
  WHERE key = 'SHADOW_MAX_DAYS';
  
  IF v_retention_days IS NULL THEN
    v_retention_days := 7; -- Default
  END IF;
  
  -- Calculate cutoff date
  v_cutoff_date := NOW() - (v_retention_days * INTERVAL '1 day');
  
  -- Delete old records
  WITH deleted_rows AS (
    DELETE FROM shadow_publish_log 
    WHERE created_at < v_cutoff_date
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted_rows;
  
  -- Log cleanup action
  INSERT INTO audit_log (table_name, operation, details)
  VALUES ('shadow_publish_log', 'CLEANUP', jsonb_build_object(
    'deleted_count', v_deleted_count,
    'cutoff_date', v_cutoff_date,
    'retention_days', v_retention_days
  ));
  
  -- Return results
  RETURN QUERY SELECT v_deleted_count, v_retention_days;
END;
$$;

-- =============================================================================
-- CREATE SCHEDULED CLEANUP (if pg_cron extension available)
-- =============================================================================

-- This would be enabled in production if pg_cron is available
-- SELECT cron.schedule(
--   'shadow-log-cleanup',
--   '0 2 * * *', -- Daily at 2 AM
--   'SELECT cleanup_shadow_publish_logs();'
-- );

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant execute permissions on cleanup function
GRANT EXECUTE ON FUNCTION cleanup_shadow_publish_logs() TO service_role;

-- Grant select permissions on monitoring view
GRANT SELECT ON shadow_mode_status TO anon, authenticated, service_role;

-- Grant table permissions
GRANT SELECT, INSERT ON shadow_publish_log TO service_role;
GRANT SELECT ON shadow_publish_log TO authenticated;

-- =============================================================================
-- MIGRATION VERIFICATION
-- =============================================================================

DO $$
BEGIN
  -- Test shadow publish log insertion
  INSERT INTO shadow_publish_log (
    content_type,
    target_channel,
    shadow_mode_enabled,
    public_posting_allowed,
    success,
    metadata
  ) VALUES (
    'pick',
    'test_channel',
    true,
    false,
    true,
    '{"test": "migration_verification"}'::jsonb
  );
  
  -- Test monitoring view
  PERFORM * FROM shadow_mode_status LIMIT 1;
  
  -- Test cleanup function
  PERFORM * FROM cleanup_shadow_publish_logs();
  
  -- Cleanup test data
  DELETE FROM shadow_publish_log WHERE metadata ->> 'test' = 'migration_verification';
  
  RAISE NOTICE 'Shadow publish log migration verification successful';
END;
$$;

-- Migration completed
INSERT INTO audit_log (table_name, operation, details)
VALUES ('migration', 'COMPLETE', jsonb_build_object(
  'migration', '20250812_shadow_publish_log',
  'timestamp', NOW(),
  'description', 'Shadow publish logging and monitoring system'
));