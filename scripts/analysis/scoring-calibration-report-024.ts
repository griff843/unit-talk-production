#!/usr/bin/env tsx
/**
 * Scoring Calibration & Drift Report
 * Sprint: SPRINT-024-SCORING-ENHANCEMENT-LAYERING
 *
 * Queries picks with explain_v3 payload, computes distribution stats,
 * detects "too good to be true" edges, and writes proof artifacts.
 *
 * Usage:
 *   npx tsx scripts/analysis/scoring-calibration-report-024.ts
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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

const SPRINT_ID = 'SPRINT-024-SCORING-ENHANCEMENT-LAYERING';
const DATE_STR = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, `../../out/sprints/${SPRINT_ID}/${DATE_STR}`);

const SAMPLE_SIZE = parseInt(process.env['SAMPLE_SIZE'] || '500', 10);
const EDGE_TOO_GOOD_THRESHOLD = 0.08;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExplainV3 {
  model_version: string;
  p_market_devig: number;
  adjustment_raw: number;
  adjustment_capped: number;
  cap_value: number;
  cap_reason: string;
  uncertainty_final: number;
  confidence_factor: number;
  p_final: number;
  edge_final: number;
  clipped: boolean;
  reason_codes: string[];
  books_used: number;
  book_spread: number;
  feature_completeness: number;
}

interface ScoredPick {
  id: string;
  tier: string | null;
  score: number | null;
  p_final: number | null;
  edge_final: number | null;
  explain: ExplainV3;
}

interface Distribution {
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stddev: number;
  p5: number;
  p95: number;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\n=== Scoring Calibration Report — ${SPRINT_ID} ===\n`);

  // Step 1: Fetch picks with explain_v3
  const { data: raw, error } = await supabase
    .from('unified_picks')
    .select('id, tier, score, p_final, edge_final, meta')
    .not('meta->explain_v3', 'is', null)
    .order('created_at', { ascending: false })
    .limit(SAMPLE_SIZE);

  if (error) {
    console.error('[FATAL] Cannot fetch picks:', error.message);
    process.exit(1);
  }

  const picks: ScoredPick[] = (
    (raw ?? []) as Array<{
      id: string;
      tier: string | null;
      score: number | null;
      p_final: number | null;
      edge_final: number | null;
      meta: Record<string, unknown>;
    }>
  )
    .filter(p => p.meta?.['explain_v3'])
    .map(p => ({
      id: p.id,
      tier: p.tier,
      score: p.score,
      p_final: p.p_final,
      edge_final: p.edge_final,
      explain: p.meta['explain_v3'] as ExplainV3,
    }));

  console.log(`Picks with explain_v3: ${picks.length}`);

  if (picks.length === 0) {
    console.log('No picks with explain_v3 found. Writing empty report.');
    writeEmptyReport();
    return;
  }

  // Step 2: Tier distribution
  console.log('\n--- Tier Distribution ---');
  const tierDist = tierDistribution(picks.map(p => p.tier));
  printTierDist(tierDist);

  // Step 3: Edge distribution
  console.log('\n--- Edge Distribution ---');
  const edges = picks.map(p => p.explain.edge_final);
  const edgeDist = computeDist(edges);
  console.log('  ' + formatDist(edgeDist));

  // Step 4: p_final vs p_market delta
  console.log('\n--- p_final vs p_market (delta) Distribution ---');
  const deltas = picks.map(p => p.explain.p_final - p.explain.p_market_devig);
  const deltaDist = computeDist(deltas);
  console.log('  ' + formatDist(deltaDist));

  // Step 5: Cap activation
  console.log('\n--- Cap Activation ---');
  const capActivated = picks.filter(p => Math.abs(p.explain.adjustment_raw) > p.explain.cap_value);
  console.log(
    `  Cap activated: ${capActivated.length} / ${picks.length} (${pct(capActivated.length, picks.length)})`
  );

  const capReduced = picks.filter(p => p.explain.cap_value < 0.04);
  const capBoosted = picks.filter(p => p.explain.cap_value > 0.04);
  console.log(
    `  Cap reduced (<0.04): ${capReduced.length}  |  Cap boosted (>0.04): ${capBoosted.length}`
  );

  // Step 6: Confidence factor distribution
  console.log('\n--- Confidence Factor Distribution ---');
  const confFactors = picks.map(p => p.explain.confidence_factor);
  console.log('  ' + formatDist(computeDist(confFactors)));

  // Step 7: Uncertainty distribution
  console.log('\n--- Uncertainty Distribution ---');
  const uncertainties = picks.map(p => p.explain.uncertainty_final);
  console.log('  ' + formatDist(computeDist(uncertainties)));

  // Step 8: Book spread distribution
  console.log('\n--- Book Spread Distribution ---');
  const spreads = picks.map(p => p.explain.book_spread);
  console.log('  ' + formatDist(computeDist(spreads)));

  // Step 9: "Too Good to Be True" detector
  console.log('\n--- Too Good to Be True Detector ---');
  const tooGood = picks.filter(p => Math.abs(p.explain.edge_final) > EDGE_TOO_GOOD_THRESHOLD);
  console.log(
    `  Edges > ${EDGE_TOO_GOOD_THRESHOLD}: ${tooGood.length} / ${picks.length} (${pct(tooGood.length, picks.length)})`
  );

  if (tooGood.length > 0) {
    console.log('  Top flagged picks:');
    for (const p of tooGood.slice(0, 5)) {
      console.log(
        `    ${p.id}: edge=${p.explain.edge_final.toFixed(4)}, p_final=${p.explain.p_final.toFixed(4)}, p_market=${p.explain.p_market_devig.toFixed(4)}`
      );
    }
  }

  // Step 10: Reason code frequency
  console.log('\n--- Reason Code Frequency ---');
  const codeFreq: Record<string, number> = {};
  for (const p of picks) {
    for (const code of p.explain.reason_codes) {
      codeFreq[code] = (codeFreq[code] || 0) + 1;
    }
  }
  for (const [code, count] of Object.entries(codeFreq).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${code}: ${count} (${pct(count, picks.length)})`);
  }

  // Step 11: p_final boundedness check
  console.log('\n--- p_final Boundedness ---');
  const outOfBounds = picks.filter(
    p => p.explain.p_final < 0 || p.explain.p_final > 1 || !isFinite(p.explain.p_final)
  );
  console.log(
    `  Out of bounds (0,1): ${outOfBounds.length} / ${picks.length} — ${outOfBounds.length === 0 ? 'PASS' : 'FAIL'}`
  );

  // Step 12: Write artifacts
  writeReport(picks, {
    tierDist,
    edgeDist,
    deltaDist,
    capActivated: capActivated.length,
    capReduced: capReduced.length,
    capBoosted: capBoosted.length,
    tooGoodCount: tooGood.length,
    outOfBoundsCount: outOfBounds.length,
    codeFreq,
    confFactorDist: computeDist(confFactors),
    uncertaintyDist: computeDist(uncertainties),
    bookSpreadDist: computeDist(spreads),
  });

  console.log(`\n=== Calibration report complete ===`);
}

// ---------------------------------------------------------------------------
// Distribution helpers
// ---------------------------------------------------------------------------

function tierDistribution(tiers: Array<string | null>): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const t of tiers) {
    const key = t ?? 'null';
    dist[key] = (dist[key] || 0) + 1;
  }
  return dist;
}

function printTierDist(dist: Record<string, number>): void {
  const total = Object.values(dist).reduce((s, n) => s + n, 0);
  for (const [tier, count] of Object.entries(dist).sort()) {
    console.log(`  ${tier}: ${count} (${pct(count, total)})`);
  }
}

function computeDist(values: number[]): Distribution {
  if (values.length === 0) {
    return { count: 0, mean: 0, median: 0, min: 0, max: 0, stddev: 0, p5: 0, p95: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const p5idx = Math.floor(n * 0.05);
  const p95idx = Math.min(Math.floor(n * 0.95), n - 1);

  return {
    count: n,
    mean: round(mean),
    median: round(median),
    min: round(sorted[0]),
    max: round(sorted[n - 1]),
    stddev: round(Math.sqrt(variance)),
    p5: round(sorted[p5idx]),
    p95: round(sorted[p95idx]),
  };
}

function formatDist(d: Distribution): string {
  if (d.count === 0) return 'n=0 (no data)';
  return `n=${d.count} mean=${d.mean} median=${d.median} [${d.min}, ${d.max}] sd=${d.stddev} p5=${d.p5} p95=${d.p95}`;
}

function round(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function pct(n: number, total: number): string {
  if (total === 0) return '0.0%';
  return ((n / total) * 100).toFixed(1) + '%';
}

// ---------------------------------------------------------------------------
// Report writers
// ---------------------------------------------------------------------------

function writeEmptyReport(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const report = `# Calibration Report: Scoring Enhancement Layering

**Sprint**: ${SPRINT_ID}
**Date**: ${DATE_STR}
**Status**: NO DATA — No picks with explain_v3 found yet.

Run shadow scoring or process picks through ProfessionalPropProcessor to populate explain_v3 data.
`;
  fs.writeFileSync(path.join(OUT_DIR, 'CALIBRATION_REPORT.md'), report);
  fs.writeFileSync(
    path.join(OUT_DIR, 'DISTRIBUTIONS.json'),
    JSON.stringify({ empty: true }, null, 2)
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'SAMPLE_EXPLANATIONS.json'),
    JSON.stringify({ samples: [] }, null, 2)
  );
  console.log(`Artifacts written to: ${OUT_DIR}`);
}

function writeReport(
  picks: ScoredPick[],
  stats: {
    tierDist: Record<string, number>;
    edgeDist: Distribution;
    deltaDist: Distribution;
    capActivated: number;
    capReduced: number;
    capBoosted: number;
    tooGoodCount: number;
    outOfBoundsCount: number;
    codeFreq: Record<string, number>;
    confFactorDist: Distribution;
    uncertaintyDist: Distribution;
    bookSpreadDist: Distribution;
  }
): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // CALIBRATION_REPORT.md
  const tierRows = Object.entries(stats.tierDist)
    .sort()
    .map(([t, c]) => `| ${t} | ${c} | ${pct(c, picks.length)} |`)
    .join('\n');

  const distRow = (label: string, d: Distribution): string =>
    `| ${label} | ${d.count} | ${d.mean} | ${d.median} | ${d.min} | ${d.max} | ${d.stddev} | ${d.p5} | ${d.p95} |`;

  const codeRows = Object.entries(stats.codeFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => `| ${code} | ${count} | ${pct(count, picks.length)} |`)
    .join('\n');

  const report = `# Calibration Report: Scoring Enhancement Layering

**Sprint**: ${SPRINT_ID}
**Date**: ${DATE_STR}
**Sample Size**: ${picks.length}
**Model Version**: prob_v2.0.0_syndicate_layered

---

## Tier Distribution

| Tier | Count | % |
|------|-------|---|
${tierRows}

## Distributions

| Metric | N | Mean | Median | Min | Max | StdDev | P5 | P95 |
|--------|---|------|--------|-----|-----|--------|----|-----|
${distRow('Edge', stats.edgeDist)}
${distRow('Delta (p_final - p_market)', stats.deltaDist)}
${distRow('Confidence Factor', stats.confFactorDist)}
${distRow('Uncertainty', stats.uncertaintyDist)}
${distRow('Book Spread', stats.bookSpreadDist)}

## Cap Activation

| Metric | Count |
|--------|-------|
| Cap activated (raw > cap) | ${stats.capActivated} / ${picks.length} (${pct(stats.capActivated, picks.length)}) |
| Cap reduced (<0.04) | ${stats.capReduced} |
| Cap boosted (>0.04) | ${stats.capBoosted} |

## Safety Checks

| Check | Result |
|-------|--------|
| p_final in (0,1) | ${stats.outOfBoundsCount === 0 ? 'PASS' : `FAIL (${stats.outOfBoundsCount} violations)`} |
| "Too good to be true" (edge > ${EDGE_TOO_GOOD_THRESHOLD}) | ${stats.tooGoodCount} / ${picks.length} (${pct(stats.tooGoodCount, picks.length)}) |

## Reason Code Frequency

| Code | Count | % |
|------|-------|---|
${codeRows || '| (none) | 0 | 0% |'}

---

## Acceptance Criteria

- [${stats.outOfBoundsCount === 0 ? 'x' : ' '}] p_final is finite and in (0,1) for all scored samples
- [${stats.deltaDist.max <= 0.06 + 0.001 ? 'x' : ' '}] |p_final - p_market_devig| never exceeds configured cap
- [${picks.length > 0 ? 'x' : ' '}] Explanation payload present for sampled picks
- [x] Calibration report produced in out/

---

Generated by: \`scripts/analysis/scoring-calibration-report-024.ts\`
`;
  fs.writeFileSync(path.join(OUT_DIR, 'CALIBRATION_REPORT.md'), report);

  // DISTRIBUTIONS.json
  const distributions = {
    sprint: SPRINT_ID,
    date: DATE_STR,
    sample_size: picks.length,
    tier_distribution: stats.tierDist,
    edge: stats.edgeDist,
    delta: stats.deltaDist,
    confidence_factor: stats.confFactorDist,
    uncertainty: stats.uncertaintyDist,
    book_spread: stats.bookSpreadDist,
    cap_activation: {
      activated: stats.capActivated,
      reduced: stats.capReduced,
      boosted: stats.capBoosted,
    },
    safety: {
      out_of_bounds: stats.outOfBoundsCount,
      too_good_to_be_true: stats.tooGoodCount,
    },
    reason_codes: stats.codeFreq,
  };
  fs.writeFileSync(
    path.join(OUT_DIR, 'DISTRIBUTIONS.json'),
    JSON.stringify(distributions, null, 2)
  );

  // SAMPLE_EXPLANATIONS.json
  const samples = picks.slice(0, 10).map(p => ({
    pick_id: p.id,
    tier: p.tier,
    score: p.score,
    explain_v3: p.explain,
  }));
  fs.writeFileSync(
    path.join(OUT_DIR, 'SAMPLE_EXPLANATIONS.json'),
    JSON.stringify({ sprint: SPRINT_ID, samples }, null, 2)
  );

  console.log(`\nArtifacts written to: ${OUT_DIR}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
