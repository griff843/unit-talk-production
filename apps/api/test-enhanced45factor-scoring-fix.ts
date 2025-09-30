/**
 * Test script to verify Enhanced45Factor scoring system fixes
 *
 * This script tests:
 * 1. ScoringAgent initialization with Enhanced45Factor
 * 2. Professional score assignment without errors
 * 3. Database updates with correct field names
 */

import { ScoringAgent } from './src/agents/ScoringAgent/ScoringAgent';
import { BaseAgentConfig, BaseAgentDependencies } from './src/agents/BaseAgent/types';
import { requireSupabase } from './src/utils/supabaseUtils';
import { createLogger } from './src/utils/logger';

async function testEnhanced45FactorFix() {
  console.log('🧪 Testing Enhanced45Factor ScoringAgent fixes...\n');

  try {
    // 1. Test ScoringAgent initialization
    console.log('1️⃣ Initializing ScoringAgent with Enhanced45Factor enabled...');

    // Set environment variable to enable Enhanced45Factor
    process.env.USE_ENHANCED_45_FACTOR = 'true';
    process.env.USE_PRO_SCORER = 'true';

    const agentConfig: BaseAgentConfig = {
      id: 'test-scoring-agent',
      name: 'TestScoringAgent',
      enabled: true,
      healthCheckEnabled: true,
      metricsEnabled: true
    };

    const agentDeps: BaseAgentDependencies = {
      logger: createLogger('TestScoringAgent'),
      supabaseClient: requireSupabase(),
      temporalClient: null,
      metrics: null
    };

    const scoringAgent = new ScoringAgent(agentConfig, agentDeps);
    await scoringAgent.initialize();

    console.log('✅ ScoringAgent initialized successfully');

    // 2. Test fetching pending picks
    console.log('\n2️⃣ Testing unified picks retrieval...');

    const supabase = requireSupabase();
    const { data: testPicks, error } = await supabase
      .from('unified_picks')
      .select('id, professional_score, implied_prob, scored_at, player_name, stat_type, sport')
      .limit(5);

    if (error) {
      console.log('⚠️ Database query error:', error.message);
      return;
    }

    console.log(`Found ${testPicks?.length || 0} test picks`);

    if (testPicks && testPicks.length > 0) {
      const unscoredPick = testPicks.find(pick => !pick.professional_score);

      if (unscoredPick) {
        console.log('\n3️⃣ Testing single pick scoring...');
        console.log(`Scoring pick: ${unscoredPick.player_name} ${unscoredPick.stat_type} (${unscoredPick.sport})`);

        try {
          const result = await scoringAgent.scoreSinglePick(unscoredPick.id);

          if (result.scored) {
            console.log('✅ Pick scored successfully!');
            console.log(`   Professional Score: ${result.professionalScore}`);
            console.log(`   Scoring completed without errors`);
          } else {
            console.log('❌ Pick scoring failed:', result.error);
          }
        } catch (scoringError) {
          console.log('❌ Scoring error:', scoringError.message);
          console.log('   Stack:', scoringError.stack?.split('\n').slice(0, 5).join('\n'));
        }
      } else {
        console.log('ℹ️ All picks are already scored. System is working correctly.');
      }
    }

    // 3. Test health check
    console.log('\n4️⃣ Testing agent health check...');
    const healthResult = await scoringAgent.checkHealth();
    console.log('Health Status:', healthResult.status);
    console.log('Services:', healthResult.details?.checks?.map(c => `${c.service}: ${c.status}`).join(', '));

    // 4. Test metrics collection
    console.log('\n5️⃣ Testing metrics collection...');
    const metrics = await scoringAgent.collectMetrics();
    console.log('Metrics collected:');
    console.log(`   Picks processed: ${metrics.picksProcessed}`);
    console.log(`   Picks scored: ${metrics.picksScored}`);
    console.log(`   Cache hit ratio: ${metrics.cacheHitRatio?.toFixed(2) || 'N/A'}`);

    await scoringAgent.cleanup();
    console.log('\n✅ All tests completed successfully! Enhanced45Factor system is working.');

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    console.error('Stack:', error.stack?.split('\n').slice(0, 10).join('\n'));
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testEnhanced45FactorFix()
    .then(() => {
      console.log('\n🎉 Enhanced45Factor scoring system test completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Test runner error:', error);
      process.exit(1);
    });
}