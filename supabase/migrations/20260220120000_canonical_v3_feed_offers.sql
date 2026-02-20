-- ============================================================================
-- CANONICAL V3 FEED OFFERS - Provider Offers Ingestion Layer
-- Sprint: SPRINT-CANONICAL-V3-FEED-OFFERS-073
-- Date: 2026-02-20
--
-- Wires provider_offers ingestion to the Canonical V3 catalog with:
-- 1. Multi-book support via provider_registry normalization
-- 2. Fail-closed mapping (quarantine unmapped offers)
-- 3. Single-writer upsert RPC
-- 4. Contract views for current offers and best price comparison
--
-- Prerequisites:
-- - SPRINT-CANONICAL-V3-FOUNDATION-071 (provider_offers base table)
-- - SPRINT-CANONICAL-V3-CATALOG-072 (catalog + mapping tables)
-- ============================================================================

-- ============================================================================
-- 1. SCHEMA ENHANCEMENTS FOR provider_offers
-- Add canonical IDs and raw provider identifiers for audit trail
-- ============================================================================

-- Note: provider_offers references canonical_events table (not the event-sourcing 'events' table)

-- Add provider_id (FK to provider_registry) - nullable during migration
ALTER TABLE provider_offers
  ADD COLUMN IF NOT EXISTS provider_id INTEGER REFERENCES provider_registry(id);

-- Add market_type_id (FK to market_types) for normalized market reference
ALTER TABLE provider_offers
  ADD COLUMN IF NOT EXISTS market_type_id INTEGER REFERENCES market_types(id);

-- Add segment_type_id for segment-specific offers
ALTER TABLE provider_offers
  ADD COLUMN IF NOT EXISTS segment_type_id INTEGER REFERENCES segment_types(id);

-- Add raw provider identifiers for audit/debugging
ALTER TABLE provider_offers
  ADD COLUMN IF NOT EXISTS provider_event_id TEXT;

ALTER TABLE provider_offers
  ADD COLUMN IF NOT EXISTS provider_market_key TEXT;

ALTER TABLE provider_offers
  ADD COLUMN IF NOT EXISTS provider_participant_id TEXT;

-- Add confidence threshold used for mapping validation
ALTER TABLE provider_offers
  ADD COLUMN IF NOT EXISTS mapping_confidence NUMERIC(5,4);

-- Index for provider_id lookups (new FK)
CREATE INDEX IF NOT EXISTS idx_provider_offers_provider_id
  ON provider_offers(provider_id);

-- Index for market_type_id lookups
CREATE INDEX IF NOT EXISTS idx_provider_offers_market_type_id
  ON provider_offers(market_type_id);

-- Composite index for current offer lookup (DISTINCT ON optimization)
CREATE INDEX IF NOT EXISTS idx_provider_offers_current_v3
  ON provider_offers(event_id, market_type_id, participant_id, provider_id, snapshot_at DESC);

-- Index for CLV analysis by event + market type
CREATE INDEX IF NOT EXISTS idx_provider_offers_clv_market_type
  ON provider_offers(event_id, market_type_id, snapshot_at DESC);

COMMENT ON COLUMN provider_offers.provider_id IS 'FK to provider_registry. Null for legacy rows before V3 migration.';
COMMENT ON COLUMN provider_offers.market_type_id IS 'FK to market_types (normalized). Bridges to legacy market_id.';
COMMENT ON COLUMN provider_offers.provider_event_id IS 'Raw provider event identifier for audit trail.';
COMMENT ON COLUMN provider_offers.provider_market_key IS 'Raw provider market key for audit trail.';
COMMENT ON COLUMN provider_offers.provider_participant_id IS 'Raw provider participant ID for audit trail.';

-- ============================================================================
-- 2. OFFER QUARANTINE LEDGER
-- Fail-closed: unmapped offers go here, not to provider_offers
-- ============================================================================

