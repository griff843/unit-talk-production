#!/usr/bin/env tsx
/**
 * Check Oct 2, 2025 ET data (which is Oct 2-3 in UTC due to timezone)
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkOct2ET() {
  console.log('\n════════════════════════════════════════════════════════');
  console.log('  OCT 2, 2025 ET DATA CHECK (Timezone-aware)');
  console.log('════════════════════════════════════════════════════════\n');

  // Oct 2 in ET spans from Oct 2 00:00 ET to Oct 3 00:00 ET
  // In UTC: Oct 2 04:00 UTC to Oct 3 04:00 UTC (ET is UTC-4 during DST)

  // Check games for "Oct 2 ET" which is Oct 2-3 in UTC
  const { data: games } = await supabase
    .from('games')
    .select('sport, game_date, home_team, away_team, external_game_id')
    .gte('game_date', '2025-10-02T04:00:00Z') // Oct 2, 12:00 AM ET
    .lt('game_date', '2025-10-03T04:00:00Z')  // Oct 3, 12:00 AM ET
    .order('game_date');

  console.log('═══ GAMES ON OCT 2, 2025 (ET timezone) ═══');
  console.log(`Total games: ${games?.length || 0}\n`);

  const sportCounts: Record<string, number> = {};
  games?.forEach(g => {
    sportCounts[g.sport] = (sportCounts[g.sport] || 0) + 1;
    const dateStr = g.game_date ? String(g.game_date).substring(0, 16) : 'NO DATE';
    console.log(`  ${dateStr} | ${g.sport} | ${g.away_team} @ ${g.home_team}`);
  });

  console.log('\nBy sport:');
  Object.entries(sportCounts).forEach(([sport, count]) => {
    console.log(`  ${sport}: ${count} games`);
  });

  // Check props for Oct 2 ET
  const { count: totalProps } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', '2025-10-02T04:00:00Z')
    .lt('game_date', '2025-10-03T04:00:00Z');

  console.log(`\n═══ PROPS ON OCT 2, 2025 (ET timezone) ═══`);
  console.log(`Total props: ${totalProps || 0}\n`);

  if (totalProps && totalProps > 0) {
    const { data: allProps } = await supabase
      .from('unified_picks')
      .select('market, metadata')
      .gte('game_date', '2025-10-02T04:00:00Z')
      .lt('game_date', '2025-10-03T04:00:00Z');

    const marketCounts: Record<string, number> = {};
    const sportCounts2: Record<string, number> = {};

    allProps?.forEach(p => {
      marketCounts[p.market] = (marketCounts[p.market] || 0) + 1;
      const sport = p.metadata?.sport_key || 'UNKNOWN';
      sportCounts2[sport] = (sportCounts2[sport] || 0) + 1;
    });

    console.log('By sport:');
    Object.entries(sportCounts2).sort((a, b) => b[1] - a[1]).forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count} props`);
    });

    console.log('\nTop 15 markets:');
    Object.entries(marketCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([market, count]) => {
      console.log(`  ${market}: ${count} props`);
    });
  }

  console.log('\n════════════════════════════════════════════════════════\n');
}

checkOct2ET().catch(console.error);
