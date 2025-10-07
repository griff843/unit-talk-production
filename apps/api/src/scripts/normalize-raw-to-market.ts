#!/usr/bin/env tsx
/**
 * Normalize raw_props to market_props (Real-time)
 *
 * Watches raw_props table for new entries and normalizes them to market_props
 * Runs continuously or as one-shot depending on mode
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface RawProp {
  id: string;
  sport: string;
  market: string;
  selection: string;
  line: number;
  odds: number;
  over_odds?: number;
  under_odds?: number;
  player_name: string;
  game_date: string;
  team?: string;
  opponent?: string;
  bookmaker_key?: string;
  external_prop_id?: string;
  metadata?: any;
  created_at: string;
}

let lastProcessedTime = new Date().toISOString();
let totalNormalized = 0;
let totalSkipped = 0;
let totalErrors = 0;

async function normalizeRawProps(oneShot = false) {
  console.log(`🔄 Normalizing raw_props → market_props (${oneShot ? 'ONE-SHOT' : 'CONTINUOUS'})...\n`);

  while (true) {
    try {
      // Fetch raw_props created since last check
      const { data: rawProps, error } = await supabase
        .from('raw_props')
        .select('*')
        .gte('created_at', lastProcessedTime)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        console.error('❌ Error fetching raw_props:', error.message);
        if (oneShot) break;
        await sleep(10000); // Wait 10s before retrying
        continue;
      }

      if (!rawProps || rawProps.length === 0) {
        if (oneShot) {
          console.log('✅ No new props to normalize');
          break;
        }
        // In continuous mode, wait and check again
        await sleep(5000); // Check every 5 seconds
        continue;
      }

      console.log(`📥 Found ${rawProps.length} new raw_props to normalize...`);

      for (const raw of rawProps as RawProp[]) {
        try {
          // Normalize to market_props format
          const marketProp = {
            sport: raw.sport,
            market: raw.market,
            selection: raw.selection,
            line: raw.line,
            odds: raw.odds,
            over_odds: raw.over_odds,
            under_odds: raw.under_odds,
            player_name: raw.player_name,
            game_date: raw.game_date,
            team: raw.team,
            opponent: raw.opponent,
            bookmaker_key: raw.bookmaker_key || 'unknown',
            external_prop_id: raw.external_prop_id || raw.id, // Use raw_prop id as fallback
            metadata: {
              ...raw.metadata,
              source: 'raw_props',
              raw_prop_id: raw.id,
              normalized_at: new Date().toISOString()
            }
          };

          // Insert into market_props (unique constraint will handle duplicates)
          const { error: insertError } = await supabase
            .from('market_props')
            .insert(marketProp);

          if (insertError) {
            if (insertError.code === '23505') {
              // Duplicate - skip silently
              totalSkipped++;
            } else {
              console.error(`  ❌ Error normalizing ${raw.id}:`, insertError.message);
              totalErrors++;
            }
          } else {
            totalNormalized++;
            if (totalNormalized % 10 === 0) {
              console.log(`  ✅ Normalized: ${totalNormalized} | Skipped: ${totalSkipped} | Errors: ${totalErrors}`);
            }
          }

          // Update last processed time
          lastProcessedTime = raw.created_at;
        } catch (err) {
          totalErrors++;
          console.error(`  ❌ Error processing ${raw.id}:`, err instanceof Error ? err.message : 'Unknown');
        }
      }

      console.log(`\n📊 Batch complete: ${totalNormalized} normalized, ${totalSkipped} skipped, ${totalErrors} errors\n`);

      if (oneShot) break;

      // In continuous mode, wait a bit before next check
      await sleep(5000);
    } catch (err) {
      console.error('❌ Fatal error in normalization loop:', err);
      if (oneShot) break;
      await sleep(10000);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`✅ Normalization complete!`);
  console.log(`  Normalized: ${totalNormalized}`);
  console.log(`  Skipped (duplicates): ${totalSkipped}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log('='.repeat(70));
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Parse command line args
const args = process.argv.slice(2);
const oneShot = args.includes('--one-shot') || args.includes('-1');
const continuous = args.includes('--continuous') || args.includes('-c');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: npx tsx src/scripts/normalize-raw-to-market.ts [options]

Options:
  --one-shot, -1      Run once and exit
  --continuous, -c    Run continuously (default)
  --help, -h          Show this help message

Examples:
  npx tsx src/scripts/normalize-raw-to-market.ts --one-shot
  npx tsx src/scripts/normalize-raw-to-market.ts --continuous
  `);
  process.exit(0);
}

normalizeRawProps(oneShot).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
