require('dotenv').config({ path: '../../.env' });
const { createClient } = require('@supabase/supabase-js');

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...\n');

  // Test with hardcoded values first
  const supabaseUrl = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E';

  console.log('📍 Using URL:', supabaseUrl);
  console.log('🔑 Using Key:', supabaseKey.substring(0, 20) + '...');

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('\n1️⃣ Testing basic connection...');
    const { data: testData, error: testError } = await supabase
      .from('raw_props')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('❌ Basic connection failed:', testError);
      return false;
    }

    console.log('✅ Basic connection successful');

    console.log('\n2️⃣ Testing table access...');
    const { data: propsData, error: propsError } = await supabase
      .from('raw_props')
      .select('id, game_date, sport')
      .limit(3);

    if (propsError) {
      console.error('❌ Table access failed:', propsError);
      return false;
    }

    console.log('✅ Table access successful');
    console.log('📊 Sample data:', propsData);

    console.log('\n3️⃣ Testing environment variables...');
    console.log('SUPABASE_URL from env:', process.env.SUPABASE_URL);
    console.log('SUPABASE_SERVICE_ROLE_KEY from env:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...');

    if (process.env.SUPABASE_URL === supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY === supabaseKey) {
      console.log('✅ Environment variables match hardcoded values');
    } else {
      console.log('❌ Environment variables do NOT match hardcoded values');
    }

    return true;

  } catch (error) {
    console.error('❌ Connection test failed:', error);
    return false;
  }
}

testSupabaseConnection()
  .then(success => {
    if (success) {
      console.log('\n🎉 Supabase connection test PASSED');
    } else {
      console.log('\n💥 Supabase connection test FAILED');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 Test runner error:', error);
    process.exit(1);
  });