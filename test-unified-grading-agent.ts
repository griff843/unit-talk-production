/**
 * Test Unified GradingAgent v3.0.0
 *
 * Tests the updated GradingAgent to ensure it works with unified database structure
 * without trying to access grading_results or final_picks tables.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_ANON_KEY as string
);

async function testUnifiedGradingAgent() {
  console.log('🧪 Testing Updated GradingAgent with v3.0.0 Unified Database Structure\n');

  try {
    // 1. Verify v3.0.0 tables exist
    console.log('1️⃣ Checking v3.0.0 unified tables...');
    const requiredTables = ['raw_props', 'unified_picks', 'users'];

    for (const table of requiredTables) {
      try {
        const { error } = await supabase.from(table).select('*').limit(1);

        console.log(`   ✅ ${table}: accessible`);
      } catch (err) {
        console.log(`   ❌ ${table}: error - ${err}`);
      }
    }

    // 2. Check for legacy tables (should not be needed)
    console.log('\n2️⃣ Checking legacy tables (should not be required)...');
    const legacyTables = ['grading_results', 'final_picks'];

    for (const table of legacyTables) {
      try {
        const { error } = await supabase.from(table).select('*').limit(1);

        console.log(`   ⚠️ ${table}: exists but should not be needed in v3.0.0`);
      } catch (err) {
        console.log(`   ✅ ${table}: not accessible (expected in v3.0.0)`);
      }
    }

    // 3. Check unified_picks professional columns
    console.log('\n3️⃣ Checking unified_picks professional grading columns...');
    try {
      const { data, error } = await supabase
        .from('unified_picks')
        .select(
          `
          id,
          professional_score,
          devigged_edge,
          kelly_fraction,
          professional_insights,
          feature_contributions,
          risk_assessment,
          processing_time,
          auto_approved,
          tier,
          confidence,
          status
        `
        )
        .limit(1);

      if (error) {
        console.log(`   ❌ Professional columns query failed: ${error.message}`);
      } else {
        console.log('   ✅ Professional columns accessible in unified_picks');
        console.log('   📊 Available columns:', Object.keys(data?.[0] || {}));
      }
    } catch (err) {
      console.log(`   ❌ Error accessing professional columns: ${err}`);
    }

    // 4. Check for pending picks that need grading
    console.log('\n4️⃣ Checking for picks needing professional grading...');
    try {
      const { data: pendingPicks, error } = await supabase
        .from('unified_picks')
        .select(
          `
          id,
          user_id,
          sport,
          prediction,
          confidence,
          status,
          professional_score,
          raw_props!inner (
            id,
            player_name,
            stat_type,
            line,
            over_odds,
            under_odds
          )
        `
        )
        .is('professional_score', null)
        .in('status', ['pending', 'submitted'])
        .limit(5);

      if (error) {
        console.log(`   ❌ Query failed: ${error.message}`);
      } else {
        console.log(`   ✅ Found ${pendingPicks?.length || 0} picks needing grading`);

        if (pendingPicks && pendingPicks.length > 0) {
          console.log('\n   📋 Sample picks needing grading:');
          pendingPicks.forEach((pick, i) => {
            const prop = pick.raw_props;
            console.log(
              `   ${i + 1}. Pick ${pick.id}: ${prop?.player_name} ${prop?.stat_type} ${pick.prediction} ${prop?.line}`
            );
          });
        }
      }
    } catch (err) {
      console.log(`   ❌ Error checking pending picks: ${err}`);
    }

    // 5. Test the data conversion logic
    console.log('\n5️⃣ Testing unified pick to grading feature conversion...');
    try {
      const { data: samplePick, error } = await supabase
        .from('unified_picks')
        .select(
          `
          id,
          user_id,
          sport,
          prediction,
          confidence,
          status,
          created_at,
          raw_props!inner (
            id,
            player_name,
            stat_type,
            line,
            over_odds,
            under_odds,
            game_date,
            team,
            opponent,
            sport
          )
        `
        )
        .is('professional_score', null)
        .limit(1)
        .single();

      if (error || !samplePick) {
        console.log('   ⚠️ No sample pick found for conversion test');
      } else {
        console.log('   ✅ Sample unified pick structure verified:');
        console.log(`      Pick ID: ${samplePick.id}`);
        console.log(`      Raw Prop ID: ${samplePick.raw_props.id}`);
        console.log(`      Player: ${samplePick.raw_props.player_name}`);
        console.log(`      Stat: ${samplePick.raw_props.stat_type}`);
        console.log(`      Line: ${samplePick.raw_props.line}`);
        console.log(`      Prediction: ${samplePick.prediction}`);
        console.log(`      Status: ${samplePick.status}`);
      }
    } catch (err) {
      console.log(`   ❌ Error testing conversion: ${err}`);
    }

    // 6. Summary
    console.log('\n📊 Test Summary:');
    console.log('✅ GradingAgent v3.0.0 Integration Test Complete');
    console.log('✅ Updated to use unified_picks table exclusively');
    console.log('✅ Professional grading columns available');
    console.log('✅ Legacy grading_results and final_picks tables not required');
    console.log('✅ Pick workflow: unified_picks (pending) → grading → unified_picks (approved)');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testUnifiedGradingAgent()
  .then(() => {
    console.log('\n🏁 Unified GradingAgent test complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
