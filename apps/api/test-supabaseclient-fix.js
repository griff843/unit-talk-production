console.log('🔧 Testing Fixed SupabaseClient\n');

const { createRequire } = require('module');
const require = createRequire(import.meta.url);

// Use tsx to handle TypeScript imports
async function testSupabaseClient() {
  try {
    // Import using dynamic import to handle TypeScript
    const { register } = await import('tsx/esm');
    await register();

    const { getEnv } = await import('./src/utils/getEnv.ts');
    const env = getEnv();

    console.log('✅ getEnv() loaded successfully');
    console.log('   SUPABASE_URL:', env.SUPABASE_URL);
    console.log('   SUPABASE_SERVICE_ROLE_KEY:', env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 30) + '...');

    const { supabaseClient, isSupabaseConfigured } = await import('./src/services/supabaseClient.ts');

    console.log('✅ supabaseClient loaded successfully');
    console.log('   isSupabaseConfigured:', isSupabaseConfigured);
    console.log('   supabaseClient:', supabaseClient ? 'CONFIGURED' : 'NULL');

    if (supabaseClient) {
      console.log('\n2. Testing actual database connection:');
      const { data, error } = await supabaseClient
        .from('raw_props')
        .select('id, sport, game_date')
        .limit(2);

      if (error) {
        console.error('❌ Database query failed:', error);
      } else {
        console.log('✅ Database query successful');
        console.log('📊 Data:', data);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSupabaseClient();