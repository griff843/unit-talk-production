/**
 * Edge Calibration — Sprint 031
 * SPRINT-031-MODEL-SEPARATION
 *
 * Evaluates the new model separation formula (p_final_v2) against
 * actual outcomes. Compares old p_final edge buckets vs new edge_v2
 * buckets, computes per-market calibrated thresholds, and measures
 * signal feature correlations with outcomes.
 */

import * as dotenv from 'dotenv';

import * as fs from 'fs';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';


import {
  computeCLVForecastV2,
  type CLVForecastV2Result,
} from '../../apps/api/src/analysis/models/clv-forecast';
import {
  computeModelBlend,
  type ModelBlendResult,
} from '../../apps/api/src/analysis/models/model-blend';
import {
  computeSharpConsensus,
  type SharpConsensusResult,
} from '../../apps/api/src/analysis/models/sharp-consensus';
import {
  computeBookDispersion,
  type DispersionResult,
} from '../../apps/api/src/analysis/signals/book-dispersion';
import {
  computeMovementScore,
  type ProviderOfferSlim,
} from '../../apps/api/src/analysis/signals/market-signals';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const SPRINT = 'SPRINT-031-MODEL-SEPARATION';
const DATE_STR = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, `../../out/sprints/${SPRINT}/${DATE_STR}`);

// ── Types ───────────────────────────────────────────────────────────────────

interface JoinedRecord {
  market_key: string;
  event_id: string;
  market_type_id: number;
  market_type_key: string;
  participant_id: string | null;
  p_final: number;
  edge_final: number;
  score: number;
  book_count: number;
  outcome: 'WIN' | 'LOSS' | 'PUSH';
  actual_value: number;
  line: number;
  // New model outputs
  sharp_consensus: SharpConsensusResult | null;
  dispersion: DispersionResult | null;
  model_blend: ModelBlendResult | null;
  clv_v2: CLVForecastV2Result | null;
}

