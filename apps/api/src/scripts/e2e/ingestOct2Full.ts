#!/usr/bin/env tsx
/**
 * Full multi-sport ingestion for October 2, 2025
 * Ingests ALL available sports with ALL markets including alternates
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import { fetchAndIngestOddsApiGames } from '../../agents/FeedAgent/oddsApi';

async function ingestOct2() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  FULL MULTI-SPORT INGESTION - OCTOBER 2, 2025');
  console.log('══════════════════════════════════════════════════════════\n');

  const sports = ['americanfootball_nfl', 'baseball_mlb'];

  for (const sport of sports) {
    console.log(`\n📊 Ingesting ${sport.toUpperCase()}...\n`);

    try {
      await fetchAndIngestOddsApiGames(sport);
      console.log(`✅ ${sport} ingestion complete\n`);
    } catch (error) {
      console.error(`❌ ${sport} ingestion failed:`, error);
    }
  }

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  INGESTION COMPLETE');
  console.log('══════════════════════════════════════════════════════════\n');
}

ingestOct2().catch(console.error);
