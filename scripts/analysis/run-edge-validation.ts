/**
 * Edge Validation Runner
 * Sprint: SPRINT-027-MODEL-EDGE-VALIDATION
 *
 * Fetches shadow_scores + shadow_clv_results, joins them,
 * and runs the validation suite (integrity → calibration → ROI → robustness).
 * Fail-closed: integrity failure blocks all subsequent tests.
 *
 * Usage:
 *   npx tsx scripts/analysis/run-edge-validation.ts
 */

import * as dotenv from 'dotenv';

import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';

import {
  runCalibrationTest,
  generateCalibrationCSV,
} from '../../apps/api/src/analysis/edge-validation/calibration-test';
import { runCLVRobustness } from '../../apps/api/src/analysis/edge-validation/clv-robustness';
import { runIntegrityCheck } from '../../apps/api/src/analysis/edge-validation/integrity-check';
import { runROISimulation } from '../../apps/api/src/analysis/edge-validation/roi-simulation';

import type {
  ShadowScoreRow,
  ShadowCLVRow,
  CanonicalEventRow,
  MarketTypeRow,
  JoinedScoringRecord,
  ValidationSuite,
  TestResult,
  TestVerdict,
} from '../../apps/api/src/analysis/edge-validation/types';

// ── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MODEL_VERSION = process.env.MODEL_VERSION ?? 'v3.0.0-shadow';
const SPRINT = 'SPRINT-027-MODEL-EDGE-VALIDATION';
const DATE_STR = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, `../../out/sprints/${SPRINT}/${DATE_STR}`);

// ── Cursor-based fetch ──────────────────────────────────────────────────────

