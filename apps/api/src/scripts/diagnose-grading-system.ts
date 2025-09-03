#!/usr/bin/env npx tsx

/**
 * Diagnose Grading System - Trace exactly how props are scored
 */

import { config } from 'dotenv';

import { SyndicateGradingEngine } from '../agents/GradingAgent/scoring/gradingEngine';
import { supabaseClient } from '../services/supabaseClient';
import { GradingFeatureSet } from '../types/GradingFeatureSet';

config();

async function diagnoseGradingSystem() {
  console.log('🔬 DIAGNOSING GRADING SYSTEM');
  console.log('=============================');
  
  try {
    // Get a sample prop to trace through the system
    const { data: sampleProps, error } = await supabaseClient
      .from('raw_props')
      .select('*')
      .not('edge_score', 'is', null)
      .limit(3);
      
    if (error || !sampleProps?.length) {
      console.error('❌ Could not fetch sample props:', error?.message);
      return;
    }
    
    console.log('\n📊 SAMPLE PROP ANALYSIS:');
    const prop = sampleProps[0];  // Use first prop for detailed analysis
    
    console.log(`\n🎯 ANALYZING PROP: ${prop.id}`);
    console.log(`Player: ${prop.player_name || 'N/A'}`);
    console.log(`Sport: ${prop.sport}`);
    console.log(`Stat: ${prop.stat_type}`);
    console.log(`Line: ${prop.line}`);
    console.log(`Over Odds: ${prop.over_odds || 'N/A'}`);
    console.log(`Under Odds: ${prop.under_odds || 'N/A'}`);
    console.log(`Current Edge Score: ${prop.edge_score}`);
    console.log(`Current Tier: ${prop.tier}`);
    
    // Convert raw prop to GradingFeatureSet format
    console.log('\n🔄 CONVERTING TO FEATURE SET:');
    const features: GradingFeatureSet = convertToFeatureSet(prop);
    
    console.log('Feature Set Values:');
    console.log(`  Expected Value: ${features.expectedValue}`);
    console.log(`  Sharp Money: ${features.sharpMoney}`);
    console.log(`  Line Movement: ${features.lineMovement}`);
    console.log(`  Matchup Rating: ${features.matchupRating}`);
    console.log(`  Player Form: ${features.playerForm}`);
    console.log(`  Market Intelligence: ${features.marketIntelligence}`);
    console.log(`  Injury Impact: ${features.injuryImpact}`);
    console.log(`  Weather Impact: ${features.weatherImpact}`);
    
    // Initialize grading engine
    console.log('\n🧠 INITIALIZING GRADING ENGINE:');
    const gradingEngine = new SyndicateGradingEngine();
    const availableConfigs = gradingEngine.getAvailableConfigs();
    console.log(`Available Configs: ${availableConfigs.join(', ')}`);
    
    // Grade the prop manually to see what happens
    console.log('\n⚗️ MANUAL GRADING TEST:');
    const result = await gradingEngine.gradeProp(features);
    
    console.log('\n📈 GRADING RESULTS:');
    console.log(`Final Score: ${result.finalScore}`);
    console.log(`Edge Score: ${result.edgeScore}`);
    console.log(`Tier: ${result.tier}`);
    console.log(`Confidence: ${result.confidence}`);
    console.log(`Kelly Fraction: ${result.kellyFraction}`);
    console.log(`Position Size: ${result.positionSize}`);
    console.log(`Risk Score: ${result.riskScore}`);
    
    console.log('\n🔍 FEATURE CONTRIBUTIONS:');
    Object.entries(result.featureContributions).forEach(([feature, contribution]) => {
      console.log(`  ${feature}: ${contribution.toFixed(2)}%`);
    });
    
    console.log('\n🤖 ML MODEL CONTRIBUTIONS:');
    Object.entries(result.modelContributions).forEach(([model, contribution]) => {
      console.log(`  ${model}: ${contribution.toFixed(2)}`);
    });
    
    console.log('\n📊 SCENARIO ANALYSIS:');
    console.log(`  Bull Case: ${result.scenarioAnalysis.bullCase.score.toFixed(1)} (${(result.scenarioAnalysis.bullCase.probability * 100).toFixed(1)}%)`);
    console.log(`  Base Case: ${result.scenarioAnalysis.baseCase.score.toFixed(1)} (${(result.scenarioAnalysis.baseCase.probability * 100).toFixed(1)}%)`);
    console.log(`  Bear Case: ${result.scenarioAnalysis.bearCase.score.toFixed(1)} (${(result.scenarioAnalysis.bearCase.probability * 100).toFixed(1)}%)`);
    
    // Compare with existing database values
    console.log('\n🔄 COMPARISON WITH DATABASE:');
    console.log(`Database Edge Score: ${prop.edge_score} vs Calculated: ${result.edgeScore}`);
    console.log(`Database Tier: ${prop.tier} vs Calculated: ${result.tier}`);
    
    if (prop.edge_score === result.edgeScore && prop.tier === result.tier) {
      console.log('✅ Results match database - system working as designed');
    } else {
      console.log('⚠️ Results differ from database - investigating why...');
    }
    
    // Test with multiple props to see if we get variety
    console.log('\n🔢 TESTING MULTIPLE PROPS FOR VARIETY:');
    const results = [];
    for (let i = 0; i < Math.min(5, sampleProps.length); i++) {
      const testProp = sampleProps[i];
      const testFeatures = convertToFeatureSet(testProp);
      const testResult = await gradingEngine.gradeProp(testFeatures);
      
      results.push({
        id: testProp.id.substring(0, 8),
        player: testProp.player_name || 'N/A',
        sport: testProp.sport,
        finalScore: testResult.finalScore,
        edgeScore: testResult.edgeScore,
        tier: testResult.tier,
        confidence: testResult.confidence
      });
    }
    
    console.log('\nResults Summary:');
    results.forEach(r => {
      console.log(`  ${r.id}: ${r.sport} - ${r.player} | Score: ${r.finalScore.toFixed(1)} | Edge: ${r.edgeScore.toFixed(1)} | Tier: ${r.tier} | Conf: ${(r.confidence * 100).toFixed(1)}%`);
    });
    
    // Check for variety in results
    const uniqueScores = new Set(results.map(r => Math.round(r.finalScore)));
    const uniqueTiers = new Set(results.map(r => r.tier));
    const uniqueEdges = new Set(results.map(r => Math.round(r.edgeScore)));
    
    console.log('\n📊 VARIETY ANALYSIS:');
    console.log(`Unique Final Scores: ${uniqueScores.size} (${Array.from(uniqueScores).join(', ')})`);
    console.log(`Unique Tiers: ${uniqueTiers.size} (${Array.from(uniqueTiers).join(', ')})`);
    console.log(`Unique Edge Scores: ${uniqueEdges.size} (${Array.from(uniqueEdges).join(', ')})`);
    
    if (uniqueScores.size === 1 && uniqueTiers.size === 1) {
      console.log('\n❌ ISSUE IDENTIFIED: All props getting identical scores!');
      console.log('🔍 ROOT CAUSE ANALYSIS:');
      console.log('1. All props may have similar/default feature values');
      console.log('2. Feature extraction from database may be faulty');
      console.log('3. Scoring algorithm may not be considering variations');
      
      // Deep dive into feature extraction
      console.log('\n🔬 FEATURE EXTRACTION ANALYSIS:');
      const firstFeatures = convertToFeatureSet(sampleProps[0]);
      const secondFeatures = convertToFeatureSet(sampleProps[1]);
      
      console.log('\nProp 1 Features:');
      logFeatureValues(firstFeatures);
      console.log('\nProp 2 Features:');
      logFeatureValues(secondFeatures);
      
      // Check if features are identical
      const featuresIdentical = JSON.stringify(firstFeatures) === JSON.stringify(secondFeatures);
      console.log(`\nFeatures Identical: ${featuresIdentical ? '❌ YES - Problem found!' : '✅ NO - Features vary'}`);
      
    } else {
      console.log('\n✅ GOOD: System shows variety in scoring');
    }
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
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
      type: rawProp.market_type || 'unknown',
      line: rawProp.line || 0,
      odds: rawProp.odds || 100
    },
    expectedValue: rawProp.expected_value || 0,
    sharpMoney: rawProp.sharp_money || 50,
    lineMovement: rawProp.line_movement || 0,
    matchupRating: rawProp.matchup_rating || 50,
    playerForm: rawProp.player_form || 50,
    marketType: rawProp.market_type,
    odds: rawProp.odds,
    injuryImpact: rawProp.injury_impact || 0,
    weatherImpact: rawProp.weather_impact || 0,
    marketIntelligence: rawProp.market_intelligence || 50,
    volumeProfile: rawProp.volume_profile || 50,
    closingLineValue: rawProp.closing_line_value || 0,
    playerFatigue: rawProp.player_fatigue || 0,
    venueAdvantage: rawProp.venue_advantage || 0,
    refereeImpact: rawProp.referee_impact || 0,
    paceImpact: rawProp.pace_impact || 0,
    motivationalFactors: rawProp.motivational_factors || 0,
    correlationRisk: rawProp.correlation_risk || 0,
    volatility: rawProp.volatility || 5,
    portfolioImpact: rawProp.portfolio_impact || 0,
    bidAskSpread: rawProp.bid_ask_spread || 0.02,
    timestamp: rawProp.created_at || new Date().toISOString(),
    version: '1.0',
    source: 'database',
    confidence: rawProp.confidence || 50,
    dataQuality: {
      completeness: rawProp.data_completeness || 0.95,
      outlierScore: rawProp.outlier_score || 0.95,
      consistencyScore: rawProp.consistency_score || 0.95,
      dataValidationScore: rawProp.data_validation_score || 0.95
    }
  };
}

function logFeatureValues(features: GradingFeatureSet): void {
  console.log(`  Expected Value: ${features.expectedValue}`);
  console.log(`  Sharp Money: ${features.sharpMoney}`);
  console.log(`  Line Movement: ${features.lineMovement}`);
  console.log(`  Matchup Rating: ${features.matchupRating}`);
  console.log(`  Player Form: ${features.playerForm}`);
  console.log(`  Market Intelligence: ${features.marketIntelligence}`);
  console.log(`  Injury Impact: ${features.injuryImpact}`);
  console.log(`  Weather Impact: ${features.weatherImpact}`);
  console.log(`  Venue Advantage: ${features.venueAdvantage}`);
  console.log(`  Volatility: ${features.volatility}`);
}

// Run the diagnosis
if (require.main === module) {
  diagnoseGradingSystem()
    .then(() => {
      console.log('\n✅ Grading system diagnosis completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Diagnosis failed:', error);
      process.exit(1);
    });
}

export { diagnoseGradingSystem };