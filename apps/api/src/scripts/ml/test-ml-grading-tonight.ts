/**
 * Test ML Grading System on Tonight's NFL Game
 *
 * Tests the ProbabilityCalculator with real NFL data
 * to verify it's using historical stats instead of hardcoded 52%
 */

import { createClient } from '@supabase/supabase-js';
import { probabilityCalculator } from '../../models/ProbabilityCalculator';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testMLGrading() {
  console.log('🎯 TESTING ML GRADING SYSTEM\n');
  console.log('Testing with Patrick Mahomes passing yards\n');

  // Test Case 1: Patrick Mahomes over 250.5 passing yards
  console.log('━'.repeat(60));
  console.log('\n📊 TEST 1: Patrick Mahomes Over 250.5 Passing Yards\n');

  try {
    const result = await probabilityCalculator.calculateProbability({
      sport: 'NFL',
      playerName: 'Patrick Mahomes',
      marketType: 'passing_yards',
      line: 250.5,
    });

    console.log('✅ RESULT:');
    console.log('  Probability:', (result.probability * 100).toFixed(1) + '%');
    console.log('  Confidence:', (result.confidence * 100).toFixed(1) + '%');
    console.log('  Method:', result.method);
    console.log('  Data Points:', result.dataPoints, 'games');
    console.log('\n  Factors:');
    console.log('    Base Hit Rate:', (result.factors.baseHitRate * 100).toFixed(1) + '%');
    console.log('    League Adjustment:', result.factors.leagueAdjustment.toFixed(3));
    console.log('    Matchup Factor:', result.factors.matchupFactor.toFixed(3));
    console.log('    Venue Adjustment:', result.factors.venueAdjustment.toFixed(3));
    console.log('    Recency Weight:', result.factors.recencyWeight.toFixed(3));

    if (result.probability === 0.52) {
      console.log('\n❌ WARNING: Still using fallback 52%!');
    } else {
      console.log('\n✅ SUCCESS: Using REAL probability from historical data!');
    }

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
  }

  // Test Case 2: Josh Allen
  console.log('\n' + '━'.repeat(60));
  console.log('\n📊 TEST 2: Josh Allen Over 250.5 Passing Yards\n');

  try {
    const result = await probabilityCalculator.calculateProbability({
      sport: 'NFL',
      playerName: 'Josh Allen',
      marketType: 'passing_yards',
      line: 250.5,
    });

    console.log('✅ RESULT:');
    console.log('  Probability:', (result.probability * 100).toFixed(1) + '%');
    console.log('  Method:', result.method);
    console.log('  Data Points:', result.dataPoints, 'games');

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
  }

  // Test Case 3: Christian McCaffrey rushing yards
  console.log('\n' + '━'.repeat(60));
  console.log('\n📊 TEST 3: Christian McCaffrey Over 75.5 Rushing Yards\n');

  try {
    const result = await probabilityCalculator.calculateProbability({
      sport: 'NFL',
      playerName: 'Christian McCaffrey',
      marketType: 'rushing_yards',
      line: 75.5,
    });

    console.log('✅ RESULT:');
    console.log('  Probability:', (result.probability * 100).toFixed(1) + '%');
    console.log('  Method:', result.method);
    console.log('  Data Points:', result.dataPoints, 'games');

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
  }

  // Check what historical data we have
  console.log('\n' + '━'.repeat(60));
  console.log('\n📋 MAHOMES HISTORICAL DATA:\n');

  const { data: mahomesGames } = await supabase
    .from('player_stats')
    .select('game_date, stats')
    .eq('sport', 'NFL')
    .ilike('player_name', '%Mahomes%')
    .order('game_date', { ascending: false })
    .limit(10);

  if (mahomesGames && mahomesGames.length > 0) {
    mahomesGames.forEach((game, i) => {
      const stats = game.stats as any;
      const passYds = stats.passingYards || 0;
      const over250 = passYds > 250.5 ? '✅ OVER' : '❌ UNDER';
      console.log(`  Game ${i + 1} (${game.game_date}): ${passYds} yards ${over250}`);
    });

    const over250Count = mahomesGames.filter(g => ((g.stats as any).passingYards || 0) > 250.5).length;
    const hitRate = (over250Count / mahomesGames.length * 100).toFixed(1);

    console.log(`\n  Hit Rate: ${over250Count}/${mahomesGames.length} = ${hitRate}%`);
    console.log(`  vs Hardcoded: 52%`);
    console.log(`  Difference: ${(parseFloat(hitRate) - 52).toFixed(1)}% edge!`);
  }

  console.log('\n' + '━'.repeat(60));
  console.log('\n✅ ML GRADING SYSTEM TEST COMPLETE\n');

  process.exit(0);
}

testMLGrading().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
