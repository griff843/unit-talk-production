#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAllProps() {
  // Total count
  const { count: total } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true });

  console.log('\n════════════════════════════════════════════════════════');
  console.log('  ALL PROPS IN DATABASE (NO DATE FILTER)');
  console.log('════════════════════════════════════════════════════════\n');
  console.log(`Total Props: ${total}\n`);

  // Recent props
  const { data: recent } = await supabase
    .from('unified_picks')
    .select('game_date, market, matchup, metadata')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('Most recent 10 props:');
  recent?.forEach(p => {
    const sport = p.metadata?.sport_key || 'UNKNOWN';
    console.log(`  ${p.game_date.split('T')[0]} | ${sport} | ${p.market} | ${p.matchup || 'NO MATCHUP'}`);
  });

  // By sport
  const { data: allProps } = await supabase
    .from('unified_picks')
    .select('metadata, market');

  const sportCounts: Record<string, number> = {};
  const marketCounts: Record<string, number> = {};

  allProps?.forEach(p => {
    const sport = p.metadata?.sport_key || p.metadata?.sport_title || 'UNKNOWN';
    sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    marketCounts[p.market] = (marketCounts[p.market] || 0) + 1;
  });

  console.log('\n═══ BY SPORT ═══');
  Object.entries(sportCounts).sort((a, b) => b[1] - a[1]).forEach(([sport, count]) => {
    console.log(`  ${sport}: ${count} props`);
  });

  console.log('\n═══ TOP 20 MARKETS ═══');
  Object.entries(marketCounts).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([market, count]) => {
    console.log(`  ${market}: ${count} props`);
  });

  // Check for NFL props
  const { count: nflCount } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .ilike('metadata->>sport_key', '%nfl%');

  console.log(`\n═══ NFL PROPS ═══`);
  console.log(`NFL prop count: ${nflCount || 0}`);

  console.log('\n════════════════════════════════════════════════════════\n');
}

checkAllProps().catch(console.error);
