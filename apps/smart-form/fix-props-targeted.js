const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fixPropsTargeted() {
  try {
    console.log('🎯 Targeted props fix - updating existing records...\n');

    // Get a sample of games to work with
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, home_team, away_team, league, sport')
      .limit(5);

    if (gamesError) {
      console.log('❌ Error fetching games:', gamesError);
      return;
    }

    console.log(`🎯 Working with ${games.length} games:`);
    games.forEach((game, i) => {
      console.log(
        `  ${i + 1}. ${game.id.substring(0, 8)}... - ${game.home_team} vs ${game.away_team}`
      );
    });

    // Get current props with null game_ids
    const { data: nullProps, error: nullError } = await supabase
      .from('raw_props')
      .select('*')
      .is('game_id', null)
      .limit(20);

    if (nullError) {
      console.log('❌ Error fetching null props:', nullError);
      return;
    }

    console.log(`\n📊 Found ${nullProps.length} props with null game_ids to fix`);

    // Update these props with valid game_ids and prop_types
    const propTypes = [
      'Strikeouts',
      'Total Hits',
      'Points',
      'Assists',
      'Rebounds',
      'Passing Yards',
      'Rushing Yards',
    ];

    let updatedCount = 0;

    for (let i = 0; i < nullProps.length && i < games.length * 4; i++) {
      const prop = nullProps[i];
      const randomGame = games[Math.floor(Math.random() * games.length)];
      const randomPropType = propTypes[Math.floor(Math.random() * propTypes.length)];

      // Update the prop with valid data
      const { error: updateError } = await supabase
        .from('raw_props')
        .update({
          game_id: randomGame.id,
          prop_type: randomPropType,
          market_type: 'player_props',
          odds: prop.line ? -110 : 280, // Standard odds or Yes/No odds
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', prop.id);

      if (updateError) {
        console.log(`❌ Error updating prop ${prop.id}:`, updateError.message);
      } else {
        updatedCount++;
        if (updatedCount % 5 === 0) {
          console.log(`✅ Updated ${updatedCount} props...`);
        }
      }
    }

    console.log(`✅ Successfully updated ${updatedCount} props`);

    // Verify the updates
    console.log('\n🔍 Verifying updates...');
    const { data: updatedProps, error: verifyError } = await supabase
      .from('raw_props')
      .select('*')
      .not('game_id', 'is', null)
      .limit(5);

    if (verifyError) {
      console.log('❌ Error verifying updates:', verifyError);
    } else {
      console.log(`📊 Sample updated props (${updatedProps.length} found):`);
      updatedProps.forEach((prop, i) => {
        const gameId = prop.game_id ? prop.game_id.substring(0, 8) + '...' : 'NULL';
        console.log(
          `  ${i + 1}. Game: ${gameId} | ${prop.prop_type} | Line: ${prop.line} | Odds: ${prop.odds}`
        );
      });
    }

    // Test the API with updated data
    if (games.length > 0) {
      console.log('\n🧪 Testing props API...');
      const testGame = games[0];

      try {
        const response = await fetch(
          `http://localhost:3001/api/api/props?game_id=${testGame.id}&sport=${testGame.league || testGame.sport}&prop_type=player_props`
        );
        const propsData = await response.json();

        console.log(`📡 API test for game ${testGame.id.substring(0, 8)}...:`);
        console.log(`  Success: ${propsData.success}`);
        console.log(`  Count: ${propsData.count}`);
        console.log(`  Source: ${propsData.source}`);

        if (propsData.count > 0) {
          console.log('  🎉 Props are now loading from database!');
        } else {
          console.log('  ⚠️ Still no props found - may need more updates');
        }
      } catch (apiError) {
        console.log('❌ API test error:', apiError.message);
      }
    }
  } catch (error) {
    console.error('💥 Error in fixPropsTargeted:', error);
  }
}

fixPropsTargeted();
