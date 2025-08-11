import { fetchEvents, fetchPlayerProps } from '../src/agents/FeedAgent/optimal';
import 'dotenv/config';

/**
 * TEST OPTIMAL PLAYER DATA
 * 
 * Test what player data we can extract from Optimal API for database population
 */

async function testOptimalPlayerData() {
  console.log('👥 TESTING OPTIMAL PLAYER DATA EXTRACTION');
  console.log('='.repeat(60));

  try {
    // Get all available events
    console.log('\n📡 Fetching available events...');
    const events = await fetchEvents();
    
    if (events.length === 0) {
      console.log('❌ No events found');
      return;
    }

    console.log(`✅ Found ${events.length} total events`);

    // Group by league
    const eventsByLeague: Record<string, any[]> = {};
    events.forEach(event => {
      if (!eventsByLeague[event.league]) {
        eventsByLeague[event.league] = [];
      }
      eventsByLeague[event.league].push(event);
    });

    // Test player data extraction for each league
    for (const [league, leagueEvents] of Object.entries(eventsByLeague)) {
      console.log(`\n🏆 TESTING ${league} PLAYER DATA...`);
      console.log('-'.repeat(40));
      
      // Test first event for this league
      const testEvent = leagueEvents[0];
      console.log(`📅 Testing event: ${testEvent.away} @ ${testEvent.home} (ID: ${testEvent.id})`);
      
      try {
        const playerProps = await fetchPlayerProps(league, testEvent.id);
        
        if (playerProps.length === 0) {
          console.log(`❌ No player props found for ${league} event ${testEvent.id}`);
          continue;
        }

        console.log(`✅ Found ${playerProps.length} player props for ${league}`);
        
        // Extract unique players
        const uniquePlayers = new Map();
        playerProps.forEach(prop => {
          const key = `${prop.player_id}-${prop.player_name}`;
          if (!uniquePlayers.has(key)) {
            uniquePlayers.set(key, {
              player_id: prop.player_id,
              player_name: prop.player_name,
              team: prop.team,
              sport: league
            });
          }
        });

        console.log(`👥 UNIQUE PLAYERS IN ${league}:`);
        const playersArray = Array.from(uniquePlayers.values());
        playersArray.slice(0, 10).forEach((player, index) => {
          console.log(`  ${index + 1}. ${player.player_name} (${player.team}) [ID: ${player.player_id}]`);
        });
        
        if (playersArray.length > 10) {
          console.log(`  ... and ${playersArray.length - 10} more players`);
        }

        console.log(`\n📊 ${league} SUMMARY:`);
        console.log(`  🎯 Total Props: ${playerProps.length}`);
        console.log(`  👥 Unique Players: ${playersArray.length}`);
        console.log(`  🏈 Teams: ${new Set(playersArray.map(p => p.team)).size}`);
        
        // Sample prop types for this league
        const propTypes = new Set(playerProps.map(prop => prop.prop_type));
        console.log(`  📈 Prop Types: ${propTypes.size} (${Array.from(propTypes).slice(0, 5).join(', ')}${propTypes.size > 5 ? '...' : ''})`);

      } catch (error) {
        console.log(`❌ Error fetching player data for ${league}:`, error instanceof Error ? error.message : error);
      }

      // Small delay between league tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 OPTIMAL PLAYER DATA ANALYSIS COMPLETE');
    console.log('='.repeat(60));

    console.log('\n💡 FINDINGS:');
    const availableLeagues = Object.keys(eventsByLeague);
    console.log(`✅ Available leagues for player population: ${availableLeagues.join(', ')}`);
    
    console.log('\n📋 POPULATION SCRIPT RECOMMENDATIONS:');
    if (availableLeagues.includes('WNBA')) {
      console.log('  1. ✅ Create WNBA player population script - data available');
    }
    if (availableLeagues.includes('NFL')) {
      console.log('  2. ✅ Expand NFL database - additional players available');
    }
    if (availableLeagues.includes('MLB')) {
      console.log('  3. ✅ Verify MLB coverage - cross-reference with existing database');
    }
    
    console.log('\n❌ NOT AVAILABLE IN OPTIMAL API:');
    const missingLeagues = ['NBA', 'NHL', 'NCAAF'].filter(league => !availableLeagues.includes(league));
    missingLeagues.forEach(league => {
      console.log(`  ❌ ${league}: Check Odds API or other sources`);
    });

  } catch (error) {
    console.error('💥 Failed to test Optimal player data:', error);
  }
}

// Run the test
testOptimalPlayerData();