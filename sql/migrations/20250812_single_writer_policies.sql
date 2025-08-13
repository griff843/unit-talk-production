-- Migration: Single Writer DB Model - Promoter-Only Writes
-- Date: 2025-08-12
-- Purpose: Enforce single writer pattern for pick promotions with immutable final picks

-- Create app schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS app;

-- Create system_config table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default system config values
INSERT INTO public.system_config (key, value, description) VALUES
    ('SAFE_MODE', 'false', 'System safe mode - read-only external outputs'),
    ('SYSTEM_FREEZE', 'false', 'System freeze - pause all promotions and publishing'),
    ('SHADOW_MODE', 'true', 'Shadow mode - prevent external publishing'),
    ('PUBLISH_TO_DISCORD', 'false', 'Enable Discord publishing')
ON CONFLICT (key) DO NOTHING;

-- Create idempotency_keys table for application-level deduplication
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) UNIQUE NOT NULL,
    operation_type VARCHAR(100) NOT NULL,
    payload_hash VARCHAR(64),
    result JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 day')
);

-- Create index on idempotency keys
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON public.idempotency_keys(key);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires ON public.idempotency_keys(expires_at);

-- Ensure final_picks table has necessary columns for single writer model
DO $$ 
BEGIN
    -- Add columns if they don't exist
    BEGIN
        ALTER TABLE public.final_picks ADD COLUMN promoted_at TIMESTAMP WITH TIME ZONE;
    EXCEPTION
        WHEN duplicate_column THEN
        -- Column already exists, do nothing
    END;
    
    BEGIN
        ALTER TABLE public.final_picks ADD COLUMN immutable_score JSONB;
    EXCEPTION
        WHEN duplicate_column THEN
        -- Column already exists, do nothing
    END;
    
    BEGIN
        ALTER TABLE public.final_picks ADD COLUMN shadow_only BOOLEAN DEFAULT false;
    EXCEPTION
        WHEN duplicate_column THEN
        -- Column already exists, do nothing
    END;
    
    BEGIN
        ALTER TABLE public.final_picks ADD COLUMN promoted_by UUID;
    EXCEPTION
        WHEN duplicate_column THEN
        -- Column already exists, do nothing
    END;
END $$;

-- Ensure unified_picks table has necessary columns
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE public.unified_picks ADD COLUMN promoted_at TIMESTAMP WITH TIME ZONE;
    EXCEPTION
        WHEN duplicate_column THEN
        -- Column already exists, do nothing
    END;
    
    BEGIN
        ALTER TABLE public.unified_picks ADD COLUMN immutable_score JSONB;
    EXCEPTION
        WHEN duplicate_column THEN
        -- Column already exists, do nothing
    END;
    
    BEGIN
        ALTER TABLE public.unified_picks ADD COLUMN shadow_only BOOLEAN DEFAULT false;
    EXCEPTION
        WHEN duplicate_column THEN
        -- Column already exists, do nothing
    END;
END $$;

-- Create audit_log table for tracking operations
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id UUID,
    user_role VARCHAR(100),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    correlation_id UUID,
    metadata JSONB
);

-- Create index on audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_table_operation ON public.audit_log(table_name, operation);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON public.audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log(user_id);

-- Create the promote_pick function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION app.promote_pick(
    p_scored_prop_id UUID,
    p_shadow_only BOOLEAN DEFAULT TRUE,
    p_promoted_by UUID DEFAULT NULL
) RETURNS UUID
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    v_pick_id UUID;
    v_scored_data RECORD;
    v_safe_mode BOOLEAN;
    v_system_freeze BOOLEAN;
