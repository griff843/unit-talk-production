-- ============================================================================
-- SPRINT-REM-001-SETTLEMENT-RPC-GUARD-FIX: Deploy seal-patched settlement RPCs
-- Date: 2026-03-18
-- Purpose: The seal-patched manual_settle_pick() and correct_settlement()
--   functions (from 20260215100000_settlement_guard_seal_patch.sql) were never
--   deployed to production. The deployed manual_settle_pick() lacks the
--   set_config('settlement.rpc_context', 'true', true) call, causing the
--   prevent_direct_settlement_update() trigger to block ALL settlement writes
--   — including authorized RPC calls. correct_settlement() does not exist at all.
--
-- Root cause: The seal patch migration was recorded as applied but the
--   CREATE OR REPLACE FUNCTION statements never took effect.
--
-- Fix: Re-deploy both functions from the seal-patch specification.
--
-- Rollback: Previous function versions can be restored from
--   supabase/migrations/20260131000000_schema_parity_ops_settlement.sql
-- ============================================================================

-- ========================================================================
-- 1. Deploy manual_settle_pick() with settlement.rpc_context flag
-- ========================================================================

CREATE OR REPLACE FUNCTION manual_settle_pick(
  p_pick_id UUID,
  p_result TEXT,
  p_settled_at TIMESTAMPTZ DEFAULT NOW(),
  p_meta JSONB DEFAULT '{}'::JSONB
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
  v_new_hash TEXT;
  v_new_version INTEGER;
  v_idempotency_key TEXT;
  v_result JSONB;
BEGIN
  -- SET CONTEXT FLAG: Allow trigger to pass
  PERFORM set_config('settlement.rpc_context', 'true', true);

  -- Extract optional fields from p_meta
  v_operator := COALESCE(p_meta->>'operator', 'operator');
  v_actual_value := (p_meta->>'actual_value')::DECIMAL;
  v_notes := p_meta->>'notes';
  v_trace := COALESCE(p_meta->>'trace_id', 'ops-' || gen_random_uuid()::TEXT);

  -- ========== VALIDATION ==========

  IF p_result NOT IN ('win', 'loss', 'push') THEN
    -- RESET CONTEXT before return
    PERFORM set_config('settlement.rpc_context', 'false', true);
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid result. Must be one of: win, loss, push',
      'trace_id', v_trace
    );
  END IF;

  SELECT id, settlement_status, settlement_result, settled_at,
         player_name, stat_type, line, side, sport,
         capper_id, user_id, odds, confidence, professional_score,
         promotion_band, bet_type, market,
         settlement_version, settlement_hash
  INTO v_pick
  FROM unified_picks
  WHERE id = p_pick_id;

  IF NOT FOUND THEN
    -- RESET CONTEXT before return
    PERFORM set_config('settlement.rpc_context', 'false', true);
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pick not found: ' || p_pick_id::TEXT,
      'trace_id', v_trace
    );
  END IF;

  v_new_hash := generate_settlement_hash(p_pick_id, p_result, v_actual_value, p_settled_at);

  -- ========== HASH-BASED IDEMPOTENCY CHECK ==========
  IF v_pick.settlement_hash = v_new_hash THEN
    -- RESET CONTEXT before return
    PERFORM set_config('settlement.rpc_context', 'false', true);
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'message', 'Settlement already applied (hash match)',
      'pick_id', p_pick_id,
      'result', p_result,
      'settlement_hash', v_new_hash,
      'settlement_version', COALESCE(v_pick.settlement_version, 0),
      'settled_at', v_pick.settled_at,
      'trace_id', v_trace
    );
  END IF;

  -- ========== SETTLEMENT GUARD: REJECT SILENT OVERWRITES ==========
  IF COALESCE(v_pick.settlement_version, 0) > 0 THEN
    -- RESET CONTEXT before return
    PERFORM set_config('settlement.rpc_context', 'false', true);
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pick already settled (version ' || v_pick.settlement_version || '). ' ||
               'Use correct_settlement() to change settlement.',
      'guard_triggered', true,
      'pick_id', p_pick_id,
      'current_result', v_pick.settlement_result,
      'current_version', v_pick.settlement_version,
      'requested_result', p_result,
      'trace_id', v_trace
    );
  END IF;

  -- ========== FIRST-TIME SETTLEMENT (version 0 -> 1) ==========
  v_new_version := 1;
  v_idempotency_key := 'settle:' || p_pick_id::TEXT || ':v' || v_new_version::TEXT || ':' || v_new_hash;

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
    COALESCE(v_pick.side, 'unknown'),
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

  UPDATE unified_picks
  SET settlement_status = 'settled',
      settlement_result = p_result,
      settled_at = p_settled_at,
      actual_outcome = v_actual_value,
      settlement_version = v_new_version,
      settlement_hash = v_new_hash,
      updated_at = p_settled_at
  WHERE id = p_pick_id;

  INSERT INTO settlement_audit_log (
    pick_id,
    prop_settlement_id,
    prev_settlement,
    new_settlement,
    prev_hash,
    new_hash,
    action_type,
    changed_by,
    reason,
    idempotency_key,
    trace_id,
    created_at
  ) VALUES (
    p_pick_id,
    v_settlement_id,
    jsonb_build_object(
      'settlement_status', COALESCE(v_pick.settlement_status, 'pending'),
      'settlement_result', v_pick.settlement_result,
      'actual_outcome', NULL,
      'settlement_version', 0
    ),
    jsonb_build_object(
      'settlement_status', 'settled',
      'settlement_result', p_result,
      'actual_outcome', v_actual_value,
      'settlement_version', v_new_version
    ),
    v_pick.settlement_hash,
    v_new_hash,
    'initial',
    v_operator,
    COALESCE(v_notes, 'Initial settlement via manual_settle_pick RPC'),
    v_idempotency_key,
    v_trace,
    p_settled_at
  );

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
      'actual_value', v_actual_value,
      'settlement_version', v_new_version,
      'settlement_hash', v_new_hash
    ),
    'operator',
    'manual_settle_pick_rpc',
    1.0,
    COALESCE(v_notes, 'Operator manual settlement via RPC'),
    p_settled_at
  );

  INSERT INTO audit_log (
    actor,
    action,
    entity_type,
    entity_id,
    details,
    created_at
  ) VALUES (
    v_operator,
    'manual_settlement',
    'unified_picks',
    p_pick_id,
    jsonb_build_object(
      'result', p_result,
      'actual_value', v_actual_value,
      'settlement_id', v_settlement_id,
      'settlement_version', v_new_version,
      'settlement_hash', v_new_hash,
      'trace_id', v_trace,
      'notes', v_notes,
      'meta', p_meta
    ),
    p_settled_at
  );

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
      'actual_value', v_actual_value,
      'settlement_version', v_new_version,
      'settlement_hash', v_new_hash
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

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'pick_id', p_pick_id,
    'settlement_id', v_settlement_id,
    'result', p_result,
    'actual_value', v_actual_value,
    'settled_at', p_settled_at,
    'settlement_version', v_new_version,
    'settlement_hash', v_new_hash,
    'trace_id', v_trace,
    'operator', v_operator,
    'event_emitted', 'PICK_SETTLED'
  );

  -- RESET CONTEXT before successful return
  PERFORM set_config('settlement.rpc_context', 'false', true);
  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- RESET CONTEXT in exception handler
  PERFORM set_config('settlement.rpc_context', 'false', true);
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE,
    'trace_id', v_trace
  );
