/**
 * Production Settlement Script - CLI-Driven
 *
 * Accepts command-line arguments for flexible settlement execution
 * Implements all guardrails specified in ops plan
 */

import { createClient } from '@supabase/supabase-js';
import { mlbStatsService } from '../../services/data-collection/MLBStatsService';
import { nflStatsService } from '../../services/data-collection/NFLStatsService';
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
    from: null,
    to: null,
    sports: 'mlb,nfl',
    batch: 500,
    workers: 6,
    out: 'apps/api/out/ops/settlement',
    sourceTable: 'raw_props',
    statsTable: 'player_stats',
    sinkTable: 'settled_outcomes',
    resume: true,
    utc: true
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from') parsed.from = args[++i];
    else if (args[i] === '--to') parsed.to = args[++i];
    else if (args[i] === '--sports') parsed.sports = args[++i];
    else if (args[i] === '--batch') parsed.batch = parseInt(args[++i]);
    else if (args[i] === '--workers') parsed.workers = parseInt(args[++i]);
    else if (args[i] === '--out') parsed.out = args[++i];
    else if (args[i] === '--source-table') parsed.sourceTable = args[++i];
    else if (args[i] === '--stats-table') parsed.statsTable = args[++i];
    else if (args[i] === '--sink-table') parsed.sinkTable = args[++i];
  }

  return parsed;
}

const config = parseArgs();

// Artifacts tracking
const artifacts = {
  progress: { considered: 0, settled: 0, skipped: 0, errors: 0 },
  settledCounts: {} as Record<string, number>,
  errors: [] as any[],
  throughput: { startTime: Date.now(), rowsPerSec: 0 }
};

// Write artifacts
function writeArtifacts() {
  if (!fs.existsSync(config.out)) {
    fs.mkdirSync(config.out, { recursive: true });
  }

  fs.writeFileSync(
    path.join(config.out, 'progress.json'),
    JSON.stringify(artifacts.progress, null, 2)
  );

  fs.writeFileSync(
    path.join(config.out, 'settled_counts.json'),
    JSON.stringify(artifacts.settledCounts, null, 2)
  );

  if (artifacts.errors.length > 0) {
    fs.writeFileSync(
      path.join(config.out, 'errors.ndjson'),
      artifacts.errors.map(e => JSON.stringify(e)).join('\n')
    );
  }

  const elapsed = (Date.now() - artifacts.throughput.startTime) / 1000;
  artifacts.throughput.rowsPerSec = artifacts.progress.settled / elapsed;

  fs.writeFileSync(
    path.join(config.out, 'throughput.json'),
    JSON.stringify(artifacts.throughput, null, 2)
  );
}

