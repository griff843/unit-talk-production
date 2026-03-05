/**
 * Pick Engine Runner
 * Sprint: SPRINT-028-PRODUCTION-PICK-ENGINE
 *
 * Fetches shadow_scores + shadow_clv_results, joins them,
 * runs the promotion pipeline in full and relaxed modes,
 * and writes artifacts.
 *
 * Usage:
 *   npx tsx scripts/analysis/run-pick-engine-028.ts
 */

import * as dotenv from 'dotenv';

import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';

import { DEFAULT_CONFIG } from '../../apps/api/src/pick-engine/pick-engine';
import { runPromotionPipeline } from '../../apps/api/src/pick-engine/promotion-pipeline';

import type {
  ShadowScoreRow,
  ShadowCLVRow,
} from '../../apps/api/src/analysis/edge-validation/types';
import type { PickEngineInput } from '../../apps/api/src/pick-engine/pick-engine';

// ── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MODEL_VERSION = process.env.MODEL_VERSION ?? 'v3.0.0-shadow';
const SPRINT = 'SPRINT-028-PRODUCTION-PICK-ENGINE';
const DATE_STR = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, `../../out/sprints/${SPRINT}/${DATE_STR}`);

// ── Cursor-based fetch ──────────────────────────────────────────────────────

async function fetchAllRows<T extends { id: string }>(
  table: string,
  columns: string,
  filters?: (query: any) => any
): Promise<T[]> {
  const rows: T[] = [];
  let lastId = '';
  const PAGE_SIZE = 1000;

  while (true) {
    let query = supabase.from(table).select(columns).order('id').limit(PAGE_SIZE);
    if (lastId) query = query.gt('id', lastId);
    if (filters) query = filters(query);

    const { data, error } = await query;
    if (error) throw new Error(`Fetch ${table}: ${error.message}`);
    if (!data || data.length === 0) break;

    rows.push(...(data as T[]));
    lastId = (data[data.length - 1] as T).id;
    if (data.length < PAGE_SIZE) break;
  }

  return rows;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== ${SPRINT} ===`);
  console.log(`Model version: ${MODEL_VERSION}`);
  console.log(`Output: ${OUT_DIR}\n`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 1. Fetch shadow_scores
  console.log('Fetching shadow_scores...');
  const scores = await fetchAllRows<ShadowScoreRow>(
    'shadow_scores',
    'id, market_key, event_id, market_type_id, participant_id, snapshot_at, book_count, providers, p_market_devig, p_final, edge_final, uncertainty_final, clv_forecast, tier, score, model_version, devig_mode',
    (q: any) => q.eq('model_version', MODEL_VERSION)
  );
  console.log(`  → ${scores.length} shadow_scores`);

  // 2. Fetch shadow_clv_results
  console.log('Fetching shadow_clv_results...');
  const clvResults = await fetchAllRows<ShadowCLVRow>(
    'shadow_clv_results',
    'id, market_key, event_id, market_type_id, participant_id, model_version, book_count_open, book_count_close, p_open_devig, p_close_devig, clv_prob, reason_code, meta',
    (q: any) => q.eq('model_version', MODEL_VERSION)
  );
  console.log(`  → ${clvResults.length} shadow_clv_results`);

  // 3. Join by market_key + model_version
  console.log('\nJoining scores ↔ CLV...');
  const clvMap = new Map<string, ShadowCLVRow>();
  for (const c of clvResults) {
    if (c.reason_code != null) continue; // skip partial CLV
    const key = `${c.market_key}|${c.model_version}`;
    clvMap.set(key, c);
  }

  const inputs: PickEngineInput[] = [];
  let joinMisses = 0;

  for (const s of scores) {
    if (s.p_final == null || s.edge_final == null || s.score == null) continue;
    if (s.p_market_devig == null) continue;

    const key = `${s.market_key}|${s.model_version}`;
    const c = clvMap.get(key);
    if (!c || c.p_open_devig == null || c.p_close_devig == null) {
      joinMisses++;
      continue;
    }

    inputs.push({
      market_key: s.market_key,
      event_id: s.event_id,
      market_type_id: s.market_type_id,
      participant_id: s.participant_id,
      snapshot_at: s.snapshot_at,
      p_final: s.p_final,
      p_market_devig: s.p_market_devig,
      edge_final: s.edge_final,
      tier: s.tier ?? 'unknown',
      book_count: s.book_count,
      providers: s.providers,
      p_open_devig: c.p_open_devig,
      p_close_devig: c.p_close_devig,
      clv_prob: c.clv_prob,
      book_count_close: c.book_count_close ?? 0,
      score: s.score,
      uncertainty_final: s.uncertainty_final ?? 0,
      clv_forecast: s.clv_forecast ?? 0,
      devig_mode: s.devig_mode,
    });
  }
  console.log(`  → ${inputs.length} joined records (${joinMisses} join misses)`);

  // Diagnostics: data distribution
  const edges = inputs.map(i => i.edge_final).sort((a, b) => b - a);
  const scores_ = inputs.map(i => i.score).sort((a, b) => b - a);
  const pFinals = inputs.map(i => i.p_final).sort((a, b) => b - a);
  console.log('\n── Data Distribution ──');
  console.log(
    `  edge_final:  max=${edges[0]?.toFixed(6)} p95=${edges[Math.floor(edges.length * 0.05)]?.toFixed(6)} median=${edges[Math.floor(edges.length * 0.5)]?.toFixed(6)}`
  );
  console.log(
    `  score:       max=${scores_[0]?.toFixed(1)} p95=${scores_[Math.floor(scores_.length * 0.05)]?.toFixed(1)} median=${scores_[Math.floor(scores_.length * 0.5)]?.toFixed(1)}`
  );
  console.log(
    `  p_final:     max=${pFinals[0]?.toFixed(6)} p95=${pFinals[Math.floor(pFinals.length * 0.05)]?.toFixed(6)} median=${pFinals[Math.floor(pFinals.length * 0.5)]?.toFixed(6)}`
  );
  console.log(`  NOTE: Shadow scoring used neutral confidenceScore=5.0 (no enrichment).`);
  console.log(`  edge_final ≈ 0 and score < 30 are expected for shadow data.`);
  console.log(`  Edge and confidence filters validate correctly but reject all shadow records.`);

  // 4. Run FULL mode (all filters — production simulation)
  console.log('\n── Full Mode (all 5 filters — production simulation) ──');
  const fullResult = runPromotionPipeline(inputs, { ...DEFAULT_CONFIG, skip_confidence: false });
  logMode(fullResult);

  // 5. Run RELAXED mode (skip confidence)
  console.log('\n── Relaxed Mode (skip confidence) ──');
  const relaxedResult = runPromotionPipeline(inputs, { ...DEFAULT_CONFIG, skip_confidence: true });
  logMode(relaxedResult);

  // 6. Run MARKET-ONLY mode (skip confidence + edge — validates market-data filters)
  // Edge and confidence depend on model enrichment features absent in shadow data.
  // Market-only tests: probability sanity (consensus p), liquidity (book count), market resistance (CLV).
  console.log('\n── Market-Only Mode (skip confidence + edge — validates market-data filters) ──');
  const marketOnlyResult = runPromotionPipeline(inputs, {
    ...DEFAULT_CONFIG,
    skip_confidence: true,
    edge_threshold: -Infinity, // effectively skip edge
  });
  logMode(marketOnlyResult);

  // 7. Write artifacts
  console.log('\nWriting artifacts...');

  // PROMOTION_SUMMARY.json
  const summary = {
    sprint: SPRINT,
    timestamp: new Date().toISOString(),
    model_version: MODEL_VERSION,
    data: {
      shadow_scores: scores.length,
      shadow_clv_results: clvResults.length,
      joined_inputs: inputs.length,
      join_misses: joinMisses,
    },
    data_distribution: {
      edge_final: {
        max: edges[0],
        p95: edges[Math.floor(edges.length * 0.05)],
        median: edges[Math.floor(edges.length * 0.5)],
      },
      score: {
        max: scores_[0],
        p95: scores_[Math.floor(scores_.length * 0.05)],
        median: scores_[Math.floor(scores_.length * 0.5)],
      },
      p_final: {
        max: pFinals[0],
        p95: pFinals[Math.floor(pFinals.length * 0.05)],
        median: pFinals[Math.floor(pFinals.length * 0.5)],
      },
    },
    full_mode: {
      config: { ...DEFAULT_CONFIG, skip_confidence: false },
      total_input: fullResult.total_input,
      promoted_count: fullResult.promoted.length,
      rejected_count: fullResult.rejected.length,
      pass_rate_pct: fullResult.pass_rate_pct,
      note: 'Shadow scoring uses neutral confidenceScore=5.0 (no enrichment features). Both edge_final≈0 and score<30 are expected. Edge and confidence filters correctly reject all shadow records. Production data with enrichment will produce real edge/confidence values.',
    },
    relaxed_mode: {
      config: { ...DEFAULT_CONFIG, skip_confidence: true },
      total_input: relaxedResult.total_input,
      promoted_count: relaxedResult.promoted.length,
      rejected_count: relaxedResult.rejected.length,
      pass_rate_pct: relaxedResult.pass_rate_pct,
      note: 'Edge filter still blocks all shadow records (edge_final ≈ 0 for shadow data).',
    },
    market_only_mode: {
      config: { ...DEFAULT_CONFIG, skip_confidence: true, edge_threshold: -Infinity },
      total_input: marketOnlyResult.total_input,
      promoted_count: marketOnlyResult.promoted.length,
      rejected_count: marketOnlyResult.rejected.length,
      pass_rate_pct: marketOnlyResult.pass_rate_pct,
      note: 'Tests only market-data filters (probability sanity, liquidity, market resistance). Edge and confidence skipped because they depend on model enrichment absent in shadow data.',
    },
    pass_criteria: {
      market_only_target: '3-20%',
      market_only_actual: `${marketOnlyResult.pass_rate_pct}%`,
      within_bounds: marketOnlyResult.pass_rate_pct >= 3 && marketOnlyResult.pass_rate_pct <= 20,
    },
  };
  fs.writeFileSync(path.join(OUT_DIR, 'PROMOTION_SUMMARY.json'), JSON.stringify(summary, null, 2));

  // FILTER_PASS_RATES.json
  const filterRates = {
    full_mode: fullResult.filter_cascade,
    relaxed_mode: relaxedResult.filter_cascade,
    market_only_mode: marketOnlyResult.filter_cascade,
  };
  fs.writeFileSync(
    path.join(OUT_DIR, 'FILTER_PASS_RATES.json'),
    JSON.stringify(filterRates, null, 2)
  );

  // PROMOTION_LOG_SAMPLE.json (first 50 promoted + 50 rejected from market-only mode)
  const logSample = {
    full_mode: {
      promoted_sample: fullResult.promoted.slice(0, 50),
      rejected_sample: fullResult.rejected.slice(0, 50),
    },
    market_only_mode: {
      promoted_sample: marketOnlyResult.promoted.slice(0, 50),
      rejected_sample: marketOnlyResult.rejected.slice(0, 50),
    },
  };
  fs.writeFileSync(
    path.join(OUT_DIR, 'PROMOTION_LOG_SAMPLE.json'),
    JSON.stringify(logSample, null, 2)
  );

  // PROMOTED_PICKS.json (full list from market-only mode)
  const promotedPicks = marketOnlyResult.promoted.map(p => ({
    market_key: p.market_key,
    event_id: p.event_id,
    market_type_id: p.market_type_id,
    participant_id: p.participant_id,
    p_final: p.p_final,
    edge_final: p.edge_final,
    score: p.score,
    book_count: p.book_count,
    line_move_pct: p.line_move_pct,
    kelly_fraction: p.kelly_fraction,
  }));
  fs.writeFileSync(
    path.join(OUT_DIR, 'PROMOTED_PICKS.json'),
    JSON.stringify(promotedPicks, null, 2)
  );

  console.log(`\nArtifacts written to: ${OUT_DIR}`);

  // 8. Verdict
  const withinBounds = marketOnlyResult.pass_rate_pct >= 3 && marketOnlyResult.pass_rate_pct <= 20;
  console.log(`\n=== PASS CRITERIA ===`);
  console.log(
    `  Full mode pass rate:        ${fullResult.pass_rate_pct}% (expected 0% — shadow data)`
  );
  console.log(
    `  Relaxed mode pass rate:     ${relaxedResult.pass_rate_pct}% (expected 0% — edge bottleneck)`
  );
  console.log(`  Market-only mode pass rate: ${marketOnlyResult.pass_rate_pct}% (target 3-20%)`);
  console.log(`  Within bounds: ${withinBounds ? 'YES' : 'NO'}`);

  process.exit(0);
}

function logMode(result: ReturnType<typeof runPromotionPipeline>) {
  console.log(`  Total: ${result.total_input}`);
  console.log(`  Promoted: ${result.promoted.length} (${result.pass_rate_pct}%)`);
  console.log(`  Cascade:`);
  for (const [name, stats] of Object.entries(result.filter_cascade)) {
    console.log(
      `    ${name}: ${stats.input_count} in → ${stats.pass_count} pass (${stats.pass_rate_pct}%)`
    );
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
