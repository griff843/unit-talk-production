-- ============================================================================
-- CANONICAL SCHEMA V3 FOUNDATION
-- Sprint: SPRINT-CANONICAL-V3-FOUNDATION-071
-- Date: 2026-02-20
--
-- Creates 10 canonical tables for the Unit Talk Platform:
-- 1. participants
-- 2. participant_memberships
-- 3. event_participants
-- 4. events
-- 5. event_segments
-- 6. markets
-- 7. provider_offers
-- 8. tickets
-- 9. ticket_legs
-- 10. feature_snapshots + scored_legs
--
-- NO app behavior changes. DDL only.
-- ============================================================================

-- ============================================================================
-- 1. PARTICIPANTS
-- Unified entity for teams, players, fighters, horses, golfers.
-- ============================================================================
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT,                          -- ESPN/external ID
  type TEXT NOT NULL,                        -- 'team', 'player', 'horse', 'fighter'
  name TEXT NOT NULL,
  display_name TEXT,
  sport TEXT NOT NULL,                       -- 'NBA', 'NFL', 'MMA', 'TENNIS', 'GOLF'
  league TEXT,
  meta JSONB DEFAULT '{}',                   -- headshot_url, jersey_number, etc.
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT participants_external_id_sport_unique UNIQUE (external_id, sport),
  CONSTRAINT participants_type_check CHECK (type IN ('team', 'player', 'horse', 'fighter', 'golfer', 'driver'))
);

-- Indexes for participants
CREATE INDEX IF NOT EXISTS idx_participants_sport ON participants(sport);
CREATE INDEX IF NOT EXISTS idx_participants_type ON participants(type);
CREATE INDEX IF NOT EXISTS idx_participants_name ON participants(name);
CREATE INDEX IF NOT EXISTS idx_participants_active ON participants(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_participants_external_id ON participants(external_id) WHERE external_id IS NOT NULL;

COMMENT ON TABLE participants IS 'Unified entity for teams, players, fighters, horses. Canonical V3.';

-- ============================================================================
-- 2. PARTICIPANT_MEMBERSHIPS
-- Time-bounded roster memberships. Handles trades, free agency, injuries.
-- ============================================================================
CREATE TABLE IF NOT EXISTS participant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',                -- 'starter', 'bench', 'injured', 'traded'
  valid_from DATE NOT NULL,
  valid_to DATE,                             -- NULL = current
  meta JSONB DEFAULT '{}',                   -- jersey_number, position, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT membership_date_check CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT membership_not_self CHECK (participant_id <> team_id)
);

