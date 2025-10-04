/**
 * Test Settlement on Specific Date
 *
 * Testing with a date we know has props (from 2024 season)
 */

import { propsSettlementEngine } from '../../services/data-collection/PropsSettlementEngine';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSpecificDate() {
  console.log('🧪 TESTING SETTLEMENT ON SPECIFIC DATE');
  console.log('==========================================\n');

  // Try a date from 2024 MLB season (we know we have props from Sept 2024)
  const testDate = '2024-09-20'; // This should be in the middle of MLB season

  console.log(`Testing with date: ${testDate}\n`);

  // Check if we have props for this date
  const { data: mlbProps, count: mlbCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact' })
    .eq('sport', 'MLB')
    .eq('game_date', testDate);

  console.log(`MLB props for ${testDate}: ${mlbCount || 0}`);

  if (mlbProps && mlbProps.length > 0) {
    console.log('\nSample props:');
    mlbProps.slice(0, 3).forEach(p => {
      console.log(`   ${p.player_name}: ${p.stat_type} ${p.line} (${p.team} vs ${p.opponent})`);
    });
  }

  const { data: nflProps, count: nflCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact' })
    .eq('sport', 'NFL')
    .eq('game_date', testDate);

  console.log(`NFL props for ${testDate}: ${nflCount || 0}`);

  if (!mlbCount && !nflCount) {
    console.log('\n❌ No props found for this date. Trying another date...\n');

    // Find any date with props
    const { data: anyMLB } = await supabase
      .from('raw_props')
      .select('game_date')
      .eq('sport', 'MLB')
      .limit(1);

    if (anyMLB && anyMLB.length > 0) {
      const foundDate = anyMLB[0].game_date;
      console.log(`Found props on date: ${foundDate}`);

      // Count props for this date
      const { count } = await supabase
        .from('raw_props')
        .select('*', { count: 'exact', head: true })
        .eq('sport', 'MLB')
        .eq('game_date', foundDate);

      console.log(`Props count: ${count || 0}\n`);

      // Try settlement
      console.log('🏀 Attempting Settlement...\n');
      const results = await propsSettlementEngine.settleMLBPropsForDate(foundDate);

      console.log(`\n✅ Settlement Results:`);
      console.log(`   Props Settled: ${results.length}`);

      if (results.length > 0) {
        const outcomeCount: Record<string, number> = {};
        results.forEach(r => {
          outcomeCount[r.outcome] = (outcomeCount[r.outcome] || 0) + 1;
        });

        console.log('\n   Outcome Distribution:');
        Object.entries(outcomeCount).forEach(([outcome, count]) => {
          console.log(`      ${outcome}: ${count}`);
        });

        // Show sample result
        const sample = results[0];
        console.log('\n   Sample Settlement:');
        console.log(`      Prop ID: ${sample.propId}`);
        console.log(`      Outcome: ${sample.outcome}`);
        console.log(`      Actual Value: ${sample.actualValue}`);
        console.log(`      Confidence: ${sample.confidence}`);
      }
    }

    process.exit(0);
  }

  // Try MLB settlement
  if (mlbCount && mlbCount > 0) {
    console.log('\n🏀 Attempting MLB Settlement...\n');
    const mlbResults = await propsSettlementEngine.settleMLBPropsForDate(testDate);

    console.log(`\n✅ MLB Settlement Results:`);
    console.log(`   Props Settled: ${mlbResults.length}`);

    if (mlbResults.length > 0) {
      const outcomeCount: Record<string, number> = {};
      mlbResults.forEach(r => {
        outcomeCount[r.outcome] = (outcomeCount[r.outcome] || 0) + 1;
      });

      console.log('\n   Outcome Distribution:');
      Object.entries(outcomeCount).forEach(([outcome, count]) => {
        console.log(`      ${outcome}: ${count}`);
      });
    }
  }

  // Try NFL settlement
  if (nflCount && nflCount > 0) {
    console.log('\n🏈 Attempting NFL Settlement...\n');
    const nflResults = await propsSettlementEngine.settleNFLPropsForDate(testDate);

    console.log(`\n✅ NFL Settlement Results:`);
    console.log(`   Props Settled: ${nflResults.length}`);

    if (nflResults.length > 0) {
      const outcomeCount: Record<string, number> = {};
      nflResults.forEach(r => {
        outcomeCount[r.outcome] = (outcomeCount[r.outcome] || 0) + 1;
      });

      console.log('\n   Outcome Distribution:');
      Object.entries(outcomeCount).forEach(([outcome, count]) => {
        console.log(`      ${outcome}: ${count}`);
      });
    }
  }

  // Show final stats
  const stats = await propsSettlementEngine.getSettlementStats();
  console.log('\n\n📊 Overall Settlement Statistics:');
  console.log(`   Total Settled: ${stats.settledCount.toLocaleString()}`);
  console.log(`   Settlement Rate: ${stats.settlementRate.toFixed(2)}%`);
  if (stats.settledCount > 0) {
    console.log(`   Win Rate: ${stats.winRate.toFixed(2)}%`);
  }

  process.exit(0);
}

testSpecificDate().catch(error => {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
