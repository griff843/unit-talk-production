#!/usr/bin/env npx tsx

/**
 * Debug GradingEngine NaN Issue
 * 
 * Detailed step-by-step debugging of the GradingEngine calculation process
 * to identify exactly where NaN is being introduced
 */

import { config } from 'dotenv';

import { SyndicateGradingEngine } from '../agents/GradingAgent/scoring/gradingEngine';
import { supabaseClient } from '../services/supabaseClient';
import { GradingFeatureSet } from '../types/GradingFeatureSet';

config();

async function debugGradingEngineNaN() {
  console.log('🔬 DEBUG GRADING ENGINE NaN ISSUE');
  console.log('==================================');
  
  try {
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
    
    if (!nbaProps?.[0] || !mlbProps?.[0]) {
      console.error('❌ Could not find test props');
      return;
    }
    
    const testProps = [
      { name: 'NBA (BROKEN)', prop: nbaProps[0] },
      { name: 'MLB (WORKING)', prop: mlbProps[0] }
    ];
    
    const gradingEngine = new SyndicateGradingEngine();
    
    for (const { name, prop } of testProps) {
      console.log(`\n🎯 DEBUGGING ${name}:`);
      console.log(`  ID: ${prop.id}`);
      console.log(`  Player: ${prop.player_name}`);
      console.log(`  Expected Value: ${prop.expected_value}`);
      
      // Convert to feature set
      const features = convertToFeatureSet(prop);
      
      try {
        // Step 1: Test individual ML model calls
        console.log(`\n  📊 STEP 1: Individual ML Model Tests`);
        const mlManager = (gradingEngine as any).mlModelManager;
        
        const nnResult = await mlManager.scoreWithNeuralNetwork(features);
        console.log(`    Neural Network: professional_score=${nnResult.score}, confidence=${nnResult.confidence}`);
        
        const gbResult = await mlManager.scoreWithGradientBoosting(features);
        console.log(`    Gradient Boosting: professional_score=${gbResult.score}, confidence=${gbResult.confidence}`);
        
        const rfResult = await mlManager.scoreWithRandomForest(features);
        console.log(`    Random Forest: professional_score=${rfResult.score}, confidence=${rfResult.confidence}`);
        
        const ensembleResult = await mlManager.scoreWithEnsemble(features);
        console.log(`    Ensemble: professional_score=${ensembleResult.score}, confidence=${ensembleResult.confidence}, agreement=${ensembleResult.agreement}`);
        
        // Step 2: Test ML predictions structure
        console.log(`\n  📊 STEP 2: ML Predictions Structure Test`);
        const getMLPredictions = (gradingEngine as any).getMLPredictions.bind(gradingEngine);
        const mlPredictions = await getMLPredictions(features);
        console.log(`    ML Predictions:`, JSON.stringify(mlPredictions, null, 4));
        
        // Check for NaN in ML predictions
        const hasMLNaN = isNaN(mlPredictions.neuralNetwork) || 
                        isNaN(mlPredictions.gradientBoosting) || 
                        isNaN(mlPredictions.randomForest) || 
                        isNaN(mlPredictions.ensemble) ||
                        isNaN(mlPredictions.agreement);
        console.log(`    ML Predictions Has NaN: ${hasMLNaN}`);
        
        // Step 3: Test individual scoring components in grading engine
        console.log(`\n  📊 STEP 3: Grading Engine Component Tests`);
        const config = gradingEngine.getCurrentConfig();
        
        // Access private methods for testing
        const calculateCoreScore = (gradingEngine as any).calculateCoreScore.bind(gradingEngine);
        const calculateMarketIntelligenceScore = (gradingEngine as any).calculateMarketIntelligenceScore.bind(gradingEngine);
        const calculateMLScore = (gradingEngine as any).calculateMLScore.bind(gradingEngine);
        const calculateContextScore = (gradingEngine as any).calculateContextScore.bind(gradingEngine);
        const calculateRiskScore = (gradingEngine as any).calculateRiskScore.bind(gradingEngine);
        const calculateProfessionalCapperScore = (gradingEngine as any).calculateProfessionalCapperScore?.bind(gradingEngine);
        
        const coreScore = calculateCoreScore(features, config.weights);
        console.log(`    Core Score: ${coreScore}`);
        
        const marketScore = calculateMarketIntelligenceScore(features, config.weights);
        console.log(`    Market Intelligence Score: ${marketScore}`);
        
        const mlScore = calculateMLScore(mlPredictions, config.weights);
        console.log(`    ML Score: ${mlScore}`);
        
        const contextScore = calculateContextScore(features, config.weights);
        console.log(`    Context Score: ${contextScore}`);
        
        const riskScore = calculateRiskScore(features, config.weights);
        console.log(`    Risk Score: ${riskScore}`);
        
        let professionalScore = 0;
        if (calculateProfessionalCapperScore) {
          try {
            professionalScore = await calculateProfessionalCapperScore(features, config.weights);
            console.log(`    Professional Capper Score: ${professionalScore}`);
          } catch (error) {
            console.log(`    Professional Capper Score Error: ${error.message}`);
          }
        }
        
        // Step 4: Test composite professional_score calculation manually
        console.log(`\n  📊 STEP 4: Manual Composite Score Calculation`);
        const coreContribution = coreScore * 3.5;
        const marketContribution = marketScore * 3;
        const contextContribution = contextScore * 1.5;
        const professionalContribution = professionalScore * 1.2;
        
        console.log(`    Core Contribution: ${coreScore} * 3.5 = ${coreContribution}`);
        console.log(`    Market Contribution: ${marketScore} * 3 = ${marketContribution}`);
        console.log(`    Context Contribution: ${contextScore} * 1.5 = ${contextContribution}`);
        console.log(`    Professional Contribution: ${professionalScore} * 1.2 = ${professionalContribution}`);
        
        let compositeScore = 0;
        compositeScore += coreContribution;
        console.log(`    After Core: ${compositeScore}`);
        compositeScore += marketContribution;
        console.log(`    After Market: ${compositeScore}`);
        compositeScore += contextContribution;
        console.log(`    After Context: ${compositeScore}`);
        compositeScore += professionalContribution;
        console.log(`    After Professional: ${compositeScore}`);
        
        // Add ML contribution
        const mlContribution = mlScore * 2.5;
        console.log(`    ML Contribution: ${mlScore} * 2.5 = ${mlContribution}`);
        compositeScore += mlContribution;
        console.log(`    After ML: ${compositeScore}`);
        
        console.log(`    Final Manual Composite Score: ${compositeScore}`);
        console.log(`    Is Composite Score NaN: ${isNaN(compositeScore)}`);
        
        // Step 5: Test actual grading
        console.log(`\n  📊 STEP 5: Full Grading Test`);
        const result = await gradingEngine.gradeProp(features);
        console.log(`    Final Result:`);
        console.log(`      Final Score: ${result.finalScore}`);
        console.log(`      Edge Score: ${result.edgeScore}`);
        console.log(`      Tier: ${result.tier}`);
        console.log(`      Confidence: ${result.confidence}`);
        console.log(`      Kelly Fraction: ${result.kellyFraction}`);
        
        // Final analysis
        console.log(`\n  🔍 FINAL ANALYSIS:`);
        console.log(`    Individual ML models work: ${!hasMLNaN}`);
        console.log(`    Manual composite calculation: ${!isNaN(compositeScore)}`);
        console.log(`    Full grading produces NaN: ${isNaN(result.finalScore)}`);
        
        if (!isNaN(compositeScore) && isNaN(result.finalScore)) {
          console.log(`    ⚠️  Issue is in final processing after composite score`);
        } else if (isNaN(compositeScore)) {
          console.log(`    ⚠️  Issue is in composite professional_score calculation`);
        }
        
      } catch (error) {
        console.error(`  ❌ Debug failed for ${name}:`, error.message);
        console.error(`  Stack:`, error.stack?.split('\n').slice(0, 3).join('\n'));
      }
      
      console.log(`\n${'='.repeat(70)}`);
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

// Run the debug
if (require.main === module) {
  debugGradingEngineNaN()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Debug failed:', error);
      process.exit(1);
    });
}

export { debugGradingEngineNaN };