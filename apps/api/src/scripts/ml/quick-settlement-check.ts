/**
 * Quick Settlement Rate Check - Optimized for Speed
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function quickCheck() {
  console.log('🚀 QUICK SETTLEMENT RATE CHECK...\n');

  // Get total count (head request - fast)
  const { count: total, error: totalError } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true });

  if (totalError) {
    console.error('❌ Error:', totalError.message);
    process.exit(1);
  }

  // Get count with actual_value (head request - fast)
  const { count: settled, error: settledError } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true })
    .not('actual_value', 'is', null);

  if (settledError) {
    console.error('❌ Error:', settledError.message);
    process.exit(1);
  }

  // Get sample of 10 records to show data
  const { data: sample } = await supabase
    .from('settled_outcomes')
    .select('player_name, market_type, line, actual_value, outcome, sport, game_date')
    .not('actual_value', 'is', null)
    .limit(10);

  const settlementRate = settled && total ? ((settled / total) * 100).toFixed(2) : '0.00';

  console.log('='.repeat(80));
  console.log('📊 SETTLEMENT VALIDATION');
  console.log('='.repeat(80));
  console.log('');
  console.log(`  Total Outcomes:     ${(total || 0).toLocaleString()}`);
  console.log(`  With actual_value:  ${(settled || 0).toLocaleString()}`);
  console.log(`  Settlement Rate:    ${settlementRate}%`);
  console.log('');
  console.log(`  Tier 1 Target:      >1,000 outcomes`);
  console.log(`  Tier 1 Rate Target: >95%`);
  console.log('');

  if ((total || 0) >= 1000) {
    console.log(`  ✅ Sample Size: ${Math.floor((total || 0) / 1000)}X OVER TARGET`);
  } else {
    console.log(`  ❌ Sample Size: Need ${1000 - (total || 0)} more`);
  }

  if (parseFloat(settlementRate) >= 95) {
    console.log(`  ✅ Settlement Rate: ${settlementRate}% (EXCEEDS 95%)`);
  } else {
    console.log(`  ❌ Settlement Rate: ${settlementRate}% (BELOW 95%)`);
  }
  console.log('');

  // Show sample data
  if (sample && sample.length > 0) {
    console.log('-'.repeat(80));
    console.log('📋 SAMPLE SETTLED OUTCOMES (showing actual_value populated):');
    console.log('-'.repeat(80));
    console.log('');
    sample.forEach(row => {
      console.log(`  ${row.player_name} | ${row.market_type}`);
      console.log(`    Line: ${row.line} | Actual: ${row.actual_value} | Outcome: ${row.outcome}`);
      console.log(`    Sport: ${row.sport} | Date: ${row.game_date}`);
      console.log('');
    });
  }

  console.log('='.repeat(80));

  const tierOneReady = (total || 0) >= 1000 && parseFloat(settlementRate) >= 95;

  if (tierOneReady) {
    console.log('\n🎉 TIER 1 VALIDATION: READY FOR ML TRAINING ✅\n');
  } else {
    console.log('\n⚠️  TIER 1 VALIDATION: BLOCKED - See issues above\n');
  }

  process.exit(0);
}

quickCheck();
