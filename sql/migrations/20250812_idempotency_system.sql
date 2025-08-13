-- Idempotency & Deduplication: DB-backed uniqueness for ingestion/promotion
-- Ensures operations can be safely retried without creating duplicates
-- Migration: 20250812_idempotency_system.sql

-- =============================================================================
-- CREATE IDEMPOTENCY TRACKING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Idempotency key and operation identification
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  operation_type VARCHAR(100) NOT NULL, -- 'ingest', 'score', 'promote', 'settle'
  
  -- Request fingerprint for validation
  request_hash VARCHAR(64) NOT NULL, -- SHA-256 of request parameters
  
  -- Operation state tracking
  status VARCHAR(50) NOT NULL DEFAULT 'processing', -- 'processing', 'completed', 'failed'
  result_data JSONB DEFAULT NULL, -- Operation result (e.g., created record ID)
  error_message TEXT DEFAULT NULL,
  
  -- Request context
  user_id UUID DEFAULT NULL,
  source_ip INET DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  
  -- Constraints
  CONSTRAINT check_status CHECK (status IN ('processing', 'completed', 'failed')),
  CONSTRAINT check_completed_at CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR 
    (status != 'completed' AND completed_at IS NULL)
  )
);

-- =============================================================================
-- CREATE DEDUPLICATION TRACKING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS deduplication_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content identification
  content_type VARCHAR(100) NOT NULL, -- 'raw_prop', 'scored_prop', 'final_pick'
  content_hash VARCHAR(64) NOT NULL, -- SHA-256 of normalized content
  
  -- Related record information
  record_id UUID NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  
  -- Business key information (for human debugging)
  business_key JSONB NOT NULL, -- e.g., {provider, external_id, sport, player}
  
  -- Deduplication metadata
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  occurrence_count INTEGER DEFAULT 1,
  
  -- Index for performance
  UNIQUE(content_type, content_hash)
);

-- =============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- Idempotency keys indexes
CREATE INDEX idx_idempotency_keys_key ON idempotency_keys(idempotency_key);
CREATE INDEX idx_idempotency_keys_operation ON idempotency_keys(operation_type);
CREATE INDEX idx_idempotency_keys_status ON idempotency_keys(status);
CREATE INDEX idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_keys_created_at ON idempotency_keys(created_at);

-- Deduplication hashes indexes
CREATE INDEX idx_dedup_hashes_content_type ON deduplication_hashes(content_type);
CREATE INDEX idx_dedup_hashes_record_id ON deduplication_hashes(record_id);
CREATE INDEX idx_dedup_hashes_first_seen ON deduplication_hashes(first_seen_at);

-- =============================================================================
-- IDEMPOTENCY MANAGEMENT FUNCTIONS
-- =============================================================================