CREATE TABLE IF NOT EXISTS offer_quarantine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key TEXT NOT NULL,                     -- Provider code (not resolved)
  provider_id INTEGER REFERENCES provider_registry(id),  -- Resolved if provider exists
  captured_at TIMESTAMPTZ NOT NULL,               -- When offer was captured

  -- Failure details
  reason_code TEXT NOT NULL,                      -- See reason codes below
  reason_detail JSONB NOT NULL DEFAULT '{}',      -- What failed mapping

  -- Raw offer data (preserved for retry)
  raw_payload JSONB NOT NULL,

  -- Resolution tracking
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolution_action TEXT,                         -- 'MAPPED', 'REJECTED', 'EXPIRED'

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT offer_quarantine_reason_check CHECK (reason_code IN (
    'UNMAPPED_PROVIDER',    -- Provider code not in registry
    'UNMAPPED_EVENT',       -- Event not mapped for this provider
    'UNMAPPED_MARKET',      -- Market type not mapped for this provider
    'UNMAPPED_PARTICIPANT', -- Player/team not mapped
    'LOW_CONFIDENCE',       -- Mapping exists but confidence < threshold
    'EXPIRED_MAPPING',      -- Mapping expired (valid_to < NOW())
    'INVALID_PAYLOAD',      -- Payload validation failed
    'CONSTRAINT_VIOLATION'  -- DB constraint violated
  ))
);

-- Indexes for quarantine management
CREATE INDEX IF NOT EXISTS idx_offer_quarantine_unresolved
  ON offer_quarantine(reason_code, created_at)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_offer_quarantine_provider
  ON offer_quarantine(provider_key, created_at);

CREATE INDEX IF NOT EXISTS idx_offer_quarantine_provider_id
  ON offer_quarantine(provider_id, created_at)
  WHERE provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offer_quarantine_captured
  ON offer_quarantine(captured_at);

COMMENT ON TABLE offer_quarantine IS 'Quarantine ledger for unmapped offers. Fail-closed ingestion. V3.';

-- ============================================================================
-- 3. MAPPING RESOLUTION FUNCTIONS
-- Helper functions for provider → canonical ID resolution
-- ============================================================================

-- Resolve provider_key to provider_id
CREATE OR REPLACE FUNCTION resolve_provider_id(p_provider_key TEXT)
RETURNS INTEGER AS $$
  SELECT id FROM provider_registry
  WHERE code = p_provider_key AND active = TRUE
  LIMIT 1;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION resolve_provider_id IS 'Resolve provider code to provider_id. Returns NULL if not found/inactive.';

-- Resolve provider event to canonical event_id
CREATE OR REPLACE FUNCTION resolve_event_mapping(
  p_provider_id INTEGER,
  p_provider_event_id TEXT,
  p_min_confidence NUMERIC DEFAULT 0.8
)
RETURNS TABLE (
  canonical_event_id UUID,
  confidence NUMERIC
) AS $$
  SELECT
    canonical_event_id,
    confidence_score
  FROM provider_event_map
  WHERE provider_id = p_provider_id
    AND provider_event_id = p_provider_event_id
    AND (valid_to IS NULL OR valid_to > NOW())
    AND valid_from <= NOW()
    AND confidence_score >= p_min_confidence
  ORDER BY mapping_version DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION resolve_event_mapping IS 'Resolve provider event to canonical event_id with confidence filter.';

-- Resolve provider market to canonical market_type_id
CREATE OR REPLACE FUNCTION resolve_market_mapping(
  p_provider_id INTEGER,
  p_provider_market_key TEXT,
  p_min_confidence NUMERIC DEFAULT 0.8
)
RETURNS TABLE (
  canonical_market_type_id INTEGER,
  confidence NUMERIC
) AS $$
  SELECT
    canonical_market_type_id,
    confidence_score
  FROM provider_market_map
  WHERE provider_id = p_provider_id
    AND provider_market_key = p_provider_market_key
    AND (valid_to IS NULL OR valid_to > NOW())
    AND valid_from <= NOW()
    AND confidence_score >= p_min_confidence
  ORDER BY mapping_version DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION resolve_market_mapping IS 'Resolve provider market key to canonical market_type_id.';

