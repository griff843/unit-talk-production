/**
 * Check comprehensive system state and E2E data flow
 */

import { createClient } from '@supabase/supabase-js';
// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function checkSystemState() {
  console.log('🔍 COMPREHENSIVE SYSTEM STATE CHECK');
  console.log('='.repeat(50));
  
  // Check raw_props processing status
  const { data: rawPropsStatus } = await supabase
    .from('raw_props')
    .select('processed_at, error_message, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
    
  console.log('\n📊 Recent Raw Props Processing Status:');
  rawPropsStatus?.forEach((prop, i) => {
    const status = prop.processed_at ? '✅ Processed' : prop.error_message ? '❌ Error' : '⏳ Pending';
    const details = prop.processed_at 
      ? new Date(prop.processed_at).toLocaleString() 
      : prop.error_message || 'Unprocessed';
    console.log(`${i+1}. ${status} | ${details}`);
  });
  
  // Check unified_picks count
  const { count: unifiedPicksCount } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true });
    
  console.log(`\n🎯 UNIFIED PICKS: ${unifiedPicksCount}`);
  
  // Check CLV tracking count  
  const { count: clvCount } = await supabase
    .from('clv_tracking')
    .select('*', { count: 'exact', head: true });
    
  console.log(`📈 CLV TRACKING ENTRIES: ${clvCount}`);
  
  // Check processing_logs
  const { count: logsCount } = await supabase
    .from('processing_logs')
    .select('*', { count: 'exact', head: true });
    
  console.log(`📝 PROCESSING LOGS: ${logsCount}`);
  
  // Check recent unified picks if any exist
  if (unifiedPicksCount && unifiedPicksCount > 0) {
    const { data: recentPicks } = await supabase
      .from('unified_picks')
      .select('player_name, stat_type, tier, professional_score, devigged_edge, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
      
    console.log('\n🏆 RECENT UNIFIED PICKS:');
    recentPicks?.forEach((pick, i) => {
      const professional_score = pick.professional_score?.toFixed(2) || 'N/A';
      const edge = pick.devigged_edge ? (pick.devigged_edge * 100).toFixed(2) + '%' : 'N/A';
      console.log(`${i+1}. ${pick.player_name} ${pick.stat_type} | ${pick.tier || 'N/A'}-Tier | Score: ${score} | Edge: ${edge}`);
    });
  }
  
  // Check for unprocessed props specifically
  const { count: unprocessedCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .is('processed_at', null)
    .is('error_message', null);
    
  console.log(`\n⏳ TRULY UNPROCESSED PROPS: ${unprocessedCount}`);
  
  console.log('\n' + '='.repeat(50));
  console.log('🎯 SYSTEM STATUS SUMMARY');
  console.log(`✅ Data Pipeline: ${unifiedPicksCount && unifiedPicksCount > 0 ? 'OPERATIONAL' : 'NO DATA'}`);
  console.log(`✅ CLV System: ${clvCount && clvCount > 0 ? 'OPERATIONAL' : 'NO DATA'}`);  
  console.log(`✅ Processing Logs: ${logsCount && logsCount > 0 ? 'OPERATIONAL' : 'NO DATA'}`);
  
  if (unprocessedCount && unprocessedCount > 0) {
    console.log(`\n🚀 READY TO PROCESS: ${unprocessedCount} props need professional processing`);
  } else {
    console.log('\n✅ ALL PROPS PROCESSED: System has processed all available props');
  }
}

checkSystemState().then(() => {
  console.log('\n✅ SYSTEM CHECK COMPLETE');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});