-- Function to register idempotent operation
CREATE OR REPLACE FUNCTION register_idempotent_operation(
  p_idempotency_key VARCHAR(255),
  p_operation_type VARCHAR(100),
  p_request_hash VARCHAR(64),
  p_user_id UUID DEFAULT NULL,
  p_source_ip INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_record idempotency_keys%ROWTYPE;
  v_result JSONB;
BEGIN
  -- Check for existing idempotency key
  SELECT * INTO v_existing_record 
  FROM idempotency_keys 
  WHERE idempotency_key = p_idempotency_key;
  
  IF FOUND THEN
    -- Validate request consistency
    IF v_existing_record.request_hash != p_request_hash THEN
      RAISE EXCEPTION 'Idempotency key conflict: same key with different request parameters';
    END IF;
    
    -- Return existing operation status
    RETURN jsonb_build_object(
      'operation_id', v_existing_record.id,
      'status', v_existing_record.status,
      'result_data', v_existing_record.result_data,
      'error_message', v_existing_record.error_message,
      'created_at', v_existing_record.created_at,
      'completed_at', v_existing_record.completed_at,
      'is_retry', true
    );
  END IF;
  
  -- Register new operation
  INSERT INTO idempotency_keys (
    idempotency_key,
    operation_type,
    request_hash,
    user_id,
    source_ip,
    user_agent,
    status,
    expires_at
  ) VALUES (
    p_idempotency_key,
    p_operation_type,
    p_request_hash,
    p_user_id,
    p_source_ip,
    p_user_agent,
    'processing',
    NOW() + INTERVAL '24 hours'
  ) RETURNING * INTO v_existing_record;
  
  RETURN jsonb_build_object(
    'operation_id', v_existing_record.id,
    'status', 'processing',
    'result_data', NULL,
    'error_message', NULL,
    'created_at', v_existing_record.created_at,
    'completed_at', NULL,
    'is_retry', false
  );
END;
$$;

-- Function to complete idempotent operation
CREATE OR REPLACE FUNCTION complete_idempotent_operation(
  p_idempotency_key VARCHAR(255),
  p_result_data JSONB,
  p_status VARCHAR(50) DEFAULT 'completed',
  p_error_message TEXT DEFAULT NULL
) RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Validate status
  IF p_status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid completion status: %. Must be completed or failed', p_status;
  END IF;
  
  -- Update operation record
  UPDATE idempotency_keys 
  SET 
    status = p_status,
    result_data = p_result_data,
    error_message = p_error_message,
    completed_at = NOW()
  WHERE idempotency_key = p_idempotency_key 
    AND status = 'processing';
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  IF v_updated_count = 0 THEN
    RAISE EXCEPTION 'Idempotency key not found or already completed: %', p_idempotency_key;
  END IF;
  
  -- Log completion
  INSERT INTO audit_log (table_name, operation, details)
  VALUES ('idempotency_keys', 'COMPLETE', jsonb_build_object(
    'idempotency_key', p_idempotency_key,
    'status', p_status,
    'has_error', p_error_message IS NOT NULL
  ));
  
  RETURN true;
END;
$$;

-- =============================================================================
-- DEDUPLICATION FUNCTIONS
-- =============================================================================

-- Function to check for duplicate content
CREATE OR REPLACE FUNCTION check_content_duplicate(
  p_content_type VARCHAR(100),
  p_content_hash VARCHAR(64),
  p_business_key JSONB
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_record deduplication_hashes%ROWTYPE;
BEGIN
  -- Look for existing content hash
  SELECT * INTO v_existing_record 
  FROM deduplication_hashes 
  WHERE content_type = p_content_type 
    AND content_hash = p_content_hash;
  
  IF FOUND THEN
    -- Update occurrence tracking
    UPDATE deduplication_hashes 
    SET 
      last_seen_at = NOW(),
      occurrence_count = occurrence_count + 1
    WHERE id = v_existing_record.id;
    
    RETURN jsonb_build_object(
      'is_duplicate', true,
      'existing_record_id', v_existing_record.record_id,
      'table_name', v_existing_record.table_name,
      'first_seen_at', v_existing_record.first_seen_at,
      'occurrence_count', v_existing_record.occurrence_count + 1
    );
  END IF;
  
  RETURN jsonb_build_object(
    'is_duplicate', false
  );
END;
$$;

-- Function to register content hash
CREATE OR REPLACE FUNCTION register_content_hash(
  p_content_type VARCHAR(100),
  p_content_hash VARCHAR(64),
  p_record_id UUID,
  p_table_name VARCHAR(100),
  p_business_key JSONB
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_dedup_id UUID;
BEGIN
  INSERT INTO deduplication_hashes (
    content_type,
    content_hash,
    record_id,
    table_name,
    business_key
  ) VALUES (
    p_content_type,
    p_content_hash,
    p_record_id,
    p_table_name,
    p_business_key
  ) ON CONFLICT (content_type, content_hash) DO UPDATE SET
    last_seen_at = NOW(),
    occurrence_count = deduplication_hashes.occurrence_count + 1
  RETURNING id INTO v_dedup_id;
  
  RETURN v_dedup_id;
END;
$$;

-- =============================================================================
-- ENHANCED INGESTION FUNCTION WITH IDEMPOTENCY
-- =============================================================================

CREATE OR REPLACE FUNCTION app.ingest_raw_prop_idempotent(
  p_idempotency_key VARCHAR(255),
  p_provider_name VARCHAR(100),
  p_external_prop_id VARCHAR(255),
  p_sport VARCHAR(50),
  p_player_name VARCHAR(255),
  p_stat_type VARCHAR(100),
  p_line DECIMAL(10,2),
  p_over_odds INTEGER,
  p_under_odds INTEGER,
  p_game_start TIMESTAMP WITH TIME ZONE,
  p_source_data JSONB DEFAULT NULL,
  p_request_context JSONB DEFAULT NULL
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_request_hash VARCHAR(64);
  v_idempotency_result JSONB;
  v_content_hash VARCHAR(64);
  v_duplicate_check JSONB;
  v_raw_prop_id UUID;
  v_business_key JSONB;
  v_final_result JSONB;
BEGIN
  -- Generate request hash for validation
  v_request_hash := encode(
    sha256(
      (p_provider_name || p_external_prop_id || p_sport || p_player_name || 
       p_stat_type || p_line::text || p_over_odds::text || p_under_odds::text ||
       p_game_start::text)::bytea
    ), 'hex'
  );
  
  -- Register idempotent operation
  v_idempotency_result := register_idempotent_operation(
    p_idempotency_key,
    'ingest_raw_prop',
    v_request_hash,
    (p_request_context->>'user_id')::UUID,
    (p_request_context->>'source_ip')::INET,
    p_request_context->>'user_agent'
  );
  
  -- If operation already completed, return cached result
  IF (v_idempotency_result->>'is_retry')::boolean = true THEN
    IF (v_idempotency_result->>'status') = 'completed' THEN
      RETURN v_idempotency_result->'result_data';
    ELSIF (v_idempotency_result->>'status') = 'failed' THEN
      RAISE EXCEPTION 'Previous operation failed: %', v_idempotency_result->>'error_message';
    ELSE
      RAISE EXCEPTION 'Operation still processing';
    END IF;
  END IF;
  
  -- Generate content hash for deduplication
  v_content_hash := encode(
    sha256(
      (p_provider_name || p_external_prop_id || p_sport || p_player_name || 
       p_stat_type || p_line::text)::bytea
    ), 'hex'
  );
  
  -- Prepare business key for debugging
  v_business_key := jsonb_build_object(
    'provider_name', p_provider_name,
    'external_prop_id', p_external_prop_id,
    'sport', p_sport,
    'player_name', p_player_name,
    'stat_type', p_stat_type
  );
  
  -- Check for content duplication
  v_duplicate_check := check_content_duplicate('raw_prop', v_content_hash, v_business_key);
  
  IF (v_duplicate_check->>'is_duplicate')::boolean = true THEN
    -- Return existing record
    v_final_result := jsonb_build_object(
      'raw_prop_id', (v_duplicate_check->>'existing_record_id')::UUID,
      'is_duplicate', true,
      'occurrence_count', v_duplicate_check->'occurrence_count',
      'first_seen_at', v_duplicate_check->'first_seen_at'
    );
    
    -- Complete idempotent operation
    PERFORM complete_idempotent_operation(p_idempotency_key, v_final_result, 'completed');
    
    RETURN v_final_result;
  END IF;
  
  BEGIN
    -- Create new raw prop
    INSERT INTO raw_props (
      provider_name,
      external_prop_id,
      sport,
      player_name,
      stat_type,
      line,
      over_odds,
      under_odds,
      game_start,
      source_data,
      idempotency_key,
      created_at,
      updated_at
    ) VALUES (
      p_provider_name,
      p_external_prop_id,
      p_sport,
      p_player_name,
      p_stat_type,
      p_line,
      p_over_odds,
      p_under_odds,
      p_game_start,
      p_source_data,
      p_idempotency_key,
      NOW(),
      NOW()
    ) RETURNING id INTO v_raw_prop_id;
    
    -- Register content hash
    PERFORM register_content_hash('raw_prop', v_content_hash, v_raw_prop_id, 'raw_props', v_business_key);
    
    -- Build success result
    v_final_result := jsonb_build_object(
      'raw_prop_id', v_raw_prop_id,
      'is_duplicate', false,
      'occurrence_count', 1,
      'created_at', NOW()
    );
    
    -- Complete idempotent operation
    PERFORM complete_idempotent_operation(p_idempotency_key, v_final_result, 'completed');
    
    RETURN v_final_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Complete idempotent operation with error
    PERFORM complete_idempotent_operation(p_idempotency_key, NULL, 'failed', SQLERRM);
    RAISE;
  END;
END;
$$;

-- =============================================================================
-- CLEANUP FUNCTIONS
-- =============================================================================

-- Function to clean up expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS TABLE(deleted_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete expired keys
  WITH deleted_rows AS (
    DELETE FROM idempotency_keys 
    WHERE expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted_rows;
  
  -- Log cleanup
  INSERT INTO audit_log (table_name, operation, details)
  VALUES ('idempotency_keys', 'CLEANUP', jsonb_build_object(
    'deleted_count', v_deleted_count,
    'cleanup_timestamp', NOW()
  ));
  
  RETURN QUERY SELECT v_deleted_count;
END;
$$;

-- Function to clean up old deduplication hashes
CREATE OR REPLACE FUNCTION cleanup_old_dedup_hashes(p_retention_days INTEGER DEFAULT 30)
RETURNS TABLE(deleted_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
  v_cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
  v_cutoff_date := NOW() - (p_retention_days * INTERVAL '1 day');
  
  -- Delete old hashes
  WITH deleted_rows AS (
    DELETE FROM deduplication_hashes 
    WHERE first_seen_at < v_cutoff_date
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted_rows;
  
  -- Log cleanup
  INSERT INTO audit_log (table_name, operation, details)
  VALUES ('deduplication_hashes', 'CLEANUP', jsonb_build_object(
    'deleted_count', v_deleted_count,
    'retention_days', p_retention_days,
    'cutoff_date', v_cutoff_date
  ));
  
  RETURN QUERY SELECT v_deleted_count;
END;
$$;

-- =============================================================================
-- MONITORING VIEWS
-- =============================================================================

-- View for idempotency monitoring
CREATE OR REPLACE VIEW idempotency_metrics AS
SELECT 
  -- Operation type breakdown
  operation_type,
  COUNT(*) as total_operations,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_operations,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_operations,
  COUNT(*) FILTER (WHERE status = 'processing') as processing_operations,
  
  -- Timing metrics
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) FILTER (WHERE completed_at IS NOT NULL) as avg_processing_time_seconds,
  MAX(EXTRACT(EPOCH FROM (completed_at - created_at))) FILTER (WHERE completed_at IS NOT NULL) as max_processing_time_seconds,
  
  -- Success rate
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE status != 'processing'), 0)) * 100,
    2
  ) as success_rate_percent
  
FROM idempotency_keys 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY operation_type

UNION ALL

SELECT 
  'TOTAL' as operation_type,
  COUNT(*) as total_operations,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_operations,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_operations,
  COUNT(*) FILTER (WHERE status = 'processing') as processing_operations,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) FILTER (WHERE completed_at IS NOT NULL) as avg_processing_time_seconds,
  MAX(EXTRACT(EPOCH FROM (completed_at - created_at))) FILTER (WHERE completed_at IS NOT NULL) as max_processing_time_seconds,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE status != 'processing'), 0)) * 100,
    2
  ) as success_rate_percent