-- Resolve provider participant (player or team) to canonical participant_id
CREATE OR REPLACE FUNCTION resolve_participant_mapping(
  p_provider_id INTEGER,
  p_provider_participant_id TEXT,
  p_participant_type TEXT,  -- 'player' or 'team'
  p_min_confidence NUMERIC DEFAULT 0.8
)
RETURNS TABLE (
  canonical_participant_id UUID,
  confidence NUMERIC
) AS $$
BEGIN
  IF p_participant_type = 'player' THEN
    RETURN QUERY
    SELECT
      canonical_player_id,
      confidence_score
    FROM provider_player_map
    WHERE provider_id = p_provider_id
      AND provider_player_id = p_provider_participant_id
      AND (valid_to IS NULL OR valid_to > NOW())
      AND valid_from <= NOW()
      AND confidence_score >= p_min_confidence
    ORDER BY mapping_version DESC
    LIMIT 1;
  ELSE
    RETURN QUERY
    SELECT
      canonical_team_id,
      confidence_score
    FROM provider_team_map
    WHERE provider_id = p_provider_id
      AND provider_team_id = p_provider_participant_id
      AND (valid_to IS NULL OR valid_to > NOW())
      AND valid_from <= NOW()
      AND confidence_score >= p_min_confidence
    ORDER BY mapping_version DESC
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION resolve_participant_mapping IS 'Resolve provider participant to canonical participant_id.';

-- ============================================================================
-- 4. MAIN INGESTION FUNCTION: upsert_provider_offers_v3
-- Single-writer surface for provider offers with fail-closed mapping
-- ============================================================================

CREATE OR REPLACE FUNCTION upsert_provider_offers_v3(
  p_provider_key TEXT,
  p_captured_at TIMESTAMPTZ,
  p_offers JSONB,  -- Array of offer objects
  p_min_confidence NUMERIC DEFAULT 0.8
)
RETURNS TABLE (
  inserted_count INTEGER,
  updated_count INTEGER,
  quarantined_count INTEGER,
  quarantine_reasons JSONB
) AS $$
DECLARE
  v_provider_id INTEGER;
  v_offer JSONB;
  v_inserted INTEGER := 0;
  v_updated INTEGER := 0;
  v_quarantined INTEGER := 0;
  v_quarantine_reasons JSONB := '[]'::JSONB;
  v_event_mapping RECORD;
  v_market_mapping RECORD;
  v_participant_mapping RECORD;
  v_segment_type_id INTEGER;
  v_quarantine_reason TEXT;
  v_quarantine_detail JSONB;
  v_upsert_result RECORD;