-- Indexes for participant_memberships
CREATE INDEX IF NOT EXISTS idx_memberships_participant ON participant_memberships(participant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_team ON participant_memberships(team_id);
CREATE INDEX IF NOT EXISTS idx_memberships_dates ON participant_memberships(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_memberships_current ON participant_memberships(participant_id) WHERE valid_to IS NULL;

COMMENT ON TABLE participant_memberships IS 'Time-bounded roster memberships. Supports trades/injuries. Canonical V3.';

-- ============================================================================
-- 3. EVENTS
-- Canonical event representation. Supports 2-participant and N-participant via event_participants.
-- ============================================================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,                   -- Odds API / ESPN game ID
  sport TEXT NOT NULL,
  league TEXT,
  event_type TEXT NOT NULL,                  -- 'game', 'match', 'fight', 'tournament_round'
  home_participant_id UUID REFERENCES participants(id),
  away_participant_id UUID REFERENCES participants(id),
  venue TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'scheduled',           -- 'scheduled', 'live', 'completed', 'postponed', 'cancelled'
  home_score INTEGER,
  away_score INTEGER,
  meta JSONB DEFAULT '{}',                   -- weather, attendance, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT events_status_check CHECK (status IN ('scheduled', 'live', 'completed', 'postponed', 'cancelled')),
  CONSTRAINT events_type_check CHECK (event_type IN ('game', 'match', 'fight', 'tournament_round', 'race'))
);

-- Indexes for events
CREATE INDEX IF NOT EXISTS idx_events_sport ON events(sport);
CREATE INDEX IF NOT EXISTS idx_events_scheduled ON events(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_participants ON events(home_participant_id, away_participant_id);
CREATE INDEX IF NOT EXISTS idx_events_external_id ON events(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_sport_scheduled ON events(sport, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_events_upcoming ON events(scheduled_at) WHERE status = 'scheduled';

COMMENT ON TABLE events IS 'Canonical event representation. Supports 2-participant and N-participant events. Canonical V3.';

-- ============================================================================
-- 4. EVENT_PARTICIPANTS
-- N-participant events (golf, horse racing, MMA cards). Complements home/away.
-- ============================================================================
CREATE TABLE IF NOT EXISTS event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'competitor',            -- 'home', 'away', 'competitor', 'field'
  seed INTEGER,                              -- Tournament seeding
  draw_position INTEGER,                     -- For horse racing, golf
  result TEXT,                               -- 'win', 'loss', 'draw', 'dnf', 'dq'
  final_position INTEGER,                    -- 1st, 2nd, 3rd for N-participant
  score NUMERIC,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT event_participants_unique UNIQUE (event_id, participant_id),
  CONSTRAINT event_participants_result_check CHECK (result IS NULL OR result IN ('win', 'loss', 'draw', 'dnf', 'dq', 'push'))
);

-- Indexes for event_participants
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_participant ON event_participants(participant_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_result ON event_participants(result) WHERE result IS NOT NULL;

COMMENT ON TABLE event_participants IS 'N-participant events (golf, MMA, racing). Canonical V3.';

-- ============================================================================
-- 5. EVENT_SEGMENTS
-- Segment-level data for 1Q, 1H, set, round, inning markets.
-- ============================================================================
CREATE TABLE IF NOT EXISTS event_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  segment_type TEXT NOT NULL,                -- 'quarter', 'half', 'period', 'set', 'round', 'inning', 'map'
  segment_number INTEGER NOT NULL,           -- 1, 2, 3, 4 for quarters
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  home_score INTEGER,
  away_score INTEGER,
  meta JSONB DEFAULT '{}',                   -- serve info for tennis, corner count, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT event_segments_unique UNIQUE (event_id, segment_type, segment_number),
  CONSTRAINT event_segments_type_check CHECK (segment_type IN ('quarter', 'half', 'period', 'set', 'round', 'inning', 'map', 'overtime')),
  CONSTRAINT event_segments_number_positive CHECK (segment_number > 0)
);

-- Indexes for event_segments
CREATE INDEX IF NOT EXISTS idx_event_segments_event ON event_segments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_segments_type ON event_segments(segment_type, segment_number);

COMMENT ON TABLE event_segments IS 'Segment-level data for quarters, sets, rounds, innings. Canonical V3.';

-- ============================================================================
-- 6. MARKETS
-- Normalized market definitions. Provider-agnostic market keys for CLV comparison.
-- ============================================================================
CREATE TABLE IF NOT EXISTS markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_key TEXT NOT NULL UNIQUE,        -- 'player_points_ou', 'team_moneyline', 'player_assists_ou'
  display_name TEXT NOT NULL,                -- 'Player Points Over/Under'
  category TEXT NOT NULL,                    -- 'player_prop', 'game_line', 'team_total', 'alternate'
  sport TEXT,                                -- NULL = universal, 'NBA' = sport-specific
  stat_type TEXT,                            -- 'points', 'rebounds', 'passing_yards'
  bet_structure TEXT NOT NULL,               -- 'over_under', 'moneyline', 'spread', 'yes_no'
  segment_applicable BOOLEAN DEFAULT FALSE,  -- Can this market apply to segments?
  default_segment TEXT DEFAULT 'full_game',  -- 'full_game', 'first_half', etc.
  settlement_source TEXT,                    -- 'espn_stats', 'official_stats', 'provider'
  meta JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT markets_category_check CHECK (category IN ('player_prop', 'game_line', 'team_total', 'alternate', 'futures', 'special')),
  CONSTRAINT markets_bet_structure_check CHECK (bet_structure IN ('over_under', 'moneyline', 'spread', 'yes_no', 'outright'))
);

-- Indexes for markets
CREATE INDEX IF NOT EXISTS idx_markets_canonical ON markets(canonical_key);
CREATE INDEX IF NOT EXISTS idx_markets_category ON markets(category);
CREATE INDEX IF NOT EXISTS idx_markets_sport ON markets(sport);
CREATE INDEX IF NOT EXISTS idx_markets_stat_type ON markets(stat_type) WHERE stat_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_markets_active ON markets(active) WHERE active = TRUE;

COMMENT ON TABLE markets IS 'Normalized market definitions. Provider-agnostic. Canonical V3.';

-- ============================================================================
-- 7. PROVIDER_OFFERS
-- Multi-book snapshots for CLV tracking. Enables opening/closing line comparison.
-- ============================================================================
CREATE TABLE IF NOT EXISTS provider_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants(id),  -- For player props
  segment_id UUID REFERENCES event_segments(id),    -- For segment markets
  provider TEXT NOT NULL,                    -- 'fanduel', 'draftkings', 'espn_bet', 'pinnacle'
  line NUMERIC,                              -- The line/spread/total
  over_odds INTEGER,                         -- American odds (+150, -110)
  under_odds INTEGER,
  home_odds INTEGER,                         -- For moneylines
  away_odds INTEGER,
  yes_odds INTEGER,                          -- For yes/no props
  no_odds INTEGER,
  devigged_over NUMERIC,                     -- Fair probability (0-1)
  devigged_under NUMERIC,
  juice NUMERIC,                             -- Vig/overround
  snapshot_at TIMESTAMPTZ NOT NULL,          -- When this was captured
  is_opening BOOLEAN DEFAULT FALSE,          -- Opening line flag for CLV
  is_closing BOOLEAN DEFAULT FALSE,          -- Closing line flag for CLV
  meta JSONB DEFAULT '{}',                   -- book-specific metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Composite uniqueness for offer snapshots
  CONSTRAINT provider_offers_snapshot_unique UNIQUE (event_id, market_id, participant_id, segment_id, provider, snapshot_at)
);

-- Indexes for provider_offers
CREATE INDEX IF NOT EXISTS idx_provider_offers_event ON provider_offers(event_id);
CREATE INDEX IF NOT EXISTS idx_provider_offers_market ON provider_offers(market_id);
CREATE INDEX IF NOT EXISTS idx_provider_offers_participant ON provider_offers(participant_id) WHERE participant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_provider_offers_provider ON provider_offers(provider);
CREATE INDEX IF NOT EXISTS idx_provider_offers_snapshot ON provider_offers(snapshot_at);
CREATE INDEX IF NOT EXISTS idx_provider_offers_opening ON provider_offers(is_opening) WHERE is_opening = TRUE;
CREATE INDEX IF NOT EXISTS idx_provider_offers_closing ON provider_offers(is_closing) WHERE is_closing = TRUE;
CREATE INDEX IF NOT EXISTS idx_provider_offers_event_market ON provider_offers(event_id, market_id);
CREATE INDEX IF NOT EXISTS idx_provider_offers_clv_lookup ON provider_offers(event_id, market_id, participant_id, provider);

COMMENT ON TABLE provider_offers IS 'Multi-book offer snapshots for CLV tracking. Canonical V3.';

-- ============================================================================
-- 8. TICKETS
-- User bet tickets. Replaces monolithic unified_picks for ticket-level data.
-- ============================================================================
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,                     -- REFERENCES users(id) - FK added if users table exists
  ticket_type TEXT NOT NULL,                 -- 'single', 'parlay', 'round_robin', 'teaser'
  bet_slip_id TEXT UNIQUE,                   -- External reference / idempotency key
  total_stake NUMERIC NOT NULL DEFAULT 0,
  total_odds INTEGER,                        -- Combined odds (American)
  potential_payout NUMERIC,
  status TEXT DEFAULT 'pending',             -- 'pending', 'posted', 'settled', 'void'
  settlement_result TEXT,                    -- 'win', 'loss', 'push', 'partial'
  settlement_payout NUMERIC,
  workflow_stage TEXT DEFAULT 'submitted',
  posted_to_discord BOOLEAN DEFAULT FALSE,
  discord_message_id TEXT,
  promotion_band TEXT,                       -- 'HARD', 'SOFT', 'NO_POST'
  tier TEXT,                                 -- 'S', 'A', 'B', 'C', 'F'
  confidence NUMERIC,
  professional_score NUMERIC,
  source TEXT DEFAULT 'smart_form',          -- 'smart_form', 'api', 'manual', 'system'
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  promotion_posted_at TIMESTAMPTZ,

  CONSTRAINT tickets_type_check CHECK (ticket_type IN ('single', 'parlay', 'round_robin', 'teaser')),
  CONSTRAINT tickets_status_check CHECK (status IN ('pending', 'posted', 'settled', 'void', 'cancelled')),
  CONSTRAINT tickets_result_check CHECK (settlement_result IS NULL OR settlement_result IN ('win', 'loss', 'push', 'partial', 'void')),
  CONSTRAINT tickets_tier_check CHECK (tier IS NULL OR tier IN ('S', 'A', 'B', 'C', 'F')),
  CONSTRAINT tickets_promotion_band_check CHECK (promotion_band IS NULL OR promotion_band IN ('HARD', 'SOFT', 'NO_POST'))
);

