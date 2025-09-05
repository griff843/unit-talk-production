-- ============================================================================= 
-- POPULATE AGENT CONFIGURATIONS - IMMEDIATE EXECUTION
-- File: populate-agents.sql
-- Date: September 5, 2025
-- Purpose: Add missing agent configurations to restore system functionality
-- =============================================================================

-- Insert missing agent configurations (currently empty table)
INSERT INTO agents (name, type, version, status, config) VALUES
('FeedAgent', 'ingestion', '1.0.0', 'active', '{"schedule": "*/60 * * * * *", "sources": ["optimal-api", "odds-api"]}'),
('GradingAgent', 'processing', '1.0.0', 'active', '{"batchSize": 100, "timeout": 30000, "features": 45}'),
('AlertAgent', 'notification', '1.0.0', 'active', '{"channels": ["discord"], "realtime": true}'),
('RecapAgent', 'analytics', '1.0.0', 'active', '{"schedule": "0 0 * * *", "includeStats": true}'),
('NotificationAgent', 'communication', '1.0.0', 'active', '{"multiChannel": true, "batchSize": 50}')
ON CONFLICT (name) DO UPDATE SET 
    status = EXCLUDED.status,
    config = EXCLUDED.config,
    updated_at = NOW();

-- Verify agent configurations were added successfully
SELECT 
    'Agent Configuration Complete' as status,
    COUNT(*) as total_agents,
    COUNT(*) FILTER (WHERE status = 'active') as active_agents,
    NOW() as completed_at
FROM agents;