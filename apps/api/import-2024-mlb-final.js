const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const client = createClient(
  'https://lxqmuzmqtnnlpfapvief.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E'
);

const PROP_LINES = {
  'H': [0.5, 1.5, 2.5],
  'HR': [0.5],
  'RBI': [0.5, 1.5], 
  'R': [0.5, 1.5],
  'TB': [1.5, 2.5]
};

async function fetchMLBGameData() {
  console.log('🚀 Starting 2024 MLB Historical Data Import (UUID-Compatible)...\n');
  
  try {
    // Fetch one completed game from September 15, 2024
    const response = await axios.get('https://statsapi.mlb.com/api/v1/schedule', {
      params: {
        sportId: 1,
        startDate: '2024-09-15',
        endDate: '2024-09-15',
        hydrate: 'game(content(summary,media(epg))),linescore,boxscore'
      },
      timeout: 10000
    });
    
    const game = response.data.dates?.[0]?.games?.find(g => g.status.statusCode === 'F');
    if (!game) {
      throw new Error('No completed games found');
    }
    
    console.log(`⚾ Processing: ${game.teams.away.team.name} @ ${game.teams.home.team.name}`);
    
    // Fetch detailed boxscore
    const boxResponse = await axios.get(`https://statsapi.mlb.com/api/v1/game/${game.gamePk}/boxscore`, {
      timeout: 10000
    });
    
    const props = [];
    const boxscore = boxResponse.data;
    
    // Process a few key players from each team
    const processPlayers = (teamPlayers, teamName) => {
      if (!teamPlayers) return;
      
      const playerList = Object.values(teamPlayers).slice(0, 5); // First 5 players
      
      playerList.forEach(player => {
        if (player.stats?.batting) {
          const stats = {
            H: parseInt(player.stats.batting.hits) || 0,
            HR: parseInt(player.stats.batting.homeRuns) || 0,
            RBI: parseInt(player.stats.batting.rbi) || 0,
            R: parseInt(player.stats.batting.runs) || 0,
            TB: parseInt(player.stats.batting.totalBases) || 0
          };
          
          // Generate 1-2 props per player
          ['H', 'RBI'].forEach(statType => {
            if (PROP_LINES[statType] && typeof stats[statType] === 'number') {
              const line = PROP_LINES[statType][0]; // Use first line only
              const actualValue = stats[statType];
              const outcome = actualValue > line ? 'win' : (actualValue === line ? 'push' : 'loss');
              
              if (outcome !== 'push') { // Only clear outcomes
                props.push({
                  id: uuidv4(), // Generate proper UUID
                  player_name: player.person.fullName,
                  sport: 'MLB',
                  stat_type: statType,
                  line: line,
                  game_date: game.officialDate,
                  outcome: outcome,
                  external_id: `${game.gamePk}_${player.person.id}_${statType}_${line}`,
                  game_id: uuidv4(), // Generate UUID for game_id too
                  team_name: teamName,
                  over: -110,
                  under: -110
                });
              }
            }
          });
        }
      });
    };
    
    // Process both teams
    processPlayers(boxscore.teams.home.players, game.teams.home.team.name);
    processPlayers(boxscore.teams.away.players, game.teams.away.team.name);
    
    console.log(`📊 Generated ${props.length} historical props with known outcomes`);
    
    // Insert into database
    if (props.length > 0) {
      console.log('\n💾 Inserting historical props...');
      
      const { data, error } = await client
        .from('raw_props')
        .insert(props)
        .select('id, player_name, stat_type, outcome');
        
      if (error) {
        console.error('❌ Insert failed:', error.message);
        console.log('Sample prop structure:', JSON.stringify(props[0], null, 2));
      } else {
        console.log(`✅ Successfully inserted ${data.length} historical props!`);
        console.log('\n📈 Sample inserted data:');
        data.slice(0, 3).forEach(prop => {
          console.log(`  ${prop.player_name} ${prop.stat_type} - ${prop.outcome}`);
        });
      }
    }
    
    return props.length;
    
  } catch (error) {
    console.error('❌ Failed to fetch MLB data:', error.message);
    return 0;
  }
}

// Run the import
fetchMLBGameData()
  .then((count) => {
    if (count > 0) {
      console.log('\n🎉 SUCCESS! Historical data ready for settlement testing!');
      console.log(`📊 ${count} props with real outcomes imported`);
      console.log('🎯 Now run the settlement system to test against real data!');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });