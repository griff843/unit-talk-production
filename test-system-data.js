const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Testing System Data - Production Readiness Check');
console.log('='.repeat(70));

async function checkSystemData() {
  try {
    // Check raw props for today
    console.log('\n📊 RAW PROPS DATA:');
    const today = new Date().toISOString().split('T')[0];
    
    const { data: todayProps, error: propsError } = await supabase
      .from('raw_props')
      .select('id, sport, stat_type, player_name, created_at')
      .gte('created_at', today + 'T00:00:00')
      .lt('created_at', today + 'T23:59:59');
    
    if (propsError) throw propsError;
    
    const { data: totalProps, error: totalError } = await supabase
      .from('raw_props')
      .select('id', { count: 'exact' });
    
    if (totalError) throw totalError;
    
    console.log(`✅ Total raw props: ${totalProps.length || 0}`);
    console.log(`✅ Props created today: ${todayProps?.length || 0}`);
    
    if (todayProps?.length > 0) {
      const sportBreakdown = todayProps.reduce((acc, prop) => {
        acc[prop.sport] = (acc[prop.sport] || 0) + 1;
        return acc;
      }, {});
      console.log('   Today\'s props by sport:', sportBreakdown);
    }

    // Check unified picks for today
    console.log('\n🎯 UNIFIED PICKS DATA:');
    const { data: todayPicks, error: picksError } = await supabase
      .from('unified_picks')
      .select('id, sport, created_at, professional_score')
      .gte('created_at', today + 'T00:00:00')
      .lt('created_at', today + 'T23:59:59');
    
    if (picksError) throw picksError;
    
    const { data: totalPicks, error: totalPicksError } = await supabase
      .from('unified_picks')
      .select('id', { count: 'exact' });
    
    if (totalPicksError) throw totalPicksError;
    
    console.log(`✅ Total unified picks: ${totalPicks.length || 0}`);
    console.log(`✅ Picks created today: ${todayPicks?.length || 0}`);
    
    const professionalPicks = todayPicks?.filter(p => p.professional_score != null) || [];
    console.log(`✅ Professional picks today: ${professionalPicks.length}`);

    // Check teams database
    console.log('\n🏟️ TEAMS DATABASE:');
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, league, city, metadata');
    
    if (teamsError) {
      console.log('❌ Teams table error:', teamsError.message);
      // Try alternative table names
      const { data: altTeams, error: altError } = await supabase
        .from('nfl_teams')
        .select('id, team_name, conference');
      
      if (altError) {
        console.log('❌ No teams tables found - checking available tables...');
        
        // Check what team-related tables exist
        const { data: tables, error: tablesError } = await supabase.rpc('exec_sql', {
          query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%team%'"
        });
        
        if (!tablesError && tables) {
          console.log('Available team-related tables:', tables);
        } else {
          console.log('Could not query table structure, checking raw_props for team data...');
          
          // Check if raw_props has team data
          const { data: teamData, error: teamDataError } = await supabase
            .from('raw_props')
            .select('team, opponent')
            .not('team', 'is', null)
            .limit(10);
          
          if (!teamDataError && teamData?.length > 0) {
            const uniqueTeams = [...new Set([
              ...teamData.map(p => p.team),
              ...teamData.map(p => p.opponent)
            ].filter(Boolean))];
            
            console.log(`✅ Team data found in raw_props: ${uniqueTeams.length} unique teams`);
            console.log('   Sample teams:', uniqueTeams.slice(0, 5));
          } else {
            console.log('❌ No team data found in raw_props either');
          }
        }
      } else {
        console.log(`✅ NFL teams found: ${altTeams?.length || 0}`);
        if (altTeams?.length > 0) {
          const sampleTeam = altTeams[0];
          console.log('   Sample team:', sampleTeam.team_name, sampleTeam.conference);
        }
      }
    } else {
      console.log(`✅ Teams with metadata: ${teams?.length || 0}`);
      if (teams?.length > 0) {
        const leagueBreakdown = teams.reduce((acc, team) => {
          acc[team.league] = (acc[team.league] || 0) + 1;
          return acc;
        }, {});
        console.log('   Teams by league:', leagueBreakdown);
        
        const teamsWithMetadata = teams.filter(t => t.metadata && Object.keys(t.metadata).length > 0);
        console.log(`   Teams with rich metadata: ${teamsWithMetadata.length}`);
      }
    }

    console.log('\n📈 SYSTEM ACTIVITY SUMMARY:');
    console.log('='.repeat(50));
    console.log(`🔢 Total Props: ${totalProps.length || 0}`);
    console.log(`📅 Today's Props: ${todayProps?.length || 0}`);
    console.log(`🎯 Total Picks: ${totalPicks.length || 0}`);
    console.log(`📅 Today's Picks: ${todayPicks?.length || 0}`);
    console.log(`⚡ Professional Picks Today: ${professionalPicks.length}`);
    
    const dataHealthScore = [
      (totalProps.length || 0) > 1000 ? 25 : 0,  // Good prop volume
      (todayProps?.length || 0) > 0 ? 25 : 0,    // Fresh data today
      (totalPicks.length || 0) > 0 ? 25 : 0,     // Pick processing working
      professionalPicks.length > 0 ? 25 : 0      // Professional grading active
    ].reduce((a, b) => a + b, 0);
    
    console.log(`\n🎯 Data Health Score: ${dataHealthScore}/100`);
    
    if (dataHealthScore >= 75) {
      console.log('🟢 EXCELLENT - System has robust data and is processing actively');
    } else if (dataHealthScore >= 50) {
      console.log('🟡 GOOD - System operational with moderate data activity');  
    } else {
      console.log('🔴 ATTENTION - Low data activity, may need data pipeline review');
    }

  } catch (error) {
    console.error('💥 System data check failed:', error.message);
  }
}

checkSystemData();