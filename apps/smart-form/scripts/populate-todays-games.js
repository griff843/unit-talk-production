const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Today's date in various formats
const today = new Date();
const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
const todayDisplay = today.toLocaleDateString('en-US', {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

console.log(`🎯 Populating games for ${todayDisplay} (${todayString})`);

// Sample games for today - multiple sports for comprehensive testing
const todaysGames = [
  // MLB Games
  {
    sport: 'BASEBALL',
    league: 'MLB',
    away_team: 'LOS_ANGELES_DODGERS_MLB',
    home_team: 'SAN_FRANCISCO_GIANTS_MLB',
    game_date: todayString,
    commence_time: `${todayString}T19:10:00Z`,
    status: 'scheduled',
    spread: '-1.5',
    total: '8.5',
    moneyline_home: '-140',
    moneyline_away: '+120',
    spread_odds: '-110',
    total_over_odds: '-105',
    total_under_odds: '-115',
    venue: 'Oracle Park',
    source: 'manual_test_data',
    matchup: 'Los Angeles Dodgers @ San Francisco Giants',
    home_team_meta: {
      names: {
        long: 'San Francisco Giants',
        short: 'SF',
        medium: 'Giants',
        location: 'San Francisco',
        nickname: 'Giants',
      },
      teamID: 'SAN_FRANCISCO_GIANTS_MLB',
    },
    away_team_meta: {
      names: {
        long: 'Los Angeles Dodgers',
        short: 'LAD',
        medium: 'Dodgers',
        location: 'Los Angeles',
        nickname: 'Dodgers',
      },
      teamID: 'LOS_ANGELES_DODGERS_MLB',
    },
  },
  {
    sport: 'BASEBALL',
    league: 'MLB',
    away_team: 'NEW_YORK_YANKEES_MLB',
    home_team: 'BOSTON_RED_SOX_MLB',
    game_date: todayString,
    commence_time: `${todayString}T19:10:00Z`,
    status: 'scheduled',
    spread: '-1.5',
    total: '9.5',
    moneyline_home: '-115',
    moneyline_away: '-105',
    spread_odds: '-110',
    total_over_odds: '-110',
    total_under_odds: '-110',
    venue: 'Fenway Park',
    source: 'manual_test_data',
    matchup: 'New York Yankees @ Boston Red Sox',
    home_team_meta: {
      names: {
        long: 'Boston Red Sox',
        short: 'BOS',
        medium: 'Red Sox',
        location: 'Boston',
        nickname: 'Red Sox',
      },
      teamID: 'BOSTON_RED_SOX_MLB',
    },
    away_team_meta: {
      names: {
        long: 'New York Yankees',
        short: 'NYY',
        medium: 'Yankees',
        location: 'New York',
        nickname: 'Yankees',
      },
      teamID: 'NEW_YORK_YANKEES_MLB',
    },
  },

  // NBA Games (Summer League)
  {
    sport: 'BASKETBALL',
    league: 'NBA',
    away_team: 'LOS_ANGELES_LAKERS_NBA',
    home_team: 'GOLDEN_STATE_WARRIORS_NBA',
    game_date: todayString,
    commence_time: `${todayString}T22:00:00Z`,
    status: 'scheduled',
    spread: '-3.5',
    total: '220.5',
    moneyline_home: '-160',
    moneyline_away: '+140',
    spread_odds: '-110',
    total_over_odds: '-110',
    total_under_odds: '-110',
    venue: 'Chase Center',
    source: 'manual_test_data',
    matchup: 'Los Angeles Lakers @ Golden State Warriors',
    home_team_meta: {
      names: {
        long: 'Golden State Warriors',
        short: 'GSW',
        medium: 'Warriors',
        location: 'Golden State',
        nickname: 'Warriors',
      },
      teamID: 'GOLDEN_STATE_WARRIORS_NBA',
    },
    away_team_meta: {
      names: {
        long: 'Los Angeles Lakers',
        short: 'LAL',
        medium: 'Lakers',
        location: 'Los Angeles',
        nickname: 'Lakers',
      },
      teamID: 'LOS_ANGELES_LAKERS_NBA',
    },
  },

  // WNBA Games
  {
    sport: 'BASKETBALL',
    league: 'WNBA',
    away_team: 'LAS_VEGAS_ACES_WNBA',
    home_team: 'NEW_YORK_LIBERTY_WNBA',
    game_date: todayString,
    commence_time: `${todayString}T20:00:00Z`,
    status: 'scheduled',
    spread: '-2.5',
    total: '165.5',
    moneyline_home: '+110',
    moneyline_away: '-130',
    spread_odds: '-110',
    total_over_odds: '-105',
    total_under_odds: '-115',
    venue: 'Barclays Center',
    source: 'manual_test_data',
    matchup: 'Las Vegas Aces @ New York Liberty',
    home_team_meta: {
      names: {
        long: 'New York Liberty',
        short: 'NY',
        medium: 'Liberty',
        location: 'New York',
        nickname: 'Liberty',
      },
      teamID: 'NEW_YORK_LIBERTY_WNBA',
    },
    away_team_meta: {
      names: {
        long: 'Las Vegas Aces',
        short: 'LV',
        medium: 'Aces',
        location: 'Las Vegas',
        nickname: 'Aces',
      },
      teamID: 'LAS_VEGAS_ACES_WNBA',
    },
  },

  // NFL Preseason
  {
    sport: 'FOOTBALL',
    league: 'NFL',
    away_team: 'KANSAS_CITY_CHIEFS_NFL',
    home_team: 'SAN_FRANCISCO_49ERS_NFL',
    game_date: todayString,
    commence_time: `${todayString}T21:00:00Z`,
    status: 'scheduled',
    spread: '-3.0',
    total: '42.5',
    moneyline_home: '+120',
    moneyline_away: '-140',
    spread_odds: '-110',
    total_over_odds: '-105',
    total_under_odds: '-115',
    venue: "Levi's Stadium",
    source: 'manual_test_data',
    matchup: 'Kansas City Chiefs @ San Francisco 49ers',
    home_team_meta: {
      names: {
        long: 'San Francisco 49ers',
        short: 'SF',
        medium: '49ers',
        location: 'San Francisco',
        nickname: '49ers',
      },
      teamID: 'SAN_FRANCISCO_49ERS_NFL',
    },
    away_team_meta: {
      names: {
        long: 'Kansas City Chiefs',
        short: 'KC',
        medium: 'Chiefs',
        location: 'Kansas City',
        nickname: 'Chiefs',
      },
      teamID: 'KANSAS_CITY_CHIEFS_NFL',
    },
  },
];

async function populateGames() {
  try {
    console.log('🔄 Starting game population...');

    // First, let's check if games already exist for today
    const { data: existingGames, error: checkError } = await supabase
      .from('games')
      .select('id, sport, away_team, home_team')
      .eq('game_date', todayString);

    if (checkError) {
      console.error('❌ Error checking existing games:', checkError);
      return;
    }

    console.log(`📊 Found ${existingGames?.length || 0} existing games for ${todayString}`);

    // Clear existing games for today to avoid duplicates
    if (existingGames && existingGames.length > 0) {
      console.log('🧹 Clearing existing games for today...');
      const { error: deleteError } = await supabase
        .from('games')
        .delete()
        .eq('game_date', todayString);

      if (deleteError) {
        console.error('❌ Error deleting existing games:', deleteError);
        return;
      }
    }

    // Insert today's games
    console.log(`📥 Inserting ${todaysGames.length} games for testing...`);

    const { data: insertedGames, error: insertError } = await supabase
      .from('games')
      .insert(todaysGames)
      .select();

    if (insertError) {
      console.error('❌ Error inserting games:', insertError);
      return;
    }

    console.log('✅ Successfully inserted games:');
    insertedGames?.forEach(game => {
      console.log(`   🏀 ${game.league}: ${game.matchup}`);
    });

    // Verify the games were inserted
    const { data: verifyGames, error: verifyError } = await supabase
      .from('games')
      .select(
        'sport, league, matchup, game_date, status, total, spread, moneyline_home, moneyline_away'
      )
      .eq('game_date', todayString)
      .order('league', { ascending: true });

    if (verifyError) {
      console.error('❌ Error verifying games:', verifyError);
      return;
    }

    console.log('🎯 Verification complete - Games available for testing:');
    console.log(`📅 Date: ${todayString}`);
    console.log(`📊 Total games: ${verifyGames?.length}`);

    // Group by league for summary
    const gamesByLeague = {};
    verifyGames?.forEach(game => {
      if (!gamesByLeague[game.league]) {
        gamesByLeague[game.league] = [];
      }
      gamesByLeague[game.league].push({
        matchup: game.matchup,
        spread: game.spread,
        total: game.total,
        ml_home: game.moneyline_home,
        ml_away: game.moneyline_away,
      });
    });

    Object.entries(gamesByLeague).forEach(([league, games]) => {
      console.log(`   🏆 ${league}: ${games.length} games`);
      games.forEach(game => {
        console.log(`      - ${game.matchup}`);
        console.log(
          `        Spread: ${game.spread} | Total: ${game.total} | ML: ${game.ml_home}/${game.ml_away}`
        );
      });
    });

    console.log('🎉 Game population complete! Smart form ready for testing.');
    console.log(
      '📝 Test all bet types: SPREAD, TOTAL, MONEYLINE, PLAYER_PROP, TEAM_PROP, PARLAY, TEASER, FUTURES'
    );
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the population
populateGames();