-- Indexes for tickets
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_workflow ON tickets(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_tickets_posted ON tickets(posted_to_discord);
CREATE INDEX IF NOT EXISTS idx_tickets_settlement ON tickets(settlement_result) WHERE settlement_result IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_bet_slip ON tickets(bet_slip_id) WHERE bet_slip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_tier ON tickets(tier) WHERE tier IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_pending ON tickets(status, created_at) WHERE status = 'pending';

COMMENT ON TABLE tickets IS 'User bet tickets. Replaces unified_picks for ticket-level data. Canonical V3.';

-- ============================================================================
-- 9. TICKET_LEGS
-- Individual legs of tickets. Enables proper parlay tracking and CLV comparison.
-- ============================================================================
CREATE TABLE IF NOT EXISTS ticket_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  leg_index INTEGER NOT NULL,                -- 0, 1, 2 for parlay legs
  event_id UUID NOT NULL REFERENCES events(id),
  market_id UUID NOT NULL REFERENCES markets(id),
  participant_id UUID REFERENCES participants(id),
  segment_id UUID REFERENCES event_segments(id),
  selection TEXT NOT NULL,                   -- 'over', 'under', 'home', 'away', 'yes', 'no'

  -- Three-value pattern for line/odds (provider, override, effective)
  provider_line NUMERIC,                     -- Line from provider at bet time
  override_line NUMERIC,                     -- Manual adjustment (optional)
  effective_line NUMERIC GENERATED ALWAYS AS (COALESCE(override_line, provider_line)) STORED,

  provider_odds INTEGER,                     -- Odds from provider
  override_odds INTEGER,                     -- Manual adjustment
  effective_odds INTEGER GENERATED ALWAYS AS (COALESCE(override_odds, provider_odds)) STORED,

  -- Source tracking
  offer_id UUID REFERENCES provider_offers(id),  -- Which snapshot was used
  provider TEXT NOT NULL,                    -- 'fanduel', 'draftkings', etc.

  -- Settlement
  leg_status TEXT DEFAULT 'pending',         -- 'pending', 'win', 'loss', 'push', 'void'
  actual_value NUMERIC,                      -- Actual stat value
  settlement_source TEXT,
  settled_at TIMESTAMPTZ,

  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT ticket_legs_unique UNIQUE (ticket_id, leg_index),
  CONSTRAINT ticket_legs_selection_check CHECK (selection IN ('over', 'under', 'home', 'away', 'yes', 'no', 'draw')),
  CONSTRAINT ticket_legs_status_check CHECK (leg_status IN ('pending', 'win', 'loss', 'push', 'void')),
  CONSTRAINT ticket_legs_index_positive CHECK (leg_index >= 0)
);

