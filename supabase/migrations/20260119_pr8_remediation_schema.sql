-- PR8: Auto-Remediation Playbooks Schema
-- Date: 2026-01-19
-- Purpose: Database infrastructure for automated remediation system
--
-- Prerequisites: PR7 ops schema must exist
--
-- This migration creates:
-- 1. ops.remediation_playbooks - Playbook definitions
-- 2. ops.remediation_executions - Execution audit log
-- 3. ops.remediation_config - Runtime configuration
-- 4. Helper functions for remediation operations

-- ============================================================================
-- 1. Remediation Playbooks Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ops.remediation_playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id VARCHAR(100) UNIQUE NOT NULL,      -- e.g., 'MV_REFRESH_LAG'
    name VARCHAR(255) NOT NULL,                     -- Human-readable name
    description TEXT,                               -- Detailed description

    -- Execution type
    execution_type VARCHAR(50) NOT NULL DEFAULT 'RECOMMENDATION_ONLY'
        CHECK (execution_type IN ('EXECUTABLE', 'RECOMMENDATION_ONLY')),

    -- Target configuration
    target_slo_names TEXT[],                        -- SLO names this playbook handles
    target_incident_types TEXT[],                   -- Incident types (warning, critical)

    -- Action configuration (JSONB for flexibility)
    action_config JSONB NOT NULL DEFAULT '{}'::JSONB,
    -- Example: {
    --   "knob_id": "AUTOPILOT_MODE",
    --   "action": "SET",
    --   "target_value": "log_only",
    --   "rollback_value": "prod"
    -- }

    -- Thresholds
    trigger_threshold JSONB,                        -- Conditions to trigger
    -- Example: { "metric": "lag_seconds", "operator": ">", "value": 300 }

    -- Rate limiting
    cooldown_seconds INT NOT NULL DEFAULT 3600,     -- 1 hour default
    max_executions_per_hour INT NOT NULL DEFAULT 3,

    -- Feature flags
    enabled BOOLEAN NOT NULL DEFAULT FALSE,         -- Disabled by default
    dry_run_only BOOLEAN NOT NULL DEFAULT TRUE,     -- Dry run by default
    requires_approval BOOLEAN NOT NULL DEFAULT TRUE,

    -- Metadata
    priority INT NOT NULL DEFAULT 50,               -- 1-100, higher = more urgent
    owner VARCHAR(255),
    runbook_url TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_remediation_playbooks_playbook_id
    ON ops.remediation_playbooks(playbook_id);

CREATE INDEX IF NOT EXISTS idx_remediation_playbooks_enabled
    ON ops.remediation_playbooks(enabled) WHERE enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_remediation_playbooks_target_slo
    ON ops.remediation_playbooks USING GIN (target_slo_names);

-- Comment
COMMENT ON TABLE ops.remediation_playbooks IS
'PR8: Playbook definitions for automated remediation. Each playbook defines actions to take in response to specific incidents.';

-- ============================================================================
-- 2. Remediation Executions Table (Audit Log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ops.remediation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_key VARCHAR(255) UNIQUE NOT NULL,     -- Idempotency key

    -- Playbook reference
    playbook_id VARCHAR(100) NOT NULL,
    playbook_version INT NOT NULL DEFAULT 1,

    -- Incident context
    incident_id VARCHAR(255),                       -- Reference to ops.slo_incidents
    slo_id UUID,
    slo_name VARCHAR(255),
    correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),

    -- Execution details
    execution_type VARCHAR(50) NOT NULL
        CHECK (execution_type IN ('EXECUTABLE', 'RECOMMENDATION_ONLY')),
    dry_run BOOLEAN NOT NULL DEFAULT TRUE,

    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',           -- Waiting to execute
            'approved',          -- Approved, ready to execute
            'executing',         -- Currently executing
            'completed',         -- Successfully completed
            'failed',            -- Execution failed
            'rolled_back',       -- Rolled back after failure
            'skipped',           -- Skipped (cooldown, rate limit, etc.)
            'recommendation_sent' -- Recommendation sent to operator
        )),

    -- Action taken
    action_taken JSONB,                             -- Actual action performed
    -- Example: {
    --   "knob_id": "AUTOPILOT_MODE",
    --   "previous_value": "prod",
    --   "new_value": "log_only",
    --   "applied_at": "2026-01-19T10:00:00Z"
    -- }

    -- Outcome
    outcome JSONB,                                  -- Result of execution
    -- Example: {
    --   "success": true,
    --   "message": "Successfully throttled autopilot",
    --   "metrics_before": { "lag_seconds": 350 },
    --   "metrics_after": { "lag_seconds": 120 }
    -- }

    -- Error handling
    error_message TEXT,
    error_details JSONB,
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,

    -- Rollback info
    rollback_available BOOLEAN NOT NULL DEFAULT FALSE,
    rollback_action JSONB,
    rolled_back_at TIMESTAMPTZ,
    rolled_back_by VARCHAR(255),

    -- Approval tracking
    requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,

    -- Timestamps
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_remediation_executions_playbook_id
    ON ops.remediation_executions(playbook_id);

