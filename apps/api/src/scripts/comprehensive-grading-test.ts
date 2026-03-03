#!/usr/bin/env npx tsx
// @ts-nocheck

/**
 * Comprehensive GradingAgent Test
 *
 * Test the current state of the grading system after all NaN fixes
 * to identify the root cause of remaining issues
 */

import { config } from 'dotenv';

import { SyndicateGradingEngine } from '../agents/GradingAgent/scoring/gradingEngine';
import { MLModelManager } from '../agents/GradingAgent/scoring/mlModelManager';
import { supabaseClient } from '../services/supabaseClient';
import { GradingFeatureSet } from '../types/GradingFeatureSet';

config();

async function comprehensiveGradingTest() {
  console.log('🧪 COMPREHENSIVE GRADING SYSTEM TEST');
  console.log('=====================================');

  try {
    // 1. Test different sport props
    console.log('\n📊 TESTING DIFFERENT SPORTS:');

    // Get NBA prop (known to have NaN issues)
    const { data: nbaProps } = await supabaseClient
      .from('raw_props')
      .select('*')
      .eq('sport', 'NBA')
      .limit(1);

    // Get MLB prop (known to work)
    const { data: mlbProps } = await supabaseClient
      .from('raw_props')
      .select('*')
      .eq('sport', 'MLB')
      .limit(1);

    // Get NFL prop
    const { data: nflProps } = await supabaseClient
      .from('raw_props')
      .select('*')
      .eq('sport', 'NFL')
      .limit(1);

    const testProps = [
      { sport: 'NBA', prop: nbaProps?.[0] },
      { sport: 'MLB', prop: mlbProps?.[0] },
      { sport: 'NFL', prop: nflProps?.[0] },
    ].filter(item => item.prop);

    console.log(`Found ${testProps.length} test props to analyze`);

    const gradingEngine = new SyndicateGradingEngine();
    const mlModelManager = new MLModelManager();

    // 2. Test each prop systematically
    for (const { sport, prop } of testProps) {
      console.log(`\n🎯 TESTING ${sport} PROP:`);
      console.log(`  ID: ${prop.id}`);
      console.log(`  Player: ${prop.player_name}`);
      console.log(`  Stat Type: ${prop.stat_type}`);
      console.log(`  Line: ${prop.line}`);
      console.log(`  Expected Value: ${prop.expected_value}`);

      // Convert to feature set
      const features = convertToFeatureSet(prop);
      console.log(`\n  📋 Feature Set Created:`);
      console.log(`    Expected Value: ${features.expectedValue}`);
      console.log(`    Sharp Money: ${features.sharpMoney}`);
      console.log(`    Line Movement: ${features.lineMovement}`);
      console.log(`    Market Intelligence: ${features.marketIntelligence}`);

      // Test individual scoring components
      console.log(`\n  🔍 Individual Component Tests:`);

      try {
        // Test ML Model Manager directly
        console.log(`    1. Testing ML Model Manager:`);
        const mlResult = await mlModelManager.calculateBaseScore(features);
        console.log(`       ML Base Score: ${JSON.stringify(mlResult)}`);

        // Test grading engine components individually
        console.log(`    2. Testing Grading Engine Components:`);
        const config = gradingEngine.getCurrentConfig();

        // Test each scoring method if they exist
        const coreScore = await testCoreScore(gradingEngine, features, config.weights);
        console.log(`       Core Score: ${coreScore}`);

        const marketScore = await testMarketScore(gradingEngine, features, config.weights);
        console.log(`       Market Score: ${marketScore}`);

        // Test full grading
        console.log(`    3. Testing Full Grading:`);
        const result = await gradingEngine.gradeProp(features);
        console.log(`       Final Score: ${result.finalScore}`);
        console.log(`       Edge Score: ${result.edgeScore}`);
        console.log(`       Tier: ${result.tier}`);
        console.log(`       Confidence: ${result.confidence}`);
        console.log(`       Kelly Fraction: ${result.kellyFraction}`);

        // Check for NaN values
        const hasNaN =
          isNaN(result.finalScore) ||
          isNaN(result.edgeScore) ||
          isNaN(result.confidence) ||
          isNaN(result.kellyFraction);
        console.log(`       ❌ Has NaN: ${hasNaN}`);

        if (hasNaN) {
          console.log(`       🔍 NaN ANALYSIS:`);
          console.log(`         Final Score isNaN: ${isNaN(result.finalScore)}`);
          console.log(`         Edge Score isNaN: ${isNaN(result.edgeScore)}`);
          console.log(`         Confidence isNaN: ${isNaN(result.confidence)}`);
          console.log(`         Kelly Fraction isNaN: ${isNaN(result.kellyFraction)}`);
        }
      } catch (error) {
        console.error(`    ❌ Grading failed for ${sport}:`, error.message);
        console.error(`    Stack trace:`, error.stack?.split('\n').slice(0, 5).join('\n'));
      }

      console.log(`\n  ${'='.repeat(50)}`);
    }

    // 3. Test ML Model Manager initialization
    console.log(`\n🤖 ML MODEL MANAGER DETAILED TEST:`);
    try {
      console.log(`  Initializing ML Model Manager...`);
      const mlManager = new MLModelManager();

      // Test with simple features
      const simpleFeatures: GradingFeatureSet = {
        propId: 'test-prop',
        date: new Date().toISOString().split('T')[0],
        sport: 'NBA',
        league: 'NBA',
        player: 'Test Player',
        market: { type: 'points', line: 25.5, odds: -110 },
        expectedValue: 10,
        sharpMoney: 75,
        lineMovement: 2,
        matchupRating: 85,
        playerForm: 90,
        marketType: 'points',
        odds: -110,
        injuryImpact: 0,
        weatherImpact: 0,
        marketIntelligence: 80,
        volumeProfile: 70,
        closingLineValue: 5,
        playerFatigue: 0,
        venueAdvantage: 5,
        refereeImpact: 0,
        paceImpact: 10,
        motivationalFactors: 5,
        correlationRisk: 0.1,
        volatility: 3,
        portfolioImpact: 0.05,
        bidAskSpread: 0.02,
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'test',
        confidence: 75,
        dataQuality: {
          completeness: 0.95,
          outlierScore: 0.95,
          consistencyScore: 0.95,
          dataValidationScore: 0.95,
        },
      };

      console.log(`  Testing with controlled features...`);
      const mlTestResult = await mlManager.calculateBaseScore(simpleFeatures);
      console.log(`  ML Test Result: ${JSON.stringify(mlTestResult, null, 2)}`);

      // Check if ML models are producing valid outputs
      const hasValidML =
        !isNaN(mlTestResult.neuralNetwork) &&
        !isNaN(mlTestResult.gradientBoosting) &&
        !isNaN(mlTestResult.randomForest) &&
        !isNaN(mlTestResult.ensemble);

      console.log(`  ML Models Valid: ${hasValidML}`);
      if (!hasValidML) {
        console.log(`  ❌ ML Model Issues Detected:`);
        console.log(`    Neural Network: ${mlTestResult.neuralNetwork}`);
        console.log(`    Gradient Boosting: ${mlTestResult.gradientBoosting}`);
        console.log(`    Random Forest: ${mlTestResult.randomForest}`);
        console.log(`    Ensemble: ${mlTestResult.ensemble}`);
      }
    } catch (error) {
      console.error(`  ❌ ML Model Manager test failed:`, error.message);
    }

    // 4. Summary and recommendations
    console.log(`\n📋 TEST SUMMARY:`);
    console.log(`================`);
    console.log(`✅ Comprehensive grading test completed`);
    console.log(`🔍 Check the results above to identify sport-specific issues`);
    console.log(`🎯 Look for patterns in which sports produce NaN vs valid scores`);
  } catch (error) {
    console.error('❌ Comprehensive test failed:', error);
  }
}