-- Indexes for ticket_legs
CREATE INDEX IF NOT EXISTS idx_ticket_legs_ticket ON ticket_legs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_legs_event ON ticket_legs(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_legs_market ON ticket_legs(market_id);
CREATE INDEX IF NOT EXISTS idx_ticket_legs_participant ON ticket_legs(participant_id) WHERE participant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ticket_legs_offer ON ticket_legs(offer_id) WHERE offer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ticket_legs_status ON ticket_legs(leg_status);
CREATE INDEX IF NOT EXISTS idx_ticket_legs_provider ON ticket_legs(provider);
CREATE INDEX IF NOT EXISTS idx_ticket_legs_event_market ON ticket_legs(event_id, market_id);

COMMENT ON TABLE ticket_legs IS 'Individual legs of tickets. Enables parlay tracking and CLV. Canonical V3.';

-- ============================================================================
-- 10a. FEATURE_SNAPSHOTS
-- Inputs to scoring model. Full feature tracking for model versioning.
-- ============================================================================
CREATE TABLE IF NOT EXISTS feature_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id UUID NOT NULL REFERENCES ticket_legs(id) ON DELETE CASCADE,
  model_version TEXT NOT NULL,               -- 'v3.2.1'
  model_name TEXT NOT NULL,                  -- 'edge_scorer_v3'
  feature_vector JSONB NOT NULL,             -- All 45+ features
  computed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Denormalized key features for queries
  clv_at_bet NUMERIC,                        -- CLV at bet time
  clv_at_close NUMERIC,                      -- CLV at close
  weather_impact NUMERIC,
  injury_impact NUMERIC,
  rest_impact NUMERIC,
  home_away_impact NUMERIC,
  historical_edge NUMERIC,
  market_efficiency NUMERIC,

  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for feature_snapshots
CREATE INDEX IF NOT EXISTS idx_feature_snapshots_leg ON feature_snapshots(leg_id);
CREATE INDEX IF NOT EXISTS idx_feature_snapshots_model ON feature_snapshots(model_name, model_version);
CREATE INDEX IF NOT EXISTS idx_feature_snapshots_computed ON feature_snapshots(computed_at);
CREATE INDEX IF NOT EXISTS idx_feature_snapshots_clv ON feature_snapshots(clv_at_bet) WHERE clv_at_bet IS NOT NULL;

COMMENT ON TABLE feature_snapshots IS 'Feature inputs for scoring model. Versioned for backtesting. Canonical V3.';

-- ============================================================================
-- 10b. SCORED_LEGS
-- Outputs from scoring model. Enables model comparison and backtesting.
-- ============================================================================
CREATE TABLE IF NOT EXISTS scored_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id UUID NOT NULL REFERENCES ticket_legs(id) ON DELETE CASCADE,
  feature_snapshot_id UUID REFERENCES feature_snapshots(id),
  model_version TEXT NOT NULL,
  model_name TEXT NOT NULL,

  -- Scoring outputs
  edge_score NUMERIC,                        -- Raw edge score
  confidence_score NUMERIC,                  -- 0-1 confidence
  tier TEXT,                                 -- 'S', 'A', 'B', 'C', 'F'
  promotion_band TEXT,                       -- 'HARD', 'SOFT', 'NO_POST'
  kelly_fraction NUMERIC,                    -- Optimal bet sizing
  expected_value NUMERIC,                    -- EV in dollars

  -- Feature contributions (for explainability)
  feature_contributions JSONB,               -- Which features drove the score

  computed_at TIMESTAMPTZ DEFAULT NOW(),
  is_latest BOOLEAN DEFAULT TRUE,            -- Most recent scoring for this leg

  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT scored_legs_unique UNIQUE (leg_id, model_version, computed_at),
  CONSTRAINT scored_legs_tier_check CHECK (tier IS NULL OR tier IN ('S', 'A', 'B', 'C', 'F')),
  CONSTRAINT scored_legs_band_check CHECK (promotion_band IS NULL OR promotion_band IN ('HARD', 'SOFT', 'NO_POST')),
  CONSTRAINT scored_legs_confidence_check CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1))
);

