// Test Supabase connection and data availability
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o';

async function testSupabaseConnection() {
  console.log('🧪 Testing Supabase Production Database Connection...\n');

  const supabase = createClient(supabaseUrl, supabaseKey);

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
