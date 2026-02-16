/**
 * shadowCompare.ts — Shadow comparison runner for V1 vs V2 scoring
 *
 * Runs each fixture through computeScoreV2 and records:
 * - V2 score, tier, EV, breakdown
 * - Feature audit (which features used fallbacks)
 * - Fixture validation (within expected ranges)
 *
 * Outputs:
 * - SCORE_COMPARISON.json — raw comparison data
 * - DRIFT_REPORT.md — human-readable drift analysis
 *
 * Usage: npx tsx apps/api/src/agents/GradingAgent/scoring/__fixtures__/shadowCompare.ts
 *
 * Created: 2026-01-29 (Tranche 3, Stage 4 — Scoring Rebuild)
 */

import * as fs from 'fs';
import * as path from 'path';

import { computeScoreV2 } from '../computeScoreV2';
import type { GradingFeatureSet } from '../../../../types/GradingFeatureSet';
import { SCORING_FIXTURES, type ScoringFixture } from './scoringFixtures';

interface ComparisonResult {
  fixture: string;
  description: string;
  v2: {
    score: number;
    tier: string;
    ev: number;
    featuresPresent: number;
    fallbacksUsed: number;
    excluded: number;
  };
  expected: ScoringFixture['expected'];
  validation: {
    tierMatch: boolean;
    scoreInRange: boolean;
    evSignMatch: boolean;
    allPassed: boolean;
  };
}

function validateEvSign(ev: number, expectedSign: string): boolean {
  switch (expectedSign) {
    case 'positive':
      return ev > 0;
    case 'negative':
      return ev < 0;
    case 'zero':
      return ev === 0;
    case 'any':
      return true;
    default:
      return true;
  }
}

function runComparison(): ComparisonResult[] {
  const results: ComparisonResult[] = [];

  for (const fixture of SCORING_FIXTURES) {
    const features = fixture.input as GradingFeatureSet;
    const v2 = computeScoreV2(features);

    const auditEntries = Object.values(v2.feature_audit);
    const featuresPresent = auditEntries.filter((a) => a.present).length;
    const fallbacksUsed = auditEntries.filter((a) => a.fallbackUsed).length;
    const excluded = auditEntries.filter((a) => a.fallbackPolicy === 'excluded').length;

    const tierMatch = fixture.expected.tierRange.includes(v2.tier);
    const scoreInRange = v2.score >= fixture.expected.scoreMin && v2.score <= fixture.expected.scoreMax;
    const evSignMatch = validateEvSign(v2.ev, fixture.expected.evSign);

    results.push({
      fixture: fixture.name,
      description: fixture.description,
      v2: {
        score: v2.score,
        tier: v2.tier,
        ev: v2.ev,
        featuresPresent,
        fallbacksUsed,
        excluded,
      },
      expected: fixture.expected,
      validation: {
        tierMatch,
        scoreInRange,
        evSignMatch,
        allPassed: tierMatch && scoreInRange && evSignMatch,
      },
    });
  }

  return results;
}

