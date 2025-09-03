import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

/**
 * CHECK DATABASE PLAYER COVERAGE
 * 
 * Analyze current player database to identify missing leagues and coverage gaps
 */

async function checkDatabasePlayerCoverage() {
  console.log('📊 CHECKING DATABASE PLAYER COVERAGE');
  console.log('='.repeat(60));

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if players table exists and get structure
    console.log('\n🔍 CHECKING PLAYERS TABLE STRUCTURE...');
    
    const { data: tableInfo, error: tableError } = await supabase
      .from('players')
      .select('*')
      .limit(1);

    if (tableError) {
      console.log('❌ Players table query failed:', tableError.message);
      
      // Check if table exists by trying to get table schema
      const { data: schemaData, error: schemaError } = await supabase
        .rpc('get_table_schema', { table_name: 'players' });
        
      if (schemaError) {
        console.log('❌ Players table does not exist or is not accessible');
        console.log('💡 Need to create players table first');
        return;
      }
    }

    console.log('✅ Players table is accessible');

    // Get player count by sport
    console.log('\n📊 PLAYER COUNT BY SPORT...');
    
    const { data: sportCounts, error: countError } = await supabase
      .from('players')
      .select('sport')
      .then(({ data, error }) => {
        if (error) return { data: null, error };
        
        // Count by sport
        const counts: Record<string, number> = {};
        data?.forEach(player => {
          const sport = player.sport || 'UNKNOWN';
          counts[sport] = (counts[sport] || 0) + 1;
        });
        
        return { data: counts, error: null };
      });

    if (countError) {
      console.log('❌ Error counting players by sport:', countError.message);
    } else if (sportCounts) {
      console.log('📈 CURRENT PLAYER COUNTS:');
      Object.entries(sportCounts)
        .sort(([,a], [,b]) => b - a)
        .forEach(([sport, count]) => {
          console.log(`  ${sport}: ${count} players`);
        });
    }

    // Get total player count
    const { count: totalPlayers, error: totalError } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.log('❌ Error getting total player count:', totalError.message);
    } else {
      console.log(`\n📊 TOTAL PLAYERS: ${totalPlayers}`);
    }

    // Check for specific high-profile players across sports
    console.log('\n🔍 CHECKING FOR KEY PLAYERS...');
    
    const keyPlayers = [
      // NBA
      { name: 'LeBron James', sport: 'NBA', expected: true },
      { name: 'Stephen Curry', sport: 'NBA', expected: true },
      { name: 'Luka Doncic', sport: 'NBA', expected: true },
      
      // NFL
      { name: 'Josh Allen', sport: 'NFL', expected: true },
      { name: 'Patrick Mahomes', sport: 'NFL', expected: true },
      { name: 'Lamar Jackson', sport: 'NFL', expected: true },
      
      // MLB
      { name: 'Mike Trout', sport: 'MLB', expected: true },
      { name: 'Shohei Ohtani', sport: 'MLB', expected: true },
      { name: 'Aaron Judge', sport: 'MLB', expected: true },
      
      // WNBA (likely missing)
      { name: 'A\'ja Wilson', sport: 'WNBA', expected: false },
      { name: 'Breanna Stewart', sport: 'WNBA', expected: false },
      { name: 'Diana Taurasi', sport: 'WNBA', expected: false },
      
      // NCAAF (likely missing)
      { name: 'Caleb Williams', sport: 'NCAAF', expected: false },
      { name: 'Jayden Daniels', sport: 'NCAAF', expected: false }
    ];

    for (const player of keyPlayers) {
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('player_name, sport, player_id')
        .ilike('player_name', `%${player.name}%`)
        .eq('sport', player.sport)
        .limit(5);

      if (playerError) {
        console.log(`❌ Error searching for ${player.name}:`, playerError.message);
      } else if (playerData && playerData.length > 0) {
        console.log(`✅ FOUND: ${player.name} (${player.sport}) - ${playerData.length} matches`);
        playerData.forEach(p => {
          console.log(`   📝 ${p.player_name} [ID: ${p.player_id}]`);
        });
      } else {
        const status = player.expected ? '❌ MISSING' : '❓ NOT FOUND';
        console.log(`${status}: ${player.name} (${player.sport})`);
      }
    }

    // Check recent player additions
    console.log('\n📅 RECENT PLAYER ADDITIONS...');
    const { data: recentPlayers, error: recentError } = await supabase
      .from('players')
      .select('player_name, sport, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.log('❌ Error getting recent players:', recentError.message);
    } else if (recentPlayers && recentPlayers.length > 0) {
      console.log('🕒 LAST 10 PLAYER ADDITIONS:');
      recentPlayers.forEach(player => {
        const date = new Date(player.created_at).toLocaleDateString();
        console.log(`  ${player.player_name} (${player.sport}) - ${date}`);
      });
    } else {
      console.log('❓ No recent player data found or created_at column missing');
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 DATABASE COVERAGE ANALYSIS COMPLETE');
    console.log('='.repeat(60));

    console.log('\n📋 ANALYSIS SUMMARY:');
    console.log('✅ LIKELY WELL-COVERED: MLB, NBA, NFL (major players)');
    console.log('❌ LIKELY MISSING: WNBA, NCAAF');
    console.log('❓ UNKNOWN: NHL, other sports coverage completeness');
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('1. Create WNBA player population script (Optimal API)');
    console.log('2. Create NCAAF player population script (Optimal API)'); 
    console.log('3. Expand NFL player database for comprehensive coverage');
    console.log('4. Consider NHL player expansion if needed for headshots');

  } catch (error) {
    console.error('💥 Database coverage check failed:', error);
  }
}

// Run the analysis
checkDatabasePlayerCoverage();