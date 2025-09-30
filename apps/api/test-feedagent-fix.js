// Force correct Supabase environment variables
process.env.SUPABASE_URL = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E';

console.log('🔧 Testing FeedAgent Database Connection Fix\n');

console.log('1. Environment after override:');
console.log('   SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 30) + '...');

console.log('\n2. Testing direct Supabase connection:');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('raw_props')
      .select('id, sport, game_date')
      .limit(3);

    if (error) {
      console.error('❌ Supabase connection failed:', error);
      return false;
    }

    console.log('✅ Supabase connection successful');
    console.log('📊 Sample data:', data);
    return true;

  } catch (err) {
    console.error('❌ Connection error:', err);
    return false;
  }
}

testConnection().then(success => {
  if (success) {
    console.log('\n🎉 FeedAgent database connection FIXED!');
    console.log('💡 FeedAgent should now work with correct Supabase credentials');
  } else {
    console.log('\n💥 Connection still failing');
  }
}).catch(error => {
  console.error('\n💥 Test failed:', error);
});