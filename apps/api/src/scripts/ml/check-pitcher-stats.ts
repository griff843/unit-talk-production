/**
 * Check pitcher stat fields
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkPitcherStats() {
  const pitchers = ['Jack Flaherty', 'Joe Ross', 'Hoby Milner'];

  console.log('Checking pitcher stat fields:\n');

  for (const pitcher of pitchers) {
    const { data } = await supabase
      .from('player_stats')
      .select('stats, game_date')
      .eq('sport', 'MLB')
      .ilike('player_name', `%${pitcher}%`)
      .limit(3);

    console.log(`${pitcher}:`);
    data?.forEach((stat, i) => {
      const statKeys = Object.keys(stat.stats || {});
      console.log(`  Game ${i + 1} (${stat.game_date}):`);
      console.log(`    Fields: ${statKeys.join(', ')}`);
      console.log(`    Sample:`, JSON.stringify(stat.stats || {}, null, 2).slice(0, 300));
    });
    console.log('');
  }

  process.exit(0);
}

checkPitcherStats();
