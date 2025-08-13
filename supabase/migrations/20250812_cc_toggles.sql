-- Command Center System Configuration Migration
-- Creates system config table and seeds default toggle values

-- Create app_system_config table if it doesn't exist
CREATE TABLE IF NOT EXISTS app_system_config (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by text
);

-- Create app_audit_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS app_audit_log (
    id BIGSERIAL PRIMARY KEY,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    actor text NOT NULL,
    action text NOT NULL,
    target text NOT NULL,
    meta jsonb DEFAULT '{}',
    user_id text,
    ip_address text,
    user_agent text
);

-- Create or replace function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_app_system_config_updated_at ON app_system_config;
CREATE TRIGGER update_app_system_config_updated_at
    BEFORE UPDATE ON app_system_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed default system configuration flags
INSERT INTO app_system_config (key, value, updated_by) VALUES
    ('SAFE_MODE', 'false'::jsonb, 'migration'),
    ('SYSTEM_FREEZE', 'false'::jsonb, 'migration'),
    ('SHADOW_MODE', 'true'::jsonb, 'migration'),
    ('PUBLISH_TO_DISCORD', 'false'::jsonb, 'migration'),
    ('PUBLISH_TO_NOTION', 'false'::jsonb, 'migration')
ON CONFLICT (key) DO NOTHING;

-- Create helper function for writing audit logs
CREATE OR REPLACE FUNCTION write_audit_log(
    p_actor text,
    p_action text,
    p_target text,
    p_meta jsonb DEFAULT '{}',
    p_user_id text DEFAULT NULL,
    p_ip_address text DEFAULT NULL,
    p_user_agent text DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
    audit_id BIGINT;
BEGIN
    INSERT INTO app_audit_log (
        actor,
        action,
        target,
        meta,
        user_id,
        ip_address,
        user_agent
    ) VALUES (
        p_actor,
        p_action,
        p_target,
        p_meta,
        p_user_id,
        p_ip_address,
        p_user_agent
    ) RETURNING id INTO audit_id;
    
    RETURN audit_id;
END;
$$ LANGUAGE plpgsql;

-- Create helper function to get system flag
CREATE OR REPLACE FUNCTION get_system_flag(flag_key text)
RETURNS boolean AS $$
DECLARE
    flag_value boolean;
BEGIN
    SELECT (value)::boolean INTO flag_value
    FROM app_system_config
    WHERE key = flag_key;
    
    -- Return false if flag doesn't exist
    IF flag_value IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN flag_value;
END;
$$ LANGUAGE plpgsql;

-- Create helper function to set system flag with audit
CREATE OR REPLACE FUNCTION set_system_flag(
    flag_key text,
    flag_value boolean,
    p_actor text,
    p_user_id text DEFAULT NULL,
    p_ip_address text DEFAULT NULL,
    p_user_agent text DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
    old_value boolean;
    audit_id BIGINT;
BEGIN
    -- Get current value
    SELECT get_system_flag(flag_key) INTO old_value;
    
    -- Update the flag
    INSERT INTO app_system_config (key, value, updated_by)
    VALUES (flag_key, flag_value::jsonb, p_actor)
    ON CONFLICT (key) 
    DO UPDATE SET 
        value = flag_value::jsonb,
        updated_by = p_actor,
        updated_at = now();
    
    -- Write audit log
    SELECT write_audit_log(
        p_actor,
        'system_flag_changed',
        flag_key,
        jsonb_build_object(
            'flag', flag_key,
            'old_value', old_value,
            'new_value', flag_value,
            'timestamp', now()
        ),
        p_user_id,
        p_ip_address,
        p_user_agent
    ) INTO audit_id;
    
    RETURN audit_id;
END;
$$ LANGUAGE plpgsql;

-- Create incidents table if it doesn't exist (for alertmanager integration)
CREATE TABLE IF NOT EXISTS app_incidents (
    id BIGSERIAL PRIMARY KEY,
    title text NOT NULL,
    description text,
    severity text NOT NULL CHECK (severity IN ('warning', 'critical')),
    source text NOT NULL,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    resolution_notes text,
    meta jsonb DEFAULT '{}'
);

-- Create function to create incident with auto safe mode
CREATE OR REPLACE FUNCTION create_incident_auto_safemode(
    p_title text,
    p_description text,
    p_severity text,
    p_source text,
    p_actor text DEFAULT 'alertmanager',
    p_meta jsonb DEFAULT '{}'
) RETURNS BIGINT AS $$
DECLARE
    incident_id BIGINT;
    audit_id BIGINT;
BEGIN
    -- Create incident
    INSERT INTO app_incidents (title, description, severity, source, meta)
    VALUES (p_title, p_description, p_severity, p_source, p_meta)
    RETURNING id INTO incident_id;
    
    -- If critical, activate safe mode
    IF p_severity = 'critical' THEN
        SELECT set_system_flag(
            'SAFE_MODE',
            true,
            p_actor,
            NULL,
            NULL,
            NULL
        ) INTO audit_id;
        
        -- Log safe mode activation
        PERFORM write_audit_log(
            p_actor,
            'auto_safe_mode_activated',
            'SAFE_MODE',
            jsonb_build_object(
                'incident_id', incident_id,
                'reason', 'critical_alert_received',
                'title', p_title,
                'severity', p_severity
            )
        );
    END IF;
    
    RETURN incident_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON app_system_config TO authenticated;
GRANT SELECT, INSERT ON app_audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON app_incidents TO authenticated;
GRANT USAGE ON SEQUENCE app_audit_log_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE app_incidents_id_seq TO authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_audit_log_occurred_at ON app_audit_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_audit_log_actor ON app_audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_app_audit_log_action ON app_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_app_incidents_status ON app_incidents(status);
CREATE INDEX IF NOT EXISTS idx_app_incidents_severity ON app_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_app_incidents_created_at ON app_incidents(created_at DESC);

-- Insert success log
SELECT write_audit_log(
    'migration',
    'command_center_tables_created',
    'database_schema',
    jsonb_build_object(
        'migration', '20250812_cc_toggles.sql',
        'tables_created', ARRAY['app_system_config', 'app_audit_log', 'app_incidents'],
        'functions_created', ARRAY['write_audit_log', 'get_system_flag', 'set_system_flag', 'create_incident_auto_safemode']
    )
);