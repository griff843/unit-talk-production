require('dotenv').config({ path: '../../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function getGamesFromSept18() {
  console.log('🏀 Fetching games from September 18, 2025...\n');

  // September 18, 2025
  const gameDate = '2025-09-18';
  const startDate = gameDate + 'T00:00:00Z';
  const endDate = gameDate + 'T23:59:59Z';

  try {
    // Get all props from Sept 18 to see what games we have
    const { data: propData, error: propError } = await supabase
      .from('raw_props')
      .select('sport, game_date, team_home, team_away, home_score, away_score, settled, updated_at')
      .gte('game_date', startDate)
      .lte('game_date', endDate)
      .not('team_home', 'is', null)
      .not('team_away', 'is', null)
      .order('sport', { ascending: true });

    if (propError) {
      console.error('Database error:', propError);
      return;
    }

    if (!propData || propData.length === 0) {
      console.log('❌ No games found for September 18, 2025');

      // Let's check if there's any data at all
      const { data: anyData, error: anyError } = await supabase
        .from('raw_props')
        .select('COUNT(*), MAX(game_date) as latest, MIN(game_date) as earliest')
        .single();

      if (anyData) {
        console.log('\n📊 Database Info:');
        console.log(`Total props in database: ${anyData.count}`);
        console.log(`Earliest game date: ${anyData.earliest ? new Date(anyData.earliest).toLocaleDateString() : 'N/A'}`);
        console.log(`Latest game date: ${anyData.latest ? new Date(anyData.latest).toLocaleDateString() : 'N/A'}`);
      }
      return;
    }

    // Group by unique games
    const uniqueGames = {};
    propData.forEach(prop => {
      const gameKey = `${prop.sport}_${prop.team_home}_${prop.team_away}`;
      if (!uniqueGames[gameKey]) {
        uniqueGames[gameKey] = prop;
      } else {
        // Update with latest scores if available
        if (prop.home_score !== null) uniqueGames[gameKey].home_score = prop.home_score;
        if (prop.away_score !== null) uniqueGames[gameKey].away_score = prop.away_score;
        if (prop.settled) uniqueGames[gameKey].settled = prop.settled;
      }
    });

    console.log('🎮 GAMES FROM SEPTEMBER 18, 2025:\n');
    console.log('=' .repeat(80));

    // Group by sport
    const bySport = {};
    Object.values(uniqueGames).forEach(game => {
      const sport = game.sport || 'OTHER';
      if (!bySport[sport]) bySport[sport] = [];
      bySport[sport].push(game);
    });

    let totalGames = 0;
    let settledGames = 0;

    // Display games by sport
    Object.keys(bySport).sort().forEach(sport => {
      console.log(`\n${sport} (${bySport[sport].length} games):`);
      console.log('-'.repeat(70));
      console.log('Teams                                    | Score         | Status');
      console.log('-'.repeat(70));

      bySport[sport].forEach(game => {
        totalGames++;
        const teams = `${game.team_away} @ ${game.team_home}`.padEnd(40);

        let score = '';
        let status = '';

        if (game.away_score !== null && game.home_score !== null) {
          score = `${game.away_score} - ${game.home_score}`.padEnd(13);
          status = '✅ FINAL';
          settledGames++;
        } else if (game.settled) {
          score = 'N/A'.padEnd(13);
          status = '✅ SETTLED';
          settledGames++;
        } else {
          score = 'Not available'.padEnd(13);
          status = '⏳ PENDING';
        }

        console.log(`${teams} | ${score} | ${status}`);
      });
    });

    // Summary statistics
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY FOR SEPTEMBER 18, 2025:');
    console.log('='.repeat(80));
    console.log(`Total Games: ${totalGames}`);
    console.log(`Settled: ${settledGames}`);
    console.log(`Pending: ${totalGames - settledGames}`);
    console.log(`Settlement Rate: ${totalGames > 0 ? ((settledGames/totalGames)*100).toFixed(1) : 0}%`);

    if (settledGames === totalGames && totalGames > 0) {
      console.log('\n✅ ALL GAMES FROM SEPTEMBER 18 ARE FULLY SETTLED!');
    } else if (totalGames - settledGames > 0) {
      console.log(`\n⏳ ${totalGames - settledGames} games still pending settlement`);
    }

    // Show sport breakdown
    console.log('\nBy Sport:');
    Object.keys(bySport).sort().forEach(sport => {
      const games = bySport[sport];
      const settled = games.filter(g => g.settled || (g.away_score !== null && g.home_score !== null)).length;
      console.log(`  ${sport}: ${settled}/${games.length} settled`);
    });

  } catch (error) {
    console.error('❌ Error fetching games:', error.message);
  }
}

getGamesFromSept18().then(() => process.exit(0)).catch(console.error);