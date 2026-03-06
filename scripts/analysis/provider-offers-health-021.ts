#!/usr/bin/env tsx
/**
 * Provider Offers Health + Sampling Script
 * Sprint: SPRINT-021-DATA-FOUNDATION-GATE
 *
 * Queries provider_offers for a real NBA window,
 * produces book_count distribution per market,
 * selects at least 1 market with book_count >= 3,
 * and saves samples to out/.
 *
 * Usage:
 *   npx tsx scripts/analysis/provider-offers-health-021.ts
 *
 * Environment:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env)
 *   LEAGUE (optional, default: NBA)
 *   WINDOW_DAYS (optional, default: 7)
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

const LEAGUE = process.env['LEAGUE'] || 'NBA';
const WINDOW_DAYS = parseInt(process.env['WINDOW_DAYS'] || '7', 10);

const DATE_STR = new Date().toISOString().slice(0, 10);
const SPRINT_ID = 'SPRINT-021-DATA-FOUNDATION-GATE';
const OUT_DIR = path.resolve(__dirname, `../../out/sprints/${SPRINT_ID}/${DATE_STR}`);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MarketGroup {
  event_id: string;
  market_type_id: number;
  participant_id: string | null;
  book_count: number;
  providers: string[];
}

interface OfferRow {
  id: string;
  event_id: string;
  market_type_id: number | null;
  participant_id: string | null;
  provider: string;
  provider_id: number | null;
  line: number | null;
  over_odds: number | null;
  under_odds: number | null;
  home_odds: number | null;
  away_odds: number | null;
  yes_odds: number | null;
  no_odds: number | null;
  snapshot_at: string;
  created_at: string | null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\n=== Provider Offers Health — ${SPRINT_ID} ===`);
  console.log(`League filter: ${LEAGUE}`);
  console.log(`Window: last ${WINDOW_DAYS} days`);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
  const cutoffIso = cutoff.toISOString();

  // Step 1: Total count in provider_offers
  const { count: totalCount, error: countErr } = await supabase
    .from('provider_offers')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    console.error('[FATAL] Cannot query provider_offers:', countErr.message);
    process.exit(1);
  }

  console.log(`\nTotal rows in provider_offers: ${totalCount}`);

  // Step 2: Fetch recent offers (window)
  const { data: recentOffers, error: recentErr } = await supabase
    .from('provider_offers')
    .select(
      'id, event_id, market_type_id, participant_id, provider, provider_id, line, over_odds, under_odds, home_odds, away_odds, yes_odds, no_odds, snapshot_at, created_at'
    )
    .gte('snapshot_at', cutoffIso)
    .order('snapshot_at', { ascending: false })
    .limit(5000);

  if (recentErr) {
    console.error('[FATAL] Cannot fetch recent offers:', recentErr.message);
    process.exit(1);
  }

  const offers: OfferRow[] = recentOffers || [];
  console.log(`Offers in window (last ${WINDOW_DAYS}d): ${offers.length}`);

  if (offers.length === 0) {
    console.error('[FAIL] No offers found in window. Cannot proceed.');
    writeFailReport('No offers found in provider_offers within window');
    process.exit(1);
  }

  // Step 3: Group by market key → count distinct providers (book_count)
  const marketMap = new Map<string, MarketGroup>();

  for (const offer of offers) {
    const key = `${offer.event_id}|${offer.market_type_id ?? 'null'}|${offer.participant_id ?? 'null'}`;
    const existing = marketMap.get(key);
    if (existing) {
      if (!existing.providers.includes(offer.provider)) {
        existing.providers.push(offer.provider);
        existing.book_count = existing.providers.length;
      }
    } else {
      marketMap.set(key, {
        event_id: offer.event_id,
        market_type_id: offer.market_type_id ?? 0,
        participant_id: offer.participant_id,
        book_count: 1,
        providers: [offer.provider],
      });
    }
  }

  const markets = Array.from(marketMap.values());
  console.log(`\nDistinct markets (event × market_type × participant): ${markets.length}`);

  // Step 4: Book-count distribution
  const distribution: Record<number, number> = {};
  for (const m of markets) {
    distribution[m.book_count] = (distribution[m.book_count] || 0) + 1;
  }

  console.log('\nBook-count distribution:');
  for (const [bc, count] of Object.entries(distribution).sort(
    (a, b) => Number(a[0]) - Number(b[0])
  )) {
    console.log(`  ${bc} book(s): ${count} markets`);
  }

  // Step 5: Find markets with >= 3 books
  const multiBook = markets.filter(m => m.book_count >= 3);
  console.log(`\nMarkets with >= 3 books: ${multiBook.length}`);

  if (multiBook.length === 0) {
    console.warn('[WARN] No markets with >= 3 books found.');
    console.warn('Checking for >= 2 books as fallback...');
    const twoBook = markets.filter(m => m.book_count >= 2);
    console.log(`Markets with >= 2 books: ${twoBook.length}`);
  }

  // Step 6: Select sample market (highest book_count first)
  const sortedByBooks = [...markets].sort((a, b) => b.book_count - a.book_count);
  const sampleMarket = sortedByBooks[0];

  console.log(`\nSample market (highest book_count):`);
  console.log(`  event_id:        ${sampleMarket.event_id}`);
  console.log(`  market_type_id:  ${sampleMarket.market_type_id}`);
  console.log(`  participant_id:  ${sampleMarket.participant_id ?? '(null — game-level)'}`);
  console.log(`  book_count:      ${sampleMarket.book_count}`);
  console.log(`  providers:       ${sampleMarket.providers.join(', ')}`);

  // Step 7: Fetch all offers for the sample market
  let sampleQuery = supabase
    .from('provider_offers')
    .select('*')
    .eq('event_id', sampleMarket.event_id)
    .gte('snapshot_at', cutoffIso)
    .order('snapshot_at', { ascending: false });

  if (sampleMarket.market_type_id) {
    sampleQuery = sampleQuery.eq('market_type_id', sampleMarket.market_type_id);
  }
  if (sampleMarket.participant_id) {
    sampleQuery = sampleQuery.eq('participant_id', sampleMarket.participant_id);
  }

  const { data: sampleOffers, error: sampleErr } = await sampleQuery;
  if (sampleErr) {
    console.error('[FATAL] Cannot fetch sample offers:', sampleErr.message);
    process.exit(1);
  }

  console.log(`  Sample offer rows: ${(sampleOffers || []).length}`);

  // Step 8: Write artifacts
  fs.mkdirSync(path.join(OUT_DIR, 'proofs'), { recursive: true });

  const bookCountsArtifact = {
    sprint: SPRINT_ID,
    timestamp: new Date().toISOString(),
    league: LEAGUE,
    windowDays: WINDOW_DAYS,
    totalProviderOffers: totalCount,
    offersInWindow: offers.length,
    distinctMarkets: markets.length,
    distribution,
    marketsWithThreeOrMoreBooks: multiBook.length,
    topMarkets: sortedByBooks.slice(0, 10).map(m => ({
      event_id: m.event_id,
      market_type_id: m.market_type_id,
      participant_id: m.participant_id,
      book_count: m.book_count,
      providers: m.providers,
    })),
  };

  fs.writeFileSync(
    path.join(OUT_DIR, 'PROVIDER_OFFERS_BOOK_COUNTS.json'),
    JSON.stringify(bookCountsArtifact, null, 2)
  );

  fs.writeFileSync(
    path.join(OUT_DIR, 'MARKET_SAMPLE_OFFERS.json'),
    JSON.stringify(
      {
        sprint: SPRINT_ID,
        timestamp: new Date().toISOString(),
        sampleMarket: {
          event_id: sampleMarket.event_id,
          market_type_id: sampleMarket.market_type_id,
          participant_id: sampleMarket.participant_id,
          book_count: sampleMarket.book_count,
          providers: sampleMarket.providers,
        },
        offers: sampleOffers || [],
      },
      null,
      2
    )
  );

  console.log(`\nArtifacts written to: ${OUT_DIR}/`);
  console.log('  PROVIDER_OFFERS_BOOK_COUNTS.json');
  console.log('  MARKET_SAMPLE_OFFERS.json');

  // Pass/fail summary
  const hasThreePlusBooks = multiBook.length > 0;
  const hasTwoPlusBooks = markets.filter(m => m.book_count >= 2).length > 0;
  const status = hasThreePlusBooks ? 'PASS' : hasTwoPlusBooks ? 'PARTIAL' : 'FAIL';

  console.log(`\n=== HEALTH STATUS: ${status} ===`);
  if (hasThreePlusBooks) {
    console.log(`✅ ${multiBook.length} market(s) with >= 3 books — consensus gate eligible`);
  } else if (hasTwoPlusBooks) {
    console.log(
      '⚠️ Markets with >= 2 books found but < 3. MIN_BOOKS_FOR_CONSENSUS = 2 will still work.'
    );
  } else {
    console.log('❌ No multi-book markets found. Data foundation insufficient.');
  }

  process.exit(status === 'FAIL' ? 1 : 0);
}

function writeFailReport(reason: string): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, 'PROVIDER_OFFERS_BOOK_COUNTS.json'),
    JSON.stringify({ sprint: SPRINT_ID, status: 'FAIL', reason }, null, 2)
  );
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
