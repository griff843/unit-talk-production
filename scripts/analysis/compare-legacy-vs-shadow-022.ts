#!/usr/bin/env tsx
/**
 * Legacy vs Shadow Scoring Comparison
 * Sprint: SPRINT-022-V3-SHADOW-SCORING
 *
 * Selects recent legacy-scored picks (raw_props pipeline) and shadow-scored
 * markets, then compares distributions of tier, edge, and confidence.
 *
 * Usage:
 *   npx tsx scripts/analysis/compare-legacy-vs-shadow-022.ts
 *
 * Prerequisite: Run run-shadow-scoring-022.ts first to populate shadow_v3 data.
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

const SPRINT_ID = 'SPRINT-022-V3-SHADOW-SCORING';
const DATE_STR = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, `../../out/sprints/${SPRINT_ID}/${DATE_STR}`);

const SAMPLE_SIZE = parseInt(process.env['SAMPLE_SIZE'] || '100', 10);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LegacyPick {
  id: string;
  tier: string | null;
  score: number | null;
  confidence: number | null;
  p_final: number | null;
  edge_final: number | null;
  uncertainty: number | null;
  promotion_band: string | null;
  model_version: string | null;
}

interface ShadowPick {
  id: string;
  legacy_tier: string | null;
  legacy_score: number | null;
  legacy_confidence: number | null;
  shadow: {
    tier_shadow: string;
    score_shadow: number;
    confidence_shadow: number;
    p_market_devig: number;
    p_final: number;
    edge_final: number;
    uncertainty_final: number;
    book_count: number;
    model_version_shadow: string;
  };
}

interface Distribution {
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stddev: number;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\n=== Legacy vs Shadow Comparison — ${SPRINT_ID} ===\n`);

  // Step 1: Fetch legacy-scored picks (recent, with scores)
  const { data: legacyRaw, error: legErr } = await supabase
    .from('unified_picks')
    .select(
      'id, tier, score, confidence, p_final, edge_final, uncertainty, promotion_band, model_version'
    )
    .not('score', 'is', null)
    .order('created_at', { ascending: false })
    .limit(SAMPLE_SIZE);

  if (legErr) {
    console.error('[FATAL] Cannot fetch legacy picks:', legErr.message);
    process.exit(1);
  }

  const legacyPicks: LegacyPick[] = (legacyRaw ?? []) as LegacyPick[];
  console.log(`Legacy scored picks: ${legacyPicks.length}`);

  // Step 2: Fetch picks with shadow_v3 data in meta
  const { data: shadowRaw, error: shadowErr } = await supabase
    .from('unified_picks')
    .select('id, tier, score, confidence, meta')
    .not('meta->shadow_v3', 'is', null)
    .order('created_at', { ascending: false })
    .limit(SAMPLE_SIZE);

  if (shadowErr) {
    console.error('[FATAL] Cannot fetch shadow picks:', shadowErr.message);
    process.exit(1);
  }

  const shadowPicks: ShadowPick[] = (
    (shadowRaw ?? []) as Array<{
      id: string;
      tier: string | null;
      score: number | null;
      confidence: number | null;
      meta: Record<string, unknown>;
    }>
  )
    .filter(p => p.meta?.['shadow_v3'])
    .map(p => {
      const sv = p.meta['shadow_v3'] as Record<string, unknown>;
      return {
        id: p.id,
        legacy_tier: p.tier,
        legacy_score: p.score,
        legacy_confidence: p.confidence,
        shadow: {
          tier_shadow: String(sv['tier_shadow'] ?? 'D'),
          score_shadow: Number(sv['score_shadow'] ?? 0),
          confidence_shadow: Number(sv['confidence_shadow'] ?? 0),
          p_market_devig: Number(sv['p_market_devig'] ?? 0),
          p_final: Number(sv['p_final'] ?? 0),
          edge_final: Number(sv['edge_final'] ?? 0),
          uncertainty_final: Number(sv['uncertainty_final'] ?? 0),
          book_count: Number(sv['book_count'] ?? 0),
          model_version_shadow: String(sv['model_version_shadow'] ?? ''),
        },
      };
    });

  console.log(`Shadow scored picks: ${shadowPicks.length}`);

  // Also load from SHADOW_SCORES_SAMPLE.json if available (for offline comparison)
  const shadowSamplePath = path.join(OUT_DIR, 'SHADOW_SCORES_SAMPLE.json');
  let offlineShadowScores: Array<Record<string, unknown>> = [];
  if (fs.existsSync(shadowSamplePath)) {
    const raw = JSON.parse(fs.readFileSync(shadowSamplePath, 'utf-8'));
    offlineShadowScores = raw.scores ?? [];
    console.log(`Offline shadow scores (from file): ${offlineShadowScores.length}`);
  }

  // Step 3: Compute distributions
  console.log(`\n--- Legacy Tier Distribution ---`);
  const legacyTierDist = tierDistribution(legacyPicks.map(p => p.tier));
  printTierDist(legacyTierDist);

  console.log(`\n--- Shadow Tier Distribution (from DB meta) ---`);
  const shadowTierDist = tierDistribution(shadowPicks.map(p => p.shadow.tier_shadow));
  printTierDist(shadowTierDist);

  if (offlineShadowScores.length > 0) {
    console.log(`\n--- Shadow Tier Distribution (from file) ---`);
    const fileTierDist = tierDistribution(
      offlineShadowScores.map(s => String(s['tier_shadow'] ?? 'D'))
    );
    printTierDist(fileTierDist);
  }

  // Step 4: Score distributions
  console.log(`\n--- Score Distributions ---`);
  const legacyScores = legacyPicks.map(p => p.score).filter((s): s is number => s != null);
  const shadowScores = shadowPicks.map(p => p.shadow.score_shadow);
  const fileScores = offlineShadowScores.map(s => Number(s['score_shadow'] ?? 0));

  console.log('  Legacy scores:', formatDist(computeDist(legacyScores)));
  if (shadowScores.length > 0) {
    console.log('  Shadow scores (DB):', formatDist(computeDist(shadowScores)));
  }
  if (fileScores.length > 0) {
    console.log('  Shadow scores (file):', formatDist(computeDist(fileScores)));
  }

  // Step 5: Edge distributions
  console.log(`\n--- Edge Distributions ---`);
  const legacyEdges = legacyPicks.map(p => p.edge_final).filter((e): e is number => e != null);
  const shadowEdges = shadowPicks.map(p => p.shadow.edge_final);
  const fileEdges = offlineShadowScores.map(s => Number(s['edge_final'] ?? 0));

  console.log('  Legacy edges:', formatDist(computeDist(legacyEdges)));
  if (shadowEdges.length > 0) {
    console.log('  Shadow edges (DB):', formatDist(computeDist(shadowEdges)));
  }
  if (fileEdges.length > 0) {
    console.log('  Shadow edges (file):', formatDist(computeDist(fileEdges)));
  }

  // Step 6: Confidence distributions
  console.log(`\n--- Confidence Distributions ---`);
  const legacyConf = legacyPicks.map(p => p.confidence).filter((c): c is number => c != null);
  const shadowConf = shadowPicks.map(p => p.shadow.confidence_shadow);

  console.log('  Legacy confidence:', formatDist(computeDist(legacyConf)));
  if (shadowConf.length > 0) {
    console.log('  Shadow confidence:', formatDist(computeDist(shadowConf)));
  }

  // Step 7: Head-to-head comparison (picks with both legacy and shadow)
  console.log(`\n--- Head-to-Head (picks with both scores) ---`);
  const h2hCount = shadowPicks.filter(p => p.legacy_score != null).length;
  console.log(`  Picks with both legacy + shadow: ${h2hCount}`);

  if (h2hCount > 0) {
    const tierMismatches = shadowPicks.filter(
      p => p.legacy_tier != null && p.legacy_tier !== p.shadow.tier_shadow
    ).length;
    console.log(
      `  Tier mismatches: ${tierMismatches} / ${h2hCount} (${((tierMismatches / h2hCount) * 100).toFixed(1)}%)`
    );

    const scoreDiffs = shadowPicks
      .filter(p => p.legacy_score != null)
      .map(p => p.shadow.score_shadow - (p.legacy_score ?? 0));
    console.log(`  Score diff (shadow - legacy):`, formatDist(computeDist(scoreDiffs)));
  }

  // Step 8: Write comparison report
  writeReport({
    legacyCount: legacyPicks.length,
    shadowDbCount: shadowPicks.length,
    shadowFileCount: offlineShadowScores.length,
    legacyTierDist,
    shadowTierDist,
    legacyScoreDist: computeDist(legacyScores),
    shadowScoreDist: computeDist(shadowScores.length > 0 ? shadowScores : fileScores),
    legacyEdgeDist: computeDist(legacyEdges),
    shadowEdgeDist: computeDist(shadowEdges.length > 0 ? shadowEdges : fileEdges),
    legacyConfDist: computeDist(legacyConf),
    shadowConfDist: computeDist(shadowConf),
    h2hCount,
  });

  console.log(`\n=== Comparison complete ===`);
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
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
    console.log(`  ${tier}: ${count} (${pct}%)`);
  }
}

function computeDist(values: number[]): Distribution {
  if (values.length === 0) {
    return { count: 0, mean: 0, median: 0, min: 0, max: 0, stddev: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;

  return {
    count: n,
    mean: Math.round(mean * 1000) / 1000,
    median: Math.round(median * 1000) / 1000,
    min: Math.round(sorted[0] * 1000) / 1000,
    max: Math.round(sorted[n - 1] * 1000) / 1000,
    stddev: Math.round(Math.sqrt(variance) * 1000) / 1000,
  };
}

function formatDist(d: Distribution): string {
  if (d.count === 0) return 'n=0 (no data)';
  return `n=${d.count} mean=${d.mean} median=${d.median} min=${d.min} max=${d.max} sd=${d.stddev}`;
}

// ---------------------------------------------------------------------------
// Report writer
// ---------------------------------------------------------------------------

function writeReport(data: {
  legacyCount: number;
  shadowDbCount: number;
  shadowFileCount: number;
  legacyTierDist: Record<string, number>;
  shadowTierDist: Record<string, number>;
  legacyScoreDist: Distribution;
  shadowScoreDist: Distribution;
  legacyEdgeDist: Distribution;
  shadowEdgeDist: Distribution;
  legacyConfDist: Distribution;
  shadowConfDist: Distribution;
  h2hCount: number;
}): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const tierRows = (dist: Record<string, number>): string => {
    const total = Object.values(dist).reduce((s, n) => s + n, 0);
    return Object.entries(dist)
      .sort()
      .map(
        ([tier, count]) =>
          `| ${tier} | ${count} | ${total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'}% |`
      )
      .join('\n');
  };

  const distRow = (label: string, d: Distribution): string =>
    `| ${label} | ${d.count} | ${d.mean} | ${d.median} | ${d.min} | ${d.max} | ${d.stddev} |`;

  const report = `# Comparison Report: Legacy vs Shadow Scoring

**Sprint**: ${SPRINT_ID}
**Date**: ${DATE_STR}

---

## Sample Sizes

| Source | Count |
|--------|-------|
| Legacy scored picks | ${data.legacyCount} |
| Shadow scored (DB meta) | ${data.shadowDbCount} |
| Shadow scored (file) | ${data.shadowFileCount} |
| Head-to-head | ${data.h2hCount} |

## Tier Distribution

### Legacy
| Tier | Count | % |
|------|-------|---|
${tierRows(data.legacyTierDist)}

### Shadow
| Tier | Count | % |
|------|-------|---|
${tierRows(data.shadowTierDist)}

## Score Distribution

| Source | N | Mean | Median | Min | Max | StdDev |
|--------|---|------|--------|-----|-----|--------|
${distRow('Legacy', data.legacyScoreDist)}
${distRow('Shadow', data.shadowScoreDist)}

## Edge Distribution

| Source | N | Mean | Median | Min | Max | StdDev |
|--------|---|------|--------|-----|-----|--------|
${distRow('Legacy', data.legacyEdgeDist)}
${distRow('Shadow', data.shadowEdgeDist)}

## Confidence Distribution

| Source | N | Mean | Median | Min | Max | StdDev |
|--------|---|------|--------|-----|-----|--------|
${distRow('Legacy', data.legacyConfDist)}
${distRow('Shadow', data.shadowConfDist)}

---

## Observations

- Shadow scoring uses provider_offers (multi-book consensus) as its data source
- Legacy scoring uses raw_props (often single-book) as its data source
- Shadow uses market-anchored confidence (delta = 0, neutral) for all picks
- Differences in tier distribution reflect the impact of multi-book consensus vs single-book devig

## Gate Status

Shadow scoring pipeline is ${data.shadowDbCount + data.shadowFileCount > 0 ? 'OPERATIONAL' : 'NOT YET POPULATED'}.

---

Generated by: \`scripts/analysis/compare-legacy-vs-shadow-022.ts\`
`;

  fs.writeFileSync(path.join(OUT_DIR, 'COMPARISON_REPORT.md'), report);
  console.log(`\nReport written to: ${OUT_DIR}/COMPARISON_REPORT.md`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
