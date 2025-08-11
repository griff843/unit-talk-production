/**
 * Show Actual Processed Picks
 * Check what picks actually went through the grading process
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function showActualProcessedPicks() {
  console.log('🔍 CHECKING ACTUAL PROCESSED PICKS');
  console.log('='.repeat(60));
  
  try {
    // Check unified_picks table for ANY picks
    const { data: allPicks, count: totalCount } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });
      
    console.log('📊 UNIFIED PICKS ANALYSIS:');
    console.log(`Total unified_picks records: ${totalCount}`);
    
    if (allPicks && allPicks.length > 0) {
      console.log('\n📋 ALL UNIFIED PICKS:');
      allPicks.forEach((pick, i) => {
        console.log(`\n${i+1}. Pick ID: ${pick.id}`);
        console.log(`   Player: ${pick.player_name || 'NULL'}`);
        console.log(`   Stat: ${pick.stat_type || 'NULL'}`);
        console.log(`   Line: ${pick.line || 'NULL'}`);
        console.log(`   Sport: ${pick.sport || 'NULL'}`);
        console.log(`   Professional Score: ${pick.professional_score || 'NULL'}`);
        console.log(`   Devigged Edge: ${pick.devigged_edge || 'NULL'}`);
        console.log(`   Tier: ${pick.tier || 'NULL'}`);
        console.log(`   Auto Approved: ${pick.published !== null ? pick.published : 'NULL'}`);
        console.log(`   CLV Tracking ID: ${pick.clv_tracking_id || 'NULL'}`);
        console.log(`   Created: ${pick.created_at}`);
      });
      
      // Count picks with professional processing
      const professionalPicks = allPicks.filter(pick => 
        pick.professional_score !== null || 
        pick.devigged_edge !== null || 
        pick.clv_tracking_id !== null
      );
      
      console.log(`\n🎯 PROFESSIONAL PROCESSING SUMMARY:`);
      console.log(`   Total picks: ${allPicks.length}`);
      console.log(`   Professionally processed: ${professionalPicks.length}`);
      console.log(`   Processing rate: ${((professionalPicks.length / allPicks.length) * 100).toFixed(1)}%`);
      
    } else {
      console.log('❌ NO UNIFIED PICKS FOUND - This explains why you haven\'t seen any picks!');
    }
    
    // Check CLV tracking
    const { count: clvCount } = await supabase
      .from('clv_tracking')
      .select('*', { count: 'exact', head: true });
      
    console.log(`\n📈 CLV TRACKING ENTRIES: ${clvCount}`);
    
    if (clvCount && clvCount > 0) {
      const { data: clvEntries } = await supabase
        .from('clv_tracking')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
        
      console.log('\n📋 RECENT CLV ENTRIES:');
      clvEntries?.forEach((entry, i) => {
        console.log(`\n${i+1}. CLV ID: ${entry.id}`);
        console.log(`   Prop ID: ${entry.propId}`);
        console.log(`   Sport: ${entry.sport}`);
        console.log(`   Market: ${entry.market}`);
        console.log(`   Book: ${entry.book}`);
        console.log(`   Opening Line: ${entry.openingLine}`);
        console.log(`   Opening Odds: ${entry.openingOdds}`);
        console.log(`   Created: ${entry.created_at}`);
      });
    }
    
    // Check recent raw props to see what data we have
    const { data: recentRawProps, count: rawPropsCount } = await supabase
      .from('raw_props')
      .select('id, player_name, stat_type, line, sport, created_at, processed_at, provider', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(10);
      
    console.log(`\n📊 RAW PROPS ANALYSIS:`);
    console.log(`Total raw props: ${rawPropsCount}`);
    console.log('\nRecent 10 raw props:');
    
    recentRawProps?.forEach((prop, i) => {
      const playerName = prop.player_name || 'Unknown Player';
      const statType = prop.stat_type || 'Unknown Stat';
      console.log(`\n${i+1}. ${playerName} ${statType}`);
      console.log(`   Line: ${prop.line} | Sport: ${prop.sport} | Provider: ${prop.provider}`);
      console.log(`   Created: ${prop.created_at}`);
      console.log(`   Processed: ${prop.processed_at || 'NOT PROCESSED'}`);
    });
    
    // Count processed raw props
    const { count: processedRawProps } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .not('processed_at', 'is', null);
      
    console.log(`\n🔧 RAW PROPS PROCESSING STATUS:`);
    console.log(`   Total raw props: ${rawPropsCount}`);
    console.log(`   Processed raw props: ${processedRawProps || 0}`);
    console.log(`   Processing rate: ${rawPropsCount ? ((processedRawProps || 0) / rawPropsCount * 100).toFixed(1) : 0}%`);
    
    // THE TRUTH CHECK
    console.log('\n' + '='.repeat(60));
    console.log('🚨 THE TRUTH ABOUT PICK PROCESSING:');
    console.log('='.repeat(60));
    
    if (!allPicks || allPicks.length === 0) {
      console.log('❌ NO PICKS HAVE BEEN CREATED IN UNIFIED_PICKS TABLE');
      console.log('❌ The system has raw props but no unified picks');
      console.log('❌ This means the basic ingestion → unified picks pipeline is broken');
    } else {
      const professionalCount = allPicks.filter(p => p.professional_score !== null).length;
      if (professionalCount === 0) {
        console.log('⚠️ PICKS EXIST BUT NONE HAVE PROFESSIONAL PROCESSING');
        console.log('⚠️ All picks are missing professional_score, devigged_edge, clv_tracking_id');
        console.log('⚠️ The professional system is not running on the picks');
      } else {
        console.log(`✅ ${professionalCount} PICKS HAVE BEEN PROFESSIONALLY PROCESSED`);
      }
    }
    
    if (!clvCount || clvCount === 0) {
      console.log('❌ NO CLV TRACKING ENTRIES - CLV system not working');
    } else {
      console.log(`✅ ${clvCount} CLV TRACKING ENTRIES CREATED`);
    }
    
    console.log('\n🎯 DIAGNOSIS:');
    if (rawPropsCount && rawPropsCount > 0) {
      console.log(`✅ Raw data ingestion is working (${rawPropsCount} props)`);
      if (!allPicks || allPicks.length === 0) {
        console.log('❌ But conversion to unified_picks is failing');
        console.log('❌ Need to run the actual ingestion → grading pipeline');
      } else if (allPicks.filter(p => p.professional_score !== null).length === 0) {
        console.log('❌ Basic picks exist but professional processing never ran');
        console.log('❌ Need to run the professional processor on existing picks');
      }
    } else {
      console.log('❌ No raw data - FeedAgent may not be working properly');
    }
    
  } catch (error) {
    console.error('❌ Error checking processed picks:', error);
  }
}

showActualProcessedPicks().then(() => {
  console.log('\n✅ ACTUAL PICK ANALYSIS COMPLETE');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Analysis failed:', error);
  process.exit(1);
});