BEGIN
  -- Resolve provider
  v_provider_id := resolve_provider_id(p_provider_key);

  IF v_provider_id IS NULL THEN
    -- Quarantine ALL offers - provider not found
    FOR v_offer IN SELECT * FROM jsonb_array_elements(p_offers)
    LOOP
      INSERT INTO offer_quarantine (
        provider_key, provider_id, captured_at,
        reason_code, reason_detail, raw_payload
      ) VALUES (
        p_provider_key, NULL, p_captured_at,
        'UNMAPPED_PROVIDER',
        jsonb_build_object('provider_key', p_provider_key),
        v_offer
      );
      v_quarantined := v_quarantined + 1;
    END LOOP;

    RETURN QUERY SELECT
      0::INTEGER,
      0::INTEGER,
      v_quarantined,
      jsonb_build_array(jsonb_build_object('reason', 'UNMAPPED_PROVIDER', 'count', v_quarantined));
    RETURN;
  END IF;

  -- Process each offer
  FOR v_offer IN SELECT * FROM jsonb_array_elements(p_offers)
  LOOP
    v_quarantine_reason := NULL;
    v_quarantine_detail := '{}'::JSONB;

    -- 1. Resolve event mapping
    SELECT * INTO v_event_mapping
    FROM resolve_event_mapping(
      v_provider_id,
      v_offer->>'provider_event_id',
      p_min_confidence
    );

    IF v_event_mapping.canonical_event_id IS NULL THEN
      v_quarantine_reason := 'UNMAPPED_EVENT';
      v_quarantine_detail := jsonb_build_object(
        'provider_event_id', v_offer->>'provider_event_id'
      );
    END IF;

    -- 2. Resolve market mapping (if event OK)
    IF v_quarantine_reason IS NULL THEN
      SELECT * INTO v_market_mapping
      FROM resolve_market_mapping(
        v_provider_id,
        v_offer->>'provider_market_key',
        p_min_confidence
      );

      IF v_market_mapping.canonical_market_type_id IS NULL THEN
        v_quarantine_reason := 'UNMAPPED_MARKET';
        v_quarantine_detail := jsonb_build_object(
          'provider_market_key', v_offer->>'provider_market_key'
        );
      END IF;
    END IF;

    -- 3. Resolve participant mapping (if applicable and prior checks OK)
    IF v_quarantine_reason IS NULL AND v_offer->>'provider_participant_id' IS NOT NULL THEN
      SELECT * INTO v_participant_mapping
      FROM resolve_participant_mapping(
        v_provider_id,
        v_offer->>'provider_participant_id',
        COALESCE(v_offer->>'participant_type', 'player'),
        p_min_confidence
      );

      IF v_participant_mapping.canonical_participant_id IS NULL THEN
        v_quarantine_reason := 'UNMAPPED_PARTICIPANT';
        v_quarantine_detail := jsonb_build_object(
          'provider_participant_id', v_offer->>'provider_participant_id',
          'participant_type', COALESCE(v_offer->>'participant_type', 'player')
        );
      END IF;
    END IF;

    -- 4. Resolve segment type (optional)
    IF v_quarantine_reason IS NULL AND v_offer->>'segment_type' IS NOT NULL THEN
      SELECT id INTO v_segment_type_id
      FROM segment_types
      WHERE code = v_offer->>'segment_type';
    END IF;

    -- 5. Either quarantine or upsert
    IF v_quarantine_reason IS NOT NULL THEN
      -- QUARANTINE: mapping failed
      INSERT INTO offer_quarantine (
        provider_key, provider_id, captured_at,
        reason_code, reason_detail, raw_payload
      ) VALUES (
        p_provider_key, v_provider_id, p_captured_at,
        v_quarantine_reason, v_quarantine_detail, v_offer
      );
      v_quarantined := v_quarantined + 1;

      -- Track reason for summary
      v_quarantine_reasons := v_quarantine_reasons || jsonb_build_object(
        'reason', v_quarantine_reason,
        'detail', v_quarantine_detail
      );
    ELSE
      -- UPSERT: all mappings resolved
      INSERT INTO provider_offers (
        event_id,
        market_id,
        market_type_id,
        participant_id,
        segment_id,
        segment_type_id,
        provider,
        provider_id,
        provider_event_id,
        provider_market_key,
        provider_participant_id,
        line,
        over_odds,
        under_odds,
        home_odds,
        away_odds,
        yes_odds,
        no_odds,
        devigged_over,
        devigged_under,
        juice,
        snapshot_at,
        is_opening,
        is_closing,
        mapping_confidence,
        meta
      ) VALUES (
        v_event_mapping.canonical_event_id,
        NULL,  -- legacy market_id not used for V3 ingestion
        v_market_mapping.canonical_market_type_id,
        v_participant_mapping.canonical_participant_id,
        NULL,  -- segment_id resolved if needed
        v_segment_type_id,
        p_provider_key,
        v_provider_id,
        v_offer->>'provider_event_id',
        v_offer->>'provider_market_key',
        v_offer->>'provider_participant_id',
        (v_offer->>'line')::NUMERIC,
        (v_offer->>'over_odds')::INTEGER,
        (v_offer->>'under_odds')::INTEGER,
        (v_offer->>'home_odds')::INTEGER,
        (v_offer->>'away_odds')::INTEGER,
        (v_offer->>'yes_odds')::INTEGER,
        (v_offer->>'no_odds')::INTEGER,
        (v_offer->>'devigged_over')::NUMERIC,
        (v_offer->>'devigged_under')::NUMERIC,
        (v_offer->>'juice')::NUMERIC,
        p_captured_at,
        COALESCE((v_offer->>'is_opening')::BOOLEAN, FALSE),
        COALESCE((v_offer->>'is_closing')::BOOLEAN, FALSE),
        LEAST(
          COALESCE(v_event_mapping.confidence, 1.0),
          COALESCE(v_market_mapping.confidence, 1.0),
          COALESCE(v_participant_mapping.confidence, 1.0)
        ),
        COALESCE(v_offer->'meta', '{}'::JSONB)
      )
      ON CONFLICT (event_id, market_id, participant_id, segment_id, provider, snapshot_at)
      DO UPDATE SET
        market_type_id = EXCLUDED.market_type_id,
        provider_id = EXCLUDED.provider_id,
        provider_event_id = EXCLUDED.provider_event_id,
        provider_market_key = EXCLUDED.provider_market_key,
        provider_participant_id = EXCLUDED.provider_participant_id,
        line = EXCLUDED.line,
        over_odds = EXCLUDED.over_odds,
        under_odds = EXCLUDED.under_odds,
        home_odds = EXCLUDED.home_odds,
        away_odds = EXCLUDED.away_odds,
        yes_odds = EXCLUDED.yes_odds,
        no_odds = EXCLUDED.no_odds,
        devigged_over = EXCLUDED.devigged_over,
        devigged_under = EXCLUDED.devigged_under,
        juice = EXCLUDED.juice,
        is_opening = EXCLUDED.is_opening,
        is_closing = EXCLUDED.is_closing,
        mapping_confidence = EXCLUDED.mapping_confidence,
        meta = EXCLUDED.meta
      RETURNING (xmax = 0) INTO v_upsert_result;

      IF v_upsert_result.column1 THEN
        v_inserted := v_inserted + 1;
      ELSE
        v_updated := v_updated + 1;
      END IF;
    END IF;
  END LOOP;

  -- Return summary
  RETURN QUERY SELECT v_inserted, v_updated, v_quarantined, v_quarantine_reasons;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION upsert_provider_offers_v3 IS
  'Single-writer ingestion for provider offers. Fail-closed: unmapped offers quarantined. V3.';

