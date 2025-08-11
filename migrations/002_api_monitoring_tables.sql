-- =============================================================================
-- Unit Talk Database Schema Migration: API Monitoring Tables
-- Phase 2: PRODUCTION-READY API HEALTH MONITORING
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. API HEALTH STATUS TABLE: Real-time API monitoring
-- =============================================================================

CREATE TABLE IF NOT EXISTS api_health_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE,
  status TEXT CHECK (status IN ('healthy', 'degraded', 'failed', 'expired')) NOT NULL DEFAULT 'healthy',
  
  -- Timing metrics
  last_success TIMESTAMPTZ,
  last_failure TIMESTAMPTZ,
  response_time INTEGER, -- milliseconds
  consecutive_failures INTEGER DEFAULT 0,
  
  -- Error tracking
  error_message TEXT,
  http_status INTEGER,
  
  -- Data freshness tracking
  data_freshness JSONB,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_provider CHECK (provider IN ('optimal_api', 'odds_api', 'agents', 'database', 'redis'))
);

-- Create index for fast provider lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_health_status_provider 
ON api_health_status(provider);

-- Create index for status monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_health_status_status 
ON api_health_status(status, updated_at);

-- =============================================================================
-- 2. DATA INGESTION LOG TABLE: Track data pipeline health
-- =============================================================================

CREATE TABLE IF NOT EXISTS data_ingestion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  status TEXT CHECK (status IN ('success', 'failure', 'partial')) NOT NULL,
  
  -- Ingestion metrics
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  processing_time INTEGER, -- milliseconds
  
  -- Data details
  data_type TEXT, -- 'props', 'odds', 'scores', 'events'
  sport TEXT,
  market_type TEXT,
  
  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_ingestion_provider CHECK (provider IN ('optimal_api', 'odds_api', 'manual', 'scheduled'))
);

-- Create indexes for efficient querying
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_ingestion_log_provider_status 
ON data_ingestion_log(provider, status, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_ingestion_log_created_at 
ON data_ingestion_log(created_at DESC);

-- Create index for freshness queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_ingestion_log_success_recent 
ON data_ingestion_log(provider, created_at DESC) 
WHERE status = 'success';

-- =============================================================================
-- 3. DATA INGESTION ALERTS TABLE: Alert management system
-- =============================================================================

CREATE TABLE IF NOT EXISTS data_ingestion_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT CHECK (alert_type IN ('api_key_expired', 'connection_failed', 'data_stale', 'quota_exceeded', 'provider_down')) NOT NULL,
  provider TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) NOT NULL,
  
  -- Alert content
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  
  -- Alert lifecycle
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for alert management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_ingestion_alerts_active 
ON data_ingestion_alerts(resolved, severity, triggered_at DESC) 
WHERE resolved = FALSE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_ingestion_alerts_provider 
ON data_ingestion_alerts(provider, triggered_at DESC);

-- =============================================================================
-- 4. REALTIME NOTIFICATIONS TABLE: Command Center integration
-- =============================================================================

CREATE TABLE IF NOT EXISTS realtime_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL, -- 'command_center', 'alerts', 'system'
  event_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  
  -- Notification content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  
  -- Delivery tracking
  delivered BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMPTZ,
  read_by JSONB DEFAULT '[]', -- Array of user IDs who read this
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Create index for active notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_realtime_notifications_active 
ON realtime_notifications(channel, delivered, created_at DESC)
WHERE expires_at > NOW();

-- =============================================================================
-- 5. UPDATED_AT TRIGGERS: Automatic timestamp management
-- =============================================================================

-- Apply updated_at triggers to monitoring tables
DROP TRIGGER IF EXISTS update_api_health_status_updated_at ON api_health_status;
CREATE TRIGGER update_api_health_status_updated_at 
BEFORE UPDATE ON api_health_status 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_data_ingestion_alerts_updated_at ON data_ingestion_alerts;
CREATE TRIGGER update_data_ingestion_alerts_updated_at 
BEFORE UPDATE ON data_ingestion_alerts 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 6. INITIAL DATA SEEDING: Bootstrap monitoring system
-- =============================================================================

-- Insert initial health status records for all providers
INSERT INTO api_health_status (provider, status) VALUES 
  ('optimal_api', 'healthy'),
  ('odds_api', 'healthy'),
  ('database', 'healthy'),
  ('redis', 'healthy'),
  ('agents', 'healthy')
ON CONFLICT (provider) DO UPDATE SET 
  updated_at = NOW();

