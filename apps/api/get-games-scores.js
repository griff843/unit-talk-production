require('dotenv').config({ path: '../../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function getGamesAndScores() {
  console.log('🏀 Fetching recent games and scores from database...\n');

  // Get games from last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    // First, let's check what tables we have for games
    const { data: pickData, error: pickError } = await supabase
      .from('unified_picks')
      .select('sport, game_date, team_home, team_away, home_score, away_score, status')
      .gte('game_date', sevenDaysAgo.toISOString())
      .order('game_date', { ascending: false })
      .limit(50);

    if (pickData && pickData.length > 0) {
      console.log('📊 Recent Games from Unified Picks:\n');
      console.log('Date         | Sport | Teams                          | Score      | Status');
      console.log('-------------|-------|--------------------------------|------------|--------');

      pickData.forEach(game => {
        if (game.team_home && game.team_away) {
          const date = game.game_date ? new Date(game.game_date).toLocaleDateString() : 'N/A';
          const teams = `${game.team_away} @ ${game.team_home}`.padEnd(30);
          const score = (game.away_score !== null && game.home_score !== null)
            ? `${game.away_score}-${game.home_score}`.padEnd(10)
            : 'N/A'.padEnd(10);
          const status = game.status || 'Unknown';

          console.log(`${date.padEnd(12)} | ${(game.sport || 'N/A').padEnd(5)} | ${teams} | ${score} | ${status}`);
        }
      });
    }

    // Also check raw_props for game information
    const { data: propData, error: propError } = await supabase
      .from('raw_props')
      .select('sport, game_date, team_home, team_away, home_score, away_score, settled')
      .gte('game_date', sevenDaysAgo.toISOString())
      .not('team_home', 'is', null)
      .not('team_away', 'is', null)
      .order('game_date', { ascending: false })
      .limit(30);

    if (propData && propData.length > 0) {
      // Group by unique games
      const uniqueGames = {};
      propData.forEach(prop => {
        const gameKey = `${prop.sport}_${prop.game_date}_${prop.team_home}_${prop.team_away}`;
        if (!uniqueGames[gameKey]) {
          uniqueGames[gameKey] = prop;
        }
      });

      console.log('\n📊 Recent Games from Props Data:\n');
      console.log('Date         | Sport | Teams                          | Score      | Settled');
      console.log('-------------|-------|--------------------------------|------------|--------');

      Object.values(uniqueGames).forEach(game => {
        const date = new Date(game.game_date).toLocaleDateString();
        const teams = `${game.team_away} @ ${game.team_home}`.padEnd(30);
        const score = (game.away_score !== null && game.home_score !== null)
          ? `${game.away_score}-${game.home_score}`.padEnd(10)
          : 'Pending'.padEnd(10);
        const settled = game.settled ? '✅ Yes' : '⏳ No';

        console.log(`${date.padEnd(12)} | ${(game.sport || 'N/A').padEnd(5)} | ${teams} | ${score} | ${settled}`);
      });
    }

    // Get today's specific games
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: todayGames, error: todayError } = await supabase
      .from('raw_props')
      .select('sport, game_date, team_home, team_away, home_score, away_score, settled')
      .gte('game_date', today + 'T00:00:00Z')
      .lt('game_date', tomorrow.toISOString().split('T')[0] + 'T00:00:00Z')
      .not('team_home', 'is', null);

    if (todayGames && todayGames.length > 0) {
      // Group by unique games
      const uniqueTodayGames = {};
      todayGames.forEach(prop => {
        const gameKey = `${prop.sport}_${prop.team_home}_${prop.team_away}`;
        if (!uniqueTodayGames[gameKey]) {
          uniqueTodayGames[gameKey] = prop;
        }
      });

      console.log(`\n🎯 TODAY'S GAMES (${today}):\n`);
      console.log('Sport | Teams                          | Score      | Status');
      console.log('------|--------------------------------|------------|--------');

      Object.values(uniqueTodayGames).forEach(game => {
        const teams = `${game.team_away} @ ${game.team_home}`.padEnd(30);
        const score = (game.away_score !== null && game.home_score !== null)
          ? `${game.away_score}-${game.home_score}`.padEnd(10)
          : 'Not Started'.padEnd(10);
        const status = game.settled ? '✅ Final' : '⏳ Live/Pending';

        console.log(`${(game.sport || 'N/A').padEnd(5)} | ${teams} | ${score} | ${status}`);
      });

      // Summary
      const settled = Object.values(uniqueTodayGames).filter(g => g.settled).length;
      const total = Object.values(uniqueTodayGames).length;
      console.log(`\n📈 Today's Summary: ${settled}/${total} games settled (${((settled/total)*100).toFixed(0)}%)`);
    } else {
      console.log(`\n📅 No games found for today (${today})`);
    }

  } catch (error) {
    console.error('❌ Error fetching games:', error.message);
  }
}

getGamesAndScores().then(() => process.exit(0)).catch(console.error);