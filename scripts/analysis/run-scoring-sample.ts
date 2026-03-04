#!/usr/bin/env tsx
/**
 * Task 2: Score Sample Through Production Pipeline
 * Sprint: SPRINT-SCORING-PIPELINE-VALIDATION-019
 *
 * Fetches live SGO events for NBA/MLB/NHL, pairs over/under,
 * inserts into raw_props, and scores via ProfessionalPropProcessor.
 *
 * Target: 200+ props scored.
 *
 * Usage: npx tsx scripts/analysis/run-scoring-sample.ts
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';

import {
  fetchSGOEvents,
  flattenSGOEvents,
  pairOverUnderProps,
} from '../../apps/api/src/logic/providers/sgoFetcher';

import type { SGOPairedProp } from '../../apps/api/src/logic/providers/sgoFetcher';

// Env
const SUPABASE_URL = process.env['SUPABASE_URL'];
const SUPABASE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const SGO_API_KEY = process.env['SGO_API_KEY'];

if (!SUPABASE_URL || !SUPABASE_KEY || !SGO_API_KEY) {
  console.error('[FATAL] Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SGO_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const SPRINT_ID = 'SPRINT-SCORING-PIPELINE-VALIDATION-019';
const DATE_STR = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, `../../out/runtime/scoring_validation/${DATE_STR}`);
const TRACE_ID = crypto.randomUUID();
const TARGET_PROPS = 200;

async function fetchAndPairAll(): Promise<SGOPairedProp[]> {
  const now = new Date();
  const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const leagues = ['NBA', 'MLB', 'NHL'];
  const allPaired: SGOPairedProp[] = [];

  for (const league of leagues) {
    console.log(`Fetching ${league}...`);
    try {
      const events = await fetchSGOEvents({
        apiKey: SGO_API_KEY!,
        leagueID: league,
        startsAfter: now.toISOString(),
        startsBefore: threeDaysOut.toISOString(),
        includeOpposingOdds: true,
        oddsAvailable: true,
        limit: 20,
      });
      const flat = flattenSGOEvents(events);
      const paired = pairOverUnderProps(flat);
      console.log(
        `  ${league}: ${events.length} events → ${flat.length} flat → ${paired.length} paired`
      );
      allPaired.push(...paired);
    } catch (err: any) {
      console.error(`  ${league}: FAILED — ${err.message}`);
    }
  }

  return allPaired;
}

async function insertRawProps(paired: SGOPairedProp[]): Promise<string[]> {
  // Filter to valid player props
  const valid = paired.filter(
    p => p.playerName && p.line != null && (p.overOdds != null || p.underOdds != null) && p.statType
  );

  const selected = valid.slice(0, TARGET_PROPS);
  console.log(`\nInserting ${selected.length} props into raw_props (trace: ${TRACE_ID})...`);

  const rows = selected.map(p => ({
    id: crypto.randomUUID(),
    external_id: `val019_${p.eventID}_${p.statType}_${crypto.randomUUID().slice(0, 8)}`,
    sport: p.sportID === 'baseball' ? 'MLB' : p.sportID === 'hockey' ? 'NHL' : p.leagueID,
    league: p.leagueID,
    player_name: p.playerName,
    stat_type: p.statType,
    line: typeof p.line === 'string' ? parseFloat(p.line) : p.line,
    odds: p.overOdds ?? p.underOdds ?? 0,
    over_odds: p.overOdds,
    under_odds: p.underOdds,
    game_date: p.startsAtUTC ? p.startsAtUTC.slice(0, 10) : DATE_STR,
    source: 'sgo',
    provider: 'sportsgameodds',
    is_valid: true,
    team: p.homeTeam,
    opponent: p.awayTeam,
    home_team: p.homeTeam,
    away_team: p.awayTeam,
    matchup: `${p.awayTeam} @ ${p.homeTeam}`,
    direction: p.overOdds != null ? 'over' : 'under',
    market: p.statType,
    market_type: 'player_prop',
    event_id: p.eventID,
    event_time: p.startsAtUTC || null,
    game_time: p.startsAtUTC || null,
    scraped_at: new Date().toISOString(),
    meta: {
      trace_id: TRACE_ID,
      sprint: SPRINT_ID,
      devig_mode: p.devig_mode,
      over_market_key: p.overMarketKey,
      under_market_key: p.underMarketKey,
    },
    created_at: new Date().toISOString(),
    unique_key: `val019_${p.eventID}_${p.statType}_${p.playerName}_${p.line}_${TRACE_ID}`,
  }));

  const insertedIds: string[] = [];
  const batchSize = 25;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { data, error } = await supabase.from('raw_props').insert(batch).select('id');
    if (error) {
      console.error(`  Batch ${Math.floor(i / batchSize)} error: ${error.message}`);
    } else {
      insertedIds.push(...(data?.map((r: any) => r.id) || []));
    }
  }

  console.log(`  Inserted ${insertedIds.length} raw_props`);
  return insertedIds;
}

async function scoreViaProduction(): Promise<any[]> {
  console.log('\nScoring via ProfessionalPropProcessor...');

  const { ProfessionalPropProcessor } =
    await import('../../apps/api/src/services/ProfessionalPropProcessor');
  const processor = ProfessionalPropProcessor.getInstance();

  const results = await processor.processRawProps({
    max_batch_size: TARGET_PROPS + 50,
  });

  console.log(`  Scored ${results.length} props through production pipeline`);
  return results;
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('='.repeat(60));
  console.log(`${SPRINT_ID} — Scoring Sample`);
  console.log(`Trace ID: ${TRACE_ID}`);
  console.log('='.repeat(60));

  // Step 1: Fetch and pair
  const paired = await fetchAndPairAll();
  const pairedCount = paired.filter(p => p.devig_mode === 'PAIRED').length;
  const singleCount = paired.filter(p => p.devig_mode === 'FALLBACK_SINGLE_SIDED').length;
  console.log(
    `\nTotal paired props: ${paired.length} (${pairedCount} PAIRED, ${singleCount} SINGLE-SIDED)`
  );

  if (paired.length === 0) {
    console.error('No props fetched. Check SGO API key and market availability.');
    process.exit(1);
  }

  // Step 2: Insert into raw_props
  const insertedIds = await insertRawProps(paired);

  // Step 3: Score via production pipeline
  const results = await scoreViaProduction();

  // Summary
  const tierDist: Record<string, number> = {};
  const bandDist: Record<string, number> = {};
  const devigDist: Record<string, number> = {};

  for (const r of results) {
    tierDist[r.tier] = (tierDist[r.tier] || 0) + 1;
    bandDist[r.promotion_band] = (bandDist[r.promotion_band] || 0) + 1;
    devigDist[r.devig_mode] = (devigDist[r.devig_mode] || 0) + 1;
  }

  const summary = {
    sprint: SPRINT_ID,
    trace_id: TRACE_ID,
    timestamp: new Date().toISOString(),
    raw_props_inserted: insertedIds.length,
    props_scored: results.length,
    paired_count: pairedCount,
    single_sided_count: singleCount,
    tier_distribution: tierDist,
    band_distribution: bandDist,
    devig_mode_distribution: devigDist,
    avg_score:
      results.length > 0
        ? Math.round(
            (results.reduce((s: number, r: any) => s + r.professionalScore, 0) / results.length) *
              100
          ) / 100
        : 0,
  };

  fs.writeFileSync(
    path.join(OUT_DIR, 'scoring_sample_summary.json'),
    JSON.stringify(summary, null, 2)
  );

  console.log('\n=== Scoring Summary ===');
  console.log(`Props scored: ${results.length}`);
  console.log(`Tiers: ${JSON.stringify(tierDist)}`);
  console.log(`Bands: ${JSON.stringify(bandDist)}`);
  console.log(`Devig modes: ${JSON.stringify(devigDist)}`);
  console.log(`Avg score: ${summary.avg_score}`);
  console.log(`Trace ID: ${TRACE_ID}`);
  console.log(`Output: ${OUT_DIR}`);

  if (results.length < TARGET_PROPS) {
    console.warn(`\nWARNING: Only scored ${results.length} props (target ${TARGET_PROPS})`);
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
