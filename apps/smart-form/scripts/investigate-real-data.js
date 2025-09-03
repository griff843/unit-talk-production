const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars for script. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateRealData() {
  console.log('🔍 Investigating REAL data in production database...');
  console.log('===============================================\n');

  // Check for real data tables that should exist based on their pipeline
  const tablesToCheck = [
    'raw_props',
    'daily_picks',
    'unified_picks',
    'games',
    'picks',
    'props',
    'cappers',
    'users',
    'user_profiles',
    'smart_tickets',
  ];

  console.log('📊 Checking available tables and real data...\n');

  for (const tableName of tablesToCheck) {
    try {
      console.log(`🔍 Checking table: ${tableName}`);

      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: false })
        .limit(3);

      if (error) {
        console.log(`   ❌ Table ${tableName} not accessible: ${error.message}`);
        continue;
      }

      console.log(`   ✅ Table ${tableName} exists with ${count} records`);

      if (data && data.length > 0) {
        console.log(`   📋 Columns:`, Object.keys(data[0]));
        console.log(
          `   📝 Sample record:`,
          JSON.stringify(data[0], null, 2).substring(0, 500) + '...'
        );
      } else {
        console.log(`   ⚠️ Table ${tableName} is empty`);
      }

      console.log(''); // Space between tables
    } catch (e) {
      console.log(`   ❌ Error checking ${tableName}:`, e.message);
    }
  }

  // Specifically look for real cappers data
  console.log('\n🎯 Looking for REAL CAPPERS in the system...');
  try {
    // Check multiple possible capper tables/columns
    const capperQueries = [
      { table: 'cappers', columns: '*' },
      { table: 'user_profiles', columns: 'id, username, display_name, tier, role' },
      { table: 'users', columns: 'id, username, display_name, email' },
      { table: 'daily_picks', columns: 'capper, author, created_by' },
      { table: 'unified_picks', columns: 'capper, author, created_by' },
      { table: 'smart_tickets', columns: 'capper' },
    ];

    for (const query of capperQueries) {
      try {
        const { data, error } = await supabase.from(query.table).select(query.columns).limit(5);

        if (!error && data && data.length > 0) {
          console.log(`✅ Found potential cappers in ${query.table}:`);
          data.forEach((record, i) => {
            console.log(`   ${i + 1}. ${JSON.stringify(record)}`);
          });
        }
      } catch (e) {
        // Skip if table doesn't exist
      }
    }
  } catch (e) {
    console.log('❌ Error checking cappers:', e.message);
  }

  // Look for REAL GAMES (not my test data)
  console.log('\n🏈 Looking for REAL GAMES in the system...');
  try {
    const { data: realGames, error } = await supabase
      .from('games')
      .select('*')
      .neq('source', 'manual_test_data') // Exclude my test data
      .limit(5);

    if (!error && realGames && realGames.length > 0) {
      console.log(`✅ Found ${realGames.length} REAL games (non-test):`);
      realGames.forEach((game, i) => {
        console.log(
          `   ${i + 1}. ${game.league}: ${game.matchup || game.away_team + ' @ ' + game.home_team}`
        );
        console.log(`      Date: ${game.game_date || game.date}`);
        console.log(`      Source: ${game.source}`);
        console.log(`      Status: ${game.status}`);
      });
    } else {
      console.log('⚠️ No real games found (excluding test data)');
    }
  } catch (e) {
    console.log('❌ Error checking real games:', e.message);
  }

  // Look for REAL PROPS data
  console.log('\n🎲 Looking for REAL PROPS/PICKS data...');
  try {
    // Check raw_props for recent real data
    const { data: rawProps, error: rawPropsError } = await supabase
      .from('raw_props')
      .select('*')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .order('created_at', { ascending: false })
      .limit(3);

    if (!rawPropsError && rawProps && rawProps.length > 0) {
      console.log(`✅ Found ${rawProps.length} recent raw props:`);
      rawProps.forEach((prop, i) => {
        console.log(`   ${i + 1}. Sport: ${prop.sport}, Game: ${prop.matchup || prop.game_title}`);
        console.log(`      Created: ${prop.created_at}`);
        console.log(`      Columns: ${Object.keys(prop)}`);
      });
    }

    // Check daily_picks for recent real data
    const { data: dailyPicks, error: dailyPicksError } = await supabase
      .from('unified_picks')
      .select('*')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .order('created_at', { ascending: false })
      .limit(3);

    if (!dailyPicksError && dailyPicks && dailyPicks.length > 0) {
      console.log(`✅ Found ${dailyPicks.length} recent daily picks:`);
      dailyPicks.forEach((pick, i) => {
        console.log(`   ${i + 1}. Capper: ${pick.capper}, Sport: ${pick.sport}`);
        console.log(`      Pick: ${pick.selection || pick.pick_description}`);
        console.log(`      Created: ${pick.created_at}`);
      });
    }
  } catch (e) {
    console.log('❌ Error checking props/picks:', e.message);
  }

  console.log('\n🎯 SUMMARY: Real Data Investigation');
  console.log('=====================================');
  console.log('Next step: Create tests using REAL data from your production system');
  console.log(
    'This will validate the actual end-to-end workflow with real cappers, games, and props'
  );
}

// Run the investigation
investigateRealData();
