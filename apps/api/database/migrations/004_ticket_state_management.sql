-- Ticket State Management Migration
-- Implements sophisticated leg-aware ticket tracking with state machine architecture
-- Supports single bets, parlays, and round robin ticket types with real-time state transitions

-- =============================================
-- 1. TICKET STATES TABLE
-- =============================================
-- Core ticket state machine tracking

CREATE TABLE IF NOT EXISTS ticket_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ticket identification
    ticket_id VARCHAR(255) NOT NULL UNIQUE,
    ticket_type VARCHAR(20) NOT NULL CHECK (ticket_type IN ('single', 'parlay', 'round_robin')),
    
    -- State machine
    state VARCHAR(20) NOT NULL CHECK (state IN ('OPEN', 'LIVE', 'SWEAT', 'HEDGE_WINDOW', 'DONE')),
    state_entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    state_metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Leg tracking
    legs_total INTEGER NOT NULL CHECK (legs_total > 0),
    legs_hit INTEGER NOT NULL DEFAULT 0 CHECK (legs_hit >= 0),
    legs_miss INTEGER NOT NULL DEFAULT 0 CHECK (legs_miss >= 0),
    legs_pending INTEGER NOT NULL CHECK (legs_pending >= 0),
    current_leg_index INTEGER NOT NULL DEFAULT 0,
    
    -- Financial tracking
    exposure_units DECIMAL(10,2) NOT NULL DEFAULT 1.00 CHECK (exposure_units > 0),
    potential_payout DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    cashout_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    cashout_ev_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    
    -- Hedge recommendations
    hedge_recommendations JSONB NOT NULL DEFAULT '[]',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT ticket_states_leg_math CHECK (legs_hit + legs_miss + legs_pending = legs_total),
    CONSTRAINT ticket_states_current_leg CHECK (current_leg_index >= 0 AND current_leg_index < legs_total)
);

-- =============================================
-- 2. TICKET LEGS TABLE
-- =============================================
-- Individual legs/bets within each ticket

CREATE TABLE IF NOT EXISTS ticket_legs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ticket relationship
    ticket_id VARCHAR(255) NOT NULL REFERENCES ticket_states(ticket_id) ON DELETE CASCADE,
    leg_index INTEGER NOT NULL CHECK (leg_index >= 0),
    
    -- Bet details
    player_name VARCHAR(255) NOT NULL,
    stat_type VARCHAR(100) NOT NULL,
    line DECIMAL(10,2) NOT NULL,
    odds INTEGER NOT NULL,
    
    -- Outcome tracking
    outcome VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'hit', 'miss', 'void')),
    
    -- Game context
    game_id VARCHAR(255),
    game_status VARCHAR(20) DEFAULT 'scheduled' CHECK (game_status IN ('scheduled', 'live', 'final', 'postponed')),
    game_start_time TIMESTAMPTZ,
    
    -- Market data at time of bet
    book VARCHAR(100),
    market_close_time TIMESTAMPTZ,
    implied_probability DECIMAL(8,6),
    
    -- Result data
    final_stat_value DECIMAL(10,2),
    result_verified_at TIMESTAMPTZ,
    result_source VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint per ticket
    UNIQUE(ticket_id, leg_index)
);

-- =============================================
-- 3. STATE TRANSITION HISTORY TABLE
-- =============================================
-- Complete audit trail of all state transitions

CREATE TABLE IF NOT EXISTS ticket_state_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ticket reference
    ticket_id VARCHAR(255) NOT NULL,
    
    -- Transition details
    from_state VARCHAR(20) CHECK (from_state IN ('OPEN', 'LIVE', 'SWEAT', 'HEDGE_WINDOW', 'DONE')),
    to_state VARCHAR(20) NOT NULL CHECK (to_state IN ('OPEN', 'LIVE', 'SWEAT', 'HEDGE_WINDOW', 'DONE')),
    trigger VARCHAR(100) NOT NULL,
    
    -- Transition metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    transition_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Audit fields
    triggered_by VARCHAR(100) DEFAULT 'system',
    processing_time_ms INTEGER,
    
    -- Indexes for fast lookup
    INDEX(ticket_id, transition_timestamp DESC),
    INDEX(to_state, transition_timestamp DESC)
);

-- =============================================
-- 4. HEDGE RECOMMENDATIONS TABLE
-- =============================================
-- Detailed hedge and arbitrage opportunities

