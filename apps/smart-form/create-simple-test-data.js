const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabase = createClient(
  'https://lxqmuzmqtnnlpfapvief.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E'
);

async function testDatabaseInsert() {
  console.log('🔍 Testing props table structure...');
  
  // Try a simple prop insert to see what columns exist
  const testProp = {
    id: uuidv4(),
    player_name: 'Test Player',
    stat_type: 'Points',
    line: 25.5,
    sport: 'NBA'
  };
  
  console.log('🧪 Testing simple prop insert...');
  const { data: propResult, error: propError } = await supabase
    .from('props')
    .insert([testProp])
    .select();
    
  if (propError) {
    console.error('❌ Prop insert error:', propError.message);
    console.log('📝 This tells us about the props table structure requirements');
  } else {
    console.log('✅ Prop insert successful:', propResult);
  }
}

testDatabaseInsert().catch(console.error);