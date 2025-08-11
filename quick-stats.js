import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function quickStats() {
  try {
    console.log('📊 Quick Database Statistics...');

    // Get total count
    const { count: totalProps } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    // Get graded count (try different approach)
    const { data: gradedCheck } = await supabase
      .from('raw_props')
      .select('id')
      .not('tier', 'is', null)
      .limit(1);

    // If we have graded props, count them
    let gradedProps = 0;
    if (gradedCheck?.length > 0) {
      const { count } = await supabase
        .from('raw_props')
        .select('id', { count: 'exact', head: true })
        .not('tier', 'is', null);
      gradedProps = count || 0;
    }

    // Get tier distribution from small sample
    const { data: sampleProps } = await supabase
      .from('raw_props')
      .select('tier, edge_score, confidence')
      .not('tier', 'is', null)
      .limit(200);

    console.log('✅ Database Status:');
    console.log(`   Total Props: ${totalProps}`);
    console.log(`   Graded Props: ${gradedProps}`);
    console.log(`   Completion: ${((gradedProps / totalProps) * 100).toFixed(1)}%`);

    if (sampleProps?.length > 0) {
      // Count tiers
      const tierCounts = sampleProps.reduce((acc, p) => {
        acc[p.tier] = (acc[p.tier] || 0) + 1;
        return acc;
      }, {});

      // Apply ULTRA-STRICT professional promotion criteria
      let promoted = 0;
      sampleProps.forEach(prop => {
        // Rule 1: MINIMUM 12% edge (1200 basis points) - much stricter
        if (prop.edge_score >= 1200) {
          // Rule 2: High confidence required (1 = true)
          if (prop.confidence === 1) {
            // Rule 3: S-tier ONLY, or A-tier with 15%+ edge
            if (prop.tier === 'S' || (prop.tier === 'A' && prop.edge_score >= 1500)) {
              promoted++;
            }
          }
        }
      });

      const promotionRate = ((promoted / sampleProps.length) * 100).toFixed(2);

      console.log('📊 Sample Analysis (200 props):');
      console.log(`   S-Tier: ${tierCounts.S || 0}`);
      console.log(`   A-Tier: ${tierCounts.A || 0}`);
      console.log(`   B-Tier: ${tierCounts.B || 0}`);
      console.log(`   C-Tier: ${tierCounts.C || 0}`);
      console.log(`   D-Tier: ${tierCounts.D || 0}`);
      console.log(`   Promoted: ${promoted}/${sampleProps.length} (${promotionRate}%)`);

      // Expected daily promotions
      const expectedDaily = Math.round(8000 * (promoted / sampleProps.length));
      console.log(`   Expected Daily Promotions: ${expectedDaily}`);

      if (expectedDaily <= 50) {
        console.log('   ✅ EXCELLENT: Highly selective criteria');
      } else if (expectedDaily <= 150) {
        console.log('   ✅ GOOD: Selective enough for profitability');
      } else {
        console.log('   ⚠️ WARNING: May be too many promotions');
      }
    }
  } catch (error) {
    console.error('❌ Quick stats failed:', error.message);
  }
}

quickStats();
