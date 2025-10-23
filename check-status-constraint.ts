import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lxqmuzmqtnnlpfapvief.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E'
);

async function main() {
  // Query existing picks to see what statuses exist
  const { data, error } = await supabase
    .from('unified_picks')
    .select('status')
    .limit(10);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('\nExisting statuses in unified_picks:');
    const statuses = new Set(data.map(p => p.status));
    statuses.forEach(status => console.log(`  - ${status}`));
  }
}

main();
