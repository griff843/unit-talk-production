/**
 * Test Optimal API with Actual Events
 * Use the real events to fetch player props and see the odds structure
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

async function testOptimalAPIWithEvents() {
  console.log('🔍 TESTING OPTIMAL API WITH REAL EVENTS');
  console.log('='.repeat(60));

  const apiKey = process.env.OPTIMAL_API_KEY;

  if (!apiKey) {
    console.log('❌ OPTIMAL_API_KEY not found');
    return;
  }

  const baseUrl = 'https://api.optimal-bet.com';

  try {
    // First get events
    const eventsResponse = await axios.get(`${baseUrl}/v1/events`, {
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    console.log(`✅ Found ${eventsResponse.data.events.length} events`);

    // Group events by league
    const eventsByLeague: Record<string, any[]> = {};
    eventsResponse.data.events.forEach((event: any) => {
      if (!eventsByLeague[event.league]) {
        eventsByLeague[event.league] = [];
      }
      eventsByLeague[event.league].push(event);
    });

    console.log('\n📊 Events by league:');
    Object.entries(eventsByLeague).forEach(([league, events]) => {
      console.log(`   ${league}: ${events.length} games`);
    });

    // Test with MLB events first
    const mlbEvents = eventsByLeague['MLB'] || [];
    if (mlbEvents.length === 0) {
      console.log('\n❌ No MLB events found today');

      // Try any available events
      const allEvents = eventsResponse.data.events;
      if (allEvents.length > 0) {
        console.log(`\n🔄 Testing with ${allEvents[0].league} event instead...`);
        await testEventProps(allEvents[0], apiKey, baseUrl);
      }
      return;
    }

    console.log(`\n🎯 Testing with first MLB event: ${mlbEvents[0].id}`);
    await testEventProps(mlbEvents[0], apiKey, baseUrl);
  } catch (error: any) {
    console.error('❌ Error testing API:', error.message);
  }
}

async function testEventProps(event: any, apiKey: string, baseUrl: string) {
  console.log(`\n🔍 FETCHING PROPS FOR EVENT: ${event.id}`);
  console.log(`   ${event.away_display} @ ${event.home_display} (${event.league})`);
  console.log(`   Start: ${event.start_date}`);

  try {
    const propsResponse = await axios.get(`${baseUrl}/v1/playerProps/${event.league}`, {
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      params: {
        eventId: event.id,
      },
    });

    console.log(`✅ Props API Response: ${propsResponse.status}`);
    console.log(`📊 Response size: ${JSON.stringify(propsResponse.data).length} bytes`);

    if (propsResponse.data.players && Array.isArray(propsResponse.data.players)) {
      console.log(`📋 Found ${propsResponse.data.players.length} players with props`);

      if (propsResponse.data.players.length > 0) {
        const samplePlayer = propsResponse.data.players[0];
        console.log('\n📖 Sample player data structure:');
        console.log('   Available fields:', Object.keys(samplePlayer).sort());

        if (samplePlayer.offers && Array.isArray(samplePlayer.offers)) {
          console.log(`   Player: ${samplePlayer.name} (${samplePlayer.team})`);
          console.log(`   Offers: ${samplePlayer.offers.length}`);

          if (samplePlayer.offers.length > 0) {
            const sampleOffer = samplePlayer.offers[0];
            console.log('\n🎯 Sample offer structure:');
            console.log('   Available fields:', Object.keys(sampleOffer).sort());

            // Look for odds fields specifically
            const oddsFields = Object.keys(sampleOffer).filter(
              key =>
                key.includes('odds') ||
                key.includes('Over') ||
                key.includes('Under') ||
                key.includes('price')
            );

            console.log('\n💰 ODDS DATA FOUND:');
            oddsFields.forEach(field => {
              console.log(`   ${field}: ${sampleOffer[field]} (${typeof sampleOffer[field]})`);
            });

            console.log('\n📋 Complete sample offer:');
            console.log(JSON.stringify(sampleOffer, null, 2));

            // Check if we have multiple offers for line shopping
            if (samplePlayer.offers.length > 1) {
              console.log(
                `\n🏪 Multiple sportsbooks available: ${samplePlayer.offers.length} offers`
              );
              const books = [...new Set(samplePlayer.offers.map((o: any) => o.sportsbook))];
              console.log(`   Sportsbooks: ${books.join(', ')}`);
            }
          }
        }
      }
    } else {
      console.log('❌ Unexpected response structure');
      console.log(JSON.stringify(propsResponse.data, null, 2));
    }
  } catch (error: any) {
    console.error(`❌ Error fetching props for ${event.id}:`, error.message);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Response:`, error.response.data);
    }
  }
}

testOptimalAPIWithEvents()
  .then(() => {
    console.log('\n✅ OPTIMAL API EVENT TESTING COMPLETE');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Testing failed:', error);
    process.exit(1);
  });