-- ============================================================================
-- 5. CONTRACT VIEW: view_provider_offers_current_v3
-- Latest offer per provider/market_type/participant with V3 normalization
-- ============================================================================

CREATE OR REPLACE VIEW view_provider_offers_current_v3 AS
SELECT DISTINCT ON (
  po.event_id,
  po.market_type_id,
  COALESCE(po.participant_id, '00000000-0000-0000-0000-000000000000'::UUID),
  po.provider_id
)
  po.id,
  po.event_id,
  po.market_type_id,
  mt.market_key,
  mt.display_name AS market_name,
  po.participant_id,
  p.name AS participant_name,
  po.segment_type_id,
  st.code AS segment_type,
  po.provider_id,
  pr.code AS provider,
  pr.display_name AS provider_name,
  po.line,
  po.over_odds,
  po.under_odds,
  po.home_odds,
  po.away_odds,
  po.yes_odds,
  po.no_odds,
  po.devigged_over,
  po.devigged_under,
  po.juice,
  po.snapshot_at,
  po.is_opening,
  po.is_closing,
  po.mapping_confidence,
  po.meta,
  po.created_at
FROM provider_offers po
JOIN provider_registry pr ON pr.id = po.provider_id
LEFT JOIN market_types mt ON mt.id = po.market_type_id
LEFT JOIN participants p ON p.id = po.participant_id
LEFT JOIN segment_types st ON st.id = po.segment_type_id
WHERE po.provider_id IS NOT NULL  -- V3 offers only
ORDER BY
  po.event_id,
  po.market_type_id,
  COALESCE(po.participant_id, '00000000-0000-0000-0000-000000000000'::UUID),
  po.provider_id,
  po.snapshot_at DESC;

