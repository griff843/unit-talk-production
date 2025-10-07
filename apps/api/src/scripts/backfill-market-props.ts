#!/usr/bin/env tsx
/**
 * Backfill raw_props into market_props table (last 3 days)
 * Handles deduplication via (bookmaker_key, external_prop_id)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function backfillMarketProps() {
  console.log('🔄 Backfilling raw_props → market_props (last 3 days)...\n');

  // Get date 3 days ago
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const startDate = threeDaysAgo.toISOString().split('T')[0];

  console.log(`Fetching raw_props from ${startDate} onwards...\n`);

  // Fetch ALL raw_props from last 3 days (no limit)
  let allProps: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: rawProps, error } = await supabase
      .from('raw_props')
      .select('*')
      .gte('game_date', startDate)
      .order('game_date', { ascending: true })
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('❌ Error fetching raw_props:', error.message);
      return;
    }

    if (!rawProps || rawProps.length === 0) {
      hasMore = false;
    } else {
      allProps = allProps.concat(rawProps);
      page++;
      if (rawProps.length < pageSize) {
        hasMore = false;
      }
    }
  }

  const rawProps = allProps;

  console.log(`Found ${rawProps?.length || 0} raw props to backfill\n`);

  if (!rawProps || rawProps.length === 0) {
    console.log('No props to backfill');
    return;
  }

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const prop of rawProps) {
    const metadata = prop.metadata || {};

    // Build market_prop record
    const marketProp = {
      sport: metadata.sport || prop.sport || 'NFL',
      market: metadata.market || metadata.market_type || 'player_prop',
      selection: prop.selection || metadata.selection,
      line: prop.line,
      odds: prop.odds,
      over_odds: prop.over_odds,
      under_odds: prop.under_odds,
      bookmaker_key: metadata.bookmaker_key || metadata.bookmaker || 'unknown',
      best_book: metadata.best_book,
      best_available_line: metadata.best_available_line,
      game_date: prop.game_date,
      game_time: prop.game_time,
      player_name: metadata.player_name || prop.player_name,
      team: metadata.team,
      opponent: metadata.opponent,
      external_prop_id: prop.external_prop_id || `raw_${prop.id}`,
      external_game_id: prop.external_game_id,
      game_id: prop.game_id,
      metadata: prop.metadata,
    };

    // Try to INSERT (handle duplicates silently)
    const { error: insertError } = await supabase
      .from('market_props')
      .insert(marketProp);

    if (insertError) {
      if (insertError.message.includes('duplicate key') || insertError.code === '23505') {
        skipped++;
      } else {
        if (errors < 10) { // Only log first 10 errors
          console.error(`  ❌ Error inserting prop ${prop.id}:`, insertError.message);
        }
        errors++;
      }
    } else {
      inserted++;
    }
  }

  console.log('\n='.repeat(70));
  console.log(`✅ Backfill complete!`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped (duplicates): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log('='.repeat(70));

  // Verify
  const { count } = await supabase
    .from('market_props')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', startDate);

  console.log(`\nTotal market_props from ${startDate}: ${count}\n`);

  // Sample
  const { data: sample } = await supabase
    .from('market_props')
    .select('sport, market, player_name, line, odds, game_date')
    .gte('game_date', startDate)
    .order('game_date', { ascending: false })
    .limit(5);

  console.log('Sample market_props:');
  console.log('-'.repeat(70));
  sample?.forEach((row: any) => {
    console.log(`${row.sport} | ${row.market} | ${row.player_name} | ${row.line} | ${row.odds} | ${row.game_date}`);
  });
  console.log('');
}

backfillMarketProps().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
