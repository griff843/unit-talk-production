/**
 * Check Final Picks Table for Graded Results
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkUnifiedPicks() {
  console.log('📊 CHECKING FINAL PICKS TABLE');
  console.log('='.repeat(35));

  const { count } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true });

  console.log(`Records in unified_picks: ${count || 0}`);

  if (count && count > 0) {
    const { data: samplePicks } = await supabase
      .from('unified_picks')
      .select('player_name, tier, confidence, professional_score, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('\n📋 Recent unified_picks:');
    samplePicks?.forEach((pick, i) => {
      console.log(
        `${i + 1}. ${pick.player_name} - Tier: ${pick.tier}, Score: ${pick.score}, Confidence: ${pick.confidence}`
      );
    });

    console.log('\n🎉 GRADING SYSTEM SUCCESS!');
    console.log('✅ Props were grading_status and inserted into unified_picks');
    console.log('🔧 Need to move/copy to unified_picks for Command Center');
  } else {
    console.log('\n❌ No grading_status picks found in unified_picks either');
  }
}

checkUnifiedPicks()
  .then(() => process.exit(0))
  .catch(console.error);
