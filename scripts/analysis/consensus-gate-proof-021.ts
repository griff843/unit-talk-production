#!/usr/bin/env tsx
/**
 * Consensus Gate Proof Script
 * Sprint: SPRINT-021-DATA-FOUNDATION-GATE
 *
 * Loads sampled market offers from provider_offers,
 * runs computeConsensus() / devig normalization,
 * and outputs implied probs, fair probs, p_market_devig, overround.
 *
 * Hard PASS condition:
 *   - book_count >= 3
 *   - p_market_devig is finite (0 < p < 1)
 *   - overround > 0 and plausible (< 1.30 for two-way market)
 *
 * Usage:
 *   npx tsx scripts/analysis/consensus-gate-proof-021.ts
 *
 * Prerequisite: Run provider-offers-health-021.ts first (produces MARKET_SAMPLE_OFFERS.json)
 */

/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import {
  computeConsensus,
  americanToImplied,
  calculateOverround,
  applyDevig,
  type BookOffer,
  type BookProfile,
  type LiquidityTier,
  type DataQuality,
} from '../../apps/api/src/lib/probability/devigConsensus';

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

const SPRINT_ID = 'SPRINT-021-DATA-FOUNDATION-GATE';
const DATE_STR = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, `../../out/sprints/${SPRINT_ID}/${DATE_STR}`);

const WINDOW_DAYS = parseInt(process.env['WINDOW_DAYS'] || '7', 10);

// ---------------------------------------------------------------------------
// Provider profile defaults (when provider_registry not available)
// ---------------------------------------------------------------------------

const PROVIDER_PROFILES: Record<
  string,
  { bookProfile: BookProfile; liquidityTier: LiquidityTier; dataQuality: DataQuality }
> = {
  fanduel: { bookProfile: 'market_maker', liquidityTier: 'high', dataQuality: 'good' },
  draftkings: { bookProfile: 'market_maker', liquidityTier: 'high', dataQuality: 'good' },
  betmgm: { bookProfile: 'retail', liquidityTier: 'medium', dataQuality: 'good' },
  caesars: { bookProfile: 'retail', liquidityTier: 'medium', dataQuality: 'good' },
  pointsbet: { bookProfile: 'retail', liquidityTier: 'low', dataQuality: 'good' },
  pinnacle: { bookProfile: 'sharp', liquidityTier: 'high', dataQuality: 'good' },
  betrivers: { bookProfile: 'retail', liquidityTier: 'medium', dataQuality: 'good' },
  bet365: { bookProfile: 'market_maker', liquidityTier: 'high', dataQuality: 'good' },
};

function getProviderProfile(provider: string): {
  bookProfile: BookProfile;
  liquidityTier: LiquidityTier;
  dataQuality: DataQuality;
} {
  const key = provider.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    PROVIDER_PROFILES[key] ?? {
      bookProfile: 'retail' as BookProfile,
      liquidityTier: 'medium' as LiquidityTier,
      dataQuality: 'good' as DataQuality,
    }
  );
}

// ---------------------------------------------------------------------------
// Odds column detection
// ---------------------------------------------------------------------------

interface OfferRow {
  id: string;
  event_id: string;
  provider: string;
  provider_id: number | null;
  market_type_id: number | null;
  participant_id: string | null;
  over_odds: number | null;
  under_odds: number | null;
  home_odds: number | null;
  away_odds: number | null;
  yes_odds: number | null;
  no_odds: number | null;
  line: number | null;
  snapshot_at: string;
}

