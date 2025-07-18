import { SyndicateGradingEngine } from '../src/agents/GradingAgent/scoring/gradingEngine';
import { GradingFeatureSet } from '../src/types/GradingFeatureSet';

async function testHighTierProps() {
  console.log('🎯 Testing High-Tier Props (A/S Grade)\n');
  console.log('=' .repeat(60));
  
  const highTierProps: GradingFeatureSet[] = [
    // S-tier NBA prop - exceptional value
    {
      propId: 's-tier-001',
      date: new Date().toISOString().split('T')[0],
      sport: 'NBA',
      league: 'NBA',
      market: { type: 'points', odds: -110, line: 24.5 },
      player: 'Giannis Antetokounmpo',
      marketType: 'points',
      odds: -110,
      outcome: 'over', // Adding outcome field

      // Exceptional features for S-tier
      expectedValue: 12.5,  // Very high EV
      lineMovement: 3.5,    // Strong line movement in our favor
      matchupRating: 92,    // Excellent matchup
      playerForm: 95,       // Peak form
      injuryImpact: 0,      // Healthy
      weatherImpact: 0,     // Indoor
      marketIntelligence: 88,
      sharpMoney: 85,       // Heavy sharp action
      volumeProfile: 180,   // High volume
      closingLineValue: 4.5,
      playerFatigue: 0,     // Well rested
      venueAdvantage: 12,   // Strong home court
      refereeImpact: 5,     // Favorable refs
      paceImpact: 15,       // Fast pace benefits
      motivationalFactors: 20, // Revenge game
      correlationRisk: 0.05,
      volatility: 0.12,
      portfolioImpact: 0.02,
      
      marketFeatures: [],
      playerFeatures: [],
      contextFeatures: [],
      riskFeatures: [],
      
      source: 'optimal-api',
      version: '1.0.0',
      lastUpdated: new Date().toISOString()
    },
    
    // A-tier NFL prop - strong value
    {
      propId: 'a-tier-001',
      date: new Date().toISOString().split('T')[0],
      sport: 'NFL',
      league: 'NFL',
      market: { type: 'rushing_yards', odds: -115, line: 72.5 },
      player: 'Christian McCaffrey',
      marketType: 'rushing_yards',
      odds: -115,
      outcome: 'over',

      // Strong features for A-tier
      expectedValue: 8.2,
      lineMovement: 2.0,
      matchupRating: 85,
      playerForm: 88,
      injuryImpact: 0,
      weatherImpact: 0,
      marketIntelligence: 80,
      sharpMoney: 75,
      volumeProfile: 150,
      closingLineValue: 3.0,
      playerFatigue: 5,
      venueAdvantage: 8,
      refereeImpact: 0,
      paceImpact: 10,
      motivationalFactors: 12,
      correlationRisk: 0.08,
      volatility: 0.18,
      portfolioImpact: 0.03,
      
      marketFeatures: [],
      playerFeatures: [],
      contextFeatures: [],
      riskFeatures: [],
      
      source: 'optimal-api',
      version: '1.0.0',
      lastUpdated: new Date().toISOString()
    }
  ];

  try {
    const gradingEngine = new SyndicateGradingEngine();
    
    console.log('\n📊 Grading High-Value Props...\n');

    for (const prop of highTierProps) {
      console.log(`\n🏆 ${prop.propId} - ${prop.sport} ${prop.player}`);
      console.log(`   Market: ${prop.marketType} ${prop.outcome} ${prop.market.line} @ ${prop.market.odds}`);
      console.log(`   Expected Value: ${prop.expectedValue}%`);
      console.log(`   Sharp Money: ${prop.sharpMoney}%`);

      const result = await gradingEngine.gradeProp(prop);

      console.log(`\n   ✅ GRADE: ${result.tier}`);
      console.log(`   📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`   💰 Position Size: ${(result.positionSize * 100).toFixed(2)}%`);

      if (result.tier === 'S' || result.tier === 'A') {
        console.log(`   ✨ HIGH-VALUE PROP CONFIRMED!`);
      } else {
        console.log(`   ⚠️  WARNING: Expected S/A tier but got ${result.tier}`);
        console.log(`   📈 Final Score: ${result.finalScore.toFixed(2)}`);
        console.log(`   🎯 Edge Score: ${result.edgeScore.toFixed(2)}`);
        console.log(`   ⚡ Risk Score: ${result.riskScore.toFixed(2)}`);
      }
      
      if (result.tier === 'S' || result.tier === 'A') {
        console.log(`   ✨ HIGH-VALUE PROP CONFIRMED!`);
      }
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ High-tier grading test completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testHighTierProps().catch(console.error);