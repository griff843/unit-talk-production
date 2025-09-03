const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testRealProps() {
  try {
    // Get a real game ID first
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, home_team, away_team, league, sport')
      .limit(5);

    if (gamesError) {
      console.log('❌ Games error:', gamesError);
      return;
    }

    console.log('🎯 Available games:');
    games.forEach((game, i) => {
      console.log(
        `  ${i + 1}. ${game.id} - ${game.home_team} vs ${game.away_team} (${game.league || game.sport})`
      );
    });

    if (games.length > 0) {
      // Find an MLB game for testing
      const mlbGame = games.find(game => game.league === 'MLB') || games[0];
      const testGameId = mlbGame.id;
      console.log(`\n🔍 Testing props for ${mlbGame.league} game: ${testGameId}`);

      // Test the props API endpoint
      const response = await fetch(
        `http://localhost:3002/api/props?game_id=${testGameId}&sport=${mlbGame.league || mlbGame.sport}&prop_type=player_props`
      );
      const propsData = await response.json();

      console.log('📊 Props API response:');
      console.log(`  Success: ${propsData.success}`);
      console.log(`  Count: ${propsData.count}`);
      console.log(`  Source: ${propsData.source}`);

      if (propsData.props && propsData.props.length > 0) {
        console.log('\n🎲 Sample props:');
        propsData.props.slice(0, 3).forEach((prop, i) => {
          console.log(`  ${i + 1}. ${prop.display_name} (${prop.team})`);
        });
      }

      // Also check if there are actual props in the database
      const { data: dbProps, error: propsError } = await supabase
        .from('raw_props')
        .select('*')
        .eq('game_id', testGameId)
        .limit(5);

      if (!propsError && dbProps) {
        console.log(`\n🗃️ Database props for this game: ${dbProps.length}`);
        dbProps.forEach((prop, i) => {
          console.log(`  ${i + 1}. ${prop.prop_type} - Line: ${prop.line} - Odds: ${prop.odds}`);
        });
      } else if (propsError) {
        console.log('⚠️ Database props error:', propsError.message);
      }
    }
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

testRealProps();
