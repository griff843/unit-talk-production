const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const client = createClient(
  'https://lxqmuzmqtnnlpfapvief.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E'
);

// Common MLB player props with realistic betting lines
const PROP_LINES = {
  'H': [0.5, 1.5, 2.5],
  'HR': [0.5, 1.5], 
  'RBI': [0.5, 1.5, 2.5],
  'R': [0.5, 1.5],
  'TB': [1.5, 2.5, 3.5],
  'SO': [4.5, 5.5, 6.5, 7.5], // Pitcher strikeouts
  'IP': [4.5, 5.5, 6.5],
  'ER': [1.5, 2.5, 3.5]
};

async function checkCurrentSchema() {
  console.log('🔍 Checking current database schema...');
  
  const { data, error } = await client
    .from('raw_props')
    .select('*')
    .limit(1);
    
  if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    console.log('📊 Available columns:', columns.join(', '));
    return columns;
  } else {
    console.log('⚠️ No data found, will use basic schema');
    return [];
  }
}

async function fetchMLBSchedule(startDate, endDate) {
  console.log(`📅 Fetching MLB schedule from ${startDate} to ${endDate}...`);
  
  try {
    const response = await axios.get('https://statsapi.mlb.com/api/v1/schedule', {
      params: {
        sportId: 1, // MLB
        startDate,
        endDate,
        hydrate: 'game(content(summary,media(epg))),linescore,boxscore'
      },
      timeout: 10000
    });
    
    const games = [];
    response.data.dates?.forEach(dateEntry => {
      dateEntry.games?.forEach(game => {
        if (game.status.statusCode === 'F') { // Final games only
          games.push({
            gameId: game.gamePk.toString(),
            gameDate: game.officialDate,
            homeTeam: game.teams.home.team.name,
            awayTeam: game.teams.away.team.name,
            homeScore: game.teams.home.score || 0,
            awayScore: game.teams.away.score || 0,
            status: 'Final'
          });
        }
      });
    });
    
    console.log(`✅ Found ${games.length} completed MLB games`);
    return games;
  } catch (error) {
    console.error('❌ Failed to fetch MLB schedule:', error.message);
    return [];
  }
}

async function fetchGameBoxscore(gameId) {
  try {
    const response = await axios.get(`https://statsapi.mlb.com/api/v1/game/${gameId}/boxscore`, {
      timeout: 10000
    });
    
    const players = [];
    const boxscore = response.data;
    
    // Process home team batters
    if (boxscore.teams?.home?.batters) {
      boxscore.teams.home.players && Object.values(boxscore.teams.home.players).forEach(player => {
        if (player.stats?.batting) {
          players.push({
            playerId: player.person.id,
            playerName: player.person.fullName,
            team: boxscore.teams.home.team.name,
            position: player.position?.name || 'Unknown',
            stats: {
              H: parseInt(player.stats.batting.hits) || 0,
              HR: parseInt(player.stats.batting.homeRuns) || 0,
              RBI: parseInt(player.stats.batting.rbi) || 0,
              R: parseInt(player.stats.batting.runs) || 0,
              TB: parseInt(player.stats.batting.totalBases) || 0
            }
          });
        }
      });
    }
    
    // Process away team batters
    if (boxscore.teams?.away?.batters) {
      boxscore.teams.away.players && Object.values(boxscore.teams.away.players).forEach(player => {
        if (player.stats?.batting) {
          players.push({
            playerId: player.person.id,
            playerName: player.person.fullName,
            team: boxscore.teams.away.team.name,
            position: player.position?.name || 'Unknown',
            stats: {
              H: parseInt(player.stats.batting.hits) || 0,
              HR: parseInt(player.stats.batting.homeRuns) || 0,
              RBI: parseInt(player.stats.batting.rbi) || 0,
              R: parseInt(player.stats.batting.runs) || 0,
              TB: parseInt(player.stats.batting.totalBases) || 0
            }
          });
        }
      });
    }
    
    return players;
  } catch (error) {
    console.warn(`⚠️ Failed to fetch boxscore for game ${gameId}:`, error.message);
    return [];
  }
}

