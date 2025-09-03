const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function populateV3TestData() {
  console.log('🚀 Populating v3 test data for Smart Form...\n');

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();

  try {
    // 1. Create test users/cappers if they don't exist
    console.log('1. Creating test cappers in users table...');
    const cappers = [
      {
        id: 'griff843-id',
        username: 'Griff843',
        discord_id: 'griff843#1234',
        role: 'elite_capper',
        tier: 'vip_plus',
        status: 'active',
      },
      {
        id: 'vicgo-id',
        username: 'Vicgo',
        discord_id: 'vicgo#5678',
        role: 'pro_capper',
        tier: 'vip',
        status: 'active',
      },
      {
        id: 'sauced-id',
        username: 'Sauced',
        discord_id: 'sauced#9012',
        role: 'capper',
        tier: 'standard',
        status: 'active',
      },
    ];

    for (const capper of cappers) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', capper.username)
        .single();

      if (!existingUser) {
        const { error } = await supabase.from('users').insert(capper);

        if (error) {
          console.log(`   ⚠️ Error creating ${capper.username}:`, error.message);
        } else {
          console.log(`   ✅ Created capper: ${capper.username}`);
        }
      } else {
        console.log(`   ℹ️ Capper already exists: ${capper.username}`);
      }
    }

    // 2. Create test games for today
    console.log('\n2. Creating test games for today...');
    const games = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        sport: 'MLB',
        league: 'MLB',
        home_team: 'NYY_MLB',
        away_team: 'BOS_MLB',
        game_date: today,
        commence_time: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        status: 'scheduled',
        moneyline_home: '-140',
        moneyline_away: '+120',
        spread: '-1.5',
        spread_odds: '-110',
        total: '9.5',
        total_over_odds: '-110',
        total_under_odds: '-110',
        venue: 'Yankee Stadium',
        home_team_meta: {
          names: {
            long: 'New York Yankees',
            short: 'NYY',
            medium: 'Yankees',
          },
        },
        away_team_meta: {
          names: {
            long: 'Boston Red Sox',
            short: 'BOS',
            medium: 'Red Sox',
          },
        },
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        sport: 'MLB',
        league: 'MLB',
        home_team: 'LAD_MLB',
        away_team: 'SF_MLB',
        game_date: today,
        commence_time: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
        status: 'scheduled',
        moneyline_home: '-165',
        moneyline_away: '+145',
        spread: '-1.5',
        spread_odds: '+105',
        total: '8.5',
        total_over_odds: '-105',
        total_under_odds: '-115',
        venue: 'Dodger Stadium',
        home_team_meta: {
          names: {
            long: 'Los Angeles Dodgers',
            short: 'LAD',
            medium: 'Dodgers',
          },
        },
        away_team_meta: {
          names: {
            long: 'San Francisco Giants',
            short: 'SF',
            medium: 'Giants',
          },
        },
      },
    ];

    for (const game of games) {
      const { data: existingGame } = await supabase
        .from('games')
        .select('id')
        .eq('id', game.id)
        .single();

      if (!existingGame) {
        const { error } = await supabase.from('games').insert(game);

        if (error) {
          console.log(`   ⚠️ Error creating game:`, error.message);
        } else {
          console.log(
            `   ✅ Created game: ${game.away_team_meta.names.short} @ ${game.home_team_meta.names.short}`
          );
        }
      } else {
        // Update the game with fresh data
        const { error } = await supabase.from('games').update(game).eq('id', game.id);

        if (error) {
          console.log(`   ⚠️ Error updating game:`, error.message);
        } else {
          console.log(
            `   ✅ Updated game: ${game.away_team_meta.names.short} @ ${game.home_team_meta.names.short}`
          );
        }
      }
    }

    // 3. Create test props
    console.log('\n3. Creating test props...');
    const props = [
      // Yankees vs Red Sox props
      {
        id: '650e8400-e29b-41d4-a716-446655440001',
        game_id: '550e8400-e29b-41d4-a716-446655440001',
        external_game_id: '550e8400-e29b-41d4-a716-446655440001',
        sport: 'MLB',
        player_name: 'Aaron Judge',
        team: 'NYY',
        opponent: 'BOS',
        stat_type: 'Home Runs',
        market_type: 'player_props',
        line: 0.5,
        over_odds: -120,
        under_odds: +100,
        confidence: 0.75,
        expected_value: 0.08,
        provider: 'optimal',
        game_time: games[0].commence_time,
      },
      {
        id: '650e8400-e29b-41d4-a716-446655440002',
        game_id: '550e8400-e29b-41d4-a716-446655440001',
        external_game_id: '550e8400-e29b-41d4-a716-446655440001',
        sport: 'MLB',
        player_name: 'Gerrit Cole',
        team: 'NYY',
        opponent: 'BOS',
        stat_type: 'Strikeouts',
        market_type: 'player_props',
        line: 7.5,
        over_odds: -110,
        under_odds: -110,
        confidence: 0.65,
        expected_value: 0.05,
        provider: 'optimal',
        game_time: games[0].commence_time,
      },
      {
        id: '650e8400-e29b-41d4-a716-446655440003',
        game_id: '550e8400-e29b-41d4-a716-446655440001',
        external_game_id: '550e8400-e29b-41d4-a716-446655440001',
        sport: 'MLB',
        player_name: 'Rafael Devers',
        team: 'BOS',
        opponent: 'NYY',
        stat_type: 'Total Hits',
        market_type: 'player_props',
        line: 1.5,
        over_odds: +110,
        under_odds: -130,
        confidence: 0.6,
        expected_value: 0.03,
        provider: 'optimal',
        game_time: games[0].commence_time,
      },
      // Dodgers vs Giants props
      {
        id: '650e8400-e29b-41d4-a716-446655440004',
        game_id: '550e8400-e29b-41d4-a716-446655440002',
        external_game_id: '550e8400-e29b-41d4-a716-446655440002',
        sport: 'MLB',
        player_name: 'Mookie Betts',
        team: 'LAD',
        opponent: 'SF',
        stat_type: 'Total Bases',
        market_type: 'player_props',
        line: 2.5,
        over_odds: -105,
        under_odds: -115,
        confidence: 0.7,
        expected_value: 0.06,
        provider: 'optimal',
        game_time: games[1].commence_time,
      },
      {
        id: '650e8400-e29b-41d4-a716-446655440005',
        game_id: '550e8400-e29b-41d4-a716-446655440002',
        external_game_id: '550e8400-e29b-41d4-a716-446655440002',
        sport: 'MLB',
        player_name: 'Clayton Kershaw',
        team: 'LAD',
        opponent: 'SF',
        stat_type: 'Earned Runs',
        market_type: 'player_props',
        line: 2.5,
        over_odds: +120,
        under_odds: -140,
        confidence: 0.68,
        expected_value: 0.04,
        provider: 'optimal',
        game_time: games[1].commence_time,
      },
    ];

    for (const prop of props) {
      const { data: existingProp } = await supabase
        .from('raw_props')
        .select('id')
        .eq('id', prop.id)
        .single();

      if (!existingProp) {
        const { error } = await supabase.from('raw_props').insert(prop);

        if (error) {
          console.log(`   ⚠️ Error creating prop:`, error.message);
        } else {
          console.log(`   ✅ Created prop: ${prop.player_name} - ${prop.stat_type}`);
        }
      } else {
        // Update the prop with fresh data
        const { error } = await supabase.from('raw_props').update(prop).eq('id', prop.id);

        if (error) {
          console.log(`   ⚠️ Error updating prop:`, error.message);
        } else {
          console.log(`   ✅ Updated prop: ${prop.player_name} - ${prop.stat_type}`);
        }
      }
    }

    console.log('\n✅ Test data population complete!');
    console.log('\n📊 Summary:');
    console.log('   - 3 cappers in users table');
    console.log('   - 2 MLB games for today');
    console.log('   - 5 player props linked to games');
    console.log('\n🎯 You can now test the smart form with real v3 data!');
  } catch (error) {
    console.error('❌ Error populating data:', error);
  }
}

populateV3TestData();