CREATE INDEX IF NOT EXISTS idx_remediation_executions_incident_id
    ON ops.remediation_executions(incident_id);

CREATE INDEX IF NOT EXISTS idx_remediation_executions_slo_id
    ON ops.remediation_executions(slo_id);

CREATE INDEX IF NOT EXISTS idx_remediation_executions_status
    ON ops.remediation_executions(status);

CREATE INDEX IF NOT EXISTS idx_remediation_executions_correlation_id
    ON ops.remediation_executions(correlation_id);

CREATE INDEX IF NOT EXISTS idx_remediation_executions_created_at
    ON ops.remediation_executions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_remediation_executions_pending
    ON ops.remediation_executions(status, playbook_id)
    WHERE status IN ('pending', 'approved', 'executing');

-- Unique constraint for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_remediation_executions_idempotent
    ON ops.remediation_executions(playbook_id, incident_id)
    WHERE status NOT IN ('failed', 'rolled_back', 'skipped');

-- Comment
COMMENT ON TABLE ops.remediation_executions IS
'PR8: Audit log of all remediation executions. Tracks status, actions taken, and outcomes for each remediation attempt.';

-- ============================================================================
-- 3. Remediation Configuration Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ops.remediation_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255)
);

-- Insert default configuration
INSERT INTO ops.remediation_config (config_key, config_value, description)
VALUES
    ('global_enabled', 'false'::JSONB, 'Master switch for auto-remediation'),
    ('dry_run_mode', 'true'::JSONB, 'Global dry-run mode (no actual actions taken)'),
    ('default_cooldown_seconds', '3600'::JSONB, 'Default cooldown between remediation attempts'),
    ('max_concurrent_executions', '3'::JSONB, 'Maximum concurrent remediation executions'),
    ('require_approval_by_default', 'true'::JSONB, 'Require manual approval by default'),
    ('notification_channel_id', 'null'::JSONB, 'Discord channel for remediation notifications'),
    ('escalation_role_id', 'null'::JSONB, 'Discord role for escalation'),
    ('allowed_hours', '{"start": 9, "end": 17, "timezone": "America/New_York"}'::JSONB, 'Hours when auto-remediation is allowed')
ON CONFLICT (config_key) DO NOTHING;

-- Comment
COMMENT ON TABLE ops.remediation_config IS
'PR8: Global configuration for the auto-remediation system.';

-- ============================================================================
-- 4. Helper Functions
-- ============================================================================

