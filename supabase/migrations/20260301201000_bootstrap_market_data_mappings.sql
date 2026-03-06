-- Migration: Bootstrap market data mappings for ingestion
-- Sprint: MARKET-DATA-INGESTION-WIREUP-002
-- Rollback: DELETE FROM provider_market_map; DELETE FROM provider_event_map; DELETE FROM markets WHERE canonical_key IN ('game_moneyline', 'game_spread', 'game_total');

-- ============================================================================
-- SEED BASE MARKETS
-- These are market definitions used by provider_offers
-- ============================================================================

INSERT INTO markets (canonical_key, display_name, category, bet_structure)
VALUES
  ('game_moneyline', 'Game Moneyline', 'game_line', 'moneyline'),
  ('game_spread', 'Game Point Spread', 'game_line', 'spread'),
  ('game_total', 'Game Total Points', 'game_line', 'over_under')
ON CONFLICT (canonical_key) DO NOTHING;

-- NOTE: market_types seeding removed — canonical V3 seed (20260220110000)
-- already creates market_types with proper schema (no category/bet_structure columns).
-- The DO $$ block below gracefully handles NULL market_type_id lookups.

-- ============================================================================
-- SEED PROVIDER MARKET MAPPINGS
-- Maps OddsAPI market keys to canonical market_types
-- ============================================================================

DO $$
DECLARE
  v_provider_id INTEGER;
  v_market_type_id INTEGER;
  v_provider_codes TEXT[] := ARRAY['fanduel', 'draftkings', 'betmgm', 'caesars', 'pointsbet', 'betrivers', 'espnbet', 'pinnacle'];
  v_market_mappings JSONB := '[
    {"provider_key": "moneyline:*", "canonical_key": "moneyline"},
    {"provider_key": "spread:*", "canonical_key": "spread"},
    {"provider_key": "total:*", "canonical_key": "total"},
    {"provider_key": "h2h:*", "canonical_key": "moneyline"},
    {"provider_key": "spreads:*", "canonical_key": "spread"},
    {"provider_key": "totals:*", "canonical_key": "total"}
  ]';
  v_provider TEXT;
  v_mapping JSONB;
BEGIN
  FOREACH v_provider IN ARRAY v_provider_codes
  LOOP
    SELECT id INTO v_provider_id FROM provider_registry WHERE code = v_provider;

    IF v_provider_id IS NOT NULL THEN
      FOR v_mapping IN SELECT * FROM jsonb_array_elements(v_market_mappings)
      LOOP
        SELECT id INTO v_market_type_id
        FROM market_types
        WHERE market_key = v_mapping->>'canonical_key';

        IF v_market_type_id IS NOT NULL THEN
          INSERT INTO provider_market_map (
            provider_id,
            provider_market_key,
            canonical_market_type_id,
            confidence_score,
            mapping_version
          )
          VALUES (
            v_provider_id,
            v_mapping->>'provider_key',
            v_market_type_id,
            1.0,
            1
          )
          ON CONFLICT (provider_id, provider_market_key, mapping_version) DO NOTHING;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- HELPER: auto_create_event_for_ingestion
