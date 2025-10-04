/**
 * Check historical data coverage by sport
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkCoverage() {
  console.log('📊 Historical Data Coverage Analysis\n');
  console.log('='.repeat(80));

  const { data: stats } = await supabase
    .from('player_stats')
    .select('sport, game_date, player_name')
    .order('game_date', { ascending: true });

  const bySport: Record<
    string,
    { count: number; players: Set<string>; dates: Set<string> }
  > = {};

  stats?.forEach((s) => {
    if (!bySport[s.sport]) {
      bySport[s.sport] = { count: 0, players: new Set(), dates: new Set() };
    }
    bySport[s.sport].count++;
    bySport[s.sport].players.add(s.player_name);
    bySport[s.sport].dates.add(s.game_date);
  });

  console.log('\nPlayer Stats in Database:\n');

  for (const [sport, data] of Object.entries(bySport)) {
    const dates = Array.from(data.dates).sort();

    console.log(`${sport}:`);
    console.log(`  Total records: ${data.count.toLocaleString()}`);
    console.log(`  Unique players: ${data.players.size.toLocaleString()}`);
    console.log(`  Unique dates: ${data.dates.size}`);
    console.log(`  Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
    console.log(`  Avg games/player: ${(data.count / data.players.size).toFixed(1)}`);
    console.log('');
  }

  // Check data quality - how many have non-empty stats
  console.log('Data Quality Check:\n');

  for (const sport of Object.keys(bySport)) {
    const { data: sportStats } = await supabase
      .from('player_stats')
      .select('stats')
      .eq('sport', sport)
      .limit(1000);

    const withData = sportStats?.filter((s) => {
      const statKeys = Object.keys(s.stats || {});
      return statKeys.length > 0;
    }).length;

    const pct = ((withData! / sportStats!.length) * 100).toFixed(1);

    console.log(
      `  ${sport}: ${withData}/${sportStats?.length} records with stats (${pct}%)`
    );
  }

  console.log('\n' + '='.repeat(80));

  process.exit(0);
}

checkCoverage();
