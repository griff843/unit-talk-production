#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNFL() {
  console.log('\n═══ NFL PROPS CHECK ═══\n');

  // Check for 49ers vs Rams game specifically
  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('external_game_id', 'c4b72eabb3d557e73022ec730d8e3944')
    .single();

  console.log('49ers vs Rams game in database:');
  if (game) {
    console.log('  ✅ Found');
    console.log('  game_date:', game.game_date);
    console.log('  matchup:', game.matchup);
  } else {
    console.log('  ❌ Not found');
  }

  // Check for props from this game
  const { count } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .eq('external_game_id', 'c4b72eabb3d557e73022ec730d8e3944');

  console.log(`\n49ers vs Rams props: ${count || 0}`);
  console.log(`Expected: ~760 props\n`);

  // Check ALL NFL props
  const { data: allProps } = await supabase
    .from('unified_picks')
    .select('metadata')
    .limit(5000);

  const nflProps = allProps?.filter(p => p.metadata?.sport_key === 'americanfootball_nfl') || [];
  console.log(`Total NFL props in database: ${nflProps.length}`);

  console.log('\n');
}

checkNFL().catch(console.error);
