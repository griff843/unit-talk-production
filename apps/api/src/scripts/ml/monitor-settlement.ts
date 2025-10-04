/**
 * Monitor Settlement Progress
 * Displays real-time settlement statistics
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function monitorProgress() {
  console.clear();
  console.log('🔄 SETTLEMENT MONITOR (refreshing every 10 seconds)');
  console.log('Press Ctrl+C to stop monitoring\n');

  const startTime = Date.now();

  setInterval(async () => {
    console.clear();
    console.log('🔄 SETTLEMENT MONITOR');
    console.log('='.repeat(60));

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;

    console.log(`\n⏱️  Elapsed: ${hours}h ${minutes}m ${seconds}s\n`);

    // Get statistics
    const { count: totalProps } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    const { count: settledCount } = await supabase
      .from('settled_outcomes')
      .select('*', { count: 'exact', head: true });

    const { count: playerStatsCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });

    const { data: outcomes } = await supabase
      .from('settled_outcomes')
      .select('outcome');

    const outcomeCount: Record<string, number> = { win: 0, loss: 0, push: 0, void: 0 };
    outcomes?.forEach(o => {
      outcomeCount[o.outcome] = (outcomeCount[o.outcome] || 0) + 1;
    });

    const settlementRate = ((settledCount || 0) / (totalProps || 1)) * 100;
    const winRate = (outcomeCount.win / (settledCount || 1)) * 100;

    // Calculate rate
    const propsPerSecond = (settledCount || 0) / Math.max(elapsed, 1);
    const propsPerMinute = propsPerSecond * 60;
    const remaining = (totalProps || 0) - (settledCount || 0);
    const estimatedSecondsRemaining = remaining / Math.max(propsPerSecond, 1);
    const estimatedHoursRemaining = estimatedSecondsRemaining / 3600;

    console.log('📊 PROGRESS');
    console.log(`   Total Props: ${(totalProps || 0).toLocaleString()}`);
    console.log(`   Settled: ${(settledCount || 0).toLocaleString()} (${settlementRate.toFixed(2)}%)`);
    console.log(`   Remaining: ${remaining.toLocaleString()}`);

    console.log('\n📈 PERFORMANCE');
    console.log(`   Rate: ${propsPerMinute.toFixed(0)} props/minute`);
    console.log(`   ETA: ${estimatedHoursRemaining.toFixed(1)} hours`);

    console.log('\n💾 DATA COLLECTED');
    console.log(`   Player Stats: ${(playerStatsCount || 0).toLocaleString()}`);

    console.log('\n🎯 OUTCOMES');
    console.log(`   Wins: ${outcomeCount.win.toLocaleString()} (${((outcomeCount.win / (settledCount || 1)) * 100).toFixed(1)}%)`);
    console.log(`   Losses: ${outcomeCount.loss.toLocaleString()} (${((outcomeCount.loss / (settledCount || 1)) * 100).toFixed(1)}%)`);
    console.log(`   Pushes: ${outcomeCount.push.toLocaleString()}`);
    console.log(`   Voids: ${outcomeCount.void.toLocaleString()}`);

    console.log('\n📊 WIN RATE');
    console.log(`   Current: ${winRate.toFixed(2)}%`);
    console.log(`   Expected: 47-50% (line efficiency)`);

    // Progress bar
    const barWidth = 50;
    const filled = Math.floor((settlementRate / 100) * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
    console.log(`\n[${bar}] ${settlementRate.toFixed(1)}%`);

    console.log('\n' + '='.repeat(60));
    console.log('Refreshing in 10 seconds...');
  }, 10000);
}

monitorProgress();
