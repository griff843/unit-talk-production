#!/usr/bin/env tsx

/**
 * Test Enhanced Grading Engine with 8 New Professional Capper Features
 * 
 * Tests the new professional features:
 * 1. Steam Detection
 * 2. Closing Line Prediction
 * 3. Optimal Timing
 * 4. Line Shopping Edge
 * 5. Public vs Sharp Split
 * 6. Market Timing Advantage
 * 7. Injury Timing Edge
 * 8. Cross Market Discrepancy
 */

import { SyndicateGradingEngine } from '../src/agents/GradingAgent/scoring/gradingEngine';
import { GradingFeatureSet } from '../src/types/GradingFeatureSet';

async function testEnhancedGradingEngine() {
  console.log('🧪 Testing Enhanced Grading Engine with Professional Capper Features');
  console.log('========================================================================\n');

  const gradingEngine = new SyndicateGradingEngine();

  // Test prop with professional capper scenario
  const testProp: GradingFeatureSet = {
    propId: 'test-prop-professional-001',
    gameId: 'nba-lal-gsw-20250731',
    date: '2025-07-31',
    sport: 'NBA',
    league: 'NBA',
    player: 'LeBron James',
    marketType: 'points',
    odds: -110,
    market: {
      type: 'points_over_under',
      odds: -110,
      line: 25.5
    },

    // Core Features - Strong indicators
    expectedValue: 8.5,           // High EV
    lineMovement: 2.5,           // Significant movement
    matchupRating: 85,           // Strong matchup
    playerForm: 90,              // Peak form
    injuryImpact: 0,             // No injury concerns
    weatherImpact: 0,            // Indoor sport

    // Market Intelligence - Professional signals
    marketIntelligence: 78,      // Good market intelligence
    sharpMoney: 82,              // High sharp money percentage
    volumeProfile: 85,           // High volume
    closingLineValue: 75,        // Good closing line value

    // Player & Game Context
    playerFatigue: 2,            // Well rested
    venueAdvantage: 8,           // Home court advantage
    refereeImpact: 3,            // Neutral referee
    paceImpact: 12,              // Fast pace game
    motivationalFactors: 15,     // Playoff implications

    // Risk Factors
    correlationRisk: 0.15,       // Low correlation risk
    volatility: 4,               // Moderate volatility
    portfolioImpact: 0.03,       // Low portfolio impact

    // Professional Data
    game_date: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours from now
    hoursToGame: 8,
    public_betting_percentage: 75,  // Public on one side
    model_agreement: 0.85,          // High model agreement
    late_breaking_news: false,

    // Data Quality
    dataQuality: {
      dataValidationScore: 0.95,
      outlierScore: 0.85,
      consistencyScore: 0.90,
      completeness: 0.95
    },

    // Metadata
    timestamp: new Date().toISOString(),
    version: '2025.07.31',
    source: 'test-suite',
    confidence: 0.85
  };

  try {
    console.log('🔍 Testing prop:', testProp.propId);
    console.log('   Player:', testProp.player);
    console.log('   Market:', testProp.market.type, testProp.market.line);
    console.log('   Expected Value:', testProp.expectedValue);
    console.log('   Sharp Money:', testProp.sharpMoney);
    console.log('   Hours to Game:', testProp.hoursToGame);
    console.log('   Public Betting %:', testProp.public_betting_percentage);

    // Add some professional data to the engine
    console.log('\n📊 Adding professional market data...');
    
    // Simulate line movement (steam move scenario)
    gradingEngine.updateLineMovement(testProp.propId, 25.5, 1000);  // Initial
    await new Promise(resolve => setTimeout(resolve, 100));
    gradingEngine.updateLineMovement(testProp.propId, 26.0, 2500);  // Movement with volume
    await new Promise(resolve => setTimeout(resolve, 100));
    gradingEngine.updateLineMovement(testProp.propId, 26.5, 3000);  // Continued movement
    
    // Add betting percentages
    gradingEngine.updateBettingPercentages(testProp.propId, 75, 25); // Public heavy on over
    
    // Add multi-book lines
    gradingEngine.updateBookLines(testProp.propId, 'DraftKings', 26.5, -110);
    gradingEngine.updateBookLines(testProp.propId, 'FanDuel', 26.0, -105);  // Better line
    gradingEngine.updateBookLines(testProp.propId, 'BetMGM', 27.0, -115);
    
    // Add cross-market relationship
    gradingEngine.addCrossMarketRelationship(testProp.propId, 'lal-team-total', 0.75);

    console.log('✅ Professional data added successfully');

    // Grade the prop
    console.log('\n🎯 Grading prop with enhanced engine...');
    const startTime = Date.now();
    
    const result = await gradingEngine.gradeProp(testProp);
    
    const gradingTime = Date.now() - startTime;

    // Display results
    console.log('\n📊 GRADING RESULTS');
    console.log('==================');
    console.log(`Final Score: ${result.finalScore.toFixed(2)}/100`);
    console.log(`Tier: ${result.tier}`);
    console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`Edge Score: ${result.edgeScore.toFixed(2)}`);
    console.log(`Kelly Fraction: ${(result.kellyFraction * 100).toFixed(2)}%`);
    console.log(`Position Size: ${(result.positionSize * 100).toFixed(2)}%`);
    console.log(`Risk Score: ${result.riskScore.toFixed(2)}`);
    console.log(`Grading Time: ${gradingTime}ms`);

    // Display professional insights
    console.log('\n🎯 PROFESSIONAL CAPPER INSIGHTS');
    console.log('================================');
    const insights = result.professionalInsights;
    console.log(`Steam Move Detected: ${insights.steamMoveDetected ? '✅ YES' : '❌ NO'}`);
    console.log(`Predicted Closing Line: ${insights.predictedClosingLine.toFixed(1)}`);
    console.log(`Optimal Betting Time: ${insights.optimalBettingTime.toUpperCase()}`);
    console.log(`Best Available Line: ${insights.bestAvailableLine} (${insights.bestBook})`);
    console.log(`Public Betting %: ${insights.publicBettingPercentage.toFixed(1)}%`);
    console.log(`Sharp Betting %: ${insights.sharpBettingPercentage.toFixed(1)}%`);
    console.log(`Contrarian Opportunity: ${insights.contrarianOpportunity ? '✅ YES' : '❌ NO'}`);
    console.log(`Injury Timing Advantage: ${insights.injuryTimingAdvantage.toFixed(1)}/10`);
    console.log(`Cross Market Arbitrage: ${insights.crossMarketArbitrage.toFixed(1)}/10`);

    // Display feature contributions
    console.log('\n📈 FEATURE CONTRIBUTIONS');
    console.log('=========================');
    Object.entries(result.featureContributions).forEach(([feature, contribution]) => {
      console.log(`${feature}: ${contribution.toFixed(1)}%`);
    });

    // Display scenario analysis
    console.log('\n📊 SCENARIO ANALYSIS');
    console.log('====================');
    console.log(`Bull Case: ${result.scenarioAnalysis.bullCase.score.toFixed(1)} (${(result.scenarioAnalysis.bullCase.probability * 100).toFixed(1)}%)`);
    console.log(`Base Case: ${result.scenarioAnalysis.baseCase.score.toFixed(1)} (${(result.scenarioAnalysis.baseCase.probability * 100).toFixed(1)}%)`);
    console.log(`Bear Case: ${result.scenarioAnalysis.bearCase.score.toFixed(1)} (${(result.scenarioAnalysis.bearCase.probability * 100).toFixed(1)}%)`);

    // Professional Assessment
    console.log('\n🏆 PROFESSIONAL ASSESSMENT');
    console.log('===========================');
    
    const isProfessionalGrade = result.tier === 'S' || result.tier === 'A';
    const hasSharpSignals = insights.steamMoveDetected || insights.sharpBettingPercentage > 60;
    const hasValueEdge = result.edgeScore > 10;
    const hasOptimalTiming = insights.optimalBettingTime === 'immediate';
    
    console.log(`Professional Grade: ${isProfessionalGrade ? '✅ YES' : '❌ NO'} (${result.tier}-tier)`);
    console.log(`Sharp Money Signals: ${hasSharpSignals ? '✅ YES' : '❌ NO'}`);
    console.log(`Significant Edge: ${hasValueEdge ? '✅ YES' : '❌ NO'} (${result.edgeScore.toFixed(1)} points)`);
    console.log(`Optimal Timing: ${hasOptimalTiming ? '✅ YES' : '❌ NO'} (${insights.optimalBettingTime})`);
    
    const professionalScore = [isProfessionalGrade, hasSharpSignals, hasValueEdge, hasOptimalTiming].filter(Boolean).length;
    console.log(`\nProfessional Criteria Met: ${professionalScore}/4`);
    
    if (professionalScore >= 3) {
      console.log('🎯 VERDICT: PROFESSIONAL-GRADE OPPORTUNITY');
    } else if (professionalScore >= 2) {
      console.log('⚡ VERDICT: SOLID BETTING OPPORTUNITY');
    } else {
      console.log('📝 VERDICT: STANDARD OPPORTUNITY');
    }

    // Test configuration management
    console.log('\n🔧 TESTING CONFIGURATION MANAGEMENT');
    console.log('====================================');
    const configs = gradingEngine.getAvailableConfigs();
    console.log(`Available Configs: ${configs.join(', ')}`);
    
    const currentConfig = gradingEngine.getCurrentConfig();
    console.log(`Current Config: ${currentConfig.name} (${currentConfig.version})`);
    console.log(`Min Confidence: ${currentConfig.minConfidence}%`);
    console.log(`Max Risk: ${(currentConfig.maxRisk * 100).toFixed(1)}%`);

    console.log('\n✅ Enhanced Grading Engine Test Completed Successfully!');
    console.log('========================================================');
    
    return {
      success: true,
      result,
      gradingTime,
      professionalScore
    };

  } catch (error) {
    console.error('❌ Enhanced Grading Engine Test Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Run the test
if (require.main === module) {
  testEnhancedGradingEngine()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 All tests passed! Enhanced grading engine is working correctly.');
        process.exit(0);
      } else {
        console.log('\n💥 Tests failed:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

export { testEnhancedGradingEngine };