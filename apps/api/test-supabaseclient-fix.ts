import { getEnv } from './src/utils/getEnv';
import { supabaseClient, isSupabaseConfigured } from './src/services/supabaseClient';

console.log('🔧 Testing Fixed SupabaseClient\n');

async function testSupabaseClient() {
  try {
    const env = getEnv();

    console.log('1. Environment configuration:');
    console.log('   SUPABASE_URL:', env.SUPABASE_URL);
    console.log('   SUPABASE_SERVICE_ROLE_KEY:', env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 30) + '...');
    console.log('   isSupabaseConfigured:', isSupabaseConfigured);
    console.log('   supabaseClient:', supabaseClient ? 'CONFIGURED' : 'NULL');

    if (supabaseClient) {
      console.log('\n2. Testing database connection:');
      const { data, error } = await supabaseClient
        .from('raw_props')
        .select('id, sport, game_date')
        .limit(2);

      if (error) {
        console.error('❌ Database query failed:', error);
        return false;
      } else {
        console.log('✅ Database query successful');
        console.log('📊 Data:', data);
        return true;
      }
    } else {
      console.log('❌ supabaseClient is NULL');
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

testSupabaseClient().then(success => {
  if (success) {
    console.log('\n🎉 FeedAgent database connection is FIXED!');
    console.log('💡 SupabaseClient now works with production database');
  } else {
    console.log('\n💥 FeedAgent still has database connection issues');
  }
}).catch(error => {
  console.error('\n💥 Test runner failed:', error);
});