-- Function: Check if playbook should execute (cooldown + rate limit)
CREATE OR REPLACE FUNCTION ops.should_execute_playbook(
    p_playbook_id VARCHAR(100),
    p_incident_id VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE (
    should_execute BOOLEAN,
    reason TEXT,
    last_execution_id UUID,
    executions_this_hour INT
)
SECURITY DEFINER
SET search_path = ops, public
LANGUAGE plpgsql
AS $$
DECLARE
    v_playbook ops.remediation_playbooks%ROWTYPE;
    v_last_execution ops.remediation_executions%ROWTYPE;
    v_hour_count INT;
    v_cooldown_expired BOOLEAN;
    v_global_enabled BOOLEAN;
    v_dry_run_mode BOOLEAN;
BEGIN
    -- Get global config
    SELECT (config_value)::BOOLEAN INTO v_global_enabled
    FROM ops.remediation_config WHERE config_key = 'global_enabled';

    SELECT (config_value)::BOOLEAN INTO v_dry_run_mode
    FROM ops.remediation_config WHERE config_key = 'dry_run_mode';

    -- Check global enabled
    IF NOT COALESCE(v_global_enabled, FALSE) THEN
        RETURN QUERY SELECT FALSE, 'Global remediation is disabled', NULL::UUID, 0;
        RETURN;
    END IF;

    -- Get playbook
    SELECT * INTO v_playbook
    FROM ops.remediation_playbooks
    WHERE playbook_id = p_playbook_id;

    IF v_playbook.id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Playbook not found', NULL::UUID, 0;
        RETURN;
    END IF;

    -- Check playbook enabled
    IF NOT v_playbook.enabled THEN
        RETURN QUERY SELECT FALSE, 'Playbook is disabled', NULL::UUID, 0;
        RETURN;
    END IF;

    -- Get last execution
    SELECT * INTO v_last_execution
    FROM ops.remediation_executions
    WHERE playbook_id = p_playbook_id
      AND status IN ('completed', 'executing', 'approved')
    ORDER BY created_at DESC
    LIMIT 1;

    -- Check cooldown
    IF v_last_execution.id IS NOT NULL THEN
        v_cooldown_expired := (NOW() - v_last_execution.created_at) >
            (v_playbook.cooldown_seconds || ' seconds')::INTERVAL;

        IF NOT v_cooldown_expired THEN
            RETURN QUERY SELECT
                FALSE,
                'Cooldown active until ' || (v_last_execution.created_at + (v_playbook.cooldown_seconds || ' seconds')::INTERVAL)::TEXT,
                v_last_execution.id,
                0;
            RETURN;
        END IF;
    END IF;

    -- Check rate limit (executions this hour)
    SELECT COUNT(*) INTO v_hour_count
    FROM ops.remediation_executions
    WHERE playbook_id = p_playbook_id
      AND status IN ('completed', 'executing', 'approved')
      AND created_at > NOW() - INTERVAL '1 hour';

    IF v_hour_count >= v_playbook.max_executions_per_hour THEN
        RETURN QUERY SELECT
            FALSE,
            'Rate limit exceeded: ' || v_hour_count || '/' || v_playbook.max_executions_per_hour || ' executions this hour',
            v_last_execution.id,
            v_hour_count;
        RETURN;
    END IF;

    -- Check for duplicate incident (if incident_id provided)
    IF p_incident_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM ops.remediation_executions
            WHERE playbook_id = p_playbook_id
              AND incident_id = p_incident_id
              AND status NOT IN ('failed', 'rolled_back', 'skipped')
        ) THEN
            RETURN QUERY SELECT
                FALSE,
                'Already handling this incident',
                v_last_execution.id,
                v_hour_count;
            RETURN;
        END IF;
    END IF;

    -- All checks passed
    RETURN QUERY SELECT
        TRUE,
        'Ready to execute',
        v_last_execution.id,
        v_hour_count;
END;
$$;

COMMENT ON FUNCTION ops.should_execute_playbook IS
'PR8: Checks if a playbook should execute based on cooldown, rate limits, and incident deduplication.';

