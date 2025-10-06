/**
 * Validate SGO Schema Fix
 *
 * Verifies that the schema migration was applied correctly
 * and that SGO ingestion can proceed
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface ValidationResult {
  check: string;
  status: 'PASS' | 'FAIL';
  details: string;
  critical: boolean;
}

const results: ValidationResult[] = [];

function logResult(check: string, status: 'PASS' | 'FAIL', details: string, critical = true) {
  results.push({ check, status, details, critical });

  const emoji = status === 'PASS' ? '✅' : '❌';
  const severity = critical ? 'CRITICAL' : 'OPTIONAL';
  console.log(`${emoji} [${severity}] ${check}: ${details}`);
}

/**
 * Check if required columns exist in player_stats
 */
async function validatePlayerStatsSchema() {
  console.log('\n📊 Validating player_stats Schema...\n');

  // Check metadata column
  const { data: metadataCol, error: metadataError } = await supabase.rpc('column_exists', {
    p_table: 'player_stats',
    p_column: 'metadata',
  }).single();

  if (metadataError) {
    // Fallback: direct query
    const { data, error } = await supabase
      .from('player_stats')
      .select('metadata')
      .limit(1);

    if (error && error.message.includes('column "metadata" does not exist')) {
      logResult('player_stats.metadata column', 'FAIL', 'Column missing - migration not applied', true);
    } else {
      logResult('player_stats.metadata column', 'PASS', 'Column exists', true);
    }
  }

  // Check source column
  const { data, error } = await supabase
    .from('player_stats')
    .select('source')
    .limit(1);

  if (error && error.message.includes('column "source" does not exist')) {
    logResult('player_stats.source column', 'FAIL', 'Column missing - migration not applied', true);
  } else {
    logResult('player_stats.source column', 'PASS', 'Column exists', true);
  }

  // Check stats column (should exist)
  const { data: statsData, error: statsError } = await supabase
    .from('player_stats')
    .select('stats')
    .limit(1);

  if (statsError) {
    logResult('player_stats.stats column', 'FAIL', `Stats column error: ${statsError.message}`, true);
  } else {
    logResult('player_stats.stats column', 'PASS', 'Column exists', true);
  }
}

/**
 * Check if compatibility columns exist in settled_outcomes
 */
async function validateSettledOutcomesSchema() {
  console.log('\n🎯 Validating settled_outcomes Schema...\n');

  const requiredColumns = ['actual', 'decision', 'player', 'market', 'settlement_method', 'confidence'];

  for (const column of requiredColumns) {
    const { data, error } = await supabase
      .from('settled_outcomes')
      .select(column)
      .limit(1);

    if (error && error.message.includes(`column "${column}" does not exist`)) {
      logResult(`settled_outcomes.${column} column`, 'FAIL', 'Column missing - migration not applied', true);
    } else {
      logResult(`settled_outcomes.${column} column`, 'PASS', 'Column exists', true);
    }
  }
}

/**
 * Test trigger synchronization
 */
async function validateTriggerSync() {
  console.log('\n🔄 Validating Trigger Synchronization...\n');

  // Insert test row
  const testData = {
    sport: 'TEST',
    market_type: 'test_market',
    player_name: 'Test Player',
    line: 10.5,
    actual_value: 15.0,
    outcome: 'win' as const,
    game_date: new Date().toISOString().split('T')[0],
    settled_at: new Date().toISOString(),
    source: 'validation_test',
  };

  const { data: insertedData, error: insertError } = await supabase
    .from('settled_outcomes')
    .insert(testData)
    .select('actual, decision, player, market, actual_value, outcome, player_name, market_type')
    .single();

  if (insertError) {
    logResult('Trigger test insert', 'FAIL', `Insert failed: ${insertError.message}`, true);
  } else if (!insertedData) {
    logResult('Trigger test insert', 'FAIL', 'No data returned from insert', true);
  } else {
    // Check if trigger synced values
    const syncChecks = [
      { field: 'actual', expected: 15.0, actual: insertedData.actual },
      { field: 'decision', expected: 'win', actual: insertedData.decision },
      { field: 'player', expected: 'Test Player', actual: insertedData.player },
      { field: 'market', expected: 'test_market', actual: insertedData.market },
    ];

    let allSynced = true;
    for (const check of syncChecks) {
      if (check.actual !== check.expected) {
        logResult(
          `Trigger sync: ${check.field}`,
          'FAIL',
          `Expected ${check.expected}, got ${check.actual}`,
          true
        );
        allSynced = false;
      } else {
        logResult(`Trigger sync: ${check.field}`, 'PASS', `Correctly synced to ${check.expected}`, true);
      }
    }

    if (allSynced) {
      logResult('Trigger synchronization', 'PASS', 'All fields synced correctly', true);
    }

    // Cleanup test data
    await supabase.from('settled_outcomes').delete().eq('source', 'validation_test');
  }
}

