#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getSummary() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  OCTOBER 2, 2025 - FINAL INGESTION SUMMARY');
  console.log('══════════════════════════════════════════════════════════\n');

  // Get all picks for Oct 2 ET (Oct 2 04:00 UTC to Oct 3 04:00 UTC)
  const { data: picks, count: totalCount } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact' })
    .gte('game_date', '2025-10-02T04:00:00Z')
    .lt('game_date', '2025-10-03T04:00:00Z');

  console.log(`Total picks ingested: ${totalCount}\n`);

  if (picks && picks.length > 0) {
    // Group by sport
    const bySport = picks.reduce((acc, pick) => {
      const sport = pick.sport || 'unknown';
      acc[sport] = (acc[sport] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('By Sport:');
    Object.entries(bySport)
      .sort((a, b) => b[1] - a[1])
      .forEach(([sport, count]) => {
        console.log(`  ${sport}: ${count} picks`);
      });

    // Group by market type
    const playerProps = picks.filter(p => p.external_prop_id !== null);
    const coreMarkets = picks.filter(p => p.external_prop_id === null);

    console.log(`\nBy Market Type:`);
    console.log(`  Player Props: ${playerProps.length}`);
    console.log(`  Core Markets: ${coreMarkets.length}`);

    // Group by specific market
    const byMarket = picks.reduce((acc, pick) => {
      const market = pick.market || 'unknown';
      acc[market] = (acc[market] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`\nTop 10 Markets:`);
    Object.entries(byMarket)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([market, count]) => {
        const type = ['h2h', 'spreads', 'totals'].includes(market) ? '[CORE]' : '[PROP]';
        console.log(`  ${type} ${market}: ${count}`);
      });

    // Group by bookmaker
    const byBookmaker = picks.reduce((acc, pick) => {
      const bookmaker = pick.bookmaker_key || pick.metadata?.bookmaker_key || 'unknown';
      acc[bookmaker] = (acc[bookmaker] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`\nBy Bookmaker:`);
    Object.entries(byBookmaker)
      .sort((a, b) => b[1] - a[1])
      .forEach(([bookmaker, count]) => {
        console.log(`  ${bookmaker}: ${count} picks`);
      });

    // Count unique games
    const uniqueGames = new Set(picks.map(p => p.external_game_id)).size;
    console.log(`\nUnique Games: ${uniqueGames}`);
  }

  console.log('\n══════════════════════════════════════════════════════════\n');
}

getSummary().catch(console.error);
