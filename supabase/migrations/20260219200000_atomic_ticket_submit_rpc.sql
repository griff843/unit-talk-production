-- ============================================================================
-- SPRINT-E2E-SUBMIT-LIFECYCLE-HARDENING-062: Atomic Ticket Submit RPC
-- Date: 2026-02-19
-- Purpose: Create idempotent, atomic ticket submission function
--
-- Features:
-- 1. Idempotency: Uses bet_slip_id as idempotency key
-- 2. Atomicity: All inserts in single transaction (smart_tickets + unified_picks + bridge_outbox)
-- 3. Fail-closed: Transaction rolls back on any failure
-- 4. Returns existing ticket on duplicate submission (no error, no duplicate)
--
-- Rollback:
--   DROP FUNCTION IF EXISTS atomic_submit_ticket;
-- ============================================================================

-- ========================================================================
-- 1. CREATE ATOMIC SUBMIT FUNCTION
-- ========================================================================

CREATE OR REPLACE FUNCTION atomic_submit_ticket(
  p_bet_slip_id UUID,
  p_capper_id UUID,
  p_capper_username TEXT,
  p_sport TEXT,
  p_ticket_type TEXT,
  p_game_selections JSONB,
  p_picks JSONB,
  p_parlay_odds INTEGER DEFAULT NULL,
  p_total_units NUMERIC DEFAULT 1.0,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_ticket RECORD;
  v_inserted_ticket RECORD;
  v_pick JSONB;
  v_pick_id UUID;
  v_leg_index INTEGER := 0;
  v_inserted_pick_ids UUID[] := '{}';
  v_selection_count INTEGER;
  v_result JSONB;
BEGIN
  -- ========================================================================
  -- STEP 1: IDEMPOTENCY CHECK
  -- Check if bet_slip_id already exists in smart_tickets
  -- ========================================================================
  SELECT
    st.bet_slip_id,
    st.capper_id,
    st.sport,
    st.ticket_type,
    st.selection_count,
    st.total_units,
    st.status,
    st.created_at
  INTO v_existing_ticket
  FROM smart_tickets st
  WHERE st.bet_slip_id = p_bet_slip_id;

  IF FOUND THEN
    -- Return existing ticket (idempotent - no duplicate created)
    RETURN jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'bet_slip_id', v_existing_ticket.bet_slip_id,
      'capper_id', v_existing_ticket.capper_id,
      'sport', v_existing_ticket.sport,
      'ticket_type', v_existing_ticket.ticket_type,
      'selection_count', v_existing_ticket.selection_count,
      'total_units', v_existing_ticket.total_units,
      'status', v_existing_ticket.status,
      'created_at', v_existing_ticket.created_at,
      'message', 'Ticket already submitted (idempotent)'
    );
  END IF;

  -- ========================================================================
  -- STEP 2: ATOMIC INSERT - smart_tickets
  -- ========================================================================
  v_selection_count := jsonb_array_length(p_picks);

  INSERT INTO smart_tickets (
    bet_slip_id,
    capper_id,
    sport,
    ticket_type,
    game_selections,
    parlay_odds,
    total_units,
    status,
    selection_count,
    notes,
    created_at
  ) VALUES (
    p_bet_slip_id,
    p_capper_id,
    p_sport,
    p_ticket_type,
    p_game_selections,
    p_parlay_odds,
    p_total_units,
    'submitted',
    v_selection_count,
    p_notes,
    NOW()
  )
  RETURNING * INTO v_inserted_ticket;

  -- ========================================================================
  -- STEP 3: ATOMIC INSERT - unified_picks (all legs)
  -- ========================================================================
  FOR v_pick IN SELECT * FROM jsonb_array_elements(p_picks)
  LOOP
    v_pick_id := gen_random_uuid();

    INSERT INTO unified_picks (
      id,
      bet_slip_id,
      user_id,
      sport,
      leg_index,
      ticket_type,
      stat_type,
      line,
      odds,
      selection,
      confidence,
      team_id,
      player_id,
      player_name,
      bet_type,
      side,
      source,
      is_live,
      meta,
      manual_matchup_home,
      manual_matchup_away,
      manual_game_date,
      manual_fields_blob,
      posted_to_discord,
      settlement_status,
      created_at
    ) VALUES (
      v_pick_id,
      p_bet_slip_id,
      p_capper_id,
      p_sport,
      v_leg_index,
      p_ticket_type,
      (v_pick->>'stat_type')::TEXT,
      (v_pick->>'line')::NUMERIC,
      (v_pick->>'odds')::INTEGER,
      (v_pick->>'selection')::TEXT,
      COALESCE((v_pick->>'confidence')::INTEGER, 0),
      NULLIF(v_pick->>'team_id', '')::UUID,
      NULLIF(v_pick->>'player_id', '')::UUID,
      NULLIF(v_pick->>'player_name', '')::TEXT,
      COALESCE(v_pick->>'bet_type', 'moneyline')::TEXT,
      NULLIF(v_pick->>'side', '')::TEXT,
      COALESCE(v_pick->>'source', 'api')::TEXT,
      COALESCE((v_pick->>'is_live')::BOOLEAN, false),
      jsonb_build_object(
        'pick_origin', 'capper',
        'capper', p_capper_username,
        'submitted_via', 'atomic_rpc',
        'lifecycle_stage', 'submitted'
      ),
      NULLIF(v_pick->>'manual_matchup_home', '')::TEXT,
      NULLIF(v_pick->>'manual_matchup_away', '')::TEXT,
      NULLIF(v_pick->>'manual_game_date', '')::TEXT,
      CASE
        WHEN (v_pick->>'source') = 'manual' THEN
          jsonb_build_object(
            'entered_at', NOW(),
            'matchup', COALESCE(v_pick->>'manual_matchup_away', '') || ' @ ' || COALESCE(v_pick->>'manual_matchup_home', '')
          )
        ELSE NULL
      END,
      false,  -- posted_to_discord
      'pending',  -- settlement_status
      NOW()
    );

    v_inserted_pick_ids := array_append(v_inserted_pick_ids, v_pick_id);
    v_leg_index := v_leg_index + 1;
  END LOOP;

  -- ========================================================================
  -- STEP 4: ATOMIC INSERT - bridge_outbox
  -- Part of the atomic transaction to ensure exactly-once event publishing
  -- ========================================================================
  INSERT INTO bridge_outbox (
    id,
    event_type,
    event_data,
    bet_slip_id,
    status,
    retry_count,
    created_at
  ) VALUES (
    gen_random_uuid(),
    'ticket_submitted',
    jsonb_build_object(
      'bet_slip_id', p_bet_slip_id,
      'capper_id', p_capper_id,
      'capper_username', p_capper_username,
      'sport', p_sport,
      'ticket_type', p_ticket_type,
      'selection_count', v_selection_count,
      'submitted_via', 'atomic_rpc',
      'submitted_at', NOW()
    ),
    p_bet_slip_id,
    'pending',
    0,
    NOW()
  )
  ON CONFLICT (bet_slip_id) WHERE event_type = 'ticket_submitted'
  DO NOTHING;  -- Idempotent: skip if already exists

  -- ========================================================================
  -- STEP 5: BUILD RESULT
  -- ========================================================================
  v_result := jsonb_build_object(
    'success', true,
    'is_duplicate', false,
    'bet_slip_id', p_bet_slip_id,
    'capper_id', p_capper_id,
    'sport', p_sport,
    'ticket_type', p_ticket_type,
    'selection_count', v_selection_count,
    'total_units', p_total_units,
    'status', 'submitted',
    'pick_ids', to_jsonb(v_inserted_pick_ids),
    'created_at', NOW(),
    'message', 'Ticket submitted successfully'
  );

  RETURN v_result;