CREATE TABLE IF NOT EXISTS hedge_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ticket reference
    ticket_id VARCHAR(255) NOT NULL,
    
    -- Recommendation details
    type VARCHAR(30) NOT NULL CHECK (type IN ('full_hedge', 'middle_opportunity', 'freeroll')),
    player_name VARCHAR(255) NOT NULL,
    stat_type VARCHAR(100) NOT NULL,
    
    -- Betting details
    recommended_line DECIMAL(10,2) NOT NULL,
    recommended_odds INTEGER NOT NULL,
    hedge_amount_units DECIMAL(10,2) NOT NULL,
    expected_profit DECIMAL(12,2) NOT NULL,
    
    -- Confidence and availability
    confidence DECIMAL(4,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    books_available TEXT[] NOT NULL DEFAULT '{}',
    
    -- Lifecycle
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    executed_at TIMESTAMPTZ,
    execution_outcome VARCHAR(50),
    
    -- Analytics
    opportunity_score DECIMAL(8,4),
    risk_assessment JSONB DEFAULT '{}',
    market_conditions JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Indexes
    INDEX(ticket_id, is_active, expires_at),
    INDEX(type, confidence DESC, created_at DESC),
    INDEX(expires_at) WHERE is_active = TRUE
);

-- =============================================
-- 5. ALERT COOLDOWNS TABLE (enhanced)
-- =============================================
-- Prevent alert spam with sophisticated cooldown management

CREATE TABLE IF NOT EXISTS alert_cooldowns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Alert identification
    alert_type VARCHAR(50) NOT NULL,
    entity_key VARCHAR(255) NOT NULL,
    ticket_id VARCHAR(255), -- Optional ticket reference
    
    -- Cooldown management
    cooldown_until TIMESTAMPTZ NOT NULL,
    cooldown_duration_seconds INTEGER NOT NULL,
    
    -- Alert context
    metadata JSONB NOT NULL DEFAULT '{}',
    alert_count INTEGER NOT NULL DEFAULT 1,
    last_alert_sent TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Escalation management
    escalation_level INTEGER NOT NULL DEFAULT 0,
    max_escalations INTEGER NOT NULL DEFAULT 3,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(alert_type, entity_key),
    
    -- Indexes
    INDEX(alert_type, cooldown_until),
    INDEX(ticket_id, alert_type) WHERE ticket_id IS NOT NULL
);

-- =============================================
-- 6. PERFORMANCE INDEXES
-- =============================================