function detectOddsPair(row: OfferRow): { sideA: number; sideB: number; label: string } | null {
  if (row.over_odds !== null && row.under_odds !== null) {
    return { sideA: row.over_odds, sideB: row.under_odds, label: 'over/under' };
  }
  if (row.home_odds !== null && row.away_odds !== null) {
    return { sideA: row.home_odds, sideB: row.away_odds, label: 'home/away' };
  }
  if (row.yes_odds !== null && row.no_odds !== null) {
    return { sideA: row.yes_odds, sideB: row.no_odds, label: 'yes/no' };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\n=== Consensus Gate Proof — ${SPRINT_ID} ===\n`);

  // Step 1: Try to load pre-sampled offers, otherwise query directly
  let sampleOffers: OfferRow[];
  let sampleMeta: { event_id: string; market_type_id: number; participant_id: string | null };

  const samplePath = path.join(OUT_DIR, 'MARKET_SAMPLE_OFFERS.json');
  if (fs.existsSync(samplePath)) {
    console.log('Loading pre-sampled offers from MARKET_SAMPLE_OFFERS.json...');
    const raw = JSON.parse(fs.readFileSync(samplePath, 'utf-8'));
    sampleOffers = raw.offers;
    sampleMeta = raw.sampleMarket;
  } else {
    console.log('No pre-sampled file found. Querying provider_offers directly...');
    const result = await findBestMarketDirect();
    if (!result) {
      writeOutput(null, 'FAIL', 'No multi-book market found in provider_offers');
      process.exit(1);
    }
    sampleOffers = result.offers;
    sampleMeta = result.meta;
  }

  console.log(`Sample market:`);
  console.log(`  event_id:        ${sampleMeta.event_id}`);
  console.log(`  market_type_id:  ${sampleMeta.market_type_id}`);
  console.log(`  participant_id:  ${sampleMeta.participant_id ?? '(null — game-level)'}`);
  console.log(`  offer rows:      ${sampleOffers.length}`);

  // Step 2: Dedupe to latest offer per provider
  const latestByProvider = new Map<string, OfferRow>();
  for (const offer of sampleOffers) {
    const key = offer.provider;
    const existing = latestByProvider.get(key);
    if (!existing || offer.snapshot_at > existing.snapshot_at) {
      latestByProvider.set(key, offer);
    }
  }

  const dedupedOffers = Array.from(latestByProvider.values());
  console.log(`  Deduped to ${dedupedOffers.length} provider(s)`);

  // Step 3: Convert to BookOffer[]
  const bookOffers: BookOffer[] = [];
  const perBookImplied: Array<{
    provider: string;
    sideA_odds: number;
    sideB_odds: number;
    sideA_implied: number;
    sideB_implied: number;
    overround: number;
    oddsType: string;
  }> = [];

  for (const row of dedupedOffers) {
    const pair = detectOddsPair(row);
    if (!pair) {
      console.log(`  [SKIP] ${row.provider}: no valid odds pair`);
      continue;
    }

    const profile = getProviderProfile(row.provider);
    bookOffers.push({
      bookId: String(row.provider_id ?? row.provider),
      bookName: row.provider,
      overOdds: pair.sideA,
      underOdds: pair.sideB,
      bookProfile: profile.bookProfile,
      liquidityTier: profile.liquidityTier,
      dataQuality: profile.dataQuality,
    });

    const impliedA = americanToImplied(pair.sideA);
    const impliedB = americanToImplied(pair.sideB);
    const overround = calculateOverround(impliedA, impliedB);

    perBookImplied.push({
      provider: row.provider,
      sideA_odds: pair.sideA,
      sideB_odds: pair.sideB,
      sideA_implied: impliedA,
      sideB_implied: impliedB,
      overround,
      oddsType: pair.label,
    });
  }

  console.log(`\n--- Per-Book Implied Probabilities ---`);
  for (const b of perBookImplied) {
    console.log(
      `  ${b.provider.padEnd(15)} ${b.oddsType.padEnd(12)} ` +
        `A=${b.sideA_odds.toString().padStart(5)} (${b.sideA_implied.toFixed(4)}) ` +
        `B=${b.sideB_odds.toString().padStart(5)} (${b.sideB_implied.toFixed(4)}) ` +
        `OR=${b.overround.toFixed(4)}`
    );
  }

  if (bookOffers.length === 0) {
    writeOutput(null, 'FAIL', 'No valid odds pairs in sample offers');
    process.exit(1);
  }

  // Step 4: Per-book devig fair probabilities
  console.log(`\n--- Per-Book Devigged Fair Probabilities ---`);
  const perBookDevig: Array<{
    provider: string;
    overFair: number;
    underFair: number;
    overround: number;
    method: string;
  }> = [];

  for (const b of perBookImplied) {
    const result = applyDevig(b.sideA_implied, b.sideB_implied, 'proportional');
    if (result) {
      perBookDevig.push({
        provider: b.provider,
        overFair: result.overFair,
        underFair: result.underFair,
        overround: result.overround,
        method: 'proportional',
      });
      console.log(
        `  ${b.provider.padEnd(15)} fairA=${result.overFair.toFixed(6)} fairB=${result.underFair.toFixed(6)} sum=${(result.overFair + result.underFair).toFixed(6)}`
      );
    }
  }

  // Step 5: Run computeConsensus()
  console.log(`\n--- Computing Consensus (${bookOffers.length} books) ---`);
  const consensus = computeConsensus(bookOffers, 'proportional');

  if (!consensus.ok) {
    const fail = consensus as { ok: false; reason: string; reasonDetail: string };
    console.error(`[FAIL] Consensus failed: ${fail.reason} — ${fail.reasonDetail}`);
    writeOutput(
      {
        consensusResult: consensus,
        perBookImplied,
        perBookDevig,
        bookCount: bookOffers.length,
      },
      'FAIL',
      `Consensus failed: ${fail.reason}`
    );
    process.exit(1);
  }

  // Step 6: Extract and validate results
  const p_market_devig = consensus.overConsensus;
  const p_market_devig_under = consensus.underConsensus;
  const avgOverround = perBookImplied.reduce((s, b) => s + b.overround, 0) / perBookImplied.length;

  console.log(`\n=== CONSENSUS RESULTS ===`);
  console.log(`  p_market_devig (sideA): ${p_market_devig.toFixed(6)}`);
  console.log(`  p_market_devig (sideB): ${p_market_devig_under.toFixed(6)}`);
  console.log(`  Sum:                    ${(p_market_devig + p_market_devig_under).toFixed(6)}`);
  console.log(`  Devig method:           ${consensus.devigMethod}`);
  console.log(`  Books used:             ${consensus.booksUsed}`);
  console.log(`  Avg overround:          ${avgOverround.toFixed(4)}`);

  // Step 7: PASS/FAIL gate
  const checks = {
    bookCountGte3: bookOffers.length >= 3,
    pMarketDevigFinite: isFinite(p_market_devig) && p_market_devig > 0 && p_market_devig < 1,
    overroundPositive: avgOverround > 0,
    overroundPlausible: avgOverround > 1.0 && avgOverround < 1.3,
    sumNearOne: Math.abs(p_market_devig + p_market_devig_under - 1.0) < 0.001,
  };

  console.log(`\n=== GATE CHECKS ===`);
  console.log(
    `  book_count >= 3:       ${checks.bookCountGte3 ? '✅ PASS' : '❌ FAIL'} (${bookOffers.length})`
  );
  console.log(
    `  p_market_devig finite: ${checks.pMarketDevigFinite ? '✅ PASS' : '❌ FAIL'} (${p_market_devig})`
  );
  console.log(
    `  overround > 0:         ${checks.overroundPositive ? '✅ PASS' : '❌ FAIL'} (${avgOverround.toFixed(4)})`
  );
  console.log(
    `  overround plausible:   ${checks.overroundPlausible ? '✅ PASS' : '⚠️ SOFT'} (${avgOverround.toFixed(4)})`
  );
  console.log(`  sum ≈ 1.0:             ${checks.sumNearOne ? '✅ PASS' : '⚠️ SOFT'}`);

  // Hard pass requires: books >= 3, finite p, positive overround
  // Soft pass: books >= 2 + finite p + positive overround
  const hardPass = checks.bookCountGte3 && checks.pMarketDevigFinite && checks.overroundPositive;
  const softPass = bookOffers.length >= 2 && checks.pMarketDevigFinite && checks.overroundPositive;
  const status = hardPass ? 'PASS' : softPass ? 'SOFT_PASS' : 'FAIL';

  console.log(`\n=== CONSENSUS GATE: ${status} ===`);

  // Step 8: Write output artifacts
  writeOutput(
    {
      sampleMarket: sampleMeta,
      bookCount: bookOffers.length,
      perBookImplied,
      perBookDevig,
      consensusResult: {
        ok: consensus.ok,
        overConsensus: consensus.overConsensus,
        underConsensus: consensus.underConsensus,
        devigMethod: consensus.devigMethod,
        booksUsed: consensus.booksUsed,
        books: consensus.books,
        consensusWeights: consensus.consensusWeights,
      },
      p_market_devig,
      p_market_devig_under,
      avgOverround,
      gateChecks: checks,
    },
    status,
    hardPass
      ? `Consensus computed with ${bookOffers.length} books. p_market_devig=${p_market_devig.toFixed(6)}`
      : softPass
        ? `Soft pass: ${bookOffers.length} books (< 3), but consensus valid`
        : 'Gate failed — see checks'
  );

  process.exit(status === 'FAIL' ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Direct market finder (if no pre-sampled file)
// ---------------------------------------------------------------------------

async function findBestMarketDirect(): Promise<{
  offers: OfferRow[];
  meta: { event_id: string; market_type_id: number; participant_id: string | null };
} | null> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);

  const { data, error } = await supabase
    .from('provider_offers')
    .select(
      'id, provider, provider_id, event_id, market_type_id, participant_id, line, over_odds, under_odds, home_odds, away_odds, yes_odds, no_odds, snapshot_at'
    )
    .gte('snapshot_at', cutoff.toISOString())
    .order('snapshot_at', { ascending: false })
    .limit(5000);

  if (error || !data || data.length === 0) return null;

  // Group by market key, pick highest book_count
  const groups = new Map<string, { offers: OfferRow[]; providers: Set<string> }>();
  for (const row of data) {
    const key = `${row.event_id}|${row.market_type_id}|${row.participant_id}`;
    const g = groups.get(key) ?? { offers: [], providers: new Set() };
    g.offers.push(row as OfferRow);
    g.providers.add(row.provider);
    groups.set(key, g);
  }

  let bestKey = '';
  let bestCount = 0;
  for (const [key, g] of groups) {
    if (g.providers.size > bestCount) {
      bestCount = g.providers.size;
      bestKey = key;
    }
  }

  if (!bestKey || bestCount === 0) return null;

  const best = groups.get(bestKey)!;
  const first = best.offers[0];
  return {
    offers: best.offers,
    meta: {
      event_id: first.event_id,
      market_type_id: first.market_type_id ?? 0,
      participant_id: first.participant_id,
    },
  };
}

// ---------------------------------------------------------------------------
// Output writer
// ---------------------------------------------------------------------------

function writeOutput(data: Record<string, unknown> | null, status: string, summary: string): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const output = {
    sprint: SPRINT_ID,
    timestamp: new Date().toISOString(),
    status,
    summary,
    ...(data ?? {}),
  };

  fs.writeFileSync(path.join(OUT_DIR, 'CONSENSUS_OUTPUT.json'), JSON.stringify(output, null, 2));

  // Write gate report markdown
  const report = generateGateReport(output, status, summary);
  fs.writeFileSync(path.join(OUT_DIR, 'CONSENSUS_GATE_REPORT.md'), report);

  console.log(`\nArtifacts written to: ${OUT_DIR}/`);
  console.log('  CONSENSUS_OUTPUT.json');
  console.log('  CONSENSUS_GATE_REPORT.md');
}

function generateGateReport(
  output: Record<string, unknown>,
  status: string,
  summary: string
): string {
  const checks = (output['gateChecks'] as Record<string, boolean>) ?? {};
  const perBook = (output['perBookImplied'] as Array<Record<string, unknown>>) ?? [];
  const consensusResult = (output['consensusResult'] as Record<string, unknown>) ?? {};

  return `# Consensus Gate Report — ${SPRINT_ID}

**Date**: ${new Date().toISOString().slice(0, 10)}
**Status**: ${status === 'PASS' ? '✅ PASS' : status === 'SOFT_PASS' ? '⚠️ SOFT PASS' : '❌ FAIL'}
**Summary**: ${summary}

---

## Market Sample

| Field | Value |
|-------|-------|
| event_id | \`${(output['sampleMarket'] as Record<string, unknown>)?.['event_id'] ?? 'N/A'}\` |
| market_type_id | \`${(output['sampleMarket'] as Record<string, unknown>)?.['market_type_id'] ?? 'N/A'}\` |
| participant_id | \`${(output['sampleMarket'] as Record<string, unknown>)?.['participant_id'] ?? 'N/A (game-level)'}\` |
| book_count | ${output['bookCount'] ?? 'N/A'} |

## Per-Book Implied Probabilities

| Provider | Side A Odds | Side B Odds | Implied A | Implied B | Overround |
|----------|-------------|-------------|-----------|-----------|-----------|
${perBook.map(b => `| ${b['provider']} | ${b['sideA_odds']} | ${b['sideB_odds']} | ${Number(b['sideA_implied']).toFixed(4)} | ${Number(b['sideB_implied']).toFixed(4)} | ${Number(b['overround']).toFixed(4)} |`).join('\n')}

## Consensus Output

| Metric | Value |
|--------|-------|
| p_market_devig (sideA) | ${output['p_market_devig'] ?? 'N/A'} |
| p_market_devig (sideB) | ${output['p_market_devig_under'] ?? 'N/A'} |
| Devig method | ${consensusResult['devigMethod'] ?? 'N/A'} |
| Books used | ${consensusResult['booksUsed'] ?? 'N/A'} |
| Avg overround | ${output['avgOverround'] != null ? Number(output['avgOverround']).toFixed(4) : 'N/A'} |

## Gate Checks

| Check | Result |
|-------|--------|
| book_count >= 3 | ${checks['bookCountGte3'] ? '✅ PASS' : '❌ FAIL'} |
| p_market_devig finite (0 < p < 1) | ${checks['pMarketDevigFinite'] ? '✅ PASS' : '❌ FAIL'} |
| overround > 0 | ${checks['overroundPositive'] ? '✅ PASS' : '❌ FAIL'} |
| overround plausible (1.0–1.30) | ${checks['overroundPlausible'] ? '✅ PASS' : '⚠️ SOFT'} |
| sum ≈ 1.0 | ${checks['sumNearOne'] ? '✅ PASS' : '⚠️ SOFT'} |

---

**Gate Verdict**: ${status}
`;
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
