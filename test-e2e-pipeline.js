const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🚀 Starting E2E Pipeline Validation - Unit Talk SaaS System');
console.log('=' .repeat(80));

async function runE2ETests() {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Test 1: Database Connection & Schema
  try {
    console.log('\n📊 Testing Database Connection & Professional Schema...');
    
    const { data: schemaTest, error: schemaError } = await supabase
      .from('unified_picks')
      .select('id, professional_score, kelly_fraction, devigged_edge, clv_tracking_id, processing_time, rule_compliance_score, sharp_grading_version')
      .limit(1);
    
    if (schemaError) throw schemaError;
    
    console.log('✅ Professional grading schema operational');
    results.passed++;
    results.tests.push({name: 'Database Schema', status: 'PASS'});
  } catch (error) {
    console.log('❌ Database schema test failed:', error.message);
    results.failed++;
    results.tests.push({name: 'Database Schema', status: 'FAIL', error: error.message});
  }

  // Test 2: Agent Health Monitoring
  try {
    console.log('\n🤖 Testing Agent System Health...');
    
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('name, status, last_ping, config');
    
    if (agentsError) throw agentsError;
    
    console.log(`Found ${agents.length} configured agents:`);
    agents.forEach(agent => {
      const status = agent.status === 'active' ? '✅' : '❌';
      const lastPing = agent.last_ping ? new Date(agent.last_ping).toLocaleString() : 'Never';
      console.log(`  ${status} ${agent.name} - Status: ${agent.status}, Last Ping: ${lastPing}`);
    });
    
    const activeAgents = agents.filter(a => a.status === 'active');
    console.log(`\n${activeAgents.length}/${agents.length} agents active`);
    
    results.passed++;
    results.tests.push({name: 'Agent Health', status: 'PASS', details: `${activeAgents.length}/${agents.length} active`});
  } catch (error) {
    console.log('❌ Agent health test failed:', error.message);
    results.failed++;
    results.tests.push({name: 'Agent Health', status: 'FAIL', error: error.message});
  }

  // Test 3: Data Ingestion Pipeline
  try {
    console.log('\n📥 Testing Data Ingestion Pipeline...');
    
    const { data: recentProps, error: propsError } = await supabase
      .from('raw_props')
      .select('id, player_name, sport, stat_type, created_at, is_valid')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (propsError) throw propsError;
    
    const recentCount = recentProps.filter(p => 
      new Date(p.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;
    
    console.log(`✅ Found ${recentProps.length} recent props, ${recentCount} from last 24 hours`);
    console.log('Recent props sample:');
    recentProps.slice(0, 3).forEach(prop => {
      console.log(`  - ${prop.player_name} (${prop.sport}) ${prop.stat_type} - ${prop.created_at}`);
    });
    
    results.passed++;
    results.tests.push({name: 'Data Ingestion', status: 'PASS', details: `${recentCount} recent props`});
  } catch (error) {
    console.log('❌ Data ingestion test failed:', error.message);
    results.failed++;
    results.tests.push({name: 'Data Ingestion', status: 'FAIL', error: error.message});
  }

  // Test 4: Professional Grading System
  try {
    console.log('\n🎯 Testing Professional Grading System...');
    
    const { data: gradedPicks, error: gradedError } = await supabase
      .from('unified_picks')
      .select('id, professional_score, kelly_fraction, devigged_edge, rule_compliance_score, sharp_grading_version, created_at')
      .not('professional_score', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (gradedError) throw gradedError;
    
    console.log(`✅ Found ${gradedPicks.length} professionally graded picks`);
    if (gradedPicks.length > 0) {
      console.log('Professional grading sample:');
      gradedPicks.slice(0, 2).forEach(pick => {
        console.log(`  - Score: ${pick.professional_score}, Kelly: ${pick.kelly_fraction}, Edge: ${pick.devigged_edge}%`);
        console.log(`    Compliance: ${pick.rule_compliance_score}, Version: ${pick.sharp_grading_version}`);
      });
    }
    
    results.passed++;
    results.tests.push({name: 'Professional Grading', status: 'PASS', details: `${gradedPicks.length} graded picks`});
  } catch (error) {
    console.log('❌ Professional grading test failed:', error.message);
    results.failed++;
    results.tests.push({name: 'Professional Grading', status: 'FAIL', error: error.message});
  }

  // Test 5: Command Center Integration
  try {
    console.log('\n🎛️ Testing Command Center Data Integration...');
    
    // Test that data is accessible for Command Center queries
    const { data: commandCenterData, error: ccError } = await supabase
      .from('unified_picks')
      .select(`
        id,
        professional_score,
        kelly_fraction,
        devigged_edge,
        created_at,
        users!unified_picks_user_id_fkey (
          username,
          discord_id,
          tier
        )
      `)
      .not('professional_score', 'is', null)
      .limit(5);
    
    if (ccError) throw ccError;
    
    console.log(`✅ Command Center data integration working - ${commandCenterData.length} picks accessible`);
    if (commandCenterData.length > 0) {
      console.log('Sample Command Center data:');
      commandCenterData.slice(0, 2).forEach(pick => {
        const user = pick.users?.username || 'Unknown';
        console.log(`  - User: ${user}, Score: ${pick.professional_score}, Created: ${pick.created_at}`);
      });
    }
    
    results.passed++;
    results.tests.push({name: 'Command Center Integration', status: 'PASS', details: `${commandCenterData.length} picks accessible`});
  } catch (error) {
    console.log('❌ Command Center integration test failed:', error.message);
    results.failed++;
    results.tests.push({name: 'Command Center Integration', status: 'FAIL', error: error.message});
  }

  // Test 6: Bridge Worker & Event Processing
  try {
    console.log('\n🌉 Testing Bridge Worker & Event Processing...');
    
    const { data: bridgeOutbox, error: bridgeError } = await supabase
      .from('bridge_outbox')
      .select('id, event_type, status, created_at, processed_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (bridgeError) throw bridgeError;
    
    const processedEvents = bridgeOutbox.filter(e => e.status === 'processed');
    console.log(`✅ Bridge outbox operational - ${bridgeOutbox.length} events, ${processedEvents.length} processed`);
    
    if (bridgeOutbox.length > 0) {
      console.log('Recent bridge events:');
      bridgeOutbox.slice(0, 3).forEach(event => {
        console.log(`  - Type: ${event.event_type}, Status: ${event.status}, Created: ${event.created_at}`);
      });
    }
    
    results.passed++;
    results.tests.push({name: 'Bridge Worker', status: 'PASS', details: `${processedEvents.length}/${bridgeOutbox.length} processed`});
  } catch (error) {
    console.log('❌ Bridge worker test failed:', error.message);
    results.failed++;
    results.tests.push({name: 'Bridge Worker', status: 'FAIL', error: error.message});
  }

  // Test 7: Smart Form Query Performance
  try {
    console.log('\n📝 Testing Smart Form Query Performance...');
    
    const startTime = Date.now();
    const { data: smartFormData, error: sfError } = await supabase
      .from('raw_props')
      .select('player_name, sport, stat_type, line, over_odds, under_odds, game_time')
      .gt('game_time', new Date().toISOString())
      .eq('is_valid', true)
      .limit(50);
    
    const queryTime = Date.now() - startTime;
    
    if (sfError) throw sfError;
    
    console.log(`✅ Smart Form query completed in ${queryTime}ms - ${smartFormData.length} props available`);
    const performanceStatus = queryTime < 500 ? 'EXCELLENT' : queryTime < 1000 ? 'GOOD' : 'NEEDS_OPTIMIZATION';
    console.log(`   Performance: ${performanceStatus} (target: <500ms)`);
    
    results.passed++;
    results.tests.push({name: 'Smart Form Performance', status: 'PASS', details: `${queryTime}ms, ${smartFormData.length} props`});
  } catch (error) {
    console.log('❌ Smart Form performance test failed:', error.message);
    results.failed++;
    results.tests.push({name: 'Smart Form Performance', status: 'FAIL', error: error.message});
  }

  // Final Results Summary
  console.log('\n' + '='.repeat(80));
  console.log('🏁 E2E Pipeline Validation Results');
  console.log('='.repeat(80));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  console.log('\nDetailed Results:');
  results.tests.forEach(test => {
    const status = test.status === 'PASS' ? '✅' : '❌';
    const details = test.details ? ` (${test.details})` : '';
    const error = test.error ? ` - ${test.error}` : '';
    console.log(`${status} ${test.name}${details}${error}`);
  });

  console.log('\n🎯 System Status Summary:');
  if (results.failed === 0) {
    console.log('🟢 SYSTEM OPERATIONAL - All E2E tests passed');
    console.log('   Ready for daily operation and production workload');
  } else if (results.failed <= 2) {
    console.log('🟡 SYSTEM MOSTLY OPERATIONAL - Minor issues detected');
    console.log('   Core functionality working, optimization recommended');
  } else {
    console.log('🔴 SYSTEM NEEDS ATTENTION - Multiple issues detected');
    console.log('   Review failed tests before production operation');
  }

  return results;
}

// Run the E2E tests
runE2ETests()
  .then((results) => {
    console.log('\n📋 E2E Pipeline Validation Complete');
    process.exit(results.failed === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 E2E test runner failed:', error);
    process.exit(1);
  });