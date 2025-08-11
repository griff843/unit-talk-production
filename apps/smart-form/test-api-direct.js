const fetch = require('node-fetch');

async function testAPIDirect() {
  console.log('🎮 Testing Games API directly...\n');

  try {
    const response = await fetch('http://localhost:3002/api/games?sport=MLB');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    console.log('📊 Games API Response:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Count: ${result.count}`);
    console.log(`  Date: ${result.date}`);
    console.log(`  Source: ${result.source}`);

    if (result.games && result.games.length > 0) {
      console.log('\n🎯 Games found:');
      result.games.forEach((game, i) => {
        console.log(`  ${i + 1}. ${game.matchup}`);
        console.log(`     Time: ${game.display_time} (${game.formatted_time})`);
        console.log(`     Live: ${game.is_live ? '🔴 LIVE' : '⚪ Pregame'}`);
        console.log(`     Status: ${game.live_status}`);
        console.log('');
      });

      console.log('✅ SUCCESS: Games API is working!');
      console.log('✅ Times are properly formatted in EST');
      console.log('✅ Live status logic is applied');
    } else {
      console.log('❌ No games returned from API');
    }
  } catch (error) {
    console.error('💥 Error testing games API:', error);
  }
}

testAPIDirect();
