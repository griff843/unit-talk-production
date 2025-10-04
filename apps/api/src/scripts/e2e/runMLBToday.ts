#!/usr/bin/env tsx
/**
 * MLB-Only Ingestion for Oct 2, 2025
 * Fetch ALL MLB player props including pitcher_outs
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import { fetchAndWriteCoreMarkets } from '../../agents/FeedAgent/oddsApi';

async function main() {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  MLB-ONLY INGESTION - October 2, 2025');
  console.log('════════════════════════════════════════════════════════════════\n');

  try {
    const result = await fetchAndWriteCoreMarkets('baseball_mlb');

    console.log('\n═══ MLB INGESTION RESULTS ═══');
    console.log(`Events fetched: ${result.eventsFetched}`);
    console.log(`Core market picks: ${result.coreMarketWrites?.inserted || 0}`);
    console.log(`Markets processed:`, result.marketsProcessed);

    if (result.telemetry) {
      console.log('\n═══ TELEMETRY ═══');
      console.log(`Requested markets: ${result.telemetry.requestedMarkets.join(', ')}`);
      console.log(`Transformed markets:`, result.telemetry.transformedMarkets);
    }

    console.log('\n════════════════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('❌ MLB ingestion failed:', error);
    throw error;
  }
}

main().catch(console.error);
