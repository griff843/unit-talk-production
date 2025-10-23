import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://lxqmuzmqtnnlpfapvief.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E'
);

async function getRealProps() {
  // Get NFL props for testing
  const { data: nflProps, error: nflError } = await sb
    .from('raw_props')
    .select('*')
    .eq('sport', 'NFL')
    .not('player_name', 'is', null)
    .limit(10);

  if (nflError) {
    console.error('Error fetching NFL props:', nflError);
    return;
  }

  console.log('\n📊 NFL Props Available for Testing:\n');
  nflProps?.forEach((prop, i) => {
    console.log(`${i + 1}. ${prop.player_name}`);
    console.log(`   Market: ${prop.market}`);
    console.log(`   Line: ${prop.line}`);
    console.log(`   Odds: ${prop.odds}`);
    console.log(`   Book: ${prop.bookmaker_key}\n`);
  });

  console.log(`Total NFL props found: ${nflProps?.length || 0}`);
}

getRealProps();
