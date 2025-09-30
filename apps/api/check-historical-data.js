const { createClient } = require('@supabase/supabase-js');

const client = createClient(
  'https://lxqmuzmqtnnlpfapvief.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E'
);

async function analyzeHistoricalData() {
  console.log('🔍 Analyzing historical data in database...\n');
  
  // Check date range distribution
  const { data: recent } = await client
    .from('raw_props')
    .select('game_date, sport')
    .order('game_date', { ascending: false })
    .limit(5);
    
  console.log('📅 Most recent dates:');
  recent.forEach(row => {
    console.log(`  ${row.game_date} - ${row.sport}`);
  });
  
  // Check oldest dates
  const { data: oldest } = await client
    .from('raw_props')
    .select('game_date, sport')
    .order('game_date', { ascending: true })
    .limit(5);
    
  console.log('\n📅 Oldest dates:');
  oldest.forEach(row => {
    console.log(`  ${row.game_date} - ${row.sport}`);
  });
  
  // Check 2024 vs 2025 distribution
  const { count: count2024 } = await client
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', '2024-01-01')
    .lt('game_date', '2025-01-01');
    
  const { count: count2025 } = await client
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', '2025-01-01');
    
  console.log(`\n📊 Data Distribution:`);
  console.log(`  2024 Games: ${count2024} picks`);
  console.log(`  2025 Games: ${count2025} picks`);
  
  // Find best date range for historical settlement (2024 completed games)
  const { data: mlb2024 } = await client
    .from('raw_props')
    .select('game_date')
    .eq('sport', 'MLB')
    .gte('game_date', '2024-04-01')
    .lt('game_date', '2024-11-01')
    .order('game_date', { ascending: false })
    .limit(1);
    
  if (mlb2024 && mlb2024.length > 0) {
    console.log(`\n🏆 Recommended Historical Range: 2024-04-01 to 2024-10-31`);
    console.log(`  Latest MLB 2024: ${mlb2024[0].game_date}`);
  }
}

analyzeHistoricalData().then(() => process.exit(0)).catch(console.error);