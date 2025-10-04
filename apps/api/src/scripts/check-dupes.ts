#!/usr/bin/env tsx
import { transformGamesToUnifiedPicks } from '../agents/FeedAgent/transform';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function checkDupes() {
  const apiKey = process.env.ODDS_API_KEY;
  const gameId = 'c4b72eabb3d557e73022ec730d8e3944';
  const oddsUrl = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events/${gameId}/odds`;
  const params = {
    apiKey,
    regions: 'us',
    markets: 'h2h,spreads,totals,player_pass_yds,player_pass_tds,player_rush_yds,player_reception_yds,player_receptions,player_anytime_td',
    bookmakers: 'draftkings,fanduel',
    oddsFormat: 'american',
    dateFormat: 'iso'
  };

  const oddsResp = await axios.get(oddsUrl, { params });
  const picks = transformGamesToUnifiedPicks([oddsResp.data], ['draftkings', 'fanduel']);

  // Check for duplicates in the picks array
  const seen = new Map();
  const dupes = [];

  for (const pick of picks) {
    const key = `${pick.external_game_id}|${pick.external_prop_id}`;
    if (seen.has(key)) {
      dupes.push({ key, first: seen.get(key), second: pick });
    } else {
      seen.set(key, pick);
    }
  }

  console.log('Total picks:', picks.length);
  console.log('Unique keys:', seen.size);
  console.log('Duplicates found:', dupes.length);

  if (dupes.length > 0) {
    console.log('\nFirst 5 duplicates:');
    dupes.slice(0, 5).forEach((d, i) => {
      console.log(`\n--- Duplicate ${i+1} ---`);
      console.log('Key:', d.key);
      console.log('First:', JSON.stringify({
        market: d.first.market,
        bookmaker: d.first.metadata.bookmaker_key,
        selection: d.first.selection,
        id: d.first.id
      }, null, 2));
      console.log('Second:', JSON.stringify({
        market: d.second.market,
        bookmaker: d.second.metadata.bookmaker_key,
        selection: d.second.selection,
        id: d.second.id
      }, null, 2));
    });
  }

  // Also check for duplicate IDs
  const idsSeen = new Set();
  const dupeIds = [];
  for (const pick of picks) {
    if (idsSeen.has(pick.id)) {
      dupeIds.push(pick.id);
    } else {
      idsSeen.add(pick.id);
    }
  }
  console.log('\nDuplicate IDs found:', dupeIds.length);
  if (dupeIds.length > 0) {
    console.log('First 5 duplicate IDs:', dupeIds.slice(0, 5));
  }
}

checkDupes().catch(console.error);
