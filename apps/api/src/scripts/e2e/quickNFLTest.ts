#!/usr/bin/env tsx
/**
 * Quick NFL test - fetch just the Thursday Night Football game
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import axios from 'axios';

async function quickTest() {
  console.log('\n═══ QUICK NFL DATA CHECK ═══\n');

  // Direct Odds API call to check what NFL games exist for Oct 2
  const apiKey = process.env.ODDS_API_KEY;
  const url = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events?apiKey=${apiKey}&dateFormat=iso`;

  try {
    const response = await axios.get(url);
    const events = response.data;

    console.log(`Total NFL events available: ${events.length}\n`);

    // Filter for Oct 2, 2025
    const oct2Events = events.filter((e: any) => {
      const gameDate = new Date(e.commence_time);
      return gameDate.toISOString().startsWith('2025-10-02');
    });

    console.log(`NFL games on Oct 2, 2025: ${oct2Events.length}\n`);

    if (oct2Events.length > 0) {
      console.log('Oct 2 NFL games:');
      oct2Events.forEach((e: any) => {
        console.log(`  ${e.commence_time} | ${e.away_team} @ ${e.home_team}`);
        console.log(`    ID: ${e.id}`);
      });
    } else {
      console.log('⚠️  No NFL games found for Oct 2, 2025');
      console.log('\nShowing first 5 upcoming NFL games:');
      events.slice(0, 5).forEach((e: any) => {
        console.log(`  ${e.commence_time} | ${e.away_team} @ ${e.home_team}`);
      });
    }

    console.log('\n');
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

quickTest();