BEGIN
    -- Check system state
    SELECT (value = 'true') INTO v_safe_mode 
    FROM public.system_config 
    WHERE key = 'SAFE_MODE';
    
    SELECT (value = 'true') INTO v_system_freeze 
    FROM public.system_config 
    WHERE key = 'SYSTEM_FREEZE';
    
    -- Block promotions during system freeze
    IF v_system_freeze THEN
        RAISE EXCEPTION 'System is frozen - promotions are disabled';
    END IF;
    
    -- Force shadow mode if safe mode is enabled
    IF v_safe_mode THEN
        p_shadow_only := TRUE;
    END IF;
    
    -- Get scored prop data
    SELECT * INTO v_scored_data
    FROM public.scored_props
    WHERE id = p_scored_prop_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Scored prop not found: %', p_scored_prop_id;
    END IF;
    
    -- Check if already promoted
    IF EXISTS (SELECT 1 FROM public.final_picks WHERE scored_prop_id = p_scored_prop_id) THEN
        RAISE EXCEPTION 'Pick already promoted: %', p_scored_prop_id;
    END IF;
    
    -- Insert into final_picks with immutable scoring snapshot
    INSERT INTO public.final_picks (
        id,
        scored_prop_id,
        user_id,
        sport,
        league,
        player_name,
        stat_type,
        line,
        over_odds,
        under_odds,
        pick_side,
        confidence,
        promoted_at,
        immutable_score,
        shadow_only,
        promoted_by,
        created_at
    )
    VALUES (
        gen_random_uuid(),
        p_scored_prop_id,
        v_scored_data.user_id,
        v_scored_data.sport,
        v_scored_data.league,
        v_scored_data.player_name,
        v_scored_data.stat_type,
        v_scored_data.line,
        v_scored_data.over_odds,
        v_scored_data.under_odds,
        v_scored_data.pick_side,
        v_scored_data.confidence,
        NOW(),
        jsonb_build_object(
            'professional_score', v_scored_data.professional_score,
            'devigged_edge', v_scored_data.devigged_edge,
            'clv_tracking_id', v_scored_data.clv_tracking_id,
            'kelly_fraction', v_scored_data.kelly_fraction,
            'feature_contributions', v_scored_data.feature_contributions,
            'promoted_at', NOW()
        ),
        p_shadow_only,
        p_promoted_by,
        NOW()
    )
    RETURNING id INTO v_pick_id;
    
    -- Insert audit record
    INSERT INTO public.audit_log (
        table_name,
        operation,
        new_values,
        user_id,
        user_role,
        metadata
    )
    VALUES (
        'final_picks',
        'promote_pick',
        jsonb_build_object(
            'pick_id', v_pick_id,
            'scored_prop_id', p_scored_prop_id,
            'shadow_only', p_shadow_only
        ),
        p_promoted_by,
        'promoter',
        jsonb_build_object(
            'function', 'app.promote_pick',
            'safe_mode', v_safe_mode,
            'system_freeze', v_system_freeze
        )
    );
    
    RETURN v_pick_id;
END;
$$;

-- Create trigger function to prevent direct updates of immutable fields
CREATE OR REPLACE FUNCTION public.prevent_immutable_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Prevent updates to immutable scoring fields once promoted
    IF OLD.promoted_at IS NOT NULL AND (
        NEW.immutable_score IS DISTINCT FROM OLD.immutable_score OR
        NEW.promoted_at IS DISTINCT FROM OLD.promoted_at OR
        NEW.scored_prop_id IS DISTINCT FROM OLD.scored_prop_id
    ) THEN
        RAISE EXCEPTION 'Cannot modify immutable fields after promotion';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create triggers on tables to prevent immutable field updates
DROP TRIGGER IF EXISTS prevent_final_picks_immutable_updates ON public.final_picks;
CREATE TRIGGER prevent_final_picks_immutable_updates
    BEFORE UPDATE ON public.final_picks
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_immutable_updates();

DROP TRIGGER IF EXISTS prevent_unified_picks_immutable_updates ON public.unified_picks;
CREATE TRIGGER prevent_unified_picks_immutable_updates
    BEFORE UPDATE ON public.unified_picks
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_immutable_updates();

