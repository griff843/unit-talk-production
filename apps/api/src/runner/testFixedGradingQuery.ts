/**
 * Test Fixed Grading Query
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

async function testFixedQuery() {
  console.log('🧪 TESTING FIXED GRADING QUERY');
  console.log('='.repeat(40));
  
  // Test the new query logic
  const { count: newQueryCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .is('outcome', null)
    .or('promoted_to_picks.is.null,promoted_to_picks.eq.false');
    
  console.log(`Props matching new query (all sources): ${newQueryCount || 0}`);
  
  // Test specifically for production props  
  const { count: productionCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'production-feedagent')
    .is('outcome', null)
    .or('promoted_to_picks.is.null,promoted_to_picks.eq.false');
    
  console.log(`Production props matching new query: ${productionCount || 0}`);
  
  // Sample some props that will be processed
  const { data: sampleProps } = await supabase
    .from('raw_props')
    .select('player_name, stat_type, source, over_odds, under_odds')
    .is('outcome', null)
    .or('promoted_to_picks.is.null,promoted_to_picks.eq.false')
    .order('created_at', { ascending: true })
    .limit(5);
    
  if (sampleProps && sampleProps.length > 0) {
    console.log('\n📋 Sample props ready for grading:');
    sampleProps.forEach((prop, i) => {
      console.log(`${i+1}. ${prop.player_name} ${prop.stat_type} (${prop.source}) - Over: ${prop.over_odds}, Under: ${prop.under_odds}`);
    });
  }
  
  const success = (newQueryCount || 0) > 1000;
  
  if (success) {
    console.log('\n🎉 QUERY FIX SUCCESSFUL!');
    console.log(`✅ ${newQueryCount || 0} props ready for professional grading`);
    console.log('🚀 Ready to run GradingAgent on production data');
  } else {
    console.log('\n❌ Query fix may have issues');
  }
  
  return success;
}

testFixedQuery().then(() => process.exit(0)).catch(console.error);