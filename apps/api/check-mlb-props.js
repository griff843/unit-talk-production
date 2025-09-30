const { createClient } = require('@supabase/supabase-js');

async function checkMLBProps() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Checking MLB Player Props in Database');
  console.log('='.repeat(60));

  try {
    // Check for ANY MLB player props (not just today)
    const { data: mlbProps, count: mlbCount } = await supabase
      .from('unified_picks')
      .select('market, matchup, metadata, created_at', { count: 'exact' })
      .eq('source', 'odds-api')
      .or('market.ilike.batter_%,market.ilike.pitcher_%')
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('\n⚾ MLB Player Props (batter/pitcher markets):');
    console.log('  Total in database:', mlbCount || 0);

    if (mlbProps && mlbProps.length > 0) {
      console.log('\n📋 Sample MLB Props:');
      mlbProps.forEach(p => {
        const player = p.metadata?.player_name || 'Unknown';
        const created = new Date(p.created_at).toLocaleString();
        console.log(`  - ${p.market.padEnd(25)} | ${player.padEnd(25)} | ${created}`);
      });

      // Get unique markets
      const { data: uniqueMarkets } = await supabase
        .from('unified_picks')
        .select('market')
        .eq('source', 'odds-api')
        .or('market.ilike.batter_%,market.ilike.pitcher_%');

      const markets = [...new Set(uniqueMarkets?.map(m => m.market) || [])];
      console.log('\n📊 Unique MLB Markets Found:', markets.length);
      console.log('  Markets:', markets.sort().join(', '));

    } else {
      console.log('\n⚠️  No MLB player props found in database yet');
      console.log('  This could mean:');
      console.log('  1. Props were deduplicated (already existed)');
      console.log('  2. Need to run a fresh ingestion');
      console.log('  3. MLB games not yet available for today');
    }

    // Check all props by sport
    const { data: allPicks } = await supabase
      .from('unified_picks')
      .select('metadata')
      .eq('source', 'odds-api')
      .limit(1000);

    const sportCounts = {};
    allPicks?.forEach(p => {
      const sport = p.metadata?.sport_key || 'unknown';
      sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    });

    console.log('\n📊 Props by Sport (source=odds-api):');
    Object.entries(sportCounts).sort((a, b) => b[1] - a[1]).forEach(([sport, count]) => {
      console.log(`  ${sport.padEnd(25)}: ${count}`);
    });

  } catch (err) {
    console.log('❌ Error:', err.message);
    process.exit(1);
  }
}

checkMLBProps();