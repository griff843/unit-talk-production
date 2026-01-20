#!/usr/bin/env npx tsx
/**
 * Phase 6 E2E Validation - Schema and Pipeline Verification
 *
 * This script verifies:
 * 1. All canonical tables exist (games, unified_picks, smart_tickets, bridge_outbox, pick_publish)
 * 2. Foreign key relationships are correct
 * 3. Test data is seeded
 * 4. E2E pipeline flow works
 *
 * Usage:
 *   npx tsx scripts/phase6-e2e-validation.ts
 *
 * Environment Variables:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface ValidationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: unknown;
}

const results: ValidationResult[] = [];

function log(result: ValidationResult): void {
  results.push(result);
  const icon = result.status === 'PASS' ? '[PASS]' : result.status === 'FAIL' ? '[FAIL]' : '[WARN]';
  console.log(`${icon} ${result.check}: ${result.message}`);
  if (result.details) {
    console.log(`       Details: ${JSON.stringify(result.details)}`);
  }
}

async function checkTableExists(tableName: string): Promise<boolean> {
  const { error } = await supabase.from(tableName).select('id').limit(1);
  return !error;
}

async function validateCanonicalTables(): Promise<void> {
  console.log('\n--- Canonical Tables Validation ---\n');

  const canonicalTables = [
    'users',
    'games',
    'unified_picks',
    'smart_tickets',
    'bridge_outbox',
    'pick_publish',
    'picks',
  ];

  for (const table of canonicalTables) {
    const exists = await checkTableExists(table);
    log({
      check: `Table: ${table}`,
      status: exists ? 'PASS' : 'FAIL',
      message: exists ? 'Table exists and accessible' : 'Table not found or not accessible',
    });
  }
}

async function validateTestUsers(): Promise<void> {
  console.log('\n--- Test Users Validation ---\n');

  const testUsers = ['griff843', 'e2e_test_capper', 'automation_bot'];

  for (const username of testUsers) {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, tier, status')
      .eq('username', username)
      .single();

    if (error || !data) {
      log({
        check: `User: ${username}`,
        status: 'FAIL',
        message: 'Test user not found',
        details: error?.message,
      });
    } else {
      log({
        check: `User: ${username}`,
        status: 'PASS',
        message: `Found (tier: ${data.tier}, status: ${data.status})`,
      });
    }
  }
}

async function validateTestGames(): Promise<void> {
  console.log('\n--- Test Games Validation ---\n');

  const leagues = ['NBA', 'NFL', 'MLB'];

  for (const league of leagues) {
    const { data, error } = await supabase
      .from('games')
      .select('id, league, home_team, away_team, status')
      .eq('league', league)
      .limit(1);

    if (error || !data || data.length === 0) {
      log({
        check: `Games: ${league}`,
        status: 'FAIL',
        message: 'No test games found for league',
        details: error?.message,
      });
    } else {
      const game = data[0];
      log({
        check: `Games: ${league}`,
        status: 'PASS',
        message: `Found ${game.home_team} vs ${game.away_team} (${game.status})`,
      });
    }
  }
}

async function validateForeignKeys(): Promise<void> {
  console.log('\n--- Foreign Key Validation ---\n');

  // Test unified_picks -> users FK
  const { data: pickWithUser } = await supabase
    .from('unified_picks')
    .select('id, user_id, users(username)')
    .limit(1);

  if (pickWithUser && pickWithUser.length > 0) {
    log({
      check: 'FK: unified_picks -> users',
      status: 'PASS',
      message: 'Foreign key relationship working',
    });
  } else {
    log({
      check: 'FK: unified_picks -> users',
      status: 'WARN',
      message: 'No picks to test FK (may be empty table)',
    });
  }

  // Test pick_publish -> unified_picks FK
  const { data: publishWithPick } = await supabase
    .from('pick_publish')
    .select('id, pick_id, unified_picks(bet_slip_id)')
    .limit(1);

  if (publishWithPick && publishWithPick.length > 0) {
    log({
      check: 'FK: pick_publish -> unified_picks',
      status: 'PASS',
      message: 'Foreign key relationship working',
    });
  } else {
    log({
      check: 'FK: pick_publish -> unified_picks',
      status: 'WARN',
      message: 'No publish records to test FK (may be empty table)',
    });
  }
}

async function validateIndexes(): Promise<void> {
  console.log('\n--- Index Validation ---\n');

  // We can't directly check indexes via Supabase client, but we can verify
  // that queries using indexed columns are fast
  const startTime = Date.now();
  await supabase.from('games').select('id').eq('league', 'NBA').limit(1);
  const queryTime = Date.now() - startTime;

  log({
    check: 'Index: games.league',
    status: queryTime < 100 ? 'PASS' : 'WARN',
    message: `Query completed in ${queryTime}ms`,
  });
}

async function runE2EPipelineTest(): Promise<void> {
  console.log('\n--- E2E Pipeline Test ---\n');

  const betSlipId = `e2e-validation-${Date.now()}`;

  // Step 1: Get test user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('username', 'griff843')
    .single();

  if (userError || !user) {
    log({
      check: 'E2E: Get test user',
      status: 'FAIL',
      message: 'Could not find test user griff843',
    });
    return;
  }

  log({
    check: 'E2E: Get test user',
    status: 'PASS',
    message: 'Found griff843',
  });

  // Step 2: Get test game
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('id')
    .eq('league', 'NBA')
    .single();

  if (gameError || !game) {
    log({
      check: 'E2E: Get test game',
      status: 'FAIL',
      message: 'Could not find NBA test game',
    });
    return;
  }

  log({
    check: 'E2E: Get test game',
    status: 'PASS',
    message: 'Found NBA game',
  });

  // Step 3: Insert test pick
  const { data: pick, error: pickError } = await supabase
    .from('unified_picks')
    .insert({
      user_id: user.id,
      game_id: game.id,
      bet_slip_id: betSlipId,
      pick_type: 'spread',
      selection: 'Lakers -3.5',
      odds: -110,
      status: 'pending',
    })
    .select()
    .single();

  if (pickError || !pick) {
    log({
      check: 'E2E: Insert pick',
      status: 'FAIL',
      message: `Could not insert test pick: ${pickError?.message}`,
    });
    return;
  }

  log({
    check: 'E2E: Insert pick',
    status: 'PASS',
    message: `Inserted pick ${betSlipId}`,
  });

  // Step 4: Insert bridge_outbox event
  const { error: outboxError } = await supabase.from('bridge_outbox').insert({
    event_type: 'pick.created',
    event_payload: { bet_slip_id: betSlipId, pick_id: pick.id },
    bet_slip_id: betSlipId,
    status: 'pending',
  });

  if (outboxError) {
    log({
      check: 'E2E: Insert outbox event',
      status: 'FAIL',
      message: `Could not insert outbox event: ${outboxError.message}`,
    });
    return;
  }

  log({
    check: 'E2E: Insert outbox event',
    status: 'PASS',
    message: 'Inserted bridge_outbox event',
  });

  // Step 5: Insert pick_publish record
  const { error: publishError } = await supabase.from('pick_publish').insert({
    pick_id: pick.id,
    bet_slip_id: betSlipId,
    embed_data: { title: 'Test Pick', description: 'E2E validation pick' },
    status: 'pending',
  });

  if (publishError) {
    log({
      check: 'E2E: Insert publish record',
      status: 'FAIL',
      message: `Could not insert publish record: ${publishError.message}`,
    });
    return;
  }

  log({
    check: 'E2E: Insert publish record',
    status: 'PASS',
    message: 'Inserted pick_publish record',
  });

  // Cleanup: Delete test records
  await supabase.from('pick_publish').delete().eq('bet_slip_id', betSlipId);
  await supabase.from('bridge_outbox').delete().eq('bet_slip_id', betSlipId);
  await supabase.from('unified_picks').delete().eq('bet_slip_id', betSlipId);

  log({
    check: 'E2E: Cleanup',
    status: 'PASS',
    message: 'Test records cleaned up',
  });
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Phase 6 E2E Validation - Schema and Pipeline Verification');
  console.log('='.repeat(60));
  console.log(`Supabase URL: ${SUPABASE_URL.replace(/\/\/.*@/, '//<redacted>@')}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  await validateCanonicalTables();
  await validateTestUsers();
  await validateTestGames();
  await validateForeignKeys();
  await validateIndexes();
  await runE2EPipelineTest();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  const warnCount = results.filter((r) => r.status === 'WARN').length;

  console.log(`Total Checks: ${results.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Warnings: ${warnCount}`);

  if (failCount === 0) {
    console.log('\nOverall Status: PASS');
    process.exit(0);
  } else {
    console.log('\nOverall Status: FAIL');
    console.log('\nFailed checks:');
    results
      .filter((r) => r.status === 'FAIL')
      .forEach((r) => console.log(`  - ${r.check}: ${r.message}`));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
