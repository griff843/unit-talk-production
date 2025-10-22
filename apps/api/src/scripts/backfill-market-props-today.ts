#!/usr/bin/env ts-node
/**
 * Backfill today's raw_props into market_props (lighter query to avoid timeouts)
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function isoDate(d: Date) { return d.toISOString().split('T')[0]; }

async function main() {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24*60*60*1000);
  const start = isoDate(today);
  const end = isoDate(tomorrow);

  console.log(`Backfilling market_props for date: ${start}`);

  let inserted = 0, skipped = 0, errors = 0;
  const pageSize = 500;
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data: rawProps, error } = await supabase
      .from('raw_props')
      .select('*')
      .gte('game_date', start)
      .lt('game_date', end)
      .range(from, to);

    if (error) {
      console.error('Error fetching raw_props:', error.message);
      break;
    }

    if (!rawProps || rawProps.length === 0) break;

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

      const { error: insertError } = await supabase.from('market_props').insert(marketProp);
      if (insertError) {
        if (insertError.message?.includes('duplicate key') || insertError.code === '23505') {
          skipped++;
        } else {
          if (errors < 10) console.error(`  insert error for raw ${prop.id}:`, insertError.message);
          errors++;
        }
      } else {
        inserted++;
      }
    }

    if (rawProps.length < pageSize) break;
    page++;
  }

  console.log(`Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors}`);
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });

