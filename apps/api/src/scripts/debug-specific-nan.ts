#!/usr/bin/env npx tsx
// @ts-nocheck

/**
 * Debug Specific NaN Issue in GradingEngine
 * 
 * Focus on the LeBron James prop that's still showing NaN
 */

import { config } from 'dotenv';

import { SyndicateGradingEngine } from '../agents/ScoringAgent/scoring/gradingEngine';
import { supabaseClient } from '../utils/supabaseUtils';
import { GradingFeatureSet } from '../types/GradingFeatureSet';
import { requireSupabase } from '../utils/supabaseUtils';

config();

async function debugSpecificNaN() {
  console.log('🔬 DEBUG SPECIFIC NaN ISSUE');
  console.log('============================');
  
  try {
    // Get the specific LeBron James prop that's causing NaN
    const supabaseClient = requireSupabase();
      const { data: prop } = await supabaseClient
      .from('sports_game_odds')
      .select('*')
      .eq('id', '20d4f927-e069-4865-96b0-59e06d5629b8')
      .single();
      
    if (!prop) {
      console.error('❌ Specific prop not found');
      return;
    }
    
    console.log('🎯 DEBUGGING PROP:', prop.id);
    console.log(`Player: ${prop.player_name}`);
    console.log(`Sport: ${prop.sport}`);
    console.log(`Expected Value: ${prop.expected_value}`);
    console.log(`Raw Data:`, JSON.stringify(prop, null, 2));
    
    // Convert to feature set
    const features = convertToFeatureSet(prop);
    console.log('\n📊 CONVERTED FEATURES:');
    console.log(JSON.stringify(features, null, 2));
    
    // Test grading step by step
    const gradingEngine = new SyndicateGradingEngine();
    
    console.log('\n🧪 STEP-BY-STEP TESTING:');
    
    // Test individual scoring components
    const config = gradingEngine.getCurrentConfig();
    console.log('Config weights:', config.weights);
    
    // Test core professional_score calculation
    console.log('\n1. Testing Core Score:');
    const coreScore = testCalculateCoreScore(features, config.weights);
    console.log(`Core Score: ${coreScore}`);
    
    // Test market intelligence professional_score
    console.log('\n2. Testing Market Intelligence Score:');
    const marketScore = testCalculateMarketIntelligenceScore(features, config.weights);
    console.log(`Market Score: ${marketScore}`);
    
    // Test ML predictions
    console.log('\n3. Testing ML Predictions:');
    try {
      // This might fail, so we'll catch it
      const mlPredictions = await gradingEngine.scoreWithNeuralNetwork?.(features) || 
                            { score: 50, confidence: 0.5 };
      console.log(`ML Predictions: ${JSON.stringify(mlPredictions)}`);
    } catch (error) {
      console.log(`ML Predictions failed: ${error}`);
    }
    
    // Test the actual grading
    console.log('\n4. Full Grading Test:');
    try {
      const result = await gradingEngine.gradeProp(features);
      console.log('Final Result:');
      console.log(`  Final Score: ${result.finalScore}`);
      console.log(`  Edge Score: ${result.edgeScore}`);
      console.log(`  Tier: ${result.tier}`);
      console.log(`  Confidence: ${result.confidence}`);
      console.log(`  Kelly Fraction: ${result.kellyFraction}`);
    } catch (error) {
      console.error('❌ Grading failed:', error);
      console.error('Stack:', error.stack);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
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
      odds: parseInt(rawProp.odds) || parseInt(rawProp.over_odds) || parseInt(rawProp.under_odds) || -110
    },
    expectedValue: parseFloat(rawProp.expected_value) || 0,
    sharpMoney: parseFloat(rawProp.sharp_money) || 50,
    lineMovement: parseFloat(rawProp.line_movement) || 0,
    matchupRating: parseFloat(rawProp.matchup_rating) || 50,
    playerForm: parseFloat(rawProp.player_form) || 50,
    marketType: rawProp.market_type || rawProp.stat_type,
    odds: parseInt(rawProp.odds) || parseInt(rawProp.over_odds) || parseInt(rawProp.under_odds) || -110,
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
      dataValidationScore: parseFloat(rawProp.data_validation_score) || 0.95
    }
  };
}

