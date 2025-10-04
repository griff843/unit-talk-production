/**
 * Check game counts for MLB players
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkGameCounts() {
  const testPlayers = [
    'Bryan Reynolds',
    'Oneil Cruz',
    'Hoby Milner',
    'Joe Ross',
    'Jack Flaherty',
  ];

  console.log('Checking MLB player game counts:\n');

  for (const player of testPlayers) {
    const { data } = await supabase
      .from('player_stats')
      .select('game_date, stats')
      .eq('sport', 'MLB')
      .ilike('player_name', `%${player}%`)
      .order('game_date', { ascending: false });

    const dates = data?.map(d => d.game_date) || [];
    const uniqueDates = [...new Set(dates)];

    console.log(`${player}:`);
    console.log(`  Total records: ${data?.length}`);
    console.log(`  Unique dates: ${uniqueDates.length}`);
    console.log(`  Dates: ${uniqueDates.slice(0, 5).join(', ')}`);

    // Check if stats have hits field
    const withHits = data?.filter(d => d.stats && 'hits' in d.stats).length || 0;
    console.log(`  Records with 'hits' stat: ${withHits}`);
    console.log('');
  }

  process.exit(0);
}

checkGameCounts();