FROM idempotency_keys 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- View for deduplication metrics
CREATE OR REPLACE VIEW deduplication_metrics AS
SELECT 
  content_type,
  COUNT(*) as unique_content_items,
  SUM(occurrence_count) as total_occurrences,
  AVG(occurrence_count) as avg_occurrence_rate,
  MAX(occurrence_count) as max_occurrence_rate,
  COUNT(*) FILTER (WHERE occurrence_count > 1) as deduplicated_items,
  ROUND(
    (COUNT(*) FILTER (WHERE occurrence_count > 1)::DECIMAL / COUNT(*)) * 100,
    2
  ) as deduplication_rate_percent
FROM deduplication_hashes
WHERE first_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY content_type

UNION ALL

SELECT 
  'TOTAL' as content_type,
  COUNT(*) as unique_content_items,
  SUM(occurrence_count) as total_occurrences,
  AVG(occurrence_count) as avg_occurrence_rate,
  MAX(occurrence_count) as max_occurrence_rate,
  COUNT(*) FILTER (WHERE occurrence_count > 1) as deduplicated_items,
  ROUND(
    (COUNT(*) FILTER (WHERE occurrence_count > 1)::DECIMAL / COUNT(*)) * 100,
    2
  ) as deduplication_rate_percent
FROM deduplication_hashes
WHERE first_seen_at > NOW() - INTERVAL '24 hours';

