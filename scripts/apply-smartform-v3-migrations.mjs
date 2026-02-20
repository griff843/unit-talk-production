#!/usr/bin/env node
/**
 * Apply Smart Form V3 Migrations
 * SPRINT-SMARTFORM-UX-REBUILD-080D-OPERATIONALIZE
 *
 * This script applies all necessary migrations and creates views
 * for the V3 Ticket Builder to function.
 *
 * Usage: node scripts/apply-smartform-v3-migrations.mjs
 *
 * Requires: DATABASE_URL or SUPABASE_DB_URL_POOLER in environment
 */

import pg from 'pg';
import { config } from 'dotenv';

// Load .env file
config();

// Prefer pooler URL for connection stability
const databaseUrl = process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Missing DATABASE_URL or SUPABASE_DB_URL_POOLER');
  process.exit(1);
}

console.log('🚀 Smart Form V3 Migration Script');
console.log('================================\n');

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

// SQL to create missing tables
const CREATE_TABLES_SQL = `
-- Create leagues table if not exists
CREATE TABLE IF NOT EXISTS leagues (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  sport_id INTEGER REFERENCES sports_registry(id),
  country TEXT,
  level TEXT DEFAULT 'professional',
  has_playoffs BOOLEAN DEFAULT TRUE,
  playoff_format TEXT,
  meta JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed leagues
INSERT INTO leagues (code, display_name, sport_id, country, level, has_playoffs, playoff_format)
SELECT code, display_name, sport_id, country, level, has_playoffs, playoff_format
FROM (VALUES
  ('NBA', 'NBA', (SELECT id FROM sports_registry WHERE code = 'NBA'), 'USA', 'professional', TRUE, 'series'),
  ('NFL', 'NFL', (SELECT id FROM sports_registry WHERE code = 'NFL'), 'USA', 'professional', TRUE, 'single_elim'),
  ('MLB', 'MLB', (SELECT id FROM sports_registry WHERE code = 'MLB'), 'USA', 'professional', TRUE, 'series'),
  ('NHL', 'NHL', (SELECT id FROM sports_registry WHERE code = 'NHL'), 'USA', 'professional', TRUE, 'series'),
  ('WNBA', 'WNBA', (SELECT id FROM sports_registry WHERE code = 'WNBA'), 'USA', 'professional', TRUE, 'series'),
  ('NCAAB', 'NCAA Basketball', (SELECT id FROM sports_registry WHERE code = 'NCAAB'), 'USA', 'college', TRUE, 'single_elim'),
  ('NCAAF', 'NCAA Football', (SELECT id FROM sports_registry WHERE code = 'NCAAF'), 'USA', 'college', TRUE, 'single_elim'),
  ('UFC', 'UFC', (SELECT id FROM sports_registry WHERE code = 'UFC'), 'USA', 'professional', FALSE, NULL),
  ('PGA', 'PGA Tour', (SELECT id FROM sports_registry WHERE code = 'PGA'), 'USA', 'professional', FALSE, NULL)
) AS v(code, display_name, sport_id, country, level, has_playoffs, playoff_format)
ON CONFLICT (code) DO NOTHING;

-- Create participant_memberships table if not exists
CREATE TABLE IF NOT EXISTS participant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to DATE,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT membership_date_check CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT membership_not_self CHECK (participant_id <> team_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_participant ON participant_memberships(participant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_team ON participant_memberships(team_id);
CREATE INDEX IF NOT EXISTS idx_memberships_dates ON participant_memberships(valid_from, valid_to);
`;