// Safe number utility
function safeNumber(value: any, defaultValue: number = 0): number {
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) || !isFinite(num) ? defaultValue : num;
}

function safeWeight(weights: any, key: string, defaultValue: number = 1): number {
  if (!weights || typeof weights !== 'object') return defaultValue;
  return safeNumber(weights[key], defaultValue);
}

function safeMultiply(a: any, b: any, defaultA: number = 0, defaultB: number = 1): number {
  const numA = safeNumber(a, defaultA);
  const numB = safeNumber(b, defaultB);
  const result = numA * numB;
  return isNaN(result) || !isFinite(result) ? 0 : result;
}

function testCalculateCoreScore(features: GradingFeatureSet, weights: any): number {
  let professional_score = 0;

  console.log('  Core professional_score components:');
  
  // Expected Value: 12.5% EV should give high professional_score
  const evValue = safeNumber(features.expectedValue, 0);
  const evScore = Math.min(10, evValue / 1.25);
  const evContribution = safeMultiply(evScore, safeWeight(weights, 'expectedValue', 0.3));
  professional_score += evContribution;
  console.log(`    EV Value: ${evValue}, EV Score: ${evScore}, Weight: ${safeWeight(weights, 'expectedValue', 0.3)}, Contribution: ${evContribution}`);

  // Line Movement: 3.5 points movement is excellent
  const lineValue = safeNumber(features.lineMovement, 0);
  const lineScore = Math.min(10, Math.abs(lineValue) * 2);
  const lineContribution = safeMultiply(lineScore, safeWeight(weights, 'lineMovement', 0.2));
  professional_score += lineContribution;
  console.log(`    Line Value: ${lineValue}, Line Score: ${lineScore}, Contribution: ${lineContribution}`);

  // Other components...
  const matchupValue = safeNumber(features.matchupRating, 50);
  const matchupScore = matchupValue / 10;
  const matchupContribution = safeMultiply(matchupScore, safeWeight(weights, 'matchupRating', 0.25));
  professional_score += matchupContribution;
  console.log(`    Matchup Rating: ${matchupValue}, Score: ${matchupScore}, Contribution: ${matchupContribution}`);

  const result = safeNumber(professional_score, 0);
  console.log(`    Total Core Score: ${result}`);
  return result;
}

function testCalculateMarketIntelligenceScore(features: GradingFeatureSet, weights: any): number {
  let professional_score = 0;

  console.log('  Market intelligence components:');

  // Market Intelligence: 0-100 scale to 0-10
  const marketValue = safeNumber(features.marketIntelligence, 50);
  const marketScore = marketValue / 10;
  const marketContribution = safeMultiply(marketScore, safeWeight(weights, 'marketIntelligence', 0.3));
  professional_score += marketContribution;
  console.log(`    Market Intelligence: ${marketValue}, Score: ${marketScore}, Contribution: ${marketContribution}`);

  // Sharp Money: 0-100 percentage to 0-10
  const sharpValue = safeNumber(features.sharpMoney, 50);
  const sharpScore = sharpValue / 10;
  const sharpContribution = safeMultiply(sharpScore, safeWeight(weights, 'sharpMoney', 0.25));
  professional_score += sharpContribution;
  console.log(`    Sharp Money: ${sharpValue}, Score: ${sharpScore}, Contribution: ${sharpContribution}`);

  const result = safeNumber(professional_score, 0);
  console.log(`    Total Market Intelligence Score: ${result}`);
  return result;
}

// Run the debug
if (require.main === module) {
  debugSpecificNaN()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Debug failed:', error);
      process.exit(1);
    });
}

export { debugSpecificNaN };