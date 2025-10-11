import { supabaseClient } from './src/services/supabaseClient';

async function check() {
  if (!supabaseClient) {
    console.log('Supabase client not initialized');
    process.exit(1);
  }

  const { data, error, count } = await supabaseClient
    .from('market_props')
    .select('*', { count: 'exact', head: false })
    .limit(5);

  console.log('Count:', count);
  console.log('Error:', error);
  console.log('Sample data:', data);
}

check().then(() => process.exit(0)).catch(console.error);
