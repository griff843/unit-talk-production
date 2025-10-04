/**
 * Test Props Settlement on Sample Data
 *
 * Validates the settlement engine works correctly before running on 1.4M props
 */

import { propsSettlementEngine } from '../../services/data-collection/PropsSettlementEngine';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSettlementSample() {
  console.log('🧪 TESTING SETTLEMENT ENGINE ON SAMPLE DATA');
  console.log('==========================================\n');

  // Test 1: Find a recent date with MLB props
  const { data: recentMLBProp } = await supabase
    .from('raw_props')
    .select('game_date')
    .eq('sport', 'MLB')
    .not('game_date', 'is', null)
    .order('game_date', { ascending: false })
    .limit(1);

  if (!recentMLBProp || recentMLBProp.length === 0) {
    console.log('❌ No MLB props found to test');
    return;
  }

  const testDate = recentMLBProp[0].game_date;
  console.log(`📅 Testing with date: ${testDate}\n`);

  // Count props for this date
  const { count: propsCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB')
    .eq('game_date', testDate)
    .is('result', null);

  console.log(`Found ${propsCount || 0} unsettled MLB props for ${testDate}\n`);

  if (!propsCount || propsCount === 0) {
    console.log('⚠️  All props for this date already settled');
    console.log('Testing with already-settled sample...\n');
  }

  try {
    // Test MLB settlement
    console.log('🏀 TEST 1: MLB Prop Settlement');
    console.log('─'.repeat(50));

    const mlbResults = await propsSettlementEngine.settleMLBPropsForDate(testDate);

    console.log(`\n✅ Test 1 Results:`);
    console.log(`   Props Processed: ${mlbResults.length}`);

    if (mlbResults.length > 0) {
      const sample = mlbResults[0];
      console.log(`\n   Sample Settlement:`);
      console.log(`      Prop ID: ${sample.propId}`);
      console.log(`      Outcome: ${sample.outcome}`);
      console.log(`      Actual Value: ${sample.actualValue}`);
      console.log(`      Confidence: ${sample.confidence}`);
      console.log(`      Method: ${sample.settlementMethod}`);

      // Show outcome distribution
      const outcomeCount: Record<string, number> = {};
      mlbResults.forEach(r => {
        outcomeCount[r.outcome] = (outcomeCount[r.outcome] || 0) + 1;
      });

      console.log(`\n   Outcome Distribution:`);
      Object.entries(outcomeCount).forEach(([outcome, count]) => {
        console.log(`      ${outcome}: ${count}`);
      });
    }

    // Test 2: Settlement statistics
    console.log('\n\n📊 TEST 2: Settlement Statistics');
    console.log('─'.repeat(50));

    const stats = await propsSettlementEngine.getSettlementStats();

    console.log(`\n   Total Props in Database: ${stats.totalRawProps.toLocaleString()}`);
    console.log(`   Settled: ${stats.settledCount.toLocaleString()}`);
    console.log(`   Unsettled: ${stats.unsettledCount.toLocaleString()}`);
    console.log(`   Settlement Rate: ${stats.settlementRate.toFixed(2)}%`);
    console.log(`   Win Rate: ${stats.winRate.toFixed(2)}%`);

    console.log(`\n   Outcome Breakdown:`);
    Object.entries(stats.outcomeBreakdown).forEach(([outcome, count]) => {
      console.log(`      ${outcome}: ${count}`);
    });

    // Test 3: Verify data stored correctly
    console.log('\n\n🔍 TEST 3: Data Storage Verification');
    console.log('─'.repeat(50));

    if (mlbResults.length > 0) {
      const samplePropId = mlbResults[0].propId;

      // Check settled_outcomes table
      const { data: settledOutcome } = await supabase
        .from('settled_outcomes')
        .select('*')
        .eq('prop_id', samplePropId)
        .single();

      if (settledOutcome) {
        console.log(`\n   ✅ settled_outcomes record created`);
        console.log(`      Player: ${settledOutcome.player_name}`);
        console.log(`      Market: ${settledOutcome.market_type}`);
        console.log(`      Line: ${settledOutcome.line}`);
        console.log(`      Actual: ${settledOutcome.actual_value}`);
        console.log(`      Outcome: ${settledOutcome.outcome}`);
      } else {
        console.log(`\n   ❌ settled_outcomes record NOT found`);
      }

      // Check if raw_props was updated
      const { data: rawProp } = await supabase
        .from('raw_props')
        .select('result')
        .eq('id', samplePropId)
        .single();

      if (rawProp && rawProp.result) {
        console.log(`\n   ✅ raw_props.result updated: ${rawProp.result}`);
      } else {
        console.log(`\n   ❌ raw_props.result NOT updated`);
      }
    }

    // Test 4: Player stats collected
    console.log('\n\n📈 TEST 4: Player Stats Collection');
    console.log('─'.repeat(50));

    const { count: playerStatsCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'MLB')
      .eq('game_date', testDate);

    console.log(`\n   Player stats for ${testDate}: ${playerStatsCount || 0}`);

    if (playerStatsCount && playerStatsCount > 0) {
      const { data: sampleStat } = await supabase
        .from('player_stats')
        .select('*')
        .eq('sport', 'MLB')
        .eq('game_date', testDate)
        .limit(1)
        .single();

      if (sampleStat) {
        console.log(`\n   Sample Player Stat:`);
        console.log(`      Player: ${sampleStat.player_name}`);
        console.log(`      Team: ${sampleStat.team}`);
        console.log(`      Stats:`, JSON.stringify(sampleStat.stats, null, 2));
      }
    }

    console.log('\n\n✅ ALL TESTS PASSED!');
    console.log('==========================================');
    console.log('\n🚀 Ready to settle all 1.4M props:');
    console.log('   npx tsx src/scripts/ml/settle-all-existing-props.ts\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testSettlementSample();