-- =============================================================================
-- ENABLE RLS
-- =============================================================================

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE deduplication_hashes ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "idempotency_keys_service_role" ON idempotency_keys
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "dedup_hashes_service_role" ON deduplication_hashes
  FOR ALL USING (current_setting('role') = 'service_role');

-- Authenticated users can read their own idempotency keys
CREATE POLICY "idempotency_keys_user_read" ON idempotency_keys
  FOR SELECT USING (
    auth.role() = 'authenticated' AND 
    (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin')
  );

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION register_idempotent_operation TO service_role;
GRANT EXECUTE ON FUNCTION complete_idempotent_operation TO service_role;
GRANT EXECUTE ON FUNCTION check_content_duplicate TO service_role;
GRANT EXECUTE ON FUNCTION register_content_hash TO service_role;
GRANT EXECUTE ON FUNCTION app.ingest_raw_prop_idempotent TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_idempotency_keys TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_dedup_hashes TO service_role;

GRANT SELECT ON idempotency_metrics TO anon, authenticated, service_role;
GRANT SELECT ON deduplication_metrics TO anon, authenticated, service_role;

-- =============================================================================
-- MIGRATION VERIFICATION
-- =============================================================================

DO $$
DECLARE
  v_test_key VARCHAR(255);
  v_result JSONB;
BEGIN
  v_test_key := 'test_idempotency_' || extract(epoch from now());
  
  -- Test idempotent ingestion
  SELECT app.ingest_raw_prop_idempotent(
    v_test_key,
    'test_provider',
    'test_prop_' || extract(epoch from now()),
    'TEST',
    'Test Player',
    'test_stat',
    1.5,
    -110,
    -110,
    NOW() + INTERVAL '2 hours',
    '{"test": true}'::jsonb,
    '{"user_id": null, "source_ip": "127.0.0.1"}'::jsonb
  ) INTO v_result;
  
  -- Test idempotency (retry same operation)
  SELECT app.ingest_raw_prop_idempotent(
    v_test_key,
    'test_provider',
    'test_prop_' || extract(epoch from now()),
    'TEST',
    'Test Player',
    'test_stat',
    1.5,
    -110,
    -110,
    NOW() + INTERVAL '2 hours',
    '{"test": true}'::jsonb,
    '{"user_id": null, "source_ip": "127.0.0.1"}'::jsonb
  ) INTO v_result;
  
  -- Test monitoring views
  PERFORM * FROM idempotency_metrics LIMIT 1;
  PERFORM * FROM deduplication_metrics LIMIT 1;
  
  RAISE NOTICE 'Idempotency system verification successful';
  
  -- Cleanup test data
  DELETE FROM deduplication_hashes WHERE business_key @> '{"provider_name": "test_provider"}';
  DELETE FROM raw_props WHERE provider_name = 'test_provider';
  DELETE FROM idempotency_keys WHERE idempotency_key = v_test_key;
END;
$$;

-- Migration completed
INSERT INTO audit_log (table_name, operation, details)
VALUES ('migration', 'COMPLETE', jsonb_build_object(
  'migration', '20250812_idempotency_system',
  'timestamp', NOW(),
  'description', 'Idempotency and deduplication system for safe operation retries'
));