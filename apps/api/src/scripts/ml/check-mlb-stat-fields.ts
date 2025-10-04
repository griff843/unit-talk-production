/**
 * Check actual MLB stat field names in player_stats
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkStatFields() {
  // Get a sample MLB player stat
  const { data } = await supabase
    .from('player_stats')
    .select('player_name, stats, game_date')
    .eq('sport', 'MLB')
    .limit(10);

  console.log('Sample MLB player_stats entries:\n');

  data?.forEach((stat, i) => {
    console.log(`${i + 1}. ${stat.player_name} (${stat.game_date})`);
    console.log('   Stats keys:', Object.keys(stat.stats || {}).join(', '));
    console.log('   Sample values:', JSON.stringify(stat.stats || {}, null, 2).slice(0, 500));
    console.log('');
  });

  process.exit(0);
}

checkStatFields();
