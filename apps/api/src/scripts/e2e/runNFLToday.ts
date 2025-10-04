#!/usr/bin/env tsx
/**
 * NFL-Only Ingestion for Oct 2, 2025
 * Fetch ALL NFL player props (passing, rushing, receiving, kicking, defense)
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import { fetchAndWriteCoreMarkets } from '../../agents/FeedAgent/oddsApi';

async function main() {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  NFL-ONLY INGESTION - October 2, 2025');
  console.log('════════════════════════════════════════════════════════════════\n');

  try {
    const result = await fetchAndWriteCoreMarkets('americanfootball_nfl');

    console.log('\n═══ NFL INGESTION RESULTS ═══');
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
    console.error('❌ NFL ingestion failed:', error);
    throw error;
  }
}

main().catch(console.error);
