const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fixPropsData() {
  try {
    console.log('🔧 Analyzing and fixing raw_props data...\n');

    // First, let's see the current state
    const { data: currentProps, error: currentError } = await supabase
      .from('raw_props')
      .select('*')
      .limit(5);

    if (currentError) {
      console.log('❌ Error reading current props:', currentError);
      return;
    }

    console.log('📊 Current props table state:');
    if (currentProps && currentProps.length > 0) {
      console.log('Columns:', Object.keys(currentProps[0]));
      currentProps.forEach((prop, i) => {
        console.log(
          `  ${i + 1}. game_id: ${prop.game_id || 'NULL'}, prop_type: ${prop.prop_type || 'NULL'}, line: ${prop.line}, odds: ${prop.odds || 'NULL'}`
        );
      });
    }

    // Get available games to link props to
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, home_team, away_team, league, sport')
      .limit(10);

    if (gamesError) {
      console.log('❌ Error fetching games:', gamesError);
      return;
    }

    console.log(`\n🎯 Found ${games.length} games to link props to:`);
    games.forEach((game, i) => {
      console.log(
        `  ${i + 1}. ${game.id.substring(0, 8)}... - ${game.home_team} vs ${game.away_team} (${game.league || game.sport})`
      );
    });

    // Clear existing corrupted props and create fresh ones
    console.log('\n🗑️ Clearing corrupted props data...');
    const { error: deleteError } = await supabase
      .from('raw_props')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      console.log('❌ Error clearing props:', deleteError);
      return;
    }

    console.log('✅ Cleared existing props');

    // Create realistic props for each game
    console.log('\n📝 Creating fresh props data...');

    const propTypes = {
      MLB: [
        { type: 'Strikeouts', lines: [6.5, 7.5, 8.5, 9.5] },
        { type: 'Total Hits', lines: [1.5, 2.5] },
        { type: 'Total RBIs', lines: [1.5, 2.5] },
        { type: 'To Hit Home Run', lines: [null] }, // Yes/No prop
        { type: 'Total Runs', lines: [0.5, 1.5] },
      ],
      NBA: [
        { type: 'Points', lines: [25.5, 28.5, 32.5] },
        { type: 'Assists', lines: [6.5, 7.5, 8.5] },
        { type: 'Rebounds', lines: [9.5, 11.5, 13.5] },
        { type: 'Threes Made', lines: [2.5, 3.5, 4.5] },
        { type: 'Steals + Blocks', lines: [1.5, 2.5] },
      ],
      NFL: [
        { type: 'Passing Yards', lines: [275.5, 299.5, 325.5] },
        { type: 'Rushing Yards', lines: [65.5, 85.5, 105.5] },
        { type: 'Receiving Yards', lines: [55.5, 75.5, 95.5] },
        { type: 'Touchdowns', lines: [1.5, 2.5] },
        { type: 'Completions', lines: [22.5, 25.5, 28.5] },
      ],
      WNBA: [
        { type: 'Points', lines: [18.5, 22.5, 26.5] },
        { type: 'Assists', lines: [5.5, 6.5, 7.5] },
        { type: 'Rebounds', lines: [7.5, 9.5, 11.5] },
        { type: 'Threes Made', lines: [1.5, 2.5, 3.5] },
      ],
      NCAAF: [
        { type: 'Passing Yards', lines: [225.5, 275.5, 325.5] },
        { type: 'Rushing Yards', lines: [85.5, 125.5, 165.5] },
        { type: 'Total Touchdowns', lines: [1.5, 2.5, 3.5] },
      ],
    };

    const playerNames = {
      MLB: [
        'Mike Trout',
        'Aaron Judge',
        'Mookie Betts',
        'Ronald Acuña Jr.',
        'Juan Soto',
        'Gerrit Cole',
        'Jacob deGrom',
      ],
      NBA: [
        'LeBron James',
        'Stephen Curry',
        'Giannis Antetokounmpo',
        'Luka Dončić',
        'Jayson Tatum',
        'Nikola Jokić',
      ],
      NFL: [
        'Patrick Mahomes',
        'Josh Allen',
        'Lamar Jackson',
        'Aaron Rodgers',
        'Cooper Kupp',
        'Davante Adams',
      ],
      WNBA: [
        "A'ja Wilson",
        'Breanna Stewart',
        'Diana Taurasi',
        'Sabrina Ionescu',
        'Candace Parker',
      ],
      NCAAF: ['Star Quarterback', 'Elite Running Back', 'Top Receiver', 'Ace Linebacker'],
    };

    let propsCreated = 0;

    for (const game of games) {
      const sport = game.league || game.sport;
      const sportProps = propTypes[sport] || propTypes.MLB; // Fallback to MLB
      const sportPlayers = playerNames[sport] || playerNames.MLB;

      // Create 3-5 props per game
      const propsPerGame = Math.floor(Math.random() * 3) + 3; // 3-5 props

      for (let i = 0; i < propsPerGame; i++) {
        const randomPropType = sportProps[Math.floor(Math.random() * sportProps.length)];
        const randomPlayer = sportPlayers[Math.floor(Math.random() * sportPlayers.length)];
        const randomLine =
          randomPropType.lines[Math.floor(Math.random() * randomPropType.lines.length)];

        // Generate realistic odds
        const baseOdds = randomLine === null ? 280 : -110; // Yes/No props have higher odds
        const oddsVariation = Math.floor(Math.random() * 20) - 10; // ±10
        const finalOdds = baseOdds + oddsVariation;

        const newProp = {
          game_id: game.id,
          player_id: `player_${randomPlayer.replace(/[^a-zA-Z]/g, '').toLowerCase()}`,
          team_id: Math.random() > 0.5 ? game.home_team : game.away_team,
          prop_type: randomPropType.type,
          market_type: 'player_props',
          line: randomLine,
          odds: finalOdds,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: insertError } = await supabase.from('raw_props').insert(newProp);

        if (insertError) {
          console.log(
            `❌ Error inserting prop ${i + 1} for game ${game.id.substring(0, 8)}:`,
            insertError.message
          );
        } else {
          propsCreated++;
        }
      }
    }

    console.log(`✅ Created ${propsCreated} new props with proper game_id mappings`);

    // Verify the fix
    console.log('\n🔍 Verifying props fix...');
    const { data: verifyProps, error: verifyError } = await supabase
      .from('raw_props')
      .select('*')
      .limit(5);

    if (verifyError) {
      console.log('❌ Error verifying props:', verifyError);
    } else {
      console.log('📊 Sample fixed props:');
      verifyProps.forEach((prop, i) => {
        const gameId = prop.game_id ? prop.game_id.substring(0, 8) + '...' : 'NULL';
        console.log(
          `  ${i + 1}. Game: ${gameId} | ${prop.prop_type} | Line: ${prop.line} | Odds: ${prop.odds}`
        );
      });
    }

    // Test props API with a real game
    if (games.length > 0) {
      console.log('\n🧪 Testing props API with fixed data...');
      const testGameId = games[0].id;
      const testSport = games[0].league || games[0].sport;

      try {
        const response = await fetch(
          `http://localhost:3001/api/api/props?game_id=${testGameId}&sport=${testSport}&prop_type=player_props`
        );
        const propsData = await response.json();

        console.log(`📡 Props API test result:`);
        console.log(`  Success: ${propsData.success}`);
        console.log(`  Count: ${propsData.count}`);
        console.log(`  Source: ${propsData.source}`);

        if (propsData.props && propsData.props.length > 0) {
          console.log('  ✅ Props loading successfully!');
          propsData.props.slice(0, 2).forEach((prop, i) => {
            console.log(`    ${i + 1}. ${prop.display_name}`);
          });
        }
      } catch (fetchError) {
        console.log('❌ API test error:', fetchError.message);
      }
    }
  } catch (error) {
    console.error('💥 Error in fixPropsData:', error);
  }
}

fixPropsData();
