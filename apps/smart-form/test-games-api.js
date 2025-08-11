const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Test the updated fetchGames function
async function testGamesAPI() {
  try {
    console.log('🧪 Testing fetchGames with EST timezone conversion...\n');

    // Import the fetchGames function
    const { fetchGames } = require('./lib/supabase-queries.ts');

    // Test with NBA games for tomorrow (July 30, 2025)
    const games = await fetchGames('NBA', '2025-07-30', '2025-07-30');

    if (games && games.length > 0) {
      console.log(`✅ Found ${games.length} NBA games with EST times:`);

      games.forEach((game, i) => {
        console.log(`\n${i + 1}. ${game.matchup}:`);
        console.log(`   Raw commence_time: ${game.commence_time}`);
        console.log(`   Formatted time: ${game.formatted_time}`);
        console.log(`   Display time: ${game.display_time}`);
        console.log(`   Game time local: ${game.game_time_local}`);
        console.log(`   Is live: ${game.is_live}`);
        console.log(`   Live status: ${game.live_status}`);
      });
    } else {
      console.log('❌ No games found');
    }
  } catch (error) {
    console.error('💥 Error testing games API:', error);
  }
}

testGamesAPI();
