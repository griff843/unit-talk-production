/**
 * Analyze the 1.4M props in raw_props table
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function analyzeProps() {
  console.log('🔍 Analyzing 1.4M props in raw_props...\n');

  //Get sport/market breakdown via aggregation
  const { data: sample, error } = await supabase
    .from('raw_props')
    .select('sport, stat_type, game_date, player_name')
    .limit(50000); // Sample 50k to get distribution

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  const sportBreakdown: Record<string, any> = {};
  const marketBreakdown: Record<string, number> = {};
  let minDate: string | null = null;
  let maxDate: string | null = null;

  sample?.forEach(p => {
    const sport = p.sport || 'UNKNOWN';
    const market = p.stat_type || 'UNKNOWN';

    if (!sportBreakdown[sport]) {
      sportBreakdown[sport] = { count: 0, markets: new Set() };
    }
    sportBreakdown[sport].count++;
    sportBreakdown[sport].markets.add(market);

    marketBreakdown[market] = (marketBreakdown[market] || 0) + 1;

    if (p.game_date) {
      if (!minDate || p.game_date < minDate) minDate = p.game_date;
      if (!maxDate || p.game_date > maxDate) maxDate = p.game_date;
    }
  });

  console.log('📊 Sport Breakdown (from 50k sample):');
  Object.keys(sportBreakdown).forEach(sport => {
    const data = sportBreakdown[sport];
    console.log(`  ${sport}: ${data.count.toLocaleString()} props, ${data.markets.size} market types`);
  });

  console.log(`\n📅 Date Range: ${minDate} to ${maxDate}`);

  console.log('\n🎯 Top Market Types:');
  const topMarkets = Object.entries(marketBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15);

  topMarkets.forEach(([market, count]) => {
    console.log(`  ${market}: ${count.toLocaleString()}`);
  });

  // Check if props have player names (needed for settlement)
  const withPlayerNames = sample?.filter(p => p.player_name && p.player_name !== '').length || 0;
  const playerNamePercent = (withPlayerNames / (sample?.length || 1)) * 100;

  console.log(`\n👤 Player Name Coverage: ${playerNamePercent.toFixed(1)}% (${withPlayerNames.toLocaleString()}/${sample?.length.toLocaleString()})`);

  // Estimate settlement potential
  console.log('\n🎯 Settlement Potential:');
  console.log(`  Total Props: 1,397,033`);
  console.log(`  Player Stats Available: 134,970`);
  console.log(`  Current Settled: 2,003`);
  console.log(`  Remaining: ~1,395,000`);

  // Calculate expected settlement rate
  const playerStatsCount = 134970;
  const estimatedSettleable = Math.min(1397033 * (playerNamePercent / 100), playerStatsCount * 20); // Assume ~20 props per player-game
  console.log(`  Estimated Settleable: ${estimatedSettleable.toLocaleString()} (based on player stats coverage)`);

  process.exit(0);
}

analyzeProps();
