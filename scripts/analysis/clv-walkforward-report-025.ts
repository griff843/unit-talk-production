#!/usr/bin/env tsx
/**
 * CLV Walk-Forward Baseline Report
 * Sprint: SPRINT-025-CLV-CLOSING-SNAPSHOT
 *
 * Queries clv_results joined with unified_picks to produce:
 * - CLV distribution by tier
 * - Coverage: % of picks with close data vs total scored picks
 * - Reason code breakdown
 * - Edge vs CLV correlation
 * - Tier truth table
 *
 * Usage:
 *   npx tsx scripts/analysis/clv-walkforward-report-025.ts
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

const SPRINT_ID = 'SPRINT-025-CLV-CLOSING-SNAPSHOT';
const DATE_STR = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, `../../out/sprints/${SPRINT_ID}/${DATE_STR}`);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CLVRow {
  pick_id: string;
  clv_prob: number;
  reason_code: string | null;
  book_count: number;
  p_entry_market_devig: number | null;
  p_close_market_devig: number | null;
  close_kind: string;
  model_version: string;
}

interface PickMeta {
  id: string;
  tier: string | null;
  meta: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Statistics helpers
// ---------------------------------------------------------------------------

function computeStats(values: number[]): {
  count: number;
  mean: number;
  median: number;
  stddev: number;
  min: number;
  max: number;
} {
  if (values.length === 0) {
    return { count: 0, mean: 0, median: 0, stddev: 0, min: 0, max: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;

  return {
    count: values.length,
    mean: parseFloat(mean.toFixed(6)),
    median: parseFloat(sorted[Math.floor(sorted.length / 2)].toFixed(6)),
    stddev: parseFloat(Math.sqrt(variance).toFixed(6)),
    min: parseFloat(sorted[0].toFixed(6)),
    max: parseFloat(sorted[sorted.length - 1].toFixed(6)),
  };
}

function pearsonR(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : parseFloat((num / den).toFixed(6));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\n=== CLV Walk-Forward Report — ${SPRINT_ID} ===\n`);

  // Fetch CLV results
  const { data: clvData, error: clvErr } = await supabase
    .from('clv_results')
    .select(
      'pick_id, clv_prob, reason_code, book_count, p_entry_market_devig, p_close_market_devig, close_kind, model_version'
    )
    .order('computed_at', { ascending: false })
    .limit(2000);

  if (clvErr) {
    console.error('Failed to fetch CLV results:', clvErr.message);
    process.exit(1);
  }

  const clvRows = (clvData ?? []) as CLVRow[];
  console.log(`CLV results fetched: ${clvRows.length}`);

  if (clvRows.length === 0) {
    console.warn('No CLV results found. Run compute-clv-025.ts first.');
    writeReport('No CLV results found.', []);
    process.exit(0);
  }

  // Fetch pick metadata (tier, edge)
  const pickIds = [...new Set(clvRows.map(r => r.pick_id))];
  const pickMeta = await fetchPickMeta(pickIds);

  // --- Section 1: Reason code breakdown ---
  const reasonCounts: Record<string, number> = {};
  for (const r of clvRows) {
    const code = r.reason_code ?? 'SUCCESS';
    reasonCounts[code] = (reasonCounts[code] || 0) + 1;
  }

  console.log('--- Reason Code Breakdown ---');
  for (const [code, count] of Object.entries(reasonCounts).sort()) {
    console.log(`  ${code.padEnd(25)} ${count} (${((count / clvRows.length) * 100).toFixed(1)}%)`);
  }

  // --- Section 2: Coverage ---
  const totalScored = pickIds.length;
  const successCount = reasonCounts['SUCCESS'] || 0;
  const coverage = totalScored > 0 ? (successCount / totalScored) * 100 : 0;
  console.log(`\n--- Coverage ---`);
  console.log(`  Total picks with CLV: ${totalScored}`);
  console.log(`  Successful CLV:       ${successCount}`);
  console.log(`  Coverage:             ${coverage.toFixed(1)}%`);

  // --- Section 3: CLV distribution by tier ---
  const successful = clvRows.filter(r => !r.reason_code);
  const tierGroups: Record<string, number[]> = {};

  for (const r of successful) {
    const meta = pickMeta.get(r.pick_id);
    const tier = meta?.tier ?? 'UNKNOWN';
    if (!tierGroups[tier]) tierGroups[tier] = [];
    tierGroups[tier].push(r.clv_prob);
  }

  console.log(`\n--- CLV by Tier (Tier Truth Table) ---`);
  console.log(
    '  ' +
      'Tier'.padEnd(10) +
      'Count'.padEnd(8) +
      'Mean'.padEnd(12) +
      'Median'.padEnd(12) +
      'StdDev'.padEnd(12) +
      'Min'.padEnd(12) +
      'Max'
  );
  const tierOrder = ['S', 'A', 'B', 'C', 'D', 'UNKNOWN'];
  for (const tier of tierOrder) {
    const values = tierGroups[tier];
    if (!values || values.length === 0) continue;
    const stats = computeStats(values);
    console.log(
      '  ' +
        tier.padEnd(10) +
        String(stats.count).padEnd(8) +
        stats.mean.toFixed(6).padEnd(12) +
        stats.median.toFixed(6).padEnd(12) +
        stats.stddev.toFixed(6).padEnd(12) +
        stats.min.toFixed(6).padEnd(12) +
        stats.max.toFixed(6)
    );
  }

  // --- Section 4: Edge vs CLV correlation ---
  const edgeClvPairs: Array<{ edge: number; clv: number }> = [];
  for (const r of successful) {
    const meta = pickMeta.get(r.pick_id);
    if (!meta?.meta) continue;

    const explainV3 = meta.meta['explain_v3'] as Record<string, unknown> | undefined;
    const shadowV3 = meta.meta['shadow_v3'] as Record<string, unknown> | undefined;
    const edgeFinal =
      (explainV3?.['edge_final'] as number | undefined) ??
      (shadowV3?.['edge_final'] as number | undefined);

    if (typeof edgeFinal === 'number') {
      edgeClvPairs.push({ edge: edgeFinal, clv: r.clv_prob });
    }
  }

  let correlation = 0;
  if (edgeClvPairs.length >= 3) {
    correlation = pearsonR(
      edgeClvPairs.map(p => p.edge),
      edgeClvPairs.map(p => p.clv)
    );
  }

  console.log(`\n--- Edge vs CLV Correlation ---`);
  console.log(`  Pairs:       ${edgeClvPairs.length}`);
  console.log(`  Pearson r:   ${correlation.toFixed(6)}`);

  // --- Section 5: Overall CLV distribution ---
  const allClvValues = successful.map(r => r.clv_prob);
  const overallStats = computeStats(allClvValues);
  console.log(`\n--- Overall CLV Distribution ---`);
  console.log(`  Count:   ${overallStats.count}`);
  console.log(`  Mean:    ${overallStats.mean}`);
  console.log(`  Median:  ${overallStats.median}`);
  console.log(`  StdDev:  ${overallStats.stddev}`);
  console.log(`  Min:     ${overallStats.min}`);
  console.log(`  Max:     ${overallStats.max}`);

  // Write report
  writeReport(
    buildMarkdownReport({
      clvRows,
      reasonCounts,
      coverage,
      successCount,
      totalScored,
      tierGroups,
      overallStats,
      correlation,
      edgeClvPairs: edgeClvPairs.length,
    }),
    successful.slice(0, 20)
  );

  console.log(`\nArtifacts written to: ${OUT_DIR}/`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Pick metadata fetch
// ---------------------------------------------------------------------------

async function fetchPickMeta(pickIds: string[]): Promise<Map<string, PickMeta>> {
  const map = new Map<string, PickMeta>();
  if (pickIds.length === 0) return map;

  // Batch fetch in chunks of 100
  for (let i = 0; i < pickIds.length; i += 100) {
    const batch = pickIds.slice(i, i + 100);
    const { data, error } = await supabase
      .from('unified_picks')
      .select('id, tier, meta')
      .in('id', batch);

    if (error || !data) continue;

    for (const row of data as PickMeta[]) {
      map.set(row.id, row);
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Report writer
// ---------------------------------------------------------------------------

interface ReportData {
  clvRows: CLVRow[];
  reasonCounts: Record<string, number>;
  coverage: number;
  successCount: number;
  totalScored: number;
  tierGroups: Record<string, number[]>;
  overallStats: ReturnType<typeof computeStats>;
  correlation: number;
  edgeClvPairs: number;
}

function buildMarkdownReport(data: ReportData): string {
  const lines: string[] = [];
  lines.push('# CLV Walk-Forward Baseline Report');
  lines.push(`\n**Sprint**: ${SPRINT_ID}`);
  lines.push(`**Date**: ${DATE_STR}`);
  lines.push(`**Total CLV Results**: ${data.clvRows.length}`);

  lines.push('\n## Coverage');
  lines.push(`- Total picks with CLV: ${data.totalScored}`);
  lines.push(`- Successful CLV: ${data.successCount}`);
  lines.push(`- Coverage: ${data.coverage.toFixed(1)}%`);

  lines.push('\n## Reason Code Breakdown');
  lines.push('| Code | Count | % |');
  lines.push('|------|-------|---|');
  for (const [code, count] of Object.entries(data.reasonCounts).sort()) {
    lines.push(`| ${code} | ${count} | ${((count / data.clvRows.length) * 100).toFixed(1)}% |`);
  }

  lines.push('\n## CLV by Tier (Tier Truth Table)');
  lines.push('| Tier | Count | Mean | Median | StdDev | Min | Max |');
  lines.push('|------|-------|------|--------|--------|-----|-----|');
  const tierOrder = ['S', 'A', 'B', 'C', 'D', 'UNKNOWN'];
  for (const tier of tierOrder) {
    const values = data.tierGroups[tier];
    if (!values || values.length === 0) continue;
    const stats = computeStats(values);
    lines.push(
      `| ${tier} | ${stats.count} | ${stats.mean} | ${stats.median} | ${stats.stddev} | ${stats.min} | ${stats.max} |`
    );
  }

  lines.push('\n## Edge vs CLV Correlation');
  lines.push(`- Pairs: ${data.edgeClvPairs}`);
  lines.push(`- Pearson r: ${data.correlation}`);

  lines.push('\n## Overall CLV Distribution');
  lines.push(`- Count: ${data.overallStats.count}`);
  lines.push(`- Mean: ${data.overallStats.mean}`);
  lines.push(`- Median: ${data.overallStats.median}`);
  lines.push(`- StdDev: ${data.overallStats.stddev}`);
  lines.push(`- Min: ${data.overallStats.min}`);
  lines.push(`- Max: ${data.overallStats.max}`);

  return lines.join('\n');
}

function writeReport(reportMd: string, sampleResults: CLVRow[]): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  fs.writeFileSync(path.join(OUT_DIR, 'CLV_REPORT.md'), reportMd);
  fs.writeFileSync(
    path.join(OUT_DIR, 'CLV_WALKFORWARD_SAMPLE.json'),
    JSON.stringify(
      {
        sprint: SPRINT_ID,
        timestamp: new Date().toISOString(),
        sample: sampleResults,
      },
      null,
      2
    )
  );
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
