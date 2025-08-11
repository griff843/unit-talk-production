/**
 * Check Prop Sources for Grading
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkPropSources() {
  console.log('📊 CHECKING PROP SOURCES FOR GRADING');
  console.log('='.repeat(40));
  
  // Check props from production-feedagent source (our fixed data)
  const { count: productionProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'production-feedagent');
    
  console.log(`Props from production-feedagent: ${productionProps || 0}`);
  
  // Check props from feedagent-pipeline-test (what grading agent looks for)
  const { count: testProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'feedagent-pipeline-test');
    
  console.log(`Props from feedagent-pipeline-test: ${testProps || 0}`);
  
  // Check what sources we have
  const { data: allSources } = await supabase
    .from('raw_props')
    .select('source')
    .not('source', 'is', null);
    
  if (allSources) {
    const sourceCount: Record<string, number> = {};
    allSources.forEach(p => {
      sourceCount[p.source] = (sourceCount[p.source] || 0) + 1;
    });
    
    console.log('\n📋 Available sources:');
    Object.entries(sourceCount).forEach(([source, count]) => {
      console.log(`   ${source}: ${count} props`);
    });
  }
  
  // Sample props from production-feedagent to see their structure
  const { data: sampleProps } = await supabase
    .from('raw_props')
    .select('id, player_name, stat_type, over_odds, under_odds, source, confidence_score, tier_tag, promoted')
    .eq('source', 'production-feedagent')
    .limit(3);
    
  if (sampleProps && sampleProps.length > 0) {
    console.log('\n📋 Sample production-feedagent props:');
    sampleProps.forEach((prop, i) => {
      console.log(`${i+1}. ${prop.player_name} ${prop.stat_type} - Over: ${prop.over_odds}, Under: ${prop.under_odds}, Graded: ${prop.confidence_score ? 'Yes' : 'No'}`);
    });
  }
  
  const hasProductionData = (productionProps || 0) > 0;
  const needsSourceFix = hasProductionData && (testProps || 0) === 0;
  
  if (needsSourceFix) {
    console.log('\n🔧 ISSUE IDENTIFIED:');
    console.log('✅ We have production data with complete odds');
    console.log(`❌ But grading agent looks for 'feedagent-pipeline-test' source`);
    console.log(`🔄 Need to update source from 'production-feedagent' to 'feedagent-pipeline-test'`);
  } else if (!hasProductionData) {
    console.log('\n❌ No production data found');
  } else {
    console.log('\n✅ Sources look correct');
  }
  
  return { hasProductionData, needsSourceFix };
}

checkPropSources().then(() => process.exit(0)).catch(console.error);