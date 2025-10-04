#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  console.log('\n═══ CHECKING EXISTING 49ERS VS RAMS DATA ═══\n');

  const gameId = 'c4b72eabb3d557e73022ec730d8e3944';

  // Check picks for this game
  const { data: picks, count } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact' })
    .eq('external_game_id', gameId);

  console.log(`Total picks for 49ers vs Rams: ${count}`);

  if (picks && picks.length > 0) {
    // Group by market type
    const byMarket = picks.reduce((acc, pick) => {
      const market = pick.market || 'unknown';
      acc[market] = (acc[market] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\nBreakdown by market:');
    Object.entries(byMarket)
      .sort((a, b) => b[1] - a[1])
      .forEach(([market, count]) => {
        const isPlayerProp = !['h2h', 'spreads', 'totals'].includes(market);
        const type = isPlayerProp ? '[PLAYER PROP]' : '[CORE]';
        console.log(`  ${type} ${market}: ${count}`);
      });

    // Check for player props
    const playerProps = picks.filter(p => p.external_prop_id !== null);
    const coreMarkets = picks.filter(p => p.external_prop_id === null);

    console.log(`\nPlayer props: ${playerProps.length}`);
    console.log(`Core markets: ${coreMarkets.length}`);

    // Sample a few picks
    console.log('\nSample picks:');
    picks.slice(0, 3).forEach(pick => {
      console.log(`  ${pick.market} - ${pick.selection} @ ${pick.odds} (${pick.bookmaker_key})`);
    });
  } else {
    console.log('❌ No picks found for this game');
  }

  console.log('\n════════════════════════════════════════════════════════\n');
}

check().catch(console.error);
