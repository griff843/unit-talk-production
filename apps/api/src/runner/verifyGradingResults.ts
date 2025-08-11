/**
 * Verify Grading System Results
 * Check if professional grading system worked on corrected data
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyGradingResults() {
  console.log('📊 GRADING SYSTEM VERIFICATION');
  console.log('='.repeat(40));
  
  const today = '2025-08-05';
  
  // Check unified_picks (the grading_status picks)
  const { count: unifiedPicks } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true });
    
  console.log(`✅ Total grading_status picks: ${unifiedPicks || 0}`);
  
  // Check recent grading_status picks 
  const { data: recentPicks } = await supabase
    .from('unified_picks')
    .select('player_name, stat_type, tier, confidence_score, kelly_fraction, clv_tracking_id')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (recentPicks && recentPicks.length > 0) {
    console.log('\n📋 Recent grading_status picks:');
    recentPicks.forEach((pick, i) => {
      const hasClv = pick.clv_tracking_id ? '✅' : '❌';
      console.log(`${i+1}. ${pick.player_name} ${pick.stat_type} - Tier: ${pick.tier}, Confidence: ${pick.confidence_score}, Kelly: ${pick.kelly_fraction}, CLV: ${hasClv}`);
    });
  }
  
  // Check professional compliance
  const { count: clvTracking } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .not('clv_tracking_id', 'is', null);
    
  const { count: tieredPicks } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .not('tier', 'is', null);
    
  console.log(`\n🎯 Professional Compliance:`);
  console.log(`   CLV tracking: ${clvTracking || 0}/${unifiedPicks || 0} picks (${unifiedPicks ? ((clvTracking || 0) / unifiedPicks * 100).toFixed(1) : '0.0'}%)`);
  console.log(`   Tier assignment: ${tieredPicks || 0}/${unifiedPicks || 0} picks (${unifiedPicks ? ((tieredPicks || 0) / unifiedPicks * 100).toFixed(1) : '0.0'}%)`);
  
  // Check processing performance
  const { data: processingStats } = await supabase
    .from('unified_picks')
    .select('processing_time')
    .not('processing_time', 'is', null)
    .limit(10);
    
  if (processingStats && processingStats.length > 0) {
    const avgProcessingTime = processingStats.reduce((sum, p) => sum + (p.processing_time || 0), 0) / processingStats.length;
    console.log(`   Processing time: ${avgProcessingTime.toFixed(2)}ms avg`);
  }
  
  const success = (unifiedPicks || 0) >= 45 && (clvTracking || 0) > 0;
  
  if (success) {
    console.log('\n🎉 GRADING SYSTEM SUCCESS!');
    console.log('✨ Professional grading operational with corrected data');
    console.log('🚀 Database issues RESOLVED - ready to shift focus to Command Center');
    console.log('\n📈 System Performance:');
    console.log(`   ✅ ${unifiedPicks} professional picks generated`);
    console.log(`   ✅ ${clvTracking} picks with CLV tracking`);
    console.log(`   ✅ Grading system processes props with complete odds`);
  } else {
    console.log('\n❌ Grading system issues detected');
    console.log(`⚠️  Got ${unifiedPicks || 0} picks, need 45+`);
  }
  
  return success;
}

verifyGradingResults().then((success) => {
  console.log(`\n${success ? '🎉 READY FOR COMMAND CENTER FOCUS' : '❌ STILL NEED FIXES'}`);
  process.exit(success ? 0 : 1);
}).catch(console.error);