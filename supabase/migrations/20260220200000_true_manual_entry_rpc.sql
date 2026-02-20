-- ============================================================================
-- TRUE MANUAL ENTRY RPC ENHANCEMENT
-- Sprint: SPRINT-SMARTFORM-TRUE-MANUAL-ENTRY-084
-- Date: 2026-02-20
--
-- Modifies atomic_submit_ticket_v2 to support TRUE manual entry:
-- - entry_mode = 'manual' bypasses event/market validation
-- - event_id, market_type_id, participant_id can be NULL for manual
-- - All manual data stored in provider_value JSONB
-- - NO sentinel events or fake canonical data
--
-- Prerequisites:
-- - SPRINT-CANONICAL-V3-SMARTFORM-075 (atomic_submit_ticket_v2 base)
-- ============================================================================

-- ============================================================================
-- 1. ENHANCED ATOMIC_SUBMIT_TICKET_V2 WITH MANUAL ENTRY SUPPORT
-- ============================================================================

CREATE OR REPLACE FUNCTION atomic_submit_ticket_v2(
  p_bet_slip_id TEXT,
  p_user_id UUID,
  p_ticket_type TEXT,
  p_total_stake NUMERIC,
  p_legs JSONB[],
  p_source TEXT DEFAULT 'smart_form',
  p_meta JSONB DEFAULT '{}'
)
RETURNS TABLE (
  out_ticket_id UUID,
  out_leg_ids UUID[],
  out_status TEXT,
  out_error_details JSONB
) AS $$
DECLARE
  v_ticket_id UUID;
  v_existing_ticket_id UUID;
  v_leg_ids UUID[];
  v_errors JSONB := '[]'::JSONB;
  v_has_errors BOOLEAN := FALSE;
  v_entry_mode TEXT;
