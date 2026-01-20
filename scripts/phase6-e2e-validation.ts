#!/usr/bin/env npx tsx
/**
 * Phase 6 E2E Validation - Schema and Pipeline Verification
 *
 * This script verifies:
 * 1. All canonical TABLES exist (users, games, unified_picks, smart_tickets, bridge_outbox, pick_publish)
 * 2. The picks VIEW exists (read-only backward compat)
 * 3. Foreign key relationships are correct
 * 4. Test data is seeded (will auto-seed if --seed flag is passed)
 * 5. E2E pipeline flow works
 *
 * CANONICAL RULES:
 *   - unified_picks is the ONLY writable pick table
 *   - pick_publish is the ONLY Discord publish outbox
 *   - picks is a READ-ONLY VIEW (no writes allowed)
 *
 * Usage:
 *   npx tsx scripts/phase6-e2e-validation.ts [--seed]
 *
 * Options:
 *   --seed  Run seed script before validation (staging/local only)
 *
 * Environment Variables:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SHOULD_SEED = process.argv.includes('--seed');

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

async function checkTableOrViewExists(name: string): Promise<boolean> {
  const { error } = await supabase.from(name).select('id').limit(1);
  return !error;
}

async function runSeedScript(): Promise<boolean> {
  console.log('\n--- Running Seed Script ---\n');

  try {
    const seedScript = path.join(__dirname, 'seed', 'seed_e2e_data.ts');
    console.log(`Executing: npx tsx ${seedScript}`);

    execSync(`npx tsx "${seedScript}"`, {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development',
      },
    });

    log({
      check: 'Seed Script',
      status: 'PASS',
      message: 'E2E test data seeded successfully',
    });
    return true;
  } catch (error) {
    log({
      check: 'Seed Script',
      status: 'FAIL',
      message: `Seed script failed: ${error instanceof Error ? error.message : String(error)}`,
    });
    return false;
  }
}

async function validateCanonicalTables(): Promise<void> {
  console.log('\n--- Canonical Tables Validation ---\n');

  // These are the 6 CANONICAL TABLES (BASE TABLES)
  const canonicalTables = [
    'users',
    'games',
    'unified_picks',
    'smart_tickets',
    'bridge_outbox',
    'pick_publish',
  ];

  for (const table of canonicalTables) {
    const exists = await checkTableOrViewExists(table);
    log({
      check: `Table: ${table}`,
      status: exists ? 'PASS' : 'FAIL',
      message: exists ? 'Table exists and accessible' : 'Table not found or not accessible',
    });
  }
}

async function validatePicksView(): Promise<void> {
  console.log('\n--- Picks View Validation ---\n');

  // Check that picks VIEW exists (read-only backward compat)
  const exists = await checkTableOrViewExists('picks');
  log({
    check: 'View: picks',
    status: exists ? 'PASS' : 'FAIL',
    message: exists
      ? 'Read-only picks view exists (backward compat)'
      : 'Picks view not found',
  });

  if (exists) {
    // Verify it's read-only by attempting an insert (should fail)
    const testId = `view-write-test-${Date.now()}`;
    const { error } = await supabase.from('picks').insert({
      bet_slip_id: testId,
      pick_type: 'test',
      selection: 'test',
      odds: 100,
    });

    if (error) {
      log({
        check: 'View: picks (write protection)',
        status: 'PASS',
        message: 'Picks view correctly blocks writes',
      });
    } else {
      // If insert succeeded, this is BAD - clean up and report
      await supabase.from('unified_picks').delete().eq('bet_slip_id', testId);
      log({
        check: 'View: picks (write protection)',
        status: 'FAIL',
        message: 'WARNING: picks allows writes - should be read-only view',
      });
    }
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
        message: 'Test user not found (run with --seed to create)',
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
        message: 'No test games found (run with --seed to create)',
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
      message: 'Could not find test user griff843 (run with --seed)',
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
      message: 'Could not find NBA test game (run with --seed)',
    });
    return;
  }

  log({
    check: 'E2E: Get test game',
    status: 'PASS',
    message: 'Found NBA game',
  });

  // Step 3: Insert test pick into unified_picks (CANONICAL)
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
      check: 'E2E: Insert pick (unified_picks)',
      status: 'FAIL',
      message: `Could not insert test pick: ${pickError?.message}`,
    });
    return;
  }

  log({
    check: 'E2E: Insert pick (unified_picks)',
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

  // Step 5: Insert pick_publish record (CANONICAL Discord outbox)
  const { error: publishError } = await supabase.from('pick_publish').insert({
    pick_id: pick.id,
    bet_slip_id: betSlipId,
    embed_data: { title: 'Test Pick', description: 'E2E validation pick' },
    status: 'pending',
  });

  if (publishError) {
    log({
      check: 'E2E: Insert publish record (pick_publish)',
      status: 'FAIL',
      message: `Could not insert publish record: ${publishError.message}`,
    });
    return;
  }

  log({
    check: 'E2E: Insert publish record (pick_publish)',
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
  console.log(`Seed Mode: ${SHOULD_SEED ? 'YES' : 'NO'}`);
  console.log('='.repeat(60));

  // Run seed script if requested
  if (SHOULD_SEED) {
    await runSeedScript();
  }

  await validateCanonicalTables();
  await validatePicksView();
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

  console.log('\n--- Canonical Rules Verified ---');
  console.log('  - unified_picks: CANONICAL pick table (writable)');
  console.log('  - pick_publish: CANONICAL Discord publish outbox');
  console.log('  - picks: READ-ONLY view (backward compat)');

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
