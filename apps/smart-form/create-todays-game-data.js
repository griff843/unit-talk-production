const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabase = createClient(
  'https://lxqmuzmqtnnlpfapvief.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E'
);

async function createTodaysGameData() {
  const today = new Date().toISOString().split('T')[0]; // 2025-08-08
  console.log(`🏈 Creating game data for TODAY: ${today}`);

  // Create games for multiple sports for today
  const sportsGames = [
    // MLB Games
    {
      id: uuidv4(),
      game_id: uuidv4(),
      sport: 'MLB',
      league: 'MLB',
      date: today,
      game_date: today,
      start_time: `${today}T19:00:00Z`,
      away_team: 'New York Yankees',
      home_team: 'Boston Red Sox',
      away_score: 0,
      home_score: 0,
      status: 'scheduled',
      venue: 'Fenway Park',
      matchup: 'New York Yankees @ Boston Red Sox'
    },
    {
      id: uuidv4(),
      game_id: uuidv4(),
      sport: 'MLB', 
      league: 'MLB',
      date: today,
      game_date: today,
      start_time: `${today}T20:00:00Z`,
      away_team: 'Los Angeles Dodgers',
      home_team: 'San Francisco Giants',
      away_score: 0,
      home_score: 0,
      status: 'scheduled',
      venue: 'Oracle Park',
      matchup: 'Los Angeles Dodgers @ San Francisco Giants'
    },
    {
      id: uuidv4(),
      game_id: uuidv4(),
      sport: 'MLB',
      league: 'MLB',
      date: today,
      game_date: today,
      start_time: `${today}T19:30:00Z`,
      away_team: 'Atlanta Braves',
      home_team: 'Philadelphia Phillies',
      away_score: 0,
      home_score: 0,
      status: 'scheduled',
      venue: 'Citizens Bank Park',
      matchup: 'Atlanta Braves @ Philadelphia Phillies'
    },
    // NBA Games (Summer League / Preseason)
    {
      id: uuidv4(),
      game_id: uuidv4(),
      sport: 'NBA',
      league: 'NBA',
      date: today,
      game_date: today,
      start_time: `${today}T20:00:00Z`,
      away_team: 'Los Angeles Lakers',
      home_team: 'Golden State Warriors',
      away_score: 0,
      home_score: 0,
      status: 'scheduled',
      venue: 'Chase Center',
      matchup: 'Los Angeles Lakers @ Golden State Warriors'
    },
    {
      id: uuidv4(),
      game_id: uuidv4(),
      sport: 'NBA',
      league: 'NBA',
      date: today,
      game_date: today,
      start_time: `${today}T21:00:00Z`,
      away_team: 'Miami Heat', 
      home_team: 'Boston Celtics',
      away_score: 0,
      home_score: 0,
      status: 'scheduled',
      venue: 'TD Garden',
      matchup: 'Miami Heat @ Boston Celtics'
    },
    // NFL Preseason
    {
      id: uuidv4(),
      game_id: uuidv4(),
      sport: 'NFL',
      league: 'NFL',
      date: today,
      game_date: today,
      start_time: `${today}T20:00:00Z`,
      away_team: 'Kansas City Chiefs',
      home_team: 'Buffalo Bills',
      away_score: 0,
      home_score: 0,
      status: 'scheduled',
      venue: 'Highmark Stadium',
      matchup: 'Kansas City Chiefs @ Buffalo Bills'
    }
  ];

  // Insert games
  const { data: insertedGames, error: gamesError } = await supabase
    .from('games')
    .insert(sportsGames)
    .select();

  if (gamesError) {
    console.error('❌ Error inserting games:', gamesError);
    return;
  }

  console.log(`✅ Successfully inserted ${insertedGames.length} games for ${today}`);

  // Create props for these games
  const allProps = [];
  
  for (const game of insertedGames) {
    let players = [];
    let propTypes = [];

    if (game.sport === 'MLB') {
      players = ['Aaron Judge', 'Mookie Betts', 'Ronald Acuña Jr.', 'Mike Trout', 'Shohei Ohtani'];
      propTypes = ['Total Hits', 'RBIs', 'Runs Scored', 'Home Runs'];
    } else if (game.sport === 'NBA') {
      players = ['LeBron James', 'Stephen Curry', 'Kevin Durant', 'Giannis Antetokounmpo', 'Luka Dončić'];  
      propTypes = ['Points', 'Rebounds', 'Assists', 'Threes Made'];
    } else if (game.sport === 'NFL') {
      players = ['Patrick Mahomes', 'Josh Allen', 'Travis Kelce', 'Stefon Diggs', 'Tyreek Hill'];
      propTypes = ['Passing Yards', 'Rushing Yards', 'Receiving Yards', 'Touchdowns'];
    }

    // Create 10 props per game
    for (let i = 0; i < 10; i++) {
      const player = players[i % players.length];
      const statType = propTypes[i % propTypes.length];
      let line = 0;
      
      // Set realistic lines based on sport and stat
      if (game.sport === 'MLB') {
        line = statType === 'Home Runs' ? 0.5 : 
               statType === 'Total Hits' ? 1.5 :
               statType === 'RBIs' ? 1.5 : 2.5;
      } else if (game.sport === 'NBA') {
        line = statType === 'Points' ? 25.5 :
               statType === 'Rebounds' ? 8.5 :
               statType === 'Assists' ? 6.5 : 2.5;
      } else if (game.sport === 'NFL') {
        line = statType === 'Passing Yards' ? 275.5 :
               statType === 'Rushing Yards' ? 75.5 :
               statType === 'Receiving Yards' ? 65.5 : 1.5;
      }

      allProps.push({
        id: uuidv4(),
        game_id: game.id, // Use games.id instead of games.game_id for foreign key
        player_name: player,
        stat_type: statType,
        sport: game.sport,
        line: line,
        over_odds: -110,
        under_odds: -110,
        market_type: 'player_props',
        game_date: game.game_date,
        matchup: game.matchup,
        league: game.sport,
        start_time: game.start_time,
        home_team: game.home_team,
        away_team: game.away_team,
        source: 'test_data',
        created_at: new Date().toISOString(),
        is_valid: true,
        confidence: 0.75,
        tier: 'B',
        bet_type: 'over',
        direction: 'over',
        market: `${player} ${statType}`,
        external_game_id: game.game_id
      });
    }
  }

  // Insert props
  const { data: insertedProps, error: propsError } = await supabase
    .from('raw_props')
    .insert(allProps)
    .select();

  if (propsError) {
    console.error('❌ Error inserting props:', propsError);
    return;
  }

  console.log(`✅ Successfully inserted ${insertedProps.length} props for ${today}`);
  
  console.log(`\n🎉 TODAY'S GAME DATA CREATED!`);
  console.log(`📅 Date: ${today}`);
  console.log(`🎮 Games: ${insertedGames.length} (MLB: 3, NBA: 2, NFL: 1)`);
  console.log(`🎯 Props: ${insertedProps.length} (10 per game)`);
  console.log(`\n🌐 Now you can access live data at:`);
  console.log(`   - Games: http://localhost:3002/api/games?sport=MLB`);
  console.log(`   - Games: http://localhost:3002/api/games?sport=NBA`);  
  console.log(`   - Games: http://localhost:3002/api/games?sport=NFL`);
  console.log(`   - Props: http://localhost:3002/api/props?sport=MLB`);
}

createTodaysGameData().catch(console.error);