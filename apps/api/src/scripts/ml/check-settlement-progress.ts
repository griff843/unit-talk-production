/**
 * Quick Settlement Progress Check
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProgress() {
  console.log('📊 SETTLEMENT PROGRESS CHECK\n');

  // Total props
  const { count: totalProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true });

  // Settled outcomes
  const { count: settledCount } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true });

  // Player stats collected
  const { count: playerStatsCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });

  // Outcome breakdown
  const { data: outcomes } = await supabase
    .from('settled_outcomes')
    .select('outcome');

  const outcomeCount: Record<string, number> = { win: 0, loss: 0, push: 0, void: 0 };
  outcomes?.forEach(o => {
    outcomeCount[o.outcome] = (outcomeCount[o.outcome] || 0) + 1;
  });

  const winRate = (outcomeCount.win / (settledCount || 1)) * 100;

  console.log('Total Props in Database:', (totalProps || 0).toLocaleString());
  console.log('Settled Outcomes:', (settledCount || 0).toLocaleString());
  console.log('Settlement Rate:', ((settledCount || 0) / (totalProps || 1) * 100).toFixed(2) + '%');
  console.log('\nPlayer Stats Collected:', (playerStatsCount || 0).toLocaleString());
  console.log('\nOutcome Distribution:');
  Object.entries(outcomeCount).forEach(([outcome, count]) => {
    console.log(`   ${outcome}: ${count.toLocaleString()} (${((count / (settledCount || 1)) * 100).toFixed(1)}%)`);
  });
  console.log('\nWin Rate:', winRate.toFixed(2) + '%');

  // Recent settlements
  const { data: recent } = await supabase
    .from('settled_outcomes')
    .select('player_name, market_type, line, outcome, actual_value, game_date')
    .order('settled_at', { ascending: false })
    .limit(5);

  if (recent && recent.length > 0) {
    console.log('\n📋 Recent Settlements:');
    recent.forEach(r => {
      console.log(`   ${r.player_name} ${r.market_type} ${r.line} → ${r.outcome} (actual: ${r.actual_value})`);
    });
  }

  process.exit(0);
}

checkProgress();
