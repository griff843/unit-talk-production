/**
 * Investigate MLB Historical Data
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function investigate() {
  console.log('🔍 Investigating MLB historical data...\n');

  // Get all MLB player_stats
  const { data: allStats, error } = await supabase
    .from('player_stats')
    .select('*')
    .eq('sport', 'MLB');

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(`Total MLB player_stats: ${allStats?.length}\n`);

  // Check date range
  const dates = allStats?.map(s => s.game_date).filter(d => d);
  const uniqueDates = [...new Set(dates)].sort();
  console.log(`Date range: ${uniqueDates[0]} to ${uniqueDates[uniqueDates.length - 1]}`);
  console.log(`Unique dates: ${uniqueDates.length}\n`);

  // Check players with multiple games
  const playerMap = new Map<string, any[]>();
  allStats?.forEach(stat => {
    const name = stat.player_name;
    if (!playerMap.has(name)) {
      playerMap.set(name, []);
    }
    playerMap.get(name)!.push(stat);
  });

  const playersWithMultipleGames = Array.from(playerMap.entries())
    .filter(([_, games]) => games.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`Players with multiple games: ${playersWithMultipleGames.length}\n`);

  if (playersWithMultipleGames.length > 0) {
    console.log('Top 10 players by game count:');
    playersWithMultipleGames.slice(0, 10).forEach(([name, games]) => {
      const dates = games.map(g => g.game_date).sort();
      console.log(`  ${name}: ${games.length} games (${dates[0]} to ${dates[dates.length - 1]})`);
    });
  } else {
    console.log('⚠️ NO players have multiple games - each player appears only once!');
    console.log('This means we have a SINGLE day snapshot, not historical data.\n');
  }

  // Sample a few stats to see structure
  console.log('\nSample player stats (first 5):');
  allStats?.slice(0, 5).forEach(stat => {
    console.log(`  ${stat.player_name} (${stat.game_date}):`);
    console.log(`    Stats fields: ${Object.keys(stat.stats || {}).join(', ')}`);
    console.log(`    Sample values:`, JSON.stringify(stat.stats || {}).slice(0, 200));
  });

  // Check if we can calculate probabilities with this data
  console.log('\n🎯 Probability Calculation Feasibility:');

  if (playersWithMultipleGames.length === 0) {
    console.log('❌ CANNOT calculate historical probabilities');
    console.log('   Reason: Need 5+ games per player, but each player only has 1 game');
    console.log('   Solution: Collect full season data (162 games × player stats)');
  } else if (playersWithMultipleGames.length < 50) {
    console.log('⚠️ LIMITED historical probabilities');
    console.log(`   Only ${playersWithMultipleGames.length} players have multiple games`);
    console.log('   Recommendation: Collect more historical data');
  } else {
    console.log('✅ CAN calculate historical probabilities');
    console.log(`   ${playersWithMultipleGames.length} players with multiple games`);
  }

  // Check raw_props alignment
  console.log('\n📊 Checking raw_props alignment with stats...\n');

  const { data: props } = await supabase
    .from('raw_props')
    .select('player_name, game_date, stat_type')
    .eq('sport', 'MLB')
    .limit(10);

  console.log('Sample raw_props:');
  props?.forEach(p => {
    console.log(`  ${p.player_name} - ${p.game_date} - ${p.stat_type}`);
  });

  // Check if any props match stats dates
  const propDates = new Set(props?.map(p => p.game_date));
  const statDates = new Set(dates);
  const overlap = [...propDates].filter(d => statDates.has(d));

  console.log(`\nDate overlap: ${overlap.length} matching dates`);
  if (overlap.length > 0) {
    console.log('Matching dates:', overlap.slice(0, 5).join(', '));
  } else {
    console.log('⚠️ NO DATE OVERLAP - Props and stats are from different days!');
  }

  process.exit(0);
}

investigate();
