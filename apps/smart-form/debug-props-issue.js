const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function debugPropsIssue() {
  console.log('🔍 Debugging props issue...\n');

  try {
    // 1. Check what games are available today
    const today = new Date().toISOString().split('T')[0];
    console.log(`📅 Checking games for today: ${today}`);

    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, home_team, away_team, league, game_date, commence_time, start_time')
      .eq('league', 'MLB')
      .gte('game_date', today)
      .limit(5);

    if (gamesError) {
      console.log('❌ Games error:', gamesError);
      return;
    }

    console.log(`🎮 Found ${games?.length || 0} MLB games:`);
    games?.forEach((game, i) => {
      console.log(`  ${i + 1}. ${game.away_team} @ ${game.home_team} (ID: ${game.id})`);
      console.log(`     Date: ${game.game_date}, Commence: ${game.commence_time}`);
    });

    // 2. Check what props are available
    console.log('\n🎲 Checking available props...');

    const { data: props, error: propsError } = await supabase
      .from('raw_props')
      .select('id, game_id, external_game_id, player_name, stat_type, line, game_time')
      .limit(10);

    if (propsError) {
      console.log('❌ Props error:', propsError);
      return;
    }

    console.log(`🎯 Found ${props?.length || 0} props in raw_props table:`);
    props?.forEach((prop, i) => {
      console.log(`  ${i + 1}. ${prop.player_name} ${prop.stat_type} ${prop.line}`);
      console.log(`     Game ID: ${prop.game_id}, External: ${prop.external_game_id}`);
    });

    // 3. Check if any game IDs match
    console.log('\n🔗 Checking for matching game IDs...');

    if (games && props) {
      const gameIds = games.map(g => g.id);
      const propGameIds = [...new Set(props.map(p => p.game_id).filter(Boolean))];
      const propExternalIds = [...new Set(props.map(p => p.external_game_id).filter(Boolean))];

      console.log('Game IDs from games table:', gameIds);
      console.log('Game IDs from props table:', propGameIds);
      console.log('External game IDs from props:', propExternalIds);

      const matches = gameIds.filter(id => propGameIds.includes(id));
      console.log('Matching IDs:', matches);

      if (matches.length === 0) {
        console.log("❌ NO MATCHING GAME IDs - This is why props aren't loading!");

        // Try to find props by external_game_id matching
        const externalMatches = gameIds.filter(id => propExternalIds.includes(id));
        console.log('External ID matches:', externalMatches);

        if (externalMatches.length > 0) {
          console.log(
            '✅ Found matches via external_game_id - need to update props API to use this field'
          );
        }
      } else {
        console.log('✅ Found matching game IDs');
      }
    }

    // 4. Test a specific game ID
    if (games && games.length > 0) {
      const testGame = games[0];
      console.log(`\n🧪 Testing props for game: ${testGame.id}`);

      const { data: gameProps, error: gamePropsError } = await supabase
        .from('raw_props')
        .select('*')
        .eq('game_id', testGame.id);

      console.log(`Props for game ${testGame.id}:`, gameProps?.length || 0);

      // Also try external_game_id
      const { data: externalProps, error: externalPropsError } = await supabase
        .from('raw_props')
        .select('*')
        .eq('external_game_id', testGame.id);

      console.log(`Props via external_game_id ${testGame.id}:`, externalProps?.length || 0);
    }
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

debugPropsIssue();