function generateDriftReport(results: ComparisonResult[]): string {
  const lines: string[] = [];
  lines.push('# Drift Report — V2 Scoring (Tranche 3)');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Fixtures: ${results.length}`);
  lines.push('');

  // Summary
  const passed = results.filter((r) => r.validation.allPassed).length;
  const failed = results.length - passed;
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total fixtures | ${results.length} |`);
  lines.push(`| All validations passed | ${passed} |`);
  lines.push(`| Validation failures | ${failed} |`);
  lines.push(`| Pass rate | ${((passed / results.length) * 100).toFixed(1)}% |`);
  lines.push('');

  // Tier distribution
  const tierDist: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  for (const r of results) {
    tierDist[r.v2.tier] = (tierDist[r.v2.tier] || 0) + 1;
  }
  lines.push('## V2 Tier Distribution');
  lines.push('');
  lines.push(`| Tier | Count |`);
  lines.push(`|------|-------|`);
  for (const [tier, count] of Object.entries(tierDist)) {
    lines.push(`| ${tier} | ${count} |`);
  }
  lines.push('');

  // Detail table
  lines.push('## Fixture Details');
  lines.push('');
  lines.push('| Fixture | V2 Score | V2 Tier | EV | Present/Fallback/Excluded | Tier OK | Score OK | EV OK | All OK |');
  lines.push('|---------|----------|---------|-----|--------------------------|---------|----------|-------|--------|');

  for (const r of results) {
    const status = r.validation.allPassed ? 'PASS' : 'FAIL';
    lines.push(
      `| ${r.fixture} | ${r.v2.score.toFixed(1)} | ${r.v2.tier} | ${r.v2.ev} | ${r.v2.featuresPresent}/${r.v2.fallbacksUsed}/${r.v2.excluded} | ${r.validation.tierMatch ? 'Y' : 'N'} | ${r.validation.scoreInRange ? 'Y' : 'N'} | ${r.validation.evSignMatch ? 'Y' : 'N'} | ${status} |`
    );
  }
  lines.push('');

  // Failures detail
  const failures = results.filter((r) => !r.validation.allPassed);
  if (failures.length > 0) {
    lines.push('## Failures');
    lines.push('');
    for (const f of failures) {
      lines.push(`### ${f.fixture}`);
      lines.push(`- **Description**: ${f.description}`);
      lines.push(`- **V2 Score**: ${f.v2.score.toFixed(2)} (expected ${f.expected.scoreMin}-${f.expected.scoreMax})`);
      lines.push(`- **V2 Tier**: ${f.v2.tier} (expected ${f.expected.tierRange.join('/')})`);
      lines.push(`- **EV**: ${f.v2.ev} (expected ${f.expected.evSign})`);
      if (!f.validation.tierMatch) lines.push(`- **FAIL**: Tier mismatch`);
      if (!f.validation.scoreInRange) lines.push(`- **FAIL**: Score out of range`);
      if (!f.validation.evSignMatch) lines.push(`- **FAIL**: EV sign mismatch`);
      lines.push('');
    }
  }

  // Feature audit summary
  lines.push('## Feature Audit');
  lines.push('');
  lines.push('Features with highest fallback usage across all fixtures:');
  lines.push('');

  // Aggregate fallback usage
  const fallbackCounts: Record<string, number> = {};
  for (const r of results) {
    // Use the first result's feature_audit keys as template
    // (all fixtures have the same registry)
  }

  // Run one fixture to get feature names
  if (results.length > 0) {
    const sampleFeatures = SCORING_FIXTURES[0].input as GradingFeatureSet;
    const sampleResult = computeScoreV2(sampleFeatures);
    for (const [name, audit] of Object.entries(sampleResult.feature_audit)) {
      if (audit.fallbackPolicy === 'excluded') {
        lines.push(`- **${name}**: excluded (ML model, weight redistributed)`);
      }
    }
  }
  lines.push('');

  return lines.join('\n');
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log('Running shadow comparison...');
  console.log(`Fixtures: ${SCORING_FIXTURES.length}`);
  console.log('');

  const results = runComparison();

  // Output dir
  // Resolve from the repository root (go up from apps/api/src/agents/GradingAgent/scoring/__fixtures__)
  const repoRoot = path.resolve(__dirname, '../../../../../../../');
  const outDir = path.join(repoRoot, 'out/scoring-rebuild/2026-01-29/tranche-3');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Write SCORE_COMPARISON.json
  const comparisonPath = path.join(outDir, 'SCORE_COMPARISON.json');
  fs.writeFileSync(comparisonPath, JSON.stringify(results, null, 2));
  console.log(`Wrote: ${comparisonPath}`);

  // Write DRIFT_REPORT.md
  const driftReport = generateDriftReport(results);
  const reportPath = path.join(outDir, 'DRIFT_REPORT.md');
  fs.writeFileSync(reportPath, driftReport);
  console.log(`Wrote: ${reportPath}`);

  // Summary
  const passed = results.filter((r) => r.validation.allPassed).length;
  const failed = results.length - passed;
  console.log('');
  console.log(`Results: ${passed}/${results.length} passed, ${failed} failed`);

  for (const r of results) {
    const status = r.validation.allPassed ? 'PASS' : 'FAIL';
    console.log(`  [${status}] ${r.fixture}: score=${r.v2.score.toFixed(1)}, tier=${r.v2.tier}, ev=${r.v2.ev}`);
  }

  if (failed > 0) {
    console.log('');
    console.log('FAILURES:');
    for (const r of results.filter((r) => !r.validation.allPassed)) {
      console.log(`  ${r.fixture}:`);
      if (!r.validation.tierMatch) console.log(`    Tier: got ${r.v2.tier}, expected ${r.expected.tierRange.join('/')}`);
      if (!r.validation.scoreInRange) console.log(`    Score: got ${r.v2.score.toFixed(2)}, expected ${r.expected.scoreMin}-${r.expected.scoreMax}`);
      if (!r.validation.evSignMatch) console.log(`    EV: got ${r.v2.ev}, expected ${r.expected.evSign}`);
    }
  }

  return results;
}

// Run if executed directly
main();
