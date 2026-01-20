-- ============================================================================
-- PR7: Ops Notifications Schema
-- ============================================================================
-- Purpose: Incident routing, deduplication, and notification tracking
-- Part of: PR7 Incident Routing + Ops Digest
-- Prerequisites: PR5 ops schema (ops.slo_incidents must exist)
-- ============================================================================

-- Set search path for ops schema
SET search_path TO ops, public;

-- ============================================================================
-- Table: ops.incident_notifications
-- ============================================================================
-- Tracks all outgoing notifications for SLO incidents.
-- Provides idempotency, cooldown enforcement, and delivery tracking.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ops.incident_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Incident reference
    incident_key TEXT NOT NULL,         -- incident_id or composite key
    slo_id UUID NOT NULL,               -- Reference to ops.slos

    -- Destination and routing
    destination TEXT NOT NULL,          -- 'discord', 'notion', 'email', etc.
    destination_channel TEXT,           -- Channel ID, database ID, etc.
    routing_reason TEXT,                -- 'new_incident', 'status_change', 'escalation', 'digest'

    -- Delivery tracking
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'skipped')),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    message_id TEXT,                    -- Discord message ID, Notion page ID, etc.

    -- Traceability (mandatory per requirements)
    correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
    environment TEXT NOT NULL DEFAULT 'production'
        CHECK (environment IN ('development', 'staging', 'production')),

    -- Deduplication
    payload_hash TEXT,                  -- Hash of payload to prevent duplicate sends

    -- Metadata
    severity TEXT,                      -- 'warning', 'critical'
    incident_status TEXT,               -- 'open', 'acknowledged', 'resolved'
    payload JSONB,                      -- Full notification payload for debugging
    error_message TEXT,                 -- Error details if failed
    retry_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Idempotency constraint: one notification per incident per destination
    CONSTRAINT uq_incident_destination UNIQUE (incident_key, destination)
);

-- ============================================================================
-- Table: ops.notification_prefs
-- ============================================================================
-- Configuration for notification routing per environment and severity.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ops.notification_prefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Scope
    environment TEXT NOT NULL DEFAULT 'production'
        CHECK (environment IN ('development', 'staging', 'production')),
    destination TEXT NOT NULL,          -- 'discord', 'notion', etc.

    -- Routing rules
    enabled BOOLEAN DEFAULT false,
    severity_threshold TEXT DEFAULT 'warning'
        CHECK (severity_threshold IN ('warning', 'critical')),

    -- Destination config
    channel_id TEXT,                    -- Discord channel ID
    database_id TEXT,                   -- Notion database ID
    webhook_url TEXT,                   -- Webhook URL if applicable

    -- Escalation config
    escalation_role_id TEXT,            -- Discord role to ping for critical
    escalation_user_ids TEXT[],         -- User IDs to DM for critical

    -- Rate limiting
    cooldown_minutes INTEGER DEFAULT 15, -- Min time between notifications for same incident
    max_per_hour INTEGER DEFAULT 20,     -- Max notifications per hour

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT uq_env_destination UNIQUE (environment, destination)
);