COMMENT ON VIEW view_provider_offers_current_v3 IS
  'Latest offer per provider/market_type/participant. V3 normalized view.';

-- ============================================================================
-- 6. CONTRACT VIEW: view_best_offer_by_market
-- Best line/odds across all providers for each market
-- ============================================================================

CREATE OR REPLACE VIEW view_best_offer_by_market AS
WITH current_offers AS (
  SELECT * FROM view_provider_offers_current_v3
),
ranked_offers AS (
  SELECT
    co.*,
    -- Rank by best over odds (highest = best for over bets)
    ROW_NUMBER() OVER (
      PARTITION BY co.event_id, co.market_type_id, co.participant_id
      ORDER BY co.over_odds DESC NULLS LAST
    ) AS over_rank,
    -- Rank by best under odds (highest = best for under bets)
    ROW_NUMBER() OVER (
      PARTITION BY co.event_id, co.market_type_id, co.participant_id
      ORDER BY co.under_odds DESC NULLS LAST
    ) AS under_rank,
    -- Rank by best home odds
    ROW_NUMBER() OVER (
      PARTITION BY co.event_id, co.market_type_id, co.participant_id
      ORDER BY co.home_odds DESC NULLS LAST
    ) AS home_rank,
    -- Rank by best away odds
    ROW_NUMBER() OVER (
      PARTITION BY co.event_id, co.market_type_id, co.participant_id
      ORDER BY co.away_odds DESC NULLS LAST
    ) AS away_rank
  FROM current_offers co
)
SELECT
  ro.event_id,
  ro.market_type_id,
  ro.market_key,
  ro.market_name,
  ro.participant_id,
  ro.participant_name,
  ro.segment_type_id,
  ro.segment_type,

  -- Best over offer
  MAX(CASE WHEN ro.over_rank = 1 THEN ro.over_odds END) AS best_over_odds,
  MAX(CASE WHEN ro.over_rank = 1 THEN ro.line END) AS best_over_line,
  MAX(CASE WHEN ro.over_rank = 1 THEN ro.provider END) AS best_over_provider,
  MAX(CASE WHEN ro.over_rank = 1 THEN ro.provider_id END) AS best_over_provider_id,

  -- Best under offer
  MAX(CASE WHEN ro.under_rank = 1 THEN ro.under_odds END) AS best_under_odds,
  MAX(CASE WHEN ro.under_rank = 1 THEN ro.line END) AS best_under_line,
  MAX(CASE WHEN ro.under_rank = 1 THEN ro.provider END) AS best_under_provider,
  MAX(CASE WHEN ro.under_rank = 1 THEN ro.provider_id END) AS best_under_provider_id,

  -- Best home/away for moneyline markets
  MAX(CASE WHEN ro.home_rank = 1 THEN ro.home_odds END) AS best_home_odds,
  MAX(CASE WHEN ro.home_rank = 1 THEN ro.provider END) AS best_home_provider,
  MAX(CASE WHEN ro.away_rank = 1 THEN ro.away_odds END) AS best_away_odds,
  MAX(CASE WHEN ro.away_rank = 1 THEN ro.provider END) AS best_away_provider,

  -- Aggregates
  COUNT(DISTINCT ro.provider_id) AS provider_count,
  MIN(ro.snapshot_at) AS oldest_snapshot,
  MAX(ro.snapshot_at) AS newest_snapshot
FROM ranked_offers ro
GROUP BY
  ro.event_id,
  ro.market_type_id,
  ro.market_key,
  ro.market_name,
  ro.participant_id,
  ro.participant_name,
  ro.segment_type_id,
  ro.segment_type;

COMMENT ON VIEW view_best_offer_by_market IS
  'Best line/odds across all providers for each market. V3.';

