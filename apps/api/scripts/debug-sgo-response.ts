#!/usr/bin/env node

/**
 * DEBUG SGO RESPONSE - Check what data structure we get from SGO API
 */

import axios from 'axios';

const SGO_API_KEY = process.env.SGO_API_KEY || process.env.SPORTSGAMEODDS_KEY;

async function debugSGOResponse() {
  if (!SGO_API_KEY) {
    console.error('❌ SGO_API_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🔍 DEBUGGING SGO API RESPONSE');
  console.log('🔑 API Key:', SGO_API_KEY.substring(0, 8) + '...');
  console.log('');

  try {
    const url = 'https://api.sportsgameodds.com/v2/events';

    // Test MLB data with user-provided parameters
    const params = {
      apiKey: SGO_API_KEY,
      leagueID: 'MLB',
      startsAfter: '2024-03-28T07:00:00Z',
      startsBefore: '2024-09-30T06:59:59Z',
      includeAltLine: true,
      finalized: true,
      limit: 1 // Just get one event for debugging
    };

    console.log('📡 Fetching MLB event with params:', params);
    const response = await axios.get(url, { params });

    if (response.data?.success && Array.isArray(response.data?.data)) {
      console.log(`✅ Got ${response.data.data.length} events`);

      if (response.data.data.length > 0) {
        const event = response.data.data[0];
        console.log('\n🎮 EVENT STRUCTURE:');
        console.log('📊 Keys:', Object.keys(event));
        console.log('🆔 Event ID:', event.eventID);
        console.log('🏆 League:', event.leagueID);
        console.log('📅 Starts At:', event.startsAt);

        if (event.teams) {
          console.log('\n👥 TEAMS:');
          console.log('🏠 Home:', JSON.stringify(event.teams.home, null, 2));
          console.log('🚌 Away:', JSON.stringify(event.teams.away, null, 2));
        }

        if (event.players) {
          console.log('\n👤 PLAYERS (first 3):');
          const playerKeys = Object.keys(event.players).slice(0, 3);
          playerKeys.forEach(key => {
            console.log(`${key}:`, JSON.stringify(event.players[key], null, 2));
          });
        }

        if (event.odds) {
          console.log('\n💰 ODDS (first 5):');
          const oddsKeys = Object.keys(event.odds).slice(0, 5);
          oddsKeys.forEach(key => {
            console.log(`${key}:`, JSON.stringify(event.odds[key], null, 2));
          });
        }

        if (event.results) {
          console.log('\n📊 RESULTS:');
          console.log('Keys:', Object.keys(event.results));
          const resultKeys = Object.keys(event.results).slice(0, 3);
          resultKeys.forEach(key => {
            console.log(`${key}:`, JSON.stringify(event.results[key], null, 2));
          });
        }

        // Write full event to file for inspection
        const fs = require('fs');
        fs.writeFileSync('./debug-sgo-event.json', JSON.stringify(event, null, 2));
        console.log('\n💾 Full event saved to debug-sgo-event.json');
      }
    } else {
      console.log('❌ No data returned or invalid response');
      console.log('Response:', JSON.stringify(response.data, null, 2));
    }

  } catch (error: any) {
    console.error('❌ Error:', error.response?.status, error.response?.data || error.message);
  }
}

if (require.main === module) {
  debugSGOResponse().catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}