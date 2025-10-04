#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debug() {
  console.log('\n═══ DEBUGGING PICK COUNT ═══\n');

  // Check total count with exact count
  const { count: totalCount } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', '2025-10-02T04:00:00Z')
    .lt('game_date', '2025-10-03T04:00:00Z');

  console.log(`Total count (exact): ${totalCount}`);

  // Check if there's a query limit
  const { data: allPicks } = await supabase
    .from('unified_picks')
    .select('id, sport, market, external_game_id, bookmaker_key')
    .gte('game_date', '2025-10-02T04:00:00Z')
    .lt('game_date', '2025-10-03T04:00:00Z')
    .limit(10000); // Increase limit

  console.log(`Rows returned: ${allPicks?.length || 0}`);

  // Group by sport
  if (allPicks) {
    const bySport = allPicks.reduce((acc, pick) => {
      const sport = pick.sport || 'unknown';
      acc[sport] = (acc[sport] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\nBy Sport:');
    Object.entries(bySport).forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count}`);
    });

    // Group by bookmaker
    const byBookmaker = allPicks.reduce((acc, pick) => {
      const bookmaker = pick.bookmaker_key || 'unknown';
      acc[bookmaker] = (acc[bookmaker] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\nBy Bookmaker:');
    Object.entries(byBookmaker).forEach(([bookmaker, count]) => {
      console.log(`  ${bookmaker}: ${count}`);
    });

    // Count unique games
    const uniqueGames = new Set(allPicks.map(p => p.external_game_id)).size;
    console.log(`\nUnique Games: ${uniqueGames}`);
  }

  console.log('\n════════════════════════════════════════════════════════\n');
}

debug().catch(console.error);
