-- ============================================================================
-- CANONICAL V3 SMARTFORM SUBMISSION - Provider-First + Override Model
-- Sprint: SPRINT-CANONICAL-V3-SMARTFORM-075
-- Date: 2026-02-20
--
-- Adds:
-- 1. Provider-first columns to ticket_legs
-- 2. atomic_submit_ticket_v2 RPC for ticket submission
--
-- Prerequisites:
-- - SPRINT-CANONICAL-V3-SCORING-074 (tickets, ticket_legs tables)
-- ============================================================================

-- ============================================================================
-- 1. ADD PROVIDER-FIRST COLUMNS TO TICKET_LEGS
-- ============================================================================

-- Provider value: full snapshot from provider_offers at bet time
ALTER TABLE ticket_legs
  ADD COLUMN IF NOT EXISTS provider_value JSONB;

-- Override value: operator edits (partial or full)
ALTER TABLE ticket_legs
  ADD COLUMN IF NOT EXISTS override_value JSONB;

-- Effective value: computed merge (override wins)
ALTER TABLE ticket_legs
  ADD COLUMN IF NOT EXISTS effective_value JSONB;

-- Effective source: tracks whether override was applied
ALTER TABLE ticket_legs
  ADD COLUMN IF NOT EXISTS effective_source TEXT;

-- Constraint for effective_source values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ticket_legs_effective_source_check'
  ) THEN
    ALTER TABLE ticket_legs
      ADD CONSTRAINT ticket_legs_effective_source_check
      CHECK (effective_source IS NULL OR effective_source IN ('PROVIDER', 'OVERRIDE'));
  END IF;
END $$;

-- Index for querying by effective_source
CREATE INDEX IF NOT EXISTS idx_ticket_legs_effective_source
  ON ticket_legs(effective_source)
  WHERE effective_source IS NOT NULL;

COMMENT ON COLUMN ticket_legs.provider_value IS 'Full snapshot of provider offer data at bet time';
COMMENT ON COLUMN ticket_legs.override_value IS 'Operator overrides (partial JSONB, merged with provider_value)';
COMMENT ON COLUMN ticket_legs.effective_value IS 'Computed effective value: override_value || provider_value';
COMMENT ON COLUMN ticket_legs.effective_source IS 'Source of effective_value: PROVIDER or OVERRIDE';

-- ============================================================================
-- 2. ATOMIC_SUBMIT_TICKET_V2 RPC
-- Single-writer submission with provider-first model and fail-closed validation
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
  -- STEP 2: Validate all legs (set-based)
  -- ========================================
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
  -- STEP 4: Insert legs with provider-first model
  -- ========================================
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
  'Single-writer ticket submission RPC. Provider-first with override model. Idempotent by bet_slip_id. Fail-closed validation. Canonical V3.';

-- ============================================================================
-- END OF MIGRATION
-- Sprint: SPRINT-CANONICAL-V3-SMARTFORM-075
--
-- COLUMNS ADDED:
-- - ticket_legs.provider_value (JSONB)
-- - ticket_legs.override_value (JSONB)
-- - ticket_legs.effective_value (JSONB)
-- - ticket_legs.effective_source (TEXT: PROVIDER|OVERRIDE)
--
-- FUNCTIONS CREATED:
-- - atomic_submit_ticket_v2 (submission RPC)
--
-- IDEMPOTENCY:
-- - bet_slip_id unique on tickets (from 074)
--
-- VALIDATION:
-- - Event exists
-- - Market type exists
-- - Provider offer matches if specified
-- - Participant required per market type
-- - Line required per market type
-- ============================================================================