-- ============================================================================
-- Table: ops.notification_cursor
-- ============================================================================
-- Tracks the last poll position for incremental notification processing.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ops.notification_cursor (
    id TEXT PRIMARY KEY DEFAULT 'default',
    last_processed_at TIMESTAMPTZ DEFAULT now() - interval '1 hour',
    last_incident_id UUID,
    run_count INTEGER DEFAULT 0,
    last_error TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- Table: ops.digest_history
-- ============================================================================
-- Tracks weekly digest generation and delivery.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ops.digest_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    digest_type TEXT NOT NULL DEFAULT 'weekly'
        CHECK (digest_type IN ('daily', 'weekly', 'monthly')),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Summary data
    summary JSONB NOT NULL,             -- Full digest summary

    -- Delivery status
    discord_sent BOOLEAN DEFAULT false,
    discord_message_id TEXT,
    notion_sent BOOLEAN DEFAULT false,
    notion_page_id TEXT,

    -- Metadata
    correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
    generated_at TIMESTAMPTZ DEFAULT now(),

    -- Prevent duplicate digests for same period
    CONSTRAINT uq_digest_period UNIQUE (digest_type, period_start, period_end)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_incident_notifications_incident_key
    ON ops.incident_notifications(incident_key);

CREATE INDEX IF NOT EXISTS idx_incident_notifications_slo_id
    ON ops.incident_notifications(slo_id);

CREATE INDEX IF NOT EXISTS idx_incident_notifications_status
    ON ops.incident_notifications(status);

CREATE INDEX IF NOT EXISTS idx_incident_notifications_created_at
    ON ops.incident_notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_incident_notifications_correlation_id
    ON ops.incident_notifications(correlation_id);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_env_dest
    ON ops.notification_prefs(environment, destination);

CREATE INDEX IF NOT EXISTS idx_digest_history_type_period
    ON ops.digest_history(digest_type, period_start);

-- ============================================================================
-- RLS Policies
-- ============================================================================
-- All ops notification tables are service_role only.
-- No client access permitted.
-- ============================================================================

ALTER TABLE ops.incident_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.notification_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.notification_cursor ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.digest_history ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "service_role_full_access_notifications" ON ops.incident_notifications
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_full_access_prefs" ON ops.notification_prefs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_full_access_cursor" ON ops.notification_cursor
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_full_access_digest" ON ops.digest_history
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- Functions
-- ============================================================================

-- Function: Check if notification should be sent (cooldown + dedupe)
CREATE OR REPLACE FUNCTION ops.should_send_notification(
    p_incident_key TEXT,
    p_slo_id UUID,
    p_destination TEXT,
    p_payload_hash TEXT DEFAULT NULL
) RETURNS TABLE (
    should_send BOOLEAN,
    reason TEXT,
    existing_id UUID,
    existing_message_id TEXT
) AS $$
DECLARE
    v_existing RECORD;
    v_prefs RECORD;
    v_cooldown_expired BOOLEAN;
    v_hour_count INTEGER;
BEGIN
    -- Get notification preferences
    SELECT * INTO v_prefs
    FROM ops.notification_prefs
    WHERE environment = current_setting('app.environment', true)
      AND destination = p_destination;

    -- Default cooldown if no prefs
    IF v_prefs IS NULL THEN
        v_prefs.cooldown_minutes := 15;
        v_prefs.max_per_hour := 20;
    END IF;

    -- Check for existing notification
    SELECT * INTO v_existing
    FROM ops.incident_notifications
    WHERE incident_key = p_incident_key
      AND destination = p_destination;

    IF v_existing IS NOT NULL THEN
        -- Check if cooldown expired
        v_cooldown_expired := (
            v_existing.sent_at IS NULL OR
            v_existing.sent_at < now() - (v_prefs.cooldown_minutes || ' minutes')::interval
        );

        -- Check if payload changed (if hash provided)
        IF p_payload_hash IS NOT NULL AND v_existing.payload_hash = p_payload_hash THEN
            RETURN QUERY SELECT false, 'payload_unchanged'::TEXT, v_existing.id, v_existing.message_id;
            RETURN;
        END IF;

        IF NOT v_cooldown_expired THEN
            RETURN QUERY SELECT false, 'cooldown_active'::TEXT, v_existing.id, v_existing.message_id;
            RETURN;
        END IF;

        -- Can update existing notification
        RETURN QUERY SELECT true, 'cooldown_expired'::TEXT, v_existing.id, v_existing.message_id;
        RETURN;
    END IF;

    -- Check hourly rate limit
    SELECT COUNT(*) INTO v_hour_count
    FROM ops.incident_notifications
    WHERE destination = p_destination
      AND sent_at > now() - interval '1 hour';

    IF v_hour_count >= v_prefs.max_per_hour THEN
        RETURN QUERY SELECT false, 'rate_limited'::TEXT, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;

    -- OK to send new notification
    RETURN QUERY SELECT true, 'new_notification'::TEXT, NULL::UUID, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Record notification sent
CREATE OR REPLACE FUNCTION ops.record_notification_sent(
    p_incident_key TEXT,
    p_slo_id UUID,
    p_destination TEXT,
    p_message_id TEXT,
    p_correlation_id UUID,
    p_payload JSONB,
    p_payload_hash TEXT DEFAULT NULL,
    p_severity TEXT DEFAULT 'warning',
    p_incident_status TEXT DEFAULT 'open',
    p_routing_reason TEXT DEFAULT 'new_incident'
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO ops.incident_notifications (
        incident_key,
        slo_id,
        destination,
        destination_channel,
        routing_reason,
        status,
        sent_at,
        message_id,
        correlation_id,
        environment,
        payload_hash,
        severity,
        incident_status,
        payload
    ) VALUES (
        p_incident_key,
        p_slo_id,
        p_destination,
        NULL,
        p_routing_reason,
        'sent',
        now(),
        p_message_id,
        p_correlation_id,
        coalesce(current_setting('app.environment', true), 'production'),
        p_payload_hash,
        p_severity,
        p_incident_status,
        p_payload
    )
    ON CONFLICT (incident_key, destination)
    DO UPDATE SET
        status = 'sent',
        sent_at = now(),
        message_id = EXCLUDED.message_id,
        correlation_id = EXCLUDED.correlation_id,
        payload_hash = EXCLUDED.payload_hash,
        payload = EXCLUDED.payload,
        incident_status = EXCLUDED.incident_status,
        routing_reason = EXCLUDED.routing_reason,
        retry_count = 0,
        error_message = NULL,
        updated_at = now()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get incidents needing notification
CREATE OR REPLACE FUNCTION ops.get_incidents_pending_notification(
    p_destination TEXT,
    p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
    incident_id UUID,
    slo_id UUID,
    slo_name TEXT,
    severity TEXT,
    status TEXT,
    opened_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    trigger_value NUMERIC,
    trigger_threshold NUMERIC,
    evidence JSONB,
    needs_notification BOOLEAN,
    notification_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH cursor_pos AS (
        SELECT last_processed_at FROM ops.notification_cursor WHERE id = 'default'
    ),
    recent_incidents AS (
        SELECT
            i.id as incident_id,
            i.slo_id,
            s.name as slo_name,
            i.severity,
            i.status,
            i.opened_at,
            i.acknowledged_at,
            i.resolved_at,
            i.trigger_value,
            i.trigger_threshold,
            i.evidence
        FROM ops.slo_incidents i
        JOIN ops.slos s ON i.slo_id = s.id
        WHERE i.opened_at > COALESCE((SELECT last_processed_at FROM cursor_pos), now() - interval '1 hour')
           OR i.acknowledged_at > COALESCE((SELECT last_processed_at FROM cursor_pos), now() - interval '1 hour')
           OR i.resolved_at > COALESCE((SELECT last_processed_at FROM cursor_pos), now() - interval '1 hour')
        ORDER BY i.opened_at DESC
        LIMIT p_limit
    )
    SELECT
        ri.*,
        CASE
            WHEN n.id IS NULL THEN true
            WHEN ri.status != n.incident_status THEN true
            ELSE false
        END as needs_notification,
        CASE
            WHEN n.id IS NULL THEN 'new_incident'
            WHEN ri.status != n.incident_status THEN 'status_change'
            ELSE 'no_change'
        END as notification_reason
    FROM recent_incidents ri
    LEFT JOIN ops.incident_notifications n
        ON n.incident_key = ri.incident_id::text
        AND n.destination = p_destination;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get weekly digest data
CREATE OR REPLACE FUNCTION ops.get_weekly_digest_data(
    p_period_start TIMESTAMPTZ DEFAULT now() - interval '7 days',
    p_period_end TIMESTAMPTZ DEFAULT now()
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'period_start', p_period_start,
        'period_end', p_period_end,
        'incident_counts', (
            SELECT jsonb_build_object(
                'total', COUNT(*),
                'critical', COUNT(*) FILTER (WHERE severity = 'critical'),
                'warning', COUNT(*) FILTER (WHERE severity = 'warning'),
                'open', COUNT(*) FILTER (WHERE status = 'open'),
                'acknowledged', COUNT(*) FILTER (WHERE status = 'acknowledged'),
                'resolved', COUNT(*) FILTER (WHERE status = 'resolved')
            )
            FROM ops.slo_incidents
            WHERE opened_at BETWEEN p_period_start AND p_period_end
        ),
        'top_noisy_slos', (
            SELECT jsonb_agg(noisy_slo ORDER BY incident_count DESC)
            FROM (
                SELECT jsonb_build_object(
                    'slo_id', i.slo_id,
                    'slo_name', s.name,
                    'incident_count', COUNT(*)
                ) as noisy_slo, COUNT(*) as incident_count
                FROM ops.slo_incidents i
                JOIN ops.slos s ON i.slo_id = s.id
                WHERE i.opened_at BETWEEN p_period_start AND p_period_end
                GROUP BY i.slo_id, s.name
                ORDER BY COUNT(*) DESC
                LIMIT 5
            ) sub
        ),
        'timing_metrics', (
            SELECT jsonb_build_object(
                'avg_time_to_ack_minutes', EXTRACT(EPOCH FROM AVG(acknowledged_at - opened_at))/60,
                'avg_time_to_resolve_minutes', EXTRACT(EPOCH FROM AVG(resolved_at - opened_at))/60,
                'median_time_to_ack_minutes', PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (acknowledged_at - opened_at))/60),
                'median_time_to_resolve_minutes', PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (resolved_at - opened_at))/60)
            )
            FROM ops.slo_incidents
            WHERE opened_at BETWEEN p_period_start AND p_period_end
              AND status = 'resolved'
        ),
        'evaluation_health', (
            SELECT jsonb_build_object(
                'total_evaluations', COUNT(*),
                'successful_evaluations', COUNT(*) FILTER (WHERE NOT is_error),
                'error_rate', ROUND(COUNT(*) FILTER (WHERE is_error)::numeric / NULLIF(COUNT(*), 0) * 100, 2)
            )
            FROM ops.slo_evaluations
            WHERE evaluated_at BETWEEN p_period_start AND p_period_end
        ),
        'slo_health_summary', (
            SELECT jsonb_agg(slo_health)
            FROM (
                SELECT jsonb_build_object(
                    'slo_id', s.id,
                    'slo_name', s.name,
                    'current_status', e.status,
                    'last_evaluation', e.evaluated_at,
                    'week_incidents', (
                        SELECT COUNT(*)
                        FROM ops.slo_incidents i
                        WHERE i.slo_id = s.id
                          AND i.opened_at BETWEEN p_period_start AND p_period_end
                    )
                ) as slo_health
                FROM ops.slos s
                LEFT JOIN LATERAL (
                    SELECT status, evaluated_at
                    FROM ops.slo_evaluations
                    WHERE slo_id = s.id
                    ORDER BY evaluated_at DESC
                    LIMIT 1
                ) e ON true
                WHERE s.is_enabled = true
            ) sub
        ),
        'generated_at', now()
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Seed Default Preferences
-- ============================================================================

