#!/usr/bin/env tsx
/**
 * Fetch ONLY the 49ers vs Rams game (Thursday Night Football)
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import axios from 'axios';
import { syncGameMetadata } from '../../services/GameMetadataSync';
import { transformGamesToUnifiedPicks } from '../../agents/FeedAgent/transform';
import { upsertUnifiedPicksCore } from '../../services/unifiedPicksWriter';

async function fetch49ersRams() {
  console.log('\n═══ FETCHING 49ERS VS RAMS (TNF Oct 2) ═══\n');

  const apiKey = process.env.ODDS_API_KEY;

  // Get the 49ers vs Rams game ID
  const eventsUrl = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events?apiKey=${apiKey}&dateFormat=iso`;
  const eventsResp = await axios.get(eventsUrl);

  const game49ersRams = eventsResp.data.find((e: any) =>
    (e.home_team === 'Los Angeles Rams' && e.away_team === 'San Francisco 49ers') ||
    (e.home_team === 'San Francisco 49ers' && e.away_team === 'Los Angeles Rams')
  );

  if (!game49ersRams) {
    console.log('❌ 49ers vs Rams game not found');
    return;
  }

  console.log(`✅ Found game: ${game49ersRams.away_team} @ ${game49ersRams.home_team}`);
  console.log(`   Time: ${game49ersRams.commence_time}`);
  console.log(`   ID: ${game49ersRams.id}\n`);

  // Fetch odds with ALL NFL player props
  const oddsUrl = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events/${game49ersRams.id}/odds`;
  const params = {
    apiKey,
    regions: 'us',
    markets: 'h2h,spreads,totals,player_pass_yds,player_pass_tds,player_rush_yds,player_reception_yds,player_receptions,player_anytime_td',
    bookmakers: 'draftkings,fanduel',
    oddsFormat: 'american',
    dateFormat: 'iso'
  };

  console.log('Fetching odds with player props...');
  const oddsResp = await axios.get(oddsUrl, { params });
  const gameWithOdds = oddsResp.data;

  console.log(`✅ Fetched odds from ${gameWithOdds.bookmakers?.length || 0} bookmakers\n`);

  // Sync game metadata
  console.log('Syncing game metadata...');
  await syncGameMetadata([gameWithOdds]);
  console.log('✅ Game metadata synced\n');

  // Transform to unified picks
  console.log('Transforming to unified picks...');
  const picks = transformGamesToUnifiedPicks([gameWithOdds], ['draftkings', 'fanduel']);
  console.log(`✅ Transformed ${picks.length} picks\n`);

  // Write to database
  console.log('Writing to database...');
  const result = await upsertUnifiedPicksCore(picks);
  console.log(`✅ Written: ${result.inserted} inserted, ${result.skippedDedup} skipped\n`);

  console.log('════════════════════════════════════════════════════════\n');
}

fetch49ersRams().catch(console.error);
