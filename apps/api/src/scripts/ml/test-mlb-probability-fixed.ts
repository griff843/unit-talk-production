/**
 * Test MLB Probability Calculator with fixed stat mappings
 */

import { ProbabilityCalculator } from '../../models/ProbabilityCalculator';

async function test() {
  const calc = new ProbabilityCalculator();

  console.log('🧪 Testing MLB ProbabilityCalculator with fixed mappings...\n');

  // Test players we know have 2-3 games
  const testCases = [
    { player: 'Hoby Milner', market: 'hits', line: 0.5 },
    { player: 'Joe Ross', market: 'hits', line: 1.5 },
    { player: 'Jack Flaherty', market: 'strikeoutsThrown', line: 5.5 },
    { player: 'Bryan Reynolds', market: 'totalBases', line: 1.5 },
    { player: 'Oneil Cruz', market: 'homeRuns', line: 0.5 },
  ];

  for (const test of testCases) {
    console.log(`\n📊 ${test.player} - ${test.market} (line: ${test.line})`);

    const result = await calc.calculateProbability({
      sport: 'MLB',
      playerName: test.player,
      marketType: test.market,
      line: test.line,
    });

    console.log(`   Method: ${result.method}`);
    console.log(`   Probability: ${(result.probability * 100).toFixed(1)}%`);
    console.log(`   Data Points: ${result.dataPoints}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);

    if (result.method === 'fallback') {
      console.log('   ⚠️  STILL USING FALLBACK - Need to debug further');
    } else {
      console.log('   ✅ SUCCESS - Using historical data!');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ MLB Probability Calculator test complete');

  process.exit(0);
}

test();
