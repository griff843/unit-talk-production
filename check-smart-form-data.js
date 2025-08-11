// Quick database check for Smart Form data availability
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSmartFormData() {
  console.log('🔍 Checking Smart Form Database Integration...\n');

  try {
    // Check cappers (should be "users" table in v3.0.0)
    console.log('👤 Checking cappers/users...');
    const { data: users, error: usersError } = await supabase.from('users').select('*').limit(5);

    if (usersError) {
      console.error('❌ Users query error:', usersError);
    } else {
      console.log(`✅ Found ${users?.length || 0} users/cappers`);
      if (users?.length > 0) {
        console.log('   Sample users:', users.map(u => `${u.username} (${u.tier})`).join(', '));
      }
    }

    // Check games for today
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n🏀 Checking games for ${today}...`);
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'MLB')
      .gte('game_date', today)
      .lte('game_date', today)
      .limit(5);

    if (gamesError) {
      console.error('❌ Games query error:', gamesError);
    } else {
      console.log(`✅ Found ${games?.length || 0} MLB games for today`);
      if (games?.length > 0) {
        console.log(
          '   Sample games:',
          games.map(g => `${g.away_team} @ ${g.home_team}`).join(', ')
        );
      }
    }

    // Check any games in the system
    console.log('\n🎯 Checking all games in system...');
    const { data: allGames, error: allGamesError } = await supabase
      .from('games')
      .select('sport, game_date')
      .limit(10);

    if (allGamesError) {
      console.error('❌ All games query error:', allGamesError);
    } else {
      console.log(`✅ Total games in system: ${allGames?.length || 0}`);
      if (allGames?.length > 0) {
        const sportCounts = allGames.reduce((acc, game) => {
          acc[game.sport] = (acc[game.sport] || 0) + 1;
          return acc;
        }, {});
        console.log('   Sports breakdown:', sportCounts);

        const dates = [...new Set(allGames.map(g => g.game_date))].sort();
        console.log('   Date range:', dates[0], 'to', dates[dates.length - 1]);
      }
    }

    // Check raw_props for data
    console.log('\n📊 Checking raw_props data...');
    const { data: props, error: propsError } = await supabase
      .from('raw_props')
      .select('*')
      .limit(5);

    if (propsError) {
      console.error('❌ Raw props query error:', propsError);
    } else {
      console.log(`✅ Found ${props?.length || 0} props in raw_props table`);
      if (props?.length > 0) {
        console.log(
          '   Sample props:',
          props.map(p => `${p.player_name} ${p.stat_type} ${p.line}`).join(', ')
        );
      }
    }

    // Test the specific query the Smart Form uses
    console.log('\n🔍 Testing Smart Form capper query...');
    const { data: cappers, error: cappersError } = await supabase
      .from('users')
      .select('username, tier, discord_id')
      .eq('active', true)
      .order('username');

    if (cappersError) {
      console.error('❌ Cappers query error:', cappersError);
    } else {
      console.log(`✅ Active cappers: ${cappers?.length || 0}`);
      if (cappers?.length > 0) {
        cappers.forEach(c =>
          console.log(`   - ${c.username} (${c.tier}) - Discord: ${c.discord_id}`)
        );
      }
    }
  } catch (error) {
    console.error('💥 Database connection error:', error);
  }
}

checkSmartFormData()
  .then(() => {
    console.log('\n🔍 Database check complete!');
    process.exit(0);
  })
  .catch(console.error);
