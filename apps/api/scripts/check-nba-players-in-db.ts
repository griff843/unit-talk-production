import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function checkNbaPlayers() {
  console.log('🏀 CHECKING NBA PLAYERS IN DATABASE');
  console.log('='.repeat(40));

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check NBA players
    const { data: nbaPlayers, error: nbaError } = await supabase
      .from('players')
      .select('*')
      .eq('sport', 'NBA')
      .limit(10);

    if (nbaError) {
      console.log('❌ Error fetching NBA players:', nbaError.message);
    } else {
      console.log(`📊 NBA players found: ${nbaPlayers?.length || 0}`);
      
      if (nbaPlayers && nbaPlayers.length > 0) {
        console.log('\n🏀 SAMPLE NBA PLAYERS:');
        nbaPlayers.forEach((player, index) => {
          console.log(`  ${index + 1}. ${player.player_name || 'NULL'} (${player.team}) [ID: ${player.player_id}]`);
        });

        console.log('\n📋 SAMPLE NBA PLAYER STRUCTURE:');
        console.log(JSON.stringify(nbaPlayers[0], null, 2));
      }
    }

    // Check all sports
    const { data: allPlayers } = await supabase.from('players').select('sport').limit(1000);
    const sports = [...new Set(allPlayers?.map(p => p.sport))].sort();
    console.log('\n📊 ALL SPORTS IN DATABASE:', sports);

    // Check sample of each sport
    for (const sport of sports) {
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('sport', sport);
      
      console.log(`  ${sport}: ${count} players`);
    }

  } catch (error) {
    console.error('💥 Check failed:', error);
  }
}

checkNbaPlayers();