/**
 * Check Full Dataset Stats
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkDataset() {
  console.log('🔍 Analyzing Full Dataset...\n');

  // Get props by sport
  const { data: props, error: propsError } = await supabase
    .from('raw_props')
    .select('sport, game_date, stat_type, market_type');

  if (propsError) {
    console.error('Props error:', propsError);
    process.exit(1);
  }

  const totalProps = props?.length || 0;
  console.log(`📊 Total Props: ${totalProps.toLocaleString()}\n`);

  // Breakdown by sport
  const sportBreakdown: Record<string, any> = {};
  props?.forEach(p => {
    const sport = p.sport || 'UNKNOWN';
    if (!sportBreakdown[sport]) {
      sportBreakdown[sport] = { count: 0, minDate: null, maxDate: null };
    }
    sportBreakdown[sport].count++;

    const gameDate = p.game_date;
    if (gameDate) {
      if (!sportBreakdown[sport].minDate || gameDate < sportBreakdown[sport].minDate) {
        sportBreakdown[sport].minDate = gameDate;
      }
      if (!sportBreakdown[sport].maxDate || gameDate > sportBreakdown[sport].maxDate) {
        sportBreakdown[sport].maxDate = gameDate;
      }
    }
  });

  console.log('Sport Breakdown:');
  console.table(sportBreakdown);

  // Get player_stats coverage
  const { data: stats, error: statsError } = await supabase
    .from('player_stats')
    .select('sport, game_date');

  if (statsError) {
    console.error('Stats error:', statsError);
    process.exit(1);
  }

  const totalStats = stats?.length || 0;
  console.log(`\n📈 Total Player Stats: ${totalStats.toLocaleString()}\n`);

  const statsBreakdown: Record<string, any> = {};
  stats?.forEach(s => {
    const sport = s.sport || 'UNKNOWN';
    if (!statsBreakdown[sport]) {
      statsBreakdown[sport] = { count: 0, minDate: null, maxDate: null };
    }
    statsBreakdown[sport].count++;

    const gameDate = s.game_date;
    if (gameDate) {
      if (!statsBreakdown[sport].minDate || gameDate < statsBreakdown[sport].minDate) {
        statsBreakdown[sport].minDate = gameDate;
      }
      if (!statsBreakdown[sport].maxDate || gameDate > statsBreakdown[sport].maxDate) {
        statsBreakdown[sport].maxDate = gameDate;
      }
    }
  });

  console.log('Stats Coverage:');
  console.table(statsBreakdown);

  // Calculate potential settlements
  console.log('\n🎯 Settlement Potential:');
  Object.keys(sportBreakdown).forEach(sport => {
    const propCount = sportBreakdown[sport].count;
    const statsCount = statsBreakdown[sport]?.count || 0;
    const potential = statsCount > 0 ? 'High' : 'None';
    console.log(`  ${sport}: ${propCount.toLocaleString()} props, ${statsCount.toLocaleString()} stats → ${potential}`);
  });

  // Get current settled count
  const { count: settledCount } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📦 Current Settled: ${settledCount?.toLocaleString() || 0}`);
  console.log(`📦 Remaining to Settle: ${(totalProps - (settledCount || 0)).toLocaleString()}`);
  console.log(`📦 Settlement Progress: ${((settledCount || 0) / totalProps * 100).toFixed(2)}%\n`);

  process.exit(0);
}

checkDataset();