-- Function: Create a new remediation execution
CREATE OR REPLACE FUNCTION ops.create_remediation_execution(
    p_playbook_id VARCHAR(100),
    p_incident_id VARCHAR(255) DEFAULT NULL,
    p_slo_id UUID DEFAULT NULL,
    p_slo_name VARCHAR(255) DEFAULT NULL,
    p_dry_run BOOLEAN DEFAULT TRUE,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = ops, public
LANGUAGE plpgsql
AS $$
DECLARE
    v_playbook ops.remediation_playbooks%ROWTYPE;
    v_execution_id UUID;
    v_execution_key VARCHAR(255);
    v_check RECORD;
BEGIN
    -- Get playbook
    SELECT * INTO v_playbook
    FROM ops.remediation_playbooks
    WHERE playbook_id = p_playbook_id;

    IF v_playbook.id IS NULL THEN
        RAISE EXCEPTION 'Playbook not found: %', p_playbook_id;
    END IF;

    -- Check if should execute
    SELECT * INTO v_check
    FROM ops.should_execute_playbook(p_playbook_id, p_incident_id);

    -- Generate execution key
    v_execution_key := p_playbook_id || '-' || COALESCE(p_incident_id, gen_random_uuid()::TEXT) || '-' || EXTRACT(EPOCH FROM NOW())::BIGINT;

    -- Create execution record
    INSERT INTO ops.remediation_executions (
        execution_key,
        playbook_id,
        playbook_version,
        incident_id,
        slo_id,
        slo_name,
        correlation_id,
        execution_type,
        dry_run,
        status,
        requires_approval
    )
    VALUES (
        v_execution_key,
        p_playbook_id,
        1,
        p_incident_id,
        p_slo_id,
        p_slo_name,
        COALESCE(p_correlation_id, gen_random_uuid()),
        v_playbook.execution_type,
        COALESCE(p_dry_run, v_playbook.dry_run_only),
        CASE
            WHEN NOT v_check.should_execute THEN 'skipped'
            WHEN v_playbook.requires_approval THEN 'pending'
            ELSE 'approved'
        END,
        v_playbook.requires_approval
    )
    RETURNING id INTO v_execution_id;

    -- If skipped, record the reason
    IF NOT v_check.should_execute THEN
        UPDATE ops.remediation_executions
        SET outcome = jsonb_build_object('skipped_reason', v_check.reason),
            completed_at = NOW()
        WHERE id = v_execution_id;
    END IF;

    RETURN v_execution_id;
END;
$$;

COMMENT ON FUNCTION ops.create_remediation_execution IS
'PR8: Creates a new remediation execution record with idempotency checks.';

-- Function: Update execution status
CREATE OR REPLACE FUNCTION ops.update_execution_status(
    p_execution_id UUID,
    p_status VARCHAR(50),
    p_action_taken JSONB DEFAULT NULL,
    p_outcome JSONB DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_error_details JSONB DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = ops, public
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE ops.remediation_executions
    SET status = p_status,
        action_taken = COALESCE(p_action_taken, action_taken),
        outcome = COALESCE(p_outcome, outcome),
        error_message = COALESCE(p_error_message, error_message),
        error_details = COALESCE(p_error_details, error_details),
        started_at = CASE WHEN p_status = 'executing' AND started_at IS NULL THEN NOW() ELSE started_at END,
        completed_at = CASE WHEN p_status IN ('completed', 'failed', 'rolled_back', 'skipped', 'recommendation_sent') THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    WHERE id = p_execution_id;

    RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION ops.update_execution_status IS
'PR8: Updates the status and outcome of a remediation execution.';

-- Function: Approve execution
CREATE OR REPLACE FUNCTION ops.approve_remediation(
    p_execution_id UUID,
    p_approved_by VARCHAR(255),
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = ops, public
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE ops.remediation_executions
    SET status = 'approved',
        approved_by = p_approved_by,
        approved_at = NOW(),
        approval_notes = p_notes,
        updated_at = NOW()
    WHERE id = p_execution_id
      AND status = 'pending';

    RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION ops.approve_remediation IS
'PR8: Approves a pending remediation execution.';

-- Function: Get pending executions for worker
CREATE OR REPLACE FUNCTION ops.get_pending_remediations(
    p_limit INT DEFAULT 10
)
RETURNS SETOF ops.remediation_executions
SECURITY DEFINER
SET search_path = ops, public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT e.*
    FROM ops.remediation_executions e
    JOIN ops.remediation_playbooks p ON e.playbook_id = p.playbook_id
    WHERE e.status = 'approved'
      AND p.enabled = TRUE
    ORDER BY p.priority DESC, e.created_at ASC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION ops.get_pending_remediations IS
'PR8: Returns approved remediation executions ready for execution.';

-- Function: Get remediation stats
CREATE OR REPLACE FUNCTION ops.get_remediation_stats(
    p_hours INT DEFAULT 24
)
RETURNS TABLE (
    total_executions BIGINT,
    successful BIGINT,
    failed BIGINT,
    skipped BIGINT,
    pending BIGINT,
    recommendations_sent BIGINT,
    avg_duration_seconds NUMERIC
)
SECURITY DEFINER
SET search_path = ops, public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_executions,
        COUNT(*) FILTER (WHERE status = 'completed') as successful,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'skipped') as skipped,
        COUNT(*) FILTER (WHERE status IN ('pending', 'approved', 'executing')) as pending,
        COUNT(*) FILTER (WHERE status = 'recommendation_sent') as recommendations_sent,
        ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)))::NUMERIC, 2) as avg_duration_seconds
    FROM ops.remediation_executions
    WHERE created_at > NOW() - (p_hours || ' hours')::INTERVAL;
