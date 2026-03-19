-- ============================================================================
-- UTRP-R2: Fix DEFECT-11, DEFECT-12, DEFECT-17 — Submission Contract
-- Date: 2026-03-19
-- Purpose: Repair atomic_submit_ticket RPC so that provider, matchup,
--          home_team, and away_team fields carry through to unified_picks.
--
-- DEFECT-11: Add p_provider parameter, write to provider column.
-- DEFECT-12: Add p_matchup parameter, write to matchup column (with
--            derivation fallback from team names).
-- DEFECT-17: Accept home_team/away_team JSON keys (not just manual_matchup_*),
--            remove source='manual' guard on manual_fields_blob.
--
-- Backward-compatible: all new parameters DEFAULT NULL. Existing callers
-- that use manual_matchup_home/manual_matchup_away still work unchanged.
--
-- Rollback:
--   Re-apply migration 20260319150000 to restore R1 version.
-- ============================================================================

CREATE OR REPLACE FUNCTION atomic_submit_ticket(
  p_bet_slip_id TEXT,
  p_capper_id UUID,
  p_capper_username TEXT,
  p_sport TEXT,
  p_ticket_type TEXT,
  p_game_selections JSONB,
  p_picks JSONB,
  p_parlay_odds INTEGER DEFAULT NULL,
  p_total_units NUMERIC DEFAULT 1.0,
  p_notes TEXT DEFAULT NULL,
  p_provider TEXT DEFAULT NULL,
  p_matchup TEXT DEFAULT NULL
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
  v_manual_game_date DATE;
  v_existing_outbox RECORD;
  v_home TEXT;
  v_away TEXT;
  v_matchup TEXT;
BEGIN
  -- ========================================================================
  -- STEP 1: IDEMPOTENCY CHECK
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
  -- DEFECT-10 (R1): confidence uses NULL-preserving cast
  -- DEFECT-11: provider written from per-pick JSON or top-level p_provider
  -- DEFECT-12: matchup written from per-pick JSON, p_matchup, or derived
  -- DEFECT-17: home_team/away_team accepted unconditionally (not just manual)
  -- ========================================================================
  FOR v_pick IN SELECT * FROM jsonb_array_elements(p_picks)
  LOOP
    v_pick_id := gen_random_uuid();

    BEGIN
      v_manual_game_date := NULLIF(v_pick->>'manual_game_date', '')::DATE;
    EXCEPTION WHEN OTHERS THEN
      v_manual_game_date := NULL;
    END;

    -- DEFECT-17: Accept home_team/away_team OR manual_matchup_home/away
    v_home := COALESCE(
      NULLIF(v_pick->>'home_team', ''),
      NULLIF(v_pick->>'manual_matchup_home', '')
    );
    v_away := COALESCE(
      NULLIF(v_pick->>'away_team', ''),
      NULLIF(v_pick->>'manual_matchup_away', '')
    );

    -- DEFECT-12: Derive matchup from per-pick, top-level param, or team names
    v_matchup := COALESCE(
      NULLIF(v_pick->>'matchup', ''),
      p_matchup,
      CASE
        WHEN v_home IS NOT NULL AND v_away IS NOT NULL
        THEN v_away || ' @ ' || v_home
        ELSE NULL
      END
    );

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
      provider,
      matchup,
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
      (v_pick->>'confidence')::INTEGER,  -- DEFECT-10 (R1): NULL when absent
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
      v_home,    -- DEFECT-17: unconditional, accepts home_team or manual_matchup_home
      v_away,    -- DEFECT-17: unconditional, accepts away_team or manual_matchup_away
      v_manual_game_date,
      -- DEFECT-17: manual_fields_blob built unconditionally (not just source='manual')
      CASE
        WHEN v_home IS NOT NULL OR v_away IS NOT NULL THEN
          jsonb_build_object(
            'entered_at', NOW(),
            'matchup', COALESCE(v_matchup, '')
          )
        ELSE NULL
      END,
      false,  -- posted_to_discord
      'pending',  -- settlement_status
      COALESCE(NULLIF(v_pick->>'provider', ''), p_provider),  -- DEFECT-11
      v_matchup,  -- DEFECT-12
      NOW()
    );

    v_inserted_pick_ids := array_append(v_inserted_pick_ids, v_pick_id);
    v_leg_index := v_leg_index + 1;
  END LOOP;

  -- ========================================================================
  -- STEP 4: ATOMIC INSERT - bridge_outbox (idempotent)
  -- ========================================================================
  SELECT id INTO v_existing_outbox
  FROM bridge_outbox
  WHERE bet_slip_id = p_bet_slip_id AND event_type = 'ticket_submitted';

  IF NOT FOUND THEN
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
    );
  END IF;

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
    RAISE EXCEPTION 'ATOMIC_SUBMIT_FAILED: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;

COMMENT ON FUNCTION atomic_submit_ticket IS
'UTRP-R2 DEFECT-11/12/17: Submission contract fix.
- DEFECT-11: p_provider param, writes to provider column.
- DEFECT-12: p_matchup param, writes to matchup column (with team-name derivation fallback).
- DEFECT-17: Accepts home_team/away_team JSON keys unconditionally (not just manual source).
Supersedes R1 version (20260319150000). Original: SPRINT-E2E-SUBMIT-LIFECYCLE-HARDENING-062.';
