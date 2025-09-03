const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkGameTimes() {
  try {
    console.log('🕐 Checking for games with time data...\n');

    // Check for any games with non-null time fields
    const { data: gamesWithTime, error } = await supabase
      .from('games')
      .select('id, home_team, away_team, start_time, commence_time, game_date, created_at')
      .not('start_time', 'is', null)
      .limit(5);

    console.log('Games with start_time:', gamesWithTime?.length || 0);

    if (gamesWithTime && gamesWithTime.length > 0) {
      gamesWithTime.forEach((game, i) => {
        console.log(`${i + 1}. ${game.home_team} vs ${game.away_team}`);
        console.log(`   start_time: ${game.start_time}`);
        console.log(`   commence_time: ${game.commence_time}`);
        console.log(`   game_date: ${game.game_date}`);
      });
    }

    // Check for commence_time
    const { data: gamesWithCommence } = await supabase
      .from('games')
      .select('id, home_team, away_team, start_time, commence_time, game_date')
      .not('commence_time', 'is', null)
      .limit(5);

    console.log('\nGames with commence_time:', gamesWithCommence?.length || 0);

    if (gamesWithCommence && gamesWithCommence.length > 0) {
      gamesWithCommence.forEach((game, i) => {
        console.log(`${i + 1}. ${game.home_team} vs ${game.away_team}`);
        console.log(`   commence_time: ${game.commence_time}`);

        // Test EST conversion
        const date = new Date(game.commence_time);
        const estTime = date.toLocaleString('en-US', {
          timeZone: 'America/New_York',
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        console.log(`   EST: ${estTime}`);
      });
    }

    // Check game_date
    const { data: gamesWithDate } = await supabase
      .from('games')
      .select('id, home_team, away_team, game_date')
      .not('game_date', 'is', null)
      .limit(5);

    console.log('\nGames with game_date:', gamesWithDate?.length || 0);

    if (gamesWithDate && gamesWithDate.length > 0) {
      gamesWithDate.forEach((game, i) => {
        console.log(`${i + 1}. ${game.home_team} vs ${game.away_team}`);
        console.log(`   game_date: ${game.game_date}`);
      });
    }

    // Test current time EST conversion
    console.log('\n🧪 Testing EST time conversion:');
    const now = new Date();
    console.log(`Current UTC: ${now.toISOString()}`);
    console.log(
      `EST: ${now.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })}`
    );
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

checkGameTimes();