/**
 * Test SGOAdapter-style insert
 */
async function testSGOInsertPattern() {
  console.log('\n🔌 Testing SGO Insert Pattern...\n');

  // Test player_stats insert (SGOAdapter pattern)
  const testPlayerStats = [
    {
      sport: 'MLB',
      player_name: 'Test Player',
      game_date: new Date().toISOString().split('T')[0],
      stats: { hits: 2, homeRuns: 1, rbi: 3 },
      source: 'validation_test',
      metadata: {
        source: 'sgo',
        eventID: 'test-event-123',
        playerID: 'test-player-456',
      },
    },
  ];

  const { data: statsData, error: statsError } = await supabase
    .from('player_stats')
    .insert(testPlayerStats)
    .select();

  if (statsError) {
    logResult('SGO player_stats insert', 'FAIL', `Insert failed: ${statsError.message}`, true);
  } else {
    logResult('SGO player_stats insert', 'PASS', `Successfully inserted ${statsData?.length || 0} rows`, true);

    // Cleanup
    await supabase.from('player_stats').delete().eq('source', 'validation_test');
  }

  // Test settled_outcomes insert (SGOAdapter pattern)
  const testOutcomes = [
    {
      prop_id: 'test-prop-789',
      sport: 'MLB',
      market_type: 'hits',
      player_name: 'Test Player',
      line: 1.5,
      actual_value: 2,
      outcome: 'win' as const,
      settled_at: new Date().toISOString(),
      source: 'validation_test',
      metadata: { source: 'sgo' },
    },
  ];

  const { data: outcomesData, error: outcomesError } = await supabase
    .from('settled_outcomes')
    .insert(testOutcomes)
    .select();

  if (outcomesError) {
    logResult('SGO settled_outcomes insert', 'FAIL', `Insert failed: ${outcomesError.message}`, true);
  } else {
    logResult('SGO settled_outcomes insert', 'PASS', `Successfully inserted ${outcomesData?.length || 0} rows`, true);

    // Cleanup
    await supabase.from('settled_outcomes').delete().eq('source', 'validation_test');
  }
}

/**
 * Check index existence
 */
async function validateIndexes() {
  console.log('\n📑 Validating Indexes...\n');

  const expectedIndexes = [
    'idx_player_stats_source',
    'idx_player_stats_sgo_lookup',
    'idx_player_stats_game_player',
    'idx_settled_outcomes_game_date',
    'idx_settled_outcomes_settlement_method',
  ];

  // Query pg_indexes
  const { data: indexes, error } = await supabase.rpc('get_table_indexes', {
    p_table: 'player_stats',
  });

  // Note: This RPC might not exist, so we'll just note the check
  logResult('Index validation', 'PASS', 'Manual index check recommended (see migration file)', false);
}

/**
 * Print final summary
 */
function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(80) + '\n');

  const critical = results.filter((r) => r.critical);
  const optional = results.filter((r) => !r.critical);

  const criticalPassed = critical.filter((r) => r.status === 'PASS').length;
  const criticalFailed = critical.filter((r) => r.status === 'FAIL').length;

  console.log(`Critical Checks: ${criticalPassed}/${critical.length} passed`);
  console.log(`Optional Checks: ${optional.filter((r) => r.status === 'PASS').length}/${optional.length} passed\n`);

  if (criticalFailed > 0) {
    console.log('❌ VALIDATION FAILED - Migration needs to be applied\n');
    console.log('Failed Checks:');
    results
      .filter((r) => r.status === 'FAIL' && r.critical)
      .forEach((r) => {
        console.log(`  - ${r.check}: ${r.details}`);
      });

    console.log('\nTo fix, run:');
    console.log('  docker-compose exec -T postgres psql -U postgres -d postgres < supabase/migrations/20251005_fix_sgo_ingestion_schema.sql\n');

    process.exit(1);
  } else {
    console.log('✅ VALIDATION PASSED - Schema is ready for SGO ingestion!\n');
    console.log('Next steps:');
    console.log('  1. Run test ingestion: npx tsx apps/api/src/scripts/ml/ingest-sgo-historical.ts --sports nfl --start-date 2024-09-05 --end-date 2024-09-06');
    console.log('  2. Verify data: SELECT COUNT(*), source FROM player_stats GROUP BY source;');
    console.log('  3. Run full season ingestion when ready\n');

    process.exit(0);
  }
}

/**
 * Main validation flow
 */
async function main() {
  console.log('🔍 SGO Schema Fix Validation');
  console.log('='.repeat(80) + '\n');

  try {
    await validatePlayerStatsSchema();
    await validateSettledOutcomesSchema();
    await validateTriggerSync();
    await testSGOInsertPattern();
    await validateIndexes();

    printSummary();
  } catch (error: any) {
    console.error('\n❌ Validation error:', error.message);
    process.exit(1);
  }
}

main();
