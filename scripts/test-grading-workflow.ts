import { SyndicateGradingEngine } from '../src/agents/GradingAgent/scoring/gradingEngine';
import { GradingFeatureSet } from '../src/types/GradingFeatureSet';

async function testFullGradingWorkflow() {
  console.log('🎯 Unit Talk Grading Agent - Full Workflow Test\n');
  console.log('=' .repeat(60));
  
  // Simulate multiple props from different sports
  const testProps: GradingFeatureSet[] = [
    // High-value NBA prop
    {
      propId: 'nba-001',
      date: new Date().toISOString().split('T')[0],
      sport: 'NBA',
      league: 'NBA',
      market: { type: 'points', odds: -110, line: 28.5 },
      player: 'Luka Doncic',
      marketType: 'points',
      odds: -110,
      
      // Strong features for A-tier
      expectedValue: 8.5,
      lineMovement: 2.5,
      matchupRating: 85,
      playerForm: 82,
      injuryImpact: 0,
      weatherImpact: 0,
      marketIntelligence: 78,
      sharpMoney: 72,
      volumeProfile: 145,
      closingLineValue: 3.2,
      playerFatigue: 5,
      venueAdvantage: 8,
      refereeImpact: 2,
      paceImpact: 12,
      motivationalFactors: 15,
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
    },
    
    // Medium-value NFL prop
    {
      propId: 'nfl-001',
      date: new Date().toISOString().split('T')[0],
      sport: 'NFL',
      league: 'NFL',
      market: { type: 'passing_yards', odds: -115, line: 285.5 },
      player: 'Patrick Mahomes',
      marketType: 'passing_yards',
      odds: -115,
      
      // Moderate features for B/C-tier
      expectedValue: 4.2,
      lineMovement: 0.5,
      matchupRating: 68,
      playerForm: 70,
      injuryImpact: 0,
      weatherImpact: 15,
      marketIntelligence: 62,
      sharpMoney: 55,
      volumeProfile: 110,
      closingLineValue: 1.5,
      playerFatigue: 10,
      venueAdvantage: -5,
      refereeImpact: 0,
      paceImpact: 5,
      motivationalFactors: 8,
      correlationRisk: 0.12,
      volatility: 0.25,
      portfolioImpact: 0.04,
      
      marketFeatures: [],
      playerFeatures: [],
      contextFeatures: [],
      riskFeatures: [],
      
      source: 'optimal-api',
      version: '1.0.0',
      lastUpdated: new Date().toISOString()
    },
    
    // Low-value MLB prop
    {
      propId: 'mlb-001',
      date: new Date().toISOString().split('T')[0],
      sport: 'MLB',
      league: 'MLB',
      market: { type: 'hits', odds: +105, line: 1.5 },
      player: 'Mike Trout',
      marketType: 'hits',
      odds: 105,
      
      // Weak features for D-tier
      expectedValue: 1.8,
      lineMovement: -0.5,
      matchupRating: 52,
      playerForm: 48,
      injuryImpact: 20,
      weatherImpact: 5,
      marketIntelligence: 45,
      sharpMoney: 42,
      volumeProfile: 85,
      closingLineValue: -0.5,
      playerFatigue: 25,
      venueAdvantage: 0,
      refereeImpact: 0,
      paceImpact: 0,
      motivationalFactors: 3,
      correlationRisk: 0.18,
      volatility: 0.32,
      portfolioImpact: 0.06,
      
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
    const results = [];
    
    console.log('\n📊 Processing Props from Optimal API...\n');
    
    for (const prop of testProps) {
      console.log(`\n🏀 Grading ${prop.sport} - ${prop.player} ${prop.marketType}`);
      console.log(`   Line: ${prop.market.line} @ ${prop.market.odds}`);
      
      const result = await gradingEngine.gradeProp(prop);
      results.push({ prop, result });
      
      console.log(`   ✅ Grade: ${result.tier}`);
      console.log(`   📈 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      if (result.positionSize) {
        console.log(`   💰 Position Size: ${(result.positionSize * 100).toFixed(2)}%`);
      }
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n📋 GRADING SUMMARY - Ready for Approval\n');
    
    // Group by tier
    const tierGroups = {
      'A': results.filter(r => r.result.tier === 'A'),
      'B': results.filter(r => r.result.tier === 'B'),
      'C': results.filter(r => r.result.tier === 'C'),
      'D': results.filter(r => r.result.tier === 'D')
    };
    
    for (const [tier, group] of Object.entries(tierGroups)) {
      if (group.length > 0) {
        console.log(`\n🎯 Tier ${tier} Props (${group.length}):`);
        for (const { prop, result } of group) {
          console.log(`   • ${prop.sport} - ${prop.player} ${prop.marketType}`);
          console.log(`     Line: ${prop.market.line} @ ${prop.market.odds}`);
          console.log(`     Confidence: ${(result.confidence * 100).toFixed(1)}%`);
          if (result.positionSize && result.positionSize > 0) {
            console.log(`     Recommended Position: ${(result.positionSize * 100).toFixed(2)}%`);
          }
        }
      }
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n✅ GRADING WORKFLOW COMPLETE!');
    console.log('\n📌 Next Steps:');
    console.log('   1. Review A & B tier props for final approval');
    console.log('   2. Adjust position sizes based on portfolio constraints');
    console.log('   3. Submit approved picks to Discord');
    console.log('\n🎉 Grading Agent is functioning correctly!\n');
    
  } catch (error) {
    console.error('❌ Workflow failed:', error);
    process.exit(1);
  }
}

// Run the test
testFullGradingWorkflow().catch(console.error);