END;
$$;

COMMENT ON FUNCTION manual_settle_pick(UUID, TEXT, TIMESTAMPTZ, JSONB) IS
  'SPRINT-REM-001: Deploys seal-patched manual_settle_pick with settlement.rpc_context flag.';

-- ========================================================================
-- 2. Deploy correct_settlement() with settlement.rpc_context flag
-- ========================================================================

CREATE OR REPLACE FUNCTION correct_settlement(
  p_pick_id UUID,
  p_new_result TEXT,
  p_reason TEXT,
  p_meta JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pick RECORD;
  v_trace TEXT;
  v_operator TEXT;
  v_new_actual_value DECIMAL;
  v_new_hash TEXT;
  v_new_version INTEGER;
  v_idempotency_key TEXT;
  v_now TIMESTAMPTZ;
  v_audit_id UUID;
  v_freeze_config RECORD;
  v_freeze_deadline TIMESTAMPTZ;
  v_is_admin_override BOOLEAN;
  v_result JSONB;
BEGIN
  -- SET CONTEXT FLAG: Allow trigger to pass
  PERFORM set_config('settlement.rpc_context', 'true', true);

  v_now := NOW();
  v_operator := COALESCE(p_meta->>'operator', 'operator');
  v_new_actual_value := (p_meta->>'actual_value')::DECIMAL;
  v_trace := COALESCE(p_meta->>'trace_id', 'correction-' || gen_random_uuid()::TEXT);
  v_is_admin_override := COALESCE((p_meta->>'admin_override')::BOOLEAN, FALSE);

  -- ========== VALIDATION ==========

  IF p_new_result NOT IN ('win', 'loss', 'push', 'void') THEN
    PERFORM set_config('settlement.rpc_context', 'false', true);
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid result. Must be one of: win, loss, push, void',
      'trace_id', v_trace
    );
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    PERFORM set_config('settlement.rpc_context', 'false', true);
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Reason is required for settlement corrections',
      'trace_id', v_trace
    );
  END IF;

  SELECT id, settlement_status, settlement_result, settled_at,
         actual_outcome, player_name, stat_type, line, side, sport,
         capper_id, user_id, odds, confidence, professional_score,
         promotion_band, bet_type, market,
         settlement_version, settlement_hash,
         settlement_frozen, freeze_enforced_at
  INTO v_pick
  FROM unified_picks
  WHERE id = p_pick_id;

  IF NOT FOUND THEN
    PERFORM set_config('settlement.rpc_context', 'false', true);
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pick not found: ' || p_pick_id::TEXT,
      'trace_id', v_trace
    );
  END IF;

  IF COALESCE(v_pick.settlement_version, 0) = 0 THEN
    PERFORM set_config('settlement.rpc_context', 'false', true);
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot correct unsettled pick. Use manual_settle_pick for initial settlement.',
      'trace_id', v_trace
    );
  END IF;

  -- ========== FREEZE-LOCK CHECK ==========

  SELECT * INTO v_freeze_config
  FROM settlement_freeze_config
  WHERE sport = v_pick.sport OR sport IS NULL
  ORDER BY sport NULLS LAST
  LIMIT 1;

  IF v_freeze_config IS NOT NULL AND v_pick.settled_at IS NOT NULL THEN
    v_freeze_deadline := v_pick.settled_at + (v_freeze_config.freeze_window_hours || ' hours')::INTERVAL;

    IF v_now > v_freeze_deadline THEN
      IF v_is_admin_override AND v_freeze_config.admin_override_allowed THEN
        NULL; -- Admin override allowed, continue
      ELSE
        IF NOT COALESCE(v_pick.settlement_frozen, FALSE) THEN
          UPDATE unified_picks
          SET settlement_frozen = TRUE,
              freeze_enforced_at = v_now
          WHERE id = p_pick_id;
        END IF;

        PERFORM set_config('settlement.rpc_context', 'false', true);
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Settlement is freeze-locked. Corrections not allowed after ' ||
                   v_freeze_config.freeze_window_hours || ' hours.',
          'freeze_locked', true,
          'freeze_deadline', v_freeze_deadline,
          'settled_at', v_pick.settled_at,
          'admin_override_required', v_freeze_config.admin_override_allowed,
          'trace_id', v_trace
        );
      END IF;
    END IF;
  END IF;

  v_new_hash := generate_settlement_hash(p_pick_id, p_new_result, v_new_actual_value, v_now);

  -- ========== HASH-BASED IDEMPOTENCY CHECK ==========
  IF v_pick.settlement_hash = v_new_hash THEN
    PERFORM set_config('settlement.rpc_context', 'false', true);
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'message', 'Correction already applied (hash match)',
      'pick_id', p_pick_id,
      'result', p_new_result,
      'settlement_hash', v_new_hash,
      'settlement_version', v_pick.settlement_version,
      'trace_id', v_trace
    );
  END IF;

  v_new_version := COALESCE(v_pick.settlement_version, 0) + 1;
  v_idempotency_key := 'correct:' || p_pick_id::TEXT || ':v' || v_new_version::TEXT || ':' || v_new_hash;

  IF EXISTS (SELECT 1 FROM settlement_audit_log WHERE idempotency_key = v_idempotency_key) THEN
    PERFORM set_config('settlement.rpc_context', 'false', true);
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'message', 'Correction already recorded (idempotency_key match)',
      'pick_id', p_pick_id,
      'idempotency_key', v_idempotency_key,
      'trace_id', v_trace
    );
  END IF;

  -- ========== APPLY CORRECTION ==========

  INSERT INTO settlement_audit_log (
    pick_id,
    prev_settlement,
    new_settlement,
    prev_hash,
    new_hash,
    action_type,
    changed_by,
    reason,
    idempotency_key,
    trace_id,
    created_at
  ) VALUES (
    p_pick_id,
    jsonb_build_object(
      'settlement_status', v_pick.settlement_status,
      'settlement_result', v_pick.settlement_result,
      'actual_outcome', v_pick.actual_outcome,
      'settlement_version', v_pick.settlement_version,
      'settled_at', v_pick.settled_at,
      'admin_override', v_is_admin_override
    ),
    jsonb_build_object(
      'settlement_status', CASE WHEN p_new_result = 'void' THEN 'void' ELSE 'settled' END,
      'settlement_result', p_new_result,
      'actual_outcome', v_new_actual_value,
      'settlement_version', v_new_version,
      'settled_at', v_now,
      'admin_override', v_is_admin_override
    ),
    v_pick.settlement_hash,
    v_new_hash,
    CASE
      WHEN v_is_admin_override THEN 'admin_correction'
      WHEN p_new_result = 'void' THEN 'void'
      ELSE 'correction'
    END,
    v_operator,
    p_reason || CASE WHEN v_is_admin_override THEN ' [ADMIN OVERRIDE]' ELSE '' END,
    v_idempotency_key,
    v_trace,
    v_now
  )
  RETURNING id INTO v_audit_id;

  UPDATE unified_picks
  SET settlement_status = CASE WHEN p_new_result = 'void' THEN 'void' ELSE 'settled' END,
      settlement_result = p_new_result,
      actual_outcome = v_new_actual_value,
      settlement_version = v_new_version,
      settlement_hash = v_new_hash,
      updated_at = v_now
  WHERE id = p_pick_id;

  INSERT INTO settlement_log (
    action_type,
    old_values,
    new_values,
    data_source,
    processing_agent,
    confidence_score,
    notes,
    performed_at
  ) VALUES (
    'corrected',
    jsonb_build_object(
      'settlement_status', v_pick.settlement_status,
      'settlement_result', v_pick.settlement_result,
      'actual_outcome', v_pick.actual_outcome,
      'settlement_version', v_pick.settlement_version
    ),
    jsonb_build_object(
      'settlement_status', CASE WHEN p_new_result = 'void' THEN 'void' ELSE 'settled' END,
      'settlement_result', p_new_result,
      'actual_outcome', v_new_actual_value,
      'settlement_version', v_new_version
    ),
    'operator',
    'correct_settlement_rpc',
    1.0,
    p_reason,
    v_now
  );

  INSERT INTO audit_log (
    actor,
    action,
    entity_type,
    entity_id,
    details,
    created_at
  ) VALUES (
    v_operator,
    CASE WHEN v_is_admin_override THEN 'admin_settlement_correction' ELSE 'settlement_correction' END,
    'unified_picks',
    p_pick_id,
    jsonb_build_object(
      'prev_result', v_pick.settlement_result,
      'new_result', p_new_result,
      'prev_version', v_pick.settlement_version,
      'new_version', v_new_version,
      'reason', p_reason,
      'audit_id', v_audit_id,
      'trace_id', v_trace,
      'admin_override', v_is_admin_override
    ),
    v_now
  );

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
    'SETTLEMENT_CORRECTED',
    p_pick_id,
    'unified_picks',
    jsonb_build_object(
      'pick_id', p_pick_id,
      'audit_id', v_audit_id,
      'prev_result', v_pick.settlement_result,
      'new_result', p_new_result,
      'prev_version', v_pick.settlement_version,
      'new_version', v_new_version,
      'reason', p_reason,
      'player_name', COALESCE(v_pick.player_name, 'Unknown'),
      'stat_type', COALESCE(v_pick.stat_type, 'Unknown'),
      'sport', v_pick.sport,
      'line', v_pick.line,
      'corrected_at', v_now,
      'admin_override', v_is_admin_override
    ),
    jsonb_build_object(
      'operator', v_operator,
      'trace_id', v_trace,
      'source', 'correct_settlement_rpc'
    ),
    'SETTLEMENT_CORRECTED:' || v_audit_id::TEXT,
    v_operator,
    v_now,
    v_now
  );

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
    'RECAP_INVALIDATED',
    p_pick_id,
    'unified_picks',
    jsonb_build_object(
      'pick_id', p_pick_id,
      'reason', 'settlement_correction',
      'correction_audit_id', v_audit_id,
      'affected_dates', ARRAY[v_pick.settled_at::DATE, v_now::DATE]
    ),
    jsonb_build_object(
      'operator', v_operator,
      'trace_id', v_trace,
      'source', 'correct_settlement_rpc'
    ),
    'RECAP_INVALIDATED:' || v_audit_id::TEXT,
    v_operator,
    v_now,
    v_now
  );

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'pick_id', p_pick_id,
    'audit_id', v_audit_id,
    'prev_result', v_pick.settlement_result,
    'new_result', p_new_result,
    'prev_version', v_pick.settlement_version,
    'new_version', v_new_version,
    'reason', p_reason,
    'trace_id', v_trace,
    'operator', v_operator,
    'admin_override', v_is_admin_override,
    'events_emitted', ARRAY['SETTLEMENT_CORRECTED', 'RECAP_INVALIDATED']
  );

  -- RESET CONTEXT before successful return
  PERFORM set_config('settlement.rpc_context', 'false', true);
  RETURN v_result;

