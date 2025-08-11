/**
 * Check Where Graded Props Went
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGradedProps() {
  console.log('📊 CHECKING WHERE GRADED PROPS WENT');
  console.log('='.repeat(40));
  
  // Check raw_props for graded/promoted props
  const { count: promotedProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('promoted', true);
    
  console.log(`Promoted props in raw_props: ${promotedProps || 0}`);
  
  // Check for CLV tracking in raw_props
  const { count: clvProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .not('clv_tracking_id', 'is', null);
    
  console.log(`Props with CLV tracking in raw_props: ${clvProps || 0}`);
  
  // Check tier assignments
  const { count: tieredProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .not('tier_tag', 'is', null);
    
  console.log(`Props with tier tags in raw_props: ${tieredProps || 0}`);
  
  // Check scoring
  const { count: scoredProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gt('confidence_score', 0);
    
  console.log(`Props with confidence scores in raw_props: ${scoredProps || 0}`);
  
  // Sample some grading_status props
  const { data: gradedSample } = await supabase
    .from('raw_props')
    .select('player_name, stat_type, tier_tag, confidence_score, edge_score, promoted, clv_tracking_id')
    .gt('confidence_score', 0)
    .limit(5);
    
  if (gradedSample && gradedSample.length > 0) {
    console.log('\n📋 Sample grading_status props:');
    gradedSample.forEach((prop, i) => {
      const hasClv = prop.clv_tracking_id ? 'Yes' : 'No';
      console.log(`${i+1}. ${prop.player_name} ${prop.stat_type} - Tier: ${prop.tier_tag}, Confidence: ${prop.confidence_score}, Edge: ${prop.edge_score}, Promoted: ${prop.promoted}, CLV: ${hasClv}`);
    });
  } else {
    console.log('\n❌ No grading_status props found');
  }
  
  // Check unified_picks table
  const { count: unifiedCount } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true });
    
  console.log(`\nUnified picks table: ${unifiedCount || 0} records`);
  
  const success = (clvProps || 0) > 0 && (scoredProps || 0) > 0;
  
  if (success) {
    console.log('\n🎉 GRADING SYSTEM WORKING!');
    console.log('✨ Props are being processed and tracked professionally');
    console.log('🚀 Ready to shift focus to Command Center');
  } else {
    console.log('\n❌ Grading system may have issues');
  }
  
  return success;
}

checkGradedProps().then(() => process.exit(0)).catch(console.error);