END;
$$;

COMMENT ON FUNCTION ops.get_remediation_stats IS
'PR8: Returns remediation execution statistics for the specified time window.';

-- ============================================================================
-- 5. Insert Default Playbooks
-- ============================================================================

INSERT INTO ops.remediation_playbooks (
    playbook_id,
    name,
    description,
    execution_type,
    target_slo_names,
    target_incident_types,
    action_config,
    trigger_threshold,
    cooldown_seconds,
    max_executions_per_hour,
    enabled,
    dry_run_only,
    requires_approval,
    priority,
    runbook_url
)
VALUES
    (
        'MV_REFRESH_LAG',
        'Materialized View Refresh Lag',
        'Handles stale materialized views causing data freshness issues. RECOMMENDATION_ONLY because no direct MV refresh toggle exists.',
        'RECOMMENDATION_ONLY',
        ARRAY['mv_freshness', 'data_staleness'],
        ARRAY['warning', 'critical'],
        '{"recommendation": "Run REFRESH MATERIALIZED VIEW CONCURRENTLY on affected views", "affected_views": ["mv_daily_stats", "mv_player_performance"]}'::JSONB,
        '{"metric": "lag_seconds", "operator": ">", "value": 300}'::JSONB,
        1800,
        3,
        FALSE,
        TRUE,
        TRUE,
        50,
        'https://docs.unit-talk.com/runbooks/mv-refresh'
    ),
    (
        'PIPELINE_LAG_THROTTLE',
        'Pipeline Lag Throttle',
        'Throttles autopilot mode when pipeline lag exceeds threshold. EXECUTABLE via AUTOPILOT_MODE knob.',
        'EXECUTABLE',
        ARRAY['pipeline_lag', 'grading_latency', 'ingestion_delay'],
        ARRAY['warning', 'critical'],
        '{"knob_id": "AUTOPILOT_MODE", "action": "SET", "target_value": "log_only", "rollback_value": "prod", "via": "set_autopilot_mode RPC"}'::JSONB,
        '{"metric": "lag_seconds", "operator": ">", "value": 120}'::JSONB,
        3600,
        2,
        FALSE,
        TRUE,
        TRUE,
        70,
        'https://docs.unit-talk.com/runbooks/pipeline-throttle'
    ),
    (
        'CREDIT_BURN_THROTTLE',
        'API Credit Burn Throttle',
        'Reduces API call frequency when credit burn rate is too high. RECOMMENDATION_ONLY because quota is in-memory only.',
        'RECOMMENDATION_ONLY',
        ARRAY['api_credit_burn', 'quota_warning'],
        ARRAY['warning', 'critical'],
        '{"recommendation": "Reduce API poll frequency or contact provider to increase quota", "affected_providers": ["odds-api", "optimal"]}'::JSONB,
        '{"metric": "credits_remaining_pct", "operator": "<", "value": 20}'::JSONB,
        7200,
        2,
        FALSE,
        TRUE,
        TRUE,
        60,
        'https://docs.unit-talk.com/runbooks/credit-throttle'
    ),
    (
        'DISCORD_BACKLOG_NUDGE',
        'Discord Backlog Nudge',
        'Sends notification when Discord message backlog grows. EXECUTABLE via webhook notification.',
        'EXECUTABLE',
        ARRAY['discord_backlog', 'notification_delay'],
        ARRAY['warning'],
        '{"action": "SEND_NOTIFICATION", "channel": "ops-alerts", "message_template": "Discord backlog detected: {{backlog_count}} messages pending. Consider investigating Discord API status."}'::JSONB,
        '{"metric": "backlog_count", "operator": ">", "value": 50}'::JSONB,
        1800,
        4,
        FALSE,
        TRUE,
        FALSE,
        40,
        'https://docs.unit-talk.com/runbooks/discord-backlog'
    ),
    (
        'SLO_EVALUATOR_STUCK',
        'SLO Evaluator Stuck',
        'Restarts SLO evaluator when it appears stuck. EXECUTABLE via agent freeze/restart.',
        'EXECUTABLE',
        ARRAY['slo_evaluation_stuck', 'slo_stale'],
        ARRAY['critical'],
        '{"knob_id": "AUTOPILOT_AGENT_FREEZE", "agent": "SLOEvaluatorAgent", "action": "RESTART", "sequence": ["freeze", "wait:5s", "unfreeze"]}'::JSONB,
        '{"metric": "last_evaluation_age_seconds", "operator": ">", "value": 600}'::JSONB,
        3600,
        2,
        FALSE,
        TRUE,
        TRUE,
        80,
        'https://docs.unit-talk.com/runbooks/slo-evaluator'
    )
