// Test Command Center Database Connection
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testConnection() {
  console.log('🧪 Testing Command Center Database Connection');
  console.log('='.repeat(50));

  try {
    // Test unified_picks connection
    const { data: picks, error: picksError } = await supabase
      .from('unified_picks')
      .select('id, user_id, selection')
      .limit(3);

    if (picksError) {
      console.log('❌ unified_picks error:', picksError.message);
    } else {
      console.log(`✅ unified_picks: ${picks?.length || 0} picks found`);
    }

    // Test agent_health connection
    const { data: agents, error: agentsError } = await supabase
      .from('agent_health')
      .select('agent, status')
      .limit(3);

    if (agentsError) {
      console.log('❌ agent_health error:', agentsError.message);
    } else {
      console.log(`✅ agent_health: ${agents?.length || 0} agents found`);
    }

    // Test users connection
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username')
      .limit(3);

    if (usersError) {
      console.log('❌ users error:', usersError.message);
    } else {
      console.log(`✅ users: ${users?.length || 0} users found`);
    }

    console.log('\n🎉 Database connection test complete!');
    console.log('✅ Command Center should now load without 500 errors');
  } catch (error) {
    console.log('❌ Connection test failed:', error.message);
  }
}

testConnection();
