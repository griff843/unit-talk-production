#!/usr/bin/env npx tsx
/**
 * E2E Test Data Seeder
 *
 * Seeds minimal test data for E2E validation.
 * This script is SAFE to run multiple times (idempotent via ON CONFLICT DO NOTHING).
 *
 * IMPORTANT: This script is BLOCKED from running in production.
 *
 * Usage:
 *   npx tsx scripts/seed/seed_e2e_data.ts
 *
 * Environment Variables:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 *   NODE_ENV - Must NOT be 'production'
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// PRODUCTION GUARD - This script MUST NOT run in production
// ============================================================================
const NODE_ENV = process.env.NODE_ENV || 'development';
const SUPABASE_URL = process.env.SUPABASE_URL || '';

if (NODE_ENV === 'production') {
  console.error('ERROR: This seed script is BLOCKED from running in production.');
  console.error('NODE_ENV is set to "production". Aborting.');
  process.exit(1);
}

// Additional safety check - block if URL contains "prod" (case insensitive)
if (SUPABASE_URL.toLowerCase().includes('prod')) {
  console.error('ERROR: Supabase URL appears to be a production instance.');
  console.error(`URL contains "prod": ${SUPABASE_URL}`);
  console.error('Aborting to prevent production data pollution.');
  process.exit(1);
}

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================================
// Deterministic IDs for E2E test data (ensures idempotency)
// ============================================================================
const E2E_USER_IDS = {
  griff843: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  e2e_test_capper: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  automation_bot: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
};

const E2E_GAME_IDS = {
  nba: '11111111-1111-1111-1111-111111111111',
  nfl: '22222222-2222-2222-2222-222222222222',
  mlb: '33333333-3333-3333-3333-333333333333',
};

// ============================================================================
// Seed Functions
// ============================================================================

async function seedUsers(): Promise<{ success: boolean; count: number }> {
  console.log('Seeding E2E test users...');

  const users = [
    {
      id: E2E_USER_IDS.griff843,
      username: 'griff843',
      email: 'griff@unittalk.com',
      discord_id: '123456789012345678',
      tier: 'vip',
      status: 'active',
    },
    {
      id: E2E_USER_IDS.e2e_test_capper,
      username: 'e2e_test_capper',
      email: 'e2e@test.com',
      discord_id: '987654321098765432',
      tier: 'premium',
      status: 'active',
    },
    {
      id: E2E_USER_IDS.automation_bot,
      username: 'automation_bot',
      email: 'bot@test.com',
      discord_id: '111222333444555666',
      tier: 'admin',
      status: 'active',
    },
  ];

  let insertedCount = 0;

  for (const user of users) {
    const { data, error } = await supabase
      .from('users')
      .upsert(user, { onConflict: 'id', ignoreDuplicates: true })
      .select();

    if (error) {
      console.error(`  Error seeding user ${user.username}: ${error.message}`);
    } else {
      console.log(`  [OK] User: ${user.username}`);
      insertedCount++;
    }
  }

  return { success: insertedCount === users.length, count: insertedCount };
}

async function seedGames(): Promise<{ success: boolean; count: number }> {
  console.log('Seeding E2E test games...');

  // Use relative dates for game scheduling
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const games = [
    {
      id: E2E_GAME_IDS.nba,
      external_game_id: 'e2e_nba_game_1',
      league: 'NBA',
      sport: 'NBA',
      home_team: 'LOS_ANGELES_LAKERS_NBA',
      away_team: 'BOSTON_CELTICS_NBA',
      game_date: todayStr,
      status: 'scheduled',
    },
    {
      id: E2E_GAME_IDS.nfl,
      external_game_id: 'e2e_nfl_game_1',
      league: 'NFL',
      sport: 'NFL',
      home_team: 'KANSAS_CITY_CHIEFS_NFL',
      away_team: 'BUFFALO_BILLS_NFL',
      game_date: todayStr,
      status: 'scheduled',
    },
    {
      id: E2E_GAME_IDS.mlb,
      external_game_id: 'e2e_mlb_game_1',
      league: 'MLB',
      sport: 'MLB',
      home_team: 'NEW_YORK_YANKEES_MLB',
      away_team: 'LOS_ANGELES_DODGERS_MLB',
      game_date: todayStr,
      status: 'scheduled',
    },
  ];

  let insertedCount = 0;

  for (const game of games) {
    const { data, error } = await supabase
      .from('games')
      .upsert(game, { onConflict: 'id', ignoreDuplicates: true })
      .select();

    if (error) {
      console.error(`  Error seeding game ${game.external_game_id}: ${error.message}`);
    } else {
      console.log(`  [OK] Game: ${game.league} - ${game.home_team} vs ${game.away_team}`);
      insertedCount++;
    }
  }

  return { success: insertedCount === games.length, count: insertedCount };
}

async function verifyTables(): Promise<boolean> {
  console.log('Verifying canonical tables exist...');

  const tables = ['users', 'games', 'unified_picks', 'smart_tickets', 'bridge_outbox', 'pick_publish'];

  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.error(`  [FAIL] Table ${table}: ${error.message}`);
      return false;
    }
    console.log(`  [OK] Table: ${table}`);
  }

  return true;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('E2E Test Data Seeder');
  console.log('='.repeat(60));
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Supabase URL: ${SUPABASE_URL.replace(/\/\/.*@/, '//<redacted>@')}`);
  console.log('='.repeat(60));

  // Step 1: Verify tables exist
  const tablesOk = await verifyTables();
  if (!tablesOk) {
    console.error('\nERROR: Required tables do not exist. Run migrations first.');
    process.exit(1);
  }

  console.log('');

  // Step 2: Seed users
  const usersResult = await seedUsers();
  console.log('');

  // Step 3: Seed games
  const gamesResult = await seedGames();
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Users seeded: ${usersResult.count}`);
  console.log(`Games seeded: ${gamesResult.count}`);

  if (usersResult.success && gamesResult.success) {
    console.log('\nStatus: E2E test data seeded successfully');
    process.exit(0);
  } else {
    console.log('\nStatus: Some seed operations failed');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
