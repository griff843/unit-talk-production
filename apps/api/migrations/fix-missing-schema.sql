-- Fix Missing Schema Elements for Pipeline to Work
-- Run this to fix circuit breaker errors

-- 1. Create prop_ticks_hot table if missing
CREATE TABLE IF NOT EXISTS prop_ticks_hot (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    prop_id UUID REFERENCES raw_props(id) ON DELETE CASCADE,
    odds_movement JSONB DEFAULT '{}',
    volume_data JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_prop_ticks_hot_prop_id ON prop_ticks_hot(prop_id);
CREATE INDEX IF NOT EXISTS idx_prop_ticks_hot_timestamp ON prop_ticks_hot(timestamp DESC);

-- 2. Create ticket_states table if missing
CREATE TABLE IF NOT EXISTS ticket_states (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id VARCHAR(255) UNIQUE NOT NULL,
    state VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for state queries
CREATE INDEX IF NOT EXISTS idx_ticket_states_state ON ticket_states(state);
CREATE INDEX IF NOT EXISTS idx_ticket_states_ticket_id ON ticket_states(ticket_id);

-- 3. Add missing columns to raw_props if needed
ALTER TABLE raw_props
ADD COLUMN IF NOT EXISTS prop_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS home_team VARCHAR(100),
ADD COLUMN IF NOT EXISTS away_team VARCHAR(100),
ADD COLUMN IF NOT EXISTS game_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS odds NUMERIC;

-- 4. Create workflow_state table for Temporal tracking
CREATE TABLE IF NOT EXISTS workflow_state (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id VARCHAR(255) UNIQUE NOT NULL,
    workflow_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    last_processed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_state_status ON workflow_state(status);
CREATE INDEX IF NOT EXISTS idx_workflow_state_type ON workflow_state(workflow_type);

-- 5. Create agent_tasks table for tracking automated processing
CREATE TABLE IF NOT EXISTS agent_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_name VARCHAR(100) NOT NULL,
    task_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    payload JSONB DEFAULT '{}',
    result JSONB DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent ON agent_tasks(agent_name);

-- 6. Update functions for timestamp management
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_ticket_states_updated_at ON ticket_states;
CREATE TRIGGER update_ticket_states_updated_at
    BEFORE UPDATE ON ticket_states
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflow_state_updated_at ON workflow_state;
CREATE TRIGGER update_workflow_state_updated_at
    BEFORE UPDATE ON workflow_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verify schema fixes
SELECT 'Schema fixes applied successfully' as status;