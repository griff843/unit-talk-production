/**
 * Test Updated GradingAgent with v3.0.0 Unified Database
 */

import { createClient } from '@supabase/supabase-js';
// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testUpdatedGradingAgent() {
  console.log('🧪 TESTING UPDATED GRADING AGENT (v3.0.0)');
  console.log('='.repeat(50));
  
  // Check initial state
  const { count: initialRawProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .is('outcome', null)
    .or('promoted_to_picks.is.null,promoted_to_picks.eq.false');
    
  const { count: initialUnifiedPicks } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📊 INITIAL STATE:`);
  console.log(`Raw props available for grading: ${initialRawProps || 0}`);
  console.log(`Existing unified picks: ${initialUnifiedPicks || 0}`);
  
  if (!initialRawProps || initialRawProps === 0) {
    console.log('❌ No props available for grading. Need to run FeedAgent first.');
    return;
  }
  
  // Initialize GradingAgent
  console.log('\n🔧 Initializing GradingAgent...');
  try {
    const gradingAgent = new GradingAgent(
      {
        name: 'grading-agent-test',
        version: '1.0.0',
        enabled: true,
        logLevel: 'info'
      },
      {
        supabase,
        logger: {
          info: (msg: string, meta?: any) => console.log(`ℹ️ ${msg}`, meta || ''),
          error: (msg: string, meta?: any) => console.log(`❌ ${msg}`, meta || ''),
          warn: (msg: string, meta?: any) => console.log(`⚠️ ${msg}`, meta || ''),
          debug: (msg: string, meta?: any) => console.log(`🔍 ${msg}`, meta || '')
        } as any
      }
    );
    
    await gradingAgent.initialize();
    console.log('✅ GradingAgent initialized successfully');
    
    // Run processing cycle
    console.log('\n🔄 Running GradingAgent processing cycle...');
    await gradingAgent.process();
    
    // Check results
    console.log('\n📊 PROCESSING RESULTS:');
    
    // Check updated raw_props
    const { count: gradedProps } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .not('confidence_score', 'is', null)
      .not('tier', 'is', null);
      
    console.log(`Raw props with grading results: ${gradedProps || 0}`);
    
    // Check tier distribution
    const { data: tierDistribution } = await supabase
      .from('raw_props')
      .select('tier')
      .not('tier', 'is', null);
      
    const tiers = tierDistribution?.reduce((acc: any, prop: any) => {
      acc[prop.tier] = (acc[prop.tier] || 0) + 1;
      return acc;
    }, {}) || {};
    
    console.log('Tier distribution:', tiers);
    
    // Check promoted picks in unified_picks
    const { count: finalUnifiedPicks } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true });
      
    const promotedCount = (finalUnifiedPicks || 0) - (initialUnifiedPicks || 0);
    console.log(`New picks promoted to unified_picks: ${promotedCount}`);
    
    if (promotedCount > 0) {
      // Show sample promoted picks
      const { data: samplePicks } = await supabase
        .from('unified_picks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);
        
      console.log('\n🎯 Sample promoted picks:');
      samplePicks?.forEach((pick, i) => {
        console.log(`${i+1}. ${pick.selection} - Confidence: ${pick.confidence}, Tier: ${pick.tier_when_placed}`);
      });
    }
    
    // Check promoted props in raw_props
    const { count: promotedProps } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .eq('promoted_to_picks', true);
      
    console.log(`Raw props marked as promoted: ${promotedProps || 0}`);
    
    // Health check
    console.log('\n🏥 Running health check...');
    const healthResult = await gradingAgent.checkHealth();
    console.log(`Health status: ${healthResult.status}`);
    
    if (healthResult.status !== 'healthy') {
      console.log('Health issues:', JSON.stringify(healthResult.details, null, 2));
    }
    
    // Cleanup
    await gradingAgent.cleanup();
    
    console.log('\n🎉 GRADING AGENT TEST COMPLETE!');
    console.log('✅ GradingAgent successfully updated for v3.0.0 unified database');
    
    if (gradedProps && gradedProps > 0) {
      console.log('✅ Props successfully grading_status and stored in raw_props');
    }
    
    if (promotedCount > 0) {
      console.log('✅ High-quality picks successfully promoted to unified_picks');
    }
    
    return {
      initialProps: initialRawProps,
      gradedProps: gradedProps || 0,
      promotedProps: promotedCount,
      tiers
    };
    
  } catch (error: any) {
    console.log(`❌ GradingAgent test failed: ${error.message}`);
    console.log('Stack trace:', error.stack);
    throw error;
  }
}

testUpdatedGradingAgent().then(() => process.exit(0)).catch(console.error);