-- Creates event and mapping on first encounter
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_create_event_for_ingestion(
  p_provider_id INTEGER,
  p_provider_event_id TEXT,
  p_sport_key TEXT,
  p_home_team TEXT,
  p_away_team TEXT,
  p_commence_time TIMESTAMPTZ
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_sport TEXT;
  v_league TEXT;
BEGIN
  -- Check if mapping already exists
  SELECT canonical_event_id INTO v_event_id
  FROM provider_event_map
  WHERE provider_id = p_provider_id
    AND provider_event_id = p_provider_event_id
    AND (valid_to IS NULL OR valid_to > NOW())
  ORDER BY mapping_version DESC
  LIMIT 1;

  IF v_event_id IS NOT NULL THEN
    RETURN v_event_id;
  END IF;

  -- Check if event exists by external_id
  SELECT id INTO v_event_id
  FROM events
  WHERE external_id = p_provider_event_id
  LIMIT 1;

  IF v_event_id IS NOT NULL THEN
    INSERT INTO provider_event_map (
      provider_id,
      provider_event_id,
      canonical_event_id,
      confidence_score,
      mapping_version,
      source
    )
    VALUES (
      p_provider_id,
      p_provider_event_id,
      v_event_id,
      1.0,
      1,
      'auto_ingestion'
    )
    ON CONFLICT (provider_id, provider_event_id, mapping_version) DO NOTHING;

    RETURN v_event_id;
  END IF;

  -- Map sport key to sport/league
  v_sport := CASE
    WHEN p_sport_key LIKE '%nba%' THEN 'basketball'
    WHEN p_sport_key LIKE '%nfl%' THEN 'football'
    WHEN p_sport_key LIKE '%mlb%' THEN 'baseball'
    WHEN p_sport_key LIKE '%nhl%' THEN 'hockey'
    WHEN p_sport_key LIKE '%ncaaf%' THEN 'football'
    WHEN p_sport_key LIKE '%ncaab%' THEN 'basketball'
    ELSE 'other'
  END;

  v_league := CASE
    WHEN p_sport_key LIKE '%nba%' THEN 'NBA'
    WHEN p_sport_key LIKE '%nfl%' THEN 'NFL'
    WHEN p_sport_key LIKE '%mlb%' THEN 'MLB'
    WHEN p_sport_key LIKE '%nhl%' THEN 'NHL'
    WHEN p_sport_key LIKE '%ncaaf%' THEN 'NCAAF'
    WHEN p_sport_key LIKE '%ncaab%' THEN 'NCAAB'
    ELSE p_sport_key
  END;

  INSERT INTO events (
    external_id,
    sport,
    league,
    event_type,
    scheduled_at,
    status,
    meta
  )
  VALUES (
    p_provider_event_id,
    v_sport,
    v_league,
    'game',
    p_commence_time,
    'scheduled',
    jsonb_build_object(
      'provider_sport_key', p_sport_key,
      'home_team', p_home_team,
      'away_team', p_away_team
    )
  )
  RETURNING id INTO v_event_id;

  INSERT INTO provider_event_map (
    provider_id,
    provider_event_id,
    canonical_event_id,
    confidence_score,
    mapping_version,
    source
  )
  VALUES (
    p_provider_id,
    p_provider_event_id,
    v_event_id,
    1.0,
    1,
    'auto_ingestion'
  );

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_create_event_for_ingestion IS
  'Auto-creates event and mapping on first encounter. Bootstrap helper.';

-- ============================================================================
-- HELPER: resolve_market_id_for_bootstrap
-- Gets or creates a market_id for the given market type
-- ============================================================================

CREATE OR REPLACE FUNCTION resolve_market_id_for_bootstrap(
  p_market_type_key TEXT
)
RETURNS UUID AS $$
DECLARE
  v_market_id UUID;
  v_canonical_key TEXT;
BEGIN
  -- Map market type to canonical market key
  v_canonical_key := CASE p_market_type_key
    WHEN 'moneyline' THEN 'game_moneyline'
    WHEN 'spread' THEN 'game_spread'
    WHEN 'total' THEN 'game_total'
    ELSE 'game_' || p_market_type_key
  END;

  -- Get existing market
  SELECT id INTO v_market_id
  FROM markets
  WHERE canonical_key = v_canonical_key
  LIMIT 1;

  -- Create if not exists
  IF v_market_id IS NULL THEN
    INSERT INTO markets (canonical_key, display_name, category, bet_structure)
    VALUES (
      v_canonical_key,
      INITCAP(REPLACE(v_canonical_key, '_', ' ')),
      'game_line',
      CASE p_market_type_key
        WHEN 'moneyline' THEN 'moneyline'
        WHEN 'spread' THEN 'spread'
        WHEN 'total' THEN 'over_under'
        ELSE 'moneyline'
      END
    )
    ON CONFLICT (canonical_key) DO NOTHING
    RETURNING id INTO v_market_id;

    -- If conflict happened, select again
    IF v_market_id IS NULL THEN
      SELECT id INTO v_market_id FROM markets WHERE canonical_key = v_canonical_key;
    END IF;
  END IF;

  RETURN v_market_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION resolve_market_id_for_bootstrap IS
  'Gets or creates market_id for bootstrap ingestion.';

-- ============================================================================
-- BOOTSTRAP INGESTION FUNCTION
-- Simplified ingestion that auto-creates events and uses proper market_id
-- ============================================================================

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

    -- Insert into provider_offers
    BEGIN
      INSERT INTO provider_offers (
        event_id,
        market_id,
        market_type_id,
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
        -- Update existing
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
          AND participant_id IS NULL
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
  'Bootstrap ingestion - auto-creates events and markets. Use for initial data seeding.';

-- ============================================================================
-- VERIFY SEEDING
-- ============================================================================

DO $$
DECLARE
  v_market_count INTEGER;
  v_market_map_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_market_count FROM markets;
  SELECT COUNT(*) INTO v_market_map_count FROM provider_market_map;
  RAISE NOTICE 'markets: %, provider_market_map: %', v_market_count, v_market_map_count;
END $$;
