-- ============================================================================
-- EXECUTION EVENTS TELEMETRY TABLE
-- Sprint: EXECUTION-TELEMETRY-ACTIVATION-003
-- Date: 2026-02-28
--
-- Canonical telemetry for execution alpha measurement:
-- - CLV (Closing Line Value) tracking by route/surface
-- - Publish latency measurement
-- - Slippage tracking (entry vs best available)
-- - Settlement-time CLV update
--
-- Rollback: DROP TABLE IF EXISTS execution_events CASCADE;
-- ============================================================================

-- ============================================================================
-- 1. CREATE EXECUTION_EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS execution_events (
  -- Identity & Linkage
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID NOT NULL REFERENCES unified_picks(id) ON DELETE CASCADE,
  publish_attempt_id TEXT,  -- Optional: for multi-attempt tracking
  discord_message_id TEXT,  -- Nullable until receipt confirmed

  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  publish_requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,  -- NULL until success
  publish_latency_ms INTEGER,  -- Computed: published_at - publish_requested_at

  -- Routing
  route_type TEXT NOT NULL DEFAULT 'WEBHOOK' CHECK (route_type IN ('WEBHOOK', 'BOT', 'API')),
  target_surface TEXT NOT NULL CHECK (target_surface IN (
    'CANARY', 'TRADER_INSIGHTS', 'BEST_BETS', 'STRATEGY_LAB',
    'FREE_DAILY_PICKS', 'VIP_LOUNGE', 'INFO_CENTER', 'RECAPS', 'INTERNAL'
  )),
  target_channel_id TEXT,
  target_webhook_id TEXT,  -- Nullable: hashed/masked if stored

  -- Price/Line at Publish
  entry_line NUMERIC,
  entry_odds NUMERIC,
  entry_book TEXT,
  best_line_at_publish NUMERIC,  -- Future: best available line
  best_odds_at_publish NUMERIC,  -- Future: best available odds
  market_dispersion_at_publish NUMERIC,  -- Future: market variance

  -- Post-Close (Updated on Settlement)
  closing_line NUMERIC,
  closing_odds NUMERIC,
  clv_delta NUMERIC,  -- Computed: closing vs entry (direction-aware)
  clv_bucket TEXT CHECK (clv_bucket IS NULL OR clv_bucket IN (
    'STRONG_POSITIVE', 'POSITIVE', 'NEUTRAL', 'NEGATIVE', 'STRONG_NEGATIVE'
  )),

  -- Execution Quality
  slippage NUMERIC,  -- entry vs best_at_publish
  liquidity_bucket TEXT,  -- Future: market liquidity context
  execution_notes TEXT,  -- Anomaly notes

  -- Status
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'published', 'failed', 'settled')),
  error_message TEXT,

  -- Metadata
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE execution_events IS
  'Canonical execution telemetry for CLV, latency, and slippage tracking. One row per published pick.';

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- Primary lookup by pick (most common query)
CREATE INDEX IF NOT EXISTS idx_execution_events_pick_id
  ON execution_events(pick_id);

-- Time-series queries for analytics
CREATE INDEX IF NOT EXISTS idx_execution_events_published_at
  ON execution_events(published_at)
  WHERE published_at IS NOT NULL;

-- Surface analytics (CLV by channel)
CREATE INDEX IF NOT EXISTS idx_execution_events_surface_time
  ON execution_events(target_surface, published_at);

-- Status monitoring (find failed/stuck events)
CREATE INDEX IF NOT EXISTS idx_execution_events_status
  ON execution_events(status)
  WHERE status IN ('requested', 'failed');

-- Idempotency: one telemetry row per pick (enforced at DB level)
-- This ensures retry does not create duplicate rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_events_pick_unique
  ON execution_events(pick_id);

-- CLV analysis: filter to settled events with CLV data
CREATE INDEX IF NOT EXISTS idx_execution_events_clv_analysis
  ON execution_events(target_surface, clv_bucket)
  WHERE status = 'settled' AND clv_delta IS NOT NULL;

-- ============================================================================
-- 3. UPDATE TRIGGER FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_execution_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_execution_events_updated_at ON execution_events;
CREATE TRIGGER trigger_execution_events_updated_at
  BEFORE UPDATE ON execution_events
  FOR EACH ROW
  EXECUTE FUNCTION update_execution_events_updated_at();