EXCEPTION
  WHEN unique_violation THEN
    -- Handle race condition where duplicate was inserted between check and insert
    SELECT
      st.bet_slip_id,
      st.capper_id,
      st.sport,
      st.ticket_type,
      st.selection_count,
      st.total_units,
      st.status,
      st.created_at
    INTO v_existing_ticket
    FROM smart_tickets st
    WHERE st.bet_slip_id = p_bet_slip_id;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', true,
        'bet_slip_id', v_existing_ticket.bet_slip_id,
        'capper_id', v_existing_ticket.capper_id,
        'sport', v_existing_ticket.sport,
        'ticket_type', v_existing_ticket.ticket_type,
        'selection_count', v_existing_ticket.selection_count,
        'total_units', v_existing_ticket.total_units,
        'status', v_existing_ticket.status,
        'created_at', v_existing_ticket.created_at,
        'message', 'Ticket already submitted (race condition handled)'
      );
    ELSE
      RAISE;
    END IF;
  WHEN OTHERS THEN
    -- Transaction automatically rolls back
    RAISE EXCEPTION 'ATOMIC_SUBMIT_FAILED: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;

-- ========================================================================
-- 2. ADD UNIQUE CONSTRAINT FOR BRIDGE_OUTBOX IDEMPOTENCY
-- Ensures only one ticket_submitted event per bet_slip_id
-- ========================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_bridge_outbox_betslip_event_unique
ON bridge_outbox (bet_slip_id, event_type)
WHERE event_type = 'ticket_submitted';

-- ========================================================================
-- 3. ADD UNIQUE CONSTRAINT FOR SMART_TICKETS
-- Ensures bet_slip_id is unique in smart_tickets
-- ========================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_smart_tickets_bet_slip_id_unique
ON smart_tickets (bet_slip_id);

-- ========================================================================
-- 4. COMMENTS
-- ========================================================================

COMMENT ON FUNCTION atomic_submit_ticket IS
'SPRINT-E2E-SUBMIT-LIFECYCLE-HARDENING-062: Atomic, idempotent ticket submission.
- Uses bet_slip_id as idempotency key
- All writes (smart_tickets, unified_picks, bridge_outbox) in single transaction
- Returns existing ticket on duplicate (no error, no duplicate)
- Includes bridge_outbox event for exactly-once downstream processing';

-- ========================================================================
-- Complete
-- ========================================================================

COMMENT ON SCHEMA public IS
'SPRINT-E2E-SUBMIT-LIFECYCLE-HARDENING-062: Atomic ticket submission RPC added';
