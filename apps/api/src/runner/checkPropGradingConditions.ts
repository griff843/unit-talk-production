/**
 * Check Production Props Grading Conditions
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkPropGradingConditions() {
  console.log('📊 CHECKING PRODUCTION PROP GRADING CONDITIONS');
  console.log('='.repeat(50));
  
  // Check our production props against grading conditions
  const { data: sampleProps } = await supabase
    .from('raw_props')
    .select('id, player_name, stat_type, source, outcome, promoted_to_picks, created_at')
    .eq('source', 'production-feedagent')
    .limit(5);
    
  if (sampleProps) {
    console.log('📋 Sample production props:');
    sampleProps.forEach((prop, i) => {
      console.log(`${i+1}. ${prop.player_name} ${prop.stat_type}`);
      console.log(`   outcome: ${prop.outcome} (should be null for grading)`); 
      console.log(`   promoted_to_picks: ${prop.promoted_to_picks} (should be null for grading)`);
      console.log(`   source: ${prop.source}`);
      console.log('');
    });
  }
  
  // Check how many match grading conditions
  const { count: eligibleForGrading } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'production-feedagent')
    .is('outcome', null)
    .is('promoted_to_picks', null);
    
  const { count: totalProduction } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'production-feedagent');
    
  console.log('🎯 Grading eligibility for production props:');
  console.log(`   Total production props: ${totalProduction || 0}`);
  console.log(`   Eligible for grading: ${eligibleForGrading || 0}`);
  console.log(`   Meets conditions: ${(eligibleForGrading || 0) > 0 ? 'YES ✅' : 'NO ❌'}`);
  
  // Check what values are preventing grading
  const { count: withOutcome } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'production-feedagent')
    .not('outcome', 'is', null);
    
  const { count: alreadyPromoted } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'production-feedagent')
    .not('promoted_to_picks', 'is', null);
    
  console.log('\n🔍 Blocking conditions:');
  console.log(`   Props with outcome set: ${withOutcome || 0}`);
  console.log(`   Props already promoted: ${alreadyPromoted || 0}`);
  
  // Check the exact grading query
  const { count: exactMatch } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .is('outcome', null)
    .is('promoted_to_picks', null);
    
  console.log(`\n📈 Total props eligible for grading (all sources): ${exactMatch || 0}`);
  
  const shouldRunGrading = (exactMatch || 0) > 200;
  
  if (shouldRunGrading) {
    console.log('\n🚀 SOLUTION: Run grading agent again!');
    console.log('✨ More props are now eligible for grading');
  } else {
    console.log('\n❌ Issue: Props may have been processed already or have blocking conditions');
  }
  
  return { eligible: eligibleForGrading || 0, total: totalProduction || 0, shouldRun: shouldRunGrading };
}

checkPropGradingConditions().then(() => process.exit(0)).catch(console.error);