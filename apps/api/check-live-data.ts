import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLiveData() {
  const today = new Date().toISOString().split('T')[0];
  console.log('🔍 LIVE SYSTEM DATA CHECK');
  console.log('Date:', today);
  console.log('=' .repeat(80));

  try {
    // 1. Check unified_picks for today
    console.log('\n📊 1. Checking unified_picks for today...');
    const { data: picks, error: picksError } = await supabase
      .from('unified_picks')
      .select('id, sport, player_name, prop_type, line, created_at')
      .gte('created_at', today)
      .limit(10);

    if (picksError) {
      console.log('❌ Error:', picksError.message);
    } else {
      console.log(`✅ Found ${picks?.length || 0} picks today`);
      if (picks && picks.length > 0) {
        console.log('Sample:', JSON.stringify(picks[0], null, 2));
      }
    }

    // 2. Check games for today
    console.log('\n🏀 2. Checking games table...');
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, sport, home_team, away_team, game_date, status')
      .gte('game_date', today)
      .limit(10);

    if (gamesError) {
      console.log('❌ Error:', gamesError.message);
    } else {
      console.log(`✅ Found ${games?.length || 0} games today`);
      if (games && games.length > 0) {
        console.log('Sample:', JSON.stringify(games[0], null, 2));
      }
    }

    // 3. Check players metadata
    console.log('\n👤 3. Checking players table...');
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, name, sport, team, position')
      .limit(5);

    if (playersError) {
      console.log('❌ Error:', playersError.message);
    } else {
      console.log(`✅ Found ${players?.length || 0} players in database`);
      if (players && players.length > 0) {
        console.log('Sample:', JSON.stringify(players[0], null, 2));
      }
    }

    // 4. Check agent_health
    console.log('\n💚 4. Checking agent health...');
    const { data: health, error: healthError } = await supabase
      .from('agent_health')
      .select('agent_name, status, last_run, error_count')
      .order('last_run', { ascending: false })
      .limit(10);

    if (healthError) {
      console.log('❌ Error:', healthError.message);
    } else {
      console.log(`✅ Found ${health?.length || 0} agent health records`);
      if (health) {
        health.forEach(h => {
          console.log(`  ${h.agent_name}: ${h.status} (errors: ${h.error_count})`);
        });
      }
    }

    // 5. Summary
    console.log('\n' + '=' .repeat(80));
    console.log('📈 SUMMARY:');
    console.log(`   Picks Today: ${picks?.length || 0}`);
    console.log(`   Games Today: ${games?.length || 0}`);
    console.log(`   Players in DB: ${players?.length || 0}`);
    console.log(`   Agents Reporting: ${health?.length || 0}`);
    console.log('=' .repeat(80));

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

checkLiveData().catch(console.error);
