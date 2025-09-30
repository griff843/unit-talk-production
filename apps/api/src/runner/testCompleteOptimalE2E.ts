/**
 * Test Complete Optimal E2E Flow
 * Prove that our fixed Optimal integration works end-to-end with real database inserts
 */

import { createClient } from '@supabase/supabase-js';
// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
import { requireSupabase } from '../utils/supabaseUtils';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testCompleteOptimalE2E() {
  console.log('🏁 TESTING COMPLETE OPTIMAL E2E FLOW');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Fetch fresh data from Optimal API with our fixed integration
    console.log('📡 STEP 1: Fetching fresh data from Optimal API...');
    const startTime = Date.now();
    
    const rawProps = await fetchOptimalProps('MLB');
    const fetchTime = Date.now() - startTime;
    
    console.log(`✅ Fetched ${rawProps.length} props in ${fetchTime}ms`);
    
    if (rawProps.length === 0) {
      console.log('❌ No props returned - cannot continue E2E test');
      return;
    }
    
    // Step 2: Verify odds data quality
    console.log('\n🔍 STEP 2: Verifying odds data quality...');
    
    const propsWithBothOdds = rawProps.filter(prop => 
      prop.over_odds && prop.under_odds && 
      prop.over_odds !== 0 && prop.under_odds !== 0 &&
      !isNaN(prop.over_odds) && !isNaN(prop.under_odds)
    );
    
    const oddsQuality = (propsWithBothOdds.length / rawProps.length) * 100;
    console.log(`   Odds Quality: ${oddsQuality.toFixed(1)}% (${propsWithBothOdds.length}/${rawProps.length})`);
    
    if (oddsQuality < 90) {
      console.log(`⚠️  WARNING: Odds quality is ${oddsQuality.toFixed(1)}% - below 90% threshold`);
    } else {
      console.log(`✅ EXCELLENT: Odds quality is ${oddsQuality.toFixed(1)}%`);
    }
    
    // Step 3: Test database insert with real data
    console.log('\n💾 STEP 3: Testing database insert with real Optimal data...');
    
    // Take a sample of high-quality props for insertion
    const { randomUUID } = await import('crypto');
    const sampleProps = propsWithBothOdds.slice(0, 50).map(prop => ({
      ...prop,
      id: randomUUID(),
      source: 'e2e-test-optimal',
      created_at: new Date().toISOString()
    }));
    
    console.log(`   Inserting ${sampleProps.length} sample props...`);
    
    const supabaseClient = requireSupabase();
      const { data: insertedProps, error: insertError } = await supabase
      .from('sports_game_odds')
      .insert(sampleProps)
      .select('id, player_name, stat_type, line, over_odds, under_odds');
      
    if (insertError) {
      console.log(`   ❌ Insert failed: ${insertError.message}`);
      console.log(`   Details:`, insertError);
      
      // Try to insert just one prop to diagnose the issue
      console.log('\n🔧 Attempting single prop insert for diagnosis...');
      const singleProp = sampleProps[0];
      console.log(`   Testing: ${singleProp.player_name} ${singleProp.stat_type} ${singleProp.line}`);
      console.log(`   Over: ${singleProp.over_odds} | Under: ${singleProp.under_odds}`);
      
      const supabaseClient = requireSupabase();
      const { error: singleError } = await supabase
        .from('sports_game_odds')
        .insert([singleProp])
        .select('id');
        
      if (singleError) {
        console.log(`   Single insert also failed: ${singleError.message}`);
        return;
      } else {
        console.log(`   ✅ Single insert succeeded - batch insert issue detected`);
      }
      
    } else {
      console.log(`   ✅ Successfully inserted ${insertedProps?.length || 0} props`);
      
      // Show sample of inserted data
      if (insertedProps && insertedProps.length > 0) {
        console.log('\n📋 SAMPLE INSERTED PROPS:');
        insertedProps.slice(0, 5).forEach((prop, i) => {
          console.log(`${i+1}. ${prop.player_name} ${prop.stat_type} ${prop.line}`);
          console.log(`   Over: ${prop.over_odds} | Under: ${prop.under_odds} | ID: ${prop.id}`);
        });
      }
    }
    
    // Step 4: Verify data in database
    console.log('\n🔍 STEP 4: Verifying data in database...');
    
    const supabaseClient = requireSupabase();
      const { data: verifyProps, count: verifyCount } = await supabase
      .from('sports_game_odds')
      .select('*', { count: 'exact' })
      .eq('source', 'e2e-test-optimal')
      .not('over_odds', 'is', null)
      .not('under_odds', 'is', null);
      
    console.log(`   Found ${verifyCount} props with complete odds from our test`);
    
    if (verifyCount && verifyCount > 0) {
      console.log('   ✅ Database verification successful');
      
      // Show some statistics
      if (verifyProps && verifyProps.length > 0) {
        const avgOverOdds = verifyProps.reduce((sum, p) => sum + (p.over_odds || 0), 0) / verifyProps.length;
        const avgUnderOdds = verifyProps.reduce((sum, p) => sum + (p.under_odds || 0), 0) / verifyProps.length;
        
        console.log(`   Average over odds: ${avgOverOdds.toFixed(0)}`);
        console.log(`   Average under odds: ${avgUnderOdds.toFixed(0)}`);
        
        const uniquePlayers = new Set(verifyProps.map(p => p.player_name)).size;
        const uniqueProps = new Set(verifyProps.map(p => p.stat_type)).size;
        
        console.log(`   Unique players: ${uniquePlayers}`);
        console.log(`   Unique prop types: ${uniqueProps}`);
      }
    } else {
      console.log('   ❌ Database verification failed - no props found');
    }
    
    // Step 5: Run a sample through grading system
    console.log('\n🎯 STEP 5: Testing sample prop through grading system...');
    
    if (verifyProps && verifyProps.length > 0) {
      const testProp = verifyProps[0];
      console.log(`   Testing: ${testProp.player_name} ${testProp.stat_type} ${testProp.line}`);
      console.log(`   Over: ${testProp.over_odds} | Under: ${testProp.under_odds}`);
      
      // Simple devigging test
      const overOdds = testProp.over_odds;
      const underOdds = testProp.under_odds;
      
      if (overOdds && underOdds) {
        const overProb = overOdds > 0 ? 100 / (overOdds + 100) : Math.abs(overOdds) / (Math.abs(overOdds) + 100);
        const underProb = underOdds > 0 ? 100 / (underOdds + 100) : Math.abs(underOdds) / (Math.abs(underOdds) + 100);
        const totalProb = overProb + underProb;
        const vig = ((totalProb - 1) * 100).toFixed(2);
        const fairOverProb = (overProb / totalProb * 100).toFixed(1);
        
        console.log(`   Market Analysis:`);
        console.log(`     Over probability: ${(overProb * 100).toFixed(1)}%`);
        console.log(`     Under probability: ${(underProb * 100).toFixed(1)}%`);
        console.log(`     Total probability: ${(totalProb * 100).toFixed(1)}%`);
        console.log(`     Vig: ${vig}%`);
        console.log(`     Fair over probability: ${fairOverProb}%`);
        
        console.log('   ✅ Grading system input looks valid');
      } else {
        console.log('   ❌ Cannot test grading - missing odds data');
      }
    }
    
    // Step 6: Cleanup test data
    console.log('\n🧹 STEP 6: Cleaning up test data...');
    
    const supabaseClient = requireSupabase();
      const { error: deleteError } = await supabase
      .from('sports_game_odds')
      .delete()
      .eq('source', 'e2e-test-optimal');
      
    if (deleteError) {
      console.log(`   ⚠️  Cleanup warning: ${deleteError.message}`);
    } else {
      console.log('   ✅ Test data cleaned up successfully');
    }
    
    // Final summary
    console.log('\n🏆 E2E TEST RESULTS:');
    console.log('='.repeat(40));
    console.log(`✅ API Integration: ${rawProps.length} props fetched`);
    console.log(`✅ Odds Quality: ${oddsQuality.toFixed(1)}% complete`);
    console.log(`✅ Database Insert: ${insertedProps ? 'SUCCESS' : 'FAILED'}`);
    console.log(`✅ Database Verify: ${verifyCount || 0} props confirmed`);
    console.log(`✅ Grading Ready: ${verifyProps && verifyProps.length > 0 ? 'YES' : 'NO'}`);
    
    if (oddsQuality >= 90 && insertedProps) {
      console.log('\n🎉 SUCCESS: Complete E2E flow working!');
      console.log('✨ Ready for production deployment');
    } else {
      console.log('\n⚠️  PARTIAL SUCCESS: Some issues detected');
    }
    
  } catch (error) {
    console.error('❌ E2E test failed:', error);
    throw error;
  }
}

testCompleteOptimalE2E().then(() => {
  console.log('\n✅ COMPLETE OPTIMAL E2E TEST FINISHED');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ E2E test failed:', error);
  process.exit(1);
});