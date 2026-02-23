// Test Supabase connection and data availability
// SPRINT-SUPABASE-ENDPOINT-TRUTH-LOCK-110A: Use env vars - no hardcoded URLs
require('dotenv').config({ path: '../../.env' });
const { createClient } = require('@supabase/supabase-js');

// SPRINT-SCHEMA-ENV-GATES-002: Lazy Supabase initialization
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ SPRINT-110A: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
      process.exit(1);
    }
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

async function testSupabaseConnection() {
  console.log('🧪 Testing Supabase Production Database Connection...\n');

  const supabase = getSupabase();

  // Test core tables that Command Center needs
  const tables = ['users', 'unified_picks', 'agent_health', 'agent_metrics', 'raw_props'];

  const results = {};

  for (const table of tables) {
    console.log(`🔍 Testing table: ${table}`);

    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .limit(5);

      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
        results[table] = { status: 'error', error: error.message, count: 0 };
      } else {
        console.log(`✅ ${table}: ${count} total records, first 5 retrieved`);
        results[table] = {
          status: 'success',
          count: count || 0,
          sample: data?.slice(0, 2) || [],
        };

        // Show sample data structure
        if (data && data.length > 0) {
          console.log(`   Sample record keys: ${Object.keys(data[0]).join(', ')}`);
        }
      }
    } catch (err) {
      console.log(`❌ ${table}: Connection failed - ${err.message}`);
      results[table] = { status: 'connection_error', error: err.message, count: 0 };
    }

    console.log(''); // Add spacing
  }

  // Test specific data we need for Command Center
  console.log('🎯 Testing Command Center specific data...\n');

  // Check for real capper data (mentioned in requirements)
  try {
    const { data: users } = await supabase
      .from('users')
      .select('username, tier, discord_id')
      .in('username', ['Griff843', 'Vicgo', 'Sauced', 'MoneyReef', 'Squirrel']);

    console.log(`✅ Real cappers found: ${users?.length || 0}`);
    if (users && users.length > 0) {
      users.forEach(user => {
        console.log(`   - ${user.username} (${user.tier})`);
      });
    }
  } catch (err) {
    console.log(`❌ Capper lookup failed: ${err.message}`);
  }

  console.log(''); // Add spacing

  // Check for recent agent activity
  try {
    const { data: agentActivity } = await supabase
      .from('agent_health')
      .select('agent, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    console.log(`✅ Recent agent activity: ${agentActivity?.length || 0} records`);
    if (agentActivity && agentActivity.length > 0) {
      agentActivity.slice(0, 3).forEach(activity => {
        console.log(`   - ${activity.agent}: ${activity.status} (${activity.created_at})`);
      });
    }
  } catch (err) {
    console.log(`❌ Agent activity lookup failed: ${err.message}`);
  }

  console.log('\n📊 Summary Report:');
  console.log('==================');

  const successTables = Object.keys(results).filter(t => results[t].status === 'success');
  const errorTables = Object.keys(results).filter(t => results[t].status !== 'success');

  console.log(`✅ Working tables: ${successTables.length}/${tables.length}`);
  console.log(`❌ Failed tables: ${errorTables.length}/${tables.length}`);

  if (successTables.length > 0) {
    console.log(`Working: ${successTables.join(', ')}`);
  }

  if (errorTables.length > 0) {
    console.log(`Failed: ${errorTables.join(', ')}`);

    console.log('\n🔧 Recommendations:');
    errorTables.forEach(table => {
      const result = results[table];
      if (result.error.includes('permission denied')) {
        console.log(`   - ${table}: Check RLS policies and user permissions`);
      } else if (result.error.includes('does not exist')) {
        console.log(`   - ${table}: Table may need to be created or migration applied`);
      } else {
        console.log(`   - ${table}: ${result.error}`);
      }
    });
  }

  const isProduction =
    successTables.includes('unified_picks') &&
    successTables.includes('agent_health') &&
    successTables.includes('users');

  console.log(`\n🎯 Production Readiness: ${isProduction ? '✅ READY' : '❌ NEEDS SETUP'}`);

  if (isProduction) {
    console.log('✅ Command Center can connect to real production data');
    console.log('✅ Ready to implement live agent controls and real-time updates');
  } else {
    console.log('⚠️ Some tables missing - Command Center will use mock data');
    console.log('⚠️ Need to fix database permissions or create missing tables');
  }

  return results;
}

testSupabaseConnection().catch(console.error);