-- Create trigger function for system_config auditing
CREATE OR REPLACE FUNCTION public.audit_system_config()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.audit_log (
        table_name,
        operation,
        old_values,
        new_values,
        metadata
    )
    VALUES (
        'system_config',
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
        jsonb_build_object(
            'key', COALESCE(NEW.key, OLD.key),
            'old_value', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.value ELSE NULL END,
            'new_value', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.value ELSE NULL END
        )
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create audit triggers on system_config
DROP TRIGGER IF EXISTS audit_system_config_changes ON public.system_config;
CREATE TRIGGER audit_system_config_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.system_config
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_system_config();

-- Revoke direct write permissions on promotion tables from PUBLIC
REVOKE INSERT, UPDATE, DELETE ON public.final_picks FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.unified_picks FROM PUBLIC;

-- Create application role for promoter service
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'promoter_service') THEN
        CREATE ROLE promoter_service;
    END IF;
END
$$;

-- Grant execute permission on promotion function to promoter service
GRANT EXECUTE ON FUNCTION app.promote_pick TO promoter_service;

-- Grant necessary read permissions
GRANT SELECT ON public.scored_props TO promoter_service;
GRANT SELECT ON public.system_config TO promoter_service;
GRANT SELECT, INSERT ON public.audit_log TO promoter_service;

-- Grant read permissions on promotion tables for monitoring
GRANT SELECT ON public.final_picks TO PUBLIC;
GRANT SELECT ON public.unified_picks TO PUBLIC;

-- Create RLS policies if RLS is enabled (optional - depends on Supabase setup)
-- Enable RLS on sensitive tables
ALTER TABLE public.final_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for read access
DROP POLICY IF EXISTS "Allow read access to final_picks" ON public.final_picks;
CREATE POLICY "Allow read access to final_picks" ON public.final_picks
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow read access to unified_picks" ON public.unified_picks;
CREATE POLICY "Allow read access to unified_picks" ON public.unified_picks
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow read access to system_config" ON public.system_config;
CREATE POLICY "Allow read access to system_config" ON public.system_config
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow read access to audit_log" ON public.audit_log;
CREATE POLICY "Allow read access to audit_log" ON public.audit_log
    FOR SELECT USING (true);

-- Block direct writes via RLS (only function can write)
DROP POLICY IF EXISTS "Block direct writes to final_picks" ON public.final_picks;
CREATE POLICY "Block direct writes to final_picks" ON public.final_picks
    FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "Block direct updates to final_picks" ON public.final_picks;
CREATE POLICY "Block direct updates to final_picks" ON public.final_picks
    FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Block direct writes to unified_picks" ON public.unified_picks;
CREATE POLICY "Block direct writes to unified_picks" ON public.unified_picks
    FOR INSERT WITH CHECK (false);

-- Create unique indexes for ingestion idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_props_dedup 
ON public.raw_props (provider_name, external_prop_id, date_trunc('hour', created_at))
WHERE external_prop_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scored_props_dedup 
ON public.scored_props (raw_prop_id);

-- Create composite index for promotion queries
CREATE INDEX IF NOT EXISTS idx_final_picks_promotion_lookup 
ON public.final_picks (scored_prop_id, promoted_at, shadow_only);

-- Add comments for documentation
COMMENT ON FUNCTION app.promote_pick IS 'Single writer function for promoting scored props to final picks with immutable scoring snapshot';
COMMENT ON TABLE public.system_config IS 'System configuration with audit logging for safe mode and freeze controls';
COMMENT ON TABLE public.idempotency_keys IS 'Application-level idempotency keys for deduplication';
COMMENT ON TABLE public.audit_log IS 'Comprehensive audit log for all system configuration and promotion operations';

-- Create cleanup function for expired idempotency keys
CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.idempotency_keys 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Migration completed successfully
SELECT 
    'Single Writer DB Model migration completed successfully' as status,
    NOW() as completed_at;