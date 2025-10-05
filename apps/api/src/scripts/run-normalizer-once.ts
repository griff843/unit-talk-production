/**
 * Run Normalizer Once - Batch Normalize raw_props → unified_picks
 *
 * Usage: npx tsx apps/api/src/scripts/run-normalizer-once.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RawProp {
  id: string;
  external_prop_id: string | null;
  external_game_id: string | null;
  sport: string;
  market: string | null;
  player_name: string | null;
  line: number | null;
  odds: number | null;
  over_odds: number | null;
  under_odds: number | null;
  outcome: string | null;
  game_date: string;
  bookmaker_key: string | null;
  metadata: any;
  created_at: string;
}

async function normalizeBatch(limit = 2000) {
  console.log(`\n🔄 Normalizing raw_props → unified_picks (limit: ${limit})\n`);

  const startTime = Date.now();
  let processed = 0;
  let inserted = 0;
  let errors = 0;

  // Get raw props that haven't been promoted
  const { data: rawProps, error: fetchError } = await supabase
    .from('raw_props')
    .select('id, external_prop_id, external_game_id, sport, market, player_name, line, odds, over_odds, under_odds, outcome, game_date, bookmaker_key, metadata, created_at')
    .gte('game_date', new Date().toISOString().split('T')[0])
    .eq('is_valid', true)
    .eq('promoted_to_picks', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fetchError) {
    console.error('❌ Failed to fetch raw_props:', fetchError.message);
    return;
  }

  if (!rawProps || rawProps.length === 0) {
    console.log('✅ No raw props to normalize');
    return;
  }

  console.log(`📊 Found ${rawProps.length} raw props to normalize`);

  // Process in chunks
  const CHUNK_SIZE = 250;
  for (let i = 0; i < rawProps.length; i += CHUNK_SIZE) {
    const chunk = rawProps.slice(i, i + CHUNK_SIZE);

    try {
      // Map to unified_picks format
      const unifiedPicks = chunk.map((rp: RawProp) => {
        // Determine selection/side
        let selection = rp.outcome || 'over'; // default to over

        // Determine odds
        let odds = rp.odds;
        if (!odds) {
          if (selection?.toLowerCase().includes('over') && rp.over_odds) {
            odds = rp.over_odds;
          } else if (selection?.toLowerCase().includes('under') && rp.under_odds) {
            odds = rp.under_odds;
          } else if (rp.over_odds) {
            odds = rp.over_odds;
          }
        }

        return {
          external_prop_id: rp.external_prop_id || `${rp.id}`,
          external_game_id: rp.external_game_id,
          sport: rp.sport,
          market: rp.market || 'unknown',
          selection: selection,
          line: rp.line,
          odds: odds,
          player_name: rp.player_name,
          game_date: rp.game_date,
          bookmaker_key: rp.bookmaker_key || 'unknown',
          status: 'pending',
          workflow_stage: 'normalized',
          source: 'normalizer-batch',
          metadata: {
            raw_prop_id: rp.id,
            normalized_at: new Date().toISOString(),
            ...(rp.metadata || {})
          }
        };
      });

      // Upsert to unified_picks
      const { data, error } = await supabase
        .from('unified_picks')
        .upsert(unifiedPicks, {
          onConflict: 'sport,market,player_name,game_date,bookmaker_key,line,selection',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`❌ Chunk ${i / CHUNK_SIZE + 1} failed:`, error.message);
        errors += chunk.length;
      } else {
        inserted += chunk.length;
        console.log(`✅ Chunk ${i / CHUNK_SIZE + 1}: ${chunk.length} rows upserted`);

        // Mark raw_props as promoted
        const rawPropIds = chunk.map(rp => rp.id);
        await supabase
          .from('raw_props')
          .update({ promoted_to_picks: true, processed_at: new Date().toISOString() })
          .in('id', rawPropIds);
      }

      processed += chunk.length;

    } catch (err: any) {
      console.error(`❌ Error processing chunk:`, err.message);
      errors += chunk.length;
    }
  }

  const duration = Date.now() - startTime;

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  NORMALIZER BATCH SUMMARY');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Processed: ${processed}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Errors: ${errors}`);
  console.log(`Duration: ${duration}ms`);
  console.log(`Rate: ${Math.round(processed / (duration / 1000))} props/sec`);
  console.log('════════════════════════════════════════════════════════════════\n');
}

normalizeBatch(2000)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
