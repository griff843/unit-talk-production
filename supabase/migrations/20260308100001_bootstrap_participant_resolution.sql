-- SPRINT-044F: Add participant_id resolution to upsert_provider_offers_bootstrap
-- Previously the RPC INSERT omitted participant_id, so player prop offers
-- could not be joined to participants downstream.
--
-- Changes:
--   1. Add v_participant_id variable
--   2. Resolve participant from provider_participant_id (external_id → name fallback → auto-create)
--   3. Include participant_id in INSERT
--   4. Match participant_id in UPDATE WHERE clause (via IS NOT DISTINCT FROM)
--
-- Rollback: Re-run the original CREATE OR REPLACE from 20260301201000

CREATE OR REPLACE FUNCTION upsert_provider_offers_bootstrap(
  p_provider_key TEXT,
  p_captured_at TIMESTAMPTZ,
  p_offers JSONB
)
RETURNS TABLE (
  inserted_count INTEGER,
  updated_count INTEGER,
  events_created INTEGER
) AS $$
DECLARE
  v_provider_id INTEGER;
  v_offer JSONB;
  v_event_id UUID;
  v_market_id UUID;
  v_market_type_id INTEGER;
  v_market_type_key TEXT;
  v_participant_id UUID;
  v_provider_participant_id TEXT;
  v_participant_name TEXT;
  v_sport_key TEXT;
  v_inserted INTEGER := 0;
  v_updated INTEGER := 0;
  v_events_before INTEGER;
  v_events_after INTEGER;
BEGIN
  -- Count events before
  SELECT COUNT(*) INTO v_events_before FROM events;

  -- Resolve provider
  SELECT id INTO v_provider_id FROM provider_registry WHERE code = p_provider_key;

  IF v_provider_id IS NULL THEN
    RAISE WARNING 'Provider not found: %', p_provider_key;
    RETURN QUERY SELECT 0::INTEGER, 0::INTEGER, 0::INTEGER;
    RETURN;
  END IF;

  -- Process each offer
  FOR v_offer IN SELECT * FROM jsonb_array_elements(p_offers)
  LOOP
    -- Auto-create event if needed
    v_event_id := auto_create_event_for_ingestion(
      v_provider_id,
      v_offer->>'provider_event_id',
      COALESCE(v_offer->>'sport_key', 'unknown'),
      COALESCE(v_offer->>'home_team', 'Home'),
      COALESCE(v_offer->>'away_team', 'Away'),
      COALESCE((v_offer->>'commence_time')::TIMESTAMPTZ, p_captured_at)
    );

    IF v_event_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Extract market type from provider_market_key (format: "moneyline:TeamName")
    v_market_type_key := SPLIT_PART(COALESCE(v_offer->>'provider_market_key', 'moneyline'), ':', 1);

    -- Resolve market_id (required, NOT NULL)
    v_market_id := resolve_market_id_for_bootstrap(v_market_type_key);

    -- Resolve market_type_id
    SELECT id INTO v_market_type_id
    FROM market_types
    WHERE market_key = v_market_type_key
    LIMIT 1;

    IF v_market_type_id IS NULL THEN
      SELECT id INTO v_market_type_id FROM market_types WHERE market_key = 'moneyline' LIMIT 1;
    END IF;

    -- SPRINT-044F: Resolve participant_id from provider_participant_id
    v_participant_id := NULL;
    v_provider_participant_id := v_offer->>'provider_participant_id';

    IF v_provider_participant_id IS NOT NULL AND v_provider_participant_id <> '' THEN
      v_sport_key := COALESCE(v_offer->>'sport_key', 'unknown');

      -- 1. Try external_id match
      SELECT id INTO v_participant_id
      FROM participants
      WHERE external_id = v_provider_participant_id
      LIMIT 1;

      -- 2. Fallback: name match within same sport
      IF v_participant_id IS NULL THEN
        v_participant_name := v_offer->>'participant_name';
        IF v_participant_name IS NOT NULL AND v_participant_name <> '' THEN
          SELECT id INTO v_participant_id
          FROM participants
          WHERE name = v_participant_name
            AND sport = v_sport_key
            AND type = 'player'
          LIMIT 1;
        END IF;
      END IF;

      -- 3. Auto-create participant if still not found
      IF v_participant_id IS NULL THEN
        v_participant_name := COALESCE(v_offer->>'participant_name', v_provider_participant_id);
        INSERT INTO participants (name, type, sport, external_id, meta)
        VALUES (
          v_participant_name,
          'player',
          v_sport_key,
          v_provider_participant_id,
          jsonb_build_object('auto_created', true, 'source', p_provider_key)
        )
        ON CONFLICT (external_id) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_participant_id;
      END IF;
    END IF;

    -- Insert into provider_offers
    BEGIN
      INSERT INTO provider_offers (
        event_id,
        market_id,
        market_type_id,
        participant_id,
        provider,
        provider_id,
        provider_event_id,
        provider_market_key,
        line,
        over_odds,
        under_odds,
        home_odds,
        away_odds,
        snapshot_at,
        is_opening,
        is_closing,
        mapping_confidence,
        meta
      )
      VALUES (
        v_event_id,
        v_market_id,
        v_market_type_id,
        v_participant_id,
        p_provider_key,
        v_provider_id,
        v_offer->>'provider_event_id',
        v_offer->>'provider_market_key',
        (v_offer->>'line')::NUMERIC,
        (v_offer->>'over_odds')::INTEGER,
        (v_offer->>'under_odds')::INTEGER,
        (v_offer->>'home_odds')::INTEGER,
        (v_offer->>'away_odds')::INTEGER,
        p_captured_at,
        FALSE,
        FALSE,
        1.0,
        COALESCE(v_offer->'meta', '{}'::JSONB)
      );
      v_inserted := v_inserted + 1;
    EXCEPTION
      WHEN unique_violation THEN
        -- Update existing (match participant_id via IS NOT DISTINCT FROM for NULL safety)
        UPDATE provider_offers SET
          market_type_id = v_market_type_id,
          line = (v_offer->>'line')::NUMERIC,
          over_odds = (v_offer->>'over_odds')::INTEGER,
          under_odds = (v_offer->>'under_odds')::INTEGER,
          home_odds = (v_offer->>'home_odds')::INTEGER,
          away_odds = (v_offer->>'away_odds')::INTEGER,
          mapping_confidence = 1.0
        WHERE event_id = v_event_id
          AND market_id = v_market_id
          AND provider = p_provider_key
          AND snapshot_at = p_captured_at
          AND participant_id IS NOT DISTINCT FROM v_participant_id
          AND segment_id IS NULL;
        v_updated := v_updated + 1;
      WHEN OTHERS THEN
        RAISE WARNING 'Error inserting offer: %', SQLERRM;
    END;
  END LOOP;

  -- Count events after
  SELECT COUNT(*) INTO v_events_after FROM events;

  RETURN QUERY SELECT v_inserted, v_updated, (v_events_after - v_events_before)::INTEGER;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION upsert_provider_offers_bootstrap IS
  'Bootstrap ingestion - auto-creates events, markets, and resolves participants. SPRINT-044F enhanced.';