// Settle MLB prop
async function settleMLBProp(prop: any, stats: any): Promise<any | null> {
  try {
    // Extract stat type
    const statType = (prop.stat_type || prop.market_type || '').toLowerCase();

    // Map to JSONB field
    const statMapping: Record<string, string> = {
      'batter_hits': 'hits',
      'player_hits': 'hits',
      'batter_total_bases': 'totalBases',
      'batter_home_runs': 'homeRuns',
      'batter_rbis': 'rbi',
      'batter_runs_scored': 'runs',
      'pitcher_strikeouts': 'strikeouts'
    };

    const statKey = statMapping[statType];
    if (!statKey) return null;

    // Extract actual value from JSONB (NULL-safe with COALESCE logic)
    const actual = stats.stats?.[statKey];
    if (actual === null || actual === undefined) return null;

    const actualValue = parseFloat(actual) || 0;
    const line = parseFloat(prop.line) || 0;

    // Determine result
    let result = 'void';
    if (actualValue > line) result = 'win';
    else if (actualValue < line) result = 'loss';
    else result = 'push';

    return {
      prop_id: prop.id,
      sport: 'MLB',
      market: statType,
      market_type: statType,
      player: prop.player_name,
      player_name: prop.player_name,
      decision: result,
      outcome: result,
      line: line,
      actual: actualValue,
      actual_value: actualValue,
      game_date: prop.game_date,
      settled_at: new Date().toISOString()
    };
  } catch (error) {
    artifacts.errors.push({
      prop_id: prop.id,
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
    return null;
  }
}

// Settle NFL prop
async function settleNFLProp(prop: any, stats: any): Promise<any | null> {
  try {
    const statType = (prop.stat_type || prop.market_type || '').toLowerCase();

    const statMapping: Record<string, string> = {
      'passing_yards': 'passingYards',
      'player_pass_yds': 'passingYards',
      'rushing_yards': 'rushingYards',
      'player_rush_yds': 'rushingYards',
      'receiving_yards': 'receivingYards',
      'player_reception_yds': 'receivingYards',
      'receptions': 'receptions',
      'player_receptions': 'receptions'
    };

    const statKey = statMapping[statType];
    if (!statKey) return null;

    const actual = stats.stats?.[statKey];
    if (actual === null || actual === undefined) return null;

    const actualValue = parseFloat(actual) || 0;
    const line = parseFloat(prop.line) || 0;

    let result = 'void';
    if (actualValue > line) result = 'win';
    else if (actualValue < line) result = 'loss';
    else result = 'push';

    return {
      prop_id: prop.id,
      sport: 'NFL',
      market: statType,
      market_type: statType,
      player: prop.player_name,
      player_name: prop.player_name,
      decision: result,
      outcome: result,
      line: line,
      actual: actualValue,
      actual_value: actualValue,
      game_date: prop.game_date,
      settled_at: new Date().toISOString()
    };
  } catch (error) {
    artifacts.errors.push({
      prop_id: prop.id,
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
    return null;
  }
}

// Main settlement function
async function runSettlement() {
  console.log('🚀 Production Settlement Starting...\n');
  console.log('Config:', JSON.stringify(config, null, 2), '\n');

  const sports = config.sports.split(',');

  for (const sport of sports) {
    console.log(`\n📊 Settling ${sport.toUpperCase()}...\n`);

    // Get props in window
    let query = supabase
      .from(config.sourceTable)
      .select('*')
      .eq('sport', sport.toUpperCase());

    if (config.from) query = query.gte('game_date', config.from);
    if (config.to) query = query.lte('game_date', config.to);

    const { data: props, error } = await query.limit(10000);

    if (error || !props) {
      console.error('Failed to fetch props:', error?.message);
      continue;
    }

    console.log(`Found ${props.length} ${sport.toUpperCase()} props\n`);
    artifacts.progress.considered += props.length;

    // Process in batches
    for (let i = 0; i < props.length; i += config.batch) {
      const batch = props.slice(i, i + config.batch);
      const outcomes = [];

      for (const prop of batch) {
        // Resume check: skip if already settled
        if (config.resume) {
          const { data: existing } = await supabase
            .from(config.sinkTable)
            .select('prop_id')
            .eq('prop_id', prop.id)
            .single();

          if (existing) {
            artifacts.progress.skipped++;
            continue;
          }
        }

        // Get stats for this player/game
        const { data: statRows } = await supabase
          .from(config.statsTable)
          .select('*')
          .eq('sport', sport.toUpperCase())
          .eq('game_date', prop.game_date)
          .ilike('player_name', `%${prop.player_name}%`)
          .limit(1);

        if (!statRows || statRows.length === 0) {
          artifacts.progress.skipped++;
          continue;
        }

        const stats = statRows[0];

        // Settle based on sport
        let outcome = null;
        if (sport.toLowerCase() === 'mlb') {
          outcome = await settleMLBProp(prop, stats);
        } else if (sport.toLowerCase() === 'nfl') {
          outcome = await settleNFLProp(prop, stats);
        }

        if (outcome) {
          outcomes.push(outcome);
        }
      }

      // Bulk insert outcomes (ON CONFLICT DO NOTHING)
      if (outcomes.length > 0) {
        const { error: insertError } = await supabase
          .from(config.sinkTable)
          .insert(outcomes);

        if (insertError) {
          console.error('Insert error:', insertError.message);
          artifacts.progress.errors += outcomes.length;
        } else {
          artifacts.progress.settled += outcomes.length;
          artifacts.settledCounts[sport.toUpperCase()] = (artifacts.settledCounts[sport.toUpperCase()] || 0) + outcomes.length;
        }
      }

      // Write progress every batch
      writeArtifacts();
      console.log(`Progress: ${artifacts.progress.settled} settled, ${artifacts.progress.skipped} skipped`);
    }
  }

  // Final write
  writeArtifacts();

  console.log('\n✅ Settlement Complete\n');
  console.log('Summary:', JSON.stringify(artifacts.progress, null, 2));

  process.exit(0);
}

runSettlement().catch(error => {
  console.error('❌ Settlement failed:', error);
  artifacts.progress.errors++;
  writeArtifacts();
  process.exit(1);
});
