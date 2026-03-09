/* eslint-disable no-console, max-lines-per-function, complexity */
/**
 * Test Projections Lookup
 * Sprint: SPRINT-PROJECTIONS-FOUNDATION-099A
 *
 * Inserts a sample projection row, fetches it via getProjection(),
 * and asserts equality.
 *
 * Usage: npx tsx src/scripts/test-projections-lookup.ts
 */

import { createClient } from '@supabase/supabase-js';

import { getProjectionAgent, resetProjectionAgent } from '../agents/_archived/ProjectionAgent';
import { getProjectionEngine, resetProjectionEngine } from '../services/projections';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const TEST_PLAYER = 'LeBron James';
const TEST_SPORT = 'NBA';
const TEST_STAT_TYPE = 'points';
const TEST_GAME_DATE = new Date().toISOString().split('T')[0];
const TEST_PROJECTED_VALUE = 27.5;
const TEST_CONFIDENCE = 0.82;
const TEST_MODEL_VERSION = 'v1.0.0-nba-baseline';

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('TEST PROJECTIONS LOOKUP');
  console.log('Sprint: SPRINT-PROJECTIONS-FOUNDATION-099A');
  console.log('='.repeat(60));
  console.log();

  // Validate env
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Create client
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Reset singletons for clean test
  resetProjectionEngine();
  resetProjectionAgent();

  const projectionEngine = getProjectionEngine(supabase);

  console.log('📋 Test Parameters:');
  console.log(`   Player: ${TEST_PLAYER}`);
  console.log(`   Sport: ${TEST_SPORT}`);
  console.log(`   Stat Type: ${TEST_STAT_TYPE}`);
  console.log(`   Game Date: ${TEST_GAME_DATE}`);
  console.log(`   Projected Value: ${TEST_PROJECTED_VALUE}`);
  console.log(`   Confidence: ${TEST_CONFIDENCE}`);
  console.log(`   Model Version: ${TEST_MODEL_VERSION}`);
  console.log();

  // Step 1: Insert test projection
  console.log('1️⃣  Inserting test projection...');
  const insertData = {
    sport: TEST_SPORT,
    player_name: TEST_PLAYER,
    stat_type: TEST_STAT_TYPE,
    game_date: TEST_GAME_DATE,
    projected_value: TEST_PROJECTED_VALUE,
    confidence: TEST_CONFIDENCE,
    model_version: TEST_MODEL_VERSION,
    computed_at: new Date().toISOString(),
    source_data: {
      recentAvg: 26.8,
      recentGamesUsed: 5,
      method: 'test_insert',
    },
  };

  const { data: insertedRow, error: insertError } = await supabase
    .from('player_projections')
    .upsert(insertData, { onConflict: 'sport,player_name,stat_type,game_date,model_version' })
    .select()
    .single();

  if (insertError) {
    console.error(`❌ Insert failed: ${insertError.message}`);
    process.exit(1);
  }

  console.log(`   ✅ Inserted projection ID: ${insertedRow.id}`);
  console.log();

  // Step 2: Fetch via ProjectionEngine
  console.log('2️⃣  Fetching via ProjectionEngine.getProjection()...');
  const projection = await projectionEngine.getProjection(TEST_PLAYER, TEST_STAT_TYPE, {
    sport: TEST_SPORT,
    date: TEST_GAME_DATE,
  });

  if (!projection) {
    console.error('❌ getProjection() returned null');
    process.exit(1);
  }

  console.log(`   ✅ Projection found`);
  console.log(`   Player: ${projection.player}`);
  console.log(`   Market Type: ${projection.marketType}`);
  console.log(`   Projected Line: ${projection.projectedLine}`);
  console.log(`   Confidence: ${projection.confidence}`);
  console.log(`   Model Version: ${projection.modelVersion}`);
  console.log();

  // Step 3: Assert equality
  console.log('3️⃣  Asserting equality...');
  let passed = true;

  if (projection.player !== TEST_PLAYER) {
    console.error(`   ❌ Player mismatch: ${projection.player} !== ${TEST_PLAYER}`);
    passed = false;
  } else {
    console.log(`   ✅ Player matches`);
  }

  if (projection.marketType !== TEST_STAT_TYPE) {
    console.error(`   ❌ Stat type mismatch: ${projection.marketType} !== ${TEST_STAT_TYPE}`);
    passed = false;
  } else {
    console.log(`   ✅ Stat type matches`);
  }

  if (projection.projectedLine !== TEST_PROJECTED_VALUE) {
    console.error(`   ❌ Value mismatch: ${projection.projectedLine} !== ${TEST_PROJECTED_VALUE}`);
    passed = false;
  } else {
    console.log(`   ✅ Projected value matches`);
  }

  if (projection.confidence !== TEST_CONFIDENCE) {
    console.error(`   ❌ Confidence mismatch: ${projection.confidence} !== ${TEST_CONFIDENCE}`);
    passed = false;
  } else {
    console.log(`   ✅ Confidence matches`);
  }

  if (projection.modelVersion !== TEST_MODEL_VERSION) {
    console.error(
      `   ❌ Model version mismatch: ${projection.modelVersion} !== ${TEST_MODEL_VERSION}`
    );
    passed = false;
  } else {
    console.log(`   ✅ Model version matches`);
  }

  console.log();

  // Step 4: Test ProjectionAgent compute
  console.log('4️⃣  Testing ProjectionAgent.compute()...');
  const projectionAgent = getProjectionAgent(supabase);

  const computeResult = projectionAgent.compute({
    playerName: TEST_PLAYER,
    sport: 'NBA',
    statType: 'points',
    gameDate: TEST_GAME_DATE,
    recentGames: [
      { date: '2026-02-20', opponent: 'LAC', statValue: 28, minutes: 36 },
      { date: '2026-02-18', opponent: 'DEN', statValue: 25, minutes: 34 },
      { date: '2026-02-16', opponent: 'PHX', statValue: 32, minutes: 38 },
    ],
    seasonAvg: 27.2,
    minutesProjection: 35,
    usageRate: 0.28,
  });

  if (!computeResult) {
    console.error('   ❌ ProjectionAgent.compute() returned null');
    passed = false;
  } else {
    console.log(`   ✅ Computed projection:`);
    console.log(`      Projected Value: ${computeResult.projectedValue}`);
    console.log(`      Confidence: ${computeResult.confidence}`);
    console.log(`      Model Version: ${computeResult.modelVersion}`);
    console.log(`      Method: ${computeResult.sourceData.method}`);
    console.log(`      Flags: ${computeResult.flags.join(', ') || 'none'}`);
  }

  console.log();

  // Step 5: Clean up test data
  console.log('5️⃣  Cleaning up test data...');
  const { error: deleteError } = await supabase
    .from('player_projections')
    .delete()
    .eq('id', insertedRow.id);

  if (deleteError) {
    console.warn(`   ⚠️ Cleanup failed: ${deleteError.message}`);
  } else {
    console.log(`   ✅ Test data cleaned up`);
  }

  console.log();
  console.log('='.repeat(60));

  if (passed) {
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(60));
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED');
    console.log('='.repeat(60));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
