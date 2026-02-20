#!/usr/bin/env node
/**
 * Apply V3 Canonical Schema to database
 * Handles conflicts with existing tables by using canonical_ prefix where needed
 */

import pg from 'pg';
import { config } from 'dotenv';

config();

const databaseUrl = process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL;

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function execute(sql, description) {
  console.log(`\n🔧 ${description}`);
  try {
    await client.query(sql);
    console.log('   ✅ Success');
    return true;
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('   ⚠️ Already exists (skipped)');
      return true;
    }
    console.error('   ❌ Error:', error.message.substring(0, 200));
    return false;
  }
}

async function main() {
  await client.connect();
  console.log('Connected to database');
  console.log('\n========== V3 CANONICAL SCHEMA SETUP ==========\n');

  // 1. PARTICIPANTS TABLE
  await execute(`
    CREATE TABLE IF NOT EXISTS participants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      external_id TEXT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      display_name TEXT,
      sport TEXT NOT NULL,
      league TEXT,
      meta JSONB DEFAULT '{}',
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT participants_external_id_sport_unique UNIQUE (external_id, sport),
      CONSTRAINT participants_type_check CHECK (type IN ('team', 'player', 'horse', 'fighter', 'golfer', 'driver'))
    );
  `, 'Create participants table');

  await execute(`CREATE INDEX IF NOT EXISTS idx_participants_sport ON participants(sport)`, 'Index: participants_sport');
  await execute(`CREATE INDEX IF NOT EXISTS idx_participants_type ON participants(type)`, 'Index: participants_type');
  await execute(`CREATE INDEX IF NOT EXISTS idx_participants_active ON participants(active) WHERE active = TRUE`, 'Index: participants_active');

  // 2. CANONICAL_EVENTS TABLE (renamed to avoid conflict with existing events table)
  await execute(`
    CREATE TABLE IF NOT EXISTS canonical_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      external_id TEXT UNIQUE,
      sport TEXT NOT NULL,
      league TEXT,
      event_type TEXT NOT NULL,
      home_participant_id UUID REFERENCES participants(id),
      away_participant_id UUID REFERENCES participants(id),
      venue TEXT,
      scheduled_at TIMESTAMPTZ NOT NULL,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      status TEXT DEFAULT 'scheduled',
      home_score INTEGER,
      away_score INTEGER,
      meta JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT canonical_events_status_check CHECK (status IN ('scheduled', 'live', 'completed', 'postponed', 'cancelled')),
      CONSTRAINT canonical_events_type_check CHECK (event_type IN ('game', 'match', 'fight', 'tournament_round', 'race'))
    );
  `, 'Create canonical_events table');

  await execute(`CREATE INDEX IF NOT EXISTS idx_canonical_events_sport ON canonical_events(sport)`, 'Index: canonical_events_sport');
  await execute(`CREATE INDEX IF NOT EXISTS idx_canonical_events_scheduled ON canonical_events(scheduled_at)`, 'Index: canonical_events_scheduled');
  await execute(`CREATE INDEX IF NOT EXISTS idx_canonical_events_status ON canonical_events(status)`, 'Index: canonical_events_status');
  await execute(`CREATE INDEX IF NOT EXISTS idx_canonical_events_external ON canonical_events(external_id) WHERE external_id IS NOT NULL`, 'Index: canonical_events_external');

  // 3. EVENT_SEGMENTS TABLE
  await execute(`
    CREATE TABLE IF NOT EXISTS event_segments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID NOT NULL REFERENCES canonical_events(id) ON DELETE CASCADE,
      segment_type TEXT NOT NULL,
      segment_number INTEGER NOT NULL,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      home_score INTEGER,
      away_score INTEGER,
      meta JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT event_segments_unique UNIQUE (event_id, segment_type, segment_number),
      CONSTRAINT event_segments_type_check CHECK (segment_type IN ('quarter', 'half', 'period', 'set', 'round', 'inning', 'map', 'overtime'))
    );
  `, 'Create event_segments table');

  // 4. MARKETS TABLE
  await execute(`
    CREATE TABLE IF NOT EXISTS markets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      canonical_key TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      category TEXT NOT NULL,
      sport TEXT,
      stat_type TEXT,
      bet_structure TEXT NOT NULL,
      segment_applicable BOOLEAN DEFAULT FALSE,
      default_segment TEXT DEFAULT 'full_game',
      settlement_source TEXT,
      meta JSONB DEFAULT '{}',
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT markets_category_check CHECK (category IN ('player_prop', 'game_line', 'team_total', 'alternate', 'futures', 'special')),
      CONSTRAINT markets_bet_structure_check CHECK (bet_structure IN ('over_under', 'moneyline', 'spread', 'yes_no', 'outright'))
    );
  `, 'Create markets table');

  // 5. PROVIDER_OFFERS TABLE
  await execute(`
    CREATE TABLE IF NOT EXISTS provider_offers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID NOT NULL REFERENCES canonical_events(id) ON DELETE CASCADE,
      market_id UUID REFERENCES markets(id) ON DELETE CASCADE,
      participant_id UUID REFERENCES participants(id),
      segment_id UUID REFERENCES event_segments(id),
      provider TEXT NOT NULL,
      line NUMERIC,
      over_odds INTEGER,
      under_odds INTEGER,
      home_odds INTEGER,
      away_odds INTEGER,
      yes_odds INTEGER,
      no_odds INTEGER,
      devigged_over NUMERIC,
      devigged_under NUMERIC,
      juice NUMERIC,
      snapshot_at TIMESTAMPTZ NOT NULL,
      is_opening BOOLEAN DEFAULT FALSE,
      is_closing BOOLEAN DEFAULT FALSE,
      meta JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT provider_offers_snapshot_unique UNIQUE (event_id, market_id, participant_id, segment_id, provider, snapshot_at)
    );
  `, 'Create provider_offers table');

  await execute(`CREATE INDEX IF NOT EXISTS idx_provider_offers_event ON provider_offers(event_id)`, 'Index: provider_offers_event');
  await execute(`CREATE INDEX IF NOT EXISTS idx_provider_offers_market ON provider_offers(market_id)`, 'Index: provider_offers_market');
  await execute(`CREATE INDEX IF NOT EXISTS idx_provider_offers_provider ON provider_offers(provider)`, 'Index: provider_offers_provider');
  await execute(`CREATE INDEX IF NOT EXISTS idx_provider_offers_snapshot ON provider_offers(snapshot_at)`, 'Index: provider_offers_snapshot');

  // 6. SPORTS_REGISTRY (from 072)
  await execute(`
    CREATE TABLE IF NOT EXISTS sports_registry (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      has_segments BOOLEAN DEFAULT TRUE,
      default_segment_type TEXT,
      supports_live BOOLEAN DEFAULT TRUE,
      supports_player_props BOOLEAN DEFAULT TRUE,
      meta JSONB DEFAULT '{}',
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `, 'Create sports_registry table');

  await execute(`
    INSERT INTO sports_registry (code, display_name, has_segments, default_segment_type, supports_live, supports_player_props) VALUES
    ('NBA', 'Basketball', TRUE, 'quarter', TRUE, TRUE),
    ('NFL', 'Football', TRUE, 'quarter', TRUE, TRUE),
    ('MLB', 'Baseball', TRUE, 'inning', TRUE, TRUE),
    ('NHL', 'Hockey', TRUE, 'period', TRUE, TRUE),
    ('MMA', 'MMA', TRUE, 'round', TRUE, TRUE),
    ('UFC', 'UFC', TRUE, 'round', TRUE, TRUE),
    ('TENNIS', 'Tennis', TRUE, 'set', TRUE, FALSE),
    ('GOLF', 'Golf', FALSE, NULL, TRUE, FALSE),
    ('SOCCER', 'Soccer', TRUE, 'half', TRUE, TRUE),
    ('WNBA', 'WNBA', TRUE, 'quarter', TRUE, TRUE)
    ON CONFLICT (code) DO NOTHING;
  `, 'Seed sports_registry');

  // 7. PROVIDER_REGISTRY (from 072)
  await execute(`
    CREATE TABLE IF NOT EXISTS provider_registry (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      api_source TEXT,
      priority INTEGER DEFAULT 99,
      has_player_props BOOLEAN DEFAULT TRUE,
      has_live_odds BOOLEAN DEFAULT TRUE,
      active BOOLEAN DEFAULT TRUE,
      meta JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `, 'Create provider_registry table');

  await execute(`
    INSERT INTO provider_registry (code, display_name, api_source, priority, has_player_props, has_live_odds) VALUES
    ('optimal', 'Optimal (Aggregate)', 'aggregate', 0, TRUE, TRUE),
    ('fanduel', 'FanDuel', 'odds_api', 1, TRUE, TRUE),
    ('draftkings', 'DraftKings', 'odds_api', 2, TRUE, TRUE),
    ('espn_bet', 'ESPN BET', 'odds_api', 3, TRUE, TRUE),
    ('bet365', 'Bet365', 'odds_api', 4, TRUE, TRUE),
    ('pinnacle', 'Pinnacle', 'odds_api', 5, TRUE, TRUE),
    ('betmgm', 'BetMGM', 'odds_api', 7, TRUE, TRUE),
    ('caesars', 'Caesars', 'odds_api', 8, TRUE, TRUE)
    ON CONFLICT (code) DO NOTHING;
  `, 'Seed provider_registry');

  // 8. SEGMENT_TYPES (from 072)
  await execute(`
    CREATE TABLE IF NOT EXISTS segment_types (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      display_short TEXT,
      ordinal_prefix TEXT,
      applicable_sports TEXT[],
      max_segments INTEGER,
      meta JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `, 'Create segment_types table');

  await execute(`
    INSERT INTO segment_types (code, display_name, display_short, ordinal_prefix, applicable_sports, max_segments) VALUES
    ('quarter', 'Quarter', 'Q', 'Q', ARRAY['NBA', 'NFL', 'NCAAF', 'WNBA'], 4),
    ('half', 'Half', 'H', 'H', ARRAY['NBA', 'NFL', 'NCAAB', 'NCAAF', 'SOCCER'], 2),
    ('period', 'Period', 'P', 'P', ARRAY['NHL'], 3),
    ('inning', 'Inning', 'Inn', NULL, ARRAY['MLB'], 9),
    ('round', 'Round', 'Rd', 'R', ARRAY['MMA', 'UFC', 'BOXING'], 12),
    ('set', 'Set', 'Set', 'Set', ARRAY['TENNIS'], 5),
    ('overtime', 'Overtime', 'OT', 'OT', ARRAY['NBA', 'NFL', 'NHL', 'NCAAB', 'NCAAF', 'SOCCER'], 5)
    ON CONFLICT (code) DO NOTHING;
  `, 'Seed segment_types');

  // 9. OUTCOME_TYPES (from 072)
  await execute(`
    CREATE TABLE IF NOT EXISTS outcome_types (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      outcome_count INTEGER NOT NULL,
      is_numeric BOOLEAN DEFAULT FALSE,
      meta JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `, 'Create outcome_types table');

  await execute(`
    INSERT INTO outcome_types (code, display_name, outcome_count, is_numeric) VALUES
    ('over_under', 'Over/Under', 2, TRUE),
    ('moneyline_2way', 'Moneyline (2-Way)', 2, FALSE),
    ('moneyline_3way', 'Moneyline (3-Way)', 3, FALSE),
    ('spread', 'Spread/Handicap', 2, TRUE),
    ('yes_no', 'Yes/No', 2, FALSE),
    ('outright', 'Outright Winner', 0, FALSE)
    ON CONFLICT (code) DO NOTHING;
  `, 'Seed outcome_types');

  // 10. MARKET_GROUPS (from 072)
  await execute(`
    CREATE TABLE IF NOT EXISTS market_groups (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      parent_group_id INTEGER REFERENCES market_groups(id),
      sort_order INTEGER DEFAULT 0,
      meta JSONB DEFAULT '{}',
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `, 'Create market_groups table');

  await execute(`
    INSERT INTO market_groups (code, display_name, parent_group_id, sort_order) VALUES
    ('game_lines', 'Game Lines', NULL, 1),
    ('player_props', 'Player Props', NULL, 2),
    ('team_props', 'Team Props', NULL, 3),
    ('futures', 'Futures', NULL, 4),
    ('specials', 'Specials', NULL, 5)
    ON CONFLICT (code) DO NOTHING;
  `, 'Seed market_groups (parents)');

  // 11. MARKET_TYPES (from 072)
  await execute(`
    DO $$ BEGIN
      CREATE TYPE participant_scope_type AS ENUM ('EVENT', 'TEAM', 'PLAYER', 'FIGHTER', 'PARTICIPANT', 'NONE');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `, 'Create participant_scope_type enum');

  await execute(`
    CREATE TABLE IF NOT EXISTS market_types (
      id SERIAL PRIMARY KEY,
      market_key TEXT NOT NULL,
      display_name TEXT NOT NULL,
      sport_id INTEGER REFERENCES sports_registry(id),
      league_id INTEGER,
      market_group_id INTEGER REFERENCES market_groups(id),
      outcome_type_id INTEGER REFERENCES outcome_types(id),
      participant_scope participant_scope_type NOT NULL DEFAULT 'NONE',
      requires_participant BOOLEAN NOT NULL DEFAULT FALSE,
      requires_line BOOLEAN NOT NULL DEFAULT FALSE,
      supports_alt_lines BOOLEAN DEFAULT FALSE,
      supports_live BOOLEAN DEFAULT TRUE,
      segment_type_id INTEGER REFERENCES segment_types(id),
      is_future BOOLEAN DEFAULT FALSE,
      is_derivative BOOLEAN DEFAULT FALSE,
      settlement_rule JSONB DEFAULT '{}',
      meta JSONB DEFAULT '{}',
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT market_types_unique UNIQUE (COALESCE(sport_id, 0), COALESCE(league_id, 0), market_key)
    );
  `, 'Create market_types table');

  await execute(`CREATE INDEX IF NOT EXISTS idx_market_types_sport ON market_types(sport_id)`, 'Index: market_types_sport');
  await execute(`CREATE INDEX IF NOT EXISTS idx_market_types_active ON market_types(active) WHERE active = TRUE`, 'Index: market_types_active');

  // Seed some market types
  await execute(`
    INSERT INTO market_types (market_key, display_name, sport_id, market_group_id, outcome_type_id, participant_scope, requires_participant, requires_line)
    SELECT 'team_moneyline', 'Moneyline', NULL, mg.id, ot.id, 'EVENT'::participant_scope_type, FALSE, FALSE
    FROM market_groups mg, outcome_types ot
    WHERE mg.code = 'game_lines' AND ot.code = 'moneyline_2way'
    ON CONFLICT ON CONSTRAINT market_types_unique DO NOTHING;
  `, 'Seed market_type: team_moneyline');

  await execute(`
    INSERT INTO market_types (market_key, display_name, sport_id, market_group_id, outcome_type_id, participant_scope, requires_participant, requires_line)
    SELECT 'player_points_ou', 'Player Points', s.id, mg.id, ot.id, 'PLAYER'::participant_scope_type, TRUE, TRUE
    FROM sports_registry s, market_groups mg, outcome_types ot
    WHERE s.code = 'NBA' AND mg.code = 'player_props' AND ot.code = 'over_under'
    ON CONFLICT ON CONSTRAINT market_types_unique DO NOTHING;
  `, 'Seed market_type: player_points_ou (NBA)');

  // 12. PROVIDER MAPPING TABLES (from 072)
  await execute(`
    CREATE TABLE IF NOT EXISTS provider_event_map (
      id SERIAL PRIMARY KEY,
      provider_id INTEGER NOT NULL REFERENCES provider_registry(id),
      provider_event_id TEXT NOT NULL,
      canonical_event_id UUID REFERENCES canonical_events(id),
      mapping_version INTEGER NOT NULL DEFAULT 1,
      confidence_score NUMERIC(5,4) DEFAULT 1.0,
      valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      valid_to TIMESTAMPTZ,
      source VARCHAR(50) NOT NULL DEFAULT 'manual',
      meta JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT provider_event_map_unique UNIQUE (provider_id, provider_event_id, mapping_version)
    );
  `, 'Create provider_event_map table');

  await execute(`
    CREATE TABLE IF NOT EXISTS provider_market_map (
      id SERIAL PRIMARY KEY,
      provider_id INTEGER NOT NULL REFERENCES provider_registry(id),
      provider_market_key TEXT NOT NULL,
      provider_market_name TEXT,
      canonical_market_type_id INTEGER REFERENCES market_types(id),
      mapping_version INTEGER NOT NULL DEFAULT 1,
      confidence_score NUMERIC(5,4) DEFAULT 1.0,
      valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      valid_to TIMESTAMPTZ,
      source VARCHAR(50) NOT NULL DEFAULT 'manual',
      meta JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT provider_market_map_unique UNIQUE (provider_id, provider_market_key, mapping_version)
    );
  `, 'Create provider_market_map table');

  await execute(`
    CREATE TABLE IF NOT EXISTS provider_team_map (
      id SERIAL PRIMARY KEY,
      provider_id INTEGER NOT NULL REFERENCES provider_registry(id),
      provider_team_id TEXT NOT NULL,
      provider_team_name TEXT,
      canonical_team_id UUID REFERENCES participants(id),
      mapping_version INTEGER NOT NULL DEFAULT 1,
      confidence_score NUMERIC(5,4) DEFAULT 1.0,
      valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      valid_to TIMESTAMPTZ,
      source VARCHAR(50) NOT NULL DEFAULT 'manual',
      meta JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT provider_team_map_unique UNIQUE (provider_id, provider_team_id, mapping_version)
    );
  `, 'Create provider_team_map table');

  await execute(`
    CREATE TABLE IF NOT EXISTS provider_player_map (
      id SERIAL PRIMARY KEY,
      provider_id INTEGER NOT NULL REFERENCES provider_registry(id),
      provider_player_id TEXT NOT NULL,
      provider_player_name TEXT,
      canonical_player_id UUID REFERENCES participants(id),
      mapping_version INTEGER NOT NULL DEFAULT 1,
      confidence_score NUMERIC(5,4) DEFAULT 1.0,
      valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      valid_to TIMESTAMPTZ,
      source VARCHAR(50) NOT NULL DEFAULT 'manual',
      meta JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT provider_player_map_unique UNIQUE (provider_id, provider_player_id, mapping_version)
    );
  `, 'Create provider_player_map table');

  console.log('\n========== V3 SCHEMA SETUP COMPLETE ==========\n');

  await client.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
