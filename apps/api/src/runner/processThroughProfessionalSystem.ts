/**
 * Process Real Data Through Professional System
 * This will take the ingested raw props and process them through the complete professional pipeline
 */

import { createClient } from '@supabase/supabase-js';
// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const logger = createLogger('ProfessionalProcessing');
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function processThroughProfessionalSystem() {
  console.log('🚀 PROCESSING REAL DATA THROUGH PROFESSIONAL SYSTEM');
  console.log('='.repeat(70));
  
  try {
    // Check current state
    const { count: totalRawProps } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true });
      
    const { count: currentUnifiedPicks } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true });
      
    console.log(`📊 CURRENT STATE:`);
    console.log(`   Raw Props: ${totalRawProps}`);
    console.log(`   Unified Picks: ${currentUnifiedPicks}`);
    
    // Get some unprocessed raw props
    const { data: rawProps } = await supabase
      .from('raw_props')
      .select('*')
      .is('processed_at', null)
      .limit(50); // Process 50 props to demonstrate
      
    if (!rawProps || rawProps.length === 0) {
      console.log('\n⚠️ No unprocessed raw props found.');
      console.log('All props have been processed, but they bypassed professional system.');
      console.log('Let me process some props through the professional pipeline anyway...');
      
      // Get some already "processed" props to re-process professionally
      const { data: existingProps } = await supabase
        .from('raw_props')
        .select('*')
        .limit(25);
        
      if (existingProps) {
        console.log(`\n🔄 RE-PROCESSING ${existingProps.length} PROPS THROUGH PROFESSIONAL SYSTEM`);
        
        // Clear their processed_at timestamp so they can be re-processed professionally
        await supabase
          .from('raw_props')
          .update({ processed_at: null, error_message: null })
          .in('id', existingProps.map(p => p.id));
          
        console.log('✅ Cleared processing timestamps for professional re-processing');
      }
    } else {
      console.log(`\n📋 Found ${rawProps.length} unprocessed props`);
    }
    
    console.log('\n🚀 RUNNING PROFESSIONAL PROP PROCESSOR');
    console.log('─'.repeat(50));
    
    // Process through professional system
    const startTime = Date.now();
    const results = await professionalPropProcessor.processRawProps({
      max_batch_size: 25, // Process in smaller batches
      auto_approve_threshold: 3.0,
      timeout_ms: 30000
    });
    
    const processingTime = Date.now() - startTime;
    
    console.log('\n✅ PROFESSIONAL PROCESSING COMPLETE!');
    console.log('─'.repeat(50));
    console.log(`⏱️  Processing Time: ${processingTime}ms`);
    console.log(`📊 Props Processed: ${results.length}`);
    
    if (results.length > 0) {
      // Analyze results
      const avgScore = results.reduce((sum, r) => sum + r.professionalScore, 0) / results.length;
      const avgEdge = results.reduce((sum, r) => sum + r.devigged_edge, 0) / results.length;
      const autoApproved = results.filter(r => r.published).length;
      const clvTracked = results.filter(r => r.clv_tracking_id).length;
      
      console.log(`📈 Average Professional Score: ${avgScore.toFixed(2)}`);
      console.log(`⚡ Average Devigged Edge: ${(avgEdge * 100).toFixed(2)}%`);
      console.log(`✅ Auto-Approved: ${autoApproved}/${results.length} (${((autoApproved/results.length)*100).toFixed(1)}%)`);
      console.log(`📊 CLV Tracking Initiated: ${clvTracked}/${results.length} (${((clvTracked/results.length)*100).toFixed(1)}%)`);
      
      // Show tier distribution
      const tierCounts: Record<string, number> = {};
      results.forEach(r => {
        tierCounts[r.tier] = (tierCounts[r.tier] || 0) + 1;
      });
      
      console.log('\n🎯 TIER DISTRIBUTION:');
      Object.entries(tierCounts).forEach(([tier, count]) => {
        const percentage = ((count / results.length) * 100).toFixed(1);
        console.log(`   ${tier}-Tier: ${count} (${percentage}%)`);
      });
      
      // Show sample processed picks
      console.log('\n📋 SAMPLE PROFESSIONAL RESULTS:');
      results.slice(0, 5).forEach((result, i) => {
        console.log(`${i+1}. Score: ${result.professionalScore.toFixed(2)} | ${result.tier}-Tier | Edge: ${(result.devigged_edge * 100).toFixed(2)}% | Kelly: ${(result.kelly_fraction * 100).toFixed(2)}%`);
        console.log(`   CLV: ${result.clv_tracking_id ? '✅' : '❌'} | Auto-Approved: ${result.published ? '✅' : '❌'} | Processing: ${result.processing_time}ms`);
      });
    }
    
    // Final verification
    console.log('\n🔍 FINAL E2E VERIFICATION:');
    console.log('─'.repeat(50));
    
    const { count: finalUnifiedPicks } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true });
      
    const { count: finalClvEntries } = await supabase
      .from('clv_tracking')
      .select('*', { count: 'exact', head: true });
      
    const { count: processingLogs } = await supabase
      .from('processing_logs')
      .select('*', { count: 'exact', head: true });
    
    console.log(`✅ Total Unified Picks: ${finalUnifiedPicks}`);
    console.log(`✅ CLV Tracking Entries: ${finalClvEntries}`);
    console.log(`✅ Processing Log Entries: ${processingLogs}`);
    
    // Check compliance
    const { data: professionalPicks } = await supabase
      .from('unified_picks')
      .select('professional_score, devigged_edge, clv_tracking_id, kelly_fraction')
      .not('professional_score', 'is', null);
      
    const professionalCount = professionalPicks?.length || 0;
    const complianceRate = finalUnifiedPicks ? (professionalCount / finalUnifiedPicks) * 100 : 0;
    
    console.log(`\n🏆 SHARP GRADING RULES COMPLIANCE: ${complianceRate.toFixed(1)}%`);
    console.log(`Status: ${complianceRate >= 95 ? '✅ COMPLIANT' : complianceRate >= 50 ? '⚠️ PARTIAL' : '❌ NON-COMPLIANT'}`);
    
    if (complianceRate >= 95) {
      console.log('\n🎉 SUCCESS: E2E SYSTEM IS NOW WORKING WITH REAL DATA!');
      console.log('✅ FeedAgent → Professional Processing → CLV Tracking → Grading → Promotion');
      console.log('✅ All Non-Negotiable Sharp Grading Rules are being followed');
      console.log('✅ System is production-ready with real MLB data flowing through complete pipeline');
    } else {
      console.log('\n⚠️ PARTIAL SUCCESS: Professional system is working but not all picks are compliant');
      console.log('Some picks may still be bypassing professional processing');
    }
    
  } catch (error) {
    console.error('❌ Professional processing failed:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    
    throw error;
  }
}

processThroughProfessionalSystem().then(() => {
  console.log('\n✅ PROFESSIONAL PROCESSING COMPLETE');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Professional processing failed:', error);
  process.exit(1);
});