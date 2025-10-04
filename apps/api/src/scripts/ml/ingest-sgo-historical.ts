/**
 * SGO Historical Data Ingestion - TIER 1 VALIDATION
 *
 * Ingests historical data from SGO to populate:
 * 1. player_stats table (for ML probability calculations)
 * 2. settled_outcomes table (for backtest validation)
 * 3. raw_props table (for historical context)
 *
 * Target: 75,000+ settled outcomes across MLB, NFL, NBA
 */

import { createClient } from '@supabase/supabase-js';
import { SGOAdapter } from '../../providers/SGOAdapter';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Parse CLI args
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: any = {
    apiKey: process.env.SGO_API_KEY || '',
    sports: 'mlb,nfl',
    startDate: null,
    endDate: null,
    batchSize: 1000,
    out: 'apps/api/out/ops/sgo-ingestion',
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--api-key') parsed.apiKey = args[++i];
    else if (args[i] === '--sports') parsed.sports = args[++i];
    else if (args[i] === '--start-date') parsed.startDate = args[++i];
    else if (args[i] === '--end-date') parsed.endDate = args[++i];
    else if (args[i] === '--batch') parsed.batchSize = parseInt(args[++i]);
    else if (args[i] === '--out') parsed.out = args[++i];
  }

  if (!parsed.apiKey) {
    console.error('❌ SGO API key required! Set SGO_API_KEY env var or use --api-key flag');
    process.exit(1);
  }

  return parsed;
}

const config = parseArgs();

// Progress tracking
const artifacts = {
  playerStats: { inserted: 0, skipped: 0, errors: 0 },
  outcomes: { inserted: 0, skipped: 0, errors: 0 },
  props: { inserted: 0, skipped: 0, errors: 0 },
  errors: [] as any[],
  throughput: { startTime: Date.now(), rowsPerSec: 0 },
};

function writeArtifacts() {
  if (!fs.existsSync(config.out)) {
    fs.mkdirSync(config.out, { recursive: true });
  }

  fs.writeFileSync(
    path.join(config.out, 'player_stats.json'),
    JSON.stringify(artifacts.playerStats, null, 2)
  );

  fs.writeFileSync(
    path.join(config.out, 'outcomes.json'),
    JSON.stringify(artifacts.outcomes, null, 2)
  );

  fs.writeFileSync(
    path.join(config.out, 'props.json'),
    JSON.stringify(artifacts.props, null, 2)
  );

  if (artifacts.errors.length > 0) {
    fs.writeFileSync(
      path.join(config.out, 'errors.ndjson'),
      artifacts.errors.map((e) => JSON.stringify(e)).join('\n')
    );
  }

  const elapsed = (Date.now() - artifacts.throughput.startTime) / 1000;
  const totalRows = artifacts.playerStats.inserted + artifacts.outcomes.inserted + artifacts.props.inserted;
  artifacts.throughput.rowsPerSec = totalRows / elapsed;

  fs.writeFileSync(
    path.join(config.out, 'throughput.json'),
    JSON.stringify(artifacts.throughput, null, 2)
  );
}

/**
 * Ingest player stats from SGO
 */
