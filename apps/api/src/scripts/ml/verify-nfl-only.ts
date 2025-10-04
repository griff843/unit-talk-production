/**
 * Verify NFL-Only Settlement Results
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function verifyNFLSettlements() {
  console.log('🏈 Verifying NFL Settlement Results...\n');

  // Get NFL settlements only
  const { data: nflData, error } = await supabase
    .from('settled_outcomes')
    .select('*')
    .eq('sport', 'NFL')
    .order('settled_at', { ascending: false });

  if (error) {
    console.error('Error querying NFL settlements:', error);
    process.exit(1);
  }

  const total = nflData?.length || 0;
  const wins = nflData?.filter(r => r.outcome === 'win').length || 0;
  const losses = nflData?.filter(r => r.outcome === 'loss').length || 0;
  const pushes = nflData?.filter(r => r.outcome === 'push').length || 0;
  const voids = nflData?.filter(r => r.outcome === 'void').length || 0;

  const winRate = (wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(2) : 0;

  console.log('📊 NFL Settlement Summary:');
  console.log(`Total NFL Outcomes: ${total}`);
  console.log(`Wins: ${wins}`);
  console.log(`Losses: ${losses}`);
  console.log(`Pushes: ${pushes}`);
  console.log(`Voids: ${voids}`);
  console.log(`Win Rate: ${winRate}%\n`);

  // Show sample of wins and losses
  const wins_sample = nflData?.filter(r => r.outcome === 'win').slice(0, 5) || [];
  const losses_sample = nflData?.filter(r => r.outcome === 'loss').slice(0, 5) || [];

  console.log('✅ Sample Wins:');
  wins_sample.forEach(w => {
    console.log(`  ${w.player_name} ${w.market_type} O${w.line} → Actual: ${w.actual_value} ✓`);
  });

  console.log('\n❌ Sample Losses:');
  losses_sample.forEach(l => {
    console.log(`  ${l.player_name} ${l.market_type} O${l.line} → Actual: ${l.actual_value} ✗`);
  });

  // Show market type breakdown
  const marketBreakdown: Record<string, any> = {};
  nflData?.forEach(row => {
    const market = row.market_type || 'unknown';
    if (!marketBreakdown[market]) {
      marketBreakdown[market] = { total: 0, win: 0, loss: 0 };
    }
    marketBreakdown[market].total++;
    if (row.outcome === 'win') marketBreakdown[market].win++;
    if (row.outcome === 'loss') marketBreakdown[market].loss++;
  });

  console.log('\n📋 Market Type Breakdown:');
  console.table(marketBreakdown);

  process.exit(0);
}

verifyNFLSettlements();
