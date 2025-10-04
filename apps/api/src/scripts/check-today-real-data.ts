#!/usr/bin/env tsx
/**
 * Check REAL data ingested for today (Oct 2, 2025)
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRealData() {
  const today = '2025-10-02';

  console.log('\n════════════════════════════════════════════════════════');
  console.log('  REAL DATA CHECK FOR TODAY: October 2, 2025');
  console.log('════════════════════════════════════════════════════════\n');

  // Check games for today
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .gte('game_date', today + 'T00:00:00Z')
    .lt('game_date', '2025-10-03T00:00:00Z')
    .order('game_date');

  console.log('═══ GAMES FOR TODAY (Oct 2, 2025) ═══');
  console.log(`Total games: ${games?.length || 0}\n`);

  if (games && games.length > 0) {
    games.forEach(g => {
      console.log(`  ${g.sport}: ${g.away_team} @ ${g.home_team}`);
      console.log(`     Time: ${g.game_date}`);
      console.log(`     External ID: ${g.external_game_id}`);
      console.log('');
    });
  } else {
    console.log('  ⚠️  NO GAMES FOUND FOR TODAY\n');
  }

  // Check unified_picks for today
  const { count: totalCount } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', today + 'T00:00:00Z')
    .lt('game_date', '2025-10-03T00:00:00Z');

  console.log('═══ PROPS/PICKS FOR TODAY (Oct 2, 2025) ═══');
  console.log(`Total props: ${totalCount || 0}\n`);

  // Breakdown by market
  const { data: allPicks } = await supabase
    .from('unified_picks')
    .select('market, bookmaker_key, selection, odds, matchup')
    .gte('game_date', today + 'T00:00:00Z')
    .lt('game_date', '2025-10-03T00:00:00Z')
    .limit(10);

  if (allPicks && allPicks.length > 0) {
    const marketCounts: Record<string, number> = {};

    const { data: byMarket } = await supabase
      .from('unified_picks')
      .select('market')
      .gte('game_date', today + 'T00:00:00Z')
      .lt('game_date', '2025-10-03T00:00:00Z');

    byMarket?.forEach(p => {
      marketCounts[p.market] = (marketCounts[p.market] || 0) + 1;
    });

    console.log('By market type:');
    Object.entries(marketCounts).forEach(([market, count]) => {
      console.log(`  ${market}: ${count} props`);
    });

    console.log('\nSample props (first 10):');
    allPicks.forEach(p => {
      console.log(`  [${p.market}] ${p.matchup}: ${p.selection} @ ${p.odds} (${p.bookmaker_key})`);
    });
  } else {
    console.log('  ⚠️  NO PROPS FOUND FOR TODAY\n');
  }

  // Check what sports we have in games table
  const { data: bySport } = await supabase
    .from('games')
    .select('sport')
    .gte('game_date', today + 'T00:00:00Z')
    .lt('game_date', '2025-10-03T00:00:00Z');

  if (bySport && bySport.length > 0) {
    const sportCounts: Record<string, number> = {};
    bySport.forEach(g => {
      sportCounts[g.sport] = (sportCounts[g.sport] || 0) + 1;
    });

    console.log('\n═══ SPORTS BREAKDOWN ═══');
    Object.entries(sportCounts).forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count} games`);
    });
  }

  // Check for player props specifically
  const { count: playerPropsCount } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', today + 'T00:00:00Z')
    .lt('game_date', '2025-10-03T00:00:00Z')
    .not('market', 'in', '(h2h,spreads,totals)');

  console.log('\n═══ PLAYER PROPS ═══');
  console.log(`Player props (non core markets): ${playerPropsCount || 0}`);

  console.log('\n════════════════════════════════════════════════════════\n');
}

checkRealData().catch(console.error);
