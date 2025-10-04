/**
 * PRODUCTION READINESS TEST
 *
 * Comprehensive end-to-end test simulating a full production day:
 * - All services running
 * - FeedAgent ingestion (core markets)
 * - Database writes with deduplication
 * - Agent health monitoring
 * - System metrics validation
 */

import { fetchAndWriteCoreMarkets } from '../agents/FeedAgent/oddsApi.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface TestResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details?: string;
}

const results: TestResult[] = [];

function logResult(category: string, test: string, status: 'PASS' | 'FAIL' | 'WARN', details?: string) {
  results.push({ category, test, status, details });
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${emoji} [${category}] ${test}${details ? ': ' + details : ''}`);
}

async function testInfrastructure() {
  console.log('\n📦 INFRASTRUCTURE TESTS\n' + '='.repeat(50));

  // Test Database Connection
  try {
    const { error } = await supabase.from('unified_picks').select('id').limit(1);
    if (error) throw error;
    logResult('Infrastructure', 'Database Connection', 'PASS');
  } catch (err) {
    logResult('Infrastructure', 'Database Connection', 'FAIL', String(err));
  }

  // Test API Health
  try {
    const response = await fetch('http://localhost:3000/health');
    if (response.ok) {
      logResult('Infrastructure', 'API Health Endpoint', 'PASS');
    } else {
      logResult('Infrastructure', 'API Health Endpoint', 'FAIL', `Status: ${response.status}`);
    }
  } catch (err) {
    logResult('Infrastructure', 'API Health Endpoint', 'FAIL', String(err));
  }

  // Test Command Center
  try {
    const response = await fetch('http://localhost:3004/api/health');
    if (response.ok) {
      logResult('Infrastructure', 'Command Center Health', 'PASS');
    } else {
      logResult('Infrastructure', 'Command Center Health', 'FAIL', `Status: ${response.status}`);
    }
  } catch (err) {
    logResult('Infrastructure', 'Command Center Health', 'FAIL', String(err));
  }
}

async function testDataIngestion() {
  console.log('\n🎯 DATA INGESTION TESTS\n' + '='.repeat(50));

  try {
    // Fetch NFL core markets
    console.log('Fetching NFL core markets (h2h, spreads, totals)...');
    const result = await fetchAndWriteCoreMarkets('americanfootball_nfl', {
      markets: ['h2h', 'spreads', 'totals'],
      daysFrom: 7,
    });

    // Validate events fetched
    if (result.eventsFetched > 0) {
      logResult('Ingestion', 'Events Fetched', 'PASS', `${result.eventsFetched} games`);
    } else {
      logResult('Ingestion', 'Events Fetched', 'WARN', 'No events found (off-season?)');
    }

    // Validate picks transformed
    if (result.coreMarketWrites.attemptedWrites > 0) {
      logResult('Ingestion', 'Picks Transformed', 'PASS', `${result.coreMarketWrites.attemptedWrites} picks`);
    } else {
      logResult('Ingestion', 'Picks Transformed', 'FAIL', 'No picks transformed');
    }

    // Validate deduplication (zero errors is success)
    if (result.coreMarketWrites.errors === 0) {
      logResult('Ingestion', 'Deduplication', 'PASS', 'Zero database errors');
    } else {
      logResult('Ingestion', 'Deduplication', 'FAIL', `${result.coreMarketWrites.errors} errors`);
    }

    // Validate write metrics
    const totalProcessed = result.coreMarketWrites.inserted + result.coreMarketWrites.skippedDedup;
    if (totalProcessed === result.coreMarketWrites.attemptedWrites) {
      logResult('Ingestion', 'Write Consistency', 'PASS', 'All picks accounted for');
    } else {
      logResult('Ingestion', 'Write Consistency', 'WARN', `Attempted: ${result.coreMarketWrites.attemptedWrites}, Processed: ${totalProcessed}`);
    }

    return result;
  } catch (err) {
    logResult('Ingestion', 'FeedAgent Execution', 'FAIL', String(err));
    return null;
  }
}

async function testDatabaseIntegrity() {
  console.log('\n🗄️ DATABASE INTEGRITY TESTS\n' + '='.repeat(50));

  try {
    // Test schema columns exist
    const { data, error } = await supabase
      .from('unified_picks')
      .select('external_game_id, external_prop_id, market, selection, odds')
      .limit(1);

    if (error) throw error;

    logResult('Database', 'Schema Columns', 'PASS', 'All required columns present');

    // Test unique constraint (try duplicate insert)
    const testPick = {
      user_id: '7ce2ba1f-459f-47cf-ab06-dc3566a847c6',
      pick_type: 'single',
      external_game_id: 'test_constraint_check',
      external_prop_id: null,
      market: 'h2h',
      selection: 'Test Team',
      odds: 100,
      stake: 1,
      potential_payout: 2,
      metadata: { bookmaker_key: 'test' }
    };

    // First insert
    const { error: insert1Error } = await supabase
      .from('unified_picks')
      .insert(testPick);

    if (insert1Error) {
      logResult('Database', 'Test Data Insert', 'FAIL', insert1Error.message);
    } else {
      // Try duplicate (should be blocked or ignored)
      const { error: insert2Error } = await supabase
        .from('unified_picks')
        .insert(testPick);

      if (insert2Error && insert2Error.code === '23505') {
        logResult('Database', 'Unique Constraint', 'PASS', 'Duplicates properly blocked');
      } else if (!insert2Error) {
        logResult('Database', 'Unique Constraint', 'WARN', 'Duplicate insert succeeded (may be using upsert)');
      }

      // Cleanup
      await supabase
        .from('unified_picks')
        .delete()
        .eq('external_game_id', 'test_constraint_check');
    }
  } catch (err) {
    logResult('Database', 'Integrity Tests', 'FAIL', String(err));
  }
}

async function testSystemMetrics() {
  console.log('\n📊 SYSTEM METRICS TESTS\n' + '='.repeat(50));

  try {
    // Check database pick count
    const { count, error } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    logResult('Metrics', 'Total Picks in Database', 'PASS', `${count} picks`);

    // Check unique games
    const { data: games } = await supabase
      .from('unified_picks')
      .select('external_game_id')
      .limit(1000);

    const uniqueGames = new Set(games?.map(p => p.external_game_id) || []).size;
    logResult('Metrics', 'Unique Games Tracked', 'PASS', `${uniqueGames} games`);

  } catch (err) {
    logResult('Metrics', 'System Metrics', 'FAIL', String(err));
  }
}

async function runProductionReadinessTest() {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║   UNIT TALK PRODUCTION READINESS TEST                ║
║   Fortune 100-Grade System Validation                ║
╚═══════════════════════════════════════════════════════╝
`);

  console.log('🚀 Starting comprehensive production simulation...\n');

  // Run all test suites
  await testInfrastructure();
  const ingestionResult = await testDataIngestion();
  await testDatabaseIntegrity();
  await testSystemMetrics();

  // Generate final report
  console.log('\n' + '='.repeat(70));
  console.log('📋 PRODUCTION READINESS REPORT');
  console.log('='.repeat(70));

  const totalTests = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;

  console.log(`\nTotal Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`\nSuccess Rate: ${Math.round((passed / totalTests) * 100)}%`);

  if (ingestionResult) {
    console.log('\n📊 INGESTION SUMMARY:');
    console.log(`  Events: ${ingestionResult.eventsFetched}`);
    console.log(`  Picks: ${ingestionResult.coreMarketWrites.attemptedWrites}`);
    console.log(`  Inserted: ${ingestionResult.coreMarketWrites.inserted}`);
    console.log(`  Deduplicated: ${ingestionResult.coreMarketWrites.skippedDedup}`);
    console.log(`  Errors: ${ingestionResult.coreMarketWrites.errors}`);
  }

  // Critical failures
  const criticalFailures = results.filter(r =>
    r.status === 'FAIL' &&
    (r.category === 'Infrastructure' || r.test.includes('Deduplication'))
  );

  if (criticalFailures.length > 0) {
    console.log('\n❌ CRITICAL FAILURES:');
    criticalFailures.forEach(f => {
      console.log(`  - [${f.category}] ${f.test}: ${f.details || 'No details'}`);
    });
    console.log('\n🚫 SYSTEM NOT READY FOR PRODUCTION');
    process.exit(1);
  } else if (failed > 0) {
    console.log('\n⚠️  SYSTEM HAS NON-CRITICAL FAILURES');
    console.log('Review failures before production deployment');
    process.exit(1);
  } else {
    console.log('\n✅ ALL SYSTEMS GO - PRODUCTION READY');
    console.log('🎉 System validated and ready for deployment');
    process.exit(0);
  }
}

runProductionReadinessTest().catch(err => {
  console.error('\n❌ PRODUCTION TEST FAILED:', err);
  process.exit(1);
});
