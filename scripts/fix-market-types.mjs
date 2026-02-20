#!/usr/bin/env node
import pg from 'pg';
import { config } from 'dotenv';

config();

const databaseUrl = process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL;

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected');

  // Create market_types without the problematic constraint syntax
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS market_types (
        id SERIAL PRIMARY KEY,
        market_key TEXT NOT NULL,
        display_name TEXT NOT NULL,
        sport_id INTEGER REFERENCES sports_registry(id),
        league_id INTEGER,
        market_group_id INTEGER REFERENCES market_groups(id),
        outcome_type_id INTEGER REFERENCES outcome_types(id),
        participant_scope TEXT NOT NULL DEFAULT 'NONE',
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
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Created market_types table');
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log('⚠️ market_types already exists');
    } else {
      throw e;
    }
  }

  // Add unique index with COALESCE
  try {
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS market_types_unique_idx
      ON market_types (COALESCE(sport_id, 0), COALESCE(league_id, 0), market_key);
    `);
    console.log('✅ Created market_types unique index');
  } catch (e) {
    console.log('⚠️ Index:', e.message.substring(0, 100));
  }

  // Create provider_market_map
  try {
    await client.query(`
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
    `);
    console.log('✅ Created provider_market_map table');
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log('⚠️ provider_market_map already exists');
    } else {
      throw e;
    }
  }

  // Seed market types
  await client.query(`
    INSERT INTO market_types (market_key, display_name, sport_id, market_group_id, outcome_type_id, participant_scope, requires_participant, requires_line)
    SELECT 'team_moneyline', 'Moneyline', NULL, mg.id, ot.id, 'EVENT', FALSE, FALSE
    FROM market_groups mg, outcome_types ot
    WHERE mg.code = 'game_lines' AND ot.code = 'moneyline_2way'
    ON CONFLICT DO NOTHING;
  `);
  console.log('✅ Seeded team_moneyline');

  await client.query(`
    INSERT INTO market_types (market_key, display_name, sport_id, market_group_id, outcome_type_id, participant_scope, requires_participant, requires_line)
    SELECT 'player_points_ou', 'Player Points', s.id, mg.id, ot.id, 'PLAYER', TRUE, TRUE
    FROM sports_registry s, market_groups mg, outcome_types ot
    WHERE s.code = 'NBA' AND mg.code = 'player_props' AND ot.code = 'over_under'
    ON CONFLICT DO NOTHING;
  `);
  console.log('✅ Seeded player_points_ou (NBA)');

  // Add indexes
  await client.query(`CREATE INDEX IF NOT EXISTS idx_market_types_sport ON market_types(sport_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_market_types_active ON market_types(active) WHERE active = TRUE`);
  console.log('✅ Created indexes');

  await client.end();
  console.log('Done');
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