-- ============================================================================
-- 4. HELPER FUNCTION: CREATE EXECUTION TELEMETRY (IDEMPOTENT)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_execution_telemetry(
  p_pick_id UUID,
  p_route_type TEXT DEFAULT 'WEBHOOK',
  p_target_surface TEXT DEFAULT 'CANARY',
  p_target_channel_id TEXT DEFAULT NULL,
  p_entry_line NUMERIC DEFAULT NULL,
  p_entry_odds NUMERIC DEFAULT NULL,
  p_entry_book TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO execution_events (
    pick_id,
    route_type,
    target_surface,
    target_channel_id,
    entry_line,
    entry_odds,
    entry_book,
    publish_requested_at,
    status
  ) VALUES (
    p_pick_id,
    p_route_type,
    p_target_surface,
    p_target_channel_id,
    p_entry_line,
    p_entry_odds,
    p_entry_book,
    NOW(),
    'requested'
  )
  ON CONFLICT (pick_id) DO UPDATE SET
    -- Idempotent: if row exists, just return existing ID
    updated_at = NOW()
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_execution_telemetry IS
  'Creates execution telemetry row BEFORE Discord publish. Idempotent by pick_id.';

-- ============================================================================
-- 5. HELPER FUNCTION: UPDATE TELEMETRY ON PUBLISH SUCCESS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_execution_telemetry_published(
  p_pick_id UUID,
  p_discord_message_id TEXT,
  p_publish_latency_ms INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  UPDATE execution_events
  SET
    published_at = NOW(),
    discord_message_id = p_discord_message_id,
    publish_latency_ms = COALESCE(p_publish_latency_ms,
      EXTRACT(EPOCH FROM (NOW() - publish_requested_at))::INTEGER * 1000),
    status = 'published'
  WHERE pick_id = p_pick_id
    AND status = 'requested';

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_execution_telemetry_published IS
  'Updates telemetry on successful Discord publish with receipt and latency.';

-- ============================================================================
-- 6. HELPER FUNCTION: UPDATE TELEMETRY ON PUBLISH FAILURE
-- ============================================================================

CREATE OR REPLACE FUNCTION update_execution_telemetry_failed(
  p_pick_id UUID,
  p_error_message TEXT,
  p_execution_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  UPDATE execution_events
  SET
    status = 'failed',
    error_message = p_error_message,
    execution_notes = COALESCE(p_execution_notes, execution_notes)
  WHERE pick_id = p_pick_id
    AND status IN ('requested', 'failed');

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_execution_telemetry_failed IS
  'Updates telemetry on Discord publish failure with error details.';

-- ============================================================================
-- 7. HELPER FUNCTION: UPDATE TELEMETRY ON SETTLEMENT (CLV)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_execution_telemetry_settled(
  p_pick_id UUID,
  p_closing_line NUMERIC DEFAULT NULL,
  p_closing_odds NUMERIC DEFAULT NULL,
  p_clv_delta NUMERIC DEFAULT NULL,
  p_clv_bucket TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  UPDATE execution_events
  SET
    closing_line = COALESCE(p_closing_line, closing_line),
    closing_odds = COALESCE(p_closing_odds, closing_odds),
    clv_delta = COALESCE(p_clv_delta, clv_delta),
    clv_bucket = COALESCE(p_clv_bucket, clv_bucket),
    status = 'settled'
  WHERE pick_id = p_pick_id
    AND status IN ('published', 'settled');  -- Allow re-settlement updates

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_execution_telemetry_settled IS
  'Updates telemetry on settlement with closing line and CLV calculation.';

-- ============================================================================
-- 8. ANALYTICS VIEW: CLV BY SURFACE
-- ============================================================================

CREATE OR REPLACE VIEW v_execution_clv_by_surface AS
SELECT
  target_surface,
  COUNT(*) AS total_picks,
  COUNT(*) FILTER (WHERE clv_delta IS NOT NULL) AS picks_with_clv,
  AVG(clv_delta) AS avg_clv_delta,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY clv_delta) AS median_clv_delta,
  COUNT(*) FILTER (WHERE clv_bucket = 'STRONG_POSITIVE') AS strong_positive,
  COUNT(*) FILTER (WHERE clv_bucket = 'POSITIVE') AS positive,
  COUNT(*) FILTER (WHERE clv_bucket = 'NEUTRAL') AS neutral,
  COUNT(*) FILTER (WHERE clv_bucket = 'NEGATIVE') AS negative,
  COUNT(*) FILTER (WHERE clv_bucket = 'STRONG_NEGATIVE') AS strong_negative
FROM execution_events
WHERE status = 'settled'
GROUP BY target_surface;

COMMENT ON VIEW v_execution_clv_by_surface IS
  'Aggregated CLV metrics by Discord surface/channel.';

-- ============================================================================
-- 9. ANALYTICS VIEW: LATENCY DISTRIBUTION
-- ============================================================================

CREATE OR REPLACE VIEW v_execution_latency_distribution AS
SELECT
  CASE
    WHEN publish_latency_ms < 100 THEN '<100ms'
    WHEN publish_latency_ms < 500 THEN '100-500ms'
    WHEN publish_latency_ms < 1000 THEN '500ms-1s'
    WHEN publish_latency_ms < 2000 THEN '1-2s'
    ELSE '>2s'
  END AS latency_bucket,
  COUNT(*) AS count,
  target_surface
FROM execution_events
WHERE publish_latency_ms IS NOT NULL
GROUP BY 1, target_surface
ORDER BY MIN(publish_latency_ms);

COMMENT ON VIEW v_execution_latency_distribution IS
  'Distribution of publish latency by bucket and surface.';

-- ============================================================================
-- 10. INTEGRITY CHECK FUNCTION: MISSING TELEMETRY
-- ============================================================================

CREATE OR REPLACE FUNCTION check_missing_execution_telemetry(
  p_since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS TABLE (
  pick_id UUID,
  posted_to_discord BOOLEAN,
  promotion_posted_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.id AS pick_id,
    up.posted_to_discord,
    up.promotion_posted_at
  FROM unified_picks up
  LEFT JOIN execution_events ee ON ee.pick_id = up.id
  WHERE up.posted_to_discord = TRUE
    AND up.promotion_posted_at >= p_since
    AND ee.id IS NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_missing_execution_telemetry IS
  'Returns published picks missing execution_events rows. Should return 0 after deployment.';

-- ============================================================================
-- END OF MIGRATION
-- Sprint: EXECUTION-TELEMETRY-ACTIVATION-003
-- Rollback: DROP TABLE IF EXISTS execution_events CASCADE;
-- ============================================================================
