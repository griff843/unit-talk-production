/**
 * Find ACTUAL Settled Data
 *
 * Query for props that have real outcomes (not "pending")
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findSettledData() {
  console.log('🔍 FINDING ACTUAL SETTLED PROPS');
  console.log('==========================================\n');

  // Check raw_props with outcome NOT null and NOT 'pending'
  console.log('📊 Checking raw_props.outcome...');
  const { data: outcomeData, count: outcomeCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact' })
    .not('outcome', 'is', null)
    .neq('outcome', 'pending');

  console.log(`   Found ${outcomeCount} props with non-pending outcomes`);

  if (outcomeData && outcomeData.length > 0) {
    console.log(`\n   Sample (first 5):`);
    outcomeData.slice(0, 5).forEach((prop: any, i: number) => {
      console.log(`   ${i + 1}. ${prop.sport} - ${prop.player_name || 'Unknown'}`);
      console.log(`      Market: ${prop.market_type || prop.stat_type}`);
      console.log(`      Line: ${prop.line}`);
      console.log(`      Outcome: ${prop.outcome}`);
      console.log(`      Actual Value: ${prop.actual_value}`);
      console.log(`      Date: ${prop.game_date || prop.start_time}`);
    });

    // Group by sport
    const bySport: any = {};
    const byOutcome: any = {};
    outcomeData.forEach((prop: any) => {
      bySport[prop.sport] = (bySport[prop.sport] || 0) + 1;
      byOutcome[prop.outcome] = (byOutcome[prop.outcome] || 0) + 1;
    });

    console.log(`\n   By Sport:`);
    Object.entries(bySport).forEach(([sport, count]) => {
      console.log(`      ${sport}: ${count}`);
    });

    console.log(`\n   By Outcome:`);
    Object.entries(byOutcome).forEach(([outcome, count]) => {
      console.log(`      ${outcome}: ${count}`);
    });
  }

  // Check for props with actual_value NOT null
  console.log('\n📊 Checking raw_props.actual_value...');
  const { count: actualValueCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .not('actual_value', 'is', null);

  console.log(`   Found ${actualValueCount} props with actual_value`);

  // Check for status NOT 'pending'
  console.log('\n📊 Checking raw_props where status != pending...');
  const { data: statusData, count: statusCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact' })
    .neq('status', 'pending')
    .limit(10);

  console.log(`   Found ${statusCount} props with non-pending status`);

  if (statusData && statusData.length > 0) {
    const uniqueStatuses = [...new Set(statusData.map((p: any) => p.status))];
    console.log(`   Statuses: ${uniqueStatuses.join(', ')}`);
  }

  // Check source = 'sgo' specifically
  console.log('\n📊 Checking source=sgo props...');
  const { count: sgoCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'sgo');

  console.log(`   Found ${sgoCount} props from SGO source`);

  if (sgoCount && sgoCount > 0) {
    const { data: sgoWithOutcome } = await supabase
      .from('raw_props')
      .select('*')
      .eq('source', 'sgo')
      .not('outcome', 'is', null)
      .neq('outcome', 'pending')
      .limit(10);

    console.log(`   SGO props with outcomes: ${sgoWithOutcome?.length || 0}`);
  }

  // Check for result != 'pending'
  console.log('\n📊 Checking raw_props where result != pending...');
  const { data: resultData, count: resultCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact' })
    .neq('result', 'pending')
    .limit(10);

  console.log(`   Found ${resultCount} props with non-pending result`);

  if (resultData && resultData.length > 0) {
    const uniqueResults = [...new Set(resultData.map((p: any) => p.result))];
    console.log(`   Results: ${uniqueResults.join(', ')}`);
  }

  // CRITICAL ASSESSMENT
  console.log('\n\n🎯 CRITICAL ASSESSMENT');
  console.log('==========================================');

  const totalSettled = (outcomeCount || 0) + (actualValueCount || 0) + (resultCount || 0);

  if (totalSettled < 1000) {
    console.log(`❌ INSUFFICIENT TRAINING DATA: Only ${totalSettled} settled props found`);
    console.log('\n📋 RECOMMENDED ACTIONS:');
    console.log('   1. Check if SGO backfill script was run (SYNDICATE_ML_TRAINING_PLAN mentions 742K props)');
    console.log('   2. Look for archived data exports or backups');
    console.log('   3. Contact data provider for historical settled props');
    console.log('   4. Consider using Odds API historical data endpoint');
    console.log('\n⚠️  CANNOT TRAIN PRODUCTION ML MODELS WITH <1000 SAMPLES');
    console.log('   Minimum recommended: 10,000 settled props per sport');
    console.log('   Ideal: 50,000+ settled props per sport');
  } else {
    console.log(`✅ Found ${totalSettled} settled props - may be enough for initial training`);
    console.log('   Proceeding to export for ML pipeline...');
  }
}

findSettledData().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
