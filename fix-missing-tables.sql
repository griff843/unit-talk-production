-- Fix Missing Database Components for E2E System Operation
-- File: fix-missing-tables.sql
-- Date: September 5, 2025

-- Fix 1: Add missing last_ping column to agents table for health monitoring
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS last_ping TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing agents with current timestamp
UPDATE agents 
SET last_ping = NOW() 
WHERE last_ping IS NULL;

-- Fix 2: Create bridge_outbox table for workflow orchestration
CREATE TABLE IF NOT EXISTS bridge_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    bet_slip_id UUID
);

-- Create indexes for bridge_outbox performance
CREATE INDEX IF NOT EXISTS idx_bridge_outbox_status ON bridge_outbox(status);
CREATE INDEX IF NOT EXISTS idx_bridge_outbox_created ON bridge_outbox(created_at);
CREATE INDEX IF NOT EXISTS idx_bridge_outbox_event_type ON bridge_outbox(event_type);
CREATE INDEX IF NOT EXISTS idx_bridge_outbox_bet_slip_id ON bridge_outbox(bet_slip_id);

-- Fix 3: Create CLV tracking table for complete professional grading pipeline
CREATE TABLE IF NOT EXISTS clv_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clv_tracking_id VARCHAR(100) UNIQUE NOT NULL,
    prop_id UUID,
    opening_line DECIMAL(10,2),
    closing_line DECIMAL(10,2),
    bet_line DECIMAL(10,2),
    clv_value DECIMAL(10,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for CLV tracking performance
CREATE INDEX IF NOT EXISTS idx_clv_tracking_id ON clv_tracking(clv_tracking_id);
CREATE INDEX IF NOT EXISTS idx_clv_prop_id ON clv_tracking(prop_id);

-- Sample bridge outbox data for testing
INSERT INTO bridge_outbox (event_type, event_data, status, processed_at) VALUES
('pick_submission', '{"user_id": "system", "sport": "NFL", "type": "test"}', 'processed', NOW() - INTERVAL '1 hour'),
('pick_grading', '{"prop_id": "test", "score": 85.5}', 'processed', NOW() - INTERVAL '30 minutes'),
('alert_generated', '{"type": "injury", "player": "Test Player"}', 'pending', NULL);

-- Update agent health status with current timestamps
UPDATE agents SET 
    last_ping = NOW(),
    status = 'active'
WHERE name IN ('FeedAgent', 'GradingAgent', 'AlertAgent', 'RecapAgent', 'NotificationAgent');

-- Validation queries
SELECT 'Agents table fixed' as status, COUNT(*) as total_agents, 
       COUNT(*) FILTER (WHERE last_ping IS NOT NULL) as agents_with_ping
FROM agents;

SELECT 'Bridge outbox created' as status, COUNT(*) as total_events
FROM bridge_outbox;

SELECT 'CLV tracking created' as status, COUNT(*) as tracking_records
FROM clv_tracking;