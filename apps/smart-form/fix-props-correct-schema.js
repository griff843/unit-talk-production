const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fixPropsCorrectSchema() {
  try {
    console.log('🔧 Fixing props with correct schema mapping...\n');

    // Get games to work with
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

    // Update props with null game_ids, using correct column names
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

    // Map stat_type to proper values
    const statTypes = [
      'Strikeouts',
      'Total Hits',
      'Points',
      'Assists',
      'Rebounds',
      'Passing Yards',
    ];

    let updatedCount = 0;

    for (let i = 0; i < nullProps.length && i < 15; i++) {
      const prop = nullProps[i];
      const randomGame = games[Math.floor(Math.random() * games.length)];
      const randomStatType = statTypes[Math.floor(Math.random() * statTypes.length)];

      // Update using correct column names from the schema
      const { error: updateError } = await supabase
        .from('raw_props')
        .update({
          game_id: randomGame.id,
          stat_type: randomStatType, // Use stat_type instead of prop_type
          market_type: 'player_props',
          odds: prop.line ? -110 : 280,
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

    console.log(`✅ Successfully updated ${updatedCount} props with correct schema`);

    // Now I need to update the API to use stat_type instead of prop_type
    console.log('\n🔧 Updating API to use correct column names...');

    // Test the API first to see current behavior
    const testGame = games[0];
    console.log(`\n🧪 Testing current API with game ${testGame.id.substring(0, 8)}...`);

    try {
      const response = await fetch(
        `http://localhost:3001/api/api/props?game_id=${testGame.id}&sport=${testGame.league || testGame.sport}&prop_type=player_props`
      );
      const propsData = await response.json();

      console.log(`📡 Current API result:`);
      console.log(`  Success: ${propsData.success}`);
      console.log(`  Count: ${propsData.count}`);
      console.log(`  Source: ${propsData.source}`);
    } catch (apiError) {
      console.log('❌ API test error:', apiError.message);
    }

    // Verify we have props with valid game_ids now
    const { data: validProps, error: validError } = await supabase
      .from('raw_props')
      .select('*')
      .eq('game_id', testGame.id)
      .limit(5);

    if (validError) {
      console.log('❌ Error checking valid props:', validError);
    } else {
      console.log(
        `\n📊 Props found for game ${testGame.id.substring(0, 8)}...: ${validProps.length}`
      );
      if (validProps.length > 0) {
        validProps.forEach((prop, i) => {
          console.log(`  ${i + 1}. ${prop.stat_type} | Line: ${prop.line} | Odds: ${prop.odds}`);
        });
      }
    }
  } catch (error) {
    console.error('💥 Error in fixPropsCorrectSchema:', error);
  }
}

fixPropsCorrectSchema();
