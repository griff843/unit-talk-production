#!/usr/bin/env tsx
/**
 * Pipeline-Native MLB Ingestion Script
 *
 * PIPELINE FLOW:
 * 1. Fetch data from Odds API using existing oddsApi module
 * 2. Write to raw_props (NOT unified_picks)
 * 3. NormalizerAgent processes raw_props → unified_picks (30s interval)
 * 4. ScoringAgent processes unified_picks → scored_props (60s interval)
 * 5. AlertAgent monitors scored_props → alerts (120s interval)
 *
 * This script properly uses the new pipeline architecture instead of bypassing it.
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { createClient } from '@supabase/supabase-js';
import { logger } from '../shared/logger';
import { fetchOddsApiProps } from '../agents/FeedAgent/oddsApi';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RawProp {
  external_game_id: string;
  external_prop_id: string;
  sport: string;
  game_date: string;
  home_team: string;
  away_team: string;
  bookmaker_key: string;
  bookmaker_title: string;
  market_key: string;
  player_name?: string;
  stat_type?: string;
  line?: number;
  over_odds?: number;
  under_odds?: number;
  outcome_name: string;
  price: number;
  raw_data: any;
  ingested_at: string;
  created_at: string;
}

/**
 * Fetch MLB props from Odds API using existing integration
 */
async function fetchMLBProps(): Promise<any> {
  logger.info('🌐 Fetching MLB props from Odds API...');

  const sport = 'baseball_mlb';
  const markets = [
    'h2h',
    'spreads',
    'totals',
    'batter_home_runs',
    'batter_hits',
    'batter_total_bases',
    'batter_rbis',
    'batter_runs_scored',
    'batter_strikeouts',
    'pitcher_strikeouts',
    'pitcher_outs'
  ];

  // fetchOddsApiProps takes individual parameters, not an object
  const props = await fetchOddsApiProps(
    sport,
    markets,
    'us',        // regions
    'american',  // oddsFormat
    'iso',       // dateFormat
    1            // daysFrom
  );

  logger.info(`✅ Fetched ${props.length} MLB props`);

  return { props };
}

/**
 * Transform oddsApi result to raw_props format
 */
function transformToRawProps(oddsApiResult: any): RawProp[] {
  const rawProps: RawProp[] = [];
  const now = new Date().toISOString();

  // Transform props to raw_props format
  for (const prop of oddsApiResult.props || []) {
    rawProps.push({
      external_game_id: prop.game_id || prop.external_game_id || `game_${Date.now()}`,
      external_prop_id: prop.id || prop.external_prop_id || `prop_${Date.now()}_${Math.random()}`,
      sport: prop.sport || 'baseball_mlb',
      game_date: prop.game_date || prop.commence_time || new Date().toISOString(),
      home_team: prop.home_team || '',
      away_team: prop.away_team || '',
      bookmaker_key: prop.bookmaker || prop.bookmaker_key || 'unknown',
      bookmaker_title: prop.bookmaker_title || prop.bookmaker || 'Unknown',
      market_key: prop.market || prop.market_key || 'unknown',
      player_name: prop.player_name,
      stat_type: prop.stat_type,
      line: prop.line ? parseFloat(String(prop.line)) : undefined,
      over_odds: prop.over_odds ? parseInt(String(prop.over_odds)) : undefined,
      under_odds: prop.under_odds ? parseInt(String(prop.under_odds)) : undefined,
      outcome_name: prop.outcome || prop.selection || 'over',
      price: prop.price || prop.over_odds || 0,
      raw_data: prop,
      ingested_at: now,
      created_at: now
    });
  }

  return rawProps;
}

/**
 * Write raw props to database with proper timeout handling
 */