async function fetchAllRows<T extends { id: string }>(
  table: string,
  columns: string,
  filters?: (query: ReturnType<ReturnType<typeof createClient>['from']>) => typeof query
): Promise<T[]> {
  const rows: T[] = [];
  let lastId = '';
  const PAGE_SIZE = 1000;

  while (true) {
    let query = supabase.from(table).select(columns).order('id').limit(PAGE_SIZE);
    if (lastId) query = query.gt('id', lastId);
    if (filters) query = filters(query as any) as any;

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
    q => q.eq('model_version', MODEL_VERSION)
  );
  console.log(`  → ${scores.length} shadow_scores`);

  // 2. Fetch shadow_clv_results
  console.log('Fetching shadow_clv_results...');
  const clvResults = await fetchAllRows<ShadowCLVRow>(
    'shadow_clv_results',
    'id, market_key, event_id, market_type_id, participant_id, model_version, book_count_open, book_count_close, p_open_devig, p_close_devig, clv_prob, reason_code, meta',
    q => q.eq('model_version', MODEL_VERSION)
  );
  console.log(`  → ${clvResults.length} shadow_clv_results`);

  // 3. Fetch market_types
  console.log('Fetching market_types...');
  const { data: marketTypesRaw, error: mtErr } = await supabase
    .from('market_types')
    .select('id, market_key');
  if (mtErr) throw new Error(`market_types: ${mtErr.message}`);
  const marketTypes = (marketTypesRaw ?? []) as MarketTypeRow[];
  console.log(`  → ${marketTypes.length} market_types`);

  const marketTypeMap = new Map<number, string>();
  for (const mt of marketTypes) marketTypeMap.set(mt.id, mt.market_key);

  // 4. Fetch canonical_events for the event_ids in our dataset
  console.log('Fetching canonical_events...');
  const eventIds = [...new Set(scores.map(s => s.event_id))];
  const eventsMap = new Map<string, CanonicalEventRow>();

  // Batch fetch events (Supabase IN filter limited, use chunks)
  for (let i = 0; i < eventIds.length; i += 200) {
    const batch = eventIds.slice(i, i + 200);
    const { data, error } = await supabase
      .from('canonical_events')
      .select('id, scheduled_at')
      .in('id', batch);
    if (error) throw new Error(`canonical_events: ${error.message}`);
    for (const ev of (data ?? []) as CanonicalEventRow[]) {
      eventsMap.set(ev.id, ev);
    }
  }
  console.log(`  → ${eventsMap.size} canonical_events`);

  // 5. Join scores ↔ clv by market_key + model_version
  console.log('\nJoining scores ↔ CLV...');
  const clvMap = new Map<string, ShadowCLVRow>();
  for (const c of clvResults) {
    if (c.reason_code != null) continue; // skip partial CLV
    const key = `${c.market_key}|${c.model_version}`;
    clvMap.set(key, c);
  }

  const joined: JoinedScoringRecord[] = [];
  for (const s of scores) {
    if (s.p_final == null || s.p_market_devig == null || s.edge_final == null) continue;
    const key = `${s.market_key}|${s.model_version}`;
    const c = clvMap.get(key);
    if (!c) continue;
    if (c.p_open_devig == null || c.p_close_devig == null) continue;

    joined.push({
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
    });
  }
  console.log(`  → ${joined.length} joined records\n`);

  // Build event schedule map for robustness test
  const eventScheduleMap = new Map<string, string>();
  for (const [id, ev] of eventsMap) {
    eventScheduleMap.set(id, ev.scheduled_at);
  }

  // ── Run Tests ─────────────────────────────────────────────────────────────

  const tests: TestResult[] = [];

  // Test 1: Integrity Check (fail-closed)
  console.log('Running: Integrity Check...');
  const integrityResult = runIntegrityCheck({
    scores,
    clvResults,
    events: eventsMap,
  });
  tests.push(integrityResult);
  console.log(`  ${integrityResult.verdict}: ${integrityResult.summary}`);

  fs.writeFileSync(
    path.join(OUT_DIR, 'VALIDATION_INTEGRITY_REPORT.json'),
    JSON.stringify(integrityResult, null, 2)
  );

  if (integrityResult.verdict === 'FAIL') {
    console.log('\n⛔ INTEGRITY FAILURE — subsequent tests blocked.');
    writeSuite('FAIL', tests, scores.length, clvResults.length, joined.length);
    process.exit(1);
  }

  // Test 2: Calibration
  console.log('Running: Calibration Test...');
  const calibrationResult = runCalibrationTest(joined);
  tests.push(calibrationResult);
  console.log(`  ${calibrationResult.verdict}: ${calibrationResult.summary}`);

  fs.writeFileSync(
    path.join(OUT_DIR, 'CALIBRATION_RESULTS.json'),
    JSON.stringify(calibrationResult, null, 2)
  );

  // Write calibration CSV
  if (calibrationResult.details.bins) {
    const csv = generateCalibrationCSV(calibrationResult.details.bins as any);
    fs.writeFileSync(path.join(OUT_DIR, 'CALIBRATION_CURVE.csv'), csv);
  }

  // Test 3: ROI Simulation
  console.log('Running: ROI Simulation...');
  const roiResult = runROISimulation(joined);
  tests.push(roiResult);
  console.log(`  ${roiResult.verdict}: ${roiResult.summary}`);

  fs.writeFileSync(
    path.join(OUT_DIR, 'ROI_SIMULATION_RESULTS.json'),
    JSON.stringify(roiResult, null, 2)
  );

  // Test 4: CLV Robustness
  console.log('Running: CLV Robustness...');
  const robustnessResult = runCLVRobustness(joined, marketTypeMap, eventScheduleMap);
  tests.push(robustnessResult);
  console.log(`  ${robustnessResult.verdict}: ${robustnessResult.summary}`);

  fs.writeFileSync(
    path.join(OUT_DIR, 'CLV_BY_FEATURE.json'),
    JSON.stringify(robustnessResult, null, 2)
  );

  // ── Overall Verdict ───────────────────────────────────────────────────────

  const overallVerdict: TestVerdict = tests.some(t => t.verdict === 'FAIL')
    ? 'FAIL'
    : tests.some(t => t.verdict === 'WARN')
      ? 'WARN'
      : 'PASS';

  writeSuite(overallVerdict, tests, scores.length, clvResults.length, joined.length);

  console.log(`\n=== OVERALL VERDICT: ${overallVerdict} ===\n`);
  process.exit(overallVerdict === 'FAIL' ? 1 : 0);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function writeSuite(
  overallVerdict: TestVerdict,
  tests: TestResult[],
  scoresCount: number,
  clvCount: number,
  joinedCount: number
) {
  const suite: ValidationSuite = {
    sprint: SPRINT,
    timestamp: new Date().toISOString(),
    overall_verdict: overallVerdict,
    tests,
    data_summary: {
      shadow_scores_count: scoresCount,
      shadow_clv_count: clvCount,
      joined_count: joinedCount,
      model_version: MODEL_VERSION,
    },
  };

  fs.writeFileSync(
    path.join(OUT_DIR, 'EDGE_VALIDATION_SUITE.json'),
    JSON.stringify(suite, null, 2)
  );

  // Write summary markdown
  const md = [
    `# Edge Validation Summary`,
    ``,
    `**Sprint**: ${SPRINT}`,
    `**Date**: ${new Date().toISOString()}`,
    `**Overall Verdict**: ${overallVerdict}`,
    ``,
    `## Data`,
    `- Shadow scores: ${scoresCount}`,
    `- Shadow CLV results: ${clvCount}`,
    `- Joined records: ${joinedCount}`,
    `- Model version: ${MODEL_VERSION}`,
    ``,
    `## Tests`,
    ``,
    ...tests.map(t => `### ${t.test_name}: ${t.verdict}\n${t.summary}\n`),
    `## Methodology`,
    `All calibration uses closing line (p_close_devig) as efficient market benchmark.`,
    `ROI simulation uses CLV-based expected value (p_close/p_open - 1), not actual outcomes.`,
    `Fail-closed: integrity violations block all subsequent tests.`,
  ].join('\n');

  fs.writeFileSync(path.join(OUT_DIR, 'EDGE_VALIDATION_SUMMARY.md'), md);

  console.log(`\nArtifacts written to: ${OUT_DIR}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
