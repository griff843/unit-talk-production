import { supabaseClient } from './src/services/supabaseClient';

async function checkSchema() {
  if (!supabaseClient) {
    console.log('Supabase client not initialized');
    process.exit(1);
  }

  // Check if table exists and its structure
  const { data, error } = await supabaseClient
    .from('feature_values')
    .select('*')
    .limit(1);

  console.log('Table exists:', !error || error.code !== '42P01');
  console.log('Error:', error);
  console.log('Sample data:', data);

  // Check count
  const { count } = await supabaseClient
    .from('feature_values')
    .select('*', { count: 'exact', head: true });

  console.log('Row count:', count);
}

checkSchema().then(() => process.exit(0)).catch(console.error);
