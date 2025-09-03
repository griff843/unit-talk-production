const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testPropsDetailed() {
  console.log('🧪 Testing props selection issue...\n');

  // Test the exact API call the frontend makes
  const gameId = '9a134e77-d3e5-4e7f-9697-347cadb27fab';

  console.log(`Testing props for game: ${gameId}`);

  // Direct database query - same as API
  const { data: dbProps, error } = await supabase
    .from('raw_props')
    .select(
      `
      id,
      game_id,
      player_id,
      stat_type,
      market_type,
      line,
      odds,
      player_name,
      team
    `
    )
    .eq('game_id', gameId)
    .eq('market_type', 'player_props')
    .order('stat_type')
    .order('line');

  if (error) {
    console.log('❌ Database Error:', error);
    return;
  }

  console.log(`📊 Raw database results: ${dbProps.length} props found`);

  if (dbProps.length > 0) {
    console.log('\nRaw props:');
    dbProps.forEach((prop, i) => {
      console.log(`  ${i + 1}. Player: ${prop.player_name || 'Unknown'}`);
      console.log(`     Stat: ${prop.stat_type}`);
      console.log(`     Line: ${prop.line}`);
      console.log(`     Odds: ${prop.odds}`);
      console.log(`     Team: ${prop.team}`);
      console.log('');
    });

    // Transform exactly like API does
    const transformedProps = dbProps.map(prop => ({
      id: prop.id,
      game_id: prop.game_id,
      player_name: prop.player_name || 'Unknown Player',
      team: prop.team || 'UNK',
      prop_type: prop.stat_type,
      market_type: prop.market_type,
      line: prop.line,
      over_odds: prop.odds > 0 ? `+${prop.odds}` : prop.odds,
      under_odds: prop.odds > 0 ? `-${Math.abs(prop.odds) + 20}` : `+${Math.abs(prop.odds) - 20}`,
      display_name: `${prop.player_name || 'Unknown'} ${prop.stat_type}${prop.line ? ` ${prop.line}` : ''}`,
      selection_options: prop.line
        ? [
            { value: 'over', label: `Over ${prop.line}`, odds: prop.odds },
            {
              value: 'under',
              label: `Under ${prop.line}`,
              odds: prop.odds > 0 ? -(Math.abs(prop.odds) + 20) : Math.abs(prop.odds) - 20,
            },
          ]
        : [
            { value: 'yes', label: 'Yes', odds: prop.odds },
            {
              value: 'no',
              label: 'No',
              odds: prop.odds > 0 ? -(Math.abs(prop.odds) + 20) : Math.abs(prop.odds) - 20,
            },
          ],
    }));

    console.log('\n🔄 Transformed props (as frontend receives):');
    transformedProps.forEach((prop, i) => {
      console.log(`  ${i + 1}. ${prop.display_name}`);
      console.log(`     Selection options:`);
      prop.selection_options.forEach(option => {
        console.log(`       - ${option.label}: ${option.odds}`);
      });
      console.log('');
    });

    // Test what the API endpoint would return
    const apiResponse = {
      success: true,
      props: transformedProps,
      count: transformedProps.length,
      source: 'database',
    };

    console.log('✅ API would return:');
    console.log(JSON.stringify(apiResponse, null, 2));
  } else {
    console.log('❌ No props found for this game');

    // Check if game exists
    const { data: game } = await supabase
      .from('games')
      .select('id, home_team, away_team, league')
      .eq('id', gameId);

    if (game && game.length > 0) {
      console.log(`Game exists: ${game[0].away_team} @ ${game[0].home_team} (${game[0].league})`);
    } else {
      console.log('Game not found in database');
    }

    // Check what props exist for any game
    const { data: anyProps } = await supabase
      .from('raw_props')
      .select('game_id, player_name, stat_type')
      .limit(5);

    console.log('\nSample props in database:');
    anyProps?.forEach(prop => {
      console.log(`  Game: ${prop.game_id}, Player: ${prop.player_name}, Stat: ${prop.stat_type}`);
    });
  }
}

testPropsDetailed();
