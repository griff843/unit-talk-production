-- DLQ Outbox Pattern: Create tables for reliable external service delivery
-- Migration: 20250812_dlq_outbox_pattern.sql

-- =============================================================================
-- CREATE OUTBOX TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event identification
  event_type VARCHAR(100) NOT NULL,
  event_source VARCHAR(100) NOT NULL, -- 'discord', 'notion', 'email', etc.
  aggregate_id UUID NOT NULL, -- Related entity ID (pick_id, user_id, etc.)
  
  -- Event data
  event_data JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  
  -- Delivery tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'dead_letter')),
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  
  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  -- Error tracking
  last_error TEXT DEFAULT NULL,
  error_details JSONB DEFAULT NULL,
  
  -- Idempotency and deduplication
  idempotency_key VARCHAR(255) UNIQUE DEFAULT NULL,
  correlation_id UUID DEFAULT NULL,
  
  -- Partitioning helper
  partition_key DATE GENERATED ALWAYS AS (DATE(created_at)) STORED
);

-- =============================================================================
-- CREATE DLQ TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Original event reference
  original_event_id UUID REFERENCES outbox_events(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL,
  event_source VARCHAR(100) NOT NULL,
  
  -- Failed event data
  event_data JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  
  -- Failure tracking
  total_attempts INTEGER NOT NULL,
  final_error TEXT NOT NULL,
  error_history JSONB DEFAULT '[]',
  failure_reason VARCHAR(200) NOT NULL,
  
  -- Timing
  first_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL,
  final_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL,
  moved_to_dlq_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Recovery tracking
  recovery_status VARCHAR(20) DEFAULT 'unprocessed' CHECK (recovery_status IN ('unprocessed', 'investigating', 'fixed', 'discarded')),
  recovery_notes TEXT DEFAULT NULL,
  recovered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  recovered_by VARCHAR(255) DEFAULT NULL,
  
  -- Manual intervention
  requires_manual_review BOOLEAN DEFAULT TRUE,
  business_impact VARCHAR(20) DEFAULT 'medium' CHECK (business_impact IN ('low', 'medium', 'high', 'critical')),
  
  -- Re-processing
  can_retry BOOLEAN DEFAULT TRUE,
  retry_after TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  -- Partitioning helper
  partition_key DATE GENERATED ALWAYS AS (DATE(moved_to_dlq_at)) STORED
);

-- =============================================================================
-- CREATE EXTERNAL SERVICE CONFIGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS external_service_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Service identification
  service_name VARCHAR(100) NOT NULL UNIQUE,
  service_type VARCHAR(50) NOT NULL, -- 'webhook', 'api', 'notification', etc.
  
  -- Configuration
  endpoint_url VARCHAR(500) NOT NULL,
  timeout_seconds INTEGER DEFAULT 30,
  
  -- Retry configuration
  max_attempts INTEGER DEFAULT 5,
  initial_delay_ms INTEGER DEFAULT 1000,
  max_delay_ms INTEGER DEFAULT 300000, -- 5 minutes
  backoff_multiplier DECIMAL(3,2) DEFAULT 2.0,
  jitter_enabled BOOLEAN DEFAULT TRUE,
  
  -- Rate limiting
  rate_limit_per_minute INTEGER DEFAULT 60,
  burst_limit INTEGER DEFAULT 10,
  
  -- Circuit breaker
  circuit_breaker_enabled BOOLEAN DEFAULT TRUE,
  failure_threshold INTEGER DEFAULT 10,
  recovery_timeout_seconds INTEGER DEFAULT 60,
  
  -- Health check
  health_check_url VARCHAR(500) DEFAULT NULL,
  health_check_interval_seconds INTEGER DEFAULT 300,
  
  -- Security
  auth_type VARCHAR(50) DEFAULT 'bearer' CHECK (auth_type IN ('none', 'bearer', 'basic', 'api_key', 'oauth')),
  auth_config JSONB DEFAULT '{}', -- Encrypted auth details
  
  -- Status
  enabled BOOLEAN DEFAULT TRUE,
  last_health_check TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  health_status VARCHAR(20) DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- CREATE DELIVERY ATTEMPTS LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event reference
  event_id UUID REFERENCES outbox_events(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  
  -- Attempt details
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  duration_ms INTEGER NOT NULL,
  
  -- HTTP details (if applicable)
  http_status_code INTEGER DEFAULT NULL,
  http_response_body TEXT DEFAULT NULL,
  http_headers JSONB DEFAULT NULL,
  
  -- Error details
  error_type VARCHAR(100) DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  error_stack_trace TEXT DEFAULT NULL,
  
  -- Retry information
  next_retry_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  retry_delay_ms INTEGER DEFAULT NULL,
  
  -- Context
  service_name VARCHAR(100) NOT NULL,
  endpoint_url VARCHAR(500) NOT NULL,
  request_payload JSONB DEFAULT NULL,
  
  -- Partitioning helper
  partition_key DATE GENERATED ALWAYS AS (DATE(attempted_at)) STORED
);

