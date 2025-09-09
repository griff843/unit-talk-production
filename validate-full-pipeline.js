const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

console.log('🔍 Validating Complete Data Pipeline After FeedAgent Execution');
console.log('='.repeat(70));

async function validatePipeline() {
  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  
  try {
    // Check raw_props for new data
    console.log('📊 RAW PROPS VALIDATION:');
    const { data: newRawProps, error: rawError } = await supabase
      .from('raw_props')
      .select('id, sport, created_at')
      .gte('created_at', fifteenMinutesAgo);
    
    if (rawError) throw rawError;
    
    const sportBreakdown = newRawProps.reduce((acc, prop) => {
      acc[prop.sport] = (acc[prop.sport] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`✅ New raw props in last 15 mins: ${newRawProps.length}`);
    console.log('   Sport breakdown:', sportBreakdown);
    
    // Check unified_picks for professionally graded data
    console.log('\n🎯 PROFESSIONAL GRADING VALIDATION:');
    const { data: newGradedPicks, error: gradedError } = await supabase
      .from('unified_picks')
      .select('id, professional_score, kelly_fraction, devigged_edge, sport, created_at')
      .gte('created_at', fifteenMinutesAgo)
      .not('professional_score', 'is', null);
    
    if (gradedError) throw gradedError;
    
    console.log(`📈 New professionally graded picks: ${newGradedPicks.length}`);
    
    if (newGradedPicks.length > 0) {
      const gradedSportBreakdown = newGradedPicks.reduce((acc, pick) => {
        acc[pick.sport] = (acc[pick.sport] || 0) + 1;
        return acc;
      }, {});
      console.log('   Professionally graded by sport:', gradedSportBreakdown);
      
      // Show sample professional grading
      const samplePick = newGradedPicks[0];
      console.log('\n   Sample professional pick:');
      console.log(`     Score: ${samplePick.professional_score}`);
      console.log(`     Kelly: ${samplePick.kelly_fraction}`);
      console.log(`     Edge: ${samplePick.devigged_edge}%`);
    } else {
      console.log('❌ NO PROFESSIONALLY GRADED PICKS - GradingAgent not processing new data');
    }
    
    // Check bridge_outbox for workflow events
    console.log('\n🌉 WORKFLOW ORCHESTRATION VALIDATION:');
    const { data: newWorkflowEvents, error: workflowError } = await supabase
      .from('bridge_outbox')
      .select('id, event_type, status, created_at')
      .gte('created_at', fifteenMinutesAgo);
    
    if (workflowError) throw workflowError;
    
    console.log(`🔄 New workflow events: ${newWorkflowEvents.length}`);
    if (newWorkflowEvents.length > 0) {
      const eventBreakdown = newWorkflowEvents.reduce((acc, event) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1;
        return acc;
      }, {});
      console.log('   Event types:', eventBreakdown);
    }
    
    // Check NCAAF routing issue
    console.log('\n🏈 NCAAF ROUTING ISSUE CHECK:');
    const { data: ncaafProps, error: ncaafError } = await supabase
      .from('raw_props')
      .select('id, sport, created_at')
      .eq('sport', 'NCAAF')
      .gte('created_at', fifteenMinutesAgo);
    
    if (ncaafError) throw ncaafError;
    console.log(`NCAAF props ingested: ${ncaafProps.length} (should be 79+ from Odds API)`);
    
    if (ncaafProps.length === 0) {
      console.log('❌ NCAAF routing failed - Optimal API doesnt support NCAAF');
      console.log('   ➡️ Need to fix dataSourceRouter to use Odds API for NCAAF');
    }
    
    // Pipeline health summary
    console.log('\n📋 PIPELINE HEALTH SUMMARY:');
    console.log('='.repeat(40));
    console.log(`Raw Props Ingested: ${newRawProps.length} ${newRawProps.length > 0 ? '✅' : '❌'}`);
    console.log(`Professional Grading: ${newGradedPicks.length > 0 ? '✅' : '❌'} (${newGradedPicks.length} picks)`);
    console.log(`Workflow Events: ${newWorkflowEvents.length > 0 ? '✅' : '⚠️'} (${newWorkflowEvents.length} events)`);
    console.log(`NCAAF Coverage: ${ncaafProps.length > 0 ? '✅' : '❌'} (${ncaafProps.length} props)`);
    
    if (newRawProps.length > 0 && newGradedPicks.length === 0) {
      console.log('\n🚨 CRITICAL ISSUE: Props ingested but not professionally graded');
      console.log('   ➡️ GradingAgent needs to be triggered or scheduled');
      console.log('   ➡️ Check GradingAgent configuration and execution');
      return false;
    }
    
    if (newRawProps.length > 0 && newGradedPicks.length > 0) {
      const gradingRate = (newGradedPicks.length / newRawProps.length * 100).toFixed(1);
      console.log(`\n🎯 Grading Rate: ${gradingRate}% (${newGradedPicks.length}/${newRawProps.length})`);
      
      if (gradingRate < 50) {
        console.log('⚠️ Low grading rate - some props may not meet grading criteria');
      } else {
        console.log('✅ Good grading rate - pipeline working well');
      }
    }
    
    return {
      rawProps: newRawProps.length,
      gradedPicks: newGradedPicks.length,
      workflowEvents: newWorkflowEvents.length,
      ncaafProps: ncaafProps.length,
      pipelineHealthy: newRawProps.length > 0 && newGradedPicks.length > 0
    };
    
  } catch (error) {
    console.error('💥 Pipeline validation failed:', error.message);
    return null;
  }
}

validatePipeline().then(result => {
  if (result) {
    console.log('\n🎯 NEXT ACTIONS NEEDED:');
    if (result.rawProps > 0 && result.gradedPicks === 0) {
      console.log('1. ⚡ URGENT: Trigger GradingAgent to process the 9,557 new props');
      console.log('2. 🔧 Fix NCAAF routing to use Odds API instead of Optimal API');
      console.log('3. ✅ Validate complete pipeline: FeedAgent → GradingAgent → Command Center');
    } else if (result.pipelineHealthy) {
      console.log('1. ✅ Pipeline working! Now optimize and schedule automatic execution');
      console.log('2. 🔧 Fix NCAAF routing for complete sports coverage');
    }
  }
});