interface BucketRow {
  label: string;
  count: number;
  wins: number;
  losses: number;
  pushes: number;
  hit_rate_pct: number;
  roi_pct: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function computeROI(outcomes: string[]): number {
  let bankroll = 0;
  for (const o of outcomes) {
    if (o === 'WIN') bankroll += 100;
    else if (o === 'LOSS') bankroll -= 110;
  }
  const totalRisked = outcomes.filter(o => o !== 'PUSH').length * 110;
  return totalRisked > 0 ? (bankroll / totalRisked) * 100 : 0;
}

function round(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

function buildBuckets(records: JoinedRecord[], labeler: (r: JoinedRecord) => string): BucketRow[] {
  const groups = new Map<string, JoinedRecord[]>();
  for (const r of records) {
    const label = labeler(r);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(r);
  }

  const buckets: BucketRow[] = [];
  for (const [label, group] of Array.from(groups.entries())) {
    const wins = group.filter(r => r.outcome === 'WIN').length;
    const losses = group.filter(r => r.outcome === 'LOSS').length;
    const pushes = group.filter(r => r.outcome === 'PUSH').length;
    const nonPush = group.filter(r => r.outcome !== 'PUSH');
    const roi = computeROI(group.map(r => r.outcome));

    buckets.push({
      label,
      count: group.length,
      wins,
      losses,
      pushes,
      hit_rate_pct: nonPush.length > 0 ? round((wins / nonPush.length) * 100, 2) : 0,
      roi_pct: round(roi, 3),
    });
  }

  return buckets.sort((a, b) => b.count - a.count);
}

// ── Data Fetching ───────────────────────────────────────────────────────────

async function fetchAllRows<T>(table: string, select: string): Promise<T[]> {
  const rows: T[] = [];
  let lastId = '';
  const PAGE = 1000;
  while (true) {
    let q = supabase.from(table).select(select).order('id').limit(PAGE);
    if (lastId) q = q.gt('id', lastId);
    const { data, error } = await q;
    if (error) {
      console.error(`[${table}]`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    lastId = (data[data.length - 1] as Record<string, unknown>).id as string;
    if (data.length < PAGE) break;
  }
  return rows;
}

async function fetchProviderOffers(
  eventIds: string[],
  marketTypeId: number,
  participantId: string | null
): Promise<ProviderOfferSlim[]> {
  const all: Array<{
    provider: string;
    line: number | null;
    over_odds: number | null;
    under_odds: number | null;
    snapshot_at: string;
    is_opening: boolean;
    is_closing: boolean;
  }> = [];
  for (let i = 0; i < eventIds.length; i += 10) {
    const batch = eventIds.slice(i, i + 10);
    let q = supabase
      .from('provider_offers')
      .select('provider, line, over_odds, under_odds, snapshot_at, is_opening, is_closing')
      .in('event_id', batch)
      .eq('market_type_id', marketTypeId);

    if (participantId) {
      q = q.eq('participant_id', participantId);
    }

    const { data, error } = await q.limit(1000);
    if (error) continue;
    if (data) all.push(...data);
  }

  // Provider_offers stores over/under on separate rows.
  // Pair them by provider + line to create combined offers.
  return pairOffers(all);
}

/**
 * Pair over/under rows from provider_offers into combined ProviderOfferSlim.
 * Groups by provider + line, merging over_odds from one row with under_odds from another.
 */
function pairOffers(
  rows: Array<{
    provider: string;
    line: number | null;
    over_odds: number | null;
    under_odds: number | null;
    snapshot_at: string;
    is_opening: boolean;
    is_closing: boolean;
  }>
): ProviderOfferSlim[] {
  // Group by provider + line
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.provider}|${r.line ?? 'null'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const paired: ProviderOfferSlim[] = [];
  for (const [, group] of groups) {
    const overRow = group.find(r => r.over_odds != null);
    const underRow = group.find(r => r.under_odds != null);

    // If a single row already has both, use it directly
    const bothRow = group.find(r => r.over_odds != null && r.under_odds != null);
    if (bothRow) {
      paired.push(bothRow as ProviderOfferSlim);
      continue;
    }

    // Pair over + under from separate rows
    if (overRow && underRow) {
      paired.push({
        provider: overRow.provider,
        line: overRow.line,
        over_odds: overRow.over_odds,
        under_odds: underRow.under_odds,
        snapshot_at: overRow.snapshot_at,
        is_opening: overRow.is_opening || underRow.is_opening,
        is_closing: overRow.is_closing || underRow.is_closing,
      });
    }
  }

  return paired;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  SPRINT-031: Model Separation + Edge Calibration`);
  console.log(`  OUT_DIR: ${OUT_DIR}`);
  console.log(`${'='.repeat(60)}\n`);

  // 1. Fetch shadow_scores
  console.log('[Data] Fetching shadow_scores...');
  const shadowScores = await fetchAllRows<{
    id: string;
    market_key: string;
    event_id: string;
    market_type_id: number;
    participant_id: string | null;
    p_final: number;
    edge_final: number;
    score: number;
    book_count: number;
  }>(
    'shadow_scores',
    'id, market_key, event_id, market_type_id, participant_id, p_final, edge_final, score, book_count'
  );
  console.log(`[Data] ${shadowScores.length} shadow_scores`);

  // 2. Fetch prop_outcomes
  console.log('[Data] Fetching prop_outcomes...');
  const propOutcomes = await fetchAllRows<{
    id: string;
    market_key: string;
    outcome: string;
    actual_value: number;
    line: number;
  }>('prop_outcomes', 'id, market_key, outcome, actual_value, line');
  console.log(`[Data] ${propOutcomes.length} prop_outcomes`);

  // 3. Fetch market_types
  const { data: mtData } = await supabase.from('market_types').select('id, market_key');
  const marketTypeMap = new Map<number, string>();
  for (const mt of mtData ?? []) {
    marketTypeMap.set(mt.id, mt.market_key);
  }

  // 4. Join
  const outcomeMap = new Map<string, { outcome: string; actual_value: number; line: number }>();
  for (const o of propOutcomes) {
    outcomeMap.set(o.market_key, {
      outcome: o.outcome,
      actual_value: o.actual_value,
      line: o.line,
    });
  }

  const joined: JoinedRecord[] = [];
  let unmatched = 0;
  for (const ss of shadowScores) {
    const oc = outcomeMap.get(ss.market_key);
    if (!oc) {
      unmatched++;
      continue;
    }
    joined.push({
      market_key: ss.market_key,
      event_id: ss.event_id,
      market_type_id: ss.market_type_id,
      market_type_key: marketTypeMap.get(ss.market_type_id) ?? `mt_${ss.market_type_id}`,
      participant_id: ss.participant_id,
      p_final: ss.p_final,
      edge_final: ss.edge_final,
      score: ss.score,
      book_count: ss.book_count,
      outcome: oc.outcome as 'WIN' | 'LOSS' | 'PUSH',
      actual_value: oc.actual_value,
      line: oc.line,
      sharp_consensus: null,
      dispersion: null,
      model_blend: null,
      clv_v2: null,
    });
  }
  console.log(`[Join] ${joined.length} joined, ${unmatched} unmatched`);

  // 5. Compute model separation for each joined record
  // Group by unique market (event_id + market_type_id + participant_id)
  const marketGroups = new Map<string, JoinedRecord[]>();
  for (const r of joined) {
    const key = `${r.event_id}|${r.market_type_id}|${r.participant_id ?? 'null'}`;
    if (!marketGroups.has(key)) marketGroups.set(key, []);
    marketGroups.get(key)!.push(r);
  }

  console.log(`[Model] ${marketGroups.size} unique markets`);
  console.log(`[Model] Sampling up to 500 markets for model computation...`);

  let modelCount = 0;
  const entries = Array.from(marketGroups.entries()).slice(0, 500);
  for (let i = 0; i < entries.length; i++) {
    const [, records] = entries[i]!;
    const r = records[0]!;

    const offers = await fetchProviderOffers([r.event_id], r.market_type_id, r.participant_id);
    if (offers.length === 0) continue;

    // Sharp consensus
    const sc = computeSharpConsensus(offers);

    // Book dispersion
    const disp = computeBookDispersion(offers);

    // Movement score
    const opening = offers.filter(o => o.is_opening);
    const closing = offers.filter(o => o.is_closing);
    const movementScore = computeMovementScore(opening, closing);

    // Model blend (needs sharp consensus)
    let blend: ModelBlendResult | null = null;
    let clvV2: CLVForecastV2Result | null = null;

    if (sc) {
      blend = computeModelBlend(sc.p_equal, sc.p_sharp, movementScore, disp.dispersion_score);
      clvV2 = computeCLVForecastV2(
        blend.edge_v2,
        movementScore,
        sc.sharp_weight_score,
        sc.sharp_direction,
        disp.dispersion_score
      );
    }

    for (const rec of records) {
      rec.sharp_consensus = sc;
      rec.dispersion = disp;
      rec.model_blend = blend;
      rec.clv_v2 = clvV2;
    }

    modelCount++;
    if ((i + 1) % 100 === 0) {
      console.log(`[Model] Progress: ${i + 1}/${entries.length}`);
    }
  }
  console.log(`[Model] Computed ${modelCount} model blend results`);

  // 6. Analysis — records with model data
  const withModel = joined.filter(r => r.model_blend !== null);
  console.log(`[Analysis] ${withModel.length} records with model data\n`);

  // ── Divergence stats ──────────────────────────────────────────────────
  const divergences = withModel.map(r => r.model_blend!.p_final_v2 - r.p_final);
  const absDivergences = divergences.map(d => Math.abs(d));
  const meanDiv = divergences.reduce((a, b) => a + b, 0) / divergences.length;
  const meanAbsDiv = absDivergences.reduce((a, b) => a + b, 0) / absDivergences.length;
  const maxAbsDiv = Math.max(...absDivergences);
  const divStdDev = Math.sqrt(
    divergences.reduce((sum, d) => sum + (d - meanDiv) ** 2, 0) / divergences.length
  );

  console.log('── Divergence: p_final_v2 vs p_final ──');
  console.log(`  Mean divergence:     ${round(meanDiv, 6)}`);
  console.log(`  Mean |divergence|:   ${round(meanAbsDiv, 6)}`);
  console.log(`  Max |divergence|:    ${round(maxAbsDiv, 6)}`);
  console.log(`  Std dev:             ${round(divStdDev, 6)}`);

  // Divergence distribution
  const divBuckets = [
    { label: '<0.001', count: 0 },
    { label: '0.001-0.005', count: 0 },
    { label: '0.005-0.01', count: 0 },
    { label: '0.01-0.02', count: 0 },
    { label: '0.02+', count: 0 },
  ];
  for (const d of absDivergences) {
    if (d < 0.001) divBuckets[0]!.count++;
    else if (d < 0.005) divBuckets[1]!.count++;
    else if (d < 0.01) divBuckets[2]!.count++;
    else if (d < 0.02) divBuckets[3]!.count++;
    else divBuckets[4]!.count++;
  }
  console.log('\n  Distribution of |divergence|:');
  for (const b of divBuckets) {
    const pct = round((b.count / withModel.length) * 100, 1);
    console.log(`    ${b.label}: ${b.count} (${pct}%)`);
  }

  // ── Edge_v2 buckets ───────────────────────────────────────────────────
  console.log('\n── ROI by edge_v2 bucket ──');
  const edgeV2Buckets = buildBuckets(withModel, r => {
    const e = r.model_blend!.edge_v2;
    if (e < -0.01) return '<-1%';
    if (e < 0) return '-1% to 0%';
    if (e < 0.005) return '0-0.5%';
    if (e < 0.01) return '0.5-1%';
    if (e < 0.02) return '1-2%';
    return '2%+';
  });
  for (const b of edgeV2Buckets) {
    console.log(`  ${b.label}: ${b.count} props, ${b.hit_rate_pct}% hit, ${b.roi_pct}% ROI`);
  }

  // ── Old edge buckets (for comparison) ─────────────────────────────────
  console.log('\n── ROI by original edge_final bucket (same subset) ──');
  const oldEdgeBuckets = buildBuckets(withModel, r => {
    const e = r.edge_final;
    if (e < -0.01) return '<-1%';
    if (e < 0) return '-1% to 0%';
    if (e < 0.005) return '0-0.5%';
    if (e < 0.01) return '0.5-1%';
    if (e < 0.02) return '1-2%';
    return '2%+';
  });
  for (const b of oldEdgeBuckets) {
    console.log(`  ${b.label}: ${b.count} props, ${b.hit_rate_pct}% hit, ${b.roi_pct}% ROI`);
  }

  // ── Per-market calibration ────────────────────────────────────────────
  console.log('\n── Per-market ROI with edge_v2 thresholds ──');
  const marketTypes = [...new Set(withModel.map(r => r.market_type_key))];
  const calibration: Array<{
    market_type: string;
    count: number;
    hit_rate_pct: number;
    roi_pct: number;
    mean_edge_v2: number;
    recommended_min_edge: number;
  }> = [];

  for (const mt of marketTypes) {
    const mtRecords = withModel.filter(r => r.market_type_key === mt);
    if (mtRecords.length < 10) continue;

    const wins = mtRecords.filter(r => r.outcome === 'WIN').length;
    const nonPush = mtRecords.filter(r => r.outcome !== 'PUSH');
    const roi = computeROI(mtRecords.map(r => r.outcome));
    const edges = mtRecords.map(r => r.model_blend!.edge_v2);
    const meanEdge = edges.reduce((a, b) => a + b, 0) / edges.length;

    // Find minimum edge_v2 threshold where ROI > 0
    const sortedEdges = [...edges].sort((a, b) => a - b);
    let recommendedMin = 0;
    for (const threshold of [0, 0.001, 0.002, 0.005, 0.008, 0.01, 0.015, 0.02]) {
      const subset = mtRecords.filter(r => r.model_blend!.edge_v2 >= threshold);
      if (subset.length < 5) continue;
      const subRoi = computeROI(subset.map(r => r.outcome));
      if (subRoi > 0) {
        recommendedMin = threshold;
        break;
      }
    }

    const entry = {
      market_type: mt,
      count: mtRecords.length,
      hit_rate_pct: nonPush.length > 0 ? round((wins / nonPush.length) * 100, 2) : 0,
      roi_pct: round(roi, 3),
      mean_edge_v2: round(meanEdge, 6),
      recommended_min_edge: recommendedMin,
    };
    calibration.push(entry);
    console.log(
      `  ${mt}: ${entry.count} props, ${entry.hit_rate_pct}% hit, ${entry.roi_pct}% ROI, ` +
        `mean_edge_v2=${entry.mean_edge_v2}, rec_min=${entry.recommended_min_edge}`
    );
  }

  // ── Sharp consensus stats ─────────────────────────────────────────────
  const withSharp = withModel.filter(r => r.sharp_consensus !== null);
  console.log(`\n── Sharp consensus stats (${withSharp.length} records) ──`);
  if (withSharp.length > 0) {
    const sharpScores = withSharp.map(r => r.sharp_consensus!.sharp_weight_score);
    const meanSharp = sharpScores.reduce((a, b) => a + b, 0) / sharpScores.length;
    const maxSharp = Math.max(...sharpScores);
    console.log(`  Mean sharp_weight_score: ${round(meanSharp, 6)}`);
    console.log(`  Max sharp_weight_score:  ${round(maxSharp, 6)}`);

    // ROI by sharp direction
    const sharpDirBuckets = buildBuckets(withSharp, r => {
      const d = r.sharp_consensus!.sharp_direction;
      if (d > 0) return 'sharp_bullish';
      if (d < 0) return 'sharp_bearish';
      return 'neutral';
    });
    console.log('\n  By sharp direction:');
    for (const b of sharpDirBuckets) {
      console.log(`    ${b.label}: ${b.count} props, ${b.hit_rate_pct}% hit, ${b.roi_pct}% ROI`);
    }
  }

  // ── CLV v2 stats ──────────────────────────────────────────────────────
  const withCLV = withModel.filter(r => r.clv_v2 !== null);
  if (withCLV.length > 0) {
    console.log(`\n── CLV Forecast V2 stats (${withCLV.length} records) ──`);
    const clvValues = withCLV.map(r => r.clv_v2!.clv_forecast);
    const meanCLV = clvValues.reduce((a, b) => a + b, 0) / clvValues.length;
    console.log(`  Mean CLV forecast: ${round(meanCLV, 6)}`);

    // ROI by CLV bucket
    const clvBuckets = buildBuckets(withCLV, r => {
      const c = r.clv_v2!.clv_forecast;
      if (c < 0) return 'negative';
      if (c < 0.1) return '0-10%';
      if (c < 0.15) return '10-15%';
      return '15%+';
    });
    console.log('\n  By CLV forecast bucket:');
    for (const b of clvBuckets) {
      console.log(`    ${b.label}: ${b.count} props, ${b.hit_rate_pct}% hit, ${b.roi_pct}% ROI`);
    }
  }

  // ── Signal correlations ───────────────────────────────────────────────
  console.log('\n── Signal feature correlations with outcome ──');
  const winRecords = withModel.filter(r => r.outcome === 'WIN');
  const lossRecords = withModel.filter(r => r.outcome === 'LOSS');

  if (winRecords.length > 0 && lossRecords.length > 0) {
    const features = [
      { name: 'edge_v2', fn: (r: JoinedRecord) => r.model_blend!.edge_v2 },
      { name: 'edge_final (old)', fn: (r: JoinedRecord) => r.edge_final },
      {
        name: 'sharp_weight_score',
        fn: (r: JoinedRecord) => r.sharp_consensus?.sharp_weight_score ?? 0,
      },
      { name: 'dispersion_score', fn: (r: JoinedRecord) => r.dispersion?.dispersion_score ?? 0 },
      { name: 'clv_v2', fn: (r: JoinedRecord) => r.clv_v2?.clv_forecast ?? 0 },
    ];

    for (const feat of features) {
      const winMean = winRecords.reduce((s, r) => s + feat.fn(r), 0) / winRecords.length;
      const lossMean = lossRecords.reduce((s, r) => s + feat.fn(r), 0) / lossRecords.length;
      console.log(
        `  ${feat.name}: WIN mean=${round(winMean, 6)}, LOSS mean=${round(lossMean, 6)}, ` +
          `delta=${round(winMean - lossMean, 6)}`
      );
    }
  }

  // ── Write artifacts ───────────────────────────────────────────────────
  const modelData = {
    generated_at: new Date().toISOString(),
    total_joined: joined.length,
    model_computed: withModel.length,
    divergence: {
      mean: round(meanDiv, 6),
      mean_abs: round(meanAbsDiv, 6),
      max_abs: round(maxAbsDiv, 6),
      std_dev: round(divStdDev, 6),
      distribution: divBuckets,
    },
    edge_v2_buckets: edgeV2Buckets,
    old_edge_buckets: oldEdgeBuckets,
    calibration,
  };

  fs.writeFileSync(
    path.join(OUT_DIR, 'MODEL_SEPARATION_DATA.json'),
    JSON.stringify(modelData, null, 2)
  );

  const calibrationData = {
    generated_at: new Date().toISOString(),
    per_market: calibration,
    sharp_stats:
      withSharp.length > 0
        ? {
            count: withSharp.length,
            mean_sharp_score: round(
              withSharp.reduce((s, r) => s + r.sharp_consensus!.sharp_weight_score, 0) /
                withSharp.length,
              6
            ),
          }
        : null,
  };

  fs.writeFileSync(
    path.join(OUT_DIR, 'EDGE_CALIBRATION_DATA.json'),
    JSON.stringify(calibrationData, null, 2)
  );

  // Markdown reports
  fs.writeFileSync(
    path.join(OUT_DIR, 'MODEL_SEPARATION_REPORT.md'),
    generateModelReport(modelData, withSharp, withCLV)
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'EDGE_CALIBRATION_REPORT.md'),
    generateCalibrationReport(calibrationData, edgeV2Buckets, oldEdgeBuckets)
  );

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Artifacts written to ${OUT_DIR}`);
  console.log(`${'='.repeat(60)}\n`);
}

// ── Report Generators ───────────────────────────────────────────────────────

function generateModelReport(
  data: Record<string, unknown>,
  withSharp: JoinedRecord[],
  withCLV: JoinedRecord[]
): string {
  const lines: string[] = [];
  lines.push('# Model Separation Report — SPRINT-031');
  lines.push(`\nGenerated: ${new Date().toISOString()}`);
  lines.push(`\nTotal joined: ${data.total_joined}`);
  lines.push(`Model computed: ${data.model_computed}`);

  const div = data.divergence as {
    mean: number;
    mean_abs: number;
    max_abs: number;
    std_dev: number;
    distribution: Array<{ label: string; count: number }>;
  };

  lines.push('\n## Divergence: p_final_v2 vs p_final\n');
  lines.push(`- Mean divergence: ${div.mean}`);
  lines.push(`- Mean |divergence|: ${div.mean_abs}`);
  lines.push(`- Max |divergence|: ${div.max_abs}`);
  lines.push(`- Std dev: ${div.std_dev}`);

  lines.push('\n### Distribution of |divergence|\n');
  lines.push('| Range | Count | % |');
  lines.push('|-------|-------|----|');
  for (const b of div.distribution) {
    const pct =
      (data.model_computed as number) > 0
        ? round((b.count / (data.model_computed as number)) * 100, 1)
        : 0;
    lines.push(`| ${b.label} | ${b.count} | ${pct}% |`);
  }

  lines.push('\n## ROI by edge_v2 Bucket\n');
  lines.push('| Bucket | Count | Hit Rate | ROI |');
  lines.push('|--------|-------|----------|-----|');
  for (const b of data.edge_v2_buckets as BucketRow[]) {
    lines.push(`| ${b.label} | ${b.count} | ${b.hit_rate_pct}% | ${b.roi_pct}% |`);
  }

  lines.push('\n## ROI by Original edge_final Bucket (same subset)\n');
  lines.push('| Bucket | Count | Hit Rate | ROI |');
  lines.push('|--------|-------|----------|-----|');
  for (const b of data.old_edge_buckets as BucketRow[]) {
    lines.push(`| ${b.label} | ${b.count} | ${b.hit_rate_pct}% | ${b.roi_pct}% |`);
  }

  if (withSharp.length > 0) {
    lines.push('\n## Sharp Consensus Signal\n');
    const sharpScores = withSharp.map(r => r.sharp_consensus!.sharp_weight_score);
    lines.push(`- Records with sharp consensus: ${withSharp.length}`);
    lines.push(
      `- Mean sharp_weight_score: ${round(sharpScores.reduce((a, b) => a + b, 0) / sharpScores.length, 6)}`
    );
    lines.push(`- Max sharp_weight_score: ${round(Math.max(...sharpScores), 6)}`);
  }

  if (withCLV.length > 0) {
    lines.push('\n## CLV Forecast V2\n');
    const clvValues = withCLV.map(r => r.clv_v2!.clv_forecast);
    lines.push(`- Records with CLV v2: ${withCLV.length}`);
    lines.push(
      `- Mean CLV forecast: ${round(clvValues.reduce((a, b) => a + b, 0) / clvValues.length, 6)}`
    );
  }

  return lines.join('\n');
}

function generateCalibrationReport(
  data: {
    per_market: Array<{
      market_type: string;
      count: number;
      hit_rate_pct: number;
      roi_pct: number;
      mean_edge_v2: number;
      recommended_min_edge: number;
    }>;
    sharp_stats: unknown;
    generated_at: string;
  },
  edgeV2Buckets: BucketRow[],
  oldEdgeBuckets: BucketRow[]
): string {
  const lines: string[] = [];
  lines.push('# Edge Calibration Report — SPRINT-031');
  lines.push(`\nGenerated: ${data.generated_at}`);

  lines.push('\n## Per-Market Calibrated Thresholds\n');
  lines.push('| Market Type | Count | Hit Rate | ROI | Mean edge_v2 | Rec min_edge |');
  lines.push('|-------------|-------|----------|-----|--------------|-------------|');
  for (const m of data.per_market) {
    lines.push(
      `| ${m.market_type} | ${m.count} | ${m.hit_rate_pct}% | ${m.roi_pct}% | ${m.mean_edge_v2} | ${m.recommended_min_edge} |`
    );
  }

  lines.push('\n## edge_v2 Buckets vs Original edge_final Buckets\n');
  lines.push('### New edge_v2\n');
  lines.push('| Bucket | Count | Hit Rate | ROI |');
  lines.push('|--------|-------|----------|-----|');
  for (const b of edgeV2Buckets) {
    lines.push(`| ${b.label} | ${b.count} | ${b.hit_rate_pct}% | ${b.roi_pct}% |`);
  }

  lines.push('\n### Original edge_final\n');
  lines.push('| Bucket | Count | Hit Rate | ROI |');
  lines.push('|--------|-------|----------|-----|');
  for (const b of oldEdgeBuckets) {
    lines.push(`| ${b.label} | ${b.count} | ${b.hit_rate_pct}% | ${b.roi_pct}% |`);
  }

  return lines.join('\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
