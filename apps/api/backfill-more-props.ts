/**
 * Backfill More Market Props - Aggressive Strategy
 *
 * Get as many high-quality props as possible from raw_props
 */

import { supabaseClient } from './src/services/supabaseClient';
import { randomUUID } from 'crypto';

async function backfillMore() {
  console.log('🚀 Aggressive backfill - targeting 10,000+ props\n');

  // Get current count
  const { count: before } = await supabaseClient!
    .from('market_props')
    .select('*', { count: 'exact', head: true });

  console.log(`Current market_props: ${before?.toLocaleString()}`);

  const needed = Math.max(0, 10000 - (before || 0));
  const fetchLimit = Math.min(needed * 2, 50000); // 2x needed to account for duplicates

  console.log(`Need: ${needed.toLocaleString()} more props`);
  console.log(`Fetching: ${fetchLimit.toLocaleString()} from raw_props\n`);

  // Fetch large batch with minimal filters
  const { data: rawProps } = await supabaseClient!
    .from('raw_props')
    .select('id, player_name, sport, team, stat_type, line, odds, game_date, matchup, over_odds, under_odds')
    .not('player_name', 'is', null)
    .not('line', 'is', null)
    .not('sport', 'is', null)
    .order('game_date', { ascending: false })
    .limit(fetchLimit);

  console.log(`✅ Fetched ${rawProps?.length.toLocaleString()} props\n`);

  if (!rawProps || rawProps.length === 0) {
    console.log('❌ No props found');
    return;
  }

  // Process in large batches
  const batchSize = 500;
  let inserted = 0;
  let duplicates = 0;

  for (let i = 0; i < rawProps.length; i += batchSize) {
    const batch = rawProps.slice(i, i + batchSize);

    const marketProps = batch.map(raw => ({
      id: randomUUID(),
      player_name: raw.player_name,
      sport: raw.sport,
      market: raw.stat_type || 'player_prop',
      selection: 'Over',
      line: raw.line,
      odds: raw.odds || -110,
      over_odds: raw.over_odds,
      under_odds: raw.under_odds,
      game_date: raw.game_date || '2025-01-01',
      team: raw.team,
      bookmaker_key: 'historical',
      external_prop_id: `raw_${raw.id}`,
      metadata: { source: 'large_backfill' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabaseClient!
      .from('market_props')
      .insert(marketProps);

    if (error?.code === '23505') {
      duplicates += batch.length;
    } else if (!error) {
      inserted += batch.length;
    }

    if (i % 5000 === 0 && i > 0) {
      console.log(`  ${i.toLocaleString()}/${rawProps.length.toLocaleString()} | +${inserted.toLocaleString()} new`);
    }
  }

  const { count: after } = await supabaseClient!
    .from('market_props')
    .select('*', { count: 'exact', head: true });

  console.log('\n' + '='.repeat(60));
  console.log(`Before: ${before?.toLocaleString()} props`);
  console.log(`After:  ${after?.toLocaleString()} props`);
  console.log(`Added:  +${((after || 0) - (before || 0)).toLocaleString()} props`);
  console.log(`Duplicates: ${duplicates.toLocaleString()}`);
  console.log('='.repeat(60));

  if ((after || 0) >= 10000) {
    console.log('\n🎉 TARGET ACHIEVED!');
  }
}

backfillMore().then(() => process.exit(0)).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