function convertToFeatureSet(rawProp: any): GradingFeatureSet {
  return {
    propId: rawProp.id,
    date: rawProp.date || rawProp.game_date || new Date().toISOString().split('T')[0],
    sport: rawProp.sport || 'unknown',
    league: rawProp.league || 'unknown',
    player: rawProp.player_name,
    market: {
      type: rawProp.market_type || rawProp.stat_type || 'unknown',
      line: parseFloat(rawProp.line) || 0,
      odds:
        parseInt(rawProp.odds) ||
        parseInt(rawProp.over_odds) ||
        parseInt(rawProp.under_odds) ||
        -110,
    },
    expectedValue: parseFloat(rawProp.expected_value) || 0,
    sharpMoney: parseFloat(rawProp.sharp_money) || 50,
    lineMovement: parseFloat(rawProp.line_movement) || 0,
    matchupRating: parseFloat(rawProp.matchup_rating) || 50,
    playerForm: parseFloat(rawProp.player_form) || 50,
    marketType: rawProp.market_type || rawProp.stat_type,
    odds:
      parseInt(rawProp.odds) || parseInt(rawProp.over_odds) || parseInt(rawProp.under_odds) || -110,
    injuryImpact: parseFloat(rawProp.injury_impact) || 0,
    weatherImpact: parseFloat(rawProp.weather_impact) || 0,
    marketIntelligence: parseFloat(rawProp.market_intelligence) || 50,
    volumeProfile: parseFloat(rawProp.volume_profile) || 50,
    closingLineValue: parseFloat(rawProp.closing_line_value) || 0,
    playerFatigue: parseFloat(rawProp.player_fatigue) || 0,
    venueAdvantage: parseFloat(rawProp.venue_advantage) || 0,
    refereeImpact: parseFloat(rawProp.referee_impact) || 0,
    paceImpact: parseFloat(rawProp.pace_impact) || 0,
    motivationalFactors: parseFloat(rawProp.motivational_factors) || 0,
    correlationRisk: parseFloat(rawProp.correlation_risk) || 0,
    volatility: parseFloat(rawProp.volatility) || 5,
    portfolioImpact: parseFloat(rawProp.portfolio_impact) || 0,
    bidAskSpread: parseFloat(rawProp.bid_ask_spread) || 0.02,
    timestamp: rawProp.created_at || new Date().toISOString(),
    version: '1.0',
    source: 'database',
    confidence: parseFloat(rawProp.confidence) || 50,
    dataQuality: {
      completeness: parseFloat(rawProp.data_completeness) || 0.95,
      outlierScore: parseFloat(rawProp.outlier_score) || 0.95,
      consistencyScore: parseFloat(rawProp.consistency_score) || 0.95,
      dataValidationScore: parseFloat(rawProp.data_validation_score) || 0.95,
    },
  };
}

// Helper functions to test individual components
async function testCoreScore(
  engine: any,
  features: GradingFeatureSet,
  weights: any
): Promise<number> {
  try {
    // Access private method if possible, otherwise return a test professional_score
    if (typeof engine.calculateCoreScore === 'function') {
      return engine.calculateCoreScore(features, weights);
    }
    return 0; // Fallback
  } catch (error) {
    console.error('      Core professional_score test failed:', error.message);
    return 0;
  }
}

async function testMarketScore(
  engine: any,
  features: GradingFeatureSet,
  weights: any
): Promise<number> {
  try {
    // Access private method if possible, otherwise return a test professional_score
    if (typeof engine.calculateMarketIntelligenceScore === 'function') {
      return engine.calculateMarketIntelligenceScore(features, weights);
    }
    return 0; // Fallback
  } catch (error) {
    console.error('      Market professional_score test failed:', error.message);
    return 0;
  }
}

// Run the test
if (require.main === module) {
  comprehensiveGradingTest()
    .then(() => {
      console.log('\n✅ Comprehensive grading test completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

export { comprehensiveGradingTest };
