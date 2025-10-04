/**
 * Settle All Existing Props
 *
 * Retroactively settles the 1.4M props in raw_props table
 * - 1,385,822 MLB props
 * - 1,495 NFL props
 *
 * This creates our massive training dataset for ML!
 */

import { propsSettlementEngine } from '../../services/data-collection/PropsSettlementEngine';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function settleAllExistingProps() {
  console.log('🚀 SETTLING ALL 1.4M EXISTING PROPS');
  console.log('==========================================\n');

  // Show initial statistics
  const { count: totalRawProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true });

  const { count: mlbProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB');

  const { count: nflProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL');

  const { count: alreadySettled } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true });

  console.log('📊 CURRENT STATE:');
  console.log(`   Total Props: ${(totalRawProps || 0).toLocaleString()}`);
  console.log(`   MLB Props: ${(mlbProps || 0).toLocaleString()}`);
  console.log(`   NFL Props: ${(nflProps || 0).toLocaleString()}`);
  console.log(`   Already Settled: ${(alreadySettled || 0).toLocaleString()}`);
  console.log(`   Remaining to Settle: ${((totalRawProps || 0) - (alreadySettled || 0)).toLocaleString()}\n`);

  console.log('🎯 SETTLEMENT PLAN:');
  console.log('   1. Settle all MLB props (1.38M) - could take 2-4 hours');
  console.log('   2. Settle all NFL props (1,495) - should take ~15 minutes');
  console.log('   3. Calculate league averages from settled data');
  console.log('   4. Enable player historical method\n');

  console.log('⚠️  This is a LONG-RUNNING operation!');
  console.log('   Consider running in background: npm run settle:props &\n');

  // Confirm before starting
  console.log('Starting in 5 seconds... (Ctrl+C to cancel)\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  const startTime = Date.now();

  try {
    // Step 1: Settle MLB props (the bulk of the work)
    console.log('\n🏀 PHASE 1: SETTLING MLB PROPS');
    console.log('==========================================\n');
    await propsSettlementEngine.settleAllMLBProps(30); // 30 days per batch

    // Show progress
    let stats = await propsSettlementEngine.getSettlementStats();
    console.log('\n📊 MLB SETTLEMENT COMPLETE:');
    console.log(`   Settled: ${stats.settledCount.toLocaleString()}`);
    console.log(`   Win Rate: ${stats.winRate.toFixed(2)}%\n`);

    // Step 2: Settle NFL props (much smaller dataset)
    console.log('\n🏈 PHASE 2: SETTLING NFL PROPS');
    console.log('==========================================\n');

    const nflSettled = await propsSettlementEngine.settleRecentNFLProps(16); // 16 weeks = full season
    console.log(`\n✅ Settled ${nflSettled} NFL props\n`);

    // Final statistics
    stats = await propsSettlementEngine.getSettlementStats();

    const endTime = Date.now();
    const durationMinutes = ((endTime - startTime) / 1000 / 60).toFixed(1);

    console.log('\n\n🎉 ALL PROPS SETTLED!');
    console.log('==========================================');
    console.log(`   Total Settled: ${stats.settledCount.toLocaleString()}`);
    console.log(`   Settlement Rate: ${stats.settlementRate.toFixed(1)}%`);
    console.log(`   Win Rate: ${stats.winRate.toFixed(2)}%`);
    console.log(`   Duration: ${durationMinutes} minutes\n`);

    console.log('📊 Outcome Breakdown:');
    Object.entries(stats.outcomeBreakdown).forEach(([outcome, count]) => {
      console.log(`   ${outcome}: ${count.toLocaleString()}`);
    });

    console.log('\n\n✅ NEXT STEPS:');
    console.log('   1. Calculate league averages from settled data');
    console.log('      npx tsx src/scripts/ml/calculate-league-averages.ts');
    console.log('');
    console.log('   2. Test probability calculator with real data');
    console.log('      npx tsx src/scripts/ml/test-probability-calculator.ts');
    console.log('');
    console.log('   3. Compare old vs new system');
    console.log('      npx tsx src/scripts/ml/compare-old-vs-new-system.ts');
    console.log('');
    console.log('   4. Train ML models on 1M+ samples');
    console.log('      npx tsx src/scripts/ml/train-models.ts');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Settlement failed:', error.message);
    console.error(error.stack);

    // Show partial progress
    const stats = await propsSettlementEngine.getSettlementStats();
    console.log('\n📊 Partial Progress:');
    console.log(`   Settled so far: ${stats.settledCount.toLocaleString()}`);

    process.exit(1);
  }
}

settleAllExistingProps();
