const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o';

const supabase = createClient(supabaseUrl, supabaseKey);

// Today's date
const today = new Date();
const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
const todayDisplay = today.toLocaleDateString('en-US', {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

console.log(`🎯 Populating 15 MLB games for ${todayDisplay} (${todayString})`);

// 15 MLB games for today - realistic matchups and lines
const mlbGames = [
  {
    sport: 'BASEBALL',
    league: 'MLB',
    away_team: 'LOS_ANGELES_DODGERS_MLB',
    home_team: 'SAN_FRANCISCO_GIANTS_MLB',
    game_date: todayString,
    commence_time: `${todayString}T22:15:00Z`,
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
  },
  {
    sport: 'BASEBALL',
    league: 'MLB',
    away_team: 'NEW_YORK_YANKEES_MLB',
    home_team: 'BOSTON_RED_SOX_MLB',
    game_date: todayString,
    commence_time: `${todayString}T23:10:00Z`,
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
  },
  {
    sport: 'BASEBALL',
    league: 'MLB',
    away_team: 'ATLANTA_BRAVES_MLB',
    home_team: 'PHILADELPHIA_PHILLIES_MLB',
    game_date: todayString,
    commence_time: `${todayString}T23:05:00Z`,
    status: 'scheduled',
    spread: '-1.5',
    total: '9.0',
    moneyline_home: '-125',
    moneyline_away: '+105',
    spread_odds: '-110',
    total_over_odds: '-108',
    total_under_odds: '-112',
    venue: 'Citizens Bank Park',
    source: 'manual_test_data',
    matchup: 'Atlanta Braves @ Philadelphia Phillies',
  },
  {
    sport: 'BASEBALL',
    league: 'MLB',
    away_team: 'HOUSTON_ASTROS_MLB',
    home_team: 'TEXAS_RANGERS_MLB',
    game_date: todayString,
    commence_time: `${todayString}T00:05:00Z`,
    status: 'scheduled',
    spread: '-1.5',
    total: '8.5',
    moneyline_home: '+115',
    moneyline_away: '-135',
    spread_odds: '-110',
    total_over_odds: '-110',
    total_under_odds: '-110',
    venue: 'Globe Life Field',
    source: 'manual_test_data',
    matchup: 'Houston Astros @ Texas Rangers',
  },
  {
    sport: 'BASEBALL',
    league: 'MLB',
    away_team: 'CHICAGO_CUBS_MLB',
    home_team: 'MILWAUKEE_BREWERS_MLB',
    game_date: todayString,
    commence_time: `${todayString}T00:10:00Z`,
    status: 'scheduled',
    spread: '-1.5',
    total: '8.0',
    moneyline_home: '-150',
    moneyline_away: '+130',
    spread_odds: '-110',
    total_over_odds: '-105',
    total_under_odds: '-115',
    venue: 'American Family Field',
    source: 'manual_test_data',
    matchup: 'Chicago Cubs @ Milwaukee Brewers',
  },
  {
    sport: 'BASEBALL',
    league: 'MLB',
    away_team: 'DETROIT_TIGERS_MLB',
    home_team: 'CLEVELAND_GUARDIANS_MLB',
    game_date: todayString,
    commence_time: `${todayString}T23:10:00Z`,
    status: 'scheduled',
    spread: '-1.5',
    total: '7.5',
    moneyline_home: '-110',
    moneyline_away: '-110',
    spread_odds: '-110',
    total_over_odds: '-110',
    total_under_odds: '-110',
    venue: 'Progressive Field',
    source: 'manual_test_data',
    matchup: 'Detroit Tigers @ Cleveland Guardians',
  },
  {
    sport: 'BASEBALL',
    league: 'MLB',
    away_team: 'MIAMI_MARLINS_MLB',
    home_team: 'NEW_YORK_METS_MLB',
    game_date: todayString,
    commence_time: `${todayString}T23:10:00Z`,
    status: 'scheduled',
    spread: '-1.5',
    total: '8.5',
    moneyline_home: '-160',
    moneyline_away: '+140',
    spread_odds: '-110',
    total_over_odds: '-105',
    total_under_odds: '-115',
    venue: 'Citi Field',
    source: 'manual_test_data',
    matchup: 'Miami Marlins @ New York Mets',
  },
  {
    sport: 'BASEBALL',
    league: 'MLB',
    away_team: 'WASHINGTON_NATIONALS_MLB',
    home_team: 'PITTSBURGH_PIRATES_MLB',
    game_date: todayString,
    commence_time: `${todayString}T23:05:00Z`,
    status: 'scheduled',
    spread: '-1.5',
    total: '8.0',
    moneyline_home: '+105',
    moneyline_away: '-125',
    spread_odds: '-110',
    total_over_odds: '-110',
    total_under_odds: '-110',
    venue: 'PNC Park',
    source: 'manual_test_data',
    matchup: 'Washington Nationals @ Pittsburgh Pirates',
  },
  {
    sport: 'BASEBALL',
    league: 'MLB',
    away_team: 'CINCINNATI_REDS_MLB',
    home_team: 'ST_LOUIS_CARDINALS_MLB',
    game_date: todayString,
    commence_time: `${todayString}T00:15:00Z`,
    status: 'scheduled',
    spread: '-1.5',
    total: '8.5',
    moneyline_home: '-120',
    moneyline_away: '+100',
    spread_odds: '-110',
    total_over_odds: '-108',
    total_under_odds: '-112',
    venue: 'Busch Stadium',
    source: 'manual_test_data',
    matchup: 'Cincinnati Reds @ St. Louis Cardinals',
  },
  {
    sport: 'BASEBALL',
    league: 'MLB',
    away_team: 'KANSAS_CITY_ROYALS_MLB',
    home_team: 'MINNESOTA_TWINS_MLB',
    game_date: todayString,
    commence_time: `${todayString}T00:10:00Z`,
    status: 'scheduled',
    spread: '-1.5',
    total: '9.0',
    moneyline_home: '-135',
    moneyline_away: '+115',
    spread_odds: '-110',
    total_over_odds: '-105',
    total_under_odds: '-115',
    venue: 'Target Field',
    source: 'manual_test_data',
    matchup: 'Kansas City Royals @ Minnesota Twins',
  },
  {
    sport: 'BASEBALL',
    league: 'MLB',
    away_team: 'TORONTO_BLUE_JAYS_MLB',
    home_team: 'BALTIMORE_ORIOLES_MLB',
    game_date: todayString,
    commence_time: `${todayString}T23:05:00Z`,
    status: 'scheduled',
    spread: '-1.5',
    total: '9.5',
    moneyline_home: '-145',
    moneyline_away: '+125',
    spread_odds: '-110',
    total_over_odds: '-110',
    total_under_odds: '-110',
    venue: 'Oriole Park at Camden Yards',
    source: 'manual_test_data',
    matchup: 'Toronto Blue Jays @ Baltimore Orioles',
  },
  {
    sport: 'BASEBALL',
    league: 'MLB',
    away_team: 'TAMPA_BAY_RAYS_MLB',
    home_team: 'CHICAGO_WHITE_SOX_MLB',
    game_date: todayString,
    commence_time: `${todayString}T00:10:00Z`,
    status: 'scheduled',
    spread: '-1.5',
    total: '8.0',
    moneyline_home: '+110',
    moneyline_away: '-130',
    spread_odds: '-110',
    total_over_odds: '-105',
    total_under_odds: '-115',
    venue: 'Guaranteed Rate Field',
    source: 'manual_test_data',
    matchup: 'Tampa Bay Rays @ Chicago White Sox',
  },
  {
    sport: 'BASEBALL',
    league: 'MLB',
    away_team: 'OAKLAND_ATHLETICS_MLB',
    home_team: 'LOS_ANGELES_ANGELS_MLB',
    game_date: todayString,
    commence_time: `${todayString}T02:07:00Z`,
    status: 'scheduled',
    spread: '-1.5',
    total: '8.5',
    moneyline_home: '-155',
    moneyline_away: '+135',
    spread_odds: '-110',
    total_over_odds: '-108',
    total_under_odds: '-112',
    venue: 'Angel Stadium',
    source: 'manual_test_data',
    matchup: 'Oakland Athletics @ Los Angeles Angels',
  },
  {
    sport: 'BASEBALL',
    league: 'MLB',
    away_team: 'SEATTLE_MARINERS_MLB',
    home_team: 'SAN_DIEGO_PADRES_MLB',
    game_date: todayString,
    commence_time: `${todayString}T02:40:00Z`,
    status: 'scheduled',
    spread: '-1.5',
    total: '7.5',
    moneyline_home: '-125',
    moneyline_away: '+105',
    spread_odds: '-110',
    total_over_odds: '-110',
    total_under_odds: '-110',
    venue: 'Petco Park',
    source: 'manual_test_data',
    matchup: 'Seattle Mariners @ San Diego Padres',
  },
  {
    sport: 'BASEBALL',
    league: 'MLB',
    away_team: 'COLORADO_ROCKIES_MLB',
    home_team: 'ARIZONA_DIAMONDBACKS_MLB',
    game_date: todayString,
    commence_time: `${todayString}T01:40:00Z`,
    status: 'scheduled',
    spread: '-1.5',
    total: '9.5',
    moneyline_home: '-140',
    moneyline_away: '+120',
    spread_odds: '-110',
    total_over_odds: '-105',
    total_under_odds: '-115',
    venue: 'Chase Field',
    source: 'manual_test_data',
    matchup: 'Colorado Rockies @ Arizona Diamondbacks',
  },
];

async function populateMLBGames() {
  try {
    console.log('🔄 Starting MLB game population...');

    // First, let's check if MLB games already exist for today
    const { data: existingGames, error: checkError } = await supabase
      .from('games')
      .select('id, sport, league, away_team, home_team')
      .eq('game_date', todayString)
      .eq('league', 'MLB');

    if (checkError) {
      console.error('❌ Error checking existing MLB games:', checkError);
      return;
    }

    console.log(`📊 Found ${existingGames?.length || 0} existing MLB games for ${todayString}`);

    // Clear existing MLB games for today to avoid duplicates
    if (existingGames && existingGames.length > 0) {
      console.log('🧹 Clearing existing MLB games for today...');
      const { error: deleteError } = await supabase
        .from('games')
        .delete()
        .eq('game_date', todayString)
        .eq('league', 'MLB');

      if (deleteError) {
        console.error('❌ Error deleting existing MLB games:', deleteError);
        return;
      }
    }

    // Insert today's MLB games
    console.log(`📥 Inserting ${mlbGames.length} MLB games for testing...`);

    const { data: insertedGames, error: insertError } = await supabase
      .from('games')
      .insert(mlbGames)
      .select();

    if (insertError) {
      console.error('❌ Error inserting MLB games:', insertError);
      console.error('Error details:', insertError.details);
      console.error('Error hint:', insertError.hint);
      return;
    }

    console.log('✅ Successfully inserted MLB games:');
    insertedGames?.forEach(game => {
      console.log(`   ⚾ ${game.league}: ${game.matchup}`);
    });

    // Verify the MLB games were inserted
    const { data: verifyGames, error: verifyError } = await supabase
      .from('games')
      .select(
        'sport, league, matchup, game_date, status, total, spread, moneyline_home, moneyline_away, venue'
      )
      .eq('game_date', todayString)
      .eq('league', 'MLB')
      .order('commence_time', { ascending: true });

    if (verifyError) {
      console.error('❌ Error verifying MLB games:', verifyError);
      return;
    }

    console.log('🎯 Verification complete - MLB Games available for testing:');
    console.log(`📅 Date: ${todayString}`);
    console.log(`📊 Total MLB games: ${verifyGames?.length}`);

    verifyGames?.forEach((game, index) => {
      console.log(`   ${index + 1}. ${game.matchup} at ${game.venue}`);
      console.log(
        `      Spread: ${game.spread} | Total: ${game.total} | ML: ${game.moneyline_home}/${game.moneyline_away}`
      );
    });

    console.log('🎉 MLB game population complete! Smart form ready for testing.');
    console.log('📝 Test all bet types: SPREAD, TOTAL, MONEYLINE, PLAYER_PROP, TEAM_PROP, PARLAY');

    // Final count verification
    const { count, error: countError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('game_date', todayString)
      .eq('league', 'MLB');

    if (!countError) {
      console.log(`✅ Final verification: ${count} MLB games in database for ${todayString}`);
    }
  } catch (error) {
    console.error('💥 Unexpected error:', error);
    console.error('Error details:', error.details);
  }
}

// Run the population
populateMLBGames();