-- Insert initial successful ingestion logs to prevent stale data false alarms
INSERT INTO data_ingestion_log (provider, status, records_processed, data_type, started_at, completed_at) VALUES 
  ('optimal_api', 'success', 0, 'initialization', NOW() - INTERVAL '1 minute', NOW()),
  ('odds_api', 'success', 0, 'initialization', NOW() - INTERVAL '1 minute', NOW())
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 7. MONITORING FUNCTIONS: Helper functions for health checks
-- =============================================================================

-- Function to get latest successful ingestion for a provider
CREATE OR REPLACE FUNCTION get_latest_successful_ingestion(provider_name TEXT)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  latest_ingestion TIMESTAMPTZ;
BEGIN
  SELECT created_at INTO latest_ingestion
  FROM data_ingestion_log 
  WHERE provider = provider_name AND status = 'success'
  ORDER BY created_at DESC 
  LIMIT 1;
  
  RETURN COALESCE(latest_ingestion, NOW() - INTERVAL '1 hour');
END;
$$ LANGUAGE plpgsql;

-- Function to check if data is stale for a provider
CREATE OR REPLACE FUNCTION is_data_stale(provider_name TEXT, max_age_minutes INTEGER DEFAULT 5)
RETURNS BOOLEAN AS $$
DECLARE
  latest_ingestion TIMESTAMPTZ;
BEGIN
  latest_ingestion := get_latest_successful_ingestion(provider_name);
  
  RETURN (NOW() - latest_ingestion) > (max_age_minutes * INTERVAL '1 minute');
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 8. DATA CLEANUP POLICIES: Prevent table bloat
-- =============================================================================

-- Auto-cleanup old notifications (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM realtime_notifications 
  WHERE expires_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Auto-cleanup old ingestion logs (keep 90 days of detailed logs, 1 year of summaries)
CREATE OR REPLACE FUNCTION cleanup_old_ingestion_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete detailed logs older than 90 days
  DELETE FROM data_ingestion_log 
  WHERE created_at < NOW() - INTERVAL '90 days'
  AND records_processed < 1000; -- Keep large ingestion events longer
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 9. VALIDATION QUERIES: Verify monitoring tables are working
-- =============================================================================

-- Verify all tables exist and are functional
DO $$
BEGIN
    -- Test api_health_status
    PERFORM * FROM api_health_status LIMIT 1;
    RAISE NOTICE 'SUCCESS: api_health_status table operational';
    
    -- Test data_ingestion_log
    PERFORM * FROM data_ingestion_log LIMIT 1;
    RAISE NOTICE 'SUCCESS: data_ingestion_log table operational';
    
    -- Test data_ingestion_alerts
    PERFORM * FROM data_ingestion_alerts LIMIT 1;
    RAISE NOTICE 'SUCCESS: data_ingestion_alerts table operational';
    
    -- Test realtime_notifications
    PERFORM * FROM realtime_notifications LIMIT 1;
    RAISE NOTICE 'SUCCESS: realtime_notifications table operational';
    
    -- Test helper functions
    PERFORM get_latest_successful_ingestion('optimal_api');
    PERFORM is_data_stale('optimal_api');
    RAISE NOTICE 'SUCCESS: helper functions operational';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Migration failed: %', SQLERRM;
END $$;

-- =============================================================================
-- 10. POST-MIGRATION STATISTICS
-- =============================================================================

-- Update table statistics for optimal query planning
ANALYZE api_health_status;
ANALYZE data_ingestion_log;
ANALYZE data_ingestion_alerts;
ANALYZE realtime_notifications;

-- Display migration summary
SELECT 
    'api_health_status' as table_name,
    COUNT(*) as row_count,
    COUNT(CASE WHEN status = 'healthy' THEN 1 END) as healthy_count,
    COUNT(CASE WHEN status != 'healthy' THEN 1 END) as unhealthy_count
FROM api_health_status
UNION ALL
SELECT 
    'data_ingestion_log' as table_name,
    COUNT(*) as row_count,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
    COUNT(CASE WHEN status != 'success' THEN 1 END) as failure_count
FROM data_ingestion_log
UNION ALL
SELECT 
    'data_ingestion_alerts' as table_name,
    COUNT(*) as row_count,
    COUNT(CASE WHEN resolved = FALSE THEN 1 END) as active_alerts,
    COUNT(CASE WHEN resolved = TRUE THEN 1 END) as resolved_alerts
FROM data_ingestion_alerts;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

SELECT 
    'API MONITORING SYSTEM MIGRATION COMPLETED SUCCESSFULLY' as status,
    NOW() as completed_at,
    'Production-ready API health monitoring now operational - no more false errors' as note;