-- ============================================================================
-- 7. CONTRACT VIEW: view_offer_quarantine_pending
-- Unresolved quarantine entries for operator attention
-- ============================================================================

CREATE OR REPLACE VIEW view_offer_quarantine_pending AS
SELECT
  oq.id,
  oq.provider_key,
  oq.provider_id,
  pr.display_name AS provider_name,
  oq.captured_at,
  oq.reason_code,
  oq.reason_detail,
  oq.raw_payload,
  oq.created_at,
  -- Extract key identifiers for display
  oq.raw_payload->>'provider_event_id' AS provider_event_id,
  oq.raw_payload->>'provider_market_key' AS provider_market_key,
  oq.raw_payload->>'provider_participant_id' AS provider_participant_id
FROM offer_quarantine oq
LEFT JOIN provider_registry pr ON pr.id = oq.provider_id
WHERE oq.resolved_at IS NULL
ORDER BY oq.reason_code, oq.created_at;

COMMENT ON VIEW view_offer_quarantine_pending IS
  'Pending quarantine items for operator resolution. V3.';

-- ============================================================================
-- 8. QUARANTINE RESOLUTION FUNCTION
-- Mark quarantine entries as resolved
-- ============================================================================

CREATE OR REPLACE FUNCTION resolve_offer_quarantine(
  p_quarantine_id UUID,
  p_resolved_by TEXT,
  p_resolution_action TEXT  -- 'MAPPED', 'REJECTED', 'EXPIRED'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_affected INTEGER;
BEGIN
  UPDATE offer_quarantine
  SET
    resolved_at = NOW(),
    resolved_by = p_resolved_by,
    resolution_action = p_resolution_action
  WHERE id = p_quarantine_id
    AND resolved_at IS NULL;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION resolve_offer_quarantine IS
  'Mark a quarantine entry as resolved. Returns TRUE if updated.';

-- ============================================================================
-- 9. PERFORMANCE INDEXES (additional)
-- ============================================================================

-- Index for view_best_offer_by_market query optimization
CREATE INDEX IF NOT EXISTS idx_provider_offers_best_offer_lookup
  ON provider_offers(event_id, market_type_id, participant_id, over_odds DESC, under_odds DESC)
  WHERE provider_id IS NOT NULL;

-- Index for provider-captured time queries
CREATE INDEX IF NOT EXISTS idx_provider_offers_provider_snapshot
  ON provider_offers(provider_id, snapshot_at DESC)
  WHERE provider_id IS NOT NULL;

-- Index for event-level offer queries
CREATE INDEX IF NOT EXISTS idx_provider_offers_event_snapshot
  ON provider_offers(event_id, snapshot_at DESC)
  WHERE provider_id IS NOT NULL;

-- ============================================================================
-- END OF MIGRATION
-- Sprint: SPRINT-CANONICAL-V3-FEED-OFFERS-073
--
-- SCHEMA CHANGES:
-- - Added columns to provider_offers: provider_id, market_type_id, segment_type_id,
--   provider_event_id, provider_market_key, provider_participant_id, mapping_confidence
--
-- NEW TABLES:
-- - offer_quarantine (fail-closed quarantine ledger)
--
-- NEW FUNCTIONS:
-- - resolve_provider_id(TEXT) -> INTEGER
-- - resolve_event_mapping(INT, TEXT, NUMERIC) -> TABLE
-- - resolve_market_mapping(INT, TEXT, NUMERIC) -> TABLE
-- - resolve_participant_mapping(INT, TEXT, TEXT, NUMERIC) -> TABLE
-- - upsert_provider_offers_v3(TEXT, TIMESTAMPTZ, JSONB, NUMERIC) -> TABLE
-- - resolve_offer_quarantine(UUID, TEXT, TEXT) -> BOOLEAN
--
-- NEW VIEWS:
-- - view_provider_offers_current_v3 (normalized current offers)
-- - view_best_offer_by_market (best price comparison)
-- - view_offer_quarantine_pending (pending quarantine items)
--
-- INDEXES: 8 new performance indexes
-- ============================================================================