async function ingestPlayerStats(sgo: SGOAdapter, sport: string, startDate: string, endDate: string) {
  console.log(`\n📊 Ingesting ${sport} Player Stats from SGO...\n`);

  try {
    const stats = await sgo.fetchPlayerStats({
      sport,
      startDate,
      endDate,
      limit: 10000,
    });

    console.log(`Found ${stats.length} player stats records\n`);

    // Batch insert
    for (let i = 0; i < stats.length; i += config.batchSize) {
      const batch = stats.slice(i, i + config.batchSize);

      const rows = batch.map((s) => ({
        sport: s.sport,
        player_name: s.playerName,
        game_date: s.gameDate.toISOString().split('T')[0],
        stats: s.stats, // JSONB with all stats
        source: 'sgo',
        metadata: s.metadata,
      }));

      const { error } = await supabase.from('player_stats').upsert(rows, {
        onConflict: 'sport,player_name,game_date',
      });

      if (error) {
        console.error('Player stats insert error:', error.message);
        artifacts.playerStats.errors += batch.length;
        artifacts.errors.push({
          type: 'player_stats_insert',
          message: error.message,
          batch_size: batch.length,
          timestamp: new Date().toISOString(),
        });
      } else {
        artifacts.playerStats.inserted += batch.length;
      }

      const pct = ((i / stats.length) * 100).toFixed(1);
      console.log(`Progress: ${artifacts.playerStats.inserted} inserted (${pct}%)`);
    }

    console.log(`✅ Player stats ingestion complete for ${sport}`);
  } catch (error: any) {
    console.error(`Failed to ingest player stats for ${sport}:`, error.message);
    artifacts.errors.push({
      type: 'player_stats_fetch',
      sport,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Ingest settled outcomes from SGO
 *
 * THIS IS THE GOLDMINE - 75,000+ historical outcomes for backtest
 */
async function ingestOutcomes(sgo: SGOAdapter, sport: string, startDate: string, endDate: string) {
  console.log(`\n🎯 Ingesting ${sport} Settled Outcomes from SGO...\n`);

  try {
    const outcomes = await sgo.fetchOutcomes({
      sport,
      startDate,
      endDate,
      limit: 50000, // Get as many as possible
    });

    console.log(`Found ${outcomes.length} settled outcomes\n`);

    // Batch insert
    for (let i = 0; i < outcomes.length; i += config.batchSize) {
      const batch = outcomes.slice(i, i + config.batchSize);

      const rows = batch.map((o) => ({
        prop_id: o.propId,
        sport: sport.toUpperCase(),
        market_type: o.marketType,
        player_name: o.playerName,
        line: o.line,
        actual_value: o.actualValue,
        actual: o.actualValue,
        outcome: o.outcome,
        decision: o.outcome,
        settled_at: o.settledAt.toISOString(),
        source: 'sgo',
        settlement_method: 'sgo_historical',
        confidence: 1.0,
        metadata: o.metadata,
      }));

      const { error } = await supabase.from('settled_outcomes').insert(rows);

      if (error) {
        console.error('Outcomes insert error:', error.message);
        artifacts.outcomes.errors += batch.length;
        artifacts.errors.push({
          type: 'outcomes_insert',
          message: error.message,
          batch_size: batch.length,
          timestamp: new Date().toISOString(),
        });
      } else {
        artifacts.outcomes.inserted += batch.length;
      }

      const pct = ((i / outcomes.length) * 100).toFixed(1);
      console.log(`Progress: ${artifacts.outcomes.inserted} inserted (${pct}%)`);
    }

    console.log(`✅ Outcomes ingestion complete for ${sport}`);
  } catch (error: any) {
    console.error(`Failed to ingest outcomes for ${sport}:`, error.message);
    artifacts.errors.push({
      type: 'outcomes_fetch',
      sport,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Ingest historical props from SGO (optional - for context)
 */
async function ingestProps(sgo: SGOAdapter, sport: string, startDate: string, endDate: string) {
  console.log(`\n📋 Ingesting ${sport} Historical Props from SGO...\n`);

  try {
    const props = await sgo.fetchProps({
      sport,
      startDate,
      endDate,
      limit: 10000,
    });

    console.log(`Found ${props.length} props\n`);

    // Batch insert
    for (let i = 0; i < props.length; i += config.batchSize) {
      const batch = props.slice(i, i + config.batchSize);

      const rows = batch.map((p) => ({
        sport: p.sport,
        player_name: p.playerName,
        market_type: p.marketType,
        stat_type: p.marketType,
        line: p.line,
        odds: p.odds,
        game_date: p.gameDate.toISOString().split('T')[0],
        book: p.bookmaker,
        source: 'sgo',
        metadata: p.metadata,
      }));

      const { error } = await supabase.from('raw_props').insert(rows);

      if (error) {
        // Skip on conflict (props may already exist)
        if (!error.message.includes('duplicate')) {
          console.error('Props insert error:', error.message);
          artifacts.props.errors += batch.length;
        } else {
          artifacts.props.skipped += batch.length;
        }
      } else {
        artifacts.props.inserted += batch.length;
      }

      const pct = ((i / props.length) * 100).toFixed(1);
      console.log(`Progress: ${artifacts.props.inserted} inserted, ${artifacts.props.skipped} skipped (${pct}%)`);
    }

    console.log(`✅ Props ingestion complete for ${sport}`);
  } catch (error: any) {
    console.error(`Failed to ingest props for ${sport}:`, error.message);
    artifacts.errors.push({
      type: 'props_fetch',
      sport,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Main ingestion workflow
 */
async function runIngestion() {
  console.log('🚀 SGO Historical Data Ingestion Starting...\n');
  console.log('Config:', JSON.stringify(config, null, 2), '\n');

  // Initialize SGO adapter
  const sgo = new SGOAdapter({
    apiKey: config.apiKey,
  });

  console.log(`✅ SGO Adapter initialized\n`);

  const sports = config.sports.split(',').map((s) => s.trim());

  // Set default date range if not provided (last 90 days)
  const endDate = config.endDate || new Date().toISOString().split('T')[0];
  const startDate =
    config.startDate ||
    new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  console.log(`Date range: ${startDate} to ${endDate}\n`);

  for (const sport of sports) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`  ${sport.toUpperCase()} Historical Data Ingestion`);
    console.log(`${'='.repeat(80)}\n`);

    // 1. Ingest player stats (for ML calculations)
    await ingestPlayerStats(sgo, sport, startDate, endDate);

    // 2. Ingest settled outcomes (for backtest validation)
    await ingestOutcomes(sgo, sport, startDate, endDate);

    // 3. Ingest props (optional - for context)
    await ingestProps(sgo, sport, startDate, endDate);

    writeArtifacts();
  }

  // Final summary
  console.log('\n' + '='.repeat(80));
  console.log('✅ SGO Historical Data Ingestion Complete\n');
  console.log('Summary:');
  console.log(`  Player Stats: ${artifacts.playerStats.inserted} inserted, ${artifacts.playerStats.errors} errors`);
  console.log(`  Outcomes: ${artifacts.outcomes.inserted} inserted, ${artifacts.outcomes.errors} errors`);
  console.log(`  Props: ${artifacts.props.inserted} inserted, ${artifacts.props.skipped} skipped, ${artifacts.props.errors} errors`);
  console.log('');

  const totalOutcomes = artifacts.outcomes.inserted;
  console.log(`📊 Total Historical Outcomes: ${totalOutcomes.toLocaleString()}`);

  if (totalOutcomes >= 1000) {
    console.log(`🎉 TIER 1 SAMPLE SIZE ACHIEVED: ${totalOutcomes.toLocaleString()} outcomes!\n`);
  } else {
    console.log(`⚠️  Need ${(1000 - totalOutcomes).toLocaleString()} more outcomes for Tier 1\n`);
  }

  writeArtifacts();
  process.exit(0);
}

runIngestion();