INSERT INTO ops.notification_prefs (environment, destination, enabled, severity_threshold, cooldown_minutes, max_per_hour)
VALUES
    ('production', 'discord', false, 'warning', 15, 20),
    ('production', 'notion', false, 'warning', 60, 10),
    ('staging', 'discord', false, 'critical', 5, 50),
    ('staging', 'notion', false, 'critical', 30, 20),
    ('development', 'discord', false, 'warning', 1, 100),
    ('development', 'notion', false, 'warning', 5, 50)
ON CONFLICT (environment, destination) DO NOTHING;

-- Initialize cursor
INSERT INTO ops.notification_cursor (id, last_processed_at)
VALUES ('default', now() - interval '1 hour')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE ops.incident_notifications IS
    'Tracks all outgoing notifications for SLO incidents. Provides idempotency and delivery tracking.';

COMMENT ON TABLE ops.notification_prefs IS
    'Configuration for notification routing per environment and severity.';

COMMENT ON TABLE ops.notification_cursor IS
    'Tracks the last poll position for incremental notification processing.';

COMMENT ON TABLE ops.digest_history IS
    'Tracks weekly digest generation and delivery.';

COMMENT ON FUNCTION ops.should_send_notification IS
    'Checks if a notification should be sent based on cooldown, dedupe, and rate limits.';

COMMENT ON FUNCTION ops.record_notification_sent IS
    'Records a sent notification with upsert for idempotency.';

COMMENT ON FUNCTION ops.get_incidents_pending_notification IS
    'Returns incidents that need notification for a given destination.';

COMMENT ON FUNCTION ops.get_weekly_digest_data IS
    'Aggregates weekly ops metrics for digest generation.';