EXCEPTION WHEN unique_violation THEN
  PERFORM set_config('settlement.rpc_context', 'false', true);
  RETURN jsonb_build_object(
    'success', true,
    'idempotent', true,
    'message', 'Correction already applied (unique constraint)',
    'pick_id', p_pick_id,
    'trace_id', v_trace
  );
WHEN OTHERS THEN
  PERFORM set_config('settlement.rpc_context', 'false', true);
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE,
    'trace_id', v_trace
  );
END;
$$;

COMMENT ON FUNCTION correct_settlement(UUID, TEXT, TEXT, JSONB) IS
  'SPRINT-REM-001: Deploys seal-patched correct_settlement with settlement.rpc_context flag.';

-- ========================================================================
-- 3. Fix settlement_log check constraint to include correction action types
--    The correct_settlement() RPC inserts action_type = 'corrected' which
--    the original constraint does not allow.
-- ========================================================================

ALTER TABLE settlement_log DROP CONSTRAINT IF EXISTS valid_action_type;
ALTER TABLE settlement_log ADD CONSTRAINT valid_action_type
  CHECK (action_type IN ('created', 'updated', 'disputed', 'resolved', 'verified', 'corrected', 'voided'));

-- ========================================================================
-- Complete
-- ========================================================================

COMMENT ON SCHEMA public IS
  'SPRINT-REM-001-SETTLEMENT-RPC-GUARD-FIX applied: Deployed seal-patched settlement RPCs with rpc_context flag.';
