const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Test the EST conversion function
function formatTimeInEST(date) {
  const gameTime = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(gameTime.getTime())) {
    return 'TBD';
  }

  return gameTime.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

async function testESTConversion() {
  try {
    console.log('🧪 Testing EST timezone conversion...\n');

    // Get some games with commence_time
    const { data: games, error } = await supabase
      .from('games')
      .select('id, home_team, away_team, commence_time, start_time')
      .not('commence_time', 'is', null)
      .limit(3);

    if (error) {
      console.log('❌ Error:', error);
      return;
    }

    console.log(`📊 Testing EST conversion on ${games.length} games:`);

    games.forEach((game, i) => {
      console.log(`\n${i + 1}. ${game.home_team} vs ${game.away_team}:`);
      console.log(`   Raw commence_time: ${game.commence_time}`);

      const estTime = formatTimeInEST(game.commence_time);
      console.log(`   EST formatted: ${estTime} EST`);

      // Also test with a Date object
      const gameDate = new Date(game.commence_time);
      console.log(`   UTC date object: ${gameDate.toISOString()}`);
      console.log(`   EST from date: ${formatTimeInEST(gameDate)} EST`);
    });

    // Test current time
    console.log(`\n🕐 Current time comparison:`);
    const now = new Date();
    console.log(`   Current UTC: ${now.toISOString()}`);
    console.log(`   Current EST: ${formatTimeInEST(now)} EST`);

    // Test edge cases
    console.log(`\n🧪 Edge case testing:`);
    console.log(`   Invalid date: ${formatTimeInEST('invalid')}`);
    console.log(`   Null: ${formatTimeInEST(null)}`);
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

testESTConversion();
