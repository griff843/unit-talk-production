import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function simpleCheck() {
  try {
    console.log('🔍 Testing database connection...');

    // Test basic connectivity
    const { data: testData, error } = await supabase
      .from('raw_props')
      .select('id, tier, edge_score, confidence')
      .limit(10);

    if (error) {
      console.error('❌ Database error:', error.message);
      return;
    }

    console.log(`✅ Connection successful - retrieved ${testData.length} sample props`);

    if (testData.length > 0) {
      console.log('📊 Sample data:');
      testData.forEach((prop, i) => {
        console.log(
          `   ${i + 1}. ID: ${prop.id}, Tier: ${prop.tier}, Edge: ${prop.edge_score}, Confidence: ${prop.confidence}`
        );
      });

      // Count graded props in sample
      const gradedInSample = testData.filter(p => p.tier !== null).length;
      console.log(`\n📈 Graded props in sample: ${gradedInSample}/${testData.length}`);

      if (gradedInSample > 0) {
        // Test promotion criteria on sample
        let promoted = 0;
        testData.forEach(prop => {
          if (prop.tier && prop.edge_score >= 1200 && prop.confidence === 1) {
            if (prop.tier === 'S' || (prop.tier === 'A' && prop.edge_score >= 1500)) {
              promoted++;
              console.log(`   🏆 PROMOTED: ${prop.tier}-tier, ${prop.edge_score} edge`);
            }
          }
        });

        console.log(`\n🎯 Ultra-strict promotion: ${promoted}/${gradedInSample} graded props`);
        if (gradedInSample > 0) {
          const rate = ((promoted / gradedInSample) * 100).toFixed(1);
          console.log(`   Promotion rate: ${rate}%`);
          console.log(
            `   Expected daily: ${Math.round(8000 * (promoted / gradedInSample))} promotions`
          );
        }
      }
    }
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

simpleCheck();
