/**
 * Check Grading Results Table
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGradingResults() {
  console.log('📊 CHECKING GRADING RESULTS');
  console.log('='.repeat(35));
  
  // Check grading_results table
  try {
    const { count } = await supabase
      .from('grading_results')
      .select('*', { count: 'exact', head: true });
      
    console.log(`Records in grading_results: ${count || 0}`);
    
    if (count && count > 0) {
      const { data: results } = await supabase
        .from('grading_results')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
        
      console.log('\n📋 Recent grading results:');
      results?.forEach((result, i) => {
        console.log(`${i+1}. Tier: ${result.tier}, Confidence: ${result.confidence}, Score: ${result.final_score}`);
      });
      
      // Check promotion criteria
      const { count: promotableCount } = await supabase
        .from('grading_results')
        .select('*', { count: 'exact', head: true })
        .neq('tier', 'D')
        .gt('confidence', 0.65);
        
      console.log(`\n🎯 Promotion Analysis:`);
      console.log(`   Total graded: ${count}`);
      console.log(`   Promotable (tier != D AND confidence > 0.65): ${promotableCount || 0}`);
      console.log(`   Should be promoted: ${promotableCount || 0}`);
      
    }
  } catch (e: any) {
    console.log(`grading_results table: ❌ Error (${e.message})`);
  }
  
  // Also check if we have updated raw_props with scores
  const { count: scoredProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gt('confidence_score', 0);
    
  console.log(`\nraw_props with confidence_score > 0: ${scoredProps || 0}`);
}

checkGradingResults().then(() => process.exit(0)).catch(console.error);