ON CONFLICT (playbook_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    execution_type = EXCLUDED.execution_type,
    target_slo_names = EXCLUDED.target_slo_names,
    target_incident_types = EXCLUDED.target_incident_types,
    action_config = EXCLUDED.action_config,
    trigger_threshold = EXCLUDED.trigger_threshold,
    updated_at = NOW();

-- ============================================================================
-- 6. Triggers
-- ============================================================================

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION ops.update_remediation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS remediation_playbooks_updated_at ON ops.remediation_playbooks;
CREATE TRIGGER remediation_playbooks_updated_at
    BEFORE UPDATE ON ops.remediation_playbooks
    FOR EACH ROW
    EXECUTE FUNCTION ops.update_remediation_updated_at();

DROP TRIGGER IF EXISTS remediation_executions_updated_at ON ops.remediation_executions;
CREATE TRIGGER remediation_executions_updated_at
    BEFORE UPDATE ON ops.remediation_executions
    FOR EACH ROW
    EXECUTE FUNCTION ops.update_remediation_updated_at();

-- ============================================================================
-- 7. Row-Level Security
-- ============================================================================

ALTER TABLE ops.remediation_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.remediation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.remediation_config ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY remediation_playbooks_service_policy ON ops.remediation_playbooks
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY remediation_executions_service_policy ON ops.remediation_executions
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY remediation_config_service_policy ON ops.remediation_config
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Authenticated users can read
CREATE POLICY remediation_playbooks_read_policy ON ops.remediation_playbooks
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY remediation_executions_read_policy ON ops.remediation_executions
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY remediation_config_read_policy ON ops.remediation_config
    FOR SELECT TO authenticated USING (TRUE);

-- ============================================================================
-- 8. Grants
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ops.remediation_playbooks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ops.remediation_executions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ops.remediation_config TO service_role;

GRANT SELECT ON ops.remediation_playbooks TO authenticated;
GRANT SELECT ON ops.remediation_executions TO authenticated;
GRANT SELECT ON ops.remediation_config TO authenticated;

GRANT EXECUTE ON FUNCTION ops.should_execute_playbook TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION ops.create_remediation_execution TO service_role;
GRANT EXECUTE ON FUNCTION ops.update_execution_status TO service_role;
GRANT EXECUTE ON FUNCTION ops.approve_remediation TO service_role;
GRANT EXECUTE ON FUNCTION ops.get_pending_remediations TO service_role;
GRANT EXECUTE ON FUNCTION ops.get_remediation_stats TO service_role, authenticated;

-- ============================================================================
-- 9. Reload PostgREST schema cache
-- ============================================================================

NOTIFY pgrst, 'reload schema';
