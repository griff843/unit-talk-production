import { SyndicateGradingEngine } from '../src/agents/GradingAgent/scoring/gradingEngine';
import { GradingFeatureSet } from '../src/types/GradingFeatureSet';

async function testGradingAgent() {
  console.log('🧪 Testing Grading Agent...\n');

  // Create a mock feature set
  const mockFeatureSet: GradingFeatureSet = {
    propId: 'test-prop-001',
    date: new Date().toISOString().split('T')[0],
    sport: 'NBA',
    league: 'NBA',
    market: {
      type: 'points',
      odds: -110,
      line: 25.5
    },
    
    // Core Features
    expectedValue: 5.2,
    lineMovement: 0.5,
    matchupRating: 72,
    playerForm: 68,
    injuryImpact: 0,
    weatherImpact: 0,
    
    // Market Intelligence
    marketIntelligence: 65,
    sharpMoney: 58,
    volumeProfile: 120,
    closingLineValue: 2.1,
    
    // Player & Game Context
    playerFatigue: 15,
    venueAdvantage: 5,
    refereeImpact: 0,
    paceImpact: 8,
    motivationalFactors: 10,
    
    // Risk & Correlation
    correlationRisk: 0.15,
    volatility: 0.22,
    portfolioImpact: 0.05,
    
    // Raw Features
    marketFeatures: [],
    playerFeatures: [],
    contextFeatures: [],
    riskFeatures: [],
    
    // Optional properties
    player: 'LeBron James',
    marketType: 'points',
    odds: -110,
    
    // Metadata
    source: 'test',
    version: '1.0.0',
    lastUpdated: new Date().toISOString()
  };

  try {
    // Initialize grading engine
    const gradingEngine = new SyndicateGradingEngine();
    
    console.log('📊 Test Feature Set:');
    console.log(`   Sport: ${mockFeatureSet.sport}`);
    console.log(`   Player: ${mockFeatureSet.player}`);
    console.log(`   Market: ${mockFeatureSet.market.type}`);
    console.log(`   Line: ${mockFeatureSet.market.line}`);
    console.log(`   Odds: ${mockFeatureSet.market.odds}`);
    console.log(`   Expected Value: ${mockFeatureSet.expectedValue}%\n`);
    
    // Grade the prop
    console.log('🎯 Grading prop...');
    const result = await gradingEngine.gradeProp(mockFeatureSet);
    
    console.log('\n✅ Grading Result:');
    console.log(`   Tier: ${result.tier}`);
    if (result.score !== undefined) {
      console.log(`   Score: ${result.score.toFixed(2)}`);
    }
    if (result.confidence !== undefined) {
      console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    }
    if (result.positionSize !== undefined) {
      console.log(`   Position Size: ${(result.positionSize * 100).toFixed(2)}%`);
    }

    if (result.reasoning) {
      console.log('\n📝 Reasoning:');
      console.log(`   ${result.reasoning}`);
    }

    if (result.riskAssessment) {
      console.log('\n⚠️ Risk Assessment:');
      console.log(`   Overall Risk: ${result.riskAssessment.overallRisk.toFixed(2)}`);
      console.log(`   Risk Level: ${result.riskAssessment.riskLevel}`);
    }

    console.log('\n✅ Grading Agent test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testGradingAgent().catch(console.error);