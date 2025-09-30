const { createClient } = require('@supabase/supabase-js');

async function checkData() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const today = new Date().toISOString().split('T')[0];

  console.log('🔍 Checking database ingestion for', today);
  console.log('='.repeat(60));

  try {
    // Check unified_picks
    const { count: picksCount, error: picksError } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true })
      .gte('game_date', today + 'T00:00:00Z');

    if (picksError) throw picksError;

    // Check games
    const { count: gamesCount, error: gamesError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .gte('commence_time', today + 'T00:00:00Z');

    if (gamesError) throw gamesError;

    // Check MLB player props
    const { count: mlbCount, error: mlbError } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true })
      .gte('game_date', today + 'T00:00:00Z')
      .or('market.ilike.batter_%,market.ilike.pitcher_%');

    if (mlbError) throw mlbError;

    // Get sample picks
    const { data: samplePicks } = await supabase
      .from('unified_picks')
      .select('market, matchup, source, metadata')
      .gte('game_date', today + 'T00:00:00Z')
      .order('created_at', { ascending: false })
      .limit(5);

    // Get sample games
    const { data: sampleGames } = await supabase
      .from('games')
      .select('sport, matchup, commence_time')
      .gte('commence_time', today + 'T00:00:00Z')
      .order('commence_time', { ascending: true })
      .limit(5);

    console.log('\n📊 INGESTION RESULTS:');
    console.log('  unified_picks (today):', picksCount || 0, 'rows ✅');
    console.log('  games (today):', gamesCount || 0, 'rows ✅');
    console.log('  MLB player props:', mlbCount || 0, 'rows ✅');

    if (samplePicks && samplePicks.length > 0) {
      console.log('\n📋 Sample Picks:');
      samplePicks.forEach(p => {
        const player = p.metadata?.player_name || p.metadata?.team || 'N/A';
        console.log(`  - ${p.market.padEnd(20)} | ${p.matchup?.substring(0, 30).padEnd(30)} | ${player}`);
      });
    }

    if (sampleGames && sampleGames.length > 0) {
      console.log('\n🏟️  Sample Games:');
      sampleGames.forEach(g => {
        const time = new Date(g.commence_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        console.log(`  - ${g.sport.padEnd(6)} | ${g.matchup.padEnd(40)} | ${time}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Database ingestion verified!');

  } catch (err) {
    console.log('❌ Error:', err.message);
    process.exit(1);
  }
}

checkData();