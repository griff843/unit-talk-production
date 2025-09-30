#!/usr/bin/env npx tsx

/**
 * Pinpoint NaN Source
 * 
 * Trace the exact method and line where NaN is introduced for NBA props
 * by intercepting every calculation step in the GradingEngine
 */

import { config } from 'dotenv';

import { SyndicateGradingEngine } from '../agents/ScoringAgent/scoring/gradingEngine';
import { supabaseClient } from '../utils/supabaseUtils';
import { GradingFeatureSet } from '../types/GradingFeatureSet';
import { requireSupabase } from '../utils/supabaseUtils';

config();

async function pinpointNaNSource() {
  console.log('🎯 PINPOINT NaN SOURCE');
  console.log('=======================');
  
  try {
    // Get NBA prop that produces NaN
    const supabaseClient = requireSupabase();
      const { data: nbaProps } = await supabaseClient
      .from('sports_game_odds')
      .select('*')
      .eq('sport', 'NBA')
      .limit(1);
      
    if (!nbaProps?.[0]) {
      console.error('❌ Could not find NBA prop');
      return;
    }
    
    const prop = nbaProps[0];
    console.log(`🏀 Testing NBA prop: ${prop.player_name} (${prop.stat_type})`);
    
    const features = convertToFeatureSet(prop);
    const gradingEngine = new SyndicateGradingEngine();
    
    // Step-by-step tracing through the gradeProp method
    console.log('\n📊 STEP-BY-STEP TRACING:');
    
    // 1. Feature engineering
    console.log('1. Feature Engineering...');
    const featureEngineer = (gradingEngine as any).featureEngineer;
    const enrichedFeatures = await featureEngineer.enrichFeatures(features);
    console.log(`   Features enriched: ${!isNaN(enrichedFeatures.expectedValue)}`);
    
    // 2. ML Predictions
    console.log('2. ML Predictions...');
    const getMLPredictions = (gradingEngine as any).getMLPredictions.bind(gradingEngine);
    const mlPredictions = await getMLPredictions(enrichedFeatures);
    console.log(`   ML predictions valid: ${!isNaN(mlPredictions.neuralNetwork)}`);
    console.log(`   Agreement: ${mlPredictions.agreement}`);
    
    // 3. Calculate composite professional_score
    console.log('3. Composite Score Calculation...');
    const calculateCompositeScore = (gradingEngine as any).calculateCompositeScore.bind(gradingEngine);
    const compositeScore = await calculateCompositeScore(enrichedFeatures, mlPredictions);
    console.log(`   Composite professional_score valid: ${!isNaN(compositeScore.finalScore)}`);
    console.log(`   Final Score: ${compositeScore.finalScore}`);
    console.log(`   Edge Score: ${compositeScore.edgeScore}`);
    
    // 4. Initial confidence calculation
    console.log('4. Initial Confidence Calculation...');
    const initialConfidence = Math.min(100, 
      (compositeScore.finalScore || 0) * (mlPredictions.agreement || 0.5)
    );
    console.log(`   Initial confidence: ${initialConfidence}`);
    console.log(`   Initial confidence valid: ${!isNaN(initialConfidence)}`);
    
    // 5. Risk assessment
    console.log('5. Risk Assessment...');
    const assessRisk = (gradingEngine as any).assessRisk.bind(gradingEngine);
    const riskAssessment = await assessRisk(enrichedFeatures, compositeScore, initialConfidence);
    console.log(`   Risk score: ${riskAssessment.riskScore}`);
    console.log(`   Risk assessment valid: ${!isNaN(riskAssessment.riskScore)}`);
    
    // 6. Professional insights
    console.log('6. Professional Insights...');
    const calculateProfessionalInsights = (gradingEngine as any).calculateProfessionalInsights.bind(gradingEngine);
    const professionalInsights = await calculateProfessionalInsights(enrichedFeatures);
    console.log(`   Professional insights calculated`);
    
    // 7. Feature contributions
    console.log('7. Feature Contributions...');
    const calculateFeatureContributions = (gradingEngine as any).calculateFeatureContributions.bind(gradingEngine);
    const featureContributions = calculateFeatureContributions(enrichedFeatures, compositeScore);
    console.log(`   Feature contributions calculated`);
    
    // 8. Tier and confidence determination
    console.log('8. Tier and Confidence Determination...');
    const determineTierAndConfidence = (gradingEngine as any).determineTierAndConfidence.bind(gradingEngine);
    const tierResult = determineTierAndConfidence(compositeScore, riskAssessment, enrichedFeatures);
    console.log(`   Tier: ${tierResult.tier}`);
    console.log(`   Confidence: ${tierResult.confidence}`);
    console.log(`   Tier confidence valid: ${!isNaN(tierResult.confidence)}`);
    
    // 9. Kelly fraction calculation
    console.log('9. Kelly Fraction Calculation...');
    const calculateKellyFraction = (gradingEngine as any).calculateKellyFraction.bind(gradingEngine);
    const kellyFraction = calculateKellyFraction(enrichedFeatures, compositeScore, riskAssessment);
    console.log(`   Kelly fraction: ${kellyFraction}`);
    console.log(`   Kelly fraction valid: ${!isNaN(kellyFraction)}`);
    
    // 10. Position size calculation
    console.log('10. Position Size Calculation...');
    const riskManager = (gradingEngine as any).riskManager;
    const rawPositionSize = await riskManager.calculatePositionSize(kellyFraction, riskAssessment.riskScore);
    console.log(`   Raw position size: ${rawPositionSize}`);
    console.log(`   Position size valid: ${!isNaN(rawPositionSize)}`);
    
    // 11. Tier-based minimum position adjustment
    console.log('11. Position Size Adjustment...');
    let positionSize = rawPositionSize;
    if (tierResult.tier === 'S' && positionSize < 0.05) {positionSize = 0.05;}
    if (tierResult.tier === 'A' && positionSize < 0.03) {positionSize = 0.03;}
    if (tierResult.tier === 'B' && positionSize < 0.015) {positionSize = 0.015;}
    console.log(`   Adjusted position size: ${positionSize}`);
    
    // 12. Scenario analysis
    console.log('12. Scenario Analysis...');
    const analyzeScenarios = (gradingEngine as any).analyzeScenarios.bind(gradingEngine);
    const scenarioAnalysis = analyzeScenarios(compositeScore, riskAssessment, enrichedFeatures);
    console.log(`   Scenario analysis completed`);
    
    // 13. Final return object construction
    console.log('13. Final Return Object...');
    const finalResult = {
      finalScore: compositeScore.finalScore,
      edgeScore: compositeScore.edgeScore,
      tier: tierResult.tier,
      confidence: tierResult.confidence,
      kellyFraction: kellyFraction,
      positionSize: positionSize,
      riskAssessment,
      breakdown: compositeScore.breakdown,
      featureContributions,
      professionalInsights,
      scenarioAnalysis
    };
    
    console.log('\n🔍 FINAL ANALYSIS:');
    console.log(`Final Score: ${finalResult.finalScore} ${isNaN(finalResult.finalScore) ? '❌ NaN' : '✅ Valid'}`);
    console.log(`Edge Score: ${finalResult.edgeScore} ${isNaN(finalResult.edgeScore) ? '❌ NaN' : '✅ Valid'}`);
    console.log(`Confidence: ${finalResult.confidence} ${isNaN(finalResult.confidence) ? '❌ NaN' : '✅ Valid'}`);
    console.log(`Kelly Fraction: ${finalResult.kellyFraction} ${isNaN(finalResult.kellyFraction) ? '❌ NaN' : '✅ Valid'}`);
    console.log(`Position Size: ${finalResult.positionSize} ${isNaN(finalResult.positionSize) ? '❌ NaN' : '✅ Valid'}`);
    
    // Test the actual gradeProp method
    console.log('\n🧪 ACTUAL METHOD TEST:');
    const actualResult = await gradingEngine.gradeProp(features);
    console.log(`Actual Final Score: ${actualResult.finalScore} ${isNaN(actualResult.finalScore) ? '❌ NaN' : '✅ Valid'}`);
    
    // If actual differs from manual, there's something in the method we missed
    const manualFinalScore = finalResult.finalScore;
    const actualFinalScore = actualResult.finalScore;
    
    if (!isNaN(manualFinalScore) && isNaN(actualFinalScore)) {
      console.log('⚠️  DISCREPANCY: Manual calculation works, but actual method fails');
      console.log('   This suggests there is validation or processing logic in gradeProp that we missed');
    } else if (isNaN(manualFinalScore) && isNaN(actualFinalScore)) {
      console.log('✅ CONSISTENT: Both manual and actual produce NaN at the same step');
    } else if (!isNaN(manualFinalScore) && !isNaN(actualFinalScore)) {
      console.log('✅ BOTH WORK: The issue might be resolved');
    }
    
  } catch (error) {
    console.error('❌ Pinpoint failed:', error);
    console.error('Stack:', error.stack);
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

// Run the pinpoint
if (require.main === module) {
  pinpointNaNSource()
    .then(() => {
      console.log('\n✅ Pinpoint completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Pinpoint failed:', error);
      process.exit(1);
    });
}

export { pinpointNaNSource };