-- Ticket states indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_ticket_states_state_entered ON ticket_states(state, state_entered_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_states_type_state ON ticket_states(ticket_type, state);
CREATE INDEX IF NOT EXISTS idx_ticket_states_live_tickets ON ticket_states(state, updated_at DESC) WHERE state IN ('LIVE', 'SWEAT');
CREATE INDEX IF NOT EXISTS idx_ticket_states_hedge_window ON ticket_states(state, cashout_ev_percentage DESC) WHERE state = 'HEDGE_WINDOW';

-- Ticket legs indexes for outcome updates
CREATE INDEX IF NOT EXISTS idx_ticket_legs_ticket_outcome ON ticket_legs(ticket_id, outcome);
CREATE INDEX IF NOT EXISTS idx_ticket_legs_game_status ON ticket_legs(game_status, game_start_time) WHERE outcome = 'pending';
CREATE INDEX IF NOT EXISTS idx_ticket_legs_player_stat ON ticket_legs(player_name, stat_type, game_start_time DESC);

-- State transitions indexes for analytics
CREATE INDEX IF NOT EXISTS idx_transitions_ticket_recent ON ticket_state_transitions(ticket_id, transition_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transitions_state_analysis ON ticket_state_transitions(to_state, trigger, transition_timestamp DESC);

-- Hedge recommendations indexes for real-time lookups
CREATE INDEX IF NOT EXISTS idx_hedge_active_by_ticket ON hedge_recommendations(ticket_id, is_active, confidence DESC) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_hedge_expiring_soon ON hedge_recommendations(expires_at) WHERE is_active = TRUE AND expires_at <= NOW() + INTERVAL '1 hour';

-- =============================================
-- 7. AUTOMATED FUNCTIONS
-- =============================================

-- Function to automatically update ticket state counts when legs change
CREATE OR REPLACE FUNCTION update_ticket_leg_counts()
RETURNS TRIGGER AS $$
DECLARE
    legs_hit_count INTEGER;
    legs_miss_count INTEGER;
    legs_pending_count INTEGER;
BEGIN
    -- Calculate current leg counts for this ticket
    SELECT 
        COUNT(*) FILTER (WHERE outcome = 'hit'),
        COUNT(*) FILTER (WHERE outcome = 'miss'),
        COUNT(*) FILTER (WHERE outcome = 'pending')
    INTO legs_hit_count, legs_miss_count, legs_pending_count
    FROM ticket_legs 
    WHERE ticket_id = COALESCE(NEW.ticket_id, OLD.ticket_id);
    
    -- Update the ticket_states table
    UPDATE ticket_states 
    SET 
        legs_hit = legs_hit_count,
        legs_miss = legs_miss_count,
        legs_pending = legs_pending_count,
        updated_at = NOW()
    WHERE ticket_id = COALESCE(NEW.ticket_id, OLD.ticket_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update counts when leg outcomes change
CREATE TRIGGER trigger_update_ticket_leg_counts
    AFTER INSERT OR UPDATE OR DELETE ON ticket_legs
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_leg_counts();

-- Function to clean up expired hedge recommendations
CREATE OR REPLACE FUNCTION cleanup_expired_hedge_recommendations()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE hedge_recommendations 
    SET 
        is_active = FALSE,
        updated_at = NOW()
    WHERE is_active = TRUE 
    AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get ticket state summary metrics
CREATE OR REPLACE FUNCTION get_ticket_state_metrics()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    state_counts JSONB;
    type_counts JSONB;
    active_tickets INTEGER;
    total_exposure DECIMAL;
BEGIN
    -- Count tickets by state
    SELECT jsonb_object_agg(state, count) INTO state_counts
    FROM (
        SELECT state, COUNT(*) as count
        FROM ticket_states 
        WHERE state != 'DONE'
        GROUP BY state
    ) state_summary;
    
    -- Count tickets by type
    SELECT jsonb_object_agg(ticket_type, count) INTO type_counts
    FROM (
        SELECT ticket_type, COUNT(*) as count
        FROM ticket_states 
        WHERE state != 'DONE'
        GROUP BY ticket_type
    ) type_summary;
    
    -- Calculate active tickets and total exposure
    SELECT COUNT(*), COALESCE(SUM(exposure_units), 0)
    INTO active_tickets, total_exposure
    FROM ticket_states 
    WHERE state != 'DONE';
    
    result := jsonb_build_object(
        'active_tickets', active_tickets,
        'total_exposure_units', total_exposure,
        'state_distribution', COALESCE(state_counts, '{}'),
        'type_distribution', COALESCE(type_counts, '{}'),
        'generated_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 8. ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on all tables
ALTER TABLE ticket_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hedge_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_cooldowns ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Users can read their ticket states" ON ticket_states
    FOR SELECT USING (true); -- Simplified for now, can add user filtering later

CREATE POLICY "System can manage ticket states" ON ticket_states
    FOR ALL USING (auth.jwt() ->> 'role' IN ('service_role', 'admin'));

CREATE POLICY "Users can read ticket legs" ON ticket_legs
    FOR SELECT USING (true);

CREATE POLICY "System can manage ticket legs" ON ticket_legs
    FOR ALL USING (auth.jwt() ->> 'role' IN ('service_role', 'admin'));

CREATE POLICY "System can manage transitions" ON ticket_state_transitions
    FOR ALL USING (auth.jwt() ->> 'role' IN ('service_role', 'admin'));

CREATE POLICY "System can manage hedge recommendations" ON hedge_recommendations
    FOR ALL USING (auth.jwt() ->> 'role' IN ('service_role', 'admin'));

CREATE POLICY "System can manage alert cooldowns" ON alert_cooldowns
    FOR ALL USING (auth.jwt() ->> 'role' IN ('service_role', 'admin'));

-- =============================================
-- 9. GRANTS AND PERMISSIONS
-- =============================================

-- Grant appropriate permissions
GRANT SELECT ON ticket_states TO authenticated;
GRANT INSERT, UPDATE ON ticket_states TO service_role;

GRANT SELECT ON ticket_legs TO authenticated;
GRANT ALL ON ticket_legs TO service_role;

GRANT SELECT ON ticket_state_transitions TO authenticated;
GRANT ALL ON ticket_state_transitions TO service_role;

GRANT SELECT ON hedge_recommendations TO authenticated;
GRANT ALL ON hedge_recommendations TO service_role;

GRANT ALL ON alert_cooldowns TO service_role;

-- =============================================
-- 10. COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON TABLE ticket_states IS 'Core ticket state machine tracking with leg-aware management';
COMMENT ON TABLE ticket_legs IS 'Individual legs/bets within each ticket for granular tracking';
COMMENT ON TABLE ticket_state_transitions IS 'Complete audit trail of all state transitions for analytics';
COMMENT ON TABLE hedge_recommendations IS 'AI-generated hedge and arbitrage opportunities with execution tracking';
COMMENT ON TABLE alert_cooldowns IS 'Sophisticated alert rate limiting and escalation management';

COMMENT ON COLUMN ticket_states.state IS 'State machine: OPEN -> LIVE -> SWEAT -> HEDGE_WINDOW -> DONE';
COMMENT ON COLUMN ticket_states.cashout_ev_percentage IS 'Expected value percentage for cashout decisions (triggers HEDGE_WINDOW at 65%+)';
COMMENT ON COLUMN ticket_legs.outcome IS 'Leg result: pending, hit, miss, void';
COMMENT ON COLUMN hedge_recommendations.confidence IS 'AI confidence score 0-1 for recommendation quality';

-- Performance optimization
ANALYZE ticket_states;
ANALYZE ticket_legs;
ANALYZE ticket_state_transitions;
ANALYZE hedge_recommendations;
ANALYZE alert_cooldowns;