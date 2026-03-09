#!/usr/bin/env tsx
/**
 * Shadow Scoring Runner
 * Sprint: SPRINT-022-V3-SHADOW-SCORING
 *
 * Runs ShadowScoringService against live provider_offers,
 * persists shadow results to unified_picks.meta.shadow_v3,
 * and writes proof artifacts.
 *
 * Usage:
 *   npx tsx scripts/analysis/run-shadow-scoring-022.ts
 *
 * Environment:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env)
 *   WINDOW_HOURS (optional, default: 48)
 *   MAX_MARKETS (optional, default: 200)
 *   DRY_RUN (optional, default: false — set "true" to skip DB writes)
 */

/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { ShadowScoringService } from '../../apps/api/src/services/ShadowScoringService';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env['SUPABASE_URL'];
const SUPABASE_KEY =
  process.env['SUPABASE_SERVICE_ROLE_KEY'] || process.env['SUPABASE_SERVICE_KEY'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[FATAL] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const WINDOW_HOURS = parseInt(process.env['WINDOW_HOURS'] || '48', 10);
const MAX_MARKETS = parseInt(process.env['MAX_MARKETS'] || '200', 10);
const DRY_RUN = process.env['DRY_RUN'] === 'true';

const SPRINT_ID = 'SPRINT-022-V3-SHADOW-SCORING';
const DATE_STR = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, `../../out/sprints/${SPRINT_ID}/${DATE_STR}`);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\n=== Shadow Scoring Runner — ${SPRINT_ID} ===`);
  console.log(`Window: ${WINDOW_HOURS}h | Max markets: ${MAX_MARKETS} | Dry run: ${DRY_RUN}`);

  const service = new ShadowScoringService(supabase);

  // Step 1: Run shadow scoring
  const result = await service.runShadowScoring({
    windowHours: WINDOW_HOURS,
    maxMarkets: MAX_MARKETS,
  });

  console.log(`\n--- Shadow Scoring Results ---`);
  console.log(`Total markets scanned: ${result.total_markets_scanned}`);
  console.log(`Eligible (>= 3 books): ${result.eligible_markets}`);
  console.log(`Successfully scored:   ${result.scored_markets}`);
  console.log(`Failed:                ${result.failed_markets}`);
  console.log(`Model version:         ${result.model_version}`);

  if (result.results.length === 0) {
    console.warn('\n[WARN] No markets scored. Check provider_offers data.');
    writeArtifacts(result, 0);
    process.exit(1);
  }

  // Step 2: Print sample results
  console.log(`\n--- Sample Shadow Scores (first 10) ---`);
  for (const r of result.results.slice(0, 10)) {
    console.log(
      `  ${r.market_key.slice(0, 50).padEnd(50)} ` +
        `books=${r.book_count} ` +
        `p_devig=${r.p_market_devig.toFixed(4)} ` +
        `p_final=${r.p_final.toFixed(4)} ` +
        `edge=${r.edge_final.toFixed(4)} ` +
        `tier=${r.tier_shadow} ` +
        `score=${r.score_shadow.toFixed(1)}`
    );
  }

  // Step 3: Persist shadow results to unified_picks.meta.shadow_v3
  let writeCount = 0;
  if (!DRY_RUN) {
    writeCount = await persistShadowResults(result.results);
    console.log(`\nPersisted ${writeCount} shadow scores to unified_picks.meta.shadow_v3`);
  } else {
    console.log('\n[DRY RUN] Skipping DB writes');
  }

  // Step 4: Write artifacts
  writeArtifacts(result, writeCount);

  // Step 5: Tier distribution
  const tierDist: Record<string, number> = {};
  for (const r of result.results) {
    tierDist[r.tier_shadow] = (tierDist[r.tier_shadow] || 0) + 1;
  }
  console.log(`\n--- Shadow Tier Distribution ---`);
  for (const [tier, count] of Object.entries(tierDist).sort()) {
    console.log(`  ${tier}: ${count}`);
  }

  // Step 6: Pass/fail
  const pass = result.scored_markets >= 20;
  console.log(`\n=== SHADOW SCORING GATE: ${pass ? 'PASS' : 'FAIL'} ===`);
  console.log(`  Scored ${result.scored_markets} markets (need >= 20)`);

  process.exit(pass ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Shadow write to unified_picks.meta.shadow_v3
// ---------------------------------------------------------------------------

async function persistShadowResults(
  results: Array<{
    event_id: string;
    market_type_id: number;
    participant_id: string | null;
    p_market_devig: number;
    p_final: number;
    edge_final: number;
    uncertainty_final: number;
    clv_forecast: number;
    tier_shadow: string;
    confidence_shadow: number;
    score_shadow: number;
    model_version_shadow: string;
    probability_model_version: string;
    book_count: number;
    providers: string[];
    scored_at: string;
  }>
): Promise<number> {
  let writeCount = 0;

  for (const result of results) {
    // Find matching unified_picks by event_id + market criteria
    let query = supabase
      .from('unified_picks')
      .select('id, meta')
      .eq('event_id', result.event_id)
      .limit(5);

    if (result.participant_id) {
      query = query.eq('participant_id', result.participant_id);
    }

    const { data: picks, error: fetchErr } = await query;
    if (fetchErr || !picks || picks.length === 0) continue;

    // Write shadow_v3 into meta for each matching pick
    for (const pick of picks) {
      const existingMeta = (pick.meta as Record<string, unknown>) ?? {};
      const shadowPayload = {
        ...existingMeta,
        shadow_v3: {
          p_market_devig: result.p_market_devig,
          p_final: result.p_final,
          edge_final: result.edge_final,
          uncertainty_final: result.uncertainty_final,
          clv_forecast: result.clv_forecast,
          tier_shadow: result.tier_shadow,
          confidence_shadow: result.confidence_shadow,
          score_shadow: result.score_shadow,
          model_version_shadow: result.model_version_shadow,
          probability_model_version: result.probability_model_version,
          book_count: result.book_count,
          providers: result.providers,
          scoring_source: 'provider_offers',
          scored_at: result.scored_at,
        },
        shadow_model_version: result.model_version_shadow,
        shadow_scoring_source: 'provider_offers',
      };

      const { error: updateErr } = await supabase
        .from('unified_picks')
        .update({ meta: shadowPayload })
        .eq('id', pick.id);

      if (!updateErr) writeCount++;
    }
  }

  return writeCount;
}

// ---------------------------------------------------------------------------
// Artifact writer
// ---------------------------------------------------------------------------

function writeArtifacts(
  result: import('../../apps/api/src/services/ShadowScoringService').ShadowScoringRunResult,
  writeCount: number
): void {
  fs.mkdirSync(path.join(OUT_DIR, 'proofs'), { recursive: true });

  fs.writeFileSync(
    path.join(OUT_DIR, 'SHADOW_SCORES_SAMPLE.json'),
    JSON.stringify(
      {
        sprint: SPRINT_ID,
        timestamp: new Date().toISOString(),
        summary: {
          total_markets_scanned: result.total_markets_scanned,
          eligible_markets: result.eligible_markets,
          scored_markets: result.scored_markets,
          failed_markets: result.failed_markets,
          persisted_to_meta: writeCount,
          model_version: result.model_version,
        },
        scores: result.results.slice(0, 50),
        errors: result.errors,
      },
      null,
      2
    )
  );

  console.log(`\nArtifacts written to: ${OUT_DIR}/`);
  console.log('  SHADOW_SCORES_SAMPLE.json');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
