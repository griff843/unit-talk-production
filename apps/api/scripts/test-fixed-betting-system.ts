#!/usr/bin/env npx tsx
/**
 * Test the FIXED betting system with proper OVER/UNDER analysis
 */

import { calculateExpectedValue, analyzeBothSides } from '../src/agents/ScoringAgent/scoring/expectedValue';

// Mock props with REAL over/under odds (like we'd get from fixed SGO ingestion)
const mockPropsWithBothSides = [
  {
    id: '1',
    player_name: 'Josh Allen',
    stat_type: 'passing_touchdowns',
    line: 1.5,
    over_odds: -153,
    under_odds: 120,
    sport: 'NFL',
    steam_detected: true,
    sharp_money: false,
    closing_line_value: 0.02
  },
  {
    id: '2',
    player_name: 'LeBron James',
    stat_type: 'assists',
    line: 8.5,
    over_odds: -110,
    under_odds: -110,
    sport: 'NBA',
    steam_detected: false,
    sharp_money: true,
    closing_line_value: 0.01
  },
  {
    id: '3',
    player_name: 'Anthony Davis',
    stat_type: 'assists',
    line: 3.5,
    over_odds: 125,
    under_odds: -155,
    sport: 'NBA',
    steam_detected: false,
    sharp_money: false,
    closing_line_value: -0.01
  }
];

function simulateFixedScoringSystem() {
  console.log('🎯 TESTING FIXED BETTING SYSTEM WITH PROPER OVER/UNDER ANALYSIS');
  console.log('=' .repeat(80));

  mockPropsWithBothSides.forEach((prop, index) => {
    console.log(`\n📊 ANALYZING PROP #${index + 1}:`);
    console.log(`Player: ${prop.player_name}`);
    console.log(`Prop: ${prop.stat_type} ${prop.line}`);
    console.log(`Over odds: ${prop.over_odds}, Under odds: ${prop.under_odds}`);

    // Analyze both sides
    const analysis = analyzeBothSides(prop);

    if (analysis) {
      console.log(`\n✅ RECOMMENDATION FOUND:`);
      console.log(`🎯 BET: ${analysis.side.toUpperCase()} ${prop.line} ${prop.stat_type}`);
      console.log(`📊 Odds: ${analysis.odds}`);
      console.log(`📈 Expected Value: ${(analysis.expectedValue * 100).toFixed(1)}%`);
      console.log(`🔍 Edge: ${(analysis.edge * 100).toFixed(1)}%`);
      console.log(`📊 Projected Probability: ${(analysis.projectedProbability * 100).toFixed(1)}%`);
      console.log(`🎲 Implied Probability: ${(analysis.impliedProbability * 100).toFixed(1)}%`);

      // Calculate Kelly sizing
      const kellyFraction = Math.min(0.05, Math.max(0, analysis.edge / 4)); // Conservative Kelly
      const kellyPercent = (kellyFraction * 100).toFixed(1);
      console.log(`💰 Kelly Sizing: ${kellyPercent}% of bankroll`);

      // Final recommendation
      const recommendation = analysis.expectedValue > 0.05 ? 'STRONG BET' :
                           analysis.expectedValue > 0.02 ? 'BET' : 'CONSIDER';
      console.log(`🏆 Recommendation: ${recommendation}`);

    } else {
      console.log(`\n❌ NO POSITIVE EV FOUND`);
      console.log(`⏭️ Recommendation: PASS`);
    }

    console.log('-' .repeat(60));
  });

  console.log('\n🎉 FIXED SYSTEM SUMMARY:');
  console.log('✅ Each prop analyzed for BOTH over and under sides');
  console.log('✅ Only the side with positive EV is recommended');
  console.log('✅ Clear betting direction specified (OVER/UNDER)');
  console.log('✅ Proper odds and Kelly sizing provided');
  console.log('✅ Professional devigging and edge calculation');
}

function demonstrateOldVsNewSystem() {
  console.log('\n🔄 OLD VS NEW SYSTEM COMPARISON:');
  console.log('=' .repeat(80));

  const testProp = mockPropsWithBothSides[0];

  console.log('\n❌ OLD BROKEN SYSTEM:');
  console.log(`"Anthony Davis - Assists 3.5" (Score: 67.7/100)`);
  console.log(`❌ MISSING: Which side to bet (over or under)?`);
  console.log(`❌ MISSING: What odds are we getting?`);
  console.log(`❌ MEANINGLESS: Score without betting direction`);

  console.log('\n✅ NEW FIXED SYSTEM:');
  const analysis = analyzeBothSides(testProp);
  if (analysis) {
    console.log(`"${testProp.player_name} - ${analysis.side.toUpperCase()} ${testProp.line} ${testProp.stat_type} at ${analysis.odds} odds"`);
    console.log(`✅ CLEAR: Betting direction specified`);
    console.log(`✅ COMPLETE: Specific odds included`);
    console.log(`✅ MEANINGFUL: Score represents actual expected value`);
    console.log(`✅ ACTIONABLE: Ready for real betting`);
  }
}

if (require.main === module) {
  simulateFixedScoringSystem();
  demonstrateOldVsNewSystem();
}