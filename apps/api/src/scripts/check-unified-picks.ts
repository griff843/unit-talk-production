import { createClient } from '@supabase/supabase-js';

async function checkUnifiedPicks() {
  const supabase = createClient(
    'https://lxqmuzmqtnnlpfapvief.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E'
  );

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('unified_picks')
    .select('sport, created_at')
    .gte('created_at', twoMinutesAgo)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  const counts: Record<string, number> = {};
  data.forEach((row: any) => {
    counts[row.sport] = (counts[row.sport] || 0) + 1;
  });

  console.log('\n✅ Props in unified_picks (last 2 minutes):');
  Object.entries(counts).forEach(([sport, count]) => {
    console.log(`   ${sport}: ${count}`);
  });
  console.log(`\n📊 Total: ${data.length} picks`);

  if (data.length > 0) {
    console.log(`\n🕒 Most recent: ${data[0].created_at}`);
  }
}

checkUnifiedPicks().catch(console.error);
