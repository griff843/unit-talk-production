const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkGameTimes() {
  try {
    console.log('🕐 Checking game time data...\n');

    const { data: games, error } = await supabase
      .from('games')
      .select(
        'id, home_team, away_team, start_time, commence_time, game_date, display_time, game_time_local, formatted_time'
      )
      .limit(5);

    if (error) {
      console.log('❌ Error:', error);
      return;
    }

    console.log(`📊 Found ${games.length} games with time data:`);
    games.forEach((game, i) => {
      console.log(`\n${i + 1}. ${game.home_team} vs ${game.away_team}:`);
      console.log(`   start_time: ${game.start_time}`);
      console.log(`   commence_time: ${game.commence_time}`);
      console.log(`   game_date: ${game.game_date}`);
      console.log(`   display_time: ${game.display_time}`);
      console.log(`   game_time_local: ${game.game_time_local}`);
      console.log(`   formatted_time: ${game.formatted_time}`);
    });

    // Test EST conversion
    console.log(`\n🕐 Testing EST time conversion:`);
    const now = new Date();
    console.log(`Current time: ${now.toISOString()}`);
    console.log(`EST time: ${now.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
    console.log(
      `EST time (12h): ${now.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })}`
    );

    // Test parsing common time formats
    const testTimes = ['2025-08-02T19:00:00Z', '2025-08-02 19:00:00', '7:00 PM'];
    console.log(`\n🧪 Testing time format conversion:`);
    testTimes.forEach(timeStr => {
      try {
        const date = new Date(timeStr);
        if (!isNaN(date.getTime())) {
          const estTime = date.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
          console.log(`  ${timeStr} → ${estTime} EST`);
        } else {
          console.log(`  ${timeStr} → Invalid date format`);
        }
      } catch (error) {
        console.log(`  ${timeStr} → Error: ${error.message}`);
      }
    });
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

checkGameTimes();