// SQL to create V3 views
const CREATE_VIEWS_SQL = `
-- view_sports_active: Active sports with segment info
CREATE OR REPLACE VIEW view_sports_active AS
SELECT
  sr.id,
  sr.code,
  sr.display_name,
  sr.has_segments,
  sr.default_segment_type,
  sr.supports_live,
  sr.supports_player_props,
  st.display_name AS segment_display,
  st.max_segments,
  sr.meta
FROM sports_registry sr
LEFT JOIN segment_types st ON st.code = sr.default_segment_type
WHERE sr.active = TRUE
ORDER BY sr.display_name;

-- view_providers_active: Active providers by priority
CREATE OR REPLACE VIEW view_providers_active AS
SELECT
  pr.id,
  pr.code,
  pr.display_name,
  pr.api_source,
  pr.priority,
  pr.has_player_props,
  pr.has_live_odds,
  pr.meta
FROM provider_registry pr
WHERE pr.active = TRUE
ORDER BY pr.priority ASC;

-- view_events_for_form: Upcoming events for Smart Form
CREATE OR REPLACE VIEW view_events_for_form AS
SELECT
  e.id,
  e.external_id,
  e.sport,
  e.league,
  e.event_type,
  e.scheduled_at,
  e.status,
  hp.id AS home_participant_id,
  hp.name AS home_team,
  hp.display_name AS home_display,
  ap.id AS away_participant_id,
  ap.name AS away_team,
  ap.display_name AS away_display,
  e.venue,
  e.meta,
  e.created_at
FROM canonical_events e
LEFT JOIN participants hp ON hp.id = e.home_participant_id
LEFT JOIN participants ap ON ap.id = e.away_participant_id
WHERE e.status IN ('scheduled', 'live')
  AND e.scheduled_at > NOW() - INTERVAL '2 hours';

-- view_participants_for_event: Players for event teams
CREATE OR REPLACE VIEW view_participants_for_event AS
SELECT
  e.id AS event_id,
  e.sport,
  p.id AS participant_id,
  p.name,
  p.display_name,
  p.type AS participant_type,
  pm.role,
  pm.team_id,
  t.name AS team_name,
  CASE
    WHEN pm.team_id = e.home_participant_id THEN 'home'
    WHEN pm.team_id = e.away_participant_id THEN 'away'
    ELSE 'neutral'
  END AS side,
  p.meta AS participant_meta
FROM canonical_events e
JOIN participant_memberships pm
  ON pm.team_id IN (e.home_participant_id, e.away_participant_id)
  AND (pm.valid_to IS NULL OR pm.valid_to >= CURRENT_DATE)
  AND pm.valid_from <= CURRENT_DATE
JOIN participants p ON p.id = pm.participant_id AND p.active = TRUE
JOIN participants t ON t.id = pm.team_id
WHERE e.status IN ('scheduled', 'live');

-- view_market_types_for_sport: Active market types
CREATE OR REPLACE VIEW view_market_types_for_sport AS
SELECT
  mt.id AS market_type_id,
  mt.market_key,
  mt.display_name,
  sr.code AS sport,
  l.code AS league,
  mg.code AS market_group,
  mg.display_name AS market_group_name,
  pmg.code AS parent_group,
  ot.code AS outcome_type,
  mt.participant_scope,
  mt.requires_participant,
  mt.requires_line,
  mt.supports_alt_lines,
  mt.supports_live,
  st.code AS segment_type,
  mt.is_future,
  mt.is_derivative
FROM market_types mt
LEFT JOIN sports_registry sr ON sr.id = mt.sport_id
LEFT JOIN leagues l ON l.id = mt.league_id
LEFT JOIN market_groups mg ON mg.id = mt.market_group_id
LEFT JOIN market_groups pmg ON pmg.id = mg.parent_group_id
LEFT JOIN outcome_types ot ON ot.id = mt.outcome_type_id
LEFT JOIN segment_types st ON st.id = mt.segment_type_id
WHERE mt.active = TRUE
ORDER BY mg.sort_order NULLS LAST, mt.display_name;

-- view_market_groups_hierarchy: Market groups with hierarchy
CREATE OR REPLACE VIEW view_market_groups_hierarchy AS
SELECT
  mg.id,
  mg.code,
  mg.display_name,
  mg.parent_group_id,
  pmg.code AS parent_code,
  pmg.display_name AS parent_name,
  mg.sort_order,
  (SELECT COUNT(*) FROM market_types mt WHERE mt.market_group_id = mg.id AND mt.active = TRUE) AS market_count
FROM market_groups mg
LEFT JOIN market_groups pmg ON pmg.id = mg.parent_group_id
WHERE mg.active = TRUE
ORDER BY COALESCE(pmg.sort_order, mg.sort_order), mg.sort_order;
`;

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Step 1: Check prerequisites
    console.log('📋 Step 1: Checking prerequisites...');
    const prereqCheck = await client.query(`
      SELECT
        EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'sports_registry') as sports_registry,
        EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'provider_registry') as provider_registry,
        EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'canonical_events') as canonical_events,
        EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'market_types') as market_types
    `);

    const prereqs = prereqCheck.rows[0];
    console.log('  - sports_registry:', prereqs.sports_registry ? '✅' : '❌');
    console.log('  - provider_registry:', prereqs.provider_registry ? '✅' : '❌');
    console.log('  - canonical_events:', prereqs.canonical_events ? '✅' : '❌');
    console.log('  - market_types:', prereqs.market_types ? '✅' : '❌');

    if (!prereqs.sports_registry || !prereqs.provider_registry) {
      console.error('\n❌ Missing prerequisite tables. Run V3 foundation migrations first.');
      process.exit(1);
    }
    console.log('');

    // Step 2: Create missing tables
    console.log('📋 Step 2: Creating missing tables...');
    await client.query(CREATE_TABLES_SQL);
    console.log('  ✅ Tables created/verified\n');

    // Step 3: Create views
    console.log('📋 Step 3: Creating Smart Form views...');
    await client.query(CREATE_VIEWS_SQL);
    console.log('  ✅ Views created\n');

    // Step 4: Verify
    console.log('📋 Step 4: Verifying...');

    const sportsCount = await client.query('SELECT COUNT(*) as count FROM view_sports_active');
    console.log('  - view_sports_active:', sportsCount.rows[0].count, 'sports');

    const providersCount = await client.query('SELECT COUNT(*) as count FROM view_providers_active');
    console.log('  - view_providers_active:', providersCount.rows[0].count, 'providers');

    const marketsCount = await client.query('SELECT COUNT(*) as count FROM view_market_types_for_sport');
    console.log('  - view_market_types_for_sport:', marketsCount.rows[0].count, 'market types');

    const eventsCount = await client.query('SELECT COUNT(*) as count FROM view_events_for_form');
    console.log('  - view_events_for_form:', eventsCount.rows[0].count, 'events');

    console.log('\n✅ Smart Form V3 migrations applied successfully!');
    console.log('\n📋 To start Smart Form:');
    console.log('   pnpm --filter unit-talk-smart-form dev -p 3021');
    console.log('\n📋 Then navigate to:');
    console.log('   http://localhost:3021/submit-ticket');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
