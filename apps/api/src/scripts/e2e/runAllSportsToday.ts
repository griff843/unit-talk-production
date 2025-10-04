#!/usr/bin/env tsx
/**
 * E2E Multi-Sport FeedAgent Runner
 *
 * Fetches ALL sports with games TODAY (Oct 2, 2025)
 * - MLB (baseball_mlb)
 * - NFL (americanfootball_nfl)
 * - NBA (basketball_nba)
 * - NHL (icehockey_nhl)
 * - NCAAF (americanfootball_ncaaf)
 * - NCAAB (basketball_ncaab)
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import { fetchAndWriteCoreMarkets } from '../../agents/FeedAgent/oddsApi';

const ALL_SPORTS = [
  // Major US Sports
  'baseball_mlb',           // MLB
  'americanfootball_nfl',   // NFL
  'basketball_nba',         // NBA
  'basketball_wnba',        // WNBA
  'icehockey_nhl',          // NHL

  // College Sports
  'americanfootball_ncaaf', // NCAAF
  'basketball_ncaab',       // NCAAB Men
  'basketball_wncaab',      // NCAAB Women

  // Soccer
  'soccer_usa_mls',         // MLS
  'soccer_epl',             // English Premier League
  'soccer_uefa_champs_league', // UEFA Champions League
  'soccer_spain_la_liga',   // La Liga
  'soccer_italy_serie_a',   // Serie A
  'soccer_germany_bundesliga', // Bundesliga

  // Other Popular Sports
  'mma_mixed_martial_arts', // MMA/UFC
  'boxing_boxing',          // Boxing
  'golf_pga',               // PGA Golf
  'tennis_atp',             // Tennis ATP
  'tennis_wta',             // Tennis WTA
  'aussierules_afl',        // Australian Football
  'rugbyleague_nrl',        // Rugby League
];

interface SportResult {
  sport: string;
  success: boolean;
  eventsFetched: number;
  picksIngested: number;
  playerPropsIngested: number;
  error?: string;
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  MULTI-SPORT E2E INGESTION - ALL SPORTS FOR TODAY');
  console.log('  Date: October 2, 2025');
  console.log('════════════════════════════════════════════════════════════════\n');

  const results: SportResult[] = [];
  let totalGames = 0;
  let totalPicks = 0;
  let totalPlayerProps = 0;

  for (const sport of ALL_SPORTS) {
    console.log(`\n🏈 Processing: ${sport}...`);
    console.log('-'.repeat(60));

    try {
      const result = await fetchAndWriteCoreMarkets(sport);

      const sportResult: SportResult = {
        sport,
        success: true,
        eventsFetched: result.eventsFetched || 0,
        picksIngested: result.coreMarketWrites?.inserted || 0,
        playerPropsIngested: result.playerPropWrites?.inserted || 0
      };

      results.push(sportResult);

      if (result.eventsFetched > 0) {
        console.log(`✅ ${sport}: ${result.eventsFetched} games, ${sportResult.picksIngested} picks ingested`);
        totalGames += result.eventsFetched;
        totalPicks += sportResult.picksIngested;
        totalPlayerProps += sportResult.playerPropsIngested;
      } else {
        console.log(`ℹ️  ${sport}: No games today`);
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      results.push({
        sport,
        success: false,
        eventsFetched: 0,
        picksIngested: 0,
        playerPropsIngested: 0,
        error: errorMsg
      });
      console.log(`❌ ${sport}: Error - ${errorMsg}`);
    }
  }

  // Final Summary
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  FINAL SUMMARY - ALL SPORTS');
  console.log('════════════════════════════════════════════════════════════════\n');

  console.log(`Total Games Fetched: ${totalGames}`);
  console.log(`Total Core Market Picks: ${totalPicks}`);
  console.log(`Total Player Props: ${totalPlayerProps}`);
  console.log(`Total Picks (All): ${totalPicks + totalPlayerProps}\n`);

  console.log('By Sport:');
  results.forEach(r => {
    if (r.eventsFetched > 0) {
      console.log(`  ${r.sport}: ${r.eventsFetched} games, ${r.picksIngested} picks, ${r.playerPropsIngested} player props`);
    }
  });

  console.log('\n════════════════════════════════════════════════════════════════\n');

  // Save results
  const fs = await import('fs/promises');
  const outPath = path.join(__dirname, '../../../out/ops/e2e-all-sports.json');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    date: '2025-10-02',
    totalGames,
    totalPicks,
    totalPlayerProps,
    sports: results
  }, null, 2));

  console.log(`📊 Results saved to: ${outPath}\n`);
}

main().catch(console.error);
