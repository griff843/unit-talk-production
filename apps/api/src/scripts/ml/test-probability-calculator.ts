/**
 * Test Probability Calculator
 *
 * Demonstrates the ML system working without database dependencies
 */

import { ProbabilityCalculator } from '../../models/ProbabilityCalculator';

const calculator = new ProbabilityCalculator();

async function testCalculator() {
  console.log('🧪 TESTING PROBABILITY CALCULATOR');
  console.log('==========================================\n');

  const testCases = [
    {
      name: 'NBA Points Prop (LeBron James)',
      input: {
        sport: 'NBA',
        playerName: 'LeBron James',
        marketType: 'player_points',
        line: 25.5,
        venue: 'home' as const,
      },
    },
    {
      name: 'NFL Passing Yards (Patrick Mahomes)',
      input: {
        sport: 'NFL',
        playerName: 'Patrick Mahomes',
        marketType: 'player_pass_yds',
        line: 275.5,
      },
    },
    {
      name: 'MLB Total Bases (Aaron Judge)',
      input: {
        sport: 'MLB',
        playerName: 'Aaron Judge',
        marketType: 'batter_total_bases',
        line: 1.5,
      },
    },
    {
      name: 'NHL Points (Connor McDavid)',
      input: {
        sport: 'NHL',
        playerName: 'Connor McDavid',
        marketType: 'player_points',
        line: 1.5,
      },
    },
  ];

  let totalTests = 0;
  let passedTests = 0;

  for (const testCase of testCases) {
    totalTests++;
    console.log(`\n📊 Test ${totalTests}: ${testCase.name}`);
    console.log('─'.repeat(60));

    try {
      const result = await calculator.calculateProbability(testCase.input);

      console.log(`   Sport: ${testCase.input.sport}`);
      console.log(`   Market: ${testCase.input.marketType}`);
      console.log(`   Line: ${testCase.input.line}`);
      console.log('');
      console.log(`   ✅ Probability: ${(result.probability * 100).toFixed(2)}%`);
      console.log(`   📊 Confidence: ${(result.confidence * 100).toFixed(2)}%`);
      console.log(`   🔍 Method: ${result.method}`);
      console.log(`   📈 Data Points: ${result.dataPoints}`);

      // Calculate expected value at standard -110 odds
      const ev = calculator.calculateExpectedValue(result.probability, -110);
      console.log(`   💰 Expected Value (-110): ${(ev * 100).toFixed(2)}%`);

      if (ev > 0) {
        console.log(`   🎉 POSITIVE EV - Good bet!`);
      } else {
        console.log(`   📉 Negative EV - Avoid`);
      }

      // Validate
      if (
        result.probability >= 0.10 &&
        result.probability <= 0.90 &&
        result.confidence >= 0 &&
        result.confidence <= 1
      ) {
        passedTests++;
      } else {
        console.log(`   ⚠️  Warning: Probability or confidence out of expected range`);
      }
    } catch (error: any) {
      console.log(`   ❌ Test failed: ${error.message}`);
    }
  }

  console.log('\n\n📊 TEST SUMMARY');
  console.log('==========================================');
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests}`);
  console.log(`   Failed: ${totalTests - passedTests}`);
  console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log('\n✅ ALL TESTS PASSED - SYSTEM WORKING!\n');
    return true;
  } else {
    console.log('\n⚠️  SOME TESTS FAILED - REVIEW ABOVE\n');
    return false;
  }
}

testCalculator().then((success) => {
  process.exit(success ? 0 : 1);
});
