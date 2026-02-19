-- =====================================================================
-- Event Sourcing Architecture for Unit Talk AlertAgent System
-- Migration: 006_event_sourcing_architecture
-- Purpose: Enable event-driven AlertAgent subscriptions and Command Center replay
-- =====================================================================

-- Event Sourcing Table for AlertAgent Subscriptions
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL, -- 'ticket.submitted.v1', 'grading.completed.v1'
    aggregate_id UUID NOT NULL, -- ticket_id or grading_id
    aggregate_type VARCHAR(50) NOT NULL, -- 'ticket', 'grading'
    event_data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ NULL,
    failed_at TIMESTAMPTZ NULL,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Audit fields
    created_by VARCHAR(100) DEFAULT 'system',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes for event processing
CREATE INDEX IF NOT EXISTS idx_events_type_created ON events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events(aggregate_id, aggregate_type);
CREATE INDEX IF NOT EXISTS idx_events_idempotency ON events(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_events_unprocessed ON events(created_at) WHERE processed_at IS NULL AND failed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_failed ON events(created_at) WHERE failed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_retry ON events(retry_count, created_at) WHERE retry_count < max_retries;

-- Event subscribers tracking for Bridge Worker
CREATE TABLE IF NOT EXISTS event_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_name VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    last_processed_id UUID NULL,
    last_processed_at TIMESTAMPTZ NULL,
    is_active BOOLEAN DEFAULT true,
    cooldown_until TIMESTAMPTZ NULL,
    processing_config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(subscriber_name, event_type)
);

-- Index for subscriber management
CREATE INDEX IF NOT EXISTS idx_subscribers_active ON event_subscribers(subscriber_name, is_active);
CREATE INDEX IF NOT EXISTS idx_subscribers_cooldown ON event_subscribers(cooldown_until) WHERE cooldown_until IS NOT NULL;

-- Alert cooldowns table for preventing spam
CREATE TABLE IF NOT EXISTS alert_cooldowns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(100) NOT NULL, -- 'injury', 'hedge', 'middle', 'steam'
    entity_key VARCHAR(255) NOT NULL, -- player_name+stat_type or similar identifier
    cooldown_until TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(alert_type, entity_key)
);

-- Index for cooldown checks
CREATE INDEX IF NOT EXISTS idx_cooldowns_active ON alert_cooldowns(alert_type, entity_key, cooldown_until);
CREATE INDEX IF NOT EXISTS idx_cooldowns_expired ON alert_cooldowns(cooldown_until) WHERE cooldown_until < NOW();

-- Event processing status tracking
CREATE TABLE IF NOT EXISTS event_processing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    subscriber_name VARCHAR(100) NOT NULL,
    processing_status VARCHAR(50) NOT NULL, -- 'started', 'completed', 'failed', 'retrying'
    processing_started_at TIMESTAMPTZ DEFAULT NOW(),
    processing_completed_at TIMESTAMPTZ NULL,
    error_message TEXT NULL,
    processing_duration_ms INTEGER NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for processing monitoring
CREATE INDEX IF NOT EXISTS idx_processing_logs_event ON event_processing_logs(event_id, subscriber_name);
CREATE INDEX IF NOT EXISTS idx_processing_logs_status ON event_processing_logs(processing_status, processing_started_at);

-- Temporal workflow execution tracking
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id VARCHAR(255) NOT NULL,
    workflow_type VARCHAR(100) NOT NULL,
    run_id VARCHAR(255) NOT NULL,
    execution_status VARCHAR(50) NOT NULL, -- 'running', 'completed', 'failed', 'cancelled'
    input_data JSONB NOT NULL,
    result_data JSONB NULL,
    error_details JSONB NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL,
    
    -- Link to triggering event
    triggering_event_id UUID NULL REFERENCES events(id),
    
    UNIQUE(workflow_id, run_id)
);

-- Index for workflow monitoring
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(execution_status, started_at);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_type ON workflow_executions(workflow_type, started_at);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_event ON workflow_executions(triggering_event_id);

-- =====================================================================
-- Functions and Triggers for Event Management
-- =====================================================================

-- Function to update timestamp on record changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_events_updated_at 
    BEFORE UPDATE ON events 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscribers_updated_at 
    BEFORE UPDATE ON event_subscribers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired cooldowns
CREATE OR REPLACE FUNCTION cleanup_expired_cooldowns()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM alert_cooldowns 
    WHERE cooldown_until < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to publish event (used by application layer)
CREATE OR REPLACE FUNCTION publish_event(
    p_event_type VARCHAR(100),
    p_aggregate_id UUID,
    p_aggregate_type VARCHAR(50),
    p_event_data JSONB,
    p_idempotency_key VARCHAR(255),
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    event_id UUID;
BEGIN
    INSERT INTO events (
        event_type, 
        aggregate_id, 
        aggregate_type, 
        event_data, 
        idempotency_key, 
        metadata
    ) VALUES (
        p_event_type,
        p_aggregate_id,
        p_aggregate_type,
        p_event_data,
        p_idempotency_key,
        p_metadata
    ) RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- RLS (Row Level Security) Policies
-- =====================================================================

-- Enable RLS on sensitive tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for API operations)
CREATE POLICY "Allow service role full access to events" 
    ON events FOR ALL 
    USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to event_subscribers" 
    ON event_subscribers FOR ALL 
    USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to alert_cooldowns" 
    ON alert_cooldowns FOR ALL 
    USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to workflow_executions" 
    ON workflow_executions FOR ALL 
    USING (auth.role() = 'service_role');

-- Allow authenticated users to read events (for Command Center)
CREATE POLICY "Allow authenticated read access to events" 
    ON events FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read access to workflow_executions" 
    ON workflow_executions FOR SELECT 
    USING (auth.role() = 'authenticated');

-- =====================================================================
-- Initial Data Setup
-- =====================================================================

-- Insert default event subscribers for AlertAgent
INSERT INTO event_subscribers (subscriber_name, event_type, is_active, processing_config)
VALUES 
    ('AlertAgent', 'ticket.submitted.v1', true, '{"priority": "high", "batch_size": 1}'::jsonb),
    ('AlertAgent', 'grading.completed.v1', true, '{"priority": "normal", "batch_size": 5}'::jsonb),
    ('BridgeWorker', 'ticket.submitted.v1', true, '{"priority": "high", "timeout_seconds": 30}'::jsonb),
    ('BridgeWorker', 'grading.completed.v1', true, '{"priority": "normal", "timeout_seconds": 60}'::jsonb)
ON CONFLICT (subscriber_name, event_type) DO UPDATE SET
    is_active = EXCLUDED.is_active,
    processing_config = EXCLUDED.processing_config,
    updated_at = NOW();

-- =====================================================================
-- Comments for Documentation
-- =====================================================================

COMMENT ON TABLE events IS 'Event sourcing table for storing all system events with idempotency support';
COMMENT ON TABLE event_subscribers IS 'Tracks which services subscribe to which event types';
COMMENT ON TABLE alert_cooldowns IS 'Prevents alert spam by tracking cooldown periods';
COMMENT ON TABLE workflow_executions IS 'Tracks Temporal workflow executions triggered by events';

COMMENT ON COLUMN events.event_type IS 'Event type identifier (e.g., ticket.submitted.v1, grading.completed.v1)';
COMMENT ON COLUMN events.aggregate_id IS 'ID of the entity this event relates to';
COMMENT ON COLUMN events.idempotency_key IS 'Prevents duplicate event processing';
COMMENT ON COLUMN events.retry_count IS 'Number of processing attempts';

-- Migration complete
SELECT 'Event Sourcing Architecture migration completed successfully' as status;