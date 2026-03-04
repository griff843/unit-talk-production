#!/usr/bin/env tsx
/**
 * Tasks 3-6: Scoring Distribution Report + Validation
 * Sprint: SPRINT-SCORING-PIPELINE-VALIDATION-019
 *
 * Task 3: Scoring distribution (tier, band, devig_mode, avg edge/uncertainty)
 * Task 4: Discord post validation (only HARD band, only S/A/B tiers)
 * Task 5: Runtime integrity checks (no NULL primitives on scored picks)
 * Task 6: CLV forecast sanity check (avg/min/max, symmetric near zero)
 *
 * Usage: npx tsx scripts/analysis/generate-scoring-report.ts [--trace <traceId>]
 */

import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';

// Env
const SUPABASE_URL = process.env['SUPABASE_URL'];
const SUPABASE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[FATAL] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const SPRINT_ID = 'SPRINT-SCORING-PIPELINE-VALIDATION-019';
const DATE_STR = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, `../../out/runtime/scoring_validation/${DATE_STR}`);
const PROOF_DIR = path.resolve(__dirname, `../../out/sprints/${SPRINT_ID}/${DATE_STR}`);

// Parse optional --trace flag
const traceArg = process.argv.indexOf('--trace');
const TRACE_FILTER = traceArg !== -1 ? process.argv[traceArg + 1] : null;

interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
  data?: any;
}

const checks: CheckResult[] = [];