async function writeToRawProps(props: RawProp[]): Promise<{ inserted: number; errors: number }> {
  logger.info(`📝 Writing ${props.length} props to raw_props table...`);

  let inserted = 0;
  let errors = 0;

  // Process in batches of 250 (optimized batch size from timeout fix)
  const BATCH_SIZE = 250;

  for (let i = 0; i < props.length; i += BATCH_SIZE) {
    const batch = props.slice(i, i + BATCH_SIZE);

    try {
      const { data, error } = await supabase
        .from('raw_props')
        .upsert(batch, {
          onConflict: 'external_prop_id',
          ignoreDuplicates: false
        })
        .select('id');

      if (error) {
        logger.error('❌ Batch write failed', {
          error: error.message,
          batchStart: i,
          batchSize: batch.length
        });
        errors += batch.length;
      } else {
        const count = data?.length || 0;
        inserted += count;
        logger.info(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${count} props written`);
      }
    } catch (err) {
      logger.error('❌ Batch processing error', {
        error: err instanceof Error ? err.message : String(err),
        batchStart: i
      });
      errors += batch.length;
    }

    // Progress logging every 500 records
    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= props.length) {
      logger.info(`📊 Progress: ${Math.min(i + BATCH_SIZE, props.length)}/${props.length} props processed`);
    }
  }

  return { inserted, errors };
}

/**
 * Monitor pipeline processing (simplified - just check current state)
 */
async function monitorPipeline(): Promise<void> {
  logger.info('\n🔍 Checking pipeline state...\n');

  // Check raw_props
  const { data: rawProps, error: rpError } = await supabase
    .from('raw_props')
    .select('id')
    .gte('created_at', new Date(Date.now() - 300000).toISOString());

  if (!rpError) {
    logger.info(`✅ raw_props: ${rawProps?.length || 0} rows in last 5 min`);
  }

  // Check unified_picks
  const { data: unifiedPicks, error: upError } = await supabase
    .from('unified_picks')
    .select('id')
    .gte('created_at', new Date(Date.now() - 300000).toISOString());

  if (!upError) {
    logger.info(`✅ unified_picks: ${unifiedPicks?.length || 0} rows in last 5 min`);
  }

  // Check scored_props
  const { data: scoredProps, error: spError } = await supabase
    .from('scored_props')
    .select('id')
    .gte('created_at', new Date(Date.now() - 300000).toISOString());

  if (!spError) {
    logger.info(`✅ scored_props: ${scoredProps?.length || 0} rows in last 5 min`);
  }

  logger.info('\n💡 Note: Agents process data on 30-60s intervals. Data will flow through pipeline stages automatically.\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  PIPELINE-NATIVE MLB INGESTION');
  console.log('  Flow: Odds API → raw_props → NormalizerAgent → unified_picks');
  console.log('        → ScoringAgent → scored_props → AlertAgent');
  console.log('════════════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Fetch data from Odds API
    const startFetch = Date.now();
    const result = await fetchMLBProps();
    logger.info(`✅ Fetched data in ${Date.now() - startFetch}ms`);

    // Step 2: Transform to raw_props format
    const startTransform = Date.now();
    const rawProps = transformToRawProps(result);
    logger.info(`✅ Transformed to ${rawProps.length} raw props in ${Date.now() - startTransform}ms`);

    if (rawProps.length === 0) {
      logger.warn('⚠️  No props to ingest - may be no MLB games today');
      return;
    }

    // Step 3: Write to raw_props table (PIPELINE ENTRY POINT)
    const startWrite = Date.now();
    const writeResult = await writeToRawProps(rawProps);
    logger.info(`✅ Pipeline ingestion complete in ${Date.now() - startWrite}ms`, writeResult);

    // Step 4: Monitor pipeline processing
    await monitorPipeline();

    // Final summary
    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('  PIPELINE INGESTION SUMMARY');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`Props Fetched: ${result.props?.length || 0}`);
    console.log(`Raw Props Generated: ${rawProps.length}`);
    console.log(`Props Written to raw_props: ${writeResult.inserted}`);
    console.log(`Errors: ${writeResult.errors}`);
    console.log('\n✅ Data now flowing through pipeline:');
    console.log('   raw_props → NormalizerAgent → unified_picks → ScoringAgent → scored_props');
    console.log('════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    logger.error('❌ Pipeline ingestion failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main, fetchMLBProps, transformToRawProps, writeToRawProps, monitorPipeline };
