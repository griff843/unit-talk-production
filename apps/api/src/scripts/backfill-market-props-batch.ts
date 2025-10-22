#!/usr/bin/env tsx
/**
 * Backfill market_props in batches to avoid timeout
 * Date: 2025-10-20
 * Uses Supabase client with small batches
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function backfillBatch(offset: number, limit: number): Promise<number> {
  // Fetch batch of raw_props
  const { data: rawProps, error: fetchError } = await supabase
    .from('raw_props')
    .select('*')
    .gte('game_date', new Date().toISOString().split('T')[0])
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (fetchError) {
    console.error(`Error fetching batch: ${fetchError.message}`);
    return 0;
  }

  if (!rawProps || rawProps.length === 0) {
    return 0;
  }

  let inserted = 0;
  let skipped = 0;

  // Insert each prop individually to handle conflicts
  for (const prop of rawProps) {
    const metadata = prop.metadata || {};

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

    const { error: insertError } = await supabase
      .from('market_props')
      .insert(marketProp);

    if (insertError) {
      if (insertError.code === '23505' || insertError.message.includes('duplicate')) {
        skipped++;
      } else {
        console.error(`Error inserting: ${insertError.message}`);
      }
    } else {
      inserted++;
    }
  }

  console.log(`  Batch ${offset}-${offset + limit}: inserted ${inserted}, skipped ${skipped}`);
  return rawProps.length;
}

async function backfillAll() {
  console.log('🔄 Backfilling market_props in batches...\n');

  const batchSize = 100;
  let offset = 0;
  let totalInserted = 0;
  let totalProcessed = 0;

  while (true) {
    console.log(`Processing batch starting at offset ${offset}...`);
    const processed = await backfillBatch(offset, batchSize);
    
    if (processed === 0) {
      break;
    }

    totalProcessed += processed;
    offset += batchSize;

    // Stop after 2000 props to avoid timeout (can run multiple times)
    if (totalProcessed >= 2000) {
      console.log(`\n⚠️  Processed ${totalProcessed} props. Run again to continue.\n`);
      break;
    }
  }

  // Verify
  const { count } = await supabase
    .from('market_props')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', new Date().toISOString().split('T')[0]);

  console.log(`\n✅ Total market_props today: ${count}\n`);

  if ((count || 0) < 1000) {
    console.log('⚠️  Less than 1000 props. Run this script again to continue backfill.\n');
    process.exit(1);
  }

  process.exit(0);
}

backfillAll().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