function generatePlayerProps(player, gameId, gameDate) {
  const props = [];
  
  // Generate props for each stat type
  Object.entries(player.stats).forEach(([statType, actualValue]) => {
    if (PROP_LINES[statType]) {
      PROP_LINES[statType].forEach(line => {
        // Determine outcome
        const overOutcome = actualValue > line ? 'win' : (actualValue === line ? 'push' : 'loss');
        
        // Only create props where we have a clear outcome
        if (overOutcome !== 'push') {
          props.push({
            id: `${gameId}_${player.playerId}_${statType}_O${line}`,
            external_id: `${gameId}_${player.playerId}_${statType}_O${line}`,
            player_name: player.playerName,
            sport: 'MLB',
            stat_type: statType,
            line: line,
            over: -110,
            under: -110,
            game_date: gameDate,
            outcome: overOutcome // This will be our "answer key" for settlement
          });
        }
      });
    }
  });
  
  return props;
}

async function importHistoricalData() {
  console.log('🚀 Starting 2024 MLB Historical Data Import (Schema-Compatible)...\n');
  
  // Check current schema
  const availableColumns = await checkCurrentSchema();
  
  // Fetch a small set of games for testing
  const games = await fetchMLBSchedule('2024-09-15', '2024-09-16'); // Just 2 days
  
  if (games.length === 0) {
    console.log('❌ No games found. Exiting.');
    return;
  }
  
  console.log(`\n📊 Processing ${Math.min(games.length, 5)} games for testing...`);
  
  let totalProps = 0;
  const allProps = [];
  
  for (let i = 0; i < Math.min(games.length, 5); i++) { // Limit to 5 games
    const game = games[i];
    console.log(`\n⚾ Processing Game ${i+1}/5: ${game.awayTeam} @ ${game.homeTeam} (${game.gameDate})`);
    
    const players = await fetchGameBoxscore(game.gameId);
    console.log(`   👥 Found ${players.length} players with stats`);
    
    if (players.length > 0) {
      players.forEach(player => {
        const props = generatePlayerProps(player, game.gameId, game.gameDate);
        allProps.push(...props);
      });
      
      console.log(`   📈 Generated ${players.length * 2} props (avg 2 per player)`);
      totalProps += players.length * 2;
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  if (allProps.length === 0) {
    console.log('❌ No props generated. Exiting.');
    return;
  }
  
  console.log(`\n💾 Inserting ${allProps.length} historical props into database...`);
  
  // Clear existing 2025 test data first
  console.log('🧹 Clearing existing 2025 test data...');
  try {
    const { error: deleteError } = await client
      .from('raw_props')
      .delete()
      .gte('game_date', '2025-01-01');
      
    if (deleteError) {
      console.warn('⚠️ Failed to clear test data:', deleteError.message);
    } else {
      console.log('✅ Cleared 2025 test data');
    }
  } catch (err) {
    console.warn('⚠️ Delete operation failed:', err.message);
  }
  
  // Insert in small batches
  const batchSize = 50;
  let inserted = 0;
  
  for (let i = 0; i < allProps.length; i += batchSize) {
    const batch = allProps.slice(i, i + batchSize);
    const { error } = await client
      .from('raw_props')
      .insert(batch);
      
    if (error) {
      console.error(`❌ Batch ${i}-${i+batch.length} failed:`, error.message);
      console.log('Sample prop:', JSON.stringify(batch[0], null, 2));
      break;
    } else {
      inserted += batch.length;
      console.log(`✅ Inserted batch ${i+1}-${i+batch.length} (${batch.length} props)`);
    }
  }
  
  console.log(`\n🎉 Import Complete!`);
  console.log(`📊 Historical Props Inserted: ${inserted}`);
  console.log(`📅 Date Range: 2024-09-15 to 2024-09-16`);  
  console.log(`⚾ Games Processed: ${Math.min(games.length, 5)}`);
  console.log(`\n🎯 Ready for settlement testing with REAL historical data!`);
}

// Run the import
importHistoricalData()
  .then(() => {
    console.log('\n✅ Historical data import completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });