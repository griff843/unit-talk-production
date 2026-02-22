const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://cqfnsozknjzvyiziwicl.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E'
);

async function listTables() {
  console.log('📋 Listing available tables...');
  
  // Try checking games table first since we know it exists
  const gamesCheck = await supabase.from('games').select('*').limit(1);
  console.log('Games table check:', gamesCheck.error ? 'MISSING' : 'EXISTS');
  
  if (!gamesCheck.error && gamesCheck.data && gamesCheck.data.length > 0) {
    console.log('Games table structure:', Object.keys(gamesCheck.data[0]));
  }
  
  // Try common table names for props
  const tableNames = ['props', 'raw_props', 'player_props', 'unified_props', 'daily_picks', 'unified_picks'];
  
  console.log('\n🔍 Checking prop table candidates...');
  for (const tableName of tableNames) {
    try {
      const { data, error } = await supabase.from(tableName).select('*').limit(1);
      if (error) {
        console.log(`❌ Table '${tableName}': MISSING (${error.code})`);
      } else {
        console.log(`✅ Table '${tableName}': EXISTS`);
        if (data && data.length > 0) {
          console.log(`   Structure:`, Object.keys(data[0]));
        }
      }
    } catch (err) {
      console.log(`❌ Table '${tableName}': ERROR -`, err.message);
    }
  }
}

listTables().catch(console.error);