/**
 * Runtime Validation: Canonical Scoring Pipeline Activation
 * Sprint: SPRINT-CANONICAL-SCORING-ACTIVATION-026
 *
 * Validates that the V3 scoring pipeline is correctly wired:
 * 1. Queries recent unified_picks for scoring_source metadata
 * 2. Verifies probability primitives are populated for multi-book picks
 * 3. Compares tier distributions between multi-book and single-book
 * 4. Outputs summary report
 */

import * as fs from 'fs';
import * as path from 'path';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PickRow {
  id: string;
  tier: string | null;
  p_final: number | null;
  edge_final: number | null;
  uncertainty_final: number | null;
  clv_forecast: number | null;
  promotion_band: string | null;
  devigged_edge: number | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

interface ValidationReport {
  timestamp: string;
  total_picks_scanned: number;
  multi_book_picks: number;
  single_book_picks: number;
  unknown_source_picks: number;
  multi_book_with_probability: number;
  multi_book_missing_probability: number;
  tier_distribution: {
    multi_book: Record<string, number>;
    single_book: Record<string, number>;
  };
  promotion_distribution: {
    multi_book: Record<string, number>;
    single_book: Record<string, number>;
  };
  avg_edge: {
    multi_book: number | null;
    single_book: number | null;
  };
  model_versions: Record<string, number>;
  issues: string[];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== SPRINT-026: Canonical Scoring Pipeline Validation ===\n');

  // Fetch recent picks with meta
  const { data: picks, error } = await supabase
    .from('unified_picks')
    .select(
      'id, tier, p_final, edge_final, uncertainty_final, clv_forecast, promotion_band, devigged_edge, meta, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Failed to fetch picks:', error.message);
    process.exit(1);
  }

  const allPicks = (picks ?? []) as PickRow[];
  console.log(`Total picks scanned: ${allPicks.length}\n`);

  // Classify by scoring source
  const multiBook: PickRow[] = [];
  const singleBook: PickRow[] = [];
  const unknown: PickRow[] = [];

  for (const pick of allPicks) {
    const scoringSource = pick.meta?.['scoring_source'] as string | undefined;
    if (scoringSource === 'provider_offers') {
      multiBook.push(pick);
    } else if (scoringSource === 'raw_props') {
      singleBook.push(pick);
    } else {
      unknown.push(pick);
    }
  }

  // Probability completeness for multi-book
  const multiBookWithProb = multiBook.filter(
    p => p.p_final != null && p.edge_final != null && p.uncertainty_final != null
  );
  const multiBookMissingProb = multiBook.filter(
    p => p.p_final == null || p.edge_final == null || p.uncertainty_final == null
  );

  // Tier distributions
  const tierDist = (picks: PickRow[]): Record<string, number> => {
    const dist: Record<string, number> = {};
    for (const p of picks) {
      const tier = p.tier ?? 'NULL';
      dist[tier] = (dist[tier] || 0) + 1;
    }
    return dist;
  };

  // Promotion distributions
  const promoDist = (picks: PickRow[]): Record<string, number> => {
    const dist: Record<string, number> = {};
    for (const p of picks) {
      const band = p.promotion_band ?? 'NULL';
      dist[band] = (dist[band] || 0) + 1;
    }
    return dist;
  };

  // Average edge
  const avgEdge = (picks: PickRow[]): number | null => {
    const edges = picks.filter(p => p.edge_final != null).map(p => p.edge_final!);
    if (edges.length === 0) return null;
    return edges.reduce((a, b) => a + b, 0) / edges.length;
  };

  // Model versions (stored in meta.sprint or meta.devig_mode as proxy)
  const modelVersions: Record<string, number> = {};
  for (const p of allPicks) {
    const sprint = (p.meta?.['sprint'] as string) ?? 'NULL';
    modelVersions[sprint] = (modelVersions[sprint] || 0) + 1;
  }

  // Issues
  const issues: string[] = [];
  if (multiBook.length === 0) {
    issues.push(
      'NO_MULTI_BOOK_PICKS: No picks with scoring_source=provider_offers found. V3 pipeline may not have processed any props with canonical IDs yet.'
    );
  }
  if (multiBookMissingProb.length > 0) {
    issues.push(
      `MISSING_PROBABILITY: ${multiBookMissingProb.length} multi-book picks missing probability primitives`
    );
  }
  if (unknown.length > 0 && unknown.length > allPicks.length * 0.5) {
    issues.push(
      `HIGH_UNKNOWN: ${unknown.length}/${allPicks.length} picks have no scoring_source in meta (pre-Sprint-026 picks)`
    );
  }

  const report: ValidationReport = {
    timestamp: new Date().toISOString(),
    total_picks_scanned: allPicks.length,
    multi_book_picks: multiBook.length,
    single_book_picks: singleBook.length,
    unknown_source_picks: unknown.length,
    multi_book_with_probability: multiBookWithProb.length,
    multi_book_missing_probability: multiBookMissingProb.length,
    tier_distribution: {
      multi_book: tierDist(multiBook),
      single_book: tierDist(singleBook),
    },
    promotion_distribution: {
      multi_book: promoDist(multiBook),
      single_book: promoDist(singleBook),
    },
    avg_edge: {
      multi_book: avgEdge(multiBook),
      single_book: avgEdge(singleBook),
    },
    model_versions: modelVersions,
    issues,
  };

  // Print report
  console.log('--- Scoring Source Distribution ---');
  console.log(`  Multi-book (provider_offers): ${report.multi_book_picks}`);
  console.log(`  Single-book (raw_props):      ${report.single_book_picks}`);
  console.log(`  Unknown (pre-026):            ${report.unknown_source_picks}`);

  console.log('\n--- Multi-book Probability Completeness ---');
  console.log(`  With probability:    ${report.multi_book_with_probability}`);
  console.log(`  Missing probability: ${report.multi_book_missing_probability}`);

  console.log('\n--- Tier Distribution ---');
  console.log('  Multi-book:', JSON.stringify(report.tier_distribution.multi_book));
  console.log('  Single-book:', JSON.stringify(report.tier_distribution.single_book));

  console.log('\n--- Promotion Distribution ---');
  console.log('  Multi-book:', JSON.stringify(report.promotion_distribution.multi_book));
  console.log('  Single-book:', JSON.stringify(report.promotion_distribution.single_book));

  console.log('\n--- Average Edge ---');
  console.log(`  Multi-book:  ${report.avg_edge.multi_book?.toFixed(6) ?? 'N/A'}`);
  console.log(`  Single-book: ${report.avg_edge.single_book?.toFixed(6) ?? 'N/A'}`);

  console.log('\n--- Model Versions ---');
  for (const [version, count] of Object.entries(report.model_versions)) {
    console.log(`  ${version}: ${count}`);
  }

  if (report.issues.length > 0) {
    console.log('\n--- Issues ---');
    for (const issue of report.issues) {
      console.log(`  ⚠️  ${issue}`);
    }
  }

  // Write artifacts
  const dateStr = new Date().toISOString().slice(0, 10);
  const outDir = path.resolve(
    __dirname,
    `../../out/sprints/SPRINT-026-CANONICAL-SCORING-ACTIVATION/${dateStr}`
  );
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(
    path.join(outDir, 'SCORING_PIPELINE_VALIDATION.json'),
    JSON.stringify(report, null, 2)
  );

  // Write markdown report
  const md = `# Scoring Pipeline Validation Report

**Sprint**: SPRINT-CANONICAL-SCORING-ACTIVATION-026
**Date**: ${dateStr}

## Scoring Source Distribution

| Source | Count |
|--------|-------|
| Multi-book (provider_offers) | ${report.multi_book_picks} |
| Single-book (raw_props) | ${report.single_book_picks} |
| Unknown (pre-026) | ${report.unknown_source_picks} |

## Multi-book Probability Completeness

| Metric | Value |
|--------|-------|
| With probability | ${report.multi_book_with_probability} |
| Missing probability | ${report.multi_book_missing_probability} |

## Tier Distribution

### Multi-book
${
  Object.entries(report.tier_distribution.multi_book)
    .map(([k, v]) => `| ${k} | ${v} |`)
    .join('\n') || '| (none) | 0 |'
}

### Single-book
${
  Object.entries(report.tier_distribution.single_book)
    .map(([k, v]) => `| ${k} | ${v} |`)
    .join('\n') || '| (none) | 0 |'
}

## Average Edge

| Source | Avg Edge |
|--------|----------|
| Multi-book | ${report.avg_edge.multi_book?.toFixed(6) ?? 'N/A'} |
| Single-book | ${report.avg_edge.single_book?.toFixed(6) ?? 'N/A'} |

## Model Versions

${Object.entries(report.model_versions)
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join('\n')}

## Issues

${report.issues.length > 0 ? report.issues.map(i => `- ${i}`).join('\n') : '- None'}
`;

  fs.writeFileSync(path.join(outDir, 'SCORING_PIPELINE_REPORT.md'), md);

  console.log(`\nArtifacts written to: ${outDir}`);

  // Exit code
  const hasCriticalIssues = report.multi_book_missing_probability > 0;
  process.exit(hasCriticalIssues ? 1 : 0);
}

main().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
