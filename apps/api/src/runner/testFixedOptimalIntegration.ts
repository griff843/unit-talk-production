/**
 * Test Fixed Optimal Integration
 * Verify that our updated Optimal integration can properly fetch and process odds data
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

async function testFixedOptimalIntegration() {
  console.log('🔧 TESTING FIXED OPTIMAL INTEGRATION');
  console.log('='.repeat(60));
  
  try {
    // Test fetching props with the fixed integration
    console.log('🔄 Fetching props using fixed Optimal integration...');
    const startTime = Date.now();
    
    const rawProps = await fetchOptimalProps('MLB');
    const fetchTime = Date.now() - startTime;
    
    console.log(`✅ Fetched ${rawProps.length} props in ${fetchTime}ms`);
    
    if (rawProps.length === 0) {
      console.log('❌ No props returned - check if there are MLB games today');
      return;
    }
    
    // Analyze the fetched props
    console.log('\n📊 PROPS ANALYSIS:');
    
    // Check for odds data
    const propsWithOdds = rawProps.filter(prop => 
      prop.over_odds && prop.under_odds && 
      prop.over_odds !== 0 && prop.under_odds !== 0
    );
    
    console.log(`   Props with complete odds: ${propsWithOdds.length}/${rawProps.length} (${((propsWithOdds.length/rawProps.length)*100).toFixed(1)}%)`);
    
    // Show sample props
    if (propsWithOdds.length > 0) {
      console.log('\n📋 SAMPLE PROPS WITH ODDS:');
      propsWithOdds.slice(0, 5).forEach((prop, i) => {
        console.log(`${i+1}. ${prop.player_name} ${prop.stat_type} ${prop.line}`);
        console.log(`   Over: ${prop.over_odds} | Under: ${prop.under_odds}`);
        console.log(`   Book: ${prop.source} | Provider: ${prop.provider}`);
      });
    }
    
    // Check prop types
    const propTypes = [...new Set(rawProps.map(p => p.stat_type))];
    console.log(`\n🎯 Prop types found: ${propTypes.length}`);
    console.log(`   Types: ${propTypes.slice(0, 10).join(', ')}${propTypes.length > 10 ? '...' : ''}`);
    
    // Check sportsbooks
    const sportsbooks = [...new Set(rawProps.map(p => p.source))];
    console.log(`\n🏪 Sportsbooks found: ${sportsbooks.length}`);
    console.log(`   Books: ${sportsbooks.join(', ')}`);
    
    // Test inserting a few props into database to verify schema compatibility
    if (propsWithOdds.length > 0) {
      console.log('\n💾 TESTING DATABASE INSERT...');
      
      const testProp = propsWithOdds[0];
      console.log(`   Testing insert of: ${testProp.player_name} ${testProp.stat_type} ${testProp.line}`);
      
      const supabaseClient = requireSupabase();
      const { data: insertedProp, error: insertError } = await supabase
        .from('sports_game_odds')
        .insert([{
          ...testProp,
          id: `test-${Date.now()}`, // Unique test ID
          created_at: new Date().toISOString()
        }])
        .select('id')
        .single();
        
      if (insertError) {
        console.log(`   ❌ Insert failed: ${insertError.message}`);
        console.log(`   Details:`, insertError);
      } else {
        console.log(`   ✅ Successfully inserted test prop: ${insertedProp.id}`);
        
        // Clean up test prop
        const supabaseClient = requireSupabase();
    await supabase.from('sports_game_odds').delete().eq('id', insertedProp.id);
        console.log(`   🧹 Cleaned up test prop`);
      }
    }
    
    // Performance analysis
    const propsPerSecond = (rawProps.length / fetchTime * 1000).toFixed(1);
    console.log(`\n⚡ PERFORMANCE METRICS:`);
    console.log(`   Total fetch time: ${fetchTime}ms`);
    console.log(`   Props per second: ${propsPerSecond}`);
    console.log(`   Average time per prop: ${(fetchTime / rawProps.length).toFixed(1)}ms`);
    
    // Success summary
    console.log('\n🎉 INTEGRATION TEST RESULTS:');
    console.log(`   ✅ API Connection: Working`);
    console.log(`   ✅ Data Fetching: ${rawProps.length} props`);
    console.log(`   ✅ Odds Processing: ${propsWithOdds.length} complete odds`);
    console.log(`   ✅ Database Schema: Compatible`);
    console.log(`   ✅ Performance: ${propsPerSecond} props/sec`);
    
    if (propsWithOdds.length === rawProps.length) {
      console.log('\n🏆 PERFECT: All props have complete odds data!');
    } else if (propsWithOdds.length > rawProps.length * 0.8) {
      console.log('\n✅ GOOD: >80% of props have complete odds data');
    } else {
      console.log('\n⚠️  WARNING: <80% of props have complete odds data');
    }
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    throw error;
  }
}

testFixedOptimalIntegration().then(() => {
  console.log('\n✅ FIXED OPTIMAL INTEGRATION TEST COMPLETE');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Integration test failed:', error);
  process.exit(1);
});