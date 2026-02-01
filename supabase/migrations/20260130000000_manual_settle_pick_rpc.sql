-- ============================================================================
-- UNIFIED-OPS-002: Operator-Safe Manual Settlement RPC
-- Date: 2026-01-30
-- Purpose: Replace unsafe JSON settlement scripts with idempotent, audited RPC
-- Fail-closed: rejects invalid inputs, requires pick to exist, prevents re-settle
-- Writes: prop_settlements, unified_picks, settlement_log, audit_log, events
-- ============================================================================

-- 1. Create the manual_settle_pick RPC function
CREATE OR REPLACE FUNCTION manual_settle_pick(
  p_pick_id UUID,
  p_result TEXT,                           -- 'win', 'loss', 'push'
  p_settled_at TIMESTAMPTZ DEFAULT NOW(),  -- operator can override settlement time
  p_meta JSONB DEFAULT '{}'::JSONB         -- extensible metadata (actual_value, notes, etc.)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pick RECORD;
  v_settlement_id UUID;
  v_trace TEXT;
  v_operator TEXT;
  v_actual_value DECIMAL;
  v_notes TEXT;
BEGIN
  -- Extract optional fields from p_meta
  v_operator := COALESCE(p_meta->>'operator', 'operator');
  v_actual_value := (p_meta->>'actual_value')::DECIMAL;
  v_notes := p_meta->>'notes';
  v_trace := COALESCE(p_meta->>'trace_id', 'ops-' || gen_random_uuid()::TEXT);

  -- ========== VALIDATION ==========

  -- Validate result value (fail-closed: only win/loss/push)
  IF p_result NOT IN ('win', 'loss', 'push') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid result. Must be one of: win, loss, push',
      'trace_id', v_trace
    );
  END IF;

  -- Validate pick exists
  SELECT id, settlement_status, settlement_result, settled_at,
         player_name, stat_type, line, bet_side, sport,
         capper_id, user_id, odds, confidence, professional_score,
         promotion_band, bet_type, market
  INTO v_pick
  FROM unified_picks
  WHERE id = p_pick_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pick not found: ' || p_pick_id::TEXT,
      'trace_id', v_trace
    );
  END IF;

  -- ========== IDEMPOTENCY CHECK ==========
  -- If already settled with the SAME result, return success (idempotent)
  IF v_pick.settlement_status = 'settled' AND v_pick.settlement_result = p_result THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'message', 'Pick already settled with same result',
      'pick_id', p_pick_id,
      'result', p_result,
      'settled_at', v_pick.settled_at,
      'trace_id', v_trace
    );
  END IF;

  -- If already settled with a DIFFERENT result, reject (operator must void first)
  IF v_pick.settlement_status = 'settled' AND v_pick.settlement_result IS DISTINCT FROM p_result THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pick already settled as ' || COALESCE(v_pick.settlement_result, 'unknown')
               || '. Cannot re-settle with different result.',
      'pick_id', p_pick_id,
      'current_result', v_pick.settlement_result,
      'requested_result', p_result,
      'trace_id', v_trace
    );
  END IF;

  -- ========== SETTLEMENT WRITE (5 tables) ==========

  -- 1. Insert into prop_settlements (canonical settlement fact)
  INSERT INTO prop_settlements (
    final_pick_id,
    player_name,
    stat_type,
    line,
    bet_side,
    actual_value,
    settlement_result,
    settlement_method,
    data_source,
    settlement_confidence,
    data_quality_score,
    settled_at,
    created_at,
    updated_at
  ) VALUES (
    p_pick_id,
    COALESCE(v_pick.player_name, 'Unknown'),
    COALESCE(v_pick.stat_type, 'Unknown'),
    COALESCE(v_pick.line, 0),
    COALESCE(v_pick.bet_side, 'unknown'),
    v_actual_value,
    p_result,
    'manual',
    'operator',
    1.0,
    1.0,
    p_settled_at,
    p_settled_at,
    p_settled_at
  )
  RETURNING id INTO v_settlement_id;

  -- 2. Update unified_picks
  UPDATE unified_picks
  SET settlement_status = 'settled',
      settlement_result = p_result,
      settled_at = p_settled_at,
      actual_outcome = v_actual_value,
      updated_at = p_settled_at
  WHERE id = p_pick_id;

  -- 3. Insert settlement_log audit entry
  INSERT INTO settlement_log (
    prop_settlement_id,
    action_type,
    old_values,
    new_values,
    data_source,
    processing_agent,
    confidence_score,
    notes,
    performed_at
  ) VALUES (
    v_settlement_id,
    'created',
    jsonb_build_object(
      'settlement_status', COALESCE(v_pick.settlement_status, 'pending'),
      'settlement_result', v_pick.settlement_result
    ),
    jsonb_build_object(
      'settlement_status', 'settled',
      'settlement_result', p_result,
      'actual_value', v_actual_value
    ),
    'operator',
    'manual_settle_pick_rpc',
    1.0,
    COALESCE(v_notes, 'Operator manual settlement via RPC'),
    p_settled_at
  );

  -- 4. Insert audit_log entry (operator action trail)
  INSERT INTO audit_log (
    actor,
    action,
    resource_type,
    resource_id,
    payload,
    previous_state,
    new_state,
    status,
    created_at
  ) VALUES (
    v_operator,
    'manual_settlement',
    'unified_picks',
    p_pick_id::TEXT,
    jsonb_build_object(
      'result', p_result,
      'actual_value', v_actual_value,
      'settlement_id', v_settlement_id,
      'trace_id', v_trace,
      'notes', v_notes,
      'meta', p_meta
    ),
    jsonb_build_object(
      'settlement_status', COALESCE(v_pick.settlement_status, 'pending'),
      'settlement_result', v_pick.settlement_result
    ),
    jsonb_build_object(
      'settlement_status', 'settled',
      'settlement_result', p_result,
      'settled_at', p_settled_at
    ),
    'success',
    p_settled_at
  );

  -- 5. Emit PICK_SETTLED event for downstream consumers (SettlementAgent, RecapAgent)
  --    Uses the events table from migration 006_event_sourcing_architecture.sql
  --    Idempotency key prevents duplicate events for the same settlement
  INSERT INTO events (
    event_type,
    aggregate_id,
    aggregate_type,
    event_data,
    metadata,
    idempotency_key,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    'PICK_SETTLED',
    p_pick_id,
    'unified_picks',
    jsonb_build_object(
      'pick_id', p_pick_id,
      'settlement_id', v_settlement_id,
      'result', p_result,
      'settled_at', p_settled_at,
      'player_name', COALESCE(v_pick.player_name, 'Unknown'),
      'stat_type', COALESCE(v_pick.stat_type, 'Unknown'),
      'sport', v_pick.sport,
      'line', v_pick.line,
      'odds', v_pick.odds,
      'promotion_band', v_pick.promotion_band,
      'actual_value', v_actual_value
    ),
    jsonb_build_object(
      'operator', v_operator,
      'trace_id', v_trace,
      'settlement_method', 'manual',
      'source', 'manual_settle_pick_rpc'
    ),
    'PICK_SETTLED:' || v_settlement_id::TEXT,
    v_operator,
    p_settled_at,
    p_settled_at
  );

  -- ========== RETURN SUCCESS ==========
  RETURN jsonb_build_object(
    'success', true,
    'pick_id', p_pick_id,
    'settlement_id', v_settlement_id,
    'result', p_result,
    'actual_value', v_actual_value,
    'settled_at', p_settled_at,
    'trace_id', v_trace,
    'operator', v_operator,
    'event_emitted', 'PICK_SETTLED'
  );

EXCEPTION WHEN OTHERS THEN
  -- Fail-closed: return structured error, do not leave partial state
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE,
    'trace_id', v_trace
  );
END;
$$;

-- Add documentation
COMMENT ON FUNCTION manual_settle_pick IS
  'Operator-safe manual settlement RPC. Idempotent, audited, fail-closed. '
  'Writes to prop_settlements, unified_picks, settlement_log, audit_log, and events. '
  'Emits PICK_SETTLED event for downstream consumption. '
  'Rejects invalid results and prevents duplicate settlements. '
  'Part of UNIFIED-OPS-002.';
