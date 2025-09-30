import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const supabase = createClient(
  'https://lxqmuzmqtnnlpfapvief.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getGamesFromSept18() {
  console.log('🏀 Fetching games from September 18, 2025...\n');

  try {
    const { data, error } = await supabase
      .from('raw_props')
      .select('sport, game_date, team_home, team_away, home_score, away_score, settled')
      .gte('game_date', '2025-09-18T00:00:00Z')
      .lte('game_date', '2025-09-18T23:59:59Z')
      .not('team_home', 'is', null)
      .not('team_away', 'is', null);

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('❌ No games found for September 18, 2025');

      // Check what dates we do have
      const { data: recentData } = await supabase
        .from('raw_props')
        .select('game_date')
        .order('game_date', { ascending: false })
        .limit(10);

      if (recentData && recentData.length > 0) {
        console.log('\n📅 Most recent game dates in database:');
        const uniqueDates = [...new Set(recentData.map(r => r.game_date.split('T')[0]))];
        uniqueDates.slice(0, 5).forEach(date => {
          console.log(`  ${new Date(date).toLocaleDateString()}`);
        });
      }
      return;
    }

    // Group by unique games
    const gameMap = new Map();
    data.forEach(prop => {
      const gameKey = `${prop.sport}_${prop.team_home}_${prop.team_away}`;
      if (!gameMap.has(gameKey)) {
        gameMap.set(gameKey, prop);
      } else {
        // Update with latest scores
        const existing = gameMap.get(gameKey);
        if (prop.home_score !== null) existing.home_score = prop.home_score;
        if (prop.away_score !== null) existing.away_score = prop.away_score;
        if (prop.settled) existing.settled = prop.settled;
      }
    });

    const games = Array.from(gameMap.values());

    console.log(`🎮 GAMES FROM SEPTEMBER 18, 2025 (${games.length} games):\n`);
    console.log('=' .repeat(80));

    // Group by sport
    const sportGroups: { [key: string]: any[] } = {};
    games.forEach(game => {
      const sport = game.sport || 'OTHER';
      if (!sportGroups[sport]) sportGroups[sport] = [];
      sportGroups[sport].push(game);
    });

    let totalSettled = 0;

    // Display by sport
    Object.keys(sportGroups).sort().forEach(sport => {
      const sportGames = sportGroups[sport];
      console.log(`\n${sport} (${sportGames.length} games):`);
      console.log('-'.repeat(70));
      console.log('Teams                                    | Score         | Status');
      console.log('-'.repeat(70));

      sportGames.forEach(game => {
        const teams = `${game.team_away} @ ${game.team_home}`.padEnd(40);

        let score = '';
        let status = '';

        if (game.away_score !== null && game.home_score !== null) {
          score = `${game.away_score} - ${game.home_score}`.padEnd(13);
          status = '✅ FINAL';
          totalSettled++;
        } else if (game.settled) {
          score = 'N/A'.padEnd(13);
          status = '✅ SETTLED';
          totalSettled++;
        } else {
          score = 'Pending'.padEnd(13);
          status = '⏳ PENDING';
        }

        console.log(`${teams} | ${score} | ${status}`);
      });
    });

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SETTLEMENT SUMMARY:');
    console.log('='.repeat(80));
    console.log(`Total Games: ${games.length}`);
    console.log(`Settled: ${totalSettled}`);
    console.log(`Pending: ${games.length - totalSettled}`);
    console.log(`Settlement Rate: ${games.length > 0 ? ((totalSettled/games.length)*100).toFixed(1) : 0}%`);

    if (totalSettled === games.length && games.length > 0) {
      console.log('\n✅ ALL GAMES FROM SEPTEMBER 18 ARE FULLY SETTLED!');
    } else if (games.length - totalSettled > 0) {
      console.log(`\n⏳ ${games.length - totalSettled} games still need settlement`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

getGamesFromSept18().then(() => process.exit(0));