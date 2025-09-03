const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkTodaysGames() {
  try {
    console.log('🔍 Checking total games in database...');

    const { data: allGames, error } = await supabase
      .from('games')
      .select('sport, home_team, away_team, created_at, updated_at, league')
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error) {
      console.log('❌ Error:', error);
      return;
    }

    console.log('📊 Found', allGames?.length || 0, 'recent games');

    if (allGames && allGames.length > 0) {
      console.log('🎯 Recent games available:');
      allGames.forEach((game, index) => {
        console.log(
          `  ${index + 1}. ${game.league || game.sport} - ${game.home_team} vs ${game.away_team}`
        );
      });
    }

    // Check by sport
    const { data: sportCounts, error: sportError } = await supabase
      .from('games')
      .select('sport, league')
      .limit(1000);

    if (!sportError && sportCounts) {
      const counts = {};
      sportCounts.forEach(game => {
        const sport = game.league || game.sport;
        counts[sport] = (counts[sport] || 0) + 1;
      });

      console.log('\n📅 Games by sport:');
      Object.entries(counts).forEach(([sport, count]) => {
        console.log(`  ${sport}: ${count} games`);
      });
    }
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

checkTodaysGames();
