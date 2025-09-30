#!/usr/bin/env node

/**
 * Test if the real ScoringAgent uses actual 45+ factors
 * instead of hardcoded generic values
 */

// Import the actual ScoringAgent
import('./src/agents/ScoringAgent/ScoringAgent.js').then(async ({ ScoringAgent }) => {
  console.log('🔍 TESTING REAL GRADINGAGENT');
  console.log('=============================\n');

  try {
    // Create a test feature set with real data variations
    const testFeatureSet = {
      propId: 'test-prop-1',
      sport: 'NBA',
      date: '2025-09-09',
      league: 'NBA',
      player: 'LeBron James',
      market: {
        type: 'points',
        odds: -110,
        line: 25.5
      },
      
      // Core features - testing with DIFFERENT values to see if they affect output
      expectedValue: 15.7,        // Real calculated value
      lineMovement: -2.5,         // Real line movement
      matchupRating: 85,          // High matchup rating
      playerForm: 92,             // Hot player form
      injuryImpact: -10,          // Minor injury concern
      weatherImpact: 0,
      
      // Market intelligence - testing with real data
      marketIntelligence: 78,     // High market intelligence  
      sharpMoney: 35,             // Contrarian opportunity
      volumeProfile: 82,          // High volume
      closingLineValue: 3.2,      // Positive CLV
      
      // Additional metadata
      timestamp: new Date().toISOString(),
      dataQuality: {
        completeness: 0.95,
        outlierScore: 0.95,
        consistencyScore: 0.95,
        dataValidationScore: 0.95
      }
    };

    // Test with contrasting feature set  
    const testFeatureSet2 = {
      ...testFeatureSet,
      propId: 'test-prop-2',
      player: 'Bench Player',
      expectedValue: -5.2,        // Negative expected value
      matchupRating: 32,          // Poor matchup
      playerForm: 28,             // Poor form
      marketIntelligence: 25,     // Low market intelligence
      sharpMoney: 85,             // Heavy sharp action
      volumeProfile: 15,          // Low volume
      closingLineValue: -8.1      // Negative CLV
    };

    console.log('🎯 Test Set 1 (High Quality):');
    console.log(`   Player: ${testFeatureSet.player}`);
    console.log(`   Expected Value: ${testFeatureSet.expectedValue}`);
    console.log(`   Player Form: ${testFeatureSet.playerForm}`);
    console.log(`   Matchup Rating: ${testFeatureSet.matchupRating}`);
    console.log(`   Sharp Money: ${testFeatureSet.sharpMoney}%`);
    
    console.log('\n🎯 Test Set 2 (Low Quality):');
    console.log(`   Player: ${testFeatureSet2.player}`);
    console.log(`   Expected Value: ${testFeatureSet2.expectedValue}`);
    console.log(`   Player Form: ${testFeatureSet2.playerForm}`);
    console.log(`   Matchup Rating: ${testFeatureSet2.matchupRating}`);
    console.log(`   Sharp Money: ${testFeatureSet2.sharpMoney}%`);

    console.log('\n🔬 If ScoringAgent uses real 45+ factors, these should produce VERY different scores...\n');

  } catch (error) {
    console.error('❌ Error testing real ScoringAgent:', error.message);
  }
}).catch(console.error);