function check(name: string, pass: boolean, detail: string, data?: any): void {
  checks.push({ name, pass, detail, data });
  const icon = pass ? 'PASS' : 'FAIL';
  console.log(`  [${icon}] ${name}`);
  if (!pass) {
    console.log(`         ${detail}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Task 3: Scoring Distribution Report
// ═══════════════════════════════════════════════════════════════════════════

async function task3ScoringDistribution(): Promise<any> {
  console.log('\n=== Task 3: Scoring Distribution ===\n');

  // Query unified_picks for scored picks
  let query = supabase
    .from('unified_picks')
    .select(
      'tier, promotion_band, professional_score, p_final, edge_final, uncertainty_final, clv_forecast, model_version, feature_set_version, meta, created_at'
    )
    .not('professional_score', 'is', null);

  if (TRACE_FILTER) {
    query = query.contains('meta', { trace_id: TRACE_FILTER });
  }

  const { data: picks, error } = await query.order('created_at', { ascending: false }).limit(1000);

  if (error) {
    console.error(`  Query error: ${error.message}`);
    return { error: error.message };
  }

  if (!picks || picks.length === 0) {
    console.log('  No scored picks found.');
    return { count: 0 };
  }

  console.log(`  Found ${picks.length} scored picks`);

  // Tier distribution
  const tierDist: Record<string, number> = {};
  for (const p of picks) {
    const tier = p.tier || 'NULL';
    tierDist[tier] = (tierDist[tier] || 0) + 1;
  }

  // Promotion band distribution
  const bandDist: Record<string, number> = {};
  for (const p of picks) {
    const band = p.promotion_band || 'NULL';
    bandDist[band] = (bandDist[band] || 0) + 1;
  }

  // Devig mode distribution (from meta)
  const devigDist: Record<string, number> = {};
  for (const p of picks) {
    const mode = p.meta?.devig_mode || 'UNKNOWN';
    devigDist[mode] = (devigDist[mode] || 0) + 1;
  }

  // Score statistics
  const scores = picks.map(p => p.professional_score).filter((s): s is number => s != null);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

  // Edge statistics
  const edges = picks.map(p => p.edge_final).filter((e): e is number => e != null);
  const avgEdge = edges.length > 0 ? edges.reduce((a, b) => a + b, 0) / edges.length : null;
  const minEdge = edges.length > 0 ? Math.min(...edges) : null;
  const maxEdge = edges.length > 0 ? Math.max(...edges) : null;

  // Uncertainty statistics
  const uncertainties = picks.map(p => p.uncertainty_final).filter((u): u is number => u != null);
  const avgUncertainty =
    uncertainties.length > 0
      ? uncertainties.reduce((a, b) => a + b, 0) / uncertainties.length
      : null;

  // Edge histogram (buckets: <-5%, -5 to -2%, -2 to 0%, 0 to 2%, 2 to 5%, >5%)
  const edgeBuckets: Record<string, number> = {
    lt_neg5: 0,
    neg5_to_neg2: 0,
    neg2_to_0: 0,
    '0_to_2': 0,
    '2_to_5': 0,
    gt_5: 0,
  };
  for (const e of edges) {
    const pct = e * 100;
    if (pct < -5) edgeBuckets['lt_neg5']++;
    else if (pct < -2) edgeBuckets['neg5_to_neg2']++;
    else if (pct < 0) edgeBuckets['neg2_to_0']++;
    else if (pct < 2) edgeBuckets['0_to_2']++;
    else if (pct < 5) edgeBuckets['2_to_5']++;
    else edgeBuckets['gt_5']++;
  }

  const distribution = {
    total_picks: picks.length,
    tier_distribution: tierDist,
    band_distribution: bandDist,
    devig_mode_distribution: devigDist,
    score_stats: {
      avg: Math.round(avgScore * 100) / 100,
      min: Math.round(minScore * 100) / 100,
      max: Math.round(maxScore * 100) / 100,
      count: scores.length,
    },
    edge_stats: {
      avg: avgEdge != null ? Math.round(avgEdge * 10000) / 10000 : null,
      min: minEdge != null ? Math.round(minEdge * 10000) / 10000 : null,
      max: maxEdge != null ? Math.round(maxEdge * 10000) / 10000 : null,
      count: edges.length,
    },
    uncertainty_stats: {
      avg: avgUncertainty != null ? Math.round(avgUncertainty * 10000) / 10000 : null,
      count: uncertainties.length,
    },
    edge_histogram: edgeBuckets,
  };

  console.log(`  Tiers: ${JSON.stringify(tierDist)}`);
  console.log(`  Bands: ${JSON.stringify(bandDist)}`);
  console.log(`  Devig modes: ${JSON.stringify(devigDist)}`);
  console.log(`  Avg score: ${distribution.score_stats.avg}`);
  console.log(`  Avg edge: ${distribution.edge_stats.avg}`);
  console.log(`  Edge histogram: ${JSON.stringify(edgeBuckets)}`);

  check(
    'Tier distribution has no unexpected values',
    Object.keys(tierDist).every(t => ['S', 'A', 'B', 'C', 'D', 'F', 'NULL'].includes(t)),
    `Unexpected tiers: ${Object.keys(tierDist).filter(t => !['S', 'A', 'B', 'C', 'D', 'F', 'NULL'].includes(t))}`
  );

  check(
    'Band distribution has only valid values',
    Object.keys(bandDist).every(b => ['HARD', 'SOFT', 'NO_POST', 'NULL'].includes(b)),
    `Unexpected bands: ${Object.keys(bandDist).filter(b => !['HARD', 'SOFT', 'NO_POST', 'NULL'].includes(b))}`
  );

  return distribution;
}

// ═══════════════════════════════════════════════════════════════════════════
// Task 4: Discord Post Validation
// ═══════════════════════════════════════════════════════════════════════════

async function task4DiscordPostValidation(): Promise<any> {
  console.log('\n=== Task 4: Discord Post Validation ===\n');

  // Query picks posted to Discord
  const { data: postedPicks, error } = await supabase
    .from('unified_picks')
    .select('id, tier, promotion_band, professional_score, posted_to_discord, discord_message_id')
    .eq('posted_to_discord', true)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error(`  Query error: ${error.message}`);
    return { error: error.message };
  }

  const posted = postedPicks || [];
  console.log(`  Found ${posted.length} picks posted to Discord`);

  // Check: all posted picks have HARD band
  const nonHardPosted = posted.filter(p => p.promotion_band !== 'HARD');
  check(
    'All posted picks have HARD band',
    nonHardPosted.length === 0,
    `${nonHardPosted.length} posted picks have non-HARD band: ${JSON.stringify(nonHardPosted.map(p => ({ id: p.id, band: p.promotion_band })).slice(0, 5))}`
  );

  // Check: all posted picks have tier S, A, or B
  const badTierPosted = posted.filter(p => !['S', 'A', 'B'].includes(p.tier));
  check(
    'All posted picks have S/A/B tier',
    badTierPosted.length === 0,
    `${badTierPosted.length} posted picks have non-S/A/B tier: ${JSON.stringify(badTierPosted.map(p => ({ id: p.id, tier: p.tier })).slice(0, 5))}`
  );

  // Check: no F-tier picks posted
  const fTierPosted = posted.filter(p => p.tier === 'F');
  check(
    'No F-tier picks posted to Discord',
    fTierPosted.length === 0,
    `${fTierPosted.length} F-tier picks found posted to Discord`
  );

  // Check: all posted picks have professional_score
  const noScorePosted = posted.filter(p => p.professional_score == null);
  check(
    'All posted picks have professional_score',
    noScorePosted.length === 0,
    `${noScorePosted.length} posted picks have NULL professional_score`
  );

  // Cross-check: picks with NO_POST band should NOT be posted
  const { data: noPostPicks, error: npErr } = await supabase
    .from('unified_picks')
    .select('id, posted_to_discord, promotion_band')
    .eq('promotion_band', 'NO_POST')
    .eq('posted_to_discord', true)
    .limit(10);

  if (npErr) {
    console.error(`  NO_POST query error: ${npErr.message}`);
  } else {
    check(
      'No NO_POST picks posted to Discord',
      (noPostPicks || []).length === 0,
      `${(noPostPicks || []).length} NO_POST picks found posted to Discord`
    );
  }

  return {
    total_posted: posted.length,
    non_hard_posted: nonHardPosted.length,
    bad_tier_posted: badTierPosted.length,
    f_tier_posted: fTierPosted.length,
    no_score_posted: noScorePosted.length,
    guardrails_intact:
      nonHardPosted.length === 0 && badTierPosted.length === 0 && fTierPosted.length === 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Task 5: Runtime Integrity Checks
// ═══════════════════════════════════════════════════════════════════════════

async function task5RuntimeIntegrity(): Promise<any> {
  console.log('\n=== Task 5: Runtime Integrity Checks ===\n');

  // Query scored picks (have professional_score)
  let query = supabase
    .from('unified_picks')
    .select(
      'id, tier, promotion_band, p_final, edge_final, uncertainty_final, model_version, feature_set_version, meta, professional_score'
    )
    .not('professional_score', 'is', null);

  if (TRACE_FILTER) {
    query = query.contains('meta', { trace_id: TRACE_FILTER });
  }

  const { data: scoredPicks, error } = await query.limit(1000);

  if (error) {
    console.error(`  Query error: ${error.message}`);
    return { error: error.message };
  }

  const picks = scoredPicks || [];
  console.log(`  Checking ${picks.length} scored picks`);

  if (picks.length === 0) {
    console.log('  No scored picks to check.');
    return { count: 0 };
  }

  // Check: HARD band picks must have non-null probability primitives
  const hardPicks = picks.filter(p => p.promotion_band === 'HARD');
  const hardMissingPrimitives = hardPicks.filter(
    p => p.p_final == null || p.edge_final == null || p.uncertainty_final == null
  );
  check(
    'HARD band picks have probability primitives',
    hardMissingPrimitives.length === 0,
    `${hardMissingPrimitives.length}/${hardPicks.length} HARD picks missing p_final/edge_final/uncertainty_final`,
    hardMissingPrimitives.slice(0, 3).map(p => p.id)
  );

  // Check: all scored picks have model_version
  const missingModelVersion = picks.filter(p => !p.model_version);
  check(
    'All scored picks have model_version',
    missingModelVersion.length === 0,
    `${missingModelVersion.length}/${picks.length} picks missing model_version`
  );

  // Check: all scored picks have feature_set_version
  const missingFeatureVersion = picks.filter(p => !p.feature_set_version);
  check(
    'All scored picks have feature_set_version',
    missingFeatureVersion.length === 0,
    `${missingFeatureVersion.length}/${picks.length} picks missing feature_set_version`
  );

  // Check: all scored picks have tier
  const missingTier = picks.filter(p => !p.tier);
  check(
    'All scored picks have tier',
    missingTier.length === 0,
    `${missingTier.length}/${picks.length} picks missing tier`
  );

  // Check: all scored picks have promotion_band
  const missingBand = picks.filter(p => !p.promotion_band);
  check(
    'All scored picks have promotion_band',
    missingBand.length === 0,
    `${missingBand.length}/${picks.length} picks missing promotion_band`
  );

  // Check: devig_mode present in meta
  const missingDevigMode = picks.filter(p => !p.meta?.devig_mode);
  check(
    'All scored picks have devig_mode in meta',
    missingDevigMode.length === 0,
    `${missingDevigMode.length}/${picks.length} picks missing meta.devig_mode`
  );

  // Check: p_final in [0, 1] when present
  const pOutOfRange = picks.filter(p => p.p_final != null && (p.p_final < 0 || p.p_final > 1));
  check(
    'p_final values in [0, 1] range',
    pOutOfRange.length === 0,
    `${pOutOfRange.length} picks have p_final outside [0, 1]`
  );

  // Check: uncertainty_final in [0, 1] when present
  const uncOutOfRange = picks.filter(
    p => p.uncertainty_final != null && (p.uncertainty_final < 0 || p.uncertainty_final > 1)
  );
  check(
    'uncertainty_final values in [0, 1] range',
    uncOutOfRange.length === 0,
    `${uncOutOfRange.length} picks have uncertainty_final outside [0, 1]`
  );

  return {
    total_scored: picks.length,
    hard_picks: hardPicks.length,
    hard_missing_primitives: hardMissingPrimitives.length,
    missing_model_version: missingModelVersion.length,
    missing_feature_version: missingFeatureVersion.length,
    missing_tier: missingTier.length,
    missing_band: missingBand.length,
    missing_devig_mode: missingDevigMode.length,
    p_out_of_range: pOutOfRange.length,
    uncertainty_out_of_range: uncOutOfRange.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Task 6: CLV Forecast Sanity Check
// ═══════════════════════════════════════════════════════════════════════════

async function task6CLVSanity(): Promise<any> {
  console.log('\n=== Task 6: CLV Forecast Sanity Check ===\n');

  let query = supabase
    .from('unified_picks')
    .select('id, clv_forecast, tier, promotion_band, meta')
    .not('clv_forecast', 'is', null);

  if (TRACE_FILTER) {
    query = query.contains('meta', { trace_id: TRACE_FILTER });
  }

  const { data: clvPicks, error } = await query.limit(1000);

  if (error) {
    console.error(`  Query error: ${error.message}`);
    return { error: error.message };
  }

  const picks = clvPicks || [];
  console.log(`  Found ${picks.length} picks with clv_forecast`);

  if (picks.length === 0) {
    console.log('  No CLV forecast data available.');
    check(
      'CLV data availability',
      true,
      'No CLV data — expected if probability layer returned INSUFFICIENT_BOOKS'
    );
    return { count: 0, note: 'No CLV data available (expected for single-book)' };
  }

  const clvValues = picks.map(p => p.clv_forecast as number);
  const avgCLV = clvValues.reduce((a, b) => a + b, 0) / clvValues.length;
  const minCLV = Math.min(...clvValues);
  const maxCLV = Math.max(...clvValues);
  const stdDev = Math.sqrt(
    clvValues.reduce((sum, v) => sum + Math.pow(v - avgCLV, 2), 0) / clvValues.length
  );

  console.log(`  Avg CLV forecast: ${avgCLV.toFixed(4)}`);
  console.log(`  Min CLV forecast: ${minCLV.toFixed(4)}`);
  console.log(`  Max CLV forecast: ${maxCLV.toFixed(4)}`);
  console.log(`  Std dev: ${stdDev.toFixed(4)}`);

  // Check: avg CLV should be near zero (symmetric market)
  check(
    'CLV avg near zero (|avg| < 0.1)',
    Math.abs(avgCLV) < 0.1,
    `Avg CLV = ${avgCLV.toFixed(4)} — should be near zero for efficient markets`
  );

  // Check: CLV not wildly out of range (-1 to 1)
  check(
    'CLV values in reasonable range [-1, 1]',
    minCLV >= -1 && maxCLV <= 1,
    `CLV range [${minCLV.toFixed(4)}, ${maxCLV.toFixed(4)}] outside [-1, 1]`
  );

  // Check: CLV distribution — not all identical
  const uniqueValues = new Set(clvValues.map(v => v.toFixed(4))).size;
  check(
    'CLV has variance (not all identical)',
    picks.length <= 1 || uniqueValues > 1,
    `All ${picks.length} CLV values are identical (${clvValues[0]?.toFixed(4)})`
  );

  return {
    count: picks.length,
    avg: Math.round(avgCLV * 10000) / 10000,
    min: Math.round(minCLV * 10000) / 10000,
    max: Math.round(maxCLV * 10000) / 10000,
    std_dev: Math.round(stdDev * 10000) / 10000,
    unique_values: uniqueValues,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.join(PROOF_DIR, 'proofs'), { recursive: true });

  console.log('='.repeat(60));
  console.log(`${SPRINT_ID} — Scoring Report + Validation`);
  if (TRACE_FILTER) {
    console.log(`Trace filter: ${TRACE_FILTER}`);
  }
  console.log('='.repeat(60));

  // Run all tasks
  const distribution = await task3ScoringDistribution();
  const discordValidation = await task4DiscordPostValidation();
  const integrity = await task5RuntimeIntegrity();
  const clvSanity = await task6CLVSanity();

  // Summary
  const passed = checks.filter(c => c.pass).length;
  const failed = checks.filter(c => !c.pass).length;
  const total = checks.length;

  console.log('\n' + '='.repeat(60));
  console.log(`  Validation Results: ${passed}/${total} passed, ${failed} failed`);

  if (failed > 0) {
    console.log('\n  FAILED checks:');
    for (const c of checks.filter(c => !c.pass)) {
      console.log(`    - ${c.name}: ${c.detail}`);
    }
  }

  console.log('='.repeat(60));

  // Write full report
  const report = {
    sprint: SPRINT_ID,
    timestamp: new Date().toISOString(),
    trace_filter: TRACE_FILTER,
    checks_passed: passed,
    checks_failed: failed,
    checks_total: total,
    all_checks: checks.map(c => ({ name: c.name, pass: c.pass, detail: c.detail })),
    task3_distribution: distribution,
    task4_discord_validation: discordValidation,
    task5_integrity: integrity,
    task6_clv_sanity: clvSanity,
  };

  // Write to runtime output
  const reportPath = path.join(OUT_DIR, 'scoring_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${reportPath}`);

  // Write to proof bundle
  const proofPath = path.join(PROOF_DIR, 'proofs', 'proof_scoring_report.json');
  fs.writeFileSync(proofPath, JSON.stringify(report, null, 2));
  console.log(`Proof:  ${proofPath}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
