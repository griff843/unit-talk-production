const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🏟️ Checking Games Coverage - Data Pipeline Analysis');
console.log('Today:', new Date().toDateString());
console.log('='.repeat(70));

async function checkGamesToday() {
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log(`Checking games for: ${today}`);

    // Check games table
    console.log('\n📅 GAMES TABLE ANALYSIS:');
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .gte('game_date', today + 'T00:00:00')
      .lt('game_date', today + 'T23:59:59');
    
    if (gamesError) {
      console.log('❌ Games table error:', gamesError.message);
      
      // Try alternative game table names
      const possibleTables = ['games', 'game_schedule', 'nfl_games', 'mlb_games', 'ncaaf_games', 'schedule'];
      
      for (const tableName of possibleTables) {
        try {
          const { data: altGames, error: altError } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
          
          if (!altError) {
            console.log(`✅ Found table: ${tableName}`);
            
            // Get today's games from this table
            const { data: todayGames, error: todayError } = await supabase
              .from(tableName)
              .select('*')
              .gte('game_date', today + 'T00:00:00')
              .lt('game_date', today + 'T23:59:59');
            
            if (!todayError) {
              console.log(`   Games today in ${tableName}: ${todayGames?.length || 0}`);
              if (todayGames?.length > 0) {
                console.log(`   Sample game:`, todayGames[0]);
              }
            }
          }
        } catch (e) {
          // Table doesn't exist, continue
        }
      }
    } else {
      console.log(`✅ Games scheduled today: ${games?.length || 0}`);
      
      if (games?.length > 0) {
        const sportBreakdown = games.reduce((acc, game) => {
          const sport = game.league || game.sport || 'Unknown';
          acc[sport] = (acc[sport] || 0) + 1;
          return acc;
        }, {});
        
        console.log('   Games by sport:', sportBreakdown);
        console.log('\n   Sample games:');
        games.slice(0, 3).forEach(game => {
          console.log(`   - ${game.home_team} vs ${game.away_team} (${game.league || game.sport}) at ${game.game_date}`);
        });
      } else {
        console.log('⚠️ No games found for today in games table');
      }
    }

    // Check raw_props breakdown by sport for today
    console.log('\n📊 RAW PROPS SPORT BREAKDOWN TODAY:');
    const { data: propsByGame, error: propsError } = await supabase
      .from('raw_props')
      .select('sport, team, opponent, game_time, stat_type, player_name')
      .gte('created_at', today + 'T00:00:00')
      .lt('created_at', today + 'T23:59:59');
    
    if (propsError) {
      console.log('❌ Props breakdown error:', propsError.message);
    } else {
      const sportStats = propsByGame.reduce((acc, prop) => {
        const sport = prop.sport || 'Unknown';
        if (!acc[sport]) {
          acc[sport] = { count: 0, teams: new Set(), players: new Set(), statTypes: new Set() };
        }
        acc[sport].count++;
        if (prop.team) acc[sport].teams.add(prop.team);
        if (prop.opponent) acc[sport].teams.add(prop.opponent);
        if (prop.player_name) acc[sport].players.add(prop.player_name);
        if (prop.stat_type) acc[sport].statTypes.add(prop.stat_type);
        return acc;
      }, {});

      console.log('Today\'s Props Coverage:');
      Object.entries(sportStats).forEach(([sport, stats]) => {
        console.log(`\n🏈 ${sport}:`);
        console.log(`   Props: ${stats.count}`);
        console.log(`   Teams: ${stats.teams.size}`);
        console.log(`   Players: ${stats.players.size}`);
        console.log(`   Stat Types: ${stats.statTypes.size}`);
        console.log(`   Sample Teams: ${[...stats.teams].slice(0, 5).join(', ')}`);
        console.log(`   Sample Stats: ${[...stats.statTypes].slice(0, 5).join(', ')}`);
      });
    }

    // Check for missing sports that should be active
    console.log('\n🔍 MISSING SPORTS ANALYSIS:');
    const expectedSports = ['MLB', 'NFL', 'NCAAF'];
    const foundSports = propsByGame ? [...new Set(propsByGame.map(p => p.sport))] : [];
    
    console.log(`Expected sports: ${expectedSports.join(', ')}`);
    console.log(`Found sports: ${foundSports.join(', ')}`);
    
    const missingSports = expectedSports.filter(sport => !foundSports.includes(sport));
    if (missingSports.length > 0) {
      console.log(`❌ Missing sports data: ${missingSports.join(', ')}`);
      
      // Check if we have data for these sports in other date ranges
      for (const sport of missingSports) {
        const { data: recentData, error: recentError } = await supabase
          .from('raw_props')
          .select('created_at, game_time')
          .eq('sport', sport)
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (!recentError && recentData?.length > 0) {
          console.log(`   Last ${sport} data: ${recentData[0].created_at}`);
        } else {
          console.log(`   No recent ${sport} data found`);
        }
      }
    } else {
      console.log('✅ All expected sports have data');
    }

    // Check agent status for data ingestion
    console.log('\n🤖 DATA INGESTION AGENT STATUS:');
    const { data: agents, error: agentError } = await supabase
      .from('agents')
      .select('name, status, last_ping, config')
      .eq('type', 'ingestion');
    
    if (!agentError && agents?.length > 0) {
      agents.forEach(agent => {
        console.log(`${agent.name}: ${agent.status} (Last ping: ${agent.last_ping})`);
        if (agent.config && agent.config.sources) {
          console.log(`   Sources: ${agent.config.sources.join(', ')}`);
        }
      });
    } else {
      console.log('❌ No ingestion agents found or error:', agentError?.message);
    }

    console.log('\n📋 DATA PIPELINE DIAGNOSIS:');
    console.log('='.repeat(50));
    
    const totalExpectedGames = 20; // Rough estimate for MLB + NFL + NCAAF on active day
    const propsPerGame = 50; // Conservative estimate
    const expectedProps = totalExpectedGames * propsPerGame;
    
    console.log(`Expected daily props (estimate): ${expectedProps}`);
    console.log(`Actual props today: ${propsByGame?.length || 0}`);
    console.log(`Coverage: ${((propsByGame?.length || 0) / expectedProps * 100).toFixed(1)}%`);
    
    if ((propsByGame?.length || 0) < expectedProps * 0.5) {
      console.log('🔴 CRITICAL - Data pipeline significantly underperforming');
      console.log('🔧 ACTION NEEDED: Check FeedAgent, API keys, and data source health');
    } else if ((propsByGame?.length || 0) < expectedProps * 0.8) {
      console.log('🟡 WARNING - Data pipeline partially working');
      console.log('🔧 ACTION RECOMMENDED: Investigate missing sports coverage');
    } else {
      console.log('🟢 GOOD - Data pipeline performing well');
    }

  } catch (error) {
    console.error('💥 Games check failed:', error.message);
  }
}

checkGamesToday();