-- =============================================================================
-- CREATE CIRCUIT BREAKER STATES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS circuit_breaker_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Service identification
  service_name VARCHAR(100) NOT NULL UNIQUE,
  
  -- Circuit breaker state
  state VARCHAR(20) NOT NULL DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half_open')),
  failure_count INTEGER DEFAULT 0,
  last_failure_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  -- State transitions
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  last_success_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  next_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  -- Metrics
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN total_requests = 0 THEN 100.0
      ELSE (successful_requests::DECIMAL / total_requests::DECIMAL) * 100
    END
  ) STORED,
  
  -- Configuration reference
  service_config_id UUID REFERENCES external_service_configs(id),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- Outbox events indexes
CREATE INDEX idx_outbox_events_status_scheduled ON outbox_events(status, scheduled_at) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_outbox_events_source_created ON outbox_events(event_source, created_at);
CREATE INDEX idx_outbox_events_aggregate_id ON outbox_events(aggregate_id);
CREATE INDEX idx_outbox_events_idempotency ON outbox_events(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_outbox_events_correlation ON outbox_events(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_outbox_events_partition_key ON outbox_events(partition_key, status);

-- Dead letter queue indexes
CREATE INDEX idx_dlq_recovery_status ON dead_letter_queue(recovery_status, moved_to_dlq_at);
CREATE INDEX idx_dlq_business_impact ON dead_letter_queue(business_impact, moved_to_dlq_at) WHERE recovery_status = 'unprocessed';
CREATE INDEX idx_dlq_event_type_source ON dead_letter_queue(event_type, event_source);
CREATE INDEX idx_dlq_can_retry ON dead_letter_queue(can_retry, retry_after) WHERE can_retry = TRUE;

-- Delivery attempts indexes
CREATE INDEX idx_delivery_attempts_event_id ON delivery_attempts(event_id, attempt_number);
CREATE INDEX idx_delivery_attempts_service ON delivery_attempts(service_name, attempted_at);
CREATE INDEX idx_delivery_attempts_success ON delivery_attempts(success, attempted_at);

-- External service configs indexes
CREATE INDEX idx_service_configs_enabled ON external_service_configs(enabled, service_name) WHERE enabled = TRUE;
CREATE INDEX idx_service_configs_health ON external_service_configs(health_status, last_health_check);

-- Circuit breaker states indexes
CREATE INDEX idx_circuit_breaker_state ON circuit_breaker_states(state, service_name);
CREATE INDEX idx_circuit_breaker_next_attempt ON circuit_breaker_states(next_attempt_at) WHERE state = 'open';

-- =============================================================================
-- CREATE OUTBOX PROCESSING FUNCTIONS
-- =============================================================================

-- Function to queue outbox event
CREATE OR REPLACE FUNCTION queue_outbox_event(
  p_event_type VARCHAR(100),
  p_event_source VARCHAR(100),
  p_aggregate_id UUID,
  p_event_data JSONB,
  p_metadata JSONB DEFAULT NULL,
  p_idempotency_key VARCHAR(255) DEFAULT NULL,
  p_correlation_id UUID DEFAULT NULL,
  p_scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id UUID;
  v_existing_event UUID;
BEGIN
  -- Check for existing event with same idempotency key
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_event
    FROM outbox_events
    WHERE idempotency_key = p_idempotency_key;
    
    IF v_existing_event IS NOT NULL THEN
      RETURN v_existing_event; -- Return existing event ID
    END IF;
  END IF;
  
  -- Insert new event
  INSERT INTO outbox_events (
    event_type,
    event_source,
    aggregate_id,
    event_data,
    metadata,
    idempotency_key,
    correlation_id,
    scheduled_at
  ) VALUES (
    p_event_type,
    p_event_source,
    p_aggregate_id,
    p_event_data,
    COALESCE(p_metadata, '{}'),
    p_idempotency_key,
    p_correlation_id,
    COALESCE(p_scheduled_at, NOW())
  ) RETURNING id INTO v_event_id;
  
  -- Log event creation
  INSERT INTO audit_log (table_name, operation, details)
  VALUES ('outbox_events', 'INSERT', jsonb_build_object(
    'event_id', v_event_id,
    'event_type', p_event_type,
    'event_source', p_event_source,
    'aggregate_id', p_aggregate_id
  ));
  
  RETURN v_event_id;
END;
$$;

-- Function to mark event as delivered
CREATE OR REPLACE FUNCTION mark_event_delivered(
  p_event_id UUID,
  p_delivery_duration_ms INTEGER DEFAULT NULL
) RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated BOOLEAN := FALSE;
BEGIN
  UPDATE outbox_events
  SET 
    status = 'delivered',
    delivered_at = NOW()
  WHERE id = p_event_id AND status != 'delivered'
  RETURNING TRUE INTO v_updated;
  
  -- Log successful delivery
  IF v_updated THEN
    INSERT INTO delivery_attempts (
      event_id,
      attempt_number,
      success,
      duration_ms,
      service_name,
      endpoint_url
    ) SELECT 
      p_event_id,
      attempt_count + 1,
      TRUE,
      COALESCE(p_delivery_duration_ms, 0),
      event_source,
      'delivered'
    FROM outbox_events
    WHERE id = p_event_id;
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Function to move event to DLQ
CREATE OR REPLACE FUNCTION move_to_dead_letter_queue(
  p_event_id UUID,
  p_failure_reason VARCHAR(200),
  p_final_error TEXT
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_record RECORD;
  v_dlq_id UUID;
  v_error_history JSONB;
BEGIN
  -- Get event details
  SELECT * INTO v_event_record
  FROM outbox_events
  WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;
  
  -- Build error history
  SELECT jsonb_agg(
    jsonb_build_object(
      'attempt_number', attempt_number,
      'attempted_at', attempted_at,
      'error_type', error_type,
      'error_message', error_message,
      'http_status_code', http_status_code
    ) ORDER BY attempt_number
  ) INTO v_error_history
  FROM delivery_attempts
  WHERE event_id = p_event_id AND success = FALSE;
  
  -- Insert into DLQ
  INSERT INTO dead_letter_queue (
    original_event_id,
    event_type,
    event_source,
    event_data,
    metadata,
    total_attempts,
    final_error,
    error_history,
    failure_reason,
    first_attempt_at,
    final_attempt_at,
    business_impact
  ) VALUES (
    p_event_id,
    v_event_record.event_type,
    v_event_record.event_source,
    v_event_record.event_data,
    v_event_record.metadata,
    v_event_record.attempt_count,
    p_final_error,
    COALESCE(v_error_history, '[]'),
    p_failure_reason,
    v_event_record.created_at,
    v_event_record.last_attempt_at,
    CASE 
      WHEN v_event_record.event_type LIKE '%critical%' THEN 'critical'
      WHEN v_event_record.event_type LIKE '%alert%' THEN 'high'
      ELSE 'medium'
    END
  ) RETURNING id INTO v_dlq_id;
  
  -- Update original event status
  UPDATE outbox_events
  SET status = 'dead_letter'
  WHERE id = p_event_id;
  
  -- Log DLQ movement
  INSERT INTO audit_log (table_name, operation, details)
  VALUES ('dead_letter_queue', 'INSERT', jsonb_build_object(
    'dlq_id', v_dlq_id,
    'original_event_id', p_event_id,
    'failure_reason', p_failure_reason,
    'total_attempts', v_event_record.attempt_count
  ));
  
  RETURN v_dlq_id;
END;
$$;

-- Function to record delivery attempt
CREATE OR REPLACE FUNCTION record_delivery_attempt(
  p_event_id UUID,
  p_success BOOLEAN,
  p_duration_ms INTEGER,
  p_error_type VARCHAR(100) DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_http_status_code INTEGER DEFAULT NULL,
  p_next_retry_delay_ms INTEGER DEFAULT NULL
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_attempt_id UUID;
  v_attempt_number INTEGER;
  v_event_record RECORD;
  v_next_retry_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get event and increment attempt count
  UPDATE outbox_events
  SET 
    attempt_count = attempt_count + 1,
    last_attempt_at = NOW(),
    status = CASE 
      WHEN p_success THEN 'delivered'
      WHEN attempt_count + 1 >= max_attempts THEN 'failed'
      ELSE 'pending'
    END,
    delivered_at = CASE WHEN p_success THEN NOW() ELSE delivered_at END,
    last_error = CASE WHEN NOT p_success THEN p_error_message ELSE last_error END
  WHERE id = p_event_id
  RETURNING *, attempt_count INTO v_event_record, v_attempt_number;
  
  -- Calculate next retry time
  IF NOT p_success AND p_next_retry_delay_ms IS NOT NULL THEN
    v_next_retry_at := NOW() + (p_next_retry_delay_ms || ' milliseconds')::INTERVAL;
    
    UPDATE outbox_events
    SET scheduled_at = v_next_retry_at
    WHERE id = p_event_id;
  END IF;
  
  -- Record the attempt
  INSERT INTO delivery_attempts (
    event_id,
    attempt_number,
    success,
    duration_ms,
    http_status_code,
    error_type,
    error_message,
    next_retry_at,
    retry_delay_ms,
    service_name,
    endpoint_url
  ) VALUES (
    p_event_id,
    v_attempt_number,
    p_success,
    p_duration_ms,
    p_http_status_code,
    p_error_type,
    p_error_message,
    v_next_retry_at,
    p_next_retry_delay_ms,
    v_event_record.event_source,
    'attempted'
  ) RETURNING id INTO v_attempt_id;
  
  RETURN v_attempt_id;
END;
$$;

-- Function to get pending events for processing
CREATE OR REPLACE FUNCTION get_pending_outbox_events(
  p_limit INTEGER DEFAULT 100,
  p_event_source VARCHAR(100) DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  event_type VARCHAR(100),
  event_source VARCHAR(100),
  aggregate_id UUID,
  event_data JSONB,
  metadata JSONB,
  attempt_count INTEGER,
  max_attempts INTEGER,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.event_type,
    e.event_source,
    e.aggregate_id,
    e.event_data,
    e.metadata,
    e.attempt_count,
    e.max_attempts,
    e.scheduled_at,
    e.created_at
  FROM outbox_events e
  WHERE 
    e.status = 'pending'
    AND e.scheduled_at <= NOW()
    AND (p_event_source IS NULL OR e.event_source = p_event_source)
    AND e.attempt_count < e.max_attempts
  ORDER BY e.scheduled_at ASC, e.created_at ASC
  LIMIT p_limit;
END;
$$;

-- Function to update circuit breaker state
CREATE OR REPLACE FUNCTION update_circuit_breaker_state(
  p_service_name VARCHAR(100),
  p_success BOOLEAN
) RETURNS VARCHAR(20)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_state VARCHAR(20);
  v_failure_count INTEGER;
  v_config RECORD;
  v_new_state VARCHAR(20);
BEGIN
  -- Get service configuration
  SELECT 
    c.failure_threshold,
    c.recovery_timeout_seconds,
    c.circuit_breaker_enabled
  INTO v_config
  FROM external_service_configs c
  WHERE c.service_name = p_service_name AND c.enabled = TRUE;
  
  IF NOT FOUND OR NOT v_config.circuit_breaker_enabled THEN
    RETURN 'disabled';
  END IF;
  
  -- Get or create circuit breaker state
  INSERT INTO circuit_breaker_states (service_name, service_config_id)
  VALUES (
    p_service_name,
    (SELECT id FROM external_service_configs WHERE service_name = p_service_name)
  )
  ON CONFLICT (service_name) DO NOTHING;
  
  -- Update state based on success/failure
  IF p_success THEN
    UPDATE circuit_breaker_states
    SET 
      state = 'closed',
      failure_count = 0,
      last_success_at = NOW(),
      successful_requests = successful_requests + 1,
      total_requests = total_requests + 1,
      updated_at = NOW()
    WHERE service_name = p_service_name
    RETURNING state INTO v_new_state;
  ELSE
    UPDATE circuit_breaker_states
    SET 
      failure_count = failure_count + 1,
      last_failure_at = NOW(),
      failed_requests = failed_requests + 1,
      total_requests = total_requests + 1,
      state = CASE 
        WHEN failure_count + 1 >= v_config.failure_threshold THEN 'open'
        ELSE state
      END,
      opened_at = CASE 
        WHEN failure_count + 1 >= v_config.failure_threshold AND state != 'open' THEN NOW()
        ELSE opened_at
      END,
      next_attempt_at = CASE 
        WHEN failure_count + 1 >= v_config.failure_threshold THEN NOW() + (v_config.recovery_timeout_seconds || ' seconds')::INTERVAL
        ELSE next_attempt_at
      END,
      updated_at = NOW()
    WHERE service_name = p_service_name
    RETURNING state INTO v_new_state;
  END IF;
  
  RETURN v_new_state;
END;
$$;

-- =============================================================================
-- CREATE MONITORING VIEWS
-- =============================================================================

-- Outbox status summary view
CREATE OR REPLACE VIEW outbox_status_summary AS
SELECT 
  event_source,
  status,
  COUNT(*) as event_count,
  MIN(created_at) as oldest_event,
  MAX(created_at) as newest_event,
  AVG(attempt_count) as avg_attempts
FROM outbox_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_source, status
ORDER BY event_source, status;

-- Dead letter queue summary view
CREATE OR REPLACE VIEW dlq_summary AS
SELECT 
  event_source,
  business_impact,
  recovery_status,
  COUNT(*) as dlq_count,
  MIN(moved_to_dlq_at) as oldest_dlq_entry,
  MAX(moved_to_dlq_at) as newest_dlq_entry,
  AVG(total_attempts) as avg_failed_attempts
FROM dead_letter_queue
WHERE moved_to_dlq_at > NOW() - INTERVAL '7 days'
GROUP BY event_source, business_impact, recovery_status
ORDER BY business_impact DESC, dlq_count DESC;

-- Service health view
CREATE OR REPLACE VIEW service_health_summary AS
SELECT 
  sc.service_name,
  sc.service_type,
  sc.health_status,
  sc.enabled,
  cbs.state as circuit_breaker_state,
  cbs.success_rate,
  cbs.total_requests as cb_total_requests,
  sc.last_health_check,
  COUNT(oe.id) FILTER (WHERE oe.status = 'pending') as pending_events,
  COUNT(oe.id) FILTER (WHERE oe.status = 'failed') as failed_events,
  COUNT(dlq.id) as dlq_events
FROM external_service_configs sc
LEFT JOIN circuit_breaker_states cbs ON sc.service_name = cbs.service_name
LEFT JOIN outbox_events oe ON sc.service_name = oe.event_source AND oe.created_at > NOW() - INTERVAL '1 hour'
LEFT JOIN dead_letter_queue dlq ON sc.service_name = dlq.event_source AND dlq.moved_to_dlq_at > NOW() - INTERVAL '24 hours'
GROUP BY 
  sc.service_name, sc.service_type, sc.health_status, sc.enabled,
  cbs.state, cbs.success_rate, cbs.total_requests, sc.last_health_check
ORDER BY sc.service_name;

-- =============================================================================
-- ENABLE RLS
-- =============================================================================

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dead_letter_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_service_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE circuit_breaker_states ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "outbox_service_role" ON outbox_events
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "dlq_service_role" ON dead_letter_queue
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "service_configs_service_role" ON external_service_configs
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "delivery_attempts_service_role" ON delivery_attempts
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "circuit_breaker_service_role" ON circuit_breaker_states
  FOR ALL USING (current_setting('role') = 'service_role');

-- Authenticated users can read outbox and DLQ data
CREATE POLICY "outbox_read" ON outbox_events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "dlq_read" ON dead_letter_queue
  FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION queue_outbox_event TO service_role;
GRANT EXECUTE ON FUNCTION mark_event_delivered TO service_role;
GRANT EXECUTE ON FUNCTION move_to_dead_letter_queue TO service_role;
GRANT EXECUTE ON FUNCTION record_delivery_attempt TO service_role;
GRANT EXECUTE ON FUNCTION get_pending_outbox_events TO service_role;
GRANT EXECUTE ON FUNCTION update_circuit_breaker_state TO service_role;

GRANT SELECT ON outbox_status_summary TO anon, authenticated, service_role;
GRANT SELECT ON dlq_summary TO anon, authenticated, service_role;
GRANT SELECT ON service_health_summary TO anon, authenticated, service_role;

-- =============================================================================
-- CREATE INITIAL SERVICE CONFIGURATIONS
-- =============================================================================

INSERT INTO external_service_configs (
  service_name, service_type, endpoint_url, timeout_seconds,
  max_attempts, initial_delay_ms, max_delay_ms, backoff_multiplier,
  rate_limit_per_minute, circuit_breaker_enabled, auth_type
) VALUES 
  ('discord', 'webhook', 'https://discord.com/api/webhooks/...', 30,
   5, 1000, 300000, 2.0, 50, TRUE, 'none'),
   
  ('notion', 'api', 'https://api.notion.com/v1/', 15,
   3, 2000, 180000, 1.5, 30, TRUE, 'bearer'),
   
  ('email', 'notification', 'smtp://smtp.gmail.com:587', 30,
   3, 5000, 300000, 2.0, 60, FALSE, 'basic'),
   
  ('slack', 'webhook', 'https://hooks.slack.com/services/...', 20,
   5, 1000, 240000, 2.0, 60, TRUE, 'none')

ON CONFLICT (service_name) DO UPDATE SET
  endpoint_url = EXCLUDED.endpoint_url,
  updated_at = NOW();

-- =============================================================================
-- MIGRATION VERIFICATION
-- =============================================================================

DO $$
DECLARE
  v_event_id UUID;
  v_attempt_id UUID;
  v_dlq_id UUID;
  v_circuit_state VARCHAR(20);
BEGIN
  -- Test event queueing
  SELECT queue_outbox_event(
    'pick_alert',
    'discord',
    gen_random_uuid(),
    '{"message": "Test alert", "channel": "alerts"}'::jsonb,
    '{"priority": "high"}'::jsonb,
    'test-idempotency-key-' || EXTRACT(EPOCH FROM NOW())::text
  ) INTO v_event_id;
  
  -- Test delivery attempt recording
  SELECT record_delivery_attempt(
    v_event_id,
    FALSE,
    1500,
    'timeout',
    'Request timeout after 30 seconds',
    NULL,
    5000
  ) INTO v_attempt_id;
  
  -- Test circuit breaker update
  SELECT update_circuit_breaker_state('discord', FALSE) INTO v_circuit_state;
  
  -- Test DLQ movement
  SELECT move_to_dead_letter_queue(
    v_event_id,
    'Max attempts exceeded',
    'Failed after 5 attempts with various errors'
  ) INTO v_dlq_id;
  
  -- Test views
  PERFORM * FROM outbox_status_summary LIMIT 1;
  PERFORM * FROM dlq_summary LIMIT 1;
  PERFORM * FROM service_health_summary LIMIT 1;
  
  -- Cleanup test data
  DELETE FROM delivery_attempts WHERE event_id = v_event_id;
  DELETE FROM dead_letter_queue WHERE id = v_dlq_id;
  DELETE FROM outbox_events WHERE id = v_event_id;
  
  RAISE NOTICE 'DLQ outbox pattern verification successful';
END;
$$;

-- Migration completed
INSERT INTO audit_log (table_name, operation, details)
VALUES ('migration', 'COMPLETE', jsonb_build_object(
  'migration', '20250812_dlq_outbox_pattern',
  'timestamp', NOW(),
  'description', 'Dead letter queue outbox pattern for reliable external service delivery with retry logic and circuit breakers'
));