BEGIN
  -- ========================================
  -- STEP 0: Input validation
  -- ========================================
  IF p_bet_slip_id IS NULL OR p_bet_slip_id = '' THEN
    RETURN QUERY SELECT
      NULL::UUID,
      NULL::UUID[],
      'error'::TEXT,
      '[{"field": "bet_slip_id", "error": "bet_slip_id is required"}]'::JSONB;
    RETURN;
  END IF;

  IF p_user_id IS NULL THEN
    RETURN QUERY SELECT
      NULL::UUID,
      NULL::UUID[],
      'error'::TEXT,
      '[{"field": "user_id", "error": "user_id is required"}]'::JSONB;
    RETURN;
  END IF;

  IF p_legs IS NULL OR array_length(p_legs, 1) IS NULL OR array_length(p_legs, 1) = 0 THEN
    RETURN QUERY SELECT
      NULL::UUID,
      NULL::UUID[],
      'error'::TEXT,
      '[{"field": "legs", "error": "at least one leg is required"}]'::JSONB;
    RETURN;
  END IF;

  -- Determine entry mode from meta
  v_entry_mode := COALESCE(p_meta->>'entry_mode', 'catalog');

  -- ========================================
  -- STEP 1: Check idempotency (existing ticket)
  -- ========================================
  SELECT t.id INTO v_existing_ticket_id
  FROM tickets t
  WHERE t.bet_slip_id = p_bet_slip_id;

  IF v_existing_ticket_id IS NOT NULL THEN
    -- Return existing ticket
    SELECT array_agg(tl.id ORDER BY tl.leg_index)
    INTO v_leg_ids
    FROM ticket_legs tl
    WHERE tl.ticket_id = v_existing_ticket_id;

    RETURN QUERY SELECT
      v_existing_ticket_id,
      v_leg_ids,
      'exists'::TEXT,
      NULL::JSONB;
    RETURN;
  END IF;

  -- ========================================
  -- STEP 2: Validate legs based on entry_mode
  -- ========================================
  IF v_entry_mode = 'manual' THEN
    -- MANUAL MODE: Validate manual-specific fields
    -- Required: sport, bet_type, selection, provider, odds
    WITH leg_data AS (
      SELECT
        (row_number() OVER () - 1)::INTEGER AS leg_index,
        leg
      FROM unnest(p_legs) AS leg
    ),
    validation AS (
      SELECT
        ld.leg_index,
        ld.leg,
        -- Sport required
        CASE WHEN (ld.leg->>'sport') IS NULL OR (ld.leg->>'sport') = '' THEN 'sport is required' END AS sport_error,
        -- Bet type required
        CASE WHEN (ld.leg->>'bet_type') IS NULL OR (ld.leg->>'bet_type') = '' THEN 'bet_type is required' END AS bet_type_error,
        -- Matchup required (home_team + away_team or matchup_text)
        CASE
          WHEN ((ld.leg->>'home_team') IS NULL OR (ld.leg->>'home_team') = '')
           AND ((ld.leg->>'matchup_text') IS NULL OR (ld.leg->>'matchup_text') = '')
          THEN 'matchup (home_team/away_team or matchup_text) is required'
        END AS matchup_error,
        -- Selection required
        CASE WHEN (ld.leg->>'selection') IS NULL OR (ld.leg->>'selection') = '' THEN 'selection is required' END AS selection_error,
        -- Provider required
        CASE WHEN (ld.leg->>'provider') IS NULL OR (ld.leg->>'provider') = '' THEN 'provider is required' END AS provider_error,
        -- Odds required
        CASE WHEN (ld.leg->>'odds') IS NULL THEN 'odds is required' END AS odds_error,
        -- Line required for spread/total/player_prop
        CASE
          WHEN (ld.leg->>'bet_type') IN ('spread', 'total', 'team_total', 'player_prop', 'puck_line', 'run_line')
           AND (ld.leg->>'line') IS NULL
          THEN 'line is required for this bet type'
        END AS line_error,
        -- Player name required for player_prop
        CASE
          WHEN (ld.leg->>'bet_type') = 'player_prop'
           AND ((ld.leg->>'player_name') IS NULL OR (ld.leg->>'player_name') = '')
          THEN 'player_name is required for player props'
        END AS player_error
      FROM leg_data ld
    )
    SELECT jsonb_agg(
      jsonb_build_object(
        'leg_index', v.leg_index,
        'errors', array_remove(ARRAY[
          v.sport_error,
          v.bet_type_error,
          v.matchup_error,
          v.selection_error,
          v.provider_error,
          v.odds_error,
          v.line_error,
          v.player_error
        ], NULL)
      )
    )
    INTO v_errors
    FROM validation v
    WHERE v.sport_error IS NOT NULL
       OR v.bet_type_error IS NOT NULL
       OR v.matchup_error IS NOT NULL
       OR v.selection_error IS NOT NULL
       OR v.provider_error IS NOT NULL
       OR v.odds_error IS NOT NULL
       OR v.line_error IS NOT NULL
       OR v.player_error IS NOT NULL;

  ELSE
    -- CATALOG MODE: Validate against canonical tables (existing behavior)
    WITH leg_data AS (
      SELECT
        (row_number() OVER () - 1)::INTEGER AS leg_index,
        leg
      FROM unnest(p_legs) AS leg
    ),
    validation AS (
      SELECT
        ld.leg_index,
        ld.leg,
        -- Event validation
        ce.id AS valid_event_id,
        CASE WHEN ce.id IS NULL THEN 'event_id not found' END AS event_error,
        -- Market type validation
        mt.id AS valid_market_type_id,
        mt.requires_line,
        mt.requires_participant,
        mt.outcome_type_id,
        CASE WHEN mt.id IS NULL THEN 'market_type_id not found' END AS market_error,
        -- Provider offer validation (if provider_offer_id present)
        po.id AS valid_offer_id,
        po.event_id AS offer_event_id,
        po.market_type_id AS offer_market_type_id,
        po.participant_id AS offer_participant_id,
        po.provider AS offer_provider,
        po.line AS offer_line,
        CASE
          WHEN (ld.leg->>'provider_offer_id') IS NOT NULL AND po.id IS NULL THEN 'provider_offer_id not found'
          WHEN (ld.leg->>'provider_offer_id') IS NOT NULL AND po.event_id != (ld.leg->>'event_id')::UUID THEN 'offer event_id mismatch'
          WHEN (ld.leg->>'provider_offer_id') IS NOT NULL AND po.market_type_id != (ld.leg->>'market_type_id')::INTEGER THEN 'offer market_type_id mismatch'
        END AS offer_error,
        -- Participant validation
        p.id AS valid_participant_id,
        CASE
          WHEN mt.requires_participant AND (ld.leg->>'participant_id') IS NULL THEN 'participant_id required for this market type'
          WHEN (ld.leg->>'participant_id') IS NOT NULL AND p.id IS NULL THEN 'participant_id not found'
        END AS participant_error,
        -- Line validation for manual legs
        CASE
          WHEN (ld.leg->>'provider_offer_id') IS NULL
            AND mt.requires_line
            AND (ld.leg->>'line') IS NULL THEN 'line required for this market type'
        END AS line_error,
        -- Provider/odds validation for manual legs
        CASE
          WHEN (ld.leg->>'provider_offer_id') IS NULL
            AND (ld.leg->>'provider') IS NULL THEN 'provider required for manual leg'
        END AS provider_error,
        CASE
          WHEN (ld.leg->>'provider_offer_id') IS NULL
            AND (ld.leg->>'odds') IS NULL THEN 'odds required for manual leg'
        END AS odds_error,
        -- Selection validation
        CASE
          WHEN (ld.leg->>'selection') IS NULL THEN 'selection is required'
          WHEN (ld.leg->>'selection') NOT IN ('over', 'under', 'home', 'away', 'yes', 'no', 'draw') THEN 'invalid selection value'
        END AS selection_error
      FROM leg_data ld
      LEFT JOIN canonical_events ce ON ce.id = (ld.leg->>'event_id')::UUID
      LEFT JOIN market_types mt ON mt.id = (ld.leg->>'market_type_id')::INTEGER
      LEFT JOIN provider_offers po ON po.id = (ld.leg->>'provider_offer_id')::UUID
      LEFT JOIN participants p ON p.id = (ld.leg->>'participant_id')::UUID
    )
    SELECT jsonb_agg(
      jsonb_build_object(
        'leg_index', v.leg_index,
        'errors', array_remove(ARRAY[
          v.event_error,
          v.market_error,
          v.offer_error,
          v.participant_error,
          v.line_error,
          v.provider_error,
          v.odds_error,
          v.selection_error
        ], NULL)
      )
    )
    INTO v_errors
    FROM validation v
    WHERE v.event_error IS NOT NULL
       OR v.market_error IS NOT NULL
       OR v.offer_error IS NOT NULL
       OR v.participant_error IS NOT NULL
       OR v.line_error IS NOT NULL
       OR v.provider_error IS NOT NULL
       OR v.odds_error IS NOT NULL
       OR v.selection_error IS NOT NULL;
  END IF;

  IF v_errors IS NOT NULL AND jsonb_array_length(v_errors) > 0 THEN
    RETURN QUERY SELECT
      NULL::UUID,
      NULL::UUID[],
      'error'::TEXT,
      v_errors;
    RETURN;
  END IF;

  -- ========================================
  -- STEP 3: Create ticket
  -- ========================================
  INSERT INTO tickets (
    user_id,
    ticket_type,
    bet_slip_id,
    total_stake,
    source,
    meta,
    status,
    workflow_stage
  ) VALUES (
    p_user_id,
    p_ticket_type,
    p_bet_slip_id,
    p_total_stake,
    p_source,
    p_meta,
    'pending',
    'submitted'
  )
  RETURNING id INTO v_ticket_id;

  -- ========================================
  -- STEP 4: Insert legs
  -- ========================================
  IF v_entry_mode = 'manual' THEN
    -- MANUAL MODE: Build provider_value from manual fields
    WITH leg_data AS (
      SELECT
        (row_number() OVER () - 1)::INTEGER AS leg_index,
        leg
      FROM unnest(p_legs) AS leg
    ),
    inserted_legs AS (
      INSERT INTO ticket_legs (
        ticket_id,
        leg_index,
        event_id,
        market_type_id,
        participant_id,
        segment_type_id,
        selection,
        offer_id,
        provider,
        provider_line,
        provider_odds,
        provider_value,
        override_value,
        effective_value,
        effective_source,
        leg_status
      )
      SELECT
        v_ticket_id,
        ld.leg_index,
        -- event_id is NULL for manual entry
        NULL,
        -- market_type_id is NULL for manual entry
        NULL,
        -- participant_id is NULL for manual entry
        NULL,
        -- segment_type_id is NULL for manual entry
        NULL,
        ld.leg->>'selection',
        -- offer_id is NULL for manual entry
        NULL,
        ld.leg->>'provider',
        (ld.leg->>'line')::NUMERIC,
        (ld.leg->>'odds')::INTEGER,
        -- provider_value stores ALL manual entry data
        jsonb_build_object(
          'sport', ld.leg->>'sport',
          'bet_type', ld.leg->>'bet_type',
          'home_team', ld.leg->>'home_team',
          'away_team', ld.leg->>'away_team',
          'matchup_text', COALESCE(
            ld.leg->>'matchup_text',
            (ld.leg->>'away_team') || ' @ ' || (ld.leg->>'home_team')
          ),
          'player_name', ld.leg->>'player_name',
          'prop_type', ld.leg->>'prop_type',
          'line', (ld.leg->>'line')::NUMERIC,
          'odds', (ld.leg->>'odds')::INTEGER,
          'selection', ld.leg->>'selection',
          'provider', ld.leg->>'provider',
          'entry_mode', 'manual'
        ),
        NULL,
        -- effective_value mirrors provider_value for manual
        jsonb_build_object(
          'sport', ld.leg->>'sport',
          'bet_type', ld.leg->>'bet_type',
          'home_team', ld.leg->>'home_team',
          'away_team', ld.leg->>'away_team',
          'matchup_text', COALESCE(
            ld.leg->>'matchup_text',
            (ld.leg->>'away_team') || ' @ ' || (ld.leg->>'home_team')
          ),
          'player_name', ld.leg->>'player_name',
          'prop_type', ld.leg->>'prop_type',
          'line', (ld.leg->>'line')::NUMERIC,
          'odds', (ld.leg->>'odds')::INTEGER,
          'selection', ld.leg->>'selection',
          'provider', ld.leg->>'provider',
          'entry_mode', 'manual'
        ),
        'PROVIDER',
        'pending'
      FROM leg_data ld
      ORDER BY ld.leg_index
      RETURNING id
    )
    SELECT array_agg(id ORDER BY id) INTO v_leg_ids FROM inserted_legs;

  ELSE
    -- CATALOG MODE: Original provider-first flow
    WITH leg_data AS (
      SELECT
        (row_number() OVER () - 1)::INTEGER AS leg_index,
        leg
      FROM unnest(p_legs) AS leg
    ),
    enriched_legs AS (
      SELECT
        ld.leg_index,
        ld.leg,
        -- Provider offer data (if using offer)
        po.id AS offer_id,
        po.provider AS offer_provider,
        po.line AS offer_line,
        po.participant_id AS offer_participant_id,
        -- Build provider_value JSONB
        CASE
          WHEN po.id IS NOT NULL THEN
            jsonb_build_object(
              'line', po.line,
              'odds', COALESCE(
                CASE (ld.leg->>'selection')
                  WHEN 'over' THEN po.over_odds
                  WHEN 'under' THEN po.under_odds
                  WHEN 'home' THEN po.home_odds
                  WHEN 'away' THEN po.away_odds
                  WHEN 'yes' THEN po.yes_odds
                  WHEN 'no' THEN po.no_odds
                END,
                (ld.leg->>'odds')::INTEGER
              ),
              'selection', ld.leg->>'selection',
              'provider', po.provider,
              'snapshot_at', po.snapshot_at
            )
          ELSE
            jsonb_build_object(
              'line', (ld.leg->>'line')::NUMERIC,
              'odds', (ld.leg->>'odds')::INTEGER,
              'selection', ld.leg->>'selection',
              'provider', ld.leg->>'provider'
            )
        END AS provider_value,
        -- Override value (from leg.override)
        NULLIF(ld.leg->'override', '{}'::JSONB) AS override_value
      FROM leg_data ld
      LEFT JOIN provider_offers po ON po.id = (ld.leg->>'provider_offer_id')::UUID
    ),
    inserted_legs AS (
      INSERT INTO ticket_legs (
        ticket_id,
        leg_index,
        event_id,
        market_type_id,
        participant_id,
        segment_type_id,
        selection,
        offer_id,
        provider,
        provider_line,
        provider_odds,
        provider_value,
        override_value,
        effective_value,
        effective_source,
        leg_status
      )
      SELECT
        v_ticket_id,
        el.leg_index,
        (el.leg->>'event_id')::UUID,
        (el.leg->>'market_type_id')::INTEGER,
        COALESCE(
          (el.leg->>'participant_id')::UUID,
          el.offer_participant_id
        ),
        (el.leg->>'segment_type_id')::INTEGER,
        el.leg->>'selection',
        el.offer_id,
        COALESCE(el.offer_provider, el.leg->>'provider'),
        (el.provider_value->>'line')::NUMERIC,
        (el.provider_value->>'odds')::INTEGER,
        el.provider_value,
        el.override_value,
        -- Compute effective_value: override wins via JSONB merge
        CASE
          WHEN el.override_value IS NOT NULL AND el.override_value != '{}'::JSONB
          THEN el.provider_value || el.override_value
          ELSE el.provider_value
        END,
        -- Set effective_source
        CASE
          WHEN el.override_value IS NOT NULL AND el.override_value != '{}'::JSONB
          THEN 'OVERRIDE'
          ELSE 'PROVIDER'
        END,
        'pending'
      FROM enriched_legs el
      ORDER BY el.leg_index
      RETURNING id
    )
    SELECT array_agg(id ORDER BY id) INTO v_leg_ids FROM inserted_legs;
  END IF;

  -- ========================================
  -- STEP 5: Return success
  -- ========================================
  RETURN QUERY SELECT
    v_ticket_id,
    v_leg_ids,
    'inserted'::TEXT,
    NULL::JSONB;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION atomic_submit_ticket_v2 IS
  'Single-writer ticket submission RPC. Supports catalog mode (FK validation) and manual mode (no FK, all data in provider_value). Idempotent by bet_slip_id. Sprint 084.';

-- ============================================================================
-- END OF MIGRATION
-- Sprint: SPRINT-SMARTFORM-TRUE-MANUAL-ENTRY-084
--
-- CHANGES:
-- - Enhanced atomic_submit_ticket_v2 to support entry_mode in meta:
--   - 'catalog' (default): Original behavior with FK validation
--   - 'manual': Bypasses FK validation, stores all data in provider_value
--
-- MANUAL MODE VALIDATION:
-- - sport: required
-- - bet_type: required
-- - matchup (home_team/away_team or matchup_text): required
-- - selection: required
-- - provider: required
-- - odds: required
-- - line: required for spread/total/player_prop bet types
-- - player_name: required for player_prop
--
-- NO SENTINEL EVENTS CREATED - true manual entry with NULL FKs
-- ============================================================================