-- Indexes for scored_legs
CREATE INDEX IF NOT EXISTS idx_scored_legs_leg ON scored_legs(leg_id);
CREATE INDEX IF NOT EXISTS idx_scored_legs_model ON scored_legs(model_name, model_version);
CREATE INDEX IF NOT EXISTS idx_scored_legs_tier ON scored_legs(tier) WHERE tier IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scored_legs_latest ON scored_legs(is_latest) WHERE is_latest = TRUE;
CREATE INDEX IF NOT EXISTS idx_scored_legs_feature ON scored_legs(feature_snapshot_id) WHERE feature_snapshot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scored_legs_computed ON scored_legs(computed_at);

COMMENT ON TABLE scored_legs IS 'Scoring outputs for ticket legs. Versioned for model comparison. Canonical V3.';

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- Automatically update updated_at timestamp on row changes.
-- ============================================================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_participants_updated_at
  BEFORE UPDATE ON participants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_markets_updated_at
  BEFORE UPDATE ON markets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- END OF MIGRATION
-- Sprint: SPRINT-CANONICAL-V3-FOUNDATION-071
-- Tables Created: 11 (participants, participant_memberships, events,
--                     event_participants, event_segments, markets,
--                     provider_offers, tickets, ticket_legs,
--                     feature_snapshots, scored_legs)
-- Indexes Created: 50+
-- ============================================================================
