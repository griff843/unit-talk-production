#!/usr/bin/env tsx
/**
 * Simple multi-sport ingestion for October 2, 2025
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import axios from 'axios';
import { syncGameMetadata } from '../../services/GameMetadataSync';
import { transformGamesToUnifiedPicks } from '../../agents/FeedAgent/transform';
import { upsertUnifiedPicksCore } from '../../services/unifiedPicksWriter';
import { NFL_PLAYER_PROPS, MLB_PLAYER_PROPS } from '../../agents/FeedAgent/oddsApi';

async function ingestSport(sportKey: string, playerProps: string[]) {
  console.log(`\n📊 Ingesting ${sportKey.toUpperCase()}...`);

  const apiKey = process.env.ODDS_API_KEY;

  // Fetch events for Oct 2 ET (Oct 2 04:00 UTC to Oct 3 04:00 UTC)
  const eventsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/events`;
  const eventsResp = await axios.get(eventsUrl, {
    params: {
      apiKey,
      dateFormat: 'iso',
      commenceTimeFrom: '2025-10-02T04:00:00Z',
      commenceTimeTo: '2025-10-03T04:00:00Z'
    }
  });

  const events = eventsResp.data;
  console.log(`  Found ${events.length} games for Oct 2 ET`);

  if (events.length === 0) {
    console.log(`  No games found, skipping ${sportKey}`);
    return { events: 0, picks: 0 };
  }

  // Fetch odds for all events with player props
  const allGamesWithOdds: any[] = [];
  const markets = ['h2h', 'spreads', 'totals', ...playerProps.slice(0, 10)]; // Limit to 10 player prop markets to avoid API limits

  console.log(`  Fetching odds for ${events.length} games (${markets.length} markets)...`);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    try {
      // Rate limiting: 500ms delay between requests
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${event.id}/odds`;
      const oddsResp = await axios.get(oddsUrl, {
        params: {
          apiKey,
          regions: 'us',
          markets: markets.join(','),
          bookmakers: 'draftkings,fanduel',
          oddsFormat: 'american',
          dateFormat: 'iso'
        }
      });

      allGamesWithOdds.push(oddsResp.data);
    } catch (error: any) {
      console.error(`  ❌ Error fetching odds for event ${event.id}:`, error.message);
    }
  }

  console.log(`  Fetched odds for ${allGamesWithOdds.length} games`);

  // Sync game metadata
  await syncGameMetadata(allGamesWithOdds);

  // Transform to unified picks
  const picks = transformGamesToUnifiedPicks(allGamesWithOdds, ['draftkings', 'fanduel']);
  console.log(`  Transformed ${picks.length} picks`);

  // Write to database
  const result = await upsertUnifiedPicksCore(picks);
  console.log(`  ✅ Written: ${result.inserted} inserted, ${result.skippedDedup} skipped`);

  return { events: events.length, picks: result.inserted };
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  FULL MULTI-SPORT INGESTION - OCTOBER 2, 2025 (ET)');
  console.log('══════════════════════════════════════════════════════════\n');

  const results: Record<string, { events: number; picks: number }> = {};

  // NFL
  try {
    results.nfl = await ingestSport('americanfootball_nfl', NFL_PLAYER_PROPS);
  } catch (error: any) {
    console.error('❌ NFL ingestion failed:', error.message);
    results.nfl = { events: 0, picks: 0 };
  }

  // MLB
  try {
    results.mlb = await ingestSport('baseball_mlb', MLB_PLAYER_PROPS);
  } catch (error: any) {
    console.error('❌ MLB ingestion failed:', error.message);
    results.mlb = { events: 0, picks: 0 };
  }

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  INGESTION SUMMARY');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`\n  NFL: ${results.nfl.events} games → ${results.nfl.picks} picks`);
  console.log(`  MLB: ${results.mlb.events} games → ${results.mlb.picks} picks`);
  console.log(`\n  TOTAL: ${results.nfl.picks + results.mlb.picks} picks ingested`